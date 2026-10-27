import { randomBytes } from 'node:crypto';
import { collectionNames } from '../db/schema.ts';

/** A small structural interface also implemented by pg.Pool/PoolClient. The caller
 * owns pool creation and environment secrets; this adapter never opens local data. */
export interface PgQueryable {
  query(text: string, values?: any[]): Promise<{ rows: any[]; rowCount?: number | null }>;
}
export interface PgClient extends PgQueryable { release(error?: boolean | Error): void; }
export interface PgPool extends PgQueryable { connect(): Promise<PgClient>; end?(): Promise<void>; }
export type CloudState = Record<string, any>;
export interface CloudRelation {
  sourceCollection: string; sourceId: string; field: string; targetCollection: string; targetId: string;
}
export interface CloudInspection { relations: ReadonlyArray<CloudRelation>; }
export interface PostgresOptions {
  pool: PgPool;
  /** Must apply the application's complete identity/relation validation, including
   * bounded legacy allowances, and return only resolvable registry relations. */
  validateState(next: CloudState, previous: CloudState): CloudInspection | Promise<CloudInspection>;
  lockTimeoutMs?: number;
  statementTimeoutMs?: number;
  idleTransactionTimeoutMs?: number;
}
export type ArchiveKind = 'quarantine' | 'legacy_allowlist' | 'import_sources' | 'legacy_metadata';

const APPLICATION_ID = 'TS_ORBIT_POSTGRES';
export const CLOUD_SCHEMA_VERSION = 1;
// All instances of one deployment's database must acquire the same transaction lock.
// This deliberately serializes the compatibility-state model across serverless instances.
const LOCK_NAMESPACE = 1414745938, LOCK_RESOURCE = 1;
const collections = new Set<string>(collectionNames);
const archives = new Set<ArchiveKind>(['quarantine', 'legacy_allowlist', 'import_sources', 'legacy_metadata']);
const rowKey = (collection: string, ordinal: number) => JSON.stringify([collection, ordinal]);
const entityKey = (collection: string, id: string) => JSON.stringify([collection, id]);
const relationKey = (r: CloudRelation) => JSON.stringify([r.sourceCollection, r.sourceId, r.field, r.targetCollection, r.targetId]);
const stringId = (value: any): string | null => typeof value === 'string' && value.trim() ? value : null;
const entityId = (collection: string, record: any): string | null => record && typeof record === 'object' && !Array.isArray(record)
  ? stringId(record.id) || (collection === 'wpSites' ? stringId(record.projectId) : null) : null;
const validationFailure = (message: string): Error => Object.assign(new Error(message), { code: 'DATA_VALIDATION_FAILED' });
function boundedTimeout(value: number | undefined, fallback: number): number {
  const chosen = value ?? fallback;
  if (!Number.isSafeInteger(chosen) || chosen < 100 || chosen > 120_000) throw new Error('Cloud SQL timeouts must be integers from 100 to 120000 ms.');
  return chosen;
}
function canonical(value: any): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
/** Same JSON interchange contract as local storage: known collections are arrays;
 * root extension properties and full entity payloads are retained. */
function normalize(input: CloudState): CloudState {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw validationFailure('Invalid cloud database root.');
  const seen = new WeakSet<object>();
  const check = (value: any): void => {
    if (typeof value === 'number' && !Number.isFinite(value)) throw validationFailure('Nonfinite cloud database value.');
    if (['bigint', 'function', 'symbol'].includes(typeof value)) throw validationFailure('Non-JSON cloud database value.');
    if (value && typeof value === 'object') {
      if (seen.has(value)) throw validationFailure('Cyclic cloud database value.');
      seen.add(value); Object.values(value).forEach(check); seen.delete(value);
    }
  };
  check(input);
  const result = JSON.parse(JSON.stringify(input));
  for (const name of collectionNames) {
    if (result[name] === undefined) result[name] = [];
    else if (!Array.isArray(result[name])) throw validationFailure('Invalid cloud collection: ' + name);
  }
  if (result.settings === undefined) result.settings = { theme: 'dark', require2FA: false };
  return result;
}

/** One parameterized statement applies all changed rows. The lock, validation and
 * deferred FK checks are unchanged; a signup no longer pays one network RTT for
 * every profile/session/entity/reference. Unchanged rows remain untouched. */
async function applyPatch(client:PgClient, operations:Array<[string,any[]]>):Promise<void> {
  const patch:Record<string,any[]>={propertiesDelete:[],propertiesUpsert:[],recordsTrim:[],recordsUpsert:[],entitiesDelete:[],entitiesUpsert:[],relationsDelete:[],relationsInsert:[]};
  for(const [sql,values] of operations){
    const name=sql.startsWith('DELETE FROM orbit_properties')?'propertiesDelete':sql.startsWith('INSERT INTO orbit_properties')?'propertiesUpsert':sql.startsWith('DELETE FROM orbit_records')?'recordsTrim':sql.startsWith('INSERT INTO orbit_records')?'recordsUpsert':sql.startsWith('DELETE FROM orbit_entities')?'entitiesDelete':sql.startsWith('INSERT INTO orbit_entities')?'entitiesUpsert':sql.startsWith('DELETE FROM orbit_relations')?'relationsDelete':'relationsInsert';
    patch[name].push(values);
  }
  await client.query(`WITH orbit_patch AS (SELECT $1::jsonb AS data),
    delete_properties AS (DELETE FROM orbit_properties USING orbit_patch, LATERAL jsonb_array_elements(data->'propertiesDelete') AS item(v) WHERE key=v->>0),
    upsert_properties AS (INSERT INTO orbit_properties(key,payload) SELECT v->>0,(v->>1)::jsonb FROM orbit_patch CROSS JOIN LATERAL jsonb_array_elements(data->'propertiesUpsert') AS item(v) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload),
    trim_records AS (DELETE FROM orbit_records USING orbit_patch, LATERAL jsonb_array_elements(data->'recordsTrim') AS item(v) WHERE collection=v->>0 AND ordinal >= (v->>1)::integer),
    upsert_records AS (INSERT INTO orbit_records(collection,ordinal,entity_id,user_id,workspace_id,project_id,department_id,payload) SELECT v->>0,(v->>1)::integer,v->>2,v->>3,v->>4,v->>5,v->>6,(v->>7)::jsonb FROM orbit_patch CROSS JOIN LATERAL jsonb_array_elements(data->'recordsUpsert') AS item(v) ON CONFLICT(collection,ordinal) DO UPDATE SET entity_id=excluded.entity_id,user_id=excluded.user_id,workspace_id=excluded.workspace_id,project_id=excluded.project_id,department_id=excluded.department_id,payload=excluded.payload),
    delete_entities AS (DELETE FROM orbit_entities USING orbit_patch, LATERAL jsonb_array_elements(data->'entitiesDelete') AS item(v) WHERE collection=v->>0 AND entity_id=v->>1),
    upsert_entities AS (INSERT INTO orbit_entities(collection,entity_id,ordinal) SELECT v->>0,v->>1,(v->>2)::integer FROM orbit_patch CROSS JOIN LATERAL jsonb_array_elements(data->'entitiesUpsert') AS item(v) ON CONFLICT(collection,entity_id) DO UPDATE SET ordinal=excluded.ordinal),
    delete_relations AS (DELETE FROM orbit_relations USING orbit_patch, LATERAL jsonb_array_elements(data->'relationsDelete') AS item(v) WHERE source_collection=v->>0 AND source_id=v->>1 AND field=v->>2 AND target_collection=v->>3 AND target_id=v->>4),
    insert_relations AS (INSERT INTO orbit_relations(source_collection,source_id,field,target_collection,target_id) SELECT v->>0,v->>1,v->>2,v->>3,v->>4 FROM orbit_patch CROSS JOIN LATERAL jsonb_array_elements(data->'relationsInsert') AS item(v)) SELECT 1`, [JSON.stringify(patch)]);
}

const migrationOne = `
CREATE TABLE orbit_metadata (
  key TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);
CREATE TABLE orbit_properties (
  key TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);
CREATE TABLE orbit_records (
  collection TEXT NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  entity_id TEXT,
  user_id TEXT,
  workspace_id TEXT,
  project_id TEXT,
  department_id TEXT,
  payload JSONB NOT NULL,
  PRIMARY KEY (collection, ordinal)
);
CREATE INDEX orbit_records_entity ON orbit_records(collection, entity_id);
CREATE INDEX orbit_records_workspace ON orbit_records(collection, workspace_id);
CREATE INDEX orbit_records_project ON orbit_records(collection, project_id);
CREATE INDEX orbit_records_user ON orbit_records(collection, user_id);
CREATE INDEX orbit_records_department ON orbit_records(collection, department_id);
CREATE TABLE orbit_entities (
  collection TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  PRIMARY KEY (collection, entity_id),
  UNIQUE (collection, ordinal) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (collection, ordinal) REFERENCES orbit_records(collection, ordinal) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE orbit_relations (
  source_collection TEXT NOT NULL,
  source_id TEXT NOT NULL,
  field TEXT NOT NULL,
  target_collection TEXT NOT NULL,
  target_id TEXT NOT NULL,
  PRIMARY KEY (source_collection, source_id, field, target_collection, target_id),
  FOREIGN KEY (source_collection, source_id) REFERENCES orbit_entities(collection, entity_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (target_collection, target_id) REFERENCES orbit_entities(collection, entity_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX orbit_relations_target ON orbit_relations(target_collection, target_id);
CREATE TABLE orbit_archives (
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  payload JSONB NOT NULL,
  PRIMARY KEY (kind, key)
);
`;

/** Remote, durable storage for the existing compatibility-state services. Each
 * unit owns one pg client and a transaction advisory lock until commit/rollback.
 * Root integration must loadState after begin, replace RAW, then authorize/run
 * synchronous domain handlers, await saveState+commit, and only then send/events. */
export class PostgresStore {
  private readonly pool: PgPool;
  private readonly validateState: PostgresOptions['validateState'];
  private readonly lockTimeout: number;
  private readonly statementTimeout: number;
  private readonly idleTimeout: number;
  private client: PgClient | null = null;
  private initialized = false;
  private previous: CloudState | null = null;
  private records = new Map<string, any>();
  private properties = new Map<string, any>();
  private dirty = false;
  private entityRows:any[]=[];
  private relationRows:any[]=[];

  constructor(options: PostgresOptions) {
    if (!options?.pool || typeof options.pool.connect !== 'function' || typeof options.validateState !== 'function') throw new Error('A PostgreSQL pool and application validator are required.');
    this.pool = options.pool; this.validateState = options.validateState;
    this.lockTimeout = boundedTimeout(options.lockTimeoutMs, 10_000);
    this.statementTimeout = boundedTimeout(options.statementTimeoutMs, 20_000);
    // Every unit holds the global lock. A transaction left idle (a paused or
    // stalled instance) ends quickly so it cannot outlast other units' lock waits.
    this.idleTimeout = boundedTimeout(options.idleTransactionTimeoutMs, 5_000);
  }

  private async openLocked(client: PgClient): Promise<void> {
    await client.query('BEGIN');
    await client.query("WITH timeouts AS MATERIALIZED (SELECT set_config('lock_timeout', $1, true), set_config('statement_timeout', $2, true), set_config('idle_in_transaction_session_timeout', $3, true)) SELECT pg_advisory_xact_lock($4, $5) FROM timeouts", [String(this.lockTimeout), String(this.statementTimeout), String(this.idleTimeout), LOCK_NAMESPACE, LOCK_RESOURCE]);
  }
  private active(): PgClient {
    if (!this.client) throw new Error('No active cloud transaction.');
    return this.client;
  }
  private clear(): void { this.client = null; this.previous = null; this.records.clear(); this.properties.clear(); this.entityRows=[];this.relationRows=[];this.dirty = false; }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.client) throw new Error('Cannot initialize during an active cloud transaction.');
    const client = await this.pool.connect();
    let broken: Error | undefined;
    try {
      await this.openLocked(client);
      await client.query('CREATE TABLE IF NOT EXISTS orbit_schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
      const applied = (await client.query('SELECT version FROM orbit_schema_migrations ORDER BY version')).rows;
      if (!applied.length) {
        const existing = (await client.query("SELECT to_regclass('orbit_records') AS table_name")).rows[0]?.table_name;
        if (existing) throw new Error('Unversioned existing cloud tables; automatic adoption/reset is disabled.');
        await client.query(migrationOne);
        await client.query('INSERT INTO orbit_schema_migrations(version) VALUES ($1)', [CLOUD_SCHEMA_VERSION]);
        await client.query('INSERT INTO orbit_metadata(key,payload) VALUES ($1,$2::jsonb),($3,$4::jsonb)', ['application_id', JSON.stringify(APPLICATION_ID), 'state_revision', '0']);
      } else if (applied.length !== 1 || Number(applied[0].version) !== CLOUD_SCHEMA_VERSION) throw new Error('Unsupported cloud schema version; automatic reset is disabled.');
      const identity = (await client.query('SELECT payload FROM orbit_metadata WHERE key=$1', ['application_id'])).rows[0]?.payload;
      if (identity !== APPLICATION_ID) throw new Error('Unsupported cloud database identity.');
      // Check every required table/column, even for an already-versioned database.
      await client.query('SELECT collection,ordinal,entity_id,user_id,workspace_id,project_id,department_id,payload FROM orbit_records LIMIT 0');
      await client.query('SELECT key,payload FROM orbit_properties LIMIT 0');
      await client.query('SELECT collection,entity_id,ordinal FROM orbit_entities LIMIT 0');
      await client.query('SELECT source_collection,source_id,field,target_collection,target_id FROM orbit_relations LIMIT 0');
      await client.query('SELECT kind,key,payload FROM orbit_archives LIMIT 0');
      await client.query('COMMIT'); this.initialized = true;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (rollbackError) { broken = rollbackError as Error; }
      throw error;
    } finally { client.release(broken); }
  }

  async begin(): Promise<void> {
    if (!this.initialized) throw new Error('Initialize cloud storage before starting a transaction.');
    if (this.client) throw new Error('A cloud transaction is already active.');
    const client = await this.pool.connect();
    try { await this.openLocked(client); this.client = client; this.previous = null; this.dirty = false; }
    catch (error) {
      let broken: Error | undefined;
      try { await client.query('ROLLBACK'); } catch (rollbackError) { broken = rollbackError as Error; }
      client.release(broken); throw error;
    }
  }

  async loadState(): Promise<CloudState> {
    const client = this.active();
    if (this.previous) throw new Error('Cloud state must be loaded exactly once per transaction.');
    const snapshot=(await client.query(`SELECT jsonb_build_object(
      'properties',(SELECT COALESCE(jsonb_agg(p ORDER BY p.key),'[]'::jsonb) FROM orbit_properties p),
      'records',(SELECT COALESCE(jsonb_agg(r ORDER BY r.collection,r.ordinal),'[]'::jsonb) FROM orbit_records r),
      'entities',(SELECT COALESCE(jsonb_agg(e),'[]'::jsonb) FROM orbit_entities e),
      'relations',(SELECT COALESCE(jsonb_agg(l),'[]'::jsonb) FROM orbit_relations l)
    ) AS state_snapshot`)).rows[0]?.state_snapshot;
    if(!snapshot)throw new Error('Cloud state snapshot unavailable.');
    const properties=snapshot.properties, records=snapshot.records;
    this.entityRows=snapshot.entities;this.relationRows=snapshot.relations;
    const state: CloudState = Object.create(null);
    for (const row of properties) {
      if (collections.has(row.key)) throw new Error('A collection is stored as a root property; cloud storage is corrupt.');
      state[row.key] = row.payload;
    }
    for (const name of collectionNames) state[name] = [];
    for (const row of records) {
      if (!collections.has(row.collection) || !Number.isSafeInteger(Number(row.ordinal)) || Number(row.ordinal) !== state[row.collection].length) throw new Error('Cloud collection ordering/schema is corrupt; automatic reset is disabled.');
      state[row.collection].push(row.payload);
    }
    const normalized = normalize(state);
    this.previous = structuredClone(normalized);
    this.records = new Map(records.map(row => [rowKey(row.collection, Number(row.ordinal)), row]));
    this.properties = new Map(properties.map(row => [row.key, row.payload]));
    return normalized;
  }

  async saveState(input: CloudState): Promise<void> {
    const client = this.active();
    if (!this.previous) throw new Error('Load a fresh cloud state before saving.');
    const operations:Array<[string,any[]]>=[];
    const queue=async(sql:string,values:any[])=>{operations.push([sql,values]);};
    const state = normalize(input), inspected = await this.validateState(state, structuredClone(this.previous));
    if (!inspected || !Array.isArray(inspected.relations)) throw new Error('The cloud validator must return resolved relations.');
    const properties = new Map(Object.entries(state).filter(([name]) => !collections.has(name)));
    for (const key of this.properties.keys()) if (!properties.has(key)) { await queue('DELETE FROM orbit_properties WHERE key=$1', [key]); this.dirty = true; }
    for (const [key, value] of properties) if (!this.properties.has(key) || canonical(this.properties.get(key)) !== canonical(value)) {
      await queue('INSERT INTO orbit_properties(key,payload) VALUES ($1,$2::jsonb) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload', [key, JSON.stringify(value)]); this.dirty = true;
    }
    const entities = new Map<string, { collection: string; id: string; ordinal: number }>();
    const rows = new Map<string, any>();
    for (const collection of collectionNames) {
      const oldLength = this.previous[collection].length;
      if (state[collection].length < oldLength) { await queue('DELETE FROM orbit_records WHERE collection=$1 AND ordinal >= $2', [collection, state[collection].length]); this.dirty = true; }
      for (const [ordinal, payload] of state[collection].entries()) {
        const id = entityId(collection, payload), key = rowKey(collection, ordinal), old = this.records.get(key);
        if (id && !entities.has(entityKey(collection, id))) entities.set(entityKey(collection, id), { collection, id, ordinal });
        const row = { collection, ordinal, entity_id: id, user_id: stringId(payload?.userId), workspace_id: stringId(payload?.workspaceId), project_id: stringId(payload?.projectId), department_id: stringId(payload?.departmentId), payload };
        rows.set(key, row);
        if (old && canonical(old.payload) === canonical(payload) && ['entity_id', 'user_id', 'workspace_id', 'project_id', 'department_id'].every(field => old[field] === row[field])) continue;
        await queue('INSERT INTO orbit_records(collection,ordinal,entity_id,user_id,workspace_id,project_id,department_id,payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT(collection,ordinal) DO UPDATE SET entity_id=excluded.entity_id,user_id=excluded.user_id,workspace_id=excluded.workspace_id,project_id=excluded.project_id,department_id=excluded.department_id,payload=excluded.payload', [collection, ordinal, id, row.user_id, row.workspace_id, row.project_id, row.department_id, JSON.stringify(payload)]); this.dirty = true;
      }
    }
    const oldEntities = new Map(this.entityRows.map(row => [entityKey(row.collection, row.entity_id), row]));
    for (const [key, old] of oldEntities) if (!entities.has(key)) await queue('DELETE FROM orbit_entities WHERE collection=$1 AND entity_id=$2', [old.collection, old.entity_id]);
    for (const [key, entity] of entities) if (Number(oldEntities.get(key)?.ordinal) !== entity.ordinal) await queue('INSERT INTO orbit_entities(collection,entity_id,ordinal) VALUES ($1,$2,$3) ON CONFLICT(collection,entity_id) DO UPDATE SET ordinal=excluded.ordinal', [entity.collection, entity.id, entity.ordinal]);
    const relations = new Map<string, CloudRelation>();
    for (const relation of inspected.relations) {
      if (!relation || !collections.has(relation.sourceCollection) || !collections.has(relation.targetCollection) || typeof relation.field !== 'string' || !relation.field || !entities.has(entityKey(relation.sourceCollection, relation.sourceId)) || !entities.has(entityKey(relation.targetCollection, relation.targetId))) throw validationFailure('The cloud validator returned an unresolved relation.');
      relations.set(relationKey(relation), relation);
    }
    const oldRelations = new Map(this.relationRows.map(row => {
      const relation = { sourceCollection: row.source_collection, sourceId: row.source_id, field: row.field, targetCollection: row.target_collection, targetId: row.target_id };
      return [relationKey(relation), relation];
    }));
    for (const [key, relation] of oldRelations) if (!relations.has(key)) await queue('DELETE FROM orbit_relations WHERE source_collection=$1 AND source_id=$2 AND field=$3 AND target_collection=$4 AND target_id=$5', [relation.sourceCollection, relation.sourceId, relation.field, relation.targetCollection, relation.targetId]);
    for (const [key, relation] of relations) if (!oldRelations.has(key)) await queue('INSERT INTO orbit_relations(source_collection,source_id,field,target_collection,target_id) VALUES ($1,$2,$3,$4,$5)', [relation.sourceCollection, relation.sourceId, relation.field, relation.targetCollection, relation.targetId]);
    if(operations.length) await applyPatch(client,operations);
    this.entityRows=[...entities.values()].map(row=>({collection:row.collection,entity_id:row.id,ordinal:row.ordinal}));
    this.relationRows=[...relations.values()].map(row=>({source_collection:row.sourceCollection,source_id:row.sourceId,field:row.field,target_collection:row.targetCollection,target_id:row.targetId}));
    this.properties = properties; this.records = rows; this.previous = structuredClone(state);
  }

  async getMetadata<T = unknown>(key: string): Promise<T | undefined> {
    if (!key || key.length > 200) throw new Error('Invalid cloud metadata key.');
    const result = await (this.client || this.pool).query('SELECT payload FROM orbit_metadata WHERE key=$1', [key]);
    return result.rows[0]?.payload as T | undefined;
  }
  /** Infrastructure extensions (for example an outbox) participate in the exact
   * business transaction. Never publish an event by sharedQuery before commit. */
  async transactionQuery<Row = any>(sql: string, parameters: any[] = []): Promise<{ rows: Row[]; rowCount?: number | null }> {
    return this.active().query(sql, parameters);
  }
  /** Reserved for independent infrastructure such as presence leases/polling.
   * Application state must continue through the locked load/save unit above. */
  async sharedQuery<Row = any>(sql: string, parameters: any[] = []): Promise<{ rows: Row[]; rowCount?: number | null }> {
    return this.pool.query(sql, parameters);
  }
  async setMetadata(key: string, value: unknown): Promise<void> {
    if (!key || key.length > 200 || ['application_id', 'state_revision'].includes(key)) throw new Error('Invalid/protected cloud metadata key.');
    const payload = JSON.stringify(value); if (payload === undefined) throw validationFailure('Metadata must be JSON.');
    await this.active().query('INSERT INTO orbit_metadata(key,payload) VALUES ($1,$2::jsonb) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload', [key, payload]); this.dirty = true;
  }
  /** Must be called under begin()'s shared lock. Every instance receives the same
   * 96-hex canonical key; an invalid existing key fails, never silently rotates. */
  async initializeSharedSecret(): Promise<string> {
    this.active();
    const existing = await this.getMetadata<unknown>('jwt_secret');
    if (existing !== undefined) {
      if (typeof existing !== 'string' || !/^[0-9a-f]{96}$/.test(existing)) throw new Error('Invalid canonical cloud signing key; automatic replacement is disabled.');
      return existing;
    }
    const secret = randomBytes(48).toString('hex'); await this.setMetadata('jwt_secret', secret); return secret;
  }
  async getRevision(): Promise<number> {
    const value = await this.getMetadata<unknown>('state_revision');
    if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error('Invalid cloud state revision.');
    return Number(value);
  }
  async getArchive<T = unknown>(kind: ArchiveKind, key: string): Promise<T | undefined> {
    if (!archives.has(kind) || !key || key.length > 500) throw new Error('Invalid archive key/kind.');
    return (await this.active().query('SELECT payload FROM orbit_archives WHERE kind=$1 AND key=$2', [kind, key])).rows[0]?.payload as T | undefined;
  }
  async putArchive(kind: ArchiveKind, key: string, value: unknown): Promise<void> {
    if (!archives.has(kind) || !key || key.length > 500) throw new Error('Invalid archive key/kind.');
    const payload = JSON.stringify(value); if (payload === undefined) throw validationFailure('Archive must be JSON.');
    await this.active().query('INSERT INTO orbit_archives(kind,key,payload) VALUES ($1,$2,$3::jsonb) ON CONFLICT(kind,key) DO UPDATE SET payload=excluded.payload', [kind, key, payload]); this.dirty = true;
  }

  async commit(): Promise<void> {
    const client = this.active(); let broken: Error | undefined;
    try {
      if (this.dirty) await client.query("UPDATE orbit_metadata SET payload=to_jsonb((payload #>> '{}')::bigint + 1) WHERE key='state_revision'");
      await client.query('COMMIT');
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (rollbackError) { broken = rollbackError as Error; }
      throw error;
    } finally { this.clear(); client.release(broken); }
  }
  async rollback(): Promise<void> {
    const client = this.client; if (!client) return;
    let broken: Error | undefined;
    try { await client.query('ROLLBACK'); } catch (error) { broken = error as Error; throw error; }
    finally { this.clear(); client.release(broken); }
  }
  get inTransaction(): boolean { return this.client !== null; }
  async close(): Promise<void> { await this.rollback(); }
}
