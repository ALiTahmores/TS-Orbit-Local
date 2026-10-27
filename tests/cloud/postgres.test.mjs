import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresStore } from '../../server/cloud/postgres.ts';
import { collectionNames } from '../../server/db/schema.ts';

import {FakePool, validateState} from './postgres-fixture.mjs';
const key = (...parts) => JSON.stringify(parts);
async function setup(pool = new FakePool()) { const store = new PostgresStore({ pool, validateState }); await store.initialize(); return { pool, store }; }
async function seed(store) {
  await store.begin(); const state = await store.loadState(); state.workspaces.push({ id: 'ws-a', name: 'Synthetic workspace' });
  state.users.push({ id: 'user-a', name: 'Synthetic account' }); state.projects.push({ id: 'project-a', workspaceId: 'ws-a', title: 'Original', retained: { legacy: true } });
  state.extension = { nested: ['preserved', 1] }; await store.saveState(state); await store.commit();
}

test('cloud schema is versioned, checked and never silently adopted/reset', async () => {
  const { pool, store } = await setup(); assert.deepEqual(pool.state.versions, [1]); await store.initialize(); assert.equal(pool.state.versions.length, 1);
  const other = new FakePool(); other.state.versions = [99]; other.state.tableExists = true;
  await assert.rejects(new PostgresStore({ pool: other, validateState }).initialize(), /Unsupported cloud schema/);
  assert.deepEqual(other.state.versions, [99]); assert.ok(other.clients.every(client => client.released));
  const unversioned = new FakePool(); unversioned.state.tableExists = true;
  await assert.rejects(new PostgresStore({ pool: unversioned, validateState }).initialize(), /Unversioned existing/);
  assert.deepEqual(unversioned.state.versions, []);
});

test('every unit acquires the database lock before reading fresh state from all 64 collections', async () => {
  const { pool, store } = await setup(); await seed(store);
  const second = new PostgresStore({ pool, validateState }); await second.initialize(); await second.begin(); const state = await second.loadState();
  assert.equal(collectionNames.length, 64); assert.deepEqual(collectionNames.filter(name => !Array.isArray(state[name])), []);
  assert.equal(state.projects[0].title, 'Original'); assert.deepEqual(state.extension, { nested: ['preserved', 1] });
  assert.deepEqual(Object.keys(state).filter(name => collectionNames.includes(name)), [...collectionNames]);
  const log = pool.log.filter(entry => entry.client === pool.clients.at(-1)).map(entry => entry.sql);
  assert.ok(log.findIndex(sql => sql.includes('pg_advisory_xact_lock')) < log.findIndex(sql => sql.includes('FROM orbit_properties')));
  await assert.rejects(second.loadState(), /exactly once/); await second.rollback();
});

test('shared transaction lock prevents lost updates between separate serverless instances', async () => {
  const { pool, store: first } = await setup(); await seed(first);
  const second = new PostgresStore({ pool, validateState }); await second.initialize();
  await first.begin(); const a = await first.loadState(); a.projects[0].count = 1;
  let acquired = false; const waiting = second.begin().then(() => { acquired = true; });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(acquired, false);
  await first.saveState(a); await first.commit(); await waiting;
  const b = await second.loadState(); assert.equal(b.projects[0].count, 1); b.projects[0].count++; await second.saveState(b); await second.commit();
  await first.begin(); assert.equal((await first.loadState()).projects[0].count, 2); await first.rollback();
});

test('incremental save updates one changed entity, retains root properties and resolved FK registries', async () => {
  const { pool, store } = await setup(); await seed(store); pool.log.length = 0;
  await store.begin(); const state = await store.loadState(); state.projects[0].title = 'Changed'; await store.saveState(state); await store.commit();
  const writes = pool.log.filter(entry => entry.sql.startsWith('INSERT INTO orbit_records'));
  assert.equal(writes.length, 1); assert.equal(writes[0].values[0], 'projects');
  assert.equal(pool.state.entities.size, 3); assert.equal(pool.state.relations.size, 1); assert.deepEqual(pool.state.properties.get('extension'), { nested: ['preserved', 1] });
  assert.equal(await store.getRevision(), 2);
});

test('deleting a target and its dependent rows reconciles entity and relation registries atomically', async () => {
  const { pool, store } = await setup(); await seed(store); await store.begin(); const state = await store.loadState();
  state.projects = []; state.workspaces = []; await store.saveState(state); await store.commit();
  assert.equal(pool.state.records.size, 1); assert.equal(pool.state.entities.size, 1); assert.equal(pool.state.relations.size, 0);
});

test('validation rejects new orphan or duplicate identities without changing committed data', async () => {
  const { pool, store } = await setup(); await seed(store); const before = structuredClone(pool.state);
  await store.begin(); const state = await store.loadState(); state.projects[0].workspaceId = 'missing';
  await assert.rejects(store.saveState(state), { code: 'DATA_VALIDATION_FAILED' }); await store.rollback(); assert.deepEqual(pool.state, before);
  await store.begin(); const duplicate = await store.loadState(); duplicate.users.push({ ...duplicate.users[0] });
  await assert.rejects(store.saveState(duplicate), { code: 'DATA_VALIDATION_FAILED' }); await store.rollback(); assert.deepEqual(pool.state, before);
});

test('SQL write and commit failures can never leave a partial durable state or checked-out client', async () => {
  const { pool, store } = await setup(); await seed(store); const before = structuredClone(pool.state);
  await store.begin(); const state = await store.loadState(); state.projects[0].title = 'Not committed'; pool.fail = /^INSERT INTO orbit_records/;
  await assert.rejects(store.saveState(state), /Injected/); await store.rollback(); assert.deepEqual(pool.state, before);
  await store.begin(); const next = await store.loadState(); next.projects[0].title = 'Also not committed'; await store.saveState(next); pool.fail = /^COMMIT$/;
  await assert.rejects(store.commit(), /Injected/); assert.deepEqual(pool.state, before); assert.equal(store.inTransaction, false);
  assert.ok(pool.clients.every(client => client.released));
});

test('shared signing key is initialized once, survives new instances and invalid values fail closed', async () => {
  const { pool, store } = await setup(); await store.begin(); const secret = await store.initializeSharedSecret(); assert.match(secret, /^[0-9a-f]{96}$/); await store.commit();
  const another = new PostgresStore({ pool, validateState }); await another.initialize(); await another.begin(); assert.equal(await another.initializeSharedSecret(), secret); await another.commit();
  assert.equal(await another.getRevision(), 1);
  pool.state.metadata.set('jwt_secret', 'invalid'); await another.begin(); await assert.rejects(another.initializeSharedSecret(), /Invalid canonical/); await another.rollback(); assert.equal(pool.state.metadata.get('jwt_secret'), 'invalid');
});

test('quarantine/import archives and security metadata persist only on successful commit', async () => {
  const { pool, store } = await setup(); await store.begin(); await store.putArchive('quarantine', 'legacy-issue', { raw: { id: 'synthetic' }, reason: 'orphan_reference' }); await store.setMetadata('identity_version', 1); await store.commit();
  await store.begin(); assert.deepEqual(await store.getArchive('quarantine', 'legacy-issue'), { raw: { id: 'synthetic' }, reason: 'orphan_reference' }); assert.equal(await store.getMetadata('identity_version'), 1);
  await store.putArchive('quarantine', 'legacy-issue', { bad: true }); await store.setMetadata('identity_version', 2); await store.rollback();
  assert.equal(pool.state.metadata.get('identity_version'), 1); assert.equal(pool.state.archives.get(key('quarantine', 'legacy-issue')).reason, 'orphan_reference');
});

test('corrupt ordering, nonfinite payloads and unresolved validator output fail without resetting data', async () => {
  const { pool, store: writer } = await setup(); await seed(writer);
  // A fresh instance reads the full snapshot (the writer's cache is only reused
  // while state_revision is unchanged).
  const store = new PostgresStore({ pool, validateState }); await store.initialize();
  pool.state.records.get(key('users', 0)).ordinal = 3;
  await store.begin(); await assert.rejects(store.loadState(), /ordering\/schema is corrupt/); await store.rollback(); assert.equal(pool.state.records.get(key('users', 0)).ordinal, 3);
  pool.state.records.get(key('users', 0)).ordinal = 0;
  await store.begin(); const state = await store.loadState(); state.projects[0].amount = Infinity;
  await assert.rejects(store.saveState(state), { code: 'DATA_VALIDATION_FAILED' }); await store.rollback();
  const wrong = new PostgresStore({ pool, validateState: () => ({ relations: [{ sourceCollection: 'projects', sourceId: 'project-a', field: 'workspaceId', targetCollection: 'workspaces', targetId: 'does-not-exist' }] }) });
  // A no-op save writes nothing and skips validation, so change one record.
  await wrong.initialize(); await wrong.begin(); const input = await wrong.loadState(); input.projects[0].title = 'Revalidated'; await assert.rejects(wrong.saveState(input), /unresolved relation/); await wrong.rollback();
});

test('transactionQuery uses the locked client and sharedQuery uses the pool explicitly', async () => {
  const { pool, store } = await setup(); await assert.rejects(store.transactionQuery('SELECT 123 AS value'), /No active/);
  assert.equal((await store.sharedQuery('SELECT 123 AS value')).rows[0].value, 123); assert.equal(pool.log.at(-1).shared, true);
  await store.begin(); assert.equal((await store.transactionQuery('SELECT 123 AS value')).rows[0].value, 123); assert.equal(pool.log.at(-1).client, pool.clients.at(-1)); await store.rollback();
});

test('begin/save requirements and closed units prevent stale state reuse', async () => {
  const { store } = await setup(); await assert.rejects(store.loadState(), /No active/); await store.begin(); await assert.rejects(store.begin(), /already active/); await assert.rejects(store.saveState({}), /Load a fresh/); await store.close(); assert.equal(store.inTransaction, false);
  await assert.rejects(store.setMetadata('identity_version', 1), /No active/); await store.rollback();
  assert.throws(() => new PostgresStore({ pool: new FakePool(), validateState, lockTimeoutMs: 0 }), /timeouts/);
});


test('an unchanged revision reuses the committed snapshot; another instance commit forces a reload', async () => {
  const { pool, store } = await setup(); await seed(store);
  const snapshots = () => pool.log.filter(entry => entry.sql.includes('AS state_snapshot')).length;
  let before = snapshots();
  await store.begin(); const cached = await store.loadState(); cached.projects[0].title = 'Local edit, rolled back'; await store.rollback();
  await store.begin(); const again = await store.loadState(); await store.saveState(again); await store.commit();
  assert.equal(snapshots(), before, 'no snapshot transfer while the revision is unchanged');
  assert.equal(again.projects[0].title, 'Original', 'a rolled-back edit never leaks into the cache');
  const other = new PostgresStore({ pool, validateState }); await other.initialize();
  await other.begin(); const remote = await other.loadState(); remote.projects[0].title = 'Changed elsewhere'; await other.saveState(remote); await other.commit();
  before = snapshots();
  await store.begin(); const fresh = await store.loadState(); await store.rollback();
  assert.equal(snapshots(), before + 1); assert.equal(fresh.projects[0].title, 'Changed elsewhere');
  await store.begin(); assert.match(String(store.transactionSecret ?? ''), /^$|^[0-9a-f]{96}$/); await store.rollback();
});

test('bulk entity mutations share one network write and no-op snapshots avoid registry reads/writes',async()=>{
 const {pool,store}=await setup();await store.begin();const state=await store.loadState();state.workspaces.push({id:'bulk-workspace'});for(let i=0;i<30;i++)state.projects.push({id:'bulk-'+i,workspaceId:'bulk-workspace'});pool.log.length=0;await store.saveState(state);await store.commit();
 const writes=pool.log.filter(entry=>entry.sql.startsWith('WITH orbit_patch AS'));assert.equal(writes.length,1);assert.equal(JSON.parse(writes[0].values[0]).recordsUpsert.length,31);assert.equal(pool.state.entities.size,31);assert.equal(pool.state.relations.size,30);
 await store.begin();const same=await store.loadState();pool.log.length=0;await store.saveState(same);await store.commit();assert.ok(!pool.log.some(entry=>entry.sql.startsWith('WITH orbit_patch AS')||entry.sql.startsWith('SELECT collection,entity_id')||entry.sql.startsWith('SELECT source_collection')));assert.equal(await store.getRevision(),1);
});
