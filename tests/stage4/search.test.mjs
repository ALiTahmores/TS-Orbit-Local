import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { collectionNames } from '../../server/db/schema.ts';

// Advanced search: OQL runs only over the caller's visible work, answers a bad
// query with its message and position, saved filters keep their owners'
// rights, and bulk changes follow each task's own rules.
const root=path.resolve(import.meta.dirname,'../..');
const password='SearchFixture42!';
const environment=data=>({...process.env,PROJECT_ROOT:root,NODE_ENV:'production',DATA_DIR:data,HOST:'127.0.0.1',PORT:'3000',APP_ORIGIN:'',ALLOW_NETWORK_ACCESS:'',LEGACY_DB_IMPORT:''});
function read(data){const db=new DatabaseSync(path.join(data,'orbit.sqlite'),{readOnly:true});try{return Object.fromEntries(collectionNames.map(name=>[name,db.prepare(`SELECT payload FROM "${name}" ORDER BY ordinal`).all().map(row=>JSON.parse(row.payload))]));}finally{db.close();}}
async function start(data){const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));const origin=`http://127.0.0.1:${port}`;const child=spawn(process.execPath,[path.join(root,'dist/server/server.cjs')],{cwd:root,env:{...environment(data),PORT:String(port),APP_ORIGIN:origin},windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);for(let i=0;i<300;i++){if(child.exitCode!==null)throw new Error(output);try{if((await fetch(origin+'/api/projects',{signal:AbortSignal.timeout(1000)})).status===401)return{child,origin};}catch{}await new Promise(resolve=>setTimeout(resolve,50));}child.kill();throw new Error('Search startup failed: '+output);}
async function stop(runtime){if(!runtime||runtime.child.exitCode!==null||runtime.child.signalCode!==null)return;const closed=once(runtime.child,'close');runtime.child.kill();await closed;}
async function request(runtime,endpoint,{body,token,workspace,method=body===undefined?'GET':'POST'}={}){const payload=body===undefined?undefined:JSON.stringify(body);const response=await fetch(runtime.origin+endpoint,{method,signal:AbortSignal.timeout(8000),headers:{...(payload===undefined?{}:{'content-type':'application/json'}),...(token?{authorization:'Bearer '+token}:{}),...(workspace?{'x-workspace-id':workspace}:{})},...(payload===undefined?{}:{body:payload})});const value=await response.text();let result;try{result=JSON.parse(value);}catch{result=value;}return{status:response.status,body:result};}
const day=offset=>new Date(Date.now()+offset*86_400_000).toISOString().slice(0,10);

test('advanced search finds visible work, explains bad queries and keeps filters safe',{timeout:120000},async t=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'orbit-search-')),data=path.join(temporary,'data');let runtime;
  t.after(async()=>{await stop(runtime);fs.rmSync(temporary,{recursive:true,force:true});});
  const bootstrap=spawnSync(process.execPath,[path.join(root,'dist/server/local-account.cjs'),'bootstrap','--email','search-owner@example.test','--name','Search Owner','--phone','09110000061','--password-stdin'],{cwd:root,env:environment(data),input:password+'\n'+password+'\n',encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(bootstrap.status,0,bootstrap.stdout+bootstrap.stderr);
  runtime=await start(data);
  const login=async email=>{const result=await request(runtime,'/api/auth/login',{body:{identifier:email,password}});assert.equal(result.status,200,JSON.stringify(result));return result.body;};
  const owner=await login('search-owner@example.test');
  for(const [email,phone,username] of [['search-member@example.test','09110000062','search_member'],['search-viewer@example.test','09110000063','search_viewer'],['search-outsider@example.test','09110000064','search_outsider']])
    assert.equal((await request(runtime,'/api/auth/register',{body:{email,name:username,username,phone,password}})).status,201);
  const member=await login('search-member@example.test'),viewer=await login('search-viewer@example.test'),outsider=await login('search-outsider@example.test');
  const users=read(data).users,wa=users.find(user=>user.email==='search-owner@example.test').personalWorkspaceId;
  const ownerId=users.find(user=>user.email==='search-owner@example.test').id,memberId=users.find(user=>user.email==='search-member@example.test').id;
  const tokens={owner:owner.token,member:member.token,viewer:viewer.token};
  const api=(endpoint,body,method,actor='owner')=>request(runtime,endpoint,{body,method:method||(body===undefined?'GET':'POST'),token:tokens[actor],workspace:wa});
  for(const [email,role] of [['search-member@example.test','MEMBER'],['search-viewer@example.test','VIEWER']])
    assert.equal((await api('/api/workspaces/members',{workspaceId:wa,targetUserId:read(data).users.find(user=>user.email===email).id,role})).status,200);
  const web=(await api('/api/projects',{title:'Website'})).body,mobile=(await api('/api/projects',{title:'Mobile'})).body;
  const create=async body=>{const result=await api('/api/tasks',body);assert.equal(result.status,201,JSON.stringify(result));return result.body;};
  const t1=await create({projectId:web.id,title:'Login page',type:'story',priority:'high',storyPoints:5,tags:['urgent','web'],assignedMemberIds:[ownerId],dueDate:day(-2)});
  const t2=await create({projectId:web.id,title:'Login crash on Safari',type:'bug',priority:'critical',storyPoints:3,assignedMemberIds:[memberId],dueDate:day(3),status:'inprogress'});
  const t3=await create({projectId:web.id,title:'Footer links',type:'task',priority:'low',assignedMemberIds:[]});
  assert.equal((await api(`/api/tasks/${t3.id}/status`,{status:'completed'},'PUT')).status,200);
  const t4=await create({projectId:mobile.id,title:'Push login',type:'bug',priority:'medium',storyPoints:8,tags:['mobile'],assignedMemberIds:[ownerId],status:'review'});
  const epic=await create({projectId:web.id,title:'Auth',type:'epic'});
  assert.equal((await api('/api/epics/link',{projectId:web.id,epicId:epic.id,taskIds:[t1.id,t2.id]},'PUT')).status,200);
  const sprint=(await api('/api/sprints',{projectId:web.id})).body;
  assert.equal((await api('/api/backlog/move',{projectId:web.id,taskIds:[t1.id],sprintId:sprint.id},'PUT')).status,200);
  // Work in another workspace must never show up.
  const outsiderWorkspace=read(data).users.find(user=>user.email==='search-outsider@example.test').personalWorkspaceId;
  const foreign=(await request(runtime,'/api/projects',{body:{title:'Secret'},token:outsider.token,workspace:outsiderWorkspace})).body;
  assert.equal((await request(runtime,'/api/tasks',{body:{projectId:foreign.id,title:'Login secret plan'},token:outsider.token,workspace:outsiderWorkspace})).status,201);

  const search=async(q,actor='owner',extra='')=>{const result=await api(`/api/search?q=${encodeURIComponent(q)}&today=${day(0)}&offset=0${extra}`,undefined,'GET',actor);assert.equal(result.status,200,JSON.stringify(result));return result.body;};
  const titles=async(q,actor)=>{const result=await search(q,actor);assert.equal(result.error,null,`${q}: ${JSON.stringify(result.error)}`);return result.rows.map(row=>row.title).sort();};

  await t.test('fields, operators and functions match the right work',async()=>{
    assert.deepEqual(await titles('project = Website AND type = bug'),['Login crash on Safari']);
    assert.deepEqual(await titles('status = open AND type != epic'),['Login crash on Safari','Login page','Push login']);
    assert.deepEqual(await titles('priority >= high'),['Login crash on Safari','Login page']);
    assert.deepEqual(await titles('assignee = currentUser()'),['Login page','Push login']);
    assert.deepEqual(await titles('assignee is empty AND type != epic'),['Footer links']);
    assert.deepEqual(await titles('labels in (web, mobile)'),['Login page','Push login']);
    assert.deepEqual(await titles('points > 3'),['Login page','Push login']);
    assert.deepEqual(await titles('due < today'),['Login page']);
    assert.deepEqual(await titles('due <= +7d'),['Login crash on Safari','Login page']);
    assert.deepEqual(await titles('text ~ login'),['Login crash on Safari','Login page','Push login'],'other workspaces stay out');
    assert.deepEqual(await titles(`key in (${t3.key}, ${t4.key})`),['Footer links','Push login']);
    assert.deepEqual(await titles('epic = Auth'),['Login crash on Safari','Login page']);
    assert.deepEqual(await titles('sprint in openSprints()'),['Login page']);
    assert.deepEqual(await titles('نوع = باگ و وضعیت = باز'),['Login crash on Safari','Push login'],'Persian fields, values and keywords');
    const ordered=await search('project = Website ORDER BY priority DESC');
    assert.deepEqual(ordered.rows.map(row=>row.title),['Login crash on Safari','Login page','Auth','Footer links']);
    assert.equal(ordered.rows[1].epic.title,'Auth');assert.equal(ordered.rows[1].sprint.id,sprint.id);
    const paged=await search('project = Website ORDER BY key ASC','owner','&pageSize=2&page=2');
    assert.equal(paged.total,4);assert.deepEqual(paged.rows.map(row=>row.key),[t3.key,epic.key]);
  });

  await t.test('a bad query comes back with its message and position',async()=>{
    const bad=await search('status = finished');assert.equal(bad.total,0);assert.equal(bad.error.start,9);assert.match(bad.error.message,/finished/);
    const nobody=await search('assignee = "Nobody Here"');assert.match(nobody.error.message,/Nobody Here/);assert.equal(nobody.error.start,11);
    assert.equal((await search('x'.repeat(2001))).error.start,2000);
    assert.deepEqual(await titles('type = bug','viewer'),['Login crash on Safari','Push login'],'readers can search');
  });

  let shared;
  await t.test('saved filters keep their owners and sharing rights',async()=>{
    const personal=await api('/api/filters',{name:'My bugs',query:'type = bug AND assignee = me'},'POST','viewer');
    assert.equal(personal.status,201,JSON.stringify(personal));assert.equal(personal.body.shared,false);
    assert.equal((await api('/api/filters',{name:'Shared by viewer',query:'type = bug',shared:true},'POST','viewer')).status,403,'readers keep filters to themselves');
    assert.equal((await api('/api/filters',{name:'Broken',query:'status = finished'},'POST','member')).status,422);
    shared=(await api('/api/filters',{name:'Open bugs',query:'type = bug AND status = open',shared:true},'POST','member')).body;
    const seen=(await api('/api/filters',undefined,'GET','owner')).body;
    assert.ok(seen.shared.some(row=>row.id===shared.id));assert.ok(!seen.personal.some(row=>row.id===personal.body.id),'personal filters stay personal');
    assert.equal(seen.shared.find(row=>row.id===shared.id).canEdit,true,'managers may edit shared filters');
    assert.equal((await api('/api/filters/'+shared.id,{starred:true},'PUT','viewer')).status,200);
    assert.deepEqual((await api('/api/filters',undefined,'GET','viewer')).body.starred,[shared.id]);
    assert.equal((await api('/api/filters/'+shared.id,{name:'Hijacked'},'PUT','viewer')).status,403);
    assert.equal((await api('/api/filters/'+shared.id,{name:'Open bugs (all)'},'PUT','owner')).body.name,'Open bugs (all)');
    assert.equal((await api('/api/filters/'+shared.id,{shared:false},'PUT','owner')).status,403,'only the owner moves a filter');
    assert.equal((await api('/api/filters/'+personal.body.id,undefined,'DELETE','member')).status,404,'another member cannot even see it');
    assert.equal((await api('/api/filters/'+shared.id,undefined,'DELETE','member')).status,200);
  });

  await t.test('bulk changes follow each task\'s rules',async()=>{
    assert.equal((await api('/api/search/bulk',{taskIds:[t1.id],changes:{priority:'low'}},'PUT','viewer')).status,403);
    assert.equal((await api('/api/search/bulk',{taskIds:[t1.id],changes:{}},'PUT','member')).status,422);
    const lowered=await api('/api/search/bulk',{taskIds:[t1.id,t2.id],changes:{priority:'low',assigneeId:memberId}},'PUT','member');
    assert.equal(lowered.status,200,JSON.stringify(lowered));assert.deepEqual(lowered.body,{updated:2,failed:[]});
    assert.deepEqual(await titles('priority = low AND assignee = search_member'),['Login crash on Safari','Login page']);
    const blocked=await create({projectId:web.id,title:'Has open step',subtasks:[{title:'Step',completed:false}]});
    const closing=await api('/api/search/bulk',{taskIds:[t2.id,blocked.id],changes:{status:'completed'}},'PUT','member');
    assert.equal(closing.body.updated,1);assert.equal(closing.body.failed.length,1);assert.equal(closing.body.failed[0].id,blocked.id);
    assert.equal(read(data).tasks.find(row=>row.id===t2.id).status,'completed');assert.equal(read(data).tasks.find(row=>row.id===blocked.id).status,'pending');
  });
});
