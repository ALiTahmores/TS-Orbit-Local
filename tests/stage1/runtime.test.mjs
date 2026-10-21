import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const serverEntry = path.join(root, 'dist/server/server.cjs');
const accountEntry = path.join(root, 'dist/server/local-account.cjs');
const password = 'IsolatedFixturePassword42!';
const changedPassword = 'ChangedFixturePassword73!';
assert.ok(fs.existsSync(serverEntry) && fs.existsSync(accountEntry), 'Run npm run build before runtime tests.');

function fixture(t) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-orbit-stage1-'));
  const dataDir = path.join(tempRoot, 'data');
  t.after(() => {
    assert.equal(path.dirname(tempRoot), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(tempRoot).startsWith('ts-orbit-stage1-'));
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
  return { tempRoot, dataDir };
}

function environment(dataDir, extra = {}) {
  return { ...process.env, PROJECT_ROOT: root, NODE_ENV: 'production', DATA_DIR: dataDir,
    LEGACY_DB_IMPORT: '', HOST: '127.0.0.1', PORT: '3000', APP_ORIGIN: '',
    ALLOW_NETWORK_ACCESS: '', ...extra };
}

function account(dataDir, args, chosenPassword = password, extra = {}) {
  const result = spawnSync(process.execPath, [accountEntry, ...args, '--password-stdin'], {
    cwd: root, env: environment(dataDir, extra), encoding: 'utf8', windowsHide: true,
    input: `${chosenPassword}\n${chosenPassword}\n`, timeout: 15000,
  });
  if (result.error) throw result.error;
  return result;
}

function database(dataDir) {
  const connection = new DatabaseSync(path.join(dataDir, 'orbit.sqlite'), { readOnly: true });
  try {
    const state = {};
    for (const table of connection.prepare("SELECT name FROM sqlite_master WHERE type='table' AND sql LIKE '%entity_id TEXT%'").all()) {
      if (table.name === 'entity_registry') continue;
      state[table.name] = connection.prepare(`SELECT payload FROM "${table.name}" ORDER BY ordinal`).all().map(row => JSON.parse(row.payload));
    }
    for (const row of connection.prepare('SELECT key,payload FROM state_properties').all()) state[row.key] = JSON.parse(row.payload);
    return state;
  } finally { connection.close(); }
}

async function availablePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
  const port = listener.address().port;
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return port;
}

async function start(dataDir, extra = {}) {
  const port = extra.PORT ? Number(extra.PORT) : await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [serverEntry], { cwd: root,
    env: environment(dataDir, { PORT: String(port), APP_ORIGIN: origin, ...extra }),
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '', spawnError;
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  child.on('error', error => { spawnError = error; });
  for (let attempt = 0; attempt < 200; attempt++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`Server exited during startup (${child.exitCode}): ${output}`);
    try {
      const response = await fetch(origin + '/api/logs', { signal: AbortSignal.timeout(500) });
      if (response.status === 401) return { child, origin };
    } catch { /* Process is still opening its listener. */ }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  child.kill();
  throw new Error(`Server readiness timed out: ${output}`);
}

async function stop(runtime) {
  if (!runtime || runtime.child.exitCode !== null || runtime.child.signalCode !== null) return;
  const closed = once(runtime.child, 'close');
  runtime.child.kill();
  await closed;
}

async function request(runtime, endpoint, body, token) {
  const response = await fetch(runtime.origin + endpoint, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data };
}

test('local authentication, recovery, access and restart lifecycle', { timeout: 45000 }, async t => {
  let runtime;
  t.after(async () => stop(runtime));
  const { dataDir } = fixture(t);
  const bootstrap = account(dataDir, ['bootstrap', '--email', 'owner@example.invalid', '--name', 'Fixture Owner', '--phone', '09000000000']);
  assert.equal(bootstrap.status, 0, bootstrap.stderr);
  assert.ok(!bootstrap.stdout.includes(password));
  let state = database(dataDir);
  assert.equal(state.users.length, 1);
  const ownerId = state.users[0].id;
  const workspaceId = state.users[0].personalWorkspaceId;
  assert.equal(state.users[0].role, 'OWNER');
  runtime = await start(dataDir);
  const stablePort = new URL(runtime.origin).port;
  const secret = fs.readFileSync(path.join(dataDir, 'jwt-secret'), 'utf8');
  assert.match(secret, /^[a-f0-9]{96}$/);

  const login = await request(runtime, '/api/auth/login', { identifier: 'owner@example.invalid', password });
  assert.equal(login.status, 200);
  const oldToken = login.data.token;
  assert.equal(login.data.user.id, ownerId);
  assert.equal((await request(runtime, '/api/auth/me', undefined, oldToken)).data.user.id, ownerId);
  assert.equal((await request(runtime, '/api/logs')).status, 401);
  for (const privatePath of ['/server.cjs', '/server/server.cjs', '/server/server.cjs.map']) {
    const response = await request(runtime, privatePath);
    assert.equal(typeof response.data, 'string');
    assert.match(response.data, /<!doctype html>/i);
    assert.ok(!response.data.includes('JWT_SECRET'));
  }
  const weakRegistration = await request(runtime, '/api/auth/register', {
    email: 'weak-registration@example.invalid', name: 'Weak', phone: '09000000002', password: '123456',
  });
  assert.equal(weakRegistration.status, 400);
  assert.equal(weakRegistration.data.error, 'VALIDATION_FAILED');

  const registered = await request(runtime, '/api/auth/register', { email: 'normal@example.invalid', name: 'Normal User',
    phone: '09000000001', password, username: 'normal_user' });
  assert.equal(registered.status, 201);
  assert.equal(registered.data.user.role, 'USER');
  assert.equal(registered.data.user.memberships[0].role, 'OWNER');
  assert.equal(registered.data.workspace.ownerId, registered.data.user.id);
  assert.equal((await request(runtime, '/api/logs', undefined, registered.data.token)).status, 403);

  for (const endpoint of ['forgot-password', 'reset-password', 'verify-email']) {
    const result = await request(runtime, '/api/auth/' + endpoint, { email: 'owner@example.invalid', code: '123456', newPassword: changedPassword });
    assert.equal(result.status, 409);
    assert.equal(result.data.error, 'LOCAL_RECOVERY_REQUIRED');
    assert.equal(result.data.code, undefined);
  }
  assert.equal((await request(runtime, '/api/auth/google/url')).status, 401);
  assert.equal((await request(runtime, '/api/auth/google/url', undefined, oldToken)).status, 404);
  const nestedSecret = 'must-not-appear-in-logs';
  await request(runtime, '/api/testing-missing-endpoint', { visible: 'ordinary data', nested: {
    password: nestedSecret, arrays: [{ accessToken: nestedSecret }, { api_key: nestedSecret }] } });
  const logs = await request(runtime, '/api/logs', undefined, oldToken);
  assert.equal(logs.status, 200);
  assert.ok(!JSON.stringify(logs.data).includes(nestedSecret));
  assert.ok(!JSON.stringify(logs.data).includes(password));
  const loggedNested = logs.data.find(log => log.endpoint === '/api/testing-missing-endpoint');
  assert.ok(loggedNested);
  assert.equal(loggedNested.payload, undefined, 'System request logs expose metadata, never historical arbitrary payloads.');

  const locked = account(dataDir, ['set-password', '--email', 'owner@example.invalid'], changedPassword);
  assert.notEqual(locked.status, 0);
  assert.match(locked.stderr, /already in use/);
  await stop(runtime); runtime = undefined;
  runtime = await start(dataDir, { PORT: stablePort });
  assert.equal(fs.readFileSync(path.join(dataDir, 'jwt-secret'), 'utf8'), secret);
  assert.equal((await request(runtime, '/api/auth/me', undefined, oldToken)).status, 200);
  state = database(dataDir);
  assert.equal(state.users.find(user => user.email === 'normal@example.invalid').role, 'USER');
  assert.equal(state.users.find(user => user.id === ownerId).personalWorkspaceId, workspaceId);
  await stop(runtime); runtime = undefined;

  const reset = account(dataDir, ['set-password', '--email', 'owner@example.invalid'], changedPassword);
  assert.equal(reset.status, 0, reset.stderr);
  assert.notEqual(fs.readFileSync(path.join(dataDir, 'jwt-secret'), 'utf8'), secret);
  runtime = await start(dataDir);
  assert.equal((await request(runtime, '/api/auth/me', undefined, oldToken)).status, 401);
  assert.equal((await request(runtime, '/api/auth/login', { identifier: 'owner@example.invalid', password })).status, 401);
  const recovered = await request(runtime, '/api/auth/login', { identifier: 'owner@example.invalid', password: changedPassword });
  assert.equal(recovered.status, 200);
  assert.equal(recovered.data.user.id, ownerId);
  assert.equal(recovered.data.user.personalWorkspaceId, workspaceId);
  await stop(runtime); runtime = undefined;
});

test('explicit legacy import preserves identities, memberships, draft state and source file', { timeout: 30000 }, async t => {
  let runtime;
  t.after(async () => stop(runtime));
  const { tempRoot, dataDir } = fixture(t);
  const legacyPath = path.join(tempRoot, 'legacy.json');
  const legacy = {
    users: [{ id: 'legacy-owner-original-id', email: 'legacy-owner@example.invalid', name: 'Legacy Owner', role: 'OWNER', status: 'ACTIVE',
      passwordHash: bcrypt.hashSync('123456', 10), personalWorkspaceId: 'original-workspace',
      memberships: [{ workspaceId: 'original-workspace', role: 'OWNER', permissions: ['all'] }] },
      { id: 'legacy-oauth-identity', email: 'test@original.example', name: 'Preserved User', role: 'USER', status: 'ACTIVE',
        passwordHash: bcrypt.hashSync(password, 10), memberships: [{ workspaceId: 'original-workspace', role: 'DEVELOPER' }] }],
    workspaces: [{ id: 'original-workspace', ownerId: 'legacy-owner-original-id', members: [{ userId: 'legacy-owner-original-id', role: 'OWNER' }] }],
    projects: [{ id: 'draft-project-original', workspaceId: 'original-workspace', status: 'DRAFT', startDate: '—' }],
    tasks: [{ id: 'original-task', projectId: 'draft-project-original' }],
    apiLogs: [{ id: 'legacy-sensitive-log', payload: { password: 'OLD_PRIVATE_PASSWORD', nested: [{ apiKey: 'OLD_PRIVATE_KEY' }] } }],
  };
  const source = JSON.stringify(legacy);
  fs.writeFileSync(legacyPath, source);
  const configured = account(dataDir, ['set-password', '--email', 'legacy-owner@example.invalid'], password, { LEGACY_DB_IMPORT: legacyPath });
  assert.equal(configured.status, 0, configured.stderr);
  assert.equal(fs.readFileSync(legacyPath, 'utf8'), source);
  runtime = await start(dataDir);
  const weakLogin = await request(runtime, '/api/auth/login', { identifier: 'legacy-owner@example.invalid', password: '123456' });
  assert.equal(weakLogin.status, 401);
  const owner = await request(runtime, '/api/auth/login', { identifier: 'legacy-owner@example.invalid', password });
  assert.equal(owner.status, 200);
  const oldLogs = await request(runtime, '/api/logs', undefined, owner.data.token);
  assert.ok(!JSON.stringify(oldLogs.data).includes('OLD_PRIVATE_PASSWORD'));
  assert.ok(!JSON.stringify(oldLogs.data).includes('OLD_PRIVATE_KEY'));
  const normal = await request(runtime, '/api/auth/login', { identifier: 'test@original.example', password });
  assert.equal(normal.status, 200);
  assert.equal(normal.data.user.id, 'legacy-oauth-identity');
  assert.equal(normal.data.user.role, 'USER');
  assert.deepEqual(normal.data.user.memberships, [], 'An unverified user-side membership copy cannot grant workspace access.');
  await stop(runtime); runtime = undefined;
  const state = database(dataDir);
  assert.equal(state.users.length, 2);
  assert.equal(state.users[0].id, 'legacy-owner-original-id');
  assert.deepEqual(state.users[1].memberships, legacy.users[1].memberships, 'Historical membership data is preserved for explicit reconciliation.');
  assert.deepEqual(state.projects, legacy.projects);
  assert.deepEqual(state.tasks, legacy.tasks);
  assert.equal(fs.readFileSync(legacyPath, 'utf8'), source);
});

test('known seed password locks imported account until trusted local recovery', { timeout: 20000 }, async t => {
  const { dataDir } = fixture(t);
  fs.mkdirSync(dataDir);
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({ users: [{ id: 'weak-original', email: 'weak@example.invalid', role: 'USER',
    passwordHash: bcrypt.hashSync('invited123', 10), memberships: [] }], workspaces: [] }));
  const result = account(dataDir, ['set-password', '--email', 'does-not-exist@example.invalid']);
  assert.notEqual(result.status, 0);
  const preserved = database(dataDir).users[0];
  assert.equal(preserved.id, 'weak-original');
  assert.equal(preserved.localPasswordRequired, true);
  assert.equal(bcrypt.compareSync('invited123', preserved.passwordHash), false);
});

test('corrupt JSON fails without replacing or resetting data', t => {
  const { dataDir } = fixture(t);
  fs.mkdirSync(dataDir);
  const dbPath = path.join(dataDir, 'db.json');
  const corrupt = '{"users":[DO_NOT_RESET_THIS_FILE';
  fs.writeFileSync(dbPath, corrupt);
  const result = account(dataDir, ['bootstrap', '--email', 'owner@example.invalid', '--name', 'Owner', '--phone', '09000000000']);
  assert.notEqual(result.status, 0);
  assert.equal(fs.readFileSync(dbPath, 'utf8'), corrupt);
  assert.ok(!fs.existsSync(path.join(dataDir, 'db.json.tmp')));
});

test('configuration rejects public/build/root data paths and accidental network listener', t => {
  const { dataDir } = fixture(t);
  for (const unsafe of [root, path.dirname(root), path.join(root, 'public/private'), path.join(root, 'dist/private')]) {
    const result = spawnSync(process.execPath, [accountEntry, 'set-password', '--email', 'owner@example.invalid', '--password-stdin'], {
      cwd: root, env: environment(unsafe), input: `${password}\n${password}\n`, encoding: 'utf8', timeout: 5000, windowsHide: true,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /DATA_DIR/);
  }
  for (const invalid of [{ HOST: '0.0.0.0' }, { PORT: 'not-a-number' }, { APP_ORIGIN: 'https://remote.example' }]) {
    const result = account(dataDir, ['set-password', '--email', 'owner@example.invalid'], password, invalid);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /HOST|PORT|APP_ORIGIN/);
  }
});
