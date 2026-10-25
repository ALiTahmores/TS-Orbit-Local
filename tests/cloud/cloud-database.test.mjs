import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { emptyState } from '../../server/db/store.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-cloud-maintenance-test-'));
const output = path.join(temp, 'helpers.cjs');
await build({ entryPoints: [path.join(root, 'scripts/cloud-database.ts')], outfile: output, bundle: true, platform: 'node', format: 'cjs', target: 'node24', external: ['pg'], logLevel: 'silent' });
const { createCloudBackup, validateCloudBackup, privateBackupPath, writePrivateBackup, exportCloudBackup, restoreCloudBackup, main } = createRequire(import.meta.url)(output);
test.after(() => fs.rmSync(temp, { recursive: true, force: true }));
function seeded() {
  const state = emptyState(); state.users.push({ id: 'synthetic-account', email: 'synthetic@example.test', passwordHash: 'synthetic-private-hash', systemRole: 'ADMIN' });
  state.workspaces.push({ id: 'synthetic-workspace', ownerId: 'synthetic-account' });
  state.userSessions.push({ id: 'synthetic-session', userId: 'synthetic-account', status: 'active' });
  state.extension = { preserve: ['unknown-root-property'] }; return state;
}
class Store {
  durable = emptyState(); archives = []; metadata = new Map([['jwt_secret', 'never-export-this-signing-key']]); active = false; failure = false; rollbacks = 0;
  async begin() { assert.equal(this.active, false); this.active = true; this.state = structuredClone(this.durable); this.pendingArchives = structuredClone(this.archives); this.pendingMetadata = new Map(this.metadata); }
  async loadState() { assert.equal(this.active, true); return this.state; }
  async saveState(value) { this.state = structuredClone(value); }
  async getRevision() { return 3; }
  async transactionQuery() { return { rows: structuredClone(this.pendingArchives) }; }
  async putArchive(kind, key, payload) { this.pendingArchives.push({ kind, key, payload }); }
  async setMetadata(key, value) { this.pendingMetadata.set(key, value); }
  async commit() { if (this.failure) throw new Error('synthetic commit failure'); this.durable = this.state; this.archives = this.pendingArchives; this.metadata = this.pendingMetadata; this.active = false; }
  async rollback() { this.active = false; this.rollbacks++; }
}
test('private export preserves every collection, root extension and archive, excluding signing metadata', async () => {
  const store = new Store(); store.durable = seeded(); store.archives.push({ kind: 'quarantine', key: 'synthetic-archive', payload: { private: 'synthetic' } });
  const backup = await exportCloudBackup(store); assert.deepEqual(backup.state, store.durable); assert.deepEqual(backup.archives, store.archives); assert.equal(backup.sourceRevision, 3); assert.equal(JSON.stringify(backup).includes('never-export-this-signing-key'), false); assert.equal(store.active, false); assert.equal(store.rollbacks, 1);
});
test('integrity, schema, missing collections and relation anomalies reject before restore begins', async () => {
  const backup = createCloudBackup(seeded(), 1), store = new Store(); const changed = structuredClone(backup); changed.state.users[0].name = 'tampered'; assert.throws(() => validateCloudBackup(changed), /integrity/);
  const version = structuredClone(backup); version.schemaVersion = 99; assert.throws(() => validateCloudBackup(version), /Unsupported/);
  const missing = seeded(); delete missing.tasks; assert.throws(() => createCloudBackup(missing, 1), /collection/);
  const orphan = seeded(); orphan.projects.push({ id: 'orphan', workspaceId: 'absent' });
  await assert.rejects(restoreCloudBackup(store, createCloudBackup(orphan, 1), { confirmEmptyRestore: true }), /unresolved/); assert.equal(store.active, false); assert.equal(store.rollbacks, 0);
});
test('restore requires explicit confirmation and refuses nonempty destinations without changing data', async () => {
  const backup = createCloudBackup(seeded(), 1), store = new Store();
  await assert.rejects(restoreCloudBackup(store, backup, { confirmEmptyRestore: false }), /confirm-empty/);
  store.durable = seeded(); const before = structuredClone(store.durable); await assert.rejects(restoreCloudBackup(store, backup, { confirmEmptyRestore: true }), /not empty/); assert.deepEqual(store.durable, before); assert.equal(store.active, false);
  store.durable = emptyState(); store.durable.settings.theme = 'custom'; await assert.rejects(restoreCloudBackup(store, backup, { confirmEmptyRestore: true }), /not empty/);
});
test('empty restore preserves application data and explicit admin grants, revoking restored sessions only', async () => {
  const source = seeded(), backup = createCloudBackup(source, 1, [{ kind: 'legacy_metadata', key: 'synthetic', payload: { kept: true } }]), store = new Store();
  store.durable.cloudUploadIntents = [];
  const result = await restoreCloudBackup(store, backup, { confirmEmptyRestore: true });
  assert.equal(result.revokedSessions, 1); assert.equal(result.collections.users, 1); assert.equal(store.durable.userSessions[0].status, 'revoked'); assert.equal(store.durable.userSessions[0].revokeReason, 'cloud_backup_restore'); assert.equal(store.durable.users[0].systemRole, 'ADMIN'); assert.deepEqual(store.durable.extension, source.extension); assert.equal(store.metadata.get('jwt_secret'), 'never-export-this-signing-key'); assert.equal(backup.state.userSessions[0].status, 'active'); assert.equal(store.archives[0].payload.kept, true);
});
test('restore commit failure leaves durable state, archives and identity metadata intact', async () => {
  const store = new Store(); store.failure = true; const before = structuredClone(store.durable);
  await assert.rejects(restoreCloudBackup(store, createCloudBackup(seeded(), 1), { confirmEmptyRestore: true }), /commit failure/); assert.deepEqual(store.durable, before); assert.equal(store.archives.length, 0); assert.equal(store.metadata.has('identity_stage3_v1'), false); assert.equal(store.active, false);
});
test('managed Blob metadata requires independent store confirmation and local byte metadata cannot restore', async () => {
  const state = seeded(); state.files.push({ id: 'synthetic-file', managed: true, storageBackend: 'vercel-blob', storageKey: 'synthetic-key' }); const backup = createCloudBackup(state, 1), store = new Store();
  await assert.rejects(restoreCloudBackup(store, backup, { confirmEmptyRestore: true }), /confirm-blob-store/); assert.equal(store.rollbacks, 0);
  await restoreCloudBackup(store, backup, { confirmEmptyRestore: true, confirmBlobStore: true }); assert.equal(store.durable.files[0].storageKey, 'synthetic-key');
  state.files[0].storageBackend = 'local'; await assert.rejects(restoreCloudBackup(new Store(), createCloudBackup(state, 1), { confirmEmptyRestore: true, confirmBlobStore: true }), /separate verified migration/);
});
test('private backup output rejects source paths, relative paths and existing files', () => {
  const backup = createCloudBackup(seeded(), 1); assert.throws(() => privateBackupPath(path.join(root, 'private.json'), root), /outside/); assert.throws(() => privateBackupPath('relative.json', root), /absolute/);
  const destination = path.join(temp, 'private.json'); writePrivateBackup(destination, backup, root); assert.deepEqual(JSON.parse(fs.readFileSync(destination, 'utf8')), backup); assert.throws(() => writePrivateBackup(destination, backup, root), { code: 'EEXIST' });
});
test('CLI rejects unknown, duplicate and unconfirmed operations before database access', async () => {
  for (const args of [['wipe'], ['restore', '--file', 'x'], ['export', '--out', 'x'], ['status', '--force'], ['restore', '--confirm-empty-restore', '--file', 'x', '--file', 'y']]) await assert.rejects(main(args));
});
