import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import express from 'express';

const root = fileURLToPath(new URL('../../', import.meta.url));
test('asset side effects share HTTP commit, rollback and stream boundaries', async t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-stage5-persistence-'));
  const compiled = path.join(temporary, 'persistence.cjs');
  await build({stdin:{contents:"export {PersistenceCoordinator} from './server/persistence.ts'; export {SqliteStore,emptyState} from './server/db/store.ts';",resolveDir:root},outfile:compiled,bundle:true,platform:'node',target:'node24',format:'cjs',logLevel:'silent'});
  const {PersistenceCoordinator,SqliteStore,emptyState} = createRequire(import.meta.url)(compiled);
  t.after(() => {
    assert.equal(path.dirname(path.resolve(temporary)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(temporary).startsWith('orbit-stage5-persistence-'));
    fs.rmSync(temporary,{recursive:true,force:true});
  });
  const fixture = async name => {
    const directory = path.join(temporary,name); fs.mkdirSync(directory);
    const store = new SqliteStore(path.join(directory,'orbit.sqlite'));
    const state = emptyState();
    state.workspaces.push({id:'ws',members:[]}); store.saveState(state);
    let snapshot;
    const db = {
      getState:()=>state,
      beginTransaction(){store.begin();snapshot=structuredClone(state);},
      commitTransaction(){store.saveState(state);store.commit();snapshot=undefined;},
      rollbackTransaction(){store.rollback();if(snapshot){for(const key of Object.keys(state))delete state[key];Object.assign(state,snapshot);}snapshot=undefined;},
    };
    const persistence = new PersistenceCoordinator(db), events = [];
    const app = express();app.use(express.json());app.use(persistence.middleware);
    let streamFinished = false, finishStream;
    app.get('/api/probe',(_req,res)=>res.json({streamFinished}));
    app.post('/api/provision',(req,res)=>{
      const file = path.join(directory,'pending-blob');fs.writeFileSync(file,'real provisioned bytes');
      persistence.onRollback(()=>fs.unlinkSync(file));
      persistence.afterCommit(()=>events.push('committed'));
      state.tasks.push({id:'task',workspaceId:'ws',title:req.body.title});
      res.status(req.body.reject?409:201).json({saved:!req.body.reject});
    });
    app.get('/api/stream',async(req,res,next)=>{try{
      state.tasks.push({id:'stream-record',workspaceId:'ws',title:req.query.fail?'fail':'stream'});
      await persistence.prepareStream();
      res.setHeader('Content-Type','application/octet-stream');res.write('first bytes;');
      finishStream=()=>{streamFinished=true;res.end('last bytes');};
    }catch(error){next(error);}});
    let enteredResolve, closedResolve, continueResolve, lateActive;
    const entered=new Promise(resolve=>enteredResolve=resolve),closed=new Promise(resolve=>closedResolve=resolve),continuation=new Promise(resolve=>continueResolve=resolve);
    app.get('/api/aborted',async(req,res)=>{
      const file=path.join(directory,'aborted-blob');fs.writeFileSync(file,'partial');
      persistence.onRollback(()=>fs.unlinkSync(file));
      state.tasks.push({id:'aborted',workspaceId:'ws'});
      res.once('close',()=>closedResolve());enteredResolve();
      await continuation;lateActive=persistence.isActive();
      if(lateActive)res.json({saved:true});
    });
    app.use((error,_req,res,_next)=>{if(!res.headersSent&&!res.writableEnded)res.status(500).json({error:error.message});});
    const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const origin=`http://127.0.0.1:${server.address().port}`;
    const stop=async()=>{finishStream?.();continueResolve();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await persistence.stop();store.close();};
    return {directory,store,state,persistence,events,origin,stop,finish:()=>finishStream?.(),entered,closed,continue:()=>continueResolve(),lateActive:()=>lateActive};
  };
  await t.test('failed HTTP and SQL writes clean provisioned bytes and emit no commit event',async()=>{
    const f=await fixture('rollback');
    try {
      let response=await fetch(f.origin+'/api/provision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'ordinary',reject:true})});
      assert.equal(response.status,409);assert.equal(fs.existsSync(path.join(f.directory,'pending-blob')),false);assert.deepEqual(f.state.tasks,[]);assert.deepEqual(f.events,[]);
      f.store.database.exec("CREATE TRIGGER reject_write BEFORE INSERT ON tasks WHEN json_extract(NEW.payload,'$.title')='fail' BEGIN SELECT RAISE(ABORT,'disk write fixture'); END");
      response=await fetch(f.origin+'/api/provision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'fail'})});
      assert.equal(response.status,503);assert.equal(fs.existsSync(path.join(f.directory,'pending-blob')),false);assert.deepEqual(f.store.loadState().tasks,[]);assert.deepEqual(f.events,[]);
    } finally {await f.stop();}
  });
  await t.test('stream data begins only after commit and does not hold the API queue until download ends',async()=>{
    const f=await fixture('stream');
    try {
      const download=await fetch(f.origin+'/api/stream');assert.equal(download.status,200);
      assert.equal(f.store.loadState().tasks[0].id,'stream-record');
      const probe=await fetch(f.origin+'/api/probe',{signal:AbortSignal.timeout(2000)});
      assert.deepEqual(await probe.json(),{streamFinished:false});
      f.finish();assert.equal(await download.text(),'first bytes;last bytes');
    } finally {await f.stop();}
  });
  await t.test('SQL failure before streaming returns an error without sending any content bytes',async()=>{
    const f=await fixture('stream-failure');
    try {
      f.store.database.exec("CREATE TRIGGER reject_write BEFORE INSERT ON tasks BEGIN SELECT RAISE(ABORT,'disk write fixture'); END");
      const response=await fetch(f.origin+'/api/stream?fail=true');assert.equal(response.status,503);
      assert.equal((await response.json()).error,'STORAGE_UNAVAILABLE');assert.deepEqual(f.store.loadState().tasks,[]);
    } finally {await f.stop();}
  });
  await t.test('aborting an upload rolls back bytes and makes late asynchronous work inactive',async()=>{
    const f=await fixture('aborted');
    try {
      const abort=new AbortController(), request=fetch(f.origin+'/api/aborted',{signal:abort.signal}).catch(()=>null);
      await f.entered;abort.abort();await f.closed;await request;
      // Close starts asynchronous rollback; the next queued request must observe its completed cleanup.
      assert.equal((await fetch(f.origin+'/api/probe')).status,200);
      assert.equal(fs.existsSync(path.join(f.directory,'aborted-blob')),false);assert.deepEqual(f.state.tasks,[]);
      f.continue();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.lateActive(),false);
      assert.equal((await fetch(f.origin+'/api/probe')).status,200);
    } finally {await f.stop();}
  });
});
