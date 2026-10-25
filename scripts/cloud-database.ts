import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PostgresStore, CLOUD_SCHEMA_VERSION, type CloudState, type ArchiveKind } from '../server/cloud/postgres.ts';
import { collectionNames } from '../server/db/schema.ts';
import { inspectState } from '../server/db/store.ts';

const FORMAT = 'ts-orbit-private-postgres-backup';
const ARCHIVES = new Set(['quarantine', 'legacy_allowlist', 'import_sources', 'legacy_metadata']);
const NOTICE = 'PRIVATE: contains account password hashes and application data. Signing keys and Blob bytes are excluded. Never publish this file. Restore requires independent verification of the private Blob store.';
type Archive = { kind: ArchiveKind; key: string; payload: unknown };
type Backup = {
  format: string; formatVersion: number; schemaVersion: number; createdAt: string; sourceRevision: number;
  sensitiveNotice: string; state: CloudState; archives: Archive[]; integritySha256: string;
};
function canonical(value: any): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function jsonOnly(value: any, seen = new WeakSet<object>()): void {
  if (value === undefined || ['bigint', 'function', 'symbol'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) throw new Error('Backup contains a non-JSON value.');
  if (value && typeof value === 'object') {
    if (seen.has(value)) throw new Error('Backup contains a cycle.');
    seen.add(value); for (const child of Object.values(value)) jsonOnly(child, seen); seen.delete(value);
  }
}
function digest(value: object): string { return createHash('sha256').update(canonical(value)).digest('hex'); }
function validateState(state: CloudState) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('Invalid backup state.');
  for (const collection of collectionNames) if (!Array.isArray(state[collection])) throw new Error('Missing or invalid backup collection: ' + collection);
  return inspectState(state);
}
export function createCloudBackup(state: CloudState, sourceRevision: number, archives: Archive[] = []): Backup {
  jsonOnly(state); validateState(state);
  const content = { format: FORMAT, formatVersion: 1, schemaVersion: CLOUD_SCHEMA_VERSION, createdAt: new Date().toISOString(), sourceRevision, sensitiveNotice: NOTICE, state: structuredClone(state), archives: structuredClone(archives) };
  const backup = { ...content, integritySha256: digest(content) };
  validateCloudBackup(backup, { allowExistingAnomalies: true }); return backup;
}
/** Digest detects accidental corruption; it is not an authenticity signature.
 * Operators must trust the private backup's origin before restoring it. */
export function validateCloudBackup(value: any, options: { allowExistingAnomalies?: boolean } = {}): Backup {
  jsonOnly(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid backup envelope.');
  const allowed = ['format', 'formatVersion', 'schemaVersion', 'createdAt', 'sourceRevision', 'sensitiveNotice', 'state', 'archives', 'integritySha256'];
  if (Object.keys(value).some(key => !allowed.includes(key)) || allowed.some(key => !Object.hasOwn(value, key))) throw new Error('Unknown or missing backup envelope field.');
  if (value.format !== FORMAT || value.formatVersion !== 1 || value.schemaVersion !== CLOUD_SCHEMA_VERSION) throw new Error('Unsupported backup/schema version; automatic conversion is disabled.');
  if (!Number.isSafeInteger(value.sourceRevision) || value.sourceRevision < 0 || !Number.isFinite(Date.parse(value.createdAt)) || value.sensitiveNotice !== NOTICE) throw new Error('Invalid backup metadata.');
  if (!Array.isArray(value.archives)) throw new Error('Invalid backup archives.');
  const keys = new Set<string>();
  for (const archive of value.archives) {
    if (!archive || !ARCHIVES.has(archive.kind) || typeof archive.key !== 'string' || !archive.key || archive.key.length > 500 || !Object.hasOwn(archive, 'payload') || Object.keys(archive).some(key => !['kind', 'key', 'payload'].includes(key))) throw new Error('Invalid archive entry.');
    const key = JSON.stringify([archive.kind, archive.key]); if (keys.has(key)) throw new Error('Duplicate archive entry.'); keys.add(key);
  }
  const { integritySha256, ...content } = value;
  if (typeof integritySha256 !== 'string' || integritySha256 !== digest(content)) throw new Error('Backup integrity check failed.');
  const inspection = validateState(value.state);
  if (inspection.issues.length && !options.allowExistingAnomalies) throw new Error('Backup has unresolved identity/relation anomalies; repair and validate it before restore.');
  return value;
}
export function privateBackupPath(file: string, projectRoot: string): string {
  if (!path.isAbsolute(file)) throw new Error('Backup output must be an absolute private path.');
  const resolved = path.resolve(file), root = path.resolve(projectRoot);
  const relative = path.relative(root.toLowerCase(), resolved.toLowerCase());
  if (relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))) throw new Error('Backups must be outside the project/source tree.');
  let current = resolved;
  while (true) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('Backup paths cannot contain symbolic links or junctions.');
    const parent = path.dirname(current); if (parent === current) break; current = parent;
  }
  return resolved;
}
export function writePrivateBackup(file: string, backup: Backup, projectRoot: string): void {
  const output = privateBackupPath(file, projectRoot);
  // Exclusive creation prevents replacing an existing backup or another file.
  fs.writeFileSync(output, JSON.stringify(backup, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
export async function exportCloudBackup(store: PostgresStore): Promise<Backup> {
  await store.begin();
  try {
    const state = await store.loadState(), revision = await store.getRevision();
    const archives = (await store.transactionQuery<Archive>('SELECT kind,key,payload FROM orbit_archives ORDER BY kind,key')).rows;
    return createCloudBackup(state, revision, archives);
  } finally { await store.rollback(); }
}
export async function restoreCloudBackup(store: PostgresStore, input: unknown, options: { confirmEmptyRestore: boolean; confirmBlobStore?: boolean }): Promise<{ collections: Record<string, number>; revokedSessions: number }> {
  if (!options.confirmEmptyRestore) throw new Error('Restore requires --confirm-empty-restore.');
  const backup = validateCloudBackup(input);
  const blobVersions = [...backup.state.files, ...backup.state.fileVersions].filter(row => row?.storageBackend === 'vercel-blob');
  if (blobVersions.length && !options.confirmBlobStore) throw new Error('Blob bytes are not in this backup. Verify the matching private Blob store, then pass --confirm-blob-store.');
  if ([...backup.state.files, ...backup.state.fileVersions].some(row => row?.managed && row?.storageBackend !== 'vercel-blob')) throw new Error('Local managed file bytes require a separate verified migration to Blob before cloud restore.');
  await store.begin();
  try {
    const current = await store.loadState();
    const extensions = Object.keys(current).filter(key => !collectionNames.includes(key as any) && key !== 'settings' && canonical(current[key]) !== '[]' && canonical(current[key]) !== '{}');
    const customizedSettings = current.settings !== undefined && canonical(current.settings) !== canonical({ theme: 'dark', require2FA: false });
    if (collectionNames.some(name => current[name].length > 0) || extensions.length || customizedSettings || (await store.transactionQuery('SELECT kind,key,payload FROM orbit_archives LIMIT 1')).rows.length) throw new Error('Restore destination is not empty; overwrite is disabled.');
    const state = structuredClone(backup.state), at = new Date().toISOString(); let revokedSessions = 0;
    for (const session of state.userSessions) if (session.status === 'active') { session.status = 'revoked'; session.revokedAt = at; session.revokeReason = 'cloud_backup_restore'; revokedSessions++; }
    await store.saveState(state);
    for (const archive of backup.archives) await store.putArchive(archive.kind, archive.key, archive.payload);
    // No source signing key, delivery cursor, rate limit, or presence lease is
    // restored. Preserve explicit systemRole grants and suppress legacy grants.
    await store.setMetadata('identity_stage3_v1', { version: 1, completedAt: at, source: 'validated_private_backup' });
    await store.commit(); return { collections: Object.fromEntries(collectionNames.map(name => [name, state[name].length])), revokedSessions };
  } catch (error) { await store.rollback(); throw error; }
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const command = args.shift();
  if (!['status', 'export', 'restore'].includes(command || '')) throw new Error('Usage: cloud:db -- status | export --out ABSOLUTE_PATH --confirm-sensitive-backup | restore --file PATH --confirm-empty-restore [--confirm-blob-store]');
  const allowedFlags = command === 'status' ? [] : command === 'export' ? ['--out', '--confirm-sensitive-backup'] : ['--file', '--confirm-empty-restore', '--confirm-blob-store'];
  const flags = new Map<string, string | boolean>();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]; if (!allowedFlags.includes(flag) || flags.has(flag)) throw new Error('Unknown/duplicate option.');
    if (flag === '--out' || flag === '--file') { const value = args[++index]; if (!value || value.startsWith('--')) throw new Error('Missing backup path.'); flags.set(flag, value); } else flags.set(flag, true);
  }
  if (command === 'export' && (!flags.get('--out') || !flags.get('--confirm-sensitive-backup'))) throw new Error('Export requires --out and --confirm-sensitive-backup. Backup contains private account and application data.');
  if (command === 'restore' && (!flags.get('--file') || !flags.get('--confirm-empty-restore'))) throw new Error('Restore requires --file and --confirm-empty-restore.');
  const { config } = await import('../server/local-config.ts');
  if (!config.cloud) throw new Error('Cloud maintenance requires ORBIT_STORAGE=postgres; SQLite uses npm run db.');
  // Parse/validate all restore input before connecting or migrating any target.
  const backup = command === 'restore' ? validateCloudBackup(JSON.parse(fs.readFileSync(path.resolve(String(flags.get('--file'))), 'utf8'))) : undefined;
  if (command === 'export') privateBackupPath(String(flags.get('--out')), config.rootDir);
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: config.databaseUrl, max: 2, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 10_000 });
  const store = new PostgresStore({ pool, validateState(next) { const inspected = validateState(next); if (inspected.issues.length) throw Object.assign(new Error('Invalid cloud state.'), { code: 'DATA_VALIDATION_FAILED' }); return inspected; } });
  try {
    await store.initialize();
    if (command === 'export') { const data = await exportCloudBackup(store); writePrivateBackup(String(flags.get('--out')), data, config.rootDir); console.log(JSON.stringify({ exported: true, schemaVersion: data.schemaVersion, revision: data.sourceRevision, warning: NOTICE })); }
    else if (command === 'restore') console.log(JSON.stringify(await restoreCloudBackup(store, backup, { confirmEmptyRestore: true, confirmBlobStore: flags.has('--confirm-blob-store') })));
    else {
      await store.begin(); try { const state = await store.loadState(); console.log(JSON.stringify({ schemaVersion: CLOUD_SCHEMA_VERSION, revision: await store.getRevision(), collections: Object.fromEntries(collectionNames.map(name => [name, state[name].length])), validationIssues: validateState(state).issues.length, warning: 'Database snapshot only; Blob bytes need independent backup and verification.' })); } finally { await store.rollback(); }
    }
  } finally { await store.close(); await pool.end(); }
}
if (/^cloud-database\.(?:ts|cjs)$/.test(path.basename(process.argv[1] || ''))) {
  void main().catch(error => { console.error('Cloud maintenance failed:', error instanceof SyntaxError ? 'Invalid backup JSON.' : error?.code || error?.message || 'storage error'); process.exitCode = 1; });
}
