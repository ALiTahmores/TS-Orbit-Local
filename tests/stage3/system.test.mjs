import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import express from 'express';
const root = fileURLToPath(new URL('../../', import.meta.url));

test('system account administration preserves references and separates workspace authority', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-system-test-'));
  await build({ entryPoints: { system: path.join(root, 'server/system/router.ts'), identity: path.join(root, 'server/bootstrap/identity.ts') }, outdir: directory, outExtension: { '.js': '.cjs' }, bundle: true, platform: 'node', target: 'node24', format: 'cjs', logLevel: 'silent' });
  const require = createRequire(import.meta.url), { createSystemRouter } = require(path.join(directory, 'system.cjs')), { migrateIdentity } = require(path.join(directory, 'identity.cjs'));
  const state = Object.fromEntries(['users', 'workspaces', 'auditLogs', 'approvalRequests', 'approvalHistory', 'userSessions', 'loginHistory', 'userProfiles', 'userSettings', 'notificationQueue', 'emailQueue'].map(key => [key, []]));
  const admin = { id: 'admin', name: 'Administrator', email: 'admin@example.test', role: 'OWNER', systemRole: 'ADMIN', isActive: true };
  const user = { id: 'user', name: 'Member', email: 'user@example.test', role: 'USER', systemRole: 'USER', isActive: true, memberships: [{ workspaceId: 'foreign', role: 'MEMBER' }] };
  state.users.push(admin, user); state.workspaces.push({ id: 'foreign', ownerId: user.id, members: [{ userId: user.id, role: 'OWNER' }] });
  state.userSessions.push({ id: 'session', userId: user.id, status: 'active', expiresAt: new Date(Date.now() + 60000).toISOString(), tokenIdHash: 'private-jti-hash', token: 'private-legacy-token' });
  state.approvalRequests.push({ id: 'approval', userId: user.id, status: 'PENDING', requestedRole: 'OWNER', details: { password: 'private', workspace: 'private-business', fullName: 'Member' } });
  state.auditLogs.push({ id: 'legacy-audit', userId: user.id, action: 'TASK_UPDATED', details: 'private foreign business', payload: { secret: 'private' } });
  const revoked = [];
  const auth = {
    authenticateToken: (req, res, next) => { req.user = state.users.find(user => req.headers.authorization === 'Bearer ' + user.id); req.authSession = { id: 'admin_session' }; if (!req.user || req.user.isActive === false) return res.status(401).json({ error: 'UNAUTHORIZED' }); next(); },
    requireSystemAdmin: (req, res, next) => req.user.systemRole === 'ADMIN' ? next() : res.status(403).json({ error: 'FORBIDDEN' }),
    revokeUserSessions: id => { revoked.push(id); for (const session of state.userSessions.filter(session => session.userId === id)) session.status = 'revoked'; },
    revokeSession: session => { session.status = 'revoked'; revoked.push(session.userId); }
  };
  const app = express(); app.use(express.json()); app.use('/api', createSystemRouter({ state, auth }));
  app.get('/api/users', (_req, res) => res.json({ businessFallthrough: true }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(directory, { recursive: true, force: true }); });
  const call = async (actor, route, body, method = body === undefined ? 'GET' : 'POST') => {
    const response = await fetch(base + route, { method, headers: { authorization: 'Bearer ' + actor.id, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };

  await t.test('system guards deny ordinary workspace owners and preserve business fallthrough', async () => {
    assert.equal((await call(user, '/owner/approvals')).status, 403);
    assert.equal((await call(user, '/users', { name: 'Intruder' })).status, 403);
    assert.deepEqual((await call(user, '/users')).body, { businessFallthrough: true });
    const sessions = await call(admin, '/owner/sessions');
    assert.equal(sessions.body[0].tokenIdHash, undefined); assert.equal(sessions.body[0].token, undefined);
    const logs = await call(admin, '/owner/audit-logs');
    assert.equal(logs.body[0].details, undefined); assert.equal(logs.body[0].payload, undefined);
    const approvals = await call(admin, '/owner/approvals');
    assert.equal(approvals.body[0].details.password, undefined); assert.equal(approvals.body[0].details.workspace, undefined);
    assert.equal(approvals.body[0].details.fullName, 'Member');
  });
  await t.test('approval activates accounts without global promotions, memberships or fake email', async () => {
    const beforeMembership = structuredClone(user.memberships);
    assert.equal((await call(admin, '/owner/approvals/approval/approve', { role: 'OWNER' })).status, 400);
    const approved = await call(admin, '/owner/approvals/approval/approve', { role: 'DEVELOPER' });
    assert.equal(approved.status, 200); assert.equal(user.systemRole, 'USER'); assert.equal(user.role, 'DEVELOPER');
    assert.deepEqual(user.memberships, beforeMembership); assert.equal(state.approvalRequests[0].status, 'APPROVED');
    assert.equal(state.emailQueue.length, 0); assert.equal(state.notificationQueue.length, 0); assert.ok(revoked.includes(user.id));
  });
  await t.test('administrative creation rejects protected roles and creates only a personal workspace', async () => {
    const body = { email: 'created@example.test', phone: '09123459999', name: 'Created', password: 'Strong local password 42!' };
    assert.equal((await call(admin, '/users', { ...body, role: 'ADMIN' })).status, 400);
    assert.equal((await call(admin, '/users', { ...body, systemRole: 'ADMIN' })).status, 400);
    const created = await call(admin, '/users', { ...body, role: 'DEVELOPER' });
    assert.equal(created.status, 201); assert.equal(created.body.user.systemRole, 'USER'); assert.equal(created.body.user.passwordHash, undefined);
    const record = state.users.find(record => record.id === created.body.user.id);
    assert.equal(record.memberships.length, 1); assert.equal(record.memberships[0].role, 'OWNER');
    assert.ok(!state.workspaces[0].members.some(member => member.userId === record.id));
  });
  await t.test('self lockout is denied and account deletion preserves referenced identities', async () => {
    assert.equal((await call(admin, '/users/admin/status', { status: 'BLOCKED' }, 'PUT')).status, 409);
    assert.equal((await call(admin, '/users/admin', undefined, 'DELETE')).status, 409);
    const removed = await call(admin, '/users/user', undefined, 'DELETE');
    assert.equal(removed.status, 200); assert.equal(removed.body.deactivated, true);
    assert.ok(state.users.some(record => record.id === user.id)); assert.equal(state.workspaces[0].members[0].userId, user.id);
    assert.equal(user.isActive, false); assert.ok(user.deletedAt);
    const enabled = await call(admin, '/users/user/status', { status: 'ACTIVE' }, 'PUT');
    assert.equal(enabled.status, 200); assert.equal(user.deletedAt, undefined); assert.equal(user.isActive, true);
  });
  await t.test('one-time SQLite metadata migration never promotes workspace owners or later role changes', async () => {
    const database = new DatabaseSync(':memory:'); database.exec('CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
    const legacyState = { users: [{ id: 'trusted', role: 'OWNER', status: 'offline' }, { id: 'workspace_owner', role: 'USER', status: 'online', memberships: [{ workspaceId: 'ws', role: 'OWNER' }] }, { id: 'blocked', role: 'USER', status: 'BLOCKED' }], userSessions: [{ id: 'legacy', userId: 'trusted', status: 'active' }], loginHistory: [{ id: 'history', userId: 'trusted', sessionId: 'legacy' }] };
    const db = { getStore: () => ({ database }), getState: () => legacyState, beginTransaction: () => database.exec('BEGIN'), commitTransaction: () => database.exec('COMMIT'), rollbackTransaction: () => database.exec('ROLLBACK') };
    assert.equal(migrateIdentity(db), true);
    assert.equal(legacyState.users[0].systemRole, 'ADMIN'); assert.equal(legacyState.users[0].accountStatus, 'ACTIVE');
    assert.equal(legacyState.users[1].systemRole, 'USER'); assert.equal(legacyState.users[2].accountStatus, 'BLOCKED');
    assert.equal(legacyState.userSessions[0].status, 'revoked'); assert.ok(legacyState.loginHistory[0].logoutTime);
    legacyState.users[1].role = 'OWNER'; assert.equal(migrateIdentity(db), false); assert.equal(legacyState.users[1].systemRole, 'USER');
    assert.ok(database.prepare("SELECT value FROM metadata WHERE key='identity_stage3_v1'").get()); database.close();
  });
});
