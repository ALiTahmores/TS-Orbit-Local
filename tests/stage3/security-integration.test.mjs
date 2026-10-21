import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { io } from 'socket.io-client';
import { SqliteStore, collectionNames } from '../../server/db/store.ts';
import { DatabaseSync } from 'node:sqlite';
import { createHmac } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '../..');
const password = 'SecurityFixturePassword42!';
const env = data => ({ ...process.env, PROJECT_ROOT: root, NODE_ENV: 'production', DATA_DIR: data,
  HOST: '127.0.0.1', PORT: '3000', APP_ORIGIN: '', ALLOW_NETWORK_ACCESS: '', LEGACY_DB_IMPORT: '' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function start(data, reusePort) {
  const listener = net.createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = reusePort || listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(root, 'dist/server/server.cjs')], {
    cwd: root, env: { ...env(data), PORT: String(port), APP_ORIGIN: origin }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', value => output += value); child.stderr.on('data', value => output += value);
  for (let retry = 0; retry < 200; retry++) {
    if (child.exitCode !== null) throw new Error(output);
    try { if ((await fetch(origin + '/api/projects', { signal: AbortSignal.timeout(1000) })).status === 401) return { child, origin, port }; } catch {}
    await pause(50);
  }
  child.kill(); throw new Error('Server readiness timeout: ' + output);
}
async function stop(runtime) {
  if (!runtime || runtime.child.exitCode !== null || runtime.child.signalCode !== null) return;
  const closed = once(runtime.child, 'close'); runtime.child.kill(); await closed;
}
function read(data) {
  const database = new DatabaseSync(path.join(data, 'orbit.sqlite'), { readOnly: true });
  try { return Object.fromEntries(collectionNames.map(name => [name, database.prepare(`SELECT payload FROM "${name}" ORDER BY ordinal`).all().map(row => JSON.parse(row.payload))])); }
  finally { database.close(); }
}
function edit(data, apply) { const store = new SqliteStore(path.join(data, 'orbit.sqlite')); try { const state = store.loadState(); apply(state); store.saveState(state); } finally { store.close(); } }
async function call(runtime, endpoint, { token, workspace, body, headers = {}, method = body === undefined ? 'GET' : 'POST' } = {}) {
  const response = await fetch(runtime.origin + endpoint, { signal: AbortSignal.timeout(5000), method, headers: {
    ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: 'Bearer ' + token } : {}),
    ...(workspace ? { 'x-workspace-id': workspace } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text(); let result; try { result = JSON.parse(text); } catch { result = text; }
  return { status: response.status, body: result };
}
async function login(runtime, email, selected = password) {
  const result = await call(runtime, '/api/auth/login', { body: { identifier: email, password: selected } });
  assert.equal(result.status, 200, JSON.stringify(result)); return result.body;
}
async function connect(runtime, token, workspace) {
  const socket = io(runtime.origin, { transports: ['websocket'], reconnection: false, timeout: 3000, auth: { token, workspaceId: workspace } });
  await Promise.race([once(socket, 'connect'), once(socket, 'connect_error').then(([error]) => { socket.disconnect(); throw error; })]);
  return socket;
}
function noSecrets(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    assert.ok(!/password|secret|tokenIdHash|api.?key|credentials/i.test(key) || item === '[REDACTED]', 'Sensitive response field: ' + key);
    noSecrets(item);
  }
}

test('compiled server enforces durable sessions, workspace isolation, public portal and realtime identity', { timeout: 120000 }, async t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-security-integration-'));
  const data = path.join(temporary, 'data'); let runtime; const sockets = [];
  t.after(async () => { sockets.forEach(socket => socket.disconnect()); await stop(runtime); fs.rmSync(temporary, { recursive: true, force: true }); });
  const account = spawnSync(process.execPath, [path.join(root, 'dist/server/local-account.cjs'), 'bootstrap', '--email', 'admin@example.test', '--name', 'Admin', '--phone', '09100000001', '--password-stdin'], {
    cwd: root, env: env(data), input: password + '\n' + password + '\n', encoding: 'utf8', windowsHide: true, timeout: 15000 });
  assert.equal(account.status, 0, account.stderr);
  runtime = await start(data);
  const registered = await call(runtime, '/api/auth/register', { body: { email: 'b@example.test', password, name: 'Owner B', phone: '09100000002', username: 'owner_b' } });
  assert.equal(registered.status, 201, JSON.stringify(registered));
  await stop(runtime); const port = runtime.port; runtime = undefined;
  let a, b, w1, w2;
  const portalToken = 'integration-portal-token-01234567890123456789';
  edit(data, state => {
    a = state.users.find(user => user.email === 'admin@example.test'); b = state.users.find(user => user.email === 'b@example.test');
    w1 = a.personalWorkspaceId; w2 = b.personalWorkspaceId;
    const c = { id: 'viewer-c', email: 'c@example.test', name: 'Viewer', username: 'viewer_c', phone: '09100000003', passwordHash: bcrypt.hashSync(password, 10), role: 'USER', systemRole: 'USER', isActive: true, status: 'ACTIVE', accountStatus: 'ACTIVE', personalWorkspaceId: w1, memberships: [{ workspaceId: w1, role: 'VIEWER' }] };
    const d = { ...c, id: 'inactive-d', email: 'd@example.test', username: 'inactive_d', phone: '09100000004', isActive: false };
    const e = { ...c, id: 'leader-e', email: 'e@example.test', username: 'leader_e', phone: '09100000005' };
    state.users.push(c, d, e);
    state.workspaces.find(row => row.id === w1).members.push({ userId: c.id, role: 'VIEWER', isActive: true });
    state.workspaces.find(row => row.id === w1).members.push({ userId: e.id, role: 'DEVELOPER', permissions: ['read','write'], isActive: true });
    state.workspaces.push({ id: 'inactive-workspace', name: 'Inactive', ownerId: a.id, isActive: false, members: [] }, { id: 'inactive-owner-grant', name: 'Revoked owner', ownerId: a.id, members: [{ userId: a.id, role: 'OWNER', isActive: false }] });
    state.projects.push({ id: 'project-w1', title: 'Visible W1', workspaceId: w1, clientPortalEnabled: true, clientPortalToken: portalToken, isBudgetConfidential: true, budget: 'SENSITIVE_BUDGET' },
      { id: 'project-w2', title: 'Private W2', workspaceId: w2 }, { id: 'unscoped-project', title: 'UNSCOPED_SECRET' });
    state.tasks.push({ id: 'public-task-w1', title: 'Public task', projectId: 'project-w1', workspaceId: w1, clientVisible: true },
      { id: 'private-task-w1', title: 'PRIVATE_CLIENT_TASK', projectId: 'project-w1', workspaceId: w1 },
      { id: 'task-w2', title: 'Private W2 task', projectId: 'project-w2', workspaceId: w2 },
      { id: 'conflicting-task', title: 'CONFLICTING_SECRET', projectId: 'project-w1', workspaceId: w2, clientVisible: true });
    state.teams.push({ id: 'leader-team', name: 'Leader team', workspaceId: w1 }, { id: 'other-team', name: 'Other team', workspaceId: w1 });
    state.teamMembers.push({ id: 'leader-membership', teamId: 'leader-team', userId: e.id, isLeader: true });
    state.conversationPermissions.push({ id: 'leader-permission', teamId: 'leader-team', userId: c.id, workspaceId: w1 }, { id: 'other-permission', teamId: 'other-team', userId: c.id, workspaceId: w1 });
    for (const id of ['conversation-1','conversation-2']) {
      state.conversations.push({ id, title: id, workspaceId: w1, type: 'group' });
      for (const userId of [a.id,c.id,e.id]) state.conversationMembers.push({ id: id + userId, conversationId: id, userId });
      state.messages.push({ id: 'message-' + id, conversationId: id, senderId: a.id, content: 'Fixture' });
    }
    state.notifications.push({ id: 'viewer-notification', workspaceId: w1, userId: c.id, read: false });
    state.wpSites.push({ id: 'connector-site', projectId: 'project-w1', workspaceId: w1, siteUrl: 'https://fixture.invalid', apiKey: 'connector-private-key-01234567890123456789' });
    state.apiLogs.push({ id: 'sensitive-log', endpoint: '/API/PUBLIC/PORTAL/' + portalToken, payload: { password: 'SECRET_STRING', nested: { apiKey: 'KEY_STRING' } } });
  });
  runtime = await start(data, port);
  const aa = await login(runtime, a.email), bb = await login(runtime, b.email), cc = await login(runtime, 'c@example.test'), ee = await login(runtime, 'e@example.test');
  await t.test('all inventoried private routes reject unauthenticated access', async () => {
    const source = fs.readFileSync(path.join(root, 'server/policy/contracts.ts'), 'utf8');
    const definitions = JSON.parse(source.slice(source.indexOf('['), source.lastIndexOf(']') + 1));
    for (const entry of definitions) {
      const endpoint = entry.path.replace(/:[^/]+/g, 'fixture-not-present');
      const result = await call(runtime, endpoint, { method: entry.method, ...(entry.method === 'GET' ? {} : { body: {} }) });
      assert.equal(result.status, 401, entry.method + ' ' + endpoint + ' ' + JSON.stringify(result));
    }
  });
  await t.test('global admin does not bypass workspace membership and viewer cannot write', async () => {
    assert.equal((await call(runtime, '/api/projects', { token: aa.token, workspace: w2 })).status, 403);
    assert.equal((await call(runtime, '/api/projects?workspaceId=' + w1, { token: bb.token })).status, 403);
    assert.equal((await call(runtime, '/api/projects/project-w1', { token: bb.token, workspace: w2 })).status, 404);
    assert.equal((await call(runtime, '/api/tasks', { token: bb.token, workspace: w2, body: { title: 'attack', projectId: 'project-w1' } })).status, 404);
    assert.equal((await call(runtime, '/api/projects', { token: cc.token, workspace: w1 })).status, 200);
    assert.equal((await call(runtime, '/api/projects', { token: cc.token, workspace: w1, body: { title: 'viewer write' } })).status, 403);
    assert.equal((await call(runtime, '/api/tasks/public-task-w1/status', { token: cc.token, workspace: w1, method: 'PUT', body: { status: 'DONE' } })).status, 403);
    for (const endpoint of ['/api/projects','/api/tasks','/api/stats','/api/org/data','/api/search?q=SECRET']) {
      const result = await call(runtime, endpoint, { token: aa.token, workspace: w1 });
      assert.equal(result.status, 200, endpoint + ' ' + JSON.stringify(result));
      assert.ok(!JSON.stringify(result.body).includes('Private W2')); assert.ok(!JSON.stringify(result.body).includes('UNSCOPED_SECRET'));
      assert.ok(!JSON.stringify(result.body).includes('CONFLICTING_SECRET')); noSecrets(result.body);
    }
  });
  await t.test('case variations cannot bypass private authentication or public capability paths', async () => {
    const before = read(data).users.length;
    for (const endpoint of ['/API/projects','/Api/tasks','/api/Projects','/API/owner/sessions']) {
      const result = await call(runtime, endpoint); assert.equal(result.status, 401, endpoint + ' ' + JSON.stringify(result));
      assert.ok(!JSON.stringify(result.body).includes('Visible W1'));
    }
    for (const endpoint of ['/API/auth/register','/api/AUTH/register']) {
      const result = await call(runtime, endpoint, { body: { name: 'Bypass', email: 'bypass@example.test', phone: '09200000111', password } });
      assert.equal(result.status, 401, JSON.stringify(result));
    }
    assert.equal(read(data).users.length, before);
    const publicCase = await call(runtime, '/API/PUBLIC/PORTAL/' + portalToken);
    assert.equal(publicCase.status, 401); assert.ok(!JSON.stringify(publicCase.body).includes('Visible W1'));
    const logs = await call(runtime, '/api/logs', { token: aa.token }); assert.equal(logs.status, 200);
    assert.ok(!JSON.stringify(logs.body).includes(portalToken), 'Historical and current mixed-case capability paths must redact their token.');
  });
  await t.test('legacy teamLead aliases cannot inject foreign workspace membership and directories show actual selected-workspace roles', async () => {
    const membersBefore = structuredClone(read(data).workspaces.find(row => row.id === w1).members);
    assert.equal((await call(runtime, '/api/projects', { token: aa.token, workspace: w1, body: { title: 'Foreign lead', teamLead: b.id } })).status, 404);
    assert.equal((await call(runtime, '/api/projects/project-w1', { token: aa.token, workspace: w1, method: 'PUT', body: { teamLead: b.id } })).status, 404);
    const displayOnly = await call(runtime, '/api/projects', { token: aa.token, workspace: w1, body: { title: 'Display-only lead', teamLead: b.name } });
    assert.equal(displayOnly.status, 201, JSON.stringify(displayOnly)); assert.equal(displayOnly.body.teamLeadId, '');
    assert.deepEqual(read(data).workspaces.find(row => row.id === w1).members, membersBefore);
    for (const endpoint of ['/api/users','/api/chat/users']) {
      const directory = await call(runtime, endpoint, { token: aa.token, workspace: w1 }); assert.equal(directory.status, 200, JSON.stringify(directory));
      const developer = directory.body.find(user => user.id === 'leader-e'); assert.ok(developer, endpoint);
      assert.equal(developer.role, 'DEVELOPER', endpoint); assert.equal(developer.displayRole, 'USER', endpoint);
    }
  });
  await t.test('inactive workspace and owner grants, personal read-state and leader permissions remain distinct', async () => {
    for (const workspace of ['inactive-workspace','inactive-owner-grant']) assert.equal((await call(runtime, '/api/projects', { token: aa.token, workspace })).status, 403);
    assert.equal((await call(runtime, '/api/notifications/viewer-notification/read', { token: cc.token, workspace: w1, method: 'PUT', body: {} })).status, 200);
    assert.equal((await call(runtime, '/api/chat/conversations/conversation-1/read', { token: cc.token, workspace: w1, body: {} })).status, 200);
    assert.equal((await call(runtime, '/api/chat/conversations/conversation-1/pin', { token: aa.token, workspace: w1, body: { messageId: 'message-conversation-2', pin: true } })).status, 422);
    assert.equal((await call(runtime, '/api/chat/conversations/conversation-1/pin', { token: aa.token, workspace: w1, body: { messageId: 'message-conversation-1', pin: true } })).status, 200);
    assert.equal((await call(runtime, '/api/chat/permissions/team/leader-team/user/viewer-c', { token: ee.token, workspace: w1, method: 'DELETE', body: {} })).status, 200);
    assert.equal((await call(runtime, '/api/chat/permissions/team/other-team/user/viewer-c', { token: ee.token, workspace: w1, method: 'DELETE', body: {} })).status, 403);
    assert.ok(read(data).conversationPermissions.find(row => row.id === 'leader-permission').revokedAt,'Revoked grants retain history and no longer authorize access.'); assert.ok(!read(data).conversationPermissions.find(row => row.id === 'other-permission').revokedAt);
  });
  await t.test('connector key and exact-body HMAC grant only one registered site', async () => {
    const key = 'connector-private-key-01234567890123456789';
    const body = { projectId: 'project-w1', siteUrl: 'https://fixture.invalid', event: 'fixture_event', payload: { label: 'verified' } };
    const headers = { 'x-wp-sync-api-key': key, 'x-wp-sync-signature': createHmac('sha256', key).update(JSON.stringify(body)).digest('hex') };
    assert.equal((await call(runtime, '/api/sites/webhook', { body, headers: { ...headers, 'x-wp-sync-api-key': key + 'wrong' } })).status, 401);
    assert.equal((await call(runtime, '/api/sites/webhook', { body: { ...body, event: 'tampered' }, headers })).status, 401);
    assert.equal((await call(runtime, '/api/sites/webhook', { body: { ...body, projectId: 'project-w2' }, headers })).status, 401);
    const response = await call(runtime, '/api/sites/webhook', { body, headers }); assert.equal(response.status, 200, JSON.stringify(response)); noSecrets(response.body);
    const saved = read(data).wpWebhooks.find(row => row.event === 'fixture_event'); assert.equal(saved.workspaceId, w1); assert.equal(saved.projectId, 'project-w1');
    assert.equal((await call(runtime, '/api/auth/me', { token: key })).status, 401);
  });
  await t.test('server identity binding and strict mutation schemas reject mass assignment', async () => {
    for (const extra of [{ id: 'spoof' }, { creatorId: b.id }, { systemRole: 'ADMIN' }, { clientPortalToken: 'spoof' }]) {
      assert.equal((await call(runtime, '/api/projects', { token: aa.token, workspace: w1, body: { title: 'Attack', ...extra } })).status, 422);
    }
    assert.equal((await call(runtime, '/api/projects', { token: aa.token, workspace: w1, body: { title: 'conflict', workspaceId: w2 } })).status, 422);
    assert.equal((await call(runtime, '/api/tasks', { token: aa.token, workspace: w1, body: { title: {}, projectId: 'project-w1' } })).status, 422);
    const created = await call(runtime, '/api/projects', { token: aa.token, workspace: w1, body: { title: 'Bound project' } });
    assert.equal(created.status, 201, JSON.stringify(created));
    const saved = read(data).projects.find(row => row.id === created.body.id);
    assert.equal(saved.workspaceId, w1); assert.equal(saved.createdById, a.id);
    const task = await call(runtime, '/api/tasks', { token: aa.token, workspace: w1, body: { title: 'Bound task', projectId: created.body.id } });
    assert.equal(task.status, 201, JSON.stringify(task)); assert.equal(read(data).tasks.find(row => row.id === task.body.id).workspaceId, w1);
    for (const endpoint of ['/api/owner/sessions', '/api/users', '/api/logs', '/api/auth/sessions']) {
      const result = await call(runtime, endpoint, { token: aa.token }); assert.equal(result.status, 200, JSON.stringify(result)); noSecrets(result.body);
      assert.ok(!JSON.stringify(result.body).includes('SECRET_STRING')); assert.ok(!JSON.stringify(result.body).includes('KEY_STRING'));
    }
  });
  await t.test('inactive accounts, forged session identifiers and legacy bearer claims are rejected', async () => {
    assert.equal((await call(runtime, '/api/auth/login', { body: { identifier: 'd@example.test', password } })).status, 401);
    const secret = fs.readFileSync(path.join(data, 'jwt-secret'), 'utf8');
    const claims = jwt.decode(aa.token); delete claims.iat;
    const forged = jwt.sign({ ...claims, sid: 'missing-session' }, secret, { algorithm: 'HS256' });
    const legacy = jwt.sign({ id: a.id, role: 'OWNER' }, secret, { algorithm: 'HS256', expiresIn: 3600 });
    for (const token of [forged, legacy]) assert.equal((await call(runtime, '/api/auth/me', { token })).status, 401);
  });
  await t.test('portal exact token exposes only consistent public children and saves scoped feedback', async () => {
    assert.equal((await call(runtime, '/api/public/portal/' + portalToken + 'x')).status, 404);
    const portal = await call(runtime, '/api/public/portal/' + portalToken);
    assert.equal(portal.status, 200, JSON.stringify(portal));
    assert.deepEqual(portal.body.tasks.map(row => row.id), ['public-task-w1']); noSecrets(portal.body);
    assert.equal(portal.body.project.budget, undefined); assert.equal(portal.body.project.workspaceId, undefined);
    const feedback = await call(runtime, '/api/public/portal/' + portalToken + '/feedback', { body: { senderName: 'Client', content: 'Actual feedback' } });
    assert.equal(feedback.status, 201, JSON.stringify(feedback));
    const persisted = read(data).feedback.find(row => row.id === feedback.body.id); assert.equal(persisted.workspaceId, w1); assert.equal(persisted.projectId, 'project-w1');
    assert.equal((await call(runtime, '/api/public/portal/' + portalToken + '/feedback', { body: { senderName: 'Client', content: 'attack', workspaceId: w2 } })).status, 422);
    assert.equal((await call(runtime, '/api/projects/project-w1/portal', { token: aa.token, workspace: w1, method: 'PUT', body: { enabled: false } })).status, 200);
    assert.equal((await call(runtime, '/api/public/portal/' + portalToken)).status, 404);
  });
  await t.test('socket rooms bind verified identity and logout revokes HTTP and established socket', async () => {
    const fresh = await login(runtime, a.email);
    const socket = await connect(runtime, fresh.token, w1); sockets.push(socket);
    const peer = await connect(runtime, bb.token, w2); sockets.push(peer);
    const spoof = await new Promise(resolve => socket.emit('join', { userId: b.id, workspaceId: w2 }, resolve));
    assert.equal(spoof.error, 'FORBIDDEN');
    const otherEvents = []; peer.on('org_data_updated', value => otherEvents.push(value));
    const ownEvent = once(socket, 'org_data_updated');
    const created = await call(runtime, '/api/org/departments', { token: fresh.token, workspace: w1, body: { name: 'Isolated event', leaderId: a.id } });
    assert.equal(created.status, 201, JSON.stringify(created)); await pause(150); assert.deepEqual(otherEvents, []);
    const [event] = await Promise.race([ownEvent, pause(3000).then(() => { throw new Error('Same workspace event missing'); })]);
    assert.equal(event.type, 'department_created');
    const disconnected = once(socket, 'disconnect');
    assert.equal((await call(runtime, '/api/auth/logout', { token: fresh.token, body: {} })).status, 200);
    await Promise.race([disconnected, pause(3000).then(() => { throw new Error('Revoked socket did not disconnect'); })]);
    assert.equal((await call(runtime, '/api/auth/me', { token: fresh.token })).status, 401);
    await assert.rejects(connect(runtime, fresh.token, w1));
    await assert.rejects(connect(runtime, aa.token, w2));
  });
  await t.test('password, identity change, admin block and terminate revoke live session authority', async () => {
    const watchRevocation = async token => {
      const socket = await connect(runtime, token, w2); sockets.push(socket);
      const disconnected = once(socket, 'disconnect');
      return () => Promise.race([disconnected, pause(3000).then(() => { throw new Error('Account change left established socket connected'); })]);
    };
    let user = await login(runtime, b.email);
    let revoked = await watchRevocation(user.token);
    const changed = 'ChangedIntegrationPassword42!';
    assert.equal((await call(runtime, '/api/auth/change-password', { token: user.token, body: { currentPassword: password, newPassword: changed } })).status, 200);
    await revoked();
    assert.equal((await call(runtime, '/api/auth/me', { token: user.token })).status, 401);
    user = await login(runtime, b.email, changed);
    revoked = await watchRevocation(user.token);
    assert.equal((await call(runtime, '/api/auth/profile/update', { token: user.token, method: 'PUT', body: { phone: '09100000099', currentPassword: changed } })).status, 200);
    await revoked();
    assert.equal((await call(runtime, '/api/auth/me', { token: user.token })).status, 401);
    user = await login(runtime, b.email, changed);
    revoked = await watchRevocation(user.token);
    const sid = jwt.decode(user.token).sid;
    assert.equal((await call(runtime, '/api/owner/sessions/' + sid + '/terminate', { token: aa.token, body: {} })).status, 200);
    await revoked();
    assert.equal((await call(runtime, '/api/auth/me', { token: user.token })).status, 401);
    user = await login(runtime, b.email, changed);
    revoked = await watchRevocation(user.token);
    assert.equal((await call(runtime, '/api/users/' + b.id + '/status', { token: aa.token, method: 'PUT', body: { status: 'BLOCKED' } })).status, 200);
    await revoked();
    assert.equal((await call(runtime, '/api/auth/me', { token: user.token })).status, 401);
    assert.equal((await call(runtime, '/api/auth/login', { body: { identifier: b.email, password: changed } })).status, 401);
  });
});

test('historical identity upgrade preserves IDs and display roles, revokes old sessions once and keeps inactive accounts inactive', { timeout: 30000 }, async t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-identity-integration-'));
  const data = path.join(temporary, 'data'); fs.mkdirSync(data); let runtime;
  t.after(async () => { await stop(runtime); fs.rmSync(temporary, { recursive: true, force: true }); });
  edit(data, state => {
    state.users.push({ id: 'historical-owner', email: 'legacy-owner@example.test', username: 'legacy_owner', name: 'Legacy Owner', phone: '09200000001', role: 'OWNER', status: 'ACTIVE', passwordHash: bcrypt.hashSync(password, 10), personalWorkspaceId: 'historical-workspace', memberships: [{ workspaceId: 'historical-workspace', role: 'OWNER' }] },
      { id: 'historical-admin-display', email: 'legacy-admin@example.test', username: 'legacy_admin', name: 'Display Admin', phone: '09200000002', role: 'ADMIN', status: 'ACTIVE', passwordHash: bcrypt.hashSync(password, 10), memberships: [] },
      { id: 'historical-inactive', email: 'legacy-inactive@example.test', username: 'legacy_inactive', name: 'Inactive', phone: '09200000003', role: 'USER', status: 'offline', isActive: false, passwordHash: bcrypt.hashSync(password, 10), memberships: [] });
    state.workspaces.push({ id: 'historical-workspace', ownerId: 'historical-owner', name: 'Historical', members: [{ userId: 'historical-owner', role: 'OWNER' }] });
    state.userSessions.push({ id: 'historical-session', userId: 'historical-owner', status: 'active', createdAt: '2020-01-01T00:00:00Z' });
  });
  runtime = await start(data);
  const saved = read(data);
  assert.deepEqual(saved.users.map(user => user.id), ['historical-owner','historical-admin-display','historical-inactive']);
  assert.deepEqual(saved.users.map(user => user.role), ['OWNER','ADMIN','USER']);
  assert.deepEqual(saved.users.map(user => user.systemRole), ['ADMIN','USER','USER']);
  assert.equal(saved.users[2].accountStatus, 'INACTIVE'); assert.equal(saved.workspaces[0].id, 'historical-workspace');
  assert.equal(saved.userSessions[0].status, 'revoked'); assert.equal(saved.userSessions[0].revokeReason, 'legacy_session_upgrade');
  const identity = await login(runtime, 'legacy-owner@example.test');
  assert.equal(identity.user.id, 'historical-owner'); assert.equal(identity.user.memberships[0].workspaceId, 'historical-workspace');
  assert.equal((await call(runtime, '/api/auth/login', { body: { identifier: 'legacy-inactive@example.test', password } })).status, 401);
  const port = runtime.port; await stop(runtime); runtime = undefined;
  runtime = await start(data, port);
  assert.equal((await call(runtime, '/api/auth/me', { token: identity.token })).status, 200, 'Upgrade must not revoke newly issued sessions on the next boot.');
  const database = new DatabaseSync(path.join(data, 'orbit.sqlite'), { readOnly: true });
  try { assert.ok(database.prepare("SELECT value FROM metadata WHERE key='identity_stage3_v1'").get()); }
  finally { database.close(); }
});
