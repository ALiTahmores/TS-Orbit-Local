import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import express from 'express';
import jwt from 'jsonwebtoken';

const root = fileURLToPath(new URL('../../', import.meta.url));
const secret = 'test-signing-key-only-used-in-isolated-tests';
const password = 'Strong local password 42!';

test('local authentication validates identity and revocable session authority', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-auth-test-'));
  const generated = path.join(directory, 'auth.cjs');
  await build({ entryPoints: [path.join(root, 'server/auth/index.ts')], outfile: generated, bundle: true, platform: 'node', target: 'node24', format: 'cjs', logLevel: 'silent' });
  const { createAuth } = createRequire(import.meta.url)(generated);
  const state = Object.fromEntries(['users', 'workspaces', 'auditLogs', 'userSessions', 'loginHistory', 'securityEvents', 'userProfiles', 'userSettings', 'userPreferences'].map(key => [key, []]));
  const revoked = [];
  const auth = createAuth({ state, jwtSecret: secret, appOrigin: 'http://127.0.0.1:3000', onSessionsRevoked: ids => revoked.push(...ids) });
  const app = express(); app.use(express.json()); app.use('/api/auth', auth.router);
  app.get('/api/admin', auth.authenticateToken, auth.requireSystemAdmin, (_req, res) => res.json({ success: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(directory, { recursive: true, force: true }); });
  const call = async (route, body, token, method = body === undefined ? 'GET' : 'POST') => {
    const response = await fetch(base + '/api/' + route, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  let phoneSuffix = 1000;
  const register = (suffix = 'one', extra = {}) => call('auth/register', { email: `${suffix}@example.test`, password, name: 'Local user', phone: '0912345' + (++phoneSuffix), username: 'user_' + suffix, ...extra });
  const login = () => call('auth/login', { identifier: 'one@example.test', password });

  await t.test('registration cannot assign global admin, IDs or memberships', async () => {
    assert.equal((await register('attack', { role: 'OWNER', systemRole: 'ADMIN', id: 'trusted', memberships: [] })).status, 400);
    assert.equal(state.users.length, 0);
    const result = await register();
    assert.equal(result.status, 201);
    assert.equal(result.body.user.role, 'USER'); assert.equal(result.body.user.systemRole, 'USER');
    assert.equal(result.body.user.memberships[0].role, 'OWNER');
    assert.equal(result.body.user.passwordHash, undefined);
    assert.equal((await call('admin', undefined, result.body.token)).status, 403);
    assert.equal((await call('auth/me', undefined, result.body.token)).status, 200);
    const decoded = jwt.decode(result.body.token);
    assert.equal(decoded.iss, 'ts-orbit'); assert.equal(decoded.aud, 'http://127.0.0.1:3000');
    assert.ok(decoded.sid); assert.ok(decoded.jti); assert.equal(decoded.exp - decoded.iat, 28800);
    const session = state.userSessions.find(item => item.id === decoded.sid);
    assert.equal(session.userId, result.body.user.id); assert.notEqual(session.tokenIdHash, decoded.jti);
    assert.equal(state.loginHistory[0].sessionId, decoded.sid);
  });

  await t.test('public account lookup excludes personal identity and internal authority', async () => {
    const result = await call('auth/check-identifier', { identifier: 'one@example.test' });
    assert.deepEqual(result.body, { exists: true });
    const recovery = await call('auth/reset-password', { email: 'one@example.test', password });
    assert.equal(recovery.status, 409); assert.equal(recovery.body.error, 'LOCAL_RECOVERY_REQUIRED');
  });

  await t.test('live revocation, account blocks and deleted identities defeat signed tokens', async () => {
    const result = await login(), token = result.body.token, user = state.users[0];
    user.systemRole = 'ADMIN'; assert.equal((await call('admin', undefined, token)).status, 200);
    user.isActive = false; assert.equal((await call('auth/me', undefined, token)).status, 401);
    user.isActive = true; user.status = 'BLOCKED'; assert.equal((await call('auth/me', undefined, token)).status, 401);
    user.status = 'offline'; assert.equal((await call('auth/me', undefined, token)).status, 200);
    user.deletedAt = new Date().toISOString(); assert.equal((await call('auth/me', undefined, token)).status, 401); delete user.deletedAt;
    const legacy = jwt.sign({ userId: user.id }, secret, { expiresIn: '8h' });
    assert.equal((await call('auth/me', undefined, legacy)).status, 401);
    const claims = jwt.decode(token);
    const forgedClaims = jwt.sign({ sid: claims.sid, jti: 'different', userId: user.id }, secret, { subject: user.id, issuer: 'ts-orbit', audience: 'http://127.0.0.1:3000', expiresIn: '8h' });
    assert.equal((await call('auth/me', undefined, forgedClaims)).status, 401);
    assert.equal((await call('auth/logout', {}, token)).status, 200);
    assert.equal((await call('auth/me', undefined, token)).status, 401);
    assert.ok(revoked.includes(claims.sid));
  });

  await t.test('password update invalidates every session and preserves linked history', async () => {
    const first = await login(), second = await login();
    const changed = await call('auth/change-password', { currentPassword: password, newPassword: 'Replacement password 84!' }, first.body.token);
    assert.equal(changed.status, 200); assert.equal(changed.body.requiresLogin, true);
    assert.equal((await call('auth/me', undefined, first.body.token)).status, 401);
    assert.equal((await call('auth/me', undefined, second.body.token)).status, 401);
    assert.equal((await login()).status, 401);
    const fresh = await call('auth/login', { identifier: 'one@example.test', password: 'Replacement password 84!' });
    assert.equal(fresh.status, 200);
    assert.ok(state.loginHistory.filter(item => item.sessionId === jwt.decode(first.body.token).sid).every(item => item.logoutTime));
  });

  await t.test('profile rejects protected fields and identity changes require current password', async () => {
    const fresh = await call('auth/login', { identifier: 'one@example.test', password: 'Replacement password 84!' }), token = fresh.body.token;
    assert.equal((await call('auth/profile/update', { role: 'OWNER', systemRole: 'ADMIN' }, token, 'PUT')).status, 400);
    assert.equal((await call('auth/profile/update', { email: 'other@example.test' }, token, 'PUT')).status, 400);
    const duplicate = await register('other'); assert.equal(duplicate.status, 201);
    assert.equal((await call('auth/profile/update', { email: 'other@example.test', currentPassword: 'Replacement password 84!' }, token, 'PUT')).status, 409);
    const ownUser = state.users[0], id = ownUser.id, membership = ownUser.personalWorkspaceId;
    const changed = await call('auth/profile/update', { email: 'new@example.test', currentPassword: 'Replacement password 84!', name: 'Updated user' }, token, 'PUT');
    assert.equal(changed.status, 200); assert.equal(changed.body.requiresLogin, true);
    assert.equal(ownUser.id, id); assert.equal(ownUser.personalWorkspaceId, membership);
    assert.equal((await call('auth/me', undefined, token)).status, 401);
    assert.equal(state.workspaces[0].members[0].email, 'new@example.test');
  });

  await t.test('registration and login reject oversized UTF-8 passwords and arbitrary request fields', async () => {
    assert.equal((await register('large', { password: '🙂'.repeat(19) })).status, 400);
    assert.equal((await call('auth/login', { identifier: 'new@example.test', password: '🙂'.repeat(19) })).status, 400);
    assert.equal((await call('auth/login', { identifier: 'new@example.test', password, token: 'injected' })).status, 400);
  });

  await t.test('session management rejects other users and session expiry fails closed', async () => {
    const fresh = await call('auth/login', { identifier: 'new@example.test', password: 'Replacement password 84!' }), token = fresh.body.token;
    const ownSession = state.userSessions.find(item => item.id === jwt.decode(token).sid);
    const otherSession = state.userSessions.find(item => item.userId === state.users[1].id);
    assert.equal((await call('auth/sessions/' + otherSession.id + '/terminate', {}, token)).status, 404);
    assert.equal(otherSession.status, 'active');
    const listing = await call('auth/sessions', undefined, token);
    assert.ok(listing.body.every(item => item.userId === state.users[0].id && item.tokenIdHash === undefined));
    const expires = ownSession.expiresAt;
    ownSession.expiresAt = 'invalid'; assert.equal((await call('auth/me', undefined, token)).status, 401);
    ownSession.expiresAt = new Date(Date.now() - 1000).toISOString(); assert.equal((await call('auth/me', undefined, token)).status, 401);
    ownSession.expiresAt = expires;
    const ended = await call('auth/sessions/' + ownSession.id + '/terminate', {}, token);
    assert.equal(ended.status, 200); assert.equal(ended.body.requiresLogin, true);
    assert.equal((await call('auth/me', undefined, token)).status, 401);
  });

  await t.test('phone identifiers stay unique and imported ambiguous phones fail safely', async () => {
    const user = state.users[0];
    assert.equal((await register('phone_duplicate', { phone: user.phone })).status, 409);
    const duplicate = { ...user, id: 'imported_duplicate', email: 'legacy@example.test', username: 'legacy_duplicate' };
    state.users.push(duplicate);
    assert.equal((await call('auth/login', { identifier: user.phone, password: 'Replacement password 84!' })).status, 401);
    const emailLogin = await call('auth/login', { identifier: user.email, password: 'Replacement password 84!' });
    assert.equal(emailLogin.status, 200); assert.equal(emailLogin.body.user.id, user.id);
    state.users.pop();
    user.accountStatus = 'BLOCKED'; user.status = 'online';
    assert.equal((await call('auth/me', undefined, emailLogin.body.token)).status, 401);
    user.accountStatus = 'ACTIVE';
    const member = state.workspaces[0].members[0];
    member.status = 'PENDING';
    assert.deepEqual((await call('auth/me', undefined, emailLogin.body.token)).body.user.memberships, []);
    delete member.status;
  });

  await t.test('public lookup rate limits excessive requests with retry guidance', async () => {
    let result;
    for (let index = 0; index < 65; index++) result = await call('auth/check-identifier', { identifier: 'new@example.test' });
    assert.equal(result.status, 429); assert.equal(result.body.error, 'RATE_LIMITED');
  });

  await t.test('phone credential changes require password and revoke old sessions', async () => {
    const fresh = await call('auth/login', { identifier: 'new@example.test', password: 'Replacement password 84!' }), token = fresh.body.token;
    const user = state.users[0];
    const reformatted = await call('auth/profile/update', { phone: '+98 ' + user.phone.slice(1) }, token, 'PUT');
    assert.equal(reformatted.status, 200); assert.equal(reformatted.body.requiresLogin, false);
    assert.equal((await call('auth/me', undefined, token)).status, 200);
    assert.equal((await call('auth/profile/update', { phone: '09123459999' }, token, 'PUT')).status, 400);
    const changed = await call('auth/profile/update', { phone: '09123459999', currentPassword: 'Replacement password 84!' }, token, 'PUT');
    assert.equal(changed.status, 200); assert.equal(changed.body.requiresLogin, true);
    assert.equal((await call('auth/me', undefined, token)).status, 401);
    assert.equal((await call('auth/login', { identifier: '09123459999', password: 'Replacement password 84!' })).status, 200);
  });
});
