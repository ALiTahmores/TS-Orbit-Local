import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { transform } from 'esbuild';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-unit-test-'));
const file = path.join(temp, 'persistence.cjs');
// The compiled copy lives outside the project, so its one package import is resolved from here.
const vercelFunctions = JSON.stringify(createRequire(import.meta.url).resolve('@vercel/functions'));
fs.writeFileSync(file, (await transform(fs.readFileSync(new URL('../../server/persistence.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs', target: 'node24' })).code.replace('require("@vercel/functions")', `require(${vercelFunctions})`));
const { PersistenceCoordinator } = createRequire(import.meta.url)(file);
test.after(() => fs.rmSync(temp, { recursive: true, force: true }));
const tick = () => new Promise(resolve => setImmediate(resolve));
const gate = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
class Response extends EventEmitter {
  statusCode = 200; destroyed = false; headersSent = false; body = null; headers = new Map();
  end(body) { this.body = body; this.headersSent = true; this.emit('finish'); return this; }
  status(status) { this.statusCode = status; return this; }
  json(body) { return this.end(JSON.stringify(body)); }
  setHeader(key, value) { this.headers.set(key.toLowerCase(), value); }
  removeHeader(key) { this.headers.delete(key.toLowerCase()); }
  destroy() { this.destroyed = true; this.emit('close'); }
}
class Database {
  durable = { value: 0, apiLogs: [], loginHistory: [], securityEvents: [] }; state = structuredClone(this.durable);
  calls = []; active = false; commitGate = null; commitError = null;
  async beginTransaction() { assert.equal(this.active, false); this.calls.push('begin'); this.active = true; this.state = structuredClone(this.durable); }
  async commitTransaction() { this.calls.push('commit-start'); if (this.commitGate) await this.commitGate.promise; if (this.commitError) throw this.commitError; this.durable = structuredClone(this.state); this.active = false; this.calls.push('commit-end'); }
  async rollbackTransaction() { this.calls.push('rollback'); this.active = false; this.state = structuredClone(this.durable); }
  getState() { return this.state; }
}
function request(coordinator, handler, extra = {}) {
  const req = { path: '/api/test', ...extra }, res = new Response();
  coordinator.middleware(req, res, error => { if (error) throw error; handler(req, res); });
  return { req, res };
}

test('HTTP success bytes and notifications wait for asynchronous commit', async () => {
  const db = new Database(), coordinator = new PersistenceCoordinator(db); db.commitGate = gate(); let notified = false;
  const { res } = request(coordinator, (_req, res) => { db.state.value = 1; coordinator.afterCommit(() => { notified = true; }); res.json({ ok: true }); });
  await tick(); assert.equal(res.body, null); assert.equal(notified, false); assert.equal(db.durable.value, 0);
  db.commitGate.resolve(); await tick(); assert.deepEqual(JSON.parse(res.body), { ok: true }); assert.equal(notified, true); assert.equal(db.durable.value, 1); await coordinator.stop();
});
test('failed commit discards successful response and events, restores state and runs cleanup', async () => {
  const db = new Database(), coordinator = new PersistenceCoordinator(db); db.commitError = Object.assign(new Error('synthetic failure'), { code: 'XX000' }); const events = [];
  const { res } = request(coordinator, (_req, res) => { db.state.value = 99; coordinator.afterCommit(() => events.push('published')); coordinator.onRollback(async () => { await tick(); events.push('cleaned'); }); res.json({ ok: true }); });
  await coordinator.stop(); assert.equal(res.statusCode, 503); assert.equal(JSON.parse(res.body).error, 'STORAGE_UNAVAILABLE'); assert.deepEqual(events, ['cleaned']); assert.equal(db.durable.value, 0); assert.equal(db.state.value, 0);
});
test('HTTP rejection rolls back business state and retains only audited failure records', async () => {
  const db = new Database(), coordinator = new PersistenceCoordinator(db); let notified = false;
  const { res } = request(coordinator, (req, res) => { db.state.value = 9; coordinator.afterCommit(() => { notified = true; }); req.storageLog = { id: 'synthetic-log' }; req.retainedSecurityAudit = { loginHistory: [{ id: 'synthetic-login' }], securityEvents: [] }; res.status(403).json({ error: 'FORBIDDEN' }); });
  await coordinator.stop(); assert.equal(res.statusCode, 403); assert.equal(db.durable.value, 0); assert.equal(notified, false); assert.equal(db.durable.apiLogs[0].status, 403); assert.equal(db.durable.loginHistory[0].id, 'synthetic-login'); assert.equal(db.calls.filter(item => item === 'begin').length, 2);
});
test('queued operations wait for prior commit and reload the latest durable state', async () => {
  const db = new Database(), coordinator = new PersistenceCoordinator(db); db.commitGate = gate(); const order = [];
  const first = coordinator.mutateResult(async () => { order.push('first'); db.state.value = 1; return 'one'; });
  await tick(); const second = coordinator.mutateResult(() => { order.push('second'); assert.equal(db.state.value, 1); db.state.value++; return 'two'; });
  await tick(); assert.deepEqual(order, ['first']); db.commitGate.resolve(); assert.deepEqual(await Promise.all([first, second]), ['one', 'two']); assert.equal(db.durable.value, 2); await coordinator.stop();
});
test('stream preparation gates first byte on commit and releases queue after durable authorization', async () => {
  const db = new Database(), coordinator = new PersistenceCoordinator(db); db.commitGate = gate(); let streaming;
  const { res } = request(coordinator, (_req, res) => { streaming = (async () => { await coordinator.prepareStream(); res.end('verified bytes'); })(); });
  await tick(); assert.equal(res.body, null); db.commitGate.resolve(); await streaming; assert.equal(res.body, 'verified bytes'); assert.equal(db.calls.at(-1), 'commit-end'); await coordinator.stop();
});
test('failed streaming commit never sends file bytes', async () => {
  const db = new Database(), coordinator = new PersistenceCoordinator(db); db.commitError = Object.assign(new Error('invalid state'), { code: 'DATA_VALIDATION_FAILED' }); let streaming;
  const { res } = request(coordinator, (_req, res) => { streaming = (async () => { try { await coordinator.prepareStream(); res.end('secret file bytes'); } catch {} })(); });
  await tick(); await streaming; assert.equal(res.statusCode, 422); assert.equal(JSON.parse(res.body).error, 'DATA_VALIDATION_FAILED'); assert.equal(db.calls.includes('rollback'), true); await coordinator.stop();
});
test('aborted response rolls back and releases the next queued operation', async () => {
  const db = new Database(), coordinator = new PersistenceCoordinator(db);
  const { res } = request(coordinator, () => { db.state.value = 10; }); await tick(); res.destroy();
  await coordinator.mutateResult(() => { assert.equal(db.state.value, 0); db.state.value = 2; }); assert.equal(db.durable.value, 2); await coordinator.stop();
});
test('stop drains accepted units then rejects additional mutations', async () => {
  const db = new Database(), coordinator = new PersistenceCoordinator(db); await coordinator.mutateResult(async () => 1); await coordinator.stop(); await assert.rejects(coordinator.mutateResult(() => 2), { code: 'STORAGE_BUSY' });
});
