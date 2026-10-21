import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {SqliteStore,emptyState} from '../../server/db/store.ts';

test('SQLite updates only modified rows, preserves other workspaces and synchronizes ordered relational changes atomically',()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'orbit-delta-')), store=new SqliteStore(path.join(temporary,'orbit.sqlite'));
  try {
    const state=emptyState(); state.users=[{id:'u'}];state.workspaces=[{id:'a',ownerId:'u'},{id:'b',ownerId:'u'}];
    state.projects=[{id:'pa',workspaceId:'a',title:'A'},{id:'pb',workspaceId:'b',title:'B'}];
    state.tasks=[{id:'ta',workspaceId:'a',projectId:'pa',title:'first'},{id:'tb',workspaceId:'b',projectId:'pb',title:'foreign'}];
    store.saveState(state);
    store.database.exec(`CREATE TABLE writes(kind TEXT, entity TEXT);CREATE TRIGGER observed_task_update AFTER UPDATE ON tasks BEGIN INSERT INTO writes VALUES('task',new.entity_id);END;CREATE TRIGGER observed_project_update AFTER UPDATE ON projects BEGIN INSERT INTO writes VALUES('project',new.entity_id);END;CREATE TRIGGER observed_project_delete AFTER DELETE ON projects BEGIN INSERT INTO writes VALUES('delete',old.entity_id);END;`);
    const next=store.loadState();next.tasks[0].title='edited';store.saveState(next);
    assert.deepEqual(store.database.prepare('SELECT * FROM writes').all().map(row=>({...row})),[{kind:'task',entity:'ta'}]);
    store.database.exec('DELETE FROM writes');store.saveState(store.loadState());assert.equal(store.database.prepare('SELECT count(*) n FROM writes').get().n,0);
    const reordered=store.loadState();reordered.projects.reverse();reordered.tasks.reverse();store.saveState(reordered);
    assert.deepEqual(store.loadState().tasks.map(row=>row.id),['tb','ta']);
    const deleted=store.loadState();deleted.tasks=deleted.tasks.filter(row=>row.id!=='ta');deleted.projects=deleted.projects.filter(row=>row.id!=='pa');store.saveState(deleted);
    assert.deepEqual(store.loadState().projects,[{id:'pb',workspaceId:'b',title:'B'}]);
    assert.equal(store.database.prepare('PRAGMA foreign_key_check').all().length,0);
    const before=store.loadState(),bad=structuredClone(before);bad.tasks[0].projectId='unknown';assert.throws(()=>store.saveState(bad),{code:'DATA_VALIDATION_FAILED'});assert.deepEqual(store.loadState(),before);
    store.begin();const aborted=store.loadState();aborted.tasks[0].title='rolled back';store.saveState(aborted);store.rollback();assert.deepEqual(store.loadState(),before);
  } finally {store.close();fs.rmSync(temporary,{recursive:true,force:true});}
});

test('versioned reference upgrade preserves only existing legacy anomalies and rejects new or reintroduced broken references',()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'orbit-ref-upgrade-')),store=new SqliteStore(path.join(temporary,'orbit.sqlite'));
  try {
    const state=emptyState();state.users=[{id:'u'}];state.workspaces=[{id:'a',ownerId:'u'}];state.tasks=[{id:'legacy',workspaceId:'a',assigneeId:'old-missing'}];
    store.saveState(state,{allowLegacy:true});
    store.database.exec("DELETE FROM metadata WHERE key='domain_references_v1';DELETE FROM legacy_allowlist;DELETE FROM quarantine;");
    store.saveState(store.loadState());assert.equal(store.getStatus().quarantineCount,1);
    const duplicate=store.loadState();duplicate.tasks.push({id:'new',workspaceId:'a',assigneeId:'old-missing'});assert.throws(()=>store.saveState(duplicate),{code:'DATA_VALIDATION_FAILED'});
    const fixed=store.loadState();fixed.tasks[0].assigneeId='u';store.saveState(fixed);
    const broken=store.loadState();broken.tasks[0].assigneeId='old-missing';assert.throws(()=>store.saveState(broken),{code:'DATA_VALIDATION_FAILED'});
    assert.equal(store.getStatus().integrity,'ok');
  }finally{store.close();fs.rmSync(temporary,{recursive:true,force:true});}
});
