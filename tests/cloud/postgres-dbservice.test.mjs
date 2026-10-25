import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { FakePool, validateState } from './postgres-fixture.mjs';
import { PostgresStore } from '../../server/cloud/postgres.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-pg-service-test-'));
const output = path.join(temp, 'cloud-service.cjs');
const require = createRequire(import.meta.url);
const previousEnvironment = { ORBIT_STORAGE: process.env.ORBIT_STORAGE, DATABASE_URL: process.env.DATABASE_URL, PROJECT_ROOT: process.env.PROJECT_ROOT, VERCEL: process.env.VERCEL, BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN };
process.env.ORBIT_STORAGE = 'postgres';
process.env.DATABASE_URL = 'postgresql://synthetic:synthetic@localhost:5432/synthetic';
process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_synthetic_for_offline_unit_test';
process.env.PROJECT_ROOT = root;
delete process.env.VERCEL;
await build({ stdin: { contents: "export {DbService} from './src/data/dbService.ts'; export {migrateIdentity} from './server/bootstrap/identity.ts'; export {getJwtSecret} from './server/local-config.ts';", resolveDir: root }, outfile: output, bundle: true, platform: 'node', format: 'cjs', target: 'node24', external: ['pg'], logLevel: 'silent' });
const load = () => { delete require.cache[require.resolve(output)]; return require(output); };
test.after(() => {
  for (const [key, value] of Object.entries(previousEnvironment)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  fs.rmSync(temp, { recursive: true, force: true });
});
async function seed(pool, mutate) {
  const store = new PostgresStore({ pool, validateState }); await store.initialize(); await store.begin(); const state = await store.loadState(); mutate(state); await store.saveState(state); await store.commit();
}

test('cloud DbService preserves RAW identity while refreshing state before each request unit', async () => {
  const pool = new FakePool(); const firstModule = load(), first = firstModule.DbService.getInstance();
  assert.equal(first.isCloud, true); const raw = first.getState(); await first.initializeCloud(pool); assert.equal(first.getState(), raw);
  assert.throws(() => first.getStore(), /SQLite maintenance/); assert.throws(() => first.save(), /explicit async transaction/);
  await first.beginTransaction(); raw.users.push({ id: 'account-a', name: 'Synthetic A' }); await first.commitTransaction();
  const second = load().DbService.getInstance(); await second.initializeCloud(pool);
  await second.beginTransaction(); second.getState().users[0].name = 'Changed elsewhere'; await second.commitTransaction();
  assert.equal(raw.users[0].name, 'Synthetic A'); await first.beginTransaction(); assert.equal(first.getState(), raw); assert.equal(raw.users[0].name, 'Changed elsewhere'); await first.rollbackTransaction();
  assert.match(firstModule.getJwtSecret(), /^[0-9a-f]{96}$/); await first.close(); await second.close();
});

test('cloud DbService applies full shared relation validation and rolls back stable RAW on failure', async () => {
  const pool = new FakePool(), db = load().DbService.getInstance(); await db.initializeCloud(pool); const raw = db.getState();
  await db.beginTransaction(); raw.users.push({ id: 'account-a' }); raw.workspaces.push({ id: 'workspace-a', ownerId: 'account-a' }); await db.commitTransaction();
  await db.beginTransaction(); raw.projects.push({ id: 'project-a', workspaceId: 'unknown-workspace' });
  await assert.rejects(db.commitTransaction(), { code: 'DATA_VALIDATION_FAILED' }); await db.rollbackTransaction(); assert.equal(raw.projects.length, 0); assert.equal(raw.users.length, 1);
  await db.beginTransaction(); raw.users.push({ id: 'account-a' }); await assert.rejects(db.commitTransaction(), { code: 'DATA_VALIDATION_FAILED' }); await db.rollbackTransaction(); assert.equal(raw.users.length, 1); await db.close();
});

test('cloud events commit in the same transaction and rollback clears both outbox and business mutation', async () => {
  const pool = new FakePool(), db = load().DbService.getInstance(); await db.initializeCloud(pool);
  assert.throws(() => db.queueCloudEvent({ event: 'outside' }), /active business transaction/);
  await db.beginTransaction(); const event = { instanceId: 'instance-a', workspaceId: 'workspace-a', event: 'changed', payload: { type: 'data_changed' } }; db.queueCloudEvent(event); event.payload.type = 'mutated-after-queue'; db.getState().extension = 'persisted'; await db.commitTransaction();
  assert.equal(pool.state.realtimeEvents.length, 1); assert.equal(pool.state.realtimeEvents[0].payload.type, 'data_changed');
  const before = structuredClone(pool.state); await db.beginTransaction(); db.getState().extension = 'not persisted'; db.queueCloudEvent({ event: 'not persisted' }); pool.fail = /^INSERT INTO orbit_rt_events/;
  await assert.rejects(db.commitTransaction(), /Injected/); await db.rollbackTransaction(); assert.deepEqual(pool.state, before); assert.equal(db.getState().extension, 'persisted');
  await db.beginTransaction(); await db.commitTransaction(); assert.equal(pool.state.realtimeEvents.length, 1); await db.close();
});

test('cloud requests refresh the canonical signing key written by another instance', async () => {
  const pool = new FakePool(), firstModule = load(), db = firstModule.DbService.getInstance(); await db.initializeCloud(pool); const original = firstModule.getJwtSecret();
  const other = new PostgresStore({ pool, validateState }); await other.initialize(); await other.begin(); const replacement = 'f'.repeat(96); await other.setMetadata('jwt_secret', replacement); await other.commit();
  assert.notEqual(original, replacement); await db.beginTransaction(); assert.equal(firstModule.getJwtSecret(), replacement); await db.rollbackTransaction(); await db.close();
});

test('cloud identity migration never promotes a workspace OWNER without an explicit trusted marker', async () => {
  const pool = new FakePool(); await seed(pool, state => { state.users.push({ id: 'workspace-owner', role: 'OWNER', status: 'ACTIVE' }, { id: 'trusted-admin', role: 'USER', systemRole: 'ADMIN', status: 'ACTIVE' }); });
  const module = load(), db = module.DbService.getInstance(); await db.initializeCloud(pool); assert.equal(await module.migrateIdentity(db), true);
  assert.equal(db.getState().users.find(user => user.id === 'workspace-owner').systemRole, 'USER'); assert.equal(db.getState().users.find(user => user.id === 'trusted-admin').systemRole, 'ADMIN');
  assert.equal(await module.migrateIdentity(db), false); await db.close();
});

test('trusted historical cloud upgrade preserves its explicit grant and revokes obsolete sessions once', async () => {
  const pool = new FakePool(); await seed(pool, state => { state.users.push({ id: 'historic-owner', role: 'OWNER', status: 'ACTIVE' }); state.userSessions.push({ id: 'old-session', userId: 'historic-owner', status: 'active' }); });
  const marker = new PostgresStore({ pool, validateState }); await marker.initialize(); await marker.begin(); await marker.setMetadata('trusted_historical_identity_v1', true); await marker.commit();
  const module = load(), db = module.DbService.getInstance(); await db.initializeCloud(pool); await module.migrateIdentity(db);
  assert.equal(db.getState().users[0].systemRole, 'ADMIN'); assert.equal(db.getState().userSessions[0].status, 'revoked'); assert.equal(db.getState().userSessions[0].revokeReason, 'legacy_session_upgrade'); await db.close();
});
