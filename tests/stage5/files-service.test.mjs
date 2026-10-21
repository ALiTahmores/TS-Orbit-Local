import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import express from 'express';
import { DatabaseSync } from 'node:sqlite';

const root=path.resolve(import.meta.dirname,'../..');
const secret='file-service-portal-capability-01234567890123456789';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function noInternals(value){const serialized=JSON.stringify(value);for(const field of ['storageKey','storageFormat','descriptor','filename'])assert.ok(!serialized.includes('"'+field+'"'),field);}

test('file service owns real immutable bytes and coordinates metadata, authorization and rollback',{timeout:120000},async t=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'orbit-file-service-')),data=path.join(temporary,'data'),output=path.join(temporary,'files.cjs');
  await build({stdin:{contents:`export * from './server/files/index.ts';export * from './server/policy/scope.ts';export {SqliteStore} from './server/db/store.ts';export {collectionNames} from './server/db/schema.ts';export {PersistenceCoordinator} from './server/persistence.ts';`,resolveDir:root,sourcefile:'files-test.ts',loader:'ts'},outfile:output,bundle:true,platform:'node',target:'node24',format:'cjs',logLevel:'silent'});
  const {createFileService,createFileRouter,ScopedState,SqliteStore,collectionNames,PersistenceCoordinator,membership,writer}=createRequire(import.meta.url)(output);
  let store=new SqliteStore(path.join(data,'orbit.sqlite')),state=Object.fromEntries(collectionNames.map(name=>[name,[]]));
  state.users=[{id:'a',name:'Owner A',accountStatus:'ACTIVE'},{id:'b',name:'Writer B',accountStatus:'ACTIVE'},{id:'c',name:'Manager C',accountStatus:'ACTIVE'},{id:'d',name:'Foreign System Admin',role:'OWNER',systemRole:'ADMIN',accountStatus:'ACTIVE'},{id:'v',name:'Viewer',accountStatus:'ACTIVE'}];
  state.workspaces=[{id:'wa',ownerId:'a',members:[{userId:'a',role:'OWNER'},{userId:'b',role:'MEMBER',permissions:['read','write']},{userId:'c',role:'ADMIN',permissions:['*']},{userId:'v',role:'VIEWER',permissions:['read']}]},{id:'wd',ownerId:'d',members:[{userId:'d',role:'OWNER'}]}];
  state.departments=[{id:'department',workspaceId:'wa',name:'Department'}];
  state.projects=[{id:'p',workspaceId:'wa',title:'Project A',clientPortalEnabled:true,isPortalActive:true,clientPortalToken:secret},{id:'pd',workspaceId:'wd',title:'Foreign'}];
  state.tasks=[{id:'task',projectId:'p',workspaceId:'wa',title:'Task',attachments:[]}];
  state.conversations=[{id:'conversation',workspaceId:'wa',title:'Private chat'}];state.conversationMembers=[{id:'ca',conversationId:'conversation',userId:'a'},{id:'cb',conversationId:'conversation',userId:'b'}];
  state.files=[{id:'legacy',projectId:'p',workspaceId:'wa',name:'Legacy.pdf',size:'3 MB',url:'https://remote.invalid/secret',approved:true,clientVisible:true,version:3}];
  store.saveState(state);
  let snapshot=null;
  const adapter={getState:()=>state,beginTransaction(){snapshot=JSON.parse(JSON.stringify(state));store.begin();},commitTransaction(){store.saveState(state);store.commit();snapshot=null;},rollbackTransaction(){store.rollback();if(snapshot){for(const key of Object.keys(state))delete state[key];Object.assign(state,snapshot);snapshot=null;}}};
  const scoped=new ScopedState(state),persistence=new PersistenceCoordinator(adapter),events=[];
  const options={scoped,dataDir:data,persistence,broadcast:(event,payload)=>persistence.afterCommit(()=>events.push({event,payload})),broadcastWorkspace:(workspaceId,event,payload)=>persistence.afterCommit(()=>events.push({workspaceId,event,payload}))};
  let service=createFileService(options);
  const app=express();app.use((req,res,next)=>req.headers['x-file-metadata']?next():express.json()(req,res,next));app.use(persistence.middleware);
  app.post('/api/public/portal/:token/files',(req,res,next)=>{const project=state.projects.find(row=>row.clientPortalToken===req.params.token&&row.clientPortalEnabled);if(!project)return res.status(404).json({error:'PORTAL_NOT_FOUND'});void service.uploadPublic(req,res,next,project);});
  app.get('/api/public/portal/:token/files/:id/download',(req,res,next)=>{const project=state.projects.find(row=>row.clientPortalToken===req.params.token&&row.clientPortalEnabled);if(!project)return res.status(404).json({error:'PORTAL_NOT_FOUND'});void service.sendPublic(req,res,next,project,req.params.id);});
  app.get('/api/public/portal/:token/files/:id/versions/:versionId/download',(req,res,next)=>{const project=state.projects.find(row=>row.clientPortalToken===req.params.token&&row.clientPortalEnabled);if(!project)return res.status(404).json({error:'PORTAL_NOT_FOUND'});void service.sendPublic(req,res,next,project,req.params.id,req.params.versionId);});
  app.get('/api/public/portal/:token',(req,res,next)=>{try{const project=state.projects.find(row=>row.clientPortalToken===req.params.token&&row.clientPortalEnabled);if(!project)return res.status(404).json({error:'PORTAL_NOT_FOUND'});res.json({files:service.listPublic(project)});}catch(error){next(error);}});
  app.use((req,res,next)=>{const user=state.users.find(row=>row.id===req.headers['x-user']);if(!user)return res.status(401).json({error:'UNAUTHORIZED'});const workspaceId=req.headers['x-workspace-id']||'wa',grant=membership(state,user,workspaceId);if(!grant)return res.status(403).json({error:'WORKSPACE_FORBIDDEN'});if(!['GET','HEAD'].includes(req.method)&&!writer(grant))return res.status(403).json({error:'READ_ONLY'});scoped.run({kind:'workspace',user,workspaceId,path:req.path,method:req.method},next);});
  // Use a live service reference so restart tests reopen the same files metadata.
  app.use('/api',(req,res,next)=>createFileRouter(service)(req,res,next));
  app.use((error,req,res,next)=>{if(res.headersSent)return next(error);if(!req.complete)res.setHeader('Connection','close');res.status(error.status||500).json({error:error.code||'INTERNAL_ERROR',message:error.message});});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));let origin=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await persistence.stop();store.close();assert.equal(path.dirname(temporary),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(temporary).startsWith('orbit-file-service-'));fs.rmSync(temporary,{recursive:true,force:true});});
  const call=async(route,{body,method=body===undefined?'GET':'PUT',user='a',workspace='wa',headers={},bytes=false}={})=>{const response=await fetch(origin+route,{method,headers:{'x-user':user,'x-workspace-id':workspace,...(body===undefined?{}:{'content-type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:response.status,headers:response.headers,body:bytes?Buffer.from(await response.arrayBuffer()):await response.json()};};
  const upload=async(metadata,bytes,{user='a',workspace='wa',route='/api/files',mime='text/plain',headers={}}={})=>{const response=await fetch(origin+route,{method:'POST',headers:{'x-user':user,'x-workspace-id':workspace,'content-type':mime,'x-file-metadata':encodeURIComponent(JSON.stringify(metadata)),...headers},body:bytes});return{status:response.status,body:await response.json()};};
  const blobNames=()=>fs.readdirSync(path.join(data,'files','blobs')).sort();
  let file,firstVersion,secondVersion;

  await t.test('legacy metadata explicitly lacks content and never follows its remote URL',async()=>{
    const legacy=await call('/api/files/legacy');assert.equal(legacy.status,200);assert.equal(legacy.body.contentAvailable,false);assert.equal(legacy.body.byteSize,null);assert.equal(legacy.body.downloadPath,null);assert.equal(legacy.body.availabilityReason,'LEGACY_METADATA_ONLY');noInternals(legacy.body);assert.ok(!JSON.stringify(legacy.body).includes('remote.invalid'));
    assert.equal((await call('/api/files/legacy/download')).status,404);
    const portal=await call('/api/public/portal/'+secret);assert.equal(portal.body.files.find(row=>row.id==='legacy').contentAvailable,false);
  });
  await t.test('streamed upload persists SHA, real size, author, private paths and atomic task attachment',async()=>{
    const bytes=Buffer.from('اولین فایل واقعی\nHello bytes\n','utf8');const result=await upload({name:'گزارش.txt',taskId:'task',category:'documents'},bytes);assert.equal(result.status,201,JSON.stringify(result));file=result.body;firstVersion=file.currentVersionId;assert.equal(file.byteSize,bytes.length);assert.equal(file.sha256,digest(bytes));assert.equal(file.uploadedBy.id,'a');assert.equal(file.contentAvailable,true);assert.equal(file.version,1);assert.equal(state.tasks[0].attachments[0].id,file.id);assert.equal(state.files.find(row=>row.id===file.id).storageFormat,'orbit-assets-v1');noInternals(file);
    const downloaded=await call(file.downloadPath,{bytes:true});assert.equal(downloaded.status,200);assert.deepEqual(downloaded.body,bytes);assert.equal(downloaded.headers.get('x-content-type-options'),'nosniff');assert.ok(downloaded.headers.get('content-disposition').startsWith('attachment;'));assert.ok(downloaded.headers.get('content-disposition').includes('filename*=UTF-8'));
    const partial=await call(file.downloadPath,{bytes:true,headers:{range:'bytes=0-4'}});assert.equal(partial.status,206);assert.deepEqual(partial.body,bytes.subarray(0,5));assert.ok(partial.headers.get('content-range').startsWith('bytes 0-4/'));
    const head=await fetch(origin+file.downloadPath,{method:'HEAD',headers:{'x-user':'a'}});assert.equal(head.status,200);assert.equal(Number(head.headers.get('content-length')),bytes.length);
    assert.ok(events.some(event=>event.event==='app_tasks_updated'));assert.ok(events.some(event=>event.event==='app_files_updated'));assert.ok(events.every(event=>!JSON.stringify(event.payload).includes('storageKey')));
  });
  await t.test('versions are immutable and old bytes remain downloadable after current version changes',async()=>{
    const oldSha=file.sha256,newBytes=Buffer.from('Second content\n');const result=await upload({name:'گزارش.txt',note:'Revision two'},newBytes,{route:'/api/files/'+file.id+'/versions'});assert.equal(result.status,201,JSON.stringify(result));file=result.body;secondVersion=file.currentVersionId;assert.equal(file.version,2);assert.notEqual(file.sha256,oldSha);assert.equal(file.versionHistory.length,2);assert.equal(state.tasks[0].attachments[0].byteSize,newBytes.length);
    const old=await call(`/api/files/${file.id}/versions/${firstVersion}/download`,{bytes:true});assert.equal(digest(old.body),oldSha);
    const current=await call(file.downloadPath,{bytes:true});assert.deepEqual(current.body,newBytes);
    const list=await call(`/api/files/${file.id}/versions`);assert.equal(list.body[1].note,'Revision two');assert.equal(list.body[1].uploadedBy.id,'a');noInternals(list.body);
    assert.equal((await call(`/api/files/${file.id}/versions/not-this-file/download`)).status,404);
  });
  await t.test('actual scope, parent consistency, writer ceiling, ownership and chat participation are enforced',async()=>{
    assert.equal((await call('/api/files/'+file.id,{user:'d',workspace:'wd'})).status,404);assert.equal((await upload({name:'Bad.txt',projectId:'pd'},Buffer.from('bad'))).status,404);
    assert.equal((await upload({name:'Bad.txt',taskId:'task',projectId:'pd'},Buffer.from('bad'))).status,422);
    assert.equal((await upload({name:'No.txt'},Buffer.from('bad'),{user:'v'})).status,403);
    assert.equal((await upload({name:'No.txt'},Buffer.from('bad'),{user:'b',route:'/api/files/'+file.id+'/versions'})).status,403);
    assert.equal((await call('/api/files/'+file.id,{body:{name:'No.txt'},user:'b'})).status,403);
    assert.equal((await upload({name:'No.txt',approved:true},Buffer.from('bad'),{user:'b'})).status,403);
    const chat=await upload({name:'Chat.txt',conversationId:'conversation'},Buffer.from('private conversation bytes'));assert.equal(chat.status,201,JSON.stringify(chat));assert.equal((await call('/api/files/'+chat.body.id,{user:'b'})).status,200);assert.equal((await call('/api/files/'+chat.body.id,{user:'c'})).status,404);assert.ok(!(await call('/api/files',{user:'c'})).body.some(row=>row.id===chat.body.id));
    assert.equal((await upload({name:'No.txt',conversationId:'conversation'},Buffer.from('bad'),{user:'c'})).status,404);
    assert.equal((await call('/api/files/'+chat.body.id,{body:{approved:true,clientVisible:true}})).status,422);
  });
  await t.test('header parent permissions include department create/update/delete and cannot be spoofed',async()=>{
    state.projects.find(row=>row.id==='p').departmentId='department';state.departmentPermissions.push({id:'deny-create',workspaceId:'wa',departmentId:'department',role:'MEMBER',action:'create',isAllowed:false});
    assert.equal((await upload({name:'No.txt',taskId:'task'},Buffer.from('bad'),{user:'b'})).status,403);
    const own=await upload({name:'Own.txt',taskId:'task'},Buffer.from('own'),{user:'b'});assert.equal(own.status,403);
    state.departmentPermissions=[];
    const permitted=await upload({name:'Own.txt',taskId:'task'},Buffer.from('own'),{user:'b'});assert.equal(permitted.status,201,JSON.stringify(permitted));
    for(const action of ['update','delete'])state.departmentPermissions.push({id:'deny-'+action,workspaceId:'wa',departmentId:'department',role:'MEMBER',action,isAllowed:false});
    assert.equal((await upload({name:'Own.txt'},Buffer.from('revised'),{user:'b',route:'/api/files/'+permitted.body.id+'/versions'})).status,403);
    assert.equal((await call('/api/files/'+permitted.body.id,{method:'DELETE',user:'b'})).status,403);
    state.departmentPermissions=[];delete state.projects.find(row=>row.id==='p').departmentId;
  });
  await t.test('type, MIME, signature, filename, text encoding and real byte bounds reject unsafe inputs without files',async()=>{
    const before=blobNames();
    for(const [name,mime,bytes,status]of [['evil.html','text/html',Buffer.from('<html>evil</html>'),415],['fake.pdf','application/pdf',Buffer.from('not pdf'),415],['image.png','image/png',Buffer.from('<script>evil</script>'),415],['text.txt','application/pdf',Buffer.from('text'),415],['../escape.txt','text/plain',Buffer.from('text'),422],['NUL.txt','text/plain',Buffer.from('text'),422],['bad.txt','text/plain',Buffer.from([255,254,0]),415]]){const result=await upload({name},bytes,{mime});assert.equal(result.status,status,name+': '+JSON.stringify(result));}
    assert.equal((await upload({name:'forged.txt',uploadedById:'d'},Buffer.from('bytes'))).status,422);
    assert.deepEqual(blobNames(),before);assert.deepEqual(fs.readdirSync(path.join(data,'files','staging')),[]);
    const previous=process.env.FILE_MAX_BYTES;process.env.FILE_MAX_BYTES='16';service=createFileService(options);try{assert.equal((await upload({name:'large.txt'},Buffer.alloc(17,97))).status,413);assert.deepEqual(blobNames(),before);}finally{if(previous===undefined)delete process.env.FILE_MAX_BYTES;else process.env.FILE_MAX_BYTES=previous;service=createFileService(options);}
  });
  await t.test('SQL rejection removes provisioned bytes and rolls back version, task attachment and audit changes',async()=>{
    const before={state:JSON.stringify(state),blobs:blobNames(),events:events.length};
    const sql=new DatabaseSync(path.join(data,'orbit.sqlite'));sql.exec(`CREATE TRIGGER files_fixture_reject BEFORE INSERT ON fileVersions WHEN json_extract(NEW.payload,'$.name')='Reject.txt' BEGIN SELECT RAISE(ABORT,'isolated file fixture rejection'); END`);sql.close();
    try{const rejected=await upload({name:'Reject.txt',taskId:'task'},Buffer.from('should disappear'));assert.equal(rejected.status,503,JSON.stringify(rejected));assert.equal(JSON.stringify(state),before.state);assert.deepEqual(blobNames(),before.blobs);assert.equal(events.length,before.events);}
    finally{const repair=new DatabaseSync(path.join(data,'orbit.sqlite'));repair.exec('DROP TRIGGER files_fixture_reject');repair.close();}
  });
  await t.test('aborted streamed upload never appends metadata or leaves staging content',async()=>{
    const before={files:state.files.length,versions:state.fileVersions.length,blobs:blobNames()};
    await new Promise(resolve=>{const req=http.request(origin+'/api/files',{method:'POST',headers:{'x-user':'a','content-type':'text/plain','x-file-metadata':encodeURIComponent(JSON.stringify({name:'Aborted.txt',taskId:'task'})),'transfer-encoding':'chunked'}});req.on('error',()=>resolve());req.on('response',response=>{response.resume();resolve();});req.write(Buffer.alloc(4096,97));setTimeout(()=>{req.destroy();resolve();},50);});
    await new Promise(resolve=>setTimeout(resolve,150));assert.equal(state.files.length,before.files);assert.equal(state.fileVersions.length,before.versions);assert.deepEqual(blobNames(),before.blobs);assert.deepEqual(fs.readdirSync(path.join(data,'files','staging')),[]);
    assert.equal((await call('/api/files/'+file.id)).status,200);
  });
  await t.test('public upload forces provenance and pending approval; only approved visible bytes are public',async()=>{
    const route='/api/public/portal/'+secret+'/files',created=await upload({name:'Client.txt',category:'documents'},Buffer.from('Client supplied file'),{route});assert.equal(created.status,201,JSON.stringify(created));const client=created.body,stored=state.files.find(row=>row.id===client.id);assert.equal(stored.projectId,'p');assert.equal(stored.publicUpload,true);assert.equal(stored.approved,false);assert.equal(stored.clientVisible,false);assert.equal(stored.uploadedById,undefined);assert.equal(client.downloadPath,null);assert.equal(client.uploadedBy,undefined);assert.equal(client.projectId,undefined);
    assert.equal((await upload({name:'No.txt',approved:true},Buffer.from('bad'),{route})).status,422);assert.equal((await call(`/api/public/portal/${secret}/files/${client.id}/download`)).status,404);assert.ok(service.validatePublicAttachment(state.projects[0],client.id));assert.ok(!service.validatePublicAttachment(state.projects[0],client.id,true));
    const approved=await call('/api/files/'+client.id,{body:{approved:true,clientVisible:true}});assert.equal(approved.status,200,JSON.stringify(approved));const list=await call('/api/public/portal/'+secret);const publicFile=list.body.files.find(row=>row.id===client.id);assert.ok(publicFile.downloadPath);const bytes=await call(publicFile.downloadPath,{bytes:true});assert.equal(bytes.body.toString(),'Client supplied file');
    assert.equal((await call('/api/public/portal/wrong-capability/files/'+client.id+'/download')).status,404);
    state.projects[0].clientPortalEnabled=false;assert.equal((await call(publicFile.downloadPath)).status,404);state.projects[0].clientPortalEnabled=true;
  });
  await t.test('public current and historical versions require their own approval and hide internal notes, users and parents',async()=>{
    const created=await upload({name:'Shared.txt',taskId:'task',approved:true,clientVisible:true,note:'INTERNAL_NOTE_SHOULD_NOT_PUBLIC'},Buffer.from('approved version one'));assert.equal(created.status,201,JSON.stringify(created));const shared=created.body,versionOne=shared.currentVersionId;
    let publicFile=(await call('/api/public/portal/'+secret)).body.files.find(row=>row.id===shared.id);assert.ok(publicFile);assert.equal(publicFile.taskId,undefined);assert.equal(publicFile.workspaceId,undefined);assert.equal(publicFile.uploadedBy,undefined);assert.ok(!JSON.stringify(publicFile).includes('INTERNAL_NOTE_SHOULD_NOT_PUBLIC'));assert.equal(publicFile.versionHistory[0].note,undefined);assert.equal(publicFile.versionHistory[0].uploadedBy,undefined);
    state.fileVersions.find(row=>row.id===versionOne).approved=false;assert.ok(!(await call('/api/public/portal/'+secret)).body.files.some(row=>row.id===shared.id));assert.equal((await call(`/api/public/portal/${secret}/files/${shared.id}/download`)).status,404);state.fileVersions.find(row=>row.id===versionOne).approved=true;
    const second=await upload({name:'Shared.txt',note:'PRIVATE SECOND NOTE'},Buffer.from('unapproved version two'),{route:`/api/files/${shared.id}/versions`});assert.equal(second.status,201,JSON.stringify(second));const versionTwo=second.body.currentVersionId;assert.equal((await call(`/api/public/portal/${secret}/files/${shared.id}/versions/${versionOne}/download`)).status,404);
    const third=await upload({name:'Shared.txt',approved:true,clientVisible:true},Buffer.from('approved version three'),{route:`/api/files/${shared.id}/versions`});assert.equal(third.status,201,JSON.stringify(third));
    publicFile=(await call('/api/public/portal/'+secret)).body.files.find(row=>row.id===shared.id);assert.deepEqual(publicFile.versionHistory.map(row=>row.version),[1,3]);assert.ok(!JSON.stringify(publicFile).includes('PRIVATE SECOND NOTE'));assert.equal((await call(`/api/public/portal/${secret}/files/${shared.id}/versions/${versionTwo}/download`)).status,404);const old=await call(`/api/public/portal/${secret}/files/${shared.id}/versions/${versionOne}/download`,{bytes:true});assert.equal(old.body.toString(),'approved version one');
  });
  await t.test('reopened SQLite and storage retain exact bytes, hashes and version history',async()=>{
    store.close();store=new SqliteStore(path.join(data,'orbit.sqlite'));const persisted=store.loadState();for(const key of Object.keys(state))delete state[key];Object.assign(state,persisted);service=createFileService(options);assert.equal(service.collectDeleted().skippedActive,undefined);
    const current=await call('/api/files/'+file.id);assert.equal(current.status,200);assert.equal(current.body.currentVersionId,secondVersion);assert.equal(current.body.versionHistory.length,2);const downloaded=await call(current.body.downloadPath,{bytes:true});assert.equal(digest(downloaded.body),current.body.sha256);assert.equal((await call(`/api/files/${file.id}/versions/${firstVersion}/download`,{bytes:true})).status,200);
  });
  await t.test('symlinks, tampered bytes and traversal keys cannot redirect downloads or cleanup',async()=>{
    const version=()=>state.fileVersions.find(row=>row.id===secondVersion),filename=path.join(data,'files','blobs',version().storageKey),original=fs.readFileSync(filename);fs.writeFileSync(filename,Buffer.alloc(original.length,88));assert.equal((await call(file.downloadPath)).status,409);fs.writeFileSync(filename,original);
    const oldKey=version().storageKey;version().storageKey='../outside';assert.equal((await call('/api/files/'+file.id)).body.contentAvailable,false);version().storageKey=oldKey;
    const outside=path.join(temporary,'outside.txt');fs.writeFileSync(outside,'outside must survive');const link=path.join(data,'files','blobs',randomUUID());let supported=true;try{fs.symlinkSync(outside,link,'file');}catch(error){if(['EPERM','EACCES'].includes(error.code))supported=false;else throw error;}
    if(supported){const originalKey=version().storageKey;version().storageKey=path.basename(link);assert.equal((await call('/api/files/'+file.id)).status,503);assert.throws(()=>service.collectDeleted(),/مسیر|امن/);version().storageKey=originalKey;fs.unlinkSync(link);}assert.equal(fs.readFileSync(outside,'utf8'),'outside must survive');
  });
  await t.test('soft delete detaches task references, removes safe owned bytes after commit and retries orphan cleanup',async()=>{
    const keys=state.fileVersions.filter(row=>row.fileId===file.id).map(row=>row.storageKey);assert.equal((await call('/api/files/'+file.id,{method:'DELETE'})).status,200);assert.ok(state.files.find(row=>row.id===file.id).deletedAt);assert.ok(!state.tasks[0].attachments.some(row=>row.id===file.id));assert.ok(keys.every(key=>!fs.existsSync(path.join(data,'files','blobs',key))));assert.equal((await call('/api/files/'+file.id)).status,404);
    const orphan=randomUUID(),stage=randomUUID()+'.part';fs.writeFileSync(path.join(data,'files','blobs',orphan),'orphan');fs.writeFileSync(path.join(data,'files','staging',stage),'partial');const unmanaged='manual-reference.txt';fs.writeFileSync(path.join(data,'files','blobs',unmanaged),'do not touch');const result=service.collectDeleted();assert.equal(result.deletedBlobs,1);assert.equal(result.deletedStages,1);assert.ok(fs.existsSync(path.join(data,'files','blobs',unmanaged)));
    const database=new DatabaseSync(path.join(data,'orbit.sqlite'),{readOnly:true});try{assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(),[]);}finally{database.close();}
  });
});
