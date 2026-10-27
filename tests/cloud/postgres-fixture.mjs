import assert from 'node:assert/strict';
import {collectionNames} from '../../server/db/schema.ts';
const key = (...parts) => JSON.stringify(parts);
const empty = () => ({ versions: [], tableExists: false, records: new Map(), properties: new Map(), metadata: new Map(), entities: new Map(), relations: new Map(), archives: new Map(), realtimeEvents: [] });
const result = rows => ({ rows, rowCount: rows.length });
/** A transaction-aware pg protocol double, not a replacement PostgreSQL engine.
 * Actual SQL/DDL/FK semantics must additionally pass the provider integration test. */
export class FakePool {
  state = empty(); clients = []; log = []; held = false; waiters = []; fail = null;
  async lock() {
    if (this.held) await new Promise(resolve => this.waiters.push(resolve));
    this.held = true;
    return () => { const next = this.waiters.shift(); if (next) next(); else this.held = false; };
  }
  async connect() { const client = new FakeClient(this); this.clients.push(client); return client; }
  async query(sql, values = []) { this.log.push({ sql, values, shared: true }); return execute(this.state, sql, values); }
}
class FakeClient {
  constructor(pool) { this.pool = pool; this.state = null; this.releaseLock = null; this.released = false; }
  async query(sql, values = []) {
    this.pool.log.push({ sql, values, client: this });
    if (this.pool.fail?.test(sql)) { this.pool.fail = null; throw Object.assign(new Error('Injected SQL failure'), { code: 'XX000' }); }
    if(sql.startsWith('WITH orbit_patch AS')) {const patch=JSON.parse(values[0]);for(const [name,prefix] of Object.entries({propertiesDelete:'DELETE FROM orbit_properties',propertiesUpsert:'INSERT INTO orbit_properties',recordsTrim:'DELETE FROM orbit_records',recordsUpsert:'INSERT INTO orbit_records',entitiesDelete:'DELETE FROM orbit_entities',entitiesUpsert:'INSERT INTO orbit_entities',relationsDelete:'DELETE FROM orbit_relations',relationsInsert:'INSERT INTO orbit_relations'}))for(const parameters of patch[name])await this.query(prefix,parameters);return result([]);}
    if (sql === 'BEGIN') { assert.equal(this.state, null); return result([]); }
    if (sql.includes('pg_advisory_xact_lock')) { this.releaseLock = await this.pool.lock(); this.state = structuredClone(this.pool.state); return result([]); }
    if (sql.startsWith('SELECT set_config')) return result([]);
    if (sql === 'COMMIT') {
      for (const entity of this.state.entities.values()) assert.ok(this.state.records.has(key(entity.collection, entity.ordinal)), 'entity FK');
      for (const relation of this.state.relations.values()) {
        assert.ok(this.state.entities.has(key(relation.source_collection, relation.source_id)), 'source FK');
        assert.ok(this.state.entities.has(key(relation.target_collection, relation.target_id)), 'target FK');
      }
      this.pool.state = this.state; this.state = null; this.releaseLock?.(); this.releaseLock = null; return result([]);
    }
    if (sql === 'ROLLBACK') { this.state = null; this.releaseLock?.(); this.releaseLock = null; return result([]); }
    assert.ok(this.state, 'query must run after acquiring transaction lock');
    return execute(this.state, sql, values);
  }
  release() { assert.equal(this.releaseLock, null, 'release after commit/rollback'); this.released = true; }
}
function execute(state, sql, values) {
  if (sql.startsWith('CREATE TABLE IF NOT EXISTS orbit_schema_migrations')) return result([]);
  if (sql.startsWith('SELECT version FROM orbit_schema_migrations')) return result(state.versions.map(version => ({ version })));
  if (sql.includes("to_regclass('orbit_records')")) return result([{ table_name: state.tableExists ? 'orbit_records' : null }]);
  if (sql.includes('CREATE TABLE orbit_metadata')) { state.tableExists = true; return result([]); }
  if (sql.startsWith('INSERT INTO orbit_schema_migrations')) { state.versions.push(values[0]); return result([]); }
  if (sql.includes('LIMIT 0')) return result([]);
  if (sql.startsWith('SELECT payload FROM orbit_metadata')) return result(state.metadata.has(values[0]) ? [{ payload: state.metadata.get(values[0]) }] : []);
  if (sql.startsWith('INSERT INTO orbit_metadata')) {
    state.metadata.set(values[0], JSON.parse(values[1])); if (values.length === 4) state.metadata.set(values[2], JSON.parse(values[3])); return result([]);
  }
  if (sql.startsWith('UPDATE orbit_metadata')) { state.metadata.set('state_revision', state.metadata.get('state_revision') + 1); return result([]); }
  if(sql.includes('AS state_snapshot'))return result([{state_snapshot:{properties:[...state.properties].sort(([a],[b])=>a.localeCompare(b)).map(([key,payload])=>({key,payload})),records:[...state.records.values()].sort((a,b)=>a.collection.localeCompare(b.collection)||a.ordinal-b.ordinal),entities:[...state.entities.values()],relations:[...state.relations.values()]}}]);
  if (sql.startsWith('SELECT key,payload FROM orbit_properties')) return result([...state.properties].sort(([a], [b]) => a.localeCompare(b)).map(([key, payload]) => ({ key, payload })));
  if (sql.startsWith('INSERT INTO orbit_properties')) { state.properties.set(values[0], JSON.parse(values[1])); return result([]); }
  if (sql.startsWith('DELETE FROM orbit_properties')) { state.properties.delete(values[0]); return result([]); }
  if (sql.startsWith('SELECT collection,ordinal,')) return result([...state.records.values()].sort((a, b) => a.collection.localeCompare(b.collection) || a.ordinal - b.ordinal));
  if (sql.startsWith('INSERT INTO orbit_records')) {
    const [collection, ordinal, entity_id, user_id, workspace_id, project_id, department_id, payload] = values;
    state.records.set(key(collection, ordinal), { collection, ordinal, entity_id, user_id, workspace_id, project_id, department_id, payload: JSON.parse(payload) }); return result([]);
  }
  if (sql.startsWith('DELETE FROM orbit_records')) { for (const [entry, row] of state.records) if (row.collection === values[0] && row.ordinal >= values[1]) state.records.delete(entry); return result([]); }
  if (sql.startsWith('SELECT collection,entity_id,ordinal')) return result([...state.entities.values()]);
  if (sql.startsWith('INSERT INTO orbit_entities')) { state.entities.set(key(values[0], values[1]), { collection: values[0], entity_id: values[1], ordinal: values[2] }); return result([]); }
  if (sql.startsWith('DELETE FROM orbit_entities')) { state.entities.delete(key(values[0], values[1])); return result([]); }
  if (sql.startsWith('SELECT source_collection,')) return result([...state.relations.values()]);
  if (sql.startsWith('INSERT INTO orbit_relations')) { const [source_collection, source_id, field, target_collection, target_id] = values; state.relations.set(key(...values), { source_collection, source_id, field, target_collection, target_id }); return result([]); }
  if (sql.startsWith('DELETE FROM orbit_relations')) { state.relations.delete(key(...values)); return result([]); }
  if (sql.startsWith('SELECT payload FROM orbit_archives')) return result(state.archives.has(key(...values)) ? [{ payload: state.archives.get(key(...values)) }] : []);
  if (sql.startsWith('INSERT INTO orbit_archives')) { state.archives.set(key(values[0], values[1]), JSON.parse(values[2])); return result([]); }
  if (sql.startsWith('INSERT INTO orbit_rt_events')) { const events=JSON.parse(values[0]);if(sql.includes('jsonb_array_elements'))state.realtimeEvents.push(...events);else state.realtimeEvents.push(events); return result([]); }
  if (sql === 'SELECT 123 AS value') return result([{ value: 123 }]);
  throw new Error('Unhandled fake SQL: ' + sql);
}
export const validateState = (next, previous) => {
  const seen = new Set(), relations = [];
  for (const collection of collectionNames) for (const row of next[collection]) {
    if (!row || typeof row.id !== 'string' || !row.id) throw Object.assign(new Error('Invalid identity'), { code: 'DATA_VALIDATION_FAILED' });
    const id = key(collection, row.id); if (seen.has(id)) throw Object.assign(new Error('Duplicate identity'), { code: 'DATA_VALIDATION_FAILED' }); seen.add(id);
  }
  for (const project of next.projects) if (project.workspaceId) {
    if (!next.workspaces.some(row => row.id === project.workspaceId)) throw Object.assign(new Error('Orphan reference'), { code: 'DATA_VALIDATION_FAILED' });
    relations.push({ sourceCollection: 'projects', sourceId: project.id, field: 'workspaceId', targetCollection: 'workspaces', targetId: project.workspaceId });
  }
  return { relations };
};
