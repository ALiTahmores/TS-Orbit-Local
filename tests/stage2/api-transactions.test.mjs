import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { SqliteStore, collectionNames } from '../../server/db/store.ts';
import { io as connectSocket } from 'socket.io-client';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const serverEntry = path.join(root, 'dist/server/server.cjs');
const accountEntry = path.join(root, 'dist/server/local-account.cjs');
const password = 'ApiTransactionalFixture42!';
const email = 'owner@example.invalid';
const environment = data => ({ ...process.env, PROJECT_ROOT: root, DATA_DIR: data, NODE_ENV: 'production',
  HOST: '127.0.0.1', PORT: '3000', APP_ORIGIN: '', ALLOW_NETWORK_ACCESS: '', LEGACY_DB_IMPORT: '' });
function fixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-orbit-api-stage2-'));
  const data = path.join(temporary, 'data');
  t.after(() => {
    assert.equal(path.dirname(temporary), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(temporary).startsWith('ts-orbit-api-stage2-'));
    fs.rmSync(temporary, { recursive: true, force: true });
  });
  return { temporary, data };
}
function bootstrap(data) {
  const result = spawnSync(process.execPath, [accountEntry, 'bootstrap', '--email', email, '--name', 'API Owner',
    '--phone', '09000000000', '--password-stdin'], { cwd: root, env: environment(data), windowsHide: true,
    input: password + '\n' + password + '\n', encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
}
function state(data) {
  const db = new DatabaseSync(path.join(data, 'orbit.sqlite'), { readOnly: true });
  try {
    const result = Object.fromEntries(collectionNames.map(name => [name,
      db.prepare(`SELECT payload FROM "${name}" ORDER BY ordinal`).all().map(row => JSON.parse(row.payload))]));
    for (const row of db.prepare('SELECT key,payload FROM state_properties').all()) Object.defineProperty(result, row.key,
      { value: JSON.parse(row.payload), enumerable: true, configurable: true, writable: true });
    return result;
  } finally { db.close(); }
}
async function port() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
  const result = listener.address().port;
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return result;
}
async function start(data) {
  const number = await port();
  const origin = `http://127.0.0.1:${number}`;
  const child = spawn(process.execPath, [serverEntry], { cwd: root, env: { ...environment(data), PORT: String(number), APP_ORIGIN: origin },
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  for (let retry = 0; retry < 200; retry++) {
    if (child.exitCode !== null) throw new Error('Startup failed: ' + output);
    try {
      const response = await fetch(origin + '/api/logs', { signal: AbortSignal.timeout(500) });
      if (response.status === 401) return { child, origin };
    } catch { /* Waiting for local listener. */ }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  child.kill(); throw new Error('Startup timeout: ' + output);
}
async function stop(runtime) {
  if (!runtime || runtime.child.exitCode !== null || runtime.child.signalCode !== null) return;
  const closed = once(runtime.child, 'close'); runtime.child.kill(); await closed;
}
async function request(runtime, endpoint, body, token, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(runtime.origin + endpoint, { method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
async function login(runtime, value = password) {
  return request(runtime, '/api/auth/login', { identifier: email, password: value });
}

test('login audits use real sessions, failed authentication persists audit rows, and empty org GET never seeds identities', { timeout: 45000 }, async t => {
  let runtime;
  t.after(async () => stop(runtime));
  const { data } = fixture(t);
  bootstrap(data); runtime = await start(data);
  const first = await login(runtime); assert.equal(first.status, 200);
  const second = await login(runtime); assert.equal(second.status, 200);
  const rejected = await login(runtime, 'WrongFixturePassword42!'); assert.equal(rejected.status, 401);
  const org = await request(runtime, '/api/org/data', undefined, first.body.token);
  assert.equal(org.status, 200);
  assert.deepEqual(org.body.departments, []);
  assert.deepEqual(org.body.teams, []);
  const saved = state(data);
  assert.equal(saved.users.length, 1);
  assert.equal(saved.organizations.length, 0);
  assert.equal(saved.loginHistory.filter(row => row.loginResult === 'Successful').length, 2);
  for (const row of saved.loginHistory.filter(row => row.sessionId)) assert.ok(saved.userSessions.some(session => session.id === row.sessionId));
  assert.ok(saved.loginHistory.some(row => row.loginResult === 'Failed'));
  const failed = saved.loginHistory.find(row => row.loginResult === 'Failed');
  assert.equal(failed.sessionId, null);
  assert.ok(saved.securityEvents.length > 0);
  const sessionId = saved.loginHistory.find(row => row.loginResult === 'Successful').sessionId;
  const terminated = await request(runtime, `/api/owner/sessions/${sessionId}/terminate`, {}, first.body.token);
  assert.equal(terminated.status, 200, JSON.stringify(terminated));
  const afterTermination = state(data);
  assert.equal(afterTermination.userSessions.find(row => row.id === sessionId).status, 'revoked');
  assert.ok(afterTermination.userSessions.find(row => row.id === sessionId).revokedAt);
  assert.ok(afterTermination.loginHistory.some(row => row.sessionId === sessionId));
  const activeSessions = await request(runtime, '/api/owner/sessions', undefined, second.body.token);
  assert.equal(activeSessions.status, 200);
  assert.ok(!activeSessions.body.some(row => row.id === sessionId));
  await stop(runtime); runtime = undefined;
});

test('Socket.IO publishes notification updates only after durable commit and never after a failed write', { timeout: 45000 }, async t => {
  let runtime, socket;
  t.after(async () => { socket?.disconnect(); await stop(runtime); });
  const { data } = fixture(t);
  bootstrap(data);
  const seeded = new SqliteStore(path.join(data, 'orbit.sqlite'));
  const seed = seeded.loadState();
  const owner = seed.users[0];
  seed.notifications.push({ id: 'notification-durability-fixture', userId: owner.id,
    workspaceId: owner.personalWorkspaceId, title: 'Fixture notification', read: false });
  seeded.saveState(seed); seeded.close();
  const offline = new DatabaseSync(path.join(data, 'orbit.sqlite'));
  offline.exec(`CREATE TRIGGER fixture_notification_failure BEFORE INSERT ON notifications WHEN json_extract(NEW.payload,'$.read')=1 BEGIN SELECT RAISE(ABORT,'isolated notification write failure'); END`);
  offline.close();
  const openSocket = async token => {
    socket = connectSocket(runtime.origin, { transports: ['websocket'], reconnection: false, timeout: 5000, auth: { token, workspaceId: owner.personalWorkspaceId } });
    await Promise.race([once(socket, 'connect'), once(socket, 'connect_error').then(([error]) => { throw error; })]);
    const joined = await new Promise(resolve => socket.emit('join', { userId: owner.id }, resolve));
    assert.equal(joined.ok, true);
  };
  runtime = await start(data);
  const authenticated = await login(runtime); assert.equal(authenticated.status, 200);
  await openSocket(authenticated.body.token);
  const events = [];
  socket.on('app_notifications_updated', payload => events.push(payload));
  const failed = await request(runtime, '/api/notifications/read-all', {}, authenticated.body.token, 'PUT');
  assert.equal(failed.status, 503, JSON.stringify(failed));
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.deepEqual(events, []);
  assert.equal(state(data).notifications.find(row => row.id === 'notification-durability-fixture').read, false);
  socket.disconnect(); socket = undefined;
  await stop(runtime); runtime = undefined;
  const repair = new DatabaseSync(path.join(data, 'orbit.sqlite'));
  repair.exec('DROP TRIGGER fixture_notification_failure'); repair.close();
  runtime = await start(data);
  const healthy = await login(runtime); assert.equal(healthy.status, 200);
  await openSocket(healthy.body.token);
  const received = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Committed notification event not received.')), 5000);
    socket.once('app_notifications_updated', payload => {
      clearTimeout(timer);
      try {
        assert.deepEqual(payload,{type:'data_changed'},'Notifications announce invalidation; recipients fetch their own authorized projection.');
        assert.equal(state(data).notifications.find(row => row.id === 'notification-durability-fixture').read, true,
          'Independent SQLite connection sees the commit when the event is received.');
        resolve();
      } catch (error) { reject(error); }
    });
  });
  const succeeded = await request(runtime, '/api/notifications/read-all', {}, healthy.body.token, 'PUT');
  assert.equal(succeeded.status, 200, JSON.stringify(succeeded));
  await received;
  const projection=await request(runtime,'/api/notifications',undefined,healthy.body.token,'GET');
  assert.equal(projection.status,200);assert.equal(projection.body.find(row=>row.id==='notification-durability-fixture').read,true);
  socket.disconnect(); socket = undefined;
  await stop(runtime); runtime = undefined;
});

test('departments, team channels, reports, projects and tasks commit together and survive restart', { timeout: 45000 }, async t => {
  let runtime;
  t.after(async () => stop(runtime));
  const { data } = fixture(t);
  bootstrap(data); runtime = await start(data);
  const authenticated = await login(runtime); assert.equal(authenticated.status, 200);
  const token = authenticated.body.token;
  const owner = state(data).users[0];
  const department = await request(runtime, '/api/org/departments', { name: 'Fixture Department', leaderId: owner.id }, token);
  assert.equal(department.status, 201, JSON.stringify(department));
  const team = await request(runtime, '/api/org/teams', { name: 'Fixture Team', departmentId: department.body.id, leaderId: owner.id, memberIds: [owner.id] }, token);
  assert.equal(team.status, 201, JSON.stringify(team));
  const report = await request(runtime, '/api/org/reports', { title: 'Fixture Report', departmentId: department.body.id, custom: { retained: true } }, token);
  assert.equal(report.status, 201, JSON.stringify(report));
  assert.equal(report.body.workspaceId, owner.personalWorkspaceId);
  const project = await request(runtime, '/api/projects', { title: 'Fixture Project', workspaceId: owner.personalWorkspaceId }, token);
  assert.equal(project.status, 201, JSON.stringify(project));
  const task = await request(runtime, '/api/tasks', { title: 'Fixture Task', projectId: project.body.id }, token);
  assert.equal(task.status, 201, JSON.stringify(task));
  let saved = state(data);
  const channels = saved.conversations.filter(row => row.teamId === team.body.id);
  assert.equal(channels.length, 4);
  assert.ok(saved.messages.some(row => row.conversationId === channels.find(channel => channel.channelType === 'private_chat').id && row.senderId === owner.id));
  assert.equal(saved.projects.find(row => row.id === project.body.id).totalTasks, 1);
  await stop(runtime); runtime = undefined;
  runtime = await start(data);
  saved = state(data);
  assert.equal(saved.projects.find(row => row.id === project.body.id).title, 'Fixture Project');
  assert.equal(saved.tasks.find(row => row.id === task.body.id).projectId, project.body.id);
  assert.deepEqual(saved.departmentReports.find(row => row.id === report.body.id).custom, { retained: true });
  assert.equal(saved.conversations.filter(row => row.teamId === team.body.id).length, 4);
  await stop(runtime); runtime = undefined;
});

test('parallel writes all persist and policy rejects an orphan before business mutation', { timeout: 45000 }, async t => {
  let runtime;
  t.after(async () => stop(runtime));
  const { data } = fixture(t);
  bootstrap(data); runtime = await start(data);
  const authenticated = await login(runtime); assert.equal(authenticated.status, 200);
  const token = authenticated.body.token;
  const results = await Promise.all(Array.from({ length: 20 }, (_, index) => request(runtime, '/api/projects', { title: `Parallel Project ${index}` }, token)));
  for (const response of results) assert.equal(response.status, 201, JSON.stringify(response));
  const original = state(data);
  assert.equal(original.projects.length, 20);
  assert.equal(new Set(original.projects.map(row => row.id)).size, 20);
  const invalid = await request(runtime, '/api/tasks', { title: 'must not persist orphan', projectId: 'nonexistent-project' }, token);
  assert.equal(invalid.status, 404, JSON.stringify(invalid));
  const after = state(data);
  assert.deepEqual(after.tasks, original.tasks);
  assert.deepEqual(after.projects, original.projects);
  assert.ok(after.apiLogs.some(row => row.endpoint === '/api/tasks' && row.status === 404), 'Policy denial leaves a truthful request audit without creating business records.');
  await stop(runtime); runtime = undefined;
  runtime = await start(data);
  assert.equal(state(data).projects.length, 20);
  await stop(runtime); runtime = undefined;
});

test('an actual SQLite write failure returns 503 before publishing success and normal writes recover after repair', { timeout: 45000 }, async t => {
  let runtime;
  t.after(async () => stop(runtime));
  const { data } = fixture(t);
  bootstrap(data);
  const database = new DatabaseSync(path.join(data, 'orbit.sqlite'));
  database.exec(`CREATE TRIGGER fixture_write_failure BEFORE INSERT ON projects WHEN instr(NEW.payload,'trigger-reject-project')>0 BEGIN SELECT RAISE(ABORT,'isolated fixture write failure'); END`);
  database.close();
  runtime = await start(data);
  const authenticated = await login(runtime); assert.equal(authenticated.status, 200);
  const token = authenticated.body.token;
  const rejected = await request(runtime, '/api/projects', { title: 'trigger-reject-project' }, token);
  assert.equal(rejected.status, 503, JSON.stringify(rejected));
  assert.equal(runtime.child.exitCode, null);
  assert.equal((await request(runtime, '/api/projects', undefined, token)).status, 200);
  const saved = state(data);
  assert.ok(!saved.projects.some(row => row.title === 'trigger-reject-project'));
  assert.ok(!saved.apiLogs.some(row => row.payload?.title === 'trigger-reject-project'));
  await stop(runtime); runtime = undefined;
  const repair = new DatabaseSync(path.join(data, 'orbit.sqlite'));
  repair.exec('DROP TRIGGER fixture_write_failure'); repair.close();
  runtime = await start(data);
  const healthy = await login(runtime); assert.equal(healthy.status, 200);
  const created = await request(runtime, '/api/projects', { title: 'repaired successful project' }, healthy.body.token);
  assert.equal(created.status, 201, JSON.stringify(created));
  assert.ok(state(data).projects.some(row => row.id === created.body.id));
  await stop(runtime); runtime = undefined;
});

test('corrupt SQLite stops startup without replacement; a database containing only custom settings survives restart', { timeout: 30000 }, async t => {
  let runtime;
  t.after(async () => stop(runtime));
  const { temporary, data } = fixture(t);
  fs.mkdirSync(data);
  const dbPath = path.join(data, 'orbit.sqlite');
  const corrupt = 'ORIGINAL CORRUPT DATABASE MUST NOT BE RESET';
  fs.writeFileSync(dbPath, corrupt);
  const result = spawnSync(process.execPath, [serverEntry], { cwd: root, env: environment(data), windowsHide: true, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.error, undefined, 'Corrupt database must reject startup promptly, not hang until timeout.');
  assert.ok(Number.isInteger(result.status) && result.status > 0, result.stderr);
  assert.equal(fs.readFileSync(dbPath, 'utf8'), corrupt);
  const emptyData = path.join(temporary, 'only-settings'); fs.mkdirSync(emptyData);
  const store = new SqliteStore(path.join(emptyData, 'orbit.sqlite'));
  const original = store.loadState(); original.settings = { theme: 'light', custom: ['persist', 0, false] };
  for (const [key, value] of Object.entries(JSON.parse('{"__proto__":{"keep":"yes"},"constructor":{"keep":"yes"}}'))) {
    Object.defineProperty(original, key, { value, enumerable: true, configurable: true, writable: true });
  }
  store.saveState(original); store.close();
  runtime = await start(emptyData); await stop(runtime); runtime = undefined;
  runtime = await start(emptyData);
  assert.deepEqual(state(emptyData).settings, original.settings);
  assert.deepEqual(Object.getOwnPropertyDescriptor(state(emptyData), '__proto__').value, { keep: 'yes' });
  assert.deepEqual(Object.getOwnPropertyDescriptor(state(emptyData), 'constructor').value, { keep: 'yes' });
  assert.equal(state(emptyData).users.length, 0);
  await stop(runtime); runtime = undefined;
});
