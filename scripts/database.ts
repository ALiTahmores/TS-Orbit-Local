import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { acquireDataLock, config } from '../server/local-config.ts';
import { analyzeLegacy, importLegacyFile, SqliteStore, validateDatabase } from '../server/db/store.ts';
import { validateAssetContents } from '../server/db/assets.ts';
if (config.cloud) throw new Error('SQLite maintenance is local only. Use npm run cloud:db for PostgreSQL.');

type Manifest = { format: 'ts-orbit-private-backup'; version: 1; createdAt: string;
  database: ReturnType<typeof validateDatabase>; files: { path: string; bytes: number; sha256: string }[] };
type RestoreMarker = { current: string; staging: string; previous: string; source: string; createdAt: string;
  previousFiles: Manifest['files']; targetFiles: Manifest['files'] };
const [command, ...arguments_] = process.argv.slice(2);
const options = new Map<string, string | boolean>();
for (let index = 0; index < arguments_.length; index++) {
  const option = arguments_[index];
  if (!option.startsWith('--') || options.has(option)) throw new Error('Invalid or duplicate option: ' + option);
  if (option === '--dry-run') options.set(option, true);
  else {
    const value = arguments_[++index];
    if (!value || value.startsWith('--')) throw new Error('Missing value for ' + option);
    options.set(option, value);
  }
}
const checksum = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const contains = (parent: string, child: string) => {
  const relative = path.relative(parent.toLowerCase(), child.toLowerCase());
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
};
function rejectSymlinkChain(file: string) {
  let current = path.resolve(file);
  while (true) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('Symbolic links are not allowed in maintenance paths: ' + current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
function required(option: string) {
  const value = options.get(option);
  if (typeof value !== 'string') throw new Error('Required option: ' + option);
  const resolved = path.resolve(config.rootDir, value);
  rejectSymlinkChain(resolved);
  return resolved;
}
function filesIn(directory: string, prefix = ''): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const actual = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Backup data contains a symbolic link: ' + relative);
    if (entry.isDirectory()) files.push(...filesIn(actual, relative));
    else if (entry.isFile()) files.push(relative);
    else throw new Error('Unsupported file type: ' + relative);
  }
  return files.sort();
}
function fileManifest(directory: string): Manifest['files'] {
  return filesIn(directory).map(relative => {
    const file = path.join(directory, relative);
    return { path: relative, bytes: fs.statSync(file).size, sha256: checksum(file) };
  });
}
function verifyFiles(directory: string, expected: Manifest['files'], restoredTarget = false) {
  if (!Array.isArray(expected)) throw new Error('Incomplete interrupted restore metadata.');
  const actual = fileManifest(directory);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Interrupted restore data differs from its recorded hashes: ' + directory);
  if (actual.some(item => item.path === 'orbit.sqlite')) {
    validateDatabase(path.join(directory, 'orbit.sqlite'));
    // Previous data may be precisely the broken content this restore repairs.
    // Its recorded bytes must remain unchanged; only the restored target must
    // satisfy the new content-to-metadata integrity check.
    if (restoredTarget) validateAssetContents(directory);
  }
}
function externalDestination(option: string) {
  const destination = required(option);
  if (contains(config.dataDir, destination) || contains(destination, config.dataDir)) throw new Error('Destination must be outside DATA_DIR and cannot be its ancestor.');
  if (fs.existsSync(destination)) throw new Error('Destination already exists; refusing to overwrite it.');
  return destination;
}
function atomicOutput(destination: string, contents: string) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = destination + '.tmp-' + randomUUID();
  fs.writeFileSync(temporary, contents, { flag: 'wx', mode: 0o600 });
  try {
    // Link provides exclusive publication rather than rename's overwrite semantics.
    fs.linkSync(temporary, destination);
  } finally { fs.unlinkSync(temporary); }
}
function backup() {
  const destination = externalDestination('--output');
  rejectSymlinkChain(config.dataDir);
  rejectSymlinkChain(config.dataDir + '.lock');
  acquireDataLock();
  const status = validateDatabase(config.sqlitePath);
  validateAssetContents(config.dataDir);
  const staging = destination + '.tmp-' + randomUUID();
  fs.mkdirSync(path.join(staging, 'data'), { recursive: true, mode: 0o700 });
  let source: DatabaseSync | undefined;
  try {
    source = new DatabaseSync(config.sqlitePath);
    source.exec(`VACUUM INTO '${path.join(staging, 'data', 'orbit.sqlite').replace(/'/g, "''")}'`);
    source.close(); source = undefined;
    for (const relative of filesIn(config.dataDir)) {
      if (relative === 'orbit.sqlite' || relative === 'orbit.sqlite-wal' || relative === 'orbit.sqlite-shm'
        || relative.startsWith('files/staging/') || relative === '.database.lock' || /(^|\/)\.database\.lock$|\.tmp(?:-|$)/.test(relative)) continue;
      const target = path.join(staging, 'data', relative);
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      fs.copyFileSync(path.join(config.dataDir, relative), target, fs.constants.COPYFILE_EXCL);
    }
    const manifest: Manifest = { format: 'ts-orbit-private-backup', version: 1,
      createdAt: new Date().toISOString(), database: { ...status, path: 'orbit.sqlite' },
      files: fileManifest(path.join(staging, 'data')) };
    validateDatabase(path.join(staging, 'data', 'orbit.sqlite'));
    validateAssetContents(path.join(staging, 'data'));
    fs.writeFileSync(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
    fs.renameSync(staging, destination);
    console.log(JSON.stringify({ backup: destination, files: manifest.files.length, private: true,
      warning: 'Contains credentials, JWT secret, and application data. Keep private.' }, null, 2));
  } catch (error) {
    source?.close();
    // Retain failed staging for inspection; never remove application data.
    throw error;
  }
}
function validateBackup(source: string) {
  rejectSymlinkChain(source);
  const rootFiles = filesIn(source);
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8')) as Manifest;
  if (manifest.format !== 'ts-orbit-private-backup' || manifest.version !== 1 || !Array.isArray(manifest.files)) throw new Error('Unsupported backup manifest.');
  const seen = new Set<string>();
  for (const item of manifest.files) {
    if (!item || typeof item.path !== 'string' || item.path.includes('\\') || item.path.includes(':')
      || item.path.startsWith('/') || item.path.split('/').some(segment => !segment || segment === '.' || segment === '..')
      || item.path === '.database.lock' || item.path.endsWith('-wal') || item.path.endsWith('-shm')
      || seen.has(item.path) || !/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isSafeInteger(item.bytes) || item.bytes < 0) throw new Error('Unsafe or invalid backup file entry.');
    seen.add(item.path);
    const actual = path.join(source, 'data', item.path);
    rejectSymlinkChain(actual);
    if (!fs.statSync(actual).isFile() || fs.statSync(actual).size !== item.bytes || checksum(actual) !== item.sha256) throw new Error('Backup checksum mismatch: ' + item.path);
  }
  if (!seen.has('orbit.sqlite')) throw new Error('Backup lacks its database.');
  const expected = ['manifest.json', ...manifest.files.map(item => 'data/' + item.path)].sort();
  if (JSON.stringify(rootFiles) !== JSON.stringify(expected)) throw new Error('Backup contains unlisted files.');
  const status = validateDatabase(path.join(source, 'data', 'orbit.sqlite'));
  validateAssetContents(path.join(source, 'data'));
  if (status.schemaVersion !== manifest.database?.schemaVersion
    || JSON.stringify(status.collections) !== JSON.stringify(manifest.database?.collections)
    || status.quarantineCount !== manifest.database?.quarantineCount || status.importCount !== manifest.database?.importCount) throw new Error('Backup database metadata differs from its manifest.');
  const secret = seen.has('jwt-secret') ? fs.readFileSync(path.join(source, 'data', 'jwt-secret'), 'utf8').trim() : undefined;
  if (secret !== undefined && !/^[a-f0-9]{96}$/.test(secret)) throw new Error('Backup contains an invalid JWT secret.');
  return { status, manifest };
}
function restore() {
  const source = required('--source');
  if (contains(config.dataDir, source) || contains(source, config.dataDir)) throw new Error('Backup must be outside DATA_DIR.');
  const { status, manifest } = validateBackup(source); // No live data is touched before full validation.
  rejectSymlinkChain(config.dataDir);
  rejectSymlinkChain(config.dataDir + '.lock');
  acquireDataLock();
  const staging = config.dataDir + '.restore-' + randomUUID();
  const previous = config.dataDir + '.previous-' + randomUUID();
  fs.cpSync(path.join(source, 'data'), staging, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
  for (const item of manifest.files) {
    const copied = path.join(staging, item.path);
    if (fs.statSync(copied).size !== item.bytes || checksum(copied) !== item.sha256) throw new Error('Backup changed while restoring: ' + item.path);
  }
  if (JSON.stringify(filesIn(staging)) !== JSON.stringify(manifest.files.map(item => item.path).sort())) throw new Error('Unexpected copied backup files.');
  validateDatabase(path.join(staging, 'orbit.sqlite'));
  validateAssetContents(staging);
  const pending = config.dataDir + '.restore-pending';
  const descriptor = fs.openSync(pending, 'wx', 0o600);
  try {
    const marker: RestoreMarker = { current: config.dataDir, staging, previous, source,
      createdAt: new Date().toISOString(), previousFiles: fileManifest(config.dataDir), targetFiles: manifest.files };
    fs.writeFileSync(descriptor, JSON.stringify(marker, null, 2));
    fs.fsyncSync(descriptor);
  } finally { fs.closeSync(descriptor); }
  try { fs.renameSync(config.dataDir, previous); }
  catch (error) { fs.unlinkSync(pending); throw error; }
  try { fs.renameSync(staging, config.dataDir); }
  catch (error) {
    fs.renameSync(previous, config.dataDir);
    fs.unlinkSync(pending);
    throw error;
  }
  fs.unlinkSync(pending);
  console.log(JSON.stringify({ restored: config.dataDir, preservedPreviousData: previous, status }, null, 2));
}
function recoverRestore() {
  const pending = config.dataDir + '.restore-pending';
  rejectSymlinkChain(pending);
  const marker = JSON.parse(fs.readFileSync(pending, 'utf8')) as RestoreMarker;
  const canonical = (value: string) => path.resolve(value).toLowerCase();
  const sibling = (value: string, suffix: string) => {
    if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error('Invalid interrupted restore path.');
    const prefix = config.dataDir + suffix;
    const identifier = value.slice(prefix.length);
    if (!canonical(value).startsWith(canonical(prefix)) || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(identifier)
      || canonical(value) !== canonical(prefix + identifier)) throw new Error('Invalid interrupted restore sibling path.');
    rejectSymlinkChain(value);
  };
  if (typeof marker.current !== 'string' || canonical(marker.current) !== canonical(config.dataDir)) throw new Error('Restore marker belongs to another DATA_DIR.');
  sibling(marker.staging, '.restore-'); sibling(marker.previous, '.previous-');
  rejectSymlinkChain(config.dataDir); rejectSymlinkChain(config.dataDir + '.lock');
  acquireDataLock({ allowPendingRestore: true });
  const currentExists = fs.existsSync(config.dataDir);
  const previousExists = fs.existsSync(marker.previous);
  const stagingExists = fs.existsSync(marker.staging);
  let recovered: string;
  if (!currentExists && previousExists) {
    verifyFiles(marker.previous, marker.previousFiles);
    fs.renameSync(marker.previous, config.dataDir);
    recovered = 'original data restored after interrupted publication';
  } else if (currentExists && !previousExists) {
    verifyFiles(config.dataDir, marker.previousFiles);
    recovered = 'publication aborted; original data retained';
  } else if (currentExists && previousExists && !stagingExists) {
    verifyFiles(config.dataDir, marker.targetFiles, true);
    verifyFiles(marker.previous, marker.previousFiles);
    recovered = 'completed publication verified; previous data retained';
  } else throw new Error('Ambiguous interrupted restore; all directories retained for manual inspection.');
  fs.unlinkSync(pending);
  console.log(JSON.stringify({ recovered, data: config.dataDir, preservedStaging: stagingExists ? marker.staging : undefined,
    preservedPreviousData: fs.existsSync(marker.previous) ? marker.previous : undefined }, null, 2));
}
function run() {
  const allowed: Record<string, string[]> = { status: [], 'dry-run': ['--source'], import: ['--source', '--dry-run'],
    export: ['--output'], backup: ['--output'], restore: ['--source'], 'recover-restore': [] };
  if (!command || !allowed[command]) throw new Error('Usage: npm run db -- status | dry-run --source FILE | import --source FILE [--dry-run] | export --output FILE | backup --output DIR | restore --source DIR | recover-restore');
  for (const option of options.keys()) if (!allowed[command].includes(option)) throw new Error('Unsupported option: ' + option);
  if (command === 'dry-run' || (command === 'import' && options.has('--dry-run'))) {
    console.log(JSON.stringify(analyzeLegacy(fs.readFileSync(required('--source'), 'utf8')).report, null, 2));
    return;
  }
  if (command === 'backup') return backup();
  if (command === 'restore') return restore();
  if (command === 'recover-restore') return recoverRestore();
  rejectSymlinkChain(config.dataDir);
  rejectSymlinkChain(config.dataDir + '.lock');
  acquireDataLock();
  if (command === 'status') {
    if (!fs.existsSync(config.sqlitePath)) { console.log(JSON.stringify({ exists: false, path: config.sqlitePath })); return; }
    console.log(JSON.stringify(validateDatabase(config.sqlitePath), null, 2)); return;
  }
  if (command === 'import') {
    console.log(JSON.stringify(importLegacyFile(required('--source'), config.sqlitePath), null, 2)); return;
  }
  const output = externalDestination('--output');
  validateDatabase(config.sqlitePath);
  const store = new SqliteStore(config.sqlitePath);
  try { atomicOutput(output, JSON.stringify(store.loadState(), null, 2)); }
  finally { store.close(); }
  console.log(JSON.stringify({ exported: output, private: true, warning: 'Contains credentials and all application records. Keep private.' }));
}
try { run(); }
catch (error) { console.error('Database maintenance failed: ' + (error instanceof Error ? error.message : String(error))); process.exitCode = 1; }
