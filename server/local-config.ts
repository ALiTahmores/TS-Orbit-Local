import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

// This module is imported by the database as well as the server: env must load
// before either singleton is initialized (ES modules evaluate imports first).
const rootDir = path.resolve(process.env.PROJECT_ROOT || process.cwd());
dotenv.config({ path: path.join(rootDir, '.env'), quiet: true });
const host = process.env.HOST || '127.0.0.1';
if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !(host === '0.0.0.0' && process.env.ALLOW_NETWORK_ACCESS === 'true')) {
  throw new Error('HOST must be loopback; 0.0.0.0 requires explicit ALLOW_NETWORK_ACCESS=true.');
}
const portValue = process.env.PORT || '3000';
if (!/^\d+$/.test(portValue) || Number(portValue) < 1 || Number(portValue) > 65535) {
  throw new Error('PORT must be an integer from 1 through 65535.');
}
const port = Number(portValue);
const expectedOrigin = `http://${host === '::1' ? '[::1]' : host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`;
const appOrigin = process.env.APP_ORIGIN || expectedOrigin;
const originUrl = new URL(appOrigin);
if (!['http:', 'https:'].includes(originUrl.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(originUrl.hostname) || originUrl.origin !== appOrigin) {
  throw new Error('APP_ORIGIN must be an exact loopback HTTP(S) origin without a path.');
}
const dataDir = path.resolve(rootDir, process.env.DATA_DIR || 'data');
export function rejectDataSymlinks(candidate: string): void {
  let current = path.resolve(candidate);
  while (true) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('DATA_DIR and data files cannot use symbolic links or junctions.');
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}
rejectDataSymlinks(dataDir);
const distDir = path.join(rootDir, 'dist');
const publicDir = path.join(rootDir, 'public');
const contains = (parent: string, child: string) => {
  const relative = path.relative(parent.toLowerCase(), child.toLowerCase());
  return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
};
if (contains(dataDir, rootDir) || contains(publicDir, dataDir)) {
  throw new Error('DATA_DIR cannot be the project root, its ancestor, or a public asset directory.');
}
if (dataDir.toLowerCase() === distDir.toLowerCase() || dataDir.toLowerCase().startsWith(distDir.toLowerCase() + path.sep)) {
  throw new Error('DATA_DIR must be outside the build output.');
}
export const config = Object.freeze({ rootDir, host, port, appOrigin, dataDir,
  dbPath: path.join(dataDir, 'db.json'), legacyDbPath: path.join(dataDir, 'db.json'),
  sqlitePath: path.join(dataDir, 'orbit.sqlite'), clientDir: path.join(distDir, 'client') });

export function getJwtSecret(): string {
  const secretPath = path.join(dataDir, 'jwt-secret');
  rejectDataSymlinks(secretPath);
  rejectDataSymlinks(config.sqlitePath);
  if (!fs.existsSync(config.sqlitePath)) throw new Error('Initialize the SQLite database before loading credentials.');
  const database = new DatabaseSync(config.sqlitePath);
  database.exec('PRAGMA busy_timeout=5000');
  try {
  const stored = database.prepare("SELECT value FROM metadata WHERE key='jwt_secret'").get() as any;
  if (stored) {
    if (!/^[a-f0-9]{96}$/.test(stored.value)) throw new Error('Invalid signing secret in SQLite; restore a backup.');
    return stored.value;
  }
  if (!fs.existsSync(secretPath)) {
    fs.writeFileSync(secretPath, randomBytes(48).toString('hex'), { flag: 'wx', mode: 0o600 });
  }
  const secret = fs.readFileSync(secretPath, 'utf8').trim();
  if (!/^[a-f0-9]{96}$/.test(secret)) throw new Error('Invalid persisted JWT secret; restore it from backup.');
  database.prepare("INSERT INTO metadata(key,value) VALUES ('jwt_secret',?)").run(secret);
  return secret;
  } finally { database.close(); }
}

export function redactSensitive(value: any): any {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
      /password|passwd|token|secret|authorization|cookie|api.?key|recovery.?code|verification.?code/i.test(key)
        ? '[REDACTED]' : redactSensitive(item)]));
  }
  return value;
}

export function validatePassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 12 && Buffer.byteLength(value, 'utf8') <= 72;
}

const lockPath = dataDir + '.lock';
let ownsDataLock = false;
export function releaseDataLock(): void {
  if (ownsDataLock && fs.existsSync(lockPath) && fs.readFileSync(lockPath, 'utf8') === String(process.pid)) fs.unlinkSync(lockPath);
  ownsDataLock = false;
}

export function acquireDataLock(options: { allowPendingRestore?: boolean } = {}): void {
  if (ownsDataLock) return;
  rejectDataSymlinks(dataDir);
  rejectDataSymlinks(lockPath);
  rejectDataSymlinks(config.sqlitePath);
  // A still-running previous JSON version must not be migrated from underneath
  // its writer. Its historical lock is inside DATA_DIR.
  const legacyLock = path.join(dataDir, '.database.lock');
  rejectDataSymlinks(legacyLock);
  if (fs.existsSync(legacyLock)) {
    const legacyPid = Number(fs.readFileSync(legacyLock, 'utf8'));
    if (!Number.isInteger(legacyPid) || legacyPid <= 0) throw new Error('Invalid legacy database lock; inspect it manually.');
    try { process.kill(legacyPid, 0); throw new Error('Database already in use by the previous version. Stop it before migration.'); }
    catch (error: any) { if (error.code !== 'ESRCH') throw error; }
  }
  fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  if (fs.existsSync(lockPath)) {
    const pid = Number(fs.readFileSync(lockPath, 'utf8'));
    if (!Number.isInteger(pid) || pid <= 0) throw new Error('Invalid database lock; inspect it manually.');
    let active = true;
    try { process.kill(pid, 0); } catch (error: any) {
      if (error.code === 'ESRCH') active = false;
      else throw error;
    }
    if (active) throw new Error('Database already in use. Stop TS-Orbit before account setup/recovery or starting another server.');
    fs.unlinkSync(lockPath);
  }
  fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx', mode: 0o600 });
  ownsDataLock = true;
  process.once('exit', releaseDataLock);
  if (fs.existsSync(dataDir + '.restore-pending')) {
    if (!options.allowPendingRestore) {
      releaseDataLock();
      throw new Error('An interrupted restore needs recovery. Run npm run db -- recover-restore before starting TS-Orbit.');
    }
    return;
  }
  fs.mkdirSync(dataDir, { recursive: true });
}
