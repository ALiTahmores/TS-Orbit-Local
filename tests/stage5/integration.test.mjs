import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {once} from 'node:events';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {SqliteStore} from '../../server/db/store.ts';

const root=path.resolve(import.meta.dirname,'../..'),password='AssetIntegrationFixture42!';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const environment=data=>({...process.env,PROJECT_ROOT:root,NODE_ENV:'production',DATA_DIR:data,HOST:'127.0.0.1',PORT:'3000',APP_ORIGIN:'',ALLOW_NETWORK_ACCESS:'',LEGACY_DB_IMPORT:''});
function cli(data,entry,args,input){return spawnSync(process.execPath,[path.join(root,'dist/server',entry+'.cjs'),...args],{cwd:root,env:environment(data),input,windowsHide:true,encoding:'utf8',timeout:20000});}
async function start(data,reuse){const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=reuse||listener.address().port;await new Promise(resolve=>listener.close(resolve));const origin=`http://127.0.0.1:${port}`,child=spawn(process.execPath,[path.join(root,'dist/server/server.cjs')],{cwd:root,env:{...environment(data),PORT:String(port),APP_ORIGIN:origin},windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);for(let index=0;index<200;index++){if(child.exitCode!==null)throw Error(output);try{if((await fetch(origin+'/api/projects',{signal:AbortSignal.timeout(1000)})).status===401)return{child,origin,port,data};}catch{}await new Promise(resolve=>setTimeout(resolve,50));}child.kill();throw Error('Asset server startup failed: '+output);}
async function stop(runtime){if(!runtime||runtime.child.exitCode!==null||runtime.child.signalCode!==null)return;const done=once(runtime.child,'close');runtime.child.kill();await done;}
function state(data){const store=new SqliteStore(path.join(data,'orbit.sqlite'));try{return store.loadState();}finally{store.close();}}

test('compiled file and portal routes preserve real bytes, identity, history and recovery',{timeout:120000},async t=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'orbit-stage5-integration-')),data=path.join(temporary,'data');let runtime,owner,member,workspace,memberWorkspace,project,other,task,asset,memberAsset,guestAsset,feedback,portal;
  const first=Buffer.from('{"message":"سلام","version":1}\n'),second=Buffer.from('{"message":"persisted next version","version":2}\n');
  t.after(async()=>{await stop(runtime);assert.equal(path.dirname(path.resolve(temporary)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(temporary).startsWith('orbit-stage5-integration-'));fs.rmSync(temporary,{recursive:true,force:true});});
  const bootstrap=cli(data,'local-account',['bootstrap','--email','asset-owner@example.test','--name','Asset Owner','--phone','09110000001','--password-stdin'],password+'\n'+password+'\n');assert.equal(bootstrap.status,0,bootstrap.stdout+bootstrap.stderr);
  runtime=await start(data);
  const request=async(endpoint,body,method=body===undefined?'GET':'POST',actor='owner',scope=workspace)=>{const response=await fetch(runtime.origin+endpoint,{method,signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json',...(actor==='public'?{}:{Authorization:'Bearer '+(actor==='member'?member?.token:owner?.token)}),...(actor==='public'||!scope?{}:{'x-workspace-id':scope})},...(body===undefined?{}:{body:JSON.stringify(body)})});const raw=await response.text();let value;try{value=JSON.parse(raw);}catch{value=raw;}return{status:response.status,body:value};};
  const ok=(result,status=200)=>{assert.equal(result.status,status,JSON.stringify(result));return result.body;};
  const upload=async(bytes,metadata,{id,actor='owner',scope=workspace,token,mime='application/json'}={})=>{const response=await fetch(runtime.origin+(token?'/api/public/portal/'+encodeURIComponent(token)+'/files':id?'/api/files/'+encodeURIComponent(id)+'/versions':'/api/files'),{method:'POST',signal:AbortSignal.timeout(10000),headers:{'Content-Type':mime,'X-File-Metadata':encodeURIComponent(JSON.stringify(metadata)),...(token?{}:{Authorization:'Bearer '+(actor==='member'?member.token:owner.token),'x-workspace-id':scope})},body:bytes});return{status:response.status,body:await response.json()};};
  const download=(id,{version,token,actor='owner',scope=workspace,method='GET',range}={})=>fetch(runtime.origin+(token?'/api/public/portal/'+encodeURIComponent(token)+'/files/':'/api/files/')+encodeURIComponent(id)+(version?'/versions/'+encodeURIComponent(version):'')+'/download',{method,signal:AbortSignal.timeout(10000),headers:{...(token?{}:{Authorization:'Bearer '+(actor==='member'?member.token:owner.token),'x-workspace-id':scope}),...(range?{Range:range}:{})}});
  owner=ok(await request('/api/auth/login',{identifier:'asset-owner@example.test',password},'POST','public'));
  ok(await request('/api/auth/register',{email:'asset-member@example.test',name:'Asset Member',username:'asset_member',phone:'09110000002',password},'POST','public'),201);
  member=ok(await request('/api/auth/login',{identifier:'asset-member@example.test',password},'POST','public'));
  const identities=state(data).users;workspace=identities.find(row=>row.email==='asset-owner@example.test').personalWorkspaceId;const memberUser=identities.find(row=>row.email==='asset-member@example.test');memberWorkspace=memberUser.personalWorkspaceId;
  ok(await request('/api/workspaces/members',{workspaceId:workspace,targetUserId:memberUser.id,role:'MEMBER'}));
  project=ok(await request('/api/projects',{title:'Actual file project',budget:'private budget',isBudgetConfidential:true}),201);other=ok(await request('/api/projects',{title:'Other portal project'}),201);portal=project.portalToken;
  task=ok(await request('/api/tasks',{title:'File-linked task',projectId:project.id}),201);

  await t.test('raw JSON uploads reach the file parser and atomically attach server-owned metadata',async()=>{
    assert.match(project.portalExpiresAt,/^\d{4}-\d{2}-\d{2}T/);
    asset=ok(await upload(first,{name:'مدرک.json',projectId:project.id,taskId:task.id}),201);
    assert.equal(asset.sha256,digest(first));assert.equal(asset.byteSize,first.length);assert.equal(asset.uploadedBy.name,'Asset Owner');assert.equal(asset.contentAvailable,true);
    for(const key of ['storageKey','storagePath','absolutePath'])assert.equal(Object.hasOwn(asset,key),false);
    assert.equal(ok(await request('/api/tasks/'+task.id)).attachments[0].id,asset.id);
    assert.equal(ok(await request('/api/files?projectId='+project.id)).length,1);
    const response=await download(asset.id);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),first);assert.match(response.headers.get('Content-Disposition'),/filename\*=/);assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
  });
  await t.test('production policy supports HEAD/ranges and truthful file validation errors',async()=>{
    let response=await download(asset.id,{method:'HEAD'});assert.equal(response.status,200);assert.equal(Number(response.headers.get('Content-Length')),first.length);assert.equal((await response.arrayBuffer()).byteLength,0);
    response=await download(asset.id,{range:'bytes=0-6'});assert.equal(response.status,206);assert.deepEqual(Buffer.from(await response.arrayBuffer()),first.subarray(0,7));
    response=await download(asset.id,{range:'bytes=999999-'});assert.equal(response.status,416);assert.equal((await response.json()).error,'INVALID_FILE_RANGE');
    assert.equal((await upload(first,{name:'program.exe'})).status,415);
    assert.equal((await upload(first,{name:'mismatch.json'},{mime:'image/png'})).status,415);
    assert.equal((await upload(Buffer.from('not a pdf'),{name:'mismatch.pdf'},{mime:'application/pdf'})).status,415);
    assert.equal((await upload(first,{name:'forged.json',uploadedById:memberUser.id})).status,422);
  });
  await t.test('ordinary writers can upload but cannot publish, overwrite another author or cross workspace',async()=>{
    memberAsset=ok(await upload(first,{name:'member.json',projectId:project.id},{actor:'member'}),201);
    assert.equal(memberAsset.uploadedBy.id,memberUser.id);
    assert.equal((await request('/api/files/'+memberAsset.id,{approved:true},'PUT','member')).status,403);
    assert.equal((await upload(second,{name:'overwrite.json'},{id:asset.id,actor:'member'})).status,403);
    assert.equal((await request('/api/files/'+asset.id,undefined,'GET','member',memberWorkspace)).status,404);
    assert.equal((await download(asset.id,{actor:'member',scope:memberWorkspace})).status,404);
  });
  await t.test('new versions preserve prior byte content and approval remains explicit per version',async()=>{
    const previous=asset.currentVersionId;asset=ok(await upload(second,{name:'مدرک.json',note:'Second real version'},{id:asset.id}),201);
    assert.equal(asset.version,2);assert.equal(asset.versionHistory.length,2);assert.notEqual(asset.currentVersionId,previous);
    assert.deepEqual(Buffer.from(await(await download(asset.id,{version:previous})).arrayBuffer()),first);
    assert.deepEqual(Buffer.from(await(await download(asset.id)).arrayBuffer()),second);
    asset=ok(await request('/api/files/'+asset.id,{approved:true,clientVisible:true},'PUT'));
    const snapshot=ok(await request('/api/public/portal/'+portal,undefined,'GET','public'));
    assert.equal(Object.hasOwn(snapshot.project,'budget'),false);assert.equal(snapshot.files.length,1);assert.equal(snapshot.files[0].versionHistory.length,1);
    for(const key of ['workspaceId','taskId','uploadedById','storageKey','tag'])assert.equal(Object.hasOwn(snapshot.files[0],key),false,key);
    assert.deepEqual(Buffer.from(await(await download(asset.id,{token:portal})).arrayBuffer()),second);
    assert.equal((await download(asset.id,{version:previous,token:portal})).status,404);
    assert.equal((await download(asset.id,{token:other.portalToken})).status,404);
    assert.equal((await request('/api/public/portal/'+project.id,undefined,'GET','public')).status,404);
  });
  await t.test('client attachments and feedback persist safe history, owner notifications and actual replies',async()=>{
    guestAsset=ok(await upload(first,{name:'client.json'},{token:portal}),201);assert.equal(guestAsset.approved,false);assert.equal(guestAsset.downloadPath,null);
    assert.equal((await download(guestAsset.id,{token:portal})).status,404);
    feedback=ok(await request('/api/public/portal/'+portal+'/feedback',{senderName:'Real client input',content:'Persist this feedback',attachments:[guestAsset.id]},'POST','public'),201).feedback;
    assert.equal(ok(await request('/api/projects/'+project.id+'/feedbacks')).some(row=>row.id===feedback.id),true);
    assert.equal(ok(await request('/api/projects/'+project.id)).clientFeedbacks.some(row=>row.id===feedback.id),true);
    assert.ok(state(data).notifications.some(row=>row.feedbackId===feedback.id));
    assert.equal((await request('/api/projects/'+project.id+'/feedbacks/'+feedback.id+'/status',{status:'approved'},'PUT','member')).status,403);
    const changed=ok(await request('/api/projects/'+project.id+'/feedbacks/'+feedback.id+'/status',{status:'approved',reply:'Approved with actual reply'},'PUT'));assert.equal(changed.approved,true);assert.equal(changed.replies.length,1);
    const publicRow=ok(await request('/api/public/portal/'+portal,undefined,'GET','public')).feedback.find(row=>row.id===feedback.id);
    assert.equal(publicRow.replies[0].message,'Approved with actual reply');assert.equal(Object.hasOwn(publicRow.replies[0],'actorId'),false);assert.equal(Object.hasOwn(publicRow.history[0],'actorId'),false);
    assert.equal((await request('/api/projects/'+other.id+'/feedbacks/'+feedback.id+'/status',{status:'resolved'},'PUT')).status,404);
    assert.equal((await request('/api/public/portal/'+other.portalToken+'/feedback',{senderName:'Client',content:'Cross file',attachments:[guestAsset.id]},'POST','public')).status,422);
  });
  await t.test('rotation, revocation, expiry and re-enable affect downloads immediately',async()=>{
    const old=portal;portal=ok(await request('/api/projects/'+project.id+'/portal-token',{})).token;assert.notEqual(portal,old);
    assert.equal((await download(asset.id,{token:old})).status,404);assert.equal((await download(asset.id,{token:portal})).status,200);
    ok(await request('/api/projects/'+project.id+'/portal-token',{},'DELETE'));assert.equal((await download(asset.id,{token:portal})).status,404);
    const reopened=ok(await request('/api/projects/'+project.id+'/portal',{enabled:true},'PUT')).project;assert.notEqual(reopened.portalToken,portal);portal=reopened.portalToken;
    ok(await request('/api/projects/'+project.id+'/portal',{enabled:true,expiresAt:'2020-01-01T00:00:00Z'},'PUT'));assert.equal((await download(asset.id,{token:portal})).status,404);
    ok(await request('/api/projects/'+project.id+'/portal',{enabled:true,expiresAt:null},'PUT'));assert.equal((await download(asset.id,{token:portal})).status,200);
  });
  await t.test('SQL failure after publishing bytes returns 503 and leaves no new metadata or blob',async()=>{
    const before=state(data),blobs=fs.readdirSync(path.join(data,'files','blobs')).sort();
    const store=new SqliteStore(path.join(data,'orbit.sqlite'));try{store.database.exec("CREATE TRIGGER fail_asset_insert BEFORE INSERT ON fileVersions WHEN json_extract(NEW.payload,'$.name')='fail.json' BEGIN SELECT RAISE(ABORT,'forced asset write failure'); END");}finally{store.close();}
    const failed=await upload(first,{name:'fail.json',projectId:project.id});assert.equal(failed.status,503);
    const after=state(data);assert.deepEqual(after.files,before.files);assert.deepEqual(after.fileVersions,before.fileVersions);assert.deepEqual(fs.readdirSync(path.join(data,'files','blobs')).sort(),blobs);assert.deepEqual(fs.readdirSync(path.join(data,'files','staging')),[]);
    const cleanup=new SqliteStore(path.join(data,'orbit.sqlite'));try{cleanup.database.exec('DROP TRIGGER fail_asset_insert');}finally{cleanup.close();}
  });
  await t.test('restart preserves versions and historical nested feedback remains mutable through production policy',async()=>{
    const port=runtime.port;await stop(runtime);
    const store=new SqliteStore(path.join(data,'orbit.sqlite'));try{const saved=store.loadState(),target=saved.projects.find(row=>row.id===project.id);target.clientFeedbacks=[{id:'legacy_feedback',senderName:'Historical client',message:'Imported nested feedback',status:'pending',clientVisible:true,createdAt:'2020-01-01T00:00:00Z'}];saved.projects.find(row=>row.id===other.id).portalExpiresAt='2099-02-31T00:00:00Z';store.saveState(saved);}finally{store.close();}
    runtime=await start(data,port);
    assert.deepEqual(Buffer.from(await(await download(asset.id)).arrayBuffer()),second);
    assert.equal(ok(await request('/api/projects/'+project.id+'/feedbacks')).some(row=>row.id==='legacy_feedback'),true);assert.equal(state(data).feedback.some(row=>row.id==='legacy_feedback'),false);
    const changed=ok(await request('/api/projects/'+project.id+'/feedbacks/legacy_feedback/status',{status:'in_progress'},'PUT'));assert.equal(changed.history.length,1);assert.equal(state(data).feedback.some(row=>row.id==='legacy_feedback'),true);
    ok(await request('/api/projects/'+project.id+'/feedbacks/legacy_feedback',{},'DELETE'));assert.equal(ok(await request('/api/projects/'+project.id+'/feedbacks')).some(row=>row.id==='legacy_feedback'),false);
    assert.equal((await request('/api/public/portal/'+other.portalToken,undefined,'GET','public')).status,404);
  });
  await t.test('a private backup restores both historical and current downloads with the same digests',async()=>{
    const port=runtime.port;await stop(runtime);const backup=path.join(temporary,'backup'),restored=path.join(temporary,'restored');
    let result=cli(data,'database',['backup','--output',backup]);assert.equal(result.status,0,result.stdout+result.stderr);
    result=cli(restored,'database',['restore','--source',backup]);assert.equal(result.status,0,result.stdout+result.stderr);
    runtime=await start(restored,port);
    assert.equal(digest(Buffer.from(await(await download(asset.id)).arrayBuffer())),digest(second));
    const versions=ok(await request('/api/files/'+asset.id+'/versions'));assert.equal(versions.length,2);
    assert.equal(digest(Buffer.from(await(await download(asset.id,{version:versions[0].id})).arrayBuffer())),digest(first));
    assert.equal(digest(Buffer.from(await(await download(asset.id,{token:portal})).arrayBuffer())),digest(second));
    assert.equal(ok(await request('/api/projects/'+project.id+'/feedbacks')).find(row=>row.id===feedback.id).status,'approved');
  });
  await t.test('file deletion removes retained bytes and task links while preserving unrelated assets',async()=>{
    const saved=state(runtime.data),keys=saved.fileVersions.filter(row=>row.fileId===asset.id).map(row=>row.storageKey);
    ok(await request('/api/files/'+asset.id,{},'DELETE'));assert.equal((await download(asset.id)).status,404);assert.equal((await download(asset.id,{token:portal})).status,404);
    for(const key of keys)assert.equal(fs.existsSync(path.join(runtime.data,'files','blobs',key)),false);
    assert.equal(ok(await request('/api/tasks/'+task.id)).attachments.some(row=>(typeof row==='string'?row:row.id)===asset.id),false);
    assert.deepEqual(Buffer.from(await(await download(memberAsset.id)).arrayBuffer()),first);
  });
});
