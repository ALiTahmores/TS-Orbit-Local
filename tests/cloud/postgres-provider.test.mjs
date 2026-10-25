import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PostgresStore } from '../../server/cloud/postgres.ts';
import { validateState } from './postgres-fixture.mjs';
import { exportCloudBackup, restoreCloudBackup } from '../../scripts/cloud-database.ts';

// Explicit opt-in only. Never reuse the application's default DATABASE_URL:
// provider checks create/drop only their own random, empty namespace.
const connectionString = process.env.CLOUD_TEST_DATABASE_URL;
test('real PostgreSQL DDL, deferred references, cross-instance locking and rollback', { skip: !connectionString, timeout: 60_000 }, async () => {
  const namespace = 'orbit_test_' + randomUUID().replaceAll('-', '');
  assert.match(namespace, /^orbit_test_[a-f0-9]{32}$/);
  const pool = new Pool({ connectionString, max: 4, connectionTimeoutMillis: 10_000 });
  let created = false;
  const scopedPool = {
    async connect() {
      const client = await pool.connect();
      try { await client.query(`SET search_path TO "${namespace}"`); return client; }
      catch (error) { client.release(error); throw error; }
    },
    async query(sql, values) {
      const client = await this.connect();
      try { return await client.query(sql, values); }
      finally { client.release(); }
    }
  };
  const first = new PostgresStore({ pool: scopedPool, validateState });
  const second = new PostgresStore({ pool: scopedPool, validateState });
  try {
    await pool.query(`CREATE SCHEMA "${namespace}"`); created = true;
    await first.initialize(); await second.initialize();
    await first.begin();
    const initial = await first.loadState();
    initial.users.push({ id: 'synthetic-user' });
    initial.workspaces.push({ id: 'synthetic-workspace' });
    initial.projects.push({ id: 'synthetic-project', workspaceId: 'synthetic-workspace', counter: 0 });
    await first.saveState(initial); await first.commit();
    assert.equal(await first.getRevision(), 1);
    const backup = await exportCloudBackup(first);
    assert.equal(backup.state.projects[0].counter, 0);

    await first.begin(); const a = await first.loadState(); a.projects[0].counter++;
    let acquired = false;
    const pending = second.begin().then(() => { acquired = true; });
    await new Promise(resolve => setTimeout(resolve, 75));
    assert.equal(acquired, false, 'second connection waits for the first transaction lock');
    await first.saveState(a); await first.commit(); await pending;
    const b = await second.loadState(); assert.equal(b.projects[0].counter, 1);
    b.projects[0].counter++; await second.saveState(b); await second.commit();
    assert.equal(await first.getRevision(), 3);

    // Deferred FK checks must reject a broken registry at real COMMIT, leaving
    // both committed entities and revision unchanged after rollback.
    await first.begin(); await first.loadState();
    await first.transactionQuery('DELETE FROM orbit_entities WHERE collection=$1 AND entity_id=$2', ['workspaces', 'synthetic-workspace']);
    await assert.rejects(first.commit(), { code: '23503' });
    assert.equal(first.inTransaction, false); assert.equal(await first.getRevision(), 3);

    // Valid target+dependent deletion works despite SQL's intermediate order.
    await second.begin(); const deleted = await second.loadState();
    deleted.projects = []; deleted.workspaces = [];
    await second.saveState(deleted); await second.commit();
    await first.begin(); const final = await first.loadState();
    assert.equal(final.users.length, 1); assert.equal(final.projects.length, 0); assert.equal(final.workspaces.length, 0);
    await first.rollback();
    assert.equal((await scopedPool.query('SELECT count(*)::integer AS n FROM orbit_relations')).rows[0].n, 0);
    assert.equal(await first.getRevision(), 4);
    // Exercise the operator backup/restore path on this test's own namespace.
    await first.begin(); const empty = await first.loadState(); empty.users = [];
    await first.saveState(empty); await first.commit();
    await restoreCloudBackup(second, backup, { confirmEmptyRestore: true });
    await first.begin(); const restored = await first.loadState();
    assert.equal(restored.projects[0].counter, 0); assert.equal(restored.workspaces.length, 1);
    await first.rollback(); assert.equal(await first.getRevision(), 6);
  } finally {
    await Promise.allSettled([first.close(), second.close()]);
    if (created) await pool.query(`DROP SCHEMA "${namespace}" CASCADE`);
    await pool.end();
  }
});
