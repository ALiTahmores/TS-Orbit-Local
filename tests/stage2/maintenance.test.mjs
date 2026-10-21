import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { collectionNames } from '../../server/db/schema.ts';
import { SqliteStore } from '../../server/db/store.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const entry = path.join(root, 'dist/server/database.cjs');
assert.ok(fs.existsSync(entry), 'Run npm run build before database maintenance tests.');
function fixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-orbit-stage2-'));
  const data = path.join(temporary, 'data');
  t.after(() => {
    assert.equal(path.dirname(temporary), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(temporary).startsWith('ts-orbit-stage2-'));
    fs.rmSync(temporary, { recursive: true, force: true });
  });
  return { temporary, data };
}
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function cli(data, args) {
  const result = spawnSync(process.execPath, [entry, ...args], { cwd: root, encoding: 'utf8', timeout: 15000, windowsHide: true,
    env: { ...process.env, PROJECT_ROOT: root, DATA_DIR: data, LEGACY_DB_IMPORT: '', HOST: '127.0.0.1', PORT: '3000', APP_ORIGIN: '', ALLOW_NETWORK_ACCESS: '' } });
  if (result.error) throw result.error;
  return result;
}
function success(result) { assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`); return JSON.parse(result.stdout); }
function source(directory, name = 'legacy.json', state = { users: [{ id: 'owner-original', email: 'owner@example.invalid', role: 'OWNER', memberships: [] }],
  workspaces: [{ id: 'workspace-original', ownerId: 'owner-original' }],
  projects: [{ id: 'project-original', workspaceId: 'workspace-original', status: 'DRAFT' }],
  tasks: [{ id: 'task-original', projectId: 'project-original', ownerId: 'owner-original', customField: { enabled: true } }],
  settings: { theme: 'dark', customSetting: ['original'] } }) {
  const filename = path.join(directory, name);
  fs.writeFileSync(filename, JSON.stringify(state));
  return filename;
}
function exported(data, directory, filename) {
  const target = path.join(directory, filename);
  success(cli(data, ['export', '--output', target]));
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

test('migration dry-run is read-only, import retains IDs and unknown fields, repeated import is idempotent', t => {
  const { temporary, data } = fixture(t);
  const original = source(temporary);
  const before = hash(original);
  const report = success(cli(data, ['dry-run', '--source', original]));
  assert.match(report.sourceHash, /^[a-f0-9]{64}$/);
  assert.ok(!fs.existsSync(path.join(data, 'orbit.sqlite')));
  success(cli(data, ['import', '--source', original]));
  assert.equal(hash(original), before);
  const status = success(cli(data, ['status']));
  assert.equal(status.integrity, 'ok');
  assert.equal(status.collections.users, 1);
  assert.equal(Object.keys(status.collections).length, collectionNames.length);
  const state = exported(data, temporary, 'recovery1.json');
  assert.equal(state.users[0].id, 'owner-original');
  assert.equal(state.tasks[0].id, 'task-original');
  assert.deepEqual(state.tasks[0].customField, { enabled: true });
  assert.deepEqual(state.settings.customSetting, ['original']);
  success(cli(data, ['import', '--source', original]));
  assert.deepEqual(success(cli(data, ['status'])), status);
  const different = source(temporary, 'different.json', { users: [{ id: 'different', email: 'other@example.invalid' }] });
  assert.notEqual(cli(data, ['import', '--source', different]).status, 0);
  assert.deepEqual(exported(data, temporary, 'recovery2.json'), state);
  assert.equal(hash(original), before);
});

test('all application collections, record ordering, properties and settings survive import and recovery export', t => {
  const { temporary, data } = fixture(t);
  assert.ok(collectionNames.length >= 59);
  const original = Object.fromEntries(collectionNames.map(collection => [collection, [
    { id: `${collection}-first-original`, arbitrary: { nested: [null, false, 0, 'متن فارسی'] } },
    { id: `${collection}-second-original`, extension: 'preserve this field' },
  ]]));
  original.settings = { theme: 'light', custom: { enabled: false } };
  original.customRootProperty = { original: [1, 2, 3] };
  for (const [key, value] of Object.entries(JSON.parse('{"__proto__":{"keep":"yes"},"constructor":{"keep":"yes"}}'))) {
    Object.defineProperty(original, key, { value, enumerable: true, configurable: true, writable: true });
  }
  const filename = source(temporary, 'all-collections.json', original);
  const before = hash(filename);
  const report = success(cli(data, ['import', '--source', filename]));
  assert.equal(report.issueCount, 0);
  assert.equal(hash(filename), before);
  assert.deepEqual(exported(data, temporary, 'all-collections-export.json'), original);
  for (const count of Object.values(success(cli(data, ['status'])).collections)) assert.equal(count, 2);
});

test('bad JSON import cannot overwrite an existing database; duplicate identities and broken references are retained with quarantine reports', t => {
  const { temporary, data } = fixture(t);
  const valid = source(temporary);
  success(cli(data, ['import', '--source', valid]));
  const originalState = exported(data, temporary, 'before.json');
  const bad = path.join(temporary, 'invalid.json');
  fs.writeFileSync(bad, '{"users":[INVALID');
  assert.notEqual(cli(data, ['import', '--source', bad]).status, 0);
  assert.deepEqual(exported(data, temporary, 'after.json'), originalState);
  assert.equal(fs.readFileSync(bad, 'utf8'), '{"users":[INVALID');
  const isolated = path.join(temporary, 'conflicts');
  const conflicted = source(temporary, 'conflicted.json', {
    users: [{ id: 'same-id', email: 'one@example.invalid' }, { id: 'same-id', email: 'two@example.invalid' },
      { id: 'other-id', email: 'ONE@example.invalid' }], tasks: [{ id: 'broken-task', projectId: 'missing-project' }],
  });
  const report = success(cli(isolated, ['dry-run', '--source', conflicted]));
  assert.ok(report.issueCount >= 3);
  success(cli(isolated, ['import', '--source', conflicted]));
  assert.ok(success(cli(isolated, ['status'])).quarantineCount >= 3);
  const recovered = exported(isolated, temporary, 'conflicted-recovery.json');
  assert.equal(recovered.users.length, 3);
  assert.equal(recovered.tasks[0].projectId, 'missing-project');
});

test('private backup preserves SQLite, secret and assets; restore preserves previous data; a tampered backup cannot touch live data', t => {
  const { temporary, data } = fixture(t);
  success(cli(data, ['import', '--source', source(temporary)]));
  fs.writeFileSync(path.join(data, 'jwt-secret'), 'a'.repeat(96));
  fs.mkdirSync(path.join(data, 'uploads'));
  fs.writeFileSync(path.join(data, 'uploads', 'original.txt'), 'private attachment');
  const backup = path.join(temporary, 'backup');
  const backedUp = success(cli(data, ['backup', '--output', backup]));
  assert.equal(backedUp.private, true);
  const manifest = JSON.parse(fs.readFileSync(path.join(backup, 'manifest.json'), 'utf8'));
  assert.ok(manifest.files.some(file => file.path === 'jwt-secret'));
  assert.ok(manifest.files.some(file => file.path === 'uploads/original.txt'));
  assert.ok(!manifest.files.some(file => file.path.endsWith('-wal') || file.path.endsWith('-shm') || file.path.endsWith('.lock')));
  fs.writeFileSync(path.join(data, 'jwt-secret'), 'b'.repeat(96));
  fs.writeFileSync(path.join(data, 'uploads', 'original.txt'), 'changed current data');
  const restored = success(cli(data, ['restore', '--source', backup]));
  assert.equal(fs.readFileSync(path.join(data, 'jwt-secret'), 'utf8'), 'a'.repeat(96));
  assert.equal(fs.readFileSync(path.join(data, 'uploads', 'original.txt'), 'utf8'), 'private attachment');
  assert.equal(fs.readFileSync(path.join(restored.preservedPreviousData, 'uploads', 'original.txt'), 'utf8'), 'changed current data');
  const dbHash = hash(path.join(data, 'orbit.sqlite'));
  fs.appendFileSync(path.join(backup, 'data', 'uploads', 'original.txt'), 'tampered');
  assert.notEqual(cli(data, ['restore', '--source', backup]).status, 0);
  assert.equal(hash(path.join(data, 'orbit.sqlite')), dbHash);
  assert.equal(fs.readFileSync(path.join(data, 'jwt-secret'), 'utf8'), 'a'.repeat(96));
});

test('backup rejects active process lock and destinations inside data; restore rejects path traversal and unlisted files', t => {
  const { temporary, data } = fixture(t);
  const sourceFile = source(temporary);
  success(cli(data, ['import', '--source', sourceFile]));
  const beforeLegacyLock = hash(path.join(data, 'orbit.sqlite'));
  const legacyLock = path.join(data, '.database.lock');
  fs.writeFileSync(legacyLock, String(process.pid));
  for (const args of [['status'], ['import', '--source', sourceFile]]) {
    const legacyBlocked = cli(data, args);
    assert.notEqual(legacyBlocked.status, 0);
    assert.match(legacyBlocked.stderr, /already in use/i);
    assert.equal(hash(path.join(data, 'orbit.sqlite')), beforeLegacyLock);
  }
  fs.unlinkSync(legacyLock);
  fs.writeFileSync(data + '.lock', String(process.pid));
  const locked = cli(data, ['backup', '--output', path.join(temporary, 'locked-backup')]);
  assert.notEqual(locked.status, 0);
  assert.match(locked.stderr, /already in use/);
  fs.unlinkSync(data + '.lock');
  assert.notEqual(cli(data, ['backup', '--output', path.join(data, 'unsafe')]).status, 0);
  const backup = path.join(temporary, 'backup');
  success(cli(data, ['backup', '--output', backup]));
  const original = hash(path.join(data, 'orbit.sqlite'));
  fs.writeFileSync(path.join(backup, 'unlisted.txt'), 'invalid');
  assert.notEqual(cli(data, ['restore', '--source', backup]).status, 0);
  assert.equal(hash(path.join(data, 'orbit.sqlite')), original);
  fs.unlinkSync(path.join(backup, 'unlisted.txt'));
  const manifestPath = path.join(backup, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.files.push({ path: '../outside', bytes: 0, sha256: 'a'.repeat(64) });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.notEqual(cli(data, ['restore', '--source', backup]).status, 0);
  assert.equal(hash(path.join(data, 'orbit.sqlite')), original);
});

test('corrupt SQLite fails status and backup without replacing the original file', t => {
  const { temporary, data } = fixture(t);
  fs.mkdirSync(data);
  const corrupt = path.join(data, 'orbit.sqlite');
  fs.writeFileSync(corrupt, 'DO NOT RESET CORRUPT SQLITE');
  const before = hash(corrupt);
  assert.notEqual(cli(data, ['status']).status, 0);
  assert.notEqual(cli(data, ['backup', '--output', path.join(temporary, 'backup')]).status, 0);
  assert.equal(hash(corrupt), before);
});

test('a rehashed but corrupt SQLite backup is rejected by integrity validation before restore', t => {
  const { temporary, data } = fixture(t);
  success(cli(data, ['import', '--source', source(temporary)]));
  const backup = path.join(temporary, 'backup');
  success(cli(data, ['backup', '--output', backup]));
  const currentHash = hash(path.join(data, 'orbit.sqlite'));
  const broken = path.join(backup, 'data', 'orbit.sqlite');
  fs.writeFileSync(broken, 'not a database, even with a valid checksum');
  const manifestFile = path.join(backup, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const database = manifest.files.find(file => file.path === 'orbit.sqlite');
  database.bytes = fs.statSync(broken).size;
  database.sha256 = hash(broken);
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  assert.notEqual(cli(data, ['restore', '--source', backup]).status, 0);
  assert.equal(hash(path.join(data, 'orbit.sqlite')), currentHash);
});

test('backup refuses symbolic directory links and maintenance refuses an unfinished restore marker', t => {
  const { temporary, data } = fixture(t);
  success(cli(data, ['import', '--source', source(temporary)]));
  const outside = path.join(temporary, 'outside');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'must-not-be-backed-up.txt'), 'outside file');
  const link = path.join(data, 'linked-assets');
  try { fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') { t.skip('OS does not allow creating symbolic directory fixture.'); return; }
    throw error;
  }
  assert.notEqual(cli(data, ['backup', '--output', path.join(temporary, 'bad-backup')]).status, 0);
  fs.unlinkSync(link);
  fs.writeFileSync(data + '.restore-pending', JSON.stringify({ reason: 'simulated interrupted restore' }));
  const result = cli(data, ['status']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /restore/i);
});

test('recover-restore repairs an interrupted folder swap without resetting IDs, records or secrets', t => {
  const { temporary, data } = fixture(t);
  success(cli(data, ['import', '--source', source(temporary)]));
  fs.writeFileSync(path.join(data, 'jwt-secret'), 'c'.repeat(96));
  const backup = path.join(temporary, 'backup');
  success(cli(data, ['backup', '--output', backup]));
  const manifest = JSON.parse(fs.readFileSync(path.join(backup, 'manifest.json'), 'utf8'));
  const baseline = exported(data, temporary, 'before-interruption.json');
  const previousFiles = fs.readdirSync(data).sort().map(filename => ({ path: filename,
    bytes: fs.statSync(path.join(data, filename)).size, sha256: hash(path.join(data, filename)) }));
  const previous = data + '.previous-' + randomUUID();
  const staging = data + '.restore-' + randomUUID();
  fs.cpSync(path.join(backup, 'data'), staging, { recursive: true });
  fs.renameSync(data, previous);
  const pending = data + '.restore-pending';
  fs.writeFileSync(pending, JSON.stringify({ current: data, previous, staging, source: backup,
    createdAt: new Date().toISOString(), previousFiles, targetFiles: manifest.files }));
  assert.notEqual(cli(data, ['status']).status, 0);
  assert.ok(!fs.existsSync(data), 'A blocked startup must not create an empty replacement data directory.');
  const recovered = success(cli(data, ['recover-restore']));
  assert.equal(recovered.data, data);
  assert.ok(!fs.existsSync(pending));
  assert.ok(fs.existsSync(staging), 'Staging data remains available for inspection.');
  assert.equal(fs.readFileSync(path.join(data, 'jwt-secret'), 'utf8'), 'c'.repeat(96));
  assert.deepEqual(exported(data, temporary, 'after-interruption.json'), baseline);
  assert.equal(success(cli(data, ['status'])).integrity, 'ok');
});

test('SQLite journal recovery rolls back a terminated writer and concurrent lock errors do not reset records', t => {
  const { temporary, data } = fixture(t);
  success(cli(data, ['import', '--source', source(temporary)]));
  const dbFile = path.join(data, 'orbit.sqlite');
  const baseline = exported(data, temporary, 'before-crash.json');
  const writer = spawnSync(process.execPath, ['-e', `const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);db.exec("BEGIN IMMEDIATE;CREATE TABLE crash_probe(id TEXT);INSERT INTO crash_probe VALUES('not committed')");process.exit(71)`, dbFile],
    { encoding: 'utf8', windowsHide: true, timeout: 5000 });
  assert.equal(writer.status, 71, writer.stderr);
  assert.deepEqual(exported(data, temporary, 'after-crash.json'), baseline);
  const locked = new DatabaseSync(dbFile);
  try {
    locked.exec('BEGIN IMMEDIATE');
    const competitor = spawnSync(process.execPath, ['-e', `const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);db.exec('PRAGMA busy_timeout=20;BEGIN IMMEDIATE;CREATE TABLE conflict_probe(id TEXT);COMMIT')`, dbFile],
      { encoding: 'utf8', windowsHide: true, timeout: 5000 });
    assert.notEqual(competitor.status, 0);
    assert.match(competitor.stderr, /locked|busy/i);
    locked.exec('ROLLBACK');
  } finally { locked.close(); }
  assert.deepEqual(exported(data, temporary, 'after-conflict.json'), baseline);
  assert.equal(success(cli(data, ['status'])).integrity, 'ok');
});

test('a failed multi-record write rolls back unrelated edits and prevents new duplicate identities or dangling references', t => {
  const { temporary, data } = fixture(t);
  success(cli(data, ['import', '--source', source(temporary)]));
  const store = new SqliteStore(path.join(data, 'orbit.sqlite'));
  try {
    const baseline = store.loadState();
    const changed = structuredClone(baseline);
    changed.users[0].name = 'must roll back';
    changed.tasks.push({ id: 'new-invalid-task', projectId: 'nonexistent-project' });
    store.begin();
    assert.throws(() => store.saveState(changed));
    store.rollback();
    assert.deepEqual(store.loadState(), baseline);
    const duplicate = structuredClone(baseline);
    duplicate.users.push({ ...duplicate.users[0], name: 'duplicate' });
    assert.throws(() => store.saveState(duplicate));
    assert.deepEqual(store.loadState(), baseline);
    assert.equal(store.getStatus().integrity, 'ok');
  } finally { store.close(); }
});
