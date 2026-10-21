import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { APPLICATION_ID, SCHEMA_VERSION, collectionNames, migrations } from './schema.ts';
export { collectionNames, APPLICATION_ID, SCHEMA_VERSION } from './schema.ts';

export type ApplicationState = Record<string, any>;
type Issue = { collection: string; index: number; id?: string; field?: string; reason: string; target?: string; signature: string };
export type ImportReport = { sourceHash: string; sourceBytes: number; collections: Record<string, number>; issues: Issue[]; issueCount: number; warnings: { collection: string; index: number; field: string; reason: string }[]; imported?: boolean; alreadyImported?: boolean };
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const json = (value: any) => JSON.stringify(value);
const stringId = (value: any): string | null => typeof value === 'string' && value.trim().length > 0 ? value : null;
const key = (collection: string, id: string) => json([collection, id]);

export function emptyState(): ApplicationState {
  return Object.fromEntries([...collectionNames.map(name => [name, []]), ['settings', { theme: 'dark', require2FA: false }]]);
}
function normalizeState(input: any): ApplicationState {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid database root; no data changed.');
  const state = { ...emptyState(), ...input };
  for (const name of collectionNames) if (!Array.isArray(state[name])) throw new Error(`Invalid collection: ${name}; no data changed.`);
  // JSON is the persisted interchange contract; reject cycles/nonfinite values rather
  // than silently converting them during a write.
  const check = (value: any) => {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Nonfinite database value.');
    if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') throw new Error('Non-JSON database value.');
    if (value && typeof value === 'object') Object.values(value).forEach(check);
  };
  check(state);
  return JSON.parse(json(state));
}
// wpSites has always used projectId as its natural key, without an id column.
function recordId(collection: string, record: any): string | null {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  return stringId(record.id) || (collection === 'wpSites' ? stringId(record.projectId) : null);
}
const scalarReferences: Record<string, string> = {
  userId: 'users', ownerId: 'users', creatorId: 'users', createdById: 'users', uploadedById: 'users',
  senderId: 'users', recipientId: 'users', requestedById: 'users', approvedById: 'users',
  teamLeadId: 'users', workspaceId: 'workspaces', personalWorkspaceId: 'workspaces',
  organizationId: 'organizations', teamId: 'teams', projectId: 'projects', taskId: 'tasks',
  parentTaskId: 'tasks', departmentId: 'departments', conversationId: 'conversations',
  messageId: 'messages', moduleDefinitionId: 'moduleDefinitions', moduleInstanceId: 'moduleInstances',
  navigationGroupId: 'navigationGroups', sessionId: 'userSessions',
  definitionId: 'moduleDefinitions', groupId: 'navigationGroups', moduleId: 'moduleInstances',
  leaderId: 'users', leadId: 'users', assigneeId: 'users', writerId: 'users', reviewerId: 'users',
  fileId: 'files', currentVersionId: 'fileVersions', replyToMessageId:'messages',lastReadMessageId:'messages',targetTeamId:'teams',actorId:'users'
};
const arrayReferences: Record<string, string> = { assignedMemberIds: 'users', assignedTeamIds: 'teams', memberIds: 'users', dependencies: 'tasks' };
const domainReferenceFields = new Set(['definitionId','groupId','moduleId','leaderId','leadId','assigneeId','writerId','reviewerId']);
const assetReferenceFields = new Set(['fileId','currentVersionId']);
const collaborationReference = (field:string) => ['replyToMessageId','lastReadMessageId','targetTeamId','actorId','voiceNote.fileId'].includes(field) || /^attachments\[\d+\]\.(?:id|versionId)$/.test(field);
type Relation = { sourceCollection: string; sourceId: string; field: string; targetCollection: string; targetId: string };
function inspectState(state: ApplicationState) {
  const entities = new Map<string, { collection: string; id: string; index: number }>();
  const issues: Issue[] = [];
  const relations: Relation[] = [];
  const authIdentities = new Map<string, number>();
  const addIssue = (issue: Omit<Issue, 'signature'>, discriminator?: any) => {
    issues.push({ ...issue, signature: hash(json([issue.collection, issue.id ?? null, issue.field ?? null, issue.reason, issue.target ?? null, discriminator ?? null])) });
  };
  for (const collection of collectionNames) state[collection].forEach((record: any, index: number) => {
    const id = recordId(collection, record);
    if (!id) return addIssue({ collection, index, reason: 'invalid_identity' }, record);
    if (entities.has(key(collection, id))) return addIssue({ collection, index, id, reason: 'duplicate_identity' });
    entities.set(key(collection, id), { collection, id, index });
  });
  state.users.forEach((record: any, index: number) => {
    for (const field of ['email', 'username']) {
      if (typeof record?.[field] !== 'string' || !record[field].trim()) continue;
      const identity = `${field}:${record[field].toLowerCase().trim()}`;
      if (authIdentities.has(identity)) addIssue({ collection: 'users', index, id: recordId('users', record) || undefined, field, reason: 'duplicate_auth_identity' }, identity);
      else authIdentities.set(identity, index);
    }
  });
  for (const collection of collectionNames) state[collection].forEach((record: any, index: number) => {
    const id = recordId(collection, record);
    if (!id || !record || typeof record !== 'object') return;
    const addRef = (field: string, targetCollection: string, value: any) => {
      if (value === undefined || value === null || value === '') return;
      // Agency reports use a documented virtual scope rather than a department ID.
      if (collection === 'departmentReports' && field === 'departmentId' && value === 'AGENCY') return;
      const targetId = stringId(value);
      if (!targetId || !entities.has(key(targetCollection, targetId))) {
        addIssue({ collection, index, id, field, reason: targetId ? 'orphan_reference' : 'invalid_reference', target: typeof value === 'string' ? value : json(value) });
      } else if (entities.get(key(collection, id))?.index === index) {
        relations.push({ sourceCollection: collection, sourceId: id, field, targetCollection, targetId });
      }
    };
    for (const [field, target] of Object.entries(scalarReferences)) addRef(field, target, record[field]);
    for (const [field, target] of Object.entries(arrayReferences)) {
      if (record[field] !== undefined && !Array.isArray(record[field])) addRef(field, target, record[field]);
      else (record[field] || []).forEach((value: any, n: number) => addRef(`${field}[${n}]`, target, value));
    }
    if(collection==='messages'){
      if(Array.isArray(record.attachments))record.attachments.forEach((attachment:any,n:number)=>{
        if(attachment&&typeof attachment==='object'&&attachment.versionId){addRef('attachments['+n+'].id','files',attachment.id);addRef('attachments['+n+'].versionId','fileVersions',attachment.versionId);}
      });
      if(record.voiceNote?.fileId)addRef('voiceNote.fileId','files',record.voiceNote.fileId);
    }
    if (collection === 'users' && Array.isArray(record.memberships)) record.memberships.forEach((membership: any, n: number) => addRef(`memberships[${n}].workspaceId`, 'workspaces', membership?.workspaceId));
    if (collection === 'workspaces' && Array.isArray(record.members)) record.members.forEach((member: any, n: number) => addRef(`members[${n}].userId`, 'users', typeof member === 'string' ? member : member?.userId));
  });
  return { entities, issues, relations };
}
export function analyzeLegacy(raw: string | Buffer): { state: ApplicationState; report: ImportReport } {
  const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw, 'utf8');
  const state = normalizeState(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')));
  const { issues } = inspectState(state);
  const warnings: ImportReport['warnings'] = [];
  for (const name of collectionNames) state[name].forEach((record: any, index: number) => {
    for (const field of ['createdAt', 'updatedAt', 'timestamp', 'startDate', 'deadline']) {
      if (record?.[field] && !utcTimestamp(record[field])) warnings.push({ collection: name, index, field, reason: 'date_retained_without_utc_projection' });
    }
  });
  return { state, report: { sourceHash: hash(bytes), sourceBytes: bytes.length,
    collections: Object.fromEntries(collectionNames.map(name => [name, state[name].length])), issues, issueCount: issues.length, warnings } };
}
function utcTimestamp(value: any): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const [year, month, day, hour, minute, second] = value.slice(0, 19).split(/[-T:]/).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
function numericAmount(value: any): number | null {
  if (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value)) value = Number(value);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function verifyEngine(db: DatabaseSync): string {
  const version = String((db.prepare('SELECT sqlite_version() AS version').get() as any).version);
  const parts = version.split('.').map(Number);
  if (parts[0] < 3 || (parts[0] === 3 && (parts[1] < 51 || (parts[1] === 51 && parts[2] < 3)))) throw new Error(`SQLite ${version} is below required 3.51.3.`);
  return version;
}
function assertIntegrity(db: DatabaseSync) {
  const check = db.prepare('PRAGMA integrity_check').all() as any[];
  if (check.length !== 1 || check[0].integrity_check !== 'ok') throw new Error('SQLite integrity check failed; automatic reset is disabled.');
  if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('SQLite foreign-key check failed.');
}
function assertSchema(db: DatabaseSync) {
  const version = Number((db.prepare('PRAGMA user_version').get() as any).user_version);
  const applicationId = Number((db.prepare('PRAGMA application_id').get() as any).application_id);
  if (applicationId !== APPLICATION_ID || version !== SCHEMA_VERSION) throw new Error('Unsupported TS-Orbit database format/schema.');
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as any[];
  if (applied.length !== migrations.length || applied.some((row, i) => row.version !== migrations[i].version)) throw new Error('Incomplete SQLite schema migrations.');
  for (const name of collectionNames) db.prepare(`SELECT ordinal,entity_id,user_id,workspace_id,project_id,department_id,payload FROM "${name}" LIMIT 0`);
  for (const table of ['metadata','entity_registry','relation_registry','quarantine','legacy_allowlist','import_sources','state_properties']) db.prepare(`SELECT * FROM "${table}" LIMIT 0`);
}
function statusFor(db: DatabaseSync, filePath: string) {
  assertSchema(db); assertIntegrity(db);
  return { path: filePath, schemaVersion: SCHEMA_VERSION, sqliteVersion: verifyEngine(db), integrity: 'ok', foreignKeys: true,
    collections: Object.fromEntries(collectionNames.map(name => [name, Number((db.prepare(`SELECT count(*) AS n FROM "${name}"`).get() as any).n)])),
    quarantineCount: Number((db.prepare('SELECT count(*) AS n FROM quarantine').get() as any).n),
    importCount: Number((db.prepare('SELECT count(*) AS n FROM import_sources').get() as any).n) };
}
export function validateDatabase(filePath: string) {
  if (!fs.existsSync(filePath)) throw new Error('Database does not exist.');
  const db = new DatabaseSync(filePath, { readOnly: true });
  try { db.exec('PRAGMA foreign_keys=ON'); return statusFor(db, filePath); } finally { db.close(); }
}

export class SqliteStore {
  readonly database: DatabaseSync;
  readonly path: string;
  private transaction = false;
  constructor(filePath: string) {
    this.path = path.resolve(filePath);
    fs.mkdirSync(path.dirname(this.path), { recursive: true });
    const existed = fs.existsSync(this.path);
    this.database = new DatabaseSync(this.path);
    try {
      verifyEngine(this.database);
      this.database.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
      const tables = this.database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      if (existed || tables.length) assertSchema(this.database);
      else {
        this.database.exec('BEGIN IMMEDIATE');
        try {
          for (const migration of migrations) {
            this.database.exec(migration.sql);
            this.database.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(migration.version, new Date().toISOString());
          }
          this.database.exec(`PRAGMA application_id=${APPLICATION_ID}; PRAGMA user_version=${SCHEMA_VERSION}; COMMIT;`);
        } catch (error) { this.database.exec('ROLLBACK'); throw error; }
      }
      assertIntegrity(this.database);
      this.database.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    } catch (error) { this.database.close(); throw error; }
  }
  begin() { if (this.transaction) throw new Error('A database transaction is already active.'); this.database.exec('BEGIN IMMEDIATE'); this.transaction = true; }
  commit() { if (!this.transaction) throw new Error('No database transaction is active.'); this.database.exec('COMMIT'); this.transaction = false; }
  rollback() { if (this.transaction) { this.database.exec('ROLLBACK'); this.transaction = false; } }
  close() { this.rollback(); this.database.close(); }
  getStatus() { return statusFor(this.database, this.path); }
  getImportReports() { return (this.database.prepare('SELECT report FROM import_sources ORDER BY imported_at').all() as any[]).map(row => JSON.parse(row.report)); }
  loadState(): ApplicationState {
    const state: ApplicationState = Object.create(null);
    for (const row of this.database.prepare('SELECT key,payload FROM state_properties').all() as any[]) state[row.key] = JSON.parse(row.payload);
    for (const name of collectionNames) state[name] = (this.database.prepare(`SELECT payload FROM "${name}" ORDER BY ordinal`).all() as any[]).map(row => JSON.parse(row.payload));
    return normalizeState(state);
  }
  saveState(input: ApplicationState, options: { allowLegacy?: boolean } = {}) {
    const state = normalizeState(input);
    const inspection = inspectState(state);
    const counts = new Map<string, number>();
    for (const issue of inspection.issues) counts.set(issue.signature, (counts.get(issue.signature) || 0) + 1);
    const allowed = new Map((this.database.prepare('SELECT signature,occurrence_count FROM legacy_allowlist').all() as any[]).map(row => [row.signature, Number(row.occurrence_count)]));
    const upgradeReferences = !this.database.prepare("SELECT value FROM metadata WHERE key='domain_references_v1'").get();
    const upgradeAssets = !this.database.prepare("SELECT value FROM metadata WHERE key='asset_references_v1'").get();
    const upgradeCollaboration = !this.database.prepare("SELECT value FROM metadata WHERE key='collaboration_references_v1'").get();
    if (upgradeReferences || upgradeAssets || upgradeCollaboration) {
      // Newly declared references may already exist in older payloads. Preserve
      // only their persisted anomalies, never grant an allowance to new input.
      const historical = new Map<string, number>();
      for (const issue of inspectState(this.loadState()).issues) if ((upgradeReferences && domainReferenceFields.has(issue.field || '')) || (upgradeAssets && assetReferenceFields.has(issue.field || '')) || (upgradeCollaboration && collaborationReference(issue.field || ''))) historical.set(issue.signature, (historical.get(issue.signature) || 0) + 1);
      for (const [signature, count] of historical) allowed.set(signature, Math.max(allowed.get(signature) || 0, count));
    }
    if (!options.allowLegacy) for (const [signature, count] of counts) {
      if (count > (allowed.get(signature) || 0)) {
        const issue = inspection.issues.find(issue => issue.signature === signature)!;
        const error = new Error(`Invalid database relation/identity: ${issue.collection}[${issue.index}] ${issue.field || 'id'} (${issue.reason}).`) as any;
        error.code = 'DATA_VALIDATION_FAILED'; throw error;
      }
    }
    const owned = !this.transaction;
    if (owned) this.begin();
    try {
      const oldProperties = new Map((this.database.prepare('SELECT key,payload FROM state_properties').all() as any[]).map(row => [row.key, row.payload]));
      const properties = new Map(Object.entries(state).filter(([name]) => !(collectionNames as readonly string[]).includes(name)).map(([name, value]) => [name, json(value)]));
      for (const name of oldProperties.keys()) if (!properties.has(name)) this.database.prepare('DELETE FROM state_properties WHERE key=?').run(name);
      const propertyWrite = this.database.prepare('INSERT INTO state_properties VALUES (?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload');
      for (const [name, payload] of properties) if (oldProperties.get(name) !== payload) propertyWrite.run(name, payload);
      for (const name of collectionNames) {
        const existing = new Map((this.database.prepare(`SELECT ordinal,payload FROM "${name}"`).all() as any[]).map(row => [Number(row.ordinal), row.payload]));
        this.database.prepare(`DELETE FROM "${name}" WHERE ordinal>=?`).run(state[name].length);
        const insert = this.database.prepare(`INSERT INTO "${name}" VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(ordinal) DO UPDATE SET
          entity_id=excluded.entity_id,user_id=excluded.user_id,workspace_id=excluded.workspace_id,project_id=excluded.project_id,department_id=excluded.department_id,
          timestamp_utc=excluded.timestamp_utc,amount=excluded.amount,currency=excluded.currency,payload=excluded.payload`);
        state[name].forEach((record: any, index: number) => {
          const payload = json(record);
          if (existing.get(index) === payload) return;
          insert.run(index, recordId(name, record), stringId(record?.userId), stringId(record?.workspaceId), stringId(record?.projectId), stringId(record?.departmentId),
            utcTimestamp(record?.updatedAt) || utcTimestamp(record?.createdAt) || utcTimestamp(record?.timestamp), numericAmount(record?.amount), stringId(record?.currency), payload);
        });
      }
      const key = (...parts: any[]) => JSON.stringify(parts);
      const entities = new Map((this.database.prepare('SELECT * FROM entity_registry').all() as any[]).map(row => [key(row.collection, row.entity_id), row]));
      const wantedEntities = new Map([...inspection.entities.values()].map(row => [key(row.collection, row.id), row]));
      for (const [identity, row] of entities) if (!wantedEntities.has(identity)) this.database.prepare('DELETE FROM entity_registry WHERE collection=? AND entity_id=?').run(row.collection, row.entity_id);
      // Move changed ordinals aside before reordering to preserve the unique
      // collection/ordinal constraint. Foreign keys are deferred in this unit.
      const updateOrdinal = this.database.prepare('UPDATE entity_registry SET ordinal=? WHERE collection=? AND entity_id=?');
      for (const [identity, row] of wantedEntities) if (entities.has(identity) && entities.get(identity).ordinal !== row.index) updateOrdinal.run(-row.index - 1, row.collection, row.id);
      const insertEntity = this.database.prepare('INSERT INTO entity_registry VALUES (?,?,?)');
      for (const [identity, row] of wantedEntities) {
        if (!entities.has(identity)) insertEntity.run(row.collection, row.id, row.index);
        else if (entities.get(identity).ordinal !== row.index) updateOrdinal.run(row.index, row.collection, row.id);
      }
      const relations = new Map((this.database.prepare('SELECT * FROM relation_registry').all() as any[]).map(row => [key(row.source_collection,row.source_id,row.field,row.target_collection,row.target_id), row]));
      const wantedRelations = new Map(inspection.relations.map(row => [key(row.sourceCollection,row.sourceId,row.field,row.targetCollection,row.targetId), row]));
      const deleteRelation = this.database.prepare('DELETE FROM relation_registry WHERE source_collection=? AND source_id=? AND field=? AND target_collection=? AND target_id=?');
      for (const [identity, row] of relations) if (!wantedRelations.has(identity)) deleteRelation.run(row.source_collection,row.source_id,row.field,row.target_collection,row.target_id);
      const insertRelation = this.database.prepare('INSERT OR IGNORE INTO relation_registry VALUES (?,?,?,?,?)');
      for (const [identity, row] of wantedRelations) if (!relations.has(identity)) insertRelation.run(row.sourceCollection,row.sourceId,row.field,row.targetCollection,row.targetId);
      const quarantine = this.database.prepare('INSERT OR IGNORE INTO quarantine VALUES (?,?,?,?,?)');
      for (const issue of inspection.issues) quarantine.run(issue.signature, issue.collection, issue.index, issue.reason, json(state[issue.collection][issue.index]));
      for (const signature of allowed.keys()) if (!counts.has(signature)) this.database.prepare('DELETE FROM legacy_allowlist WHERE signature=?').run(signature);
      const allowanceWrite = this.database.prepare('INSERT INTO legacy_allowlist VALUES (?,?) ON CONFLICT(signature) DO UPDATE SET occurrence_count=excluded.occurrence_count');
      for (const [signature, count] of counts) if (allowed.get(signature) !== count) allowanceWrite.run(signature, count);
      // Historical allowances introduced by the upgrade are not necessarily in
      // the old table yet, even when their count equals the current inspection.
      if (upgradeReferences || upgradeAssets || upgradeCollaboration) {
        for (const [signature, count] of counts) allowanceWrite.run(signature, count);
      }
      if (upgradeReferences) {
        this.database.prepare("INSERT INTO metadata(key,value) VALUES ('domain_references_v1',?)").run(JSON.stringify({ version: 1, completedAt: new Date().toISOString() }));
      }
      if (upgradeAssets) this.database.prepare("INSERT INTO metadata(key,value) VALUES ('asset_references_v1',?)").run(JSON.stringify({version: 1, completedAt: new Date().toISOString()}));
      if(upgradeCollaboration)this.database.prepare("INSERT INTO metadata(key,value) VALUES ('collaboration_references_v1',?)").run(JSON.stringify({version:1,completedAt:new Date().toISOString()}));
      if (owned) this.commit();
    } catch (error) { if (owned) this.rollback(); throw error; }
  }
  importRaw(raw: Buffer): ImportReport {
    const { state, report } = analyzeLegacy(raw);
    const existing = this.database.prepare('SELECT report FROM import_sources WHERE source_hash=?').get(report.sourceHash) as any;
    if (existing) return { ...JSON.parse(existing.report), imported: false, alreadyImported: true };
    const status = this.getStatus();
    const propertyCount = Number((this.database.prepare('SELECT count(*) AS n FROM state_properties').get() as any).n);
    if (status.importCount || propertyCount || Object.values(status.collections).some(count => count > 0)) throw new Error('Import destination contains data; use a new database.');
    this.begin();
    try {
      this.saveState(state, { allowLegacy: true });
      const result = { ...report, imported: true, alreadyImported: false };
      this.database.prepare('INSERT INTO import_sources VALUES (?,?,?,?,?)').run(report.sourceHash, raw.length, new Date().toISOString(), raw, json(result));
      this.commit(); return result;
    } catch (error) { this.rollback(); throw error; }
  }
}

export function importLegacyFile(source: string, destination: string, options: { dryRun?: boolean } = {}): ImportReport {
  const raw = fs.readFileSync(source);
  if (options.dryRun) return { ...analyzeLegacy(raw).report, imported: false };
  if (path.resolve(source).toLowerCase() === path.resolve(destination).toLowerCase()) throw new Error('Import source and destination must differ.');
  if (fs.existsSync(destination)) {
    const store = new SqliteStore(destination);
    try { return store.importRaw(raw); } finally { store.close(); }
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporaryPath = destination + '.migrating-' + randomUUID();
  let store: SqliteStore | undefined;
  try {
    store = new SqliteStore(temporaryPath);
    const report = store.importRaw(raw);
    store.database.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    store.close(); store = undefined;
    validateDatabase(temporaryPath);
    // Exclusive hard-link cutover cannot replace a destination created concurrently.
    fs.linkSync(temporaryPath, destination);
    fs.unlinkSync(temporaryPath);
    return report;
  } finally {
    store?.close();
    for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(temporaryPath + suffix)) fs.unlinkSync(temporaryPath + suffix);
  }
}
