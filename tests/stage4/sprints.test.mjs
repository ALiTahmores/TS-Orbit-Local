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

// Scrum planning: managers run sprints, writers plan the backlog, viewers only read.
// A running sprint keeps its starting scope and every change after it, so the
// burndown and the closing report stay true to what happened.
const root=path.resolve(import.meta.dirname,'../..');
const password='SprintFixture42!';
const environment=data=>({...process.env,PROJECT_ROOT:root,NODE_ENV:'production',DATA_DIR:data,HOST:'127.0.0.1',PORT:'3000',APP_ORIGIN:'',ALLOW_NETWORK_ACCESS:'',LEGACY_DB_IMPORT:''});
function read(data){const db=new DatabaseSync(path.join(data,'orbit.sqlite'),{readOnly:true});try{return Object.fromEntries(collectionNames.map(name=>[name,db.prepare(`SELECT payload FROM "${name}" ORDER BY ordinal`).all().map(row=>JSON.parse(row.payload))]));}finally{db.close();}}
async function start(data){const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));const origin=`http://127.0.0.1:${port}`;const child=spawn(process.execPath,[path.join(root,'dist/server/server.cjs')],{cwd:root,env:{...environment(data),PORT:String(port),APP_ORIGIN:origin},windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);for(let i=0;i<300;i++){if(child.exitCode!==null)throw new Error(output);try{if((await fetch(origin+'/api/projects',{signal:AbortSignal.timeout(1000)})).status===401)return{child,origin};}catch{}await new Promise(resolve=>setTimeout(resolve,50));}child.kill();throw new Error('Sprint startup failed: '+output);}
async function stop(runtime){if(!runtime||runtime.child.exitCode!==null||runtime.child.signalCode!==null)return;const closed=once(runtime.child,'close');runtime.child.kill();await closed;}
async function request(runtime,endpoint,{body,token,workspace,method=body===undefined?'GET':'POST'}={}){const payload=body===undefined?undefined:JSON.stringify(body);const response=await fetch(runtime.origin+endpoint,{method,signal:AbortSignal.timeout(8000),headers:{...(payload===undefined?{}:{'content-type':'application/json'}),...(token?{authorization:'Bearer '+token}:{}),...(workspace?{'x-workspace-id':workspace}:{})},...(payload===undefined?{}:{body:payload})});const value=await response.text();let result;try{result=JSON.parse(value);}catch{result=value;}return{status:response.status,body:result};}
const day=offset=>new Date(Date.now()+offset*86_400_000).toISOString().slice(0,10);

test('sprints plan the backlog, run with a fixed commitment and report what happened',{timeout:120000},async t=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'orbit-sprints-')),data=path.join(temporary,'data');let runtime;
  t.after(async()=>{await stop(runtime);fs.rmSync(temporary,{recursive:true,force:true});});
  const bootstrap=spawnSync(process.execPath,[path.join(root,'dist/server/local-account.cjs'),'bootstrap','--email','sprint-owner@example.test','--name','Sprint Owner','--phone','09110000041','--password-stdin'],{cwd:root,env:environment(data),input:password+'\n'+password+'\n',encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(bootstrap.status,0,bootstrap.stdout+bootstrap.stderr);
  runtime=await start(data);
  const login=async email=>{const result=await request(runtime,'/api/auth/login',{body:{identifier:email,password}});assert.equal(result.status,200,JSON.stringify(result));return result.body;};
  const owner=await login('sprint-owner@example.test');
  for(const [email,phone,username] of [['sprint-member@example.test','09110000042','sprint_member'],['sprint-viewer@example.test','09110000043','sprint_viewer']])
    assert.equal((await request(runtime,'/api/auth/register',{body:{email,name:username,username,phone,password}})).status,201);
  const member=await login('sprint-member@example.test'),viewer=await login('sprint-viewer@example.test');
  const seed=read(data),wa=seed.users.find(user=>user.email==='sprint-owner@example.test').personalWorkspaceId;
  const tokens={owner:owner.token,member:member.token,viewer:viewer.token};
  const api=(endpoint,body,method,actor='owner')=>request(runtime,endpoint,{body,method:method||(body===undefined?'GET':'POST'),token:tokens[actor],workspace:wa});
  for(const [email,role] of [['sprint-member@example.test','MEMBER'],['sprint-viewer@example.test','VIEWER']])
    assert.equal((await api('/api/workspaces/members',{workspaceId:wa,targetUserId:read(data).users.find(user=>user.email===email).id,role})).status,200);
  const project=(await api('/api/projects',{title:'Sprint project'})).body,other=(await api('/api/projects',{title:'Other project'})).body;
  const task=async(title,storyPoints,projectId=project.id)=>{const created=await api('/api/tasks',{projectId,title,...(storyPoints===undefined?{}:{storyPoints})});assert.equal(created.status,201,JSON.stringify(created));return created.body;};
  const overview=async(actor='owner')=>{const result=await api(`/api/sprints?projectId=${project.id}&today=${day(0)}&offset=0`,undefined,'GET',actor);assert.equal(result.status,200,JSON.stringify(result));return result.body;};
  const lane=(view,sprintId)=>view.tasks.filter(row=>row.sprintId===sprintId).map(row=>row.title);
  const move=(taskIds,sprintId,extra={},actor='owner')=>api('/api/backlog/move',{projectId:project.id,taskIds,sprintId,...extra},'PUT',actor);

  let t1,t2,t3,t4,stray;
  await t.test('story points are validated and kept on tasks',async()=>{
    t1=await task('Login form',3);t2=await task('Password reset',5);t3=await task('Session list',2);t4=await task('Audit export',4);stray=await task('Elsewhere',1,other.id);
    assert.equal(t1.storyPoints,3);
    assert.equal((await api('/api/tasks/'+t1.id,{storyPoints:-1},'PUT')).status,422);
    assert.equal((await api('/api/tasks/'+t1.id,{storyPoints:1001},'PUT')).status,422);
    assert.equal((await api('/api/tasks/'+t1.id,{storyPoints:'3'},'PUT')).status,422);
    const cleared=await api('/api/tasks/'+t4.id,{storyPoints:null},'PUT');assert.equal(cleared.status,200);assert.equal(cleared.body.storyPoints,null);
    assert.equal((await api('/api/tasks/'+t4.id,{storyPoints:4},'PUT')).body.storyPoints,4);
    const view=await overview('viewer');assert.equal(view.canManage,false);assert.deepEqual(lane(view,null),['Login form','Password reset','Session list','Audit export']);
  });

  let s1,s2;
  await t.test('managers create sprints; writers plan; viewers only read',async()=>{
    assert.equal((await api('/api/sprints',{projectId:project.id},'POST','member')).status,403);
    s1=(await api('/api/sprints',{projectId:project.id})).body;s2=(await api('/api/sprints',{projectId:project.id,name:'Hardening',goal:'Ship the audit log'})).body;
    assert.equal(s1.name,'اسپرینت 1');assert.equal(s1.state,'future');assert.equal(s2.goal,'Ship the audit log');
    assert.equal((await move([t1.id],s1.id,{},'viewer')).status,403);
    assert.equal((await move([t1.id,t2.id,t3.id],s1.id,{},'member')).status,200);
    const before=await move([t4.id],s1.id,{beforeTaskId:t2.id});assert.equal(before.status,200);
    assert.deepEqual(lane(before.body,s1.id),['Login form','Audit export','Password reset','Session list']);
    assert.deepEqual(lane((await move([t4.id],null)).body,null),['Audit export'],'back to the backlog');
    assert.equal((await move([stray.id],s1.id)).status,422,'tasks of another project stay out');
    assert.equal((await move([t1.id],'sprint_missing')).status,422);
    assert.equal((await move([],s1.id)).status,422);
    const view=await overview();assert.equal(view.sprints[0].stats.points,10);assert.equal(view.sprints[0].stats.tasks,3);
  });

  await t.test('a sprint starts with dates and work, one at a time',async()=>{
    assert.equal((await api(`/api/sprints/${s2.id}/start`,{startDate:day(0),endDate:day(6)})).status,409,'an empty sprint does not start');
    assert.equal((await api(`/api/sprints/${s1.id}/start`,{})).status,422,'dates are required');
    assert.equal((await api(`/api/sprints/${s1.id}/start`,{startDate:day(3),endDate:day(1)})).status,422);
    assert.equal((await api(`/api/sprints/${s1.id}/start`,{startDate:day(0),endDate:day(6)},'POST','member')).status,403);
    const started=await api(`/api/sprints/${s1.id}/start`,{startDate:day(0),endDate:day(6),goal:'Accounts that recover themselves'});
    assert.equal(started.status,200,JSON.stringify(started));assert.equal(started.body.state,'active');
    assert.equal((await move([t1.id],s2.id)).status,200);assert.equal((await move([t1.id],s1.id)).status,200,'moving back and forth stays consistent');
    assert.equal((await api(`/api/sprints/${s2.id}/start`,{startDate:day(0),endDate:day(6)})).status,409,'one active sprint per project');
    assert.equal((await api(`/api/sprints/${s1.id}`,undefined,'DELETE')).status,409,'a running sprint is not deleted');
  });

  await t.test('scope changes and finished work show in the burndown',async()=>{
    assert.equal((await api(`/api/tasks/${t1.id}/status`,{status:'completed'},'PUT')).status,200);
    assert.equal((await api('/api/tasks/'+t2.id,{storyPoints:8},'PUT')).status,200);
    assert.equal((await move([t4.id],s1.id)).status,200);
    const report=await api(`/api/sprints/${s1.id}/report?today=${day(0)}&offset=0`);
    assert.equal(report.status,200,JSON.stringify(report));
    const {summary,burndown}=report.body;
    assert.equal(summary.committedPoints,10);assert.equal(summary.committedTasks,3);
    assert.equal(summary.addedTasks,1);assert.equal(summary.addedPoints,4);
    assert.equal(summary.completedTasks,1);assert.equal(summary.completedPoints,3);assert.equal(summary.remainingPoints,14);
    assert.equal(burndown.unit,'points');assert.equal(burndown.committed,10);assert.equal(burndown.days.length,7);
    assert.deepEqual(burndown.days[0],{day:day(0),remaining:14,scope:17,ideal:10});
    assert.equal(burndown.days[6].remaining,null,'future days stay empty');assert.equal(burndown.days[6].ideal,0);
  });

  let next;
  await t.test('completing a sprint keeps its report and carries open work over',async()=>{
    assert.equal((await api(`/api/sprints/${s1.id}/complete`,{moveTo:'sprint_missing'})).status,422);
    const completed=await api(`/api/sprints/${s1.id}/complete?today=${day(0)}&offset=0`,{moveTo:'new'});
    assert.equal(completed.status,200,JSON.stringify(completed));assert.equal(completed.body.moved,3);next=completed.body.target;
    assert.equal(next.name,'اسپرینت 3');
    const view=await overview();
    assert.deepEqual(lane(view,next.id),['Password reset','Session list','Audit export'],'open work keeps its sprint order');
    assert.ok(!view.tasks.some(row=>row.id===t1.id),'finished work leaves the board with its sprint');
    assert.equal(view.closed[0].id,s1.id);assert.equal(view.closed[0].report.completedPoints,3);
    assert.deepEqual(view.velocity.sprints,[{id:s1.id,name:'اسپرینت 1',committed:10,completed:3}]);assert.equal(view.velocity.average,3);
    const report=await api(`/api/sprints/${s1.id}/report`);assert.equal(report.body.summary.completed[0].id,t1.id);assert.equal(report.body.burndown.days[0].remaining,14);
    assert.equal((await api(`/api/sprints/${s1.id}/complete`,{})).status,409);
    assert.equal((await api(`/api/sprints/${s1.id}`,{name:'Renamed'},'PUT')).status,409,'closed sprints are history');
  });

  await t.test('deleting a planned sprint returns its work; moving a task away leaves the sprint',async()=>{
    assert.equal((await move([t3.id],s2.id)).status,200);
    const removed=await api(`/api/sprints/${s2.id}`,undefined,'DELETE');assert.equal(removed.status,200);assert.equal(removed.body.moved,1);
    let view=await overview();assert.ok(!view.sprints.some(row=>row.id===s2.id));assert.ok(lane(view,null).includes('Session list'));
    assert.equal((await api('/api/tasks/'+t2.id,{projectId:other.id},'PUT')).status,200);
    view=await overview();assert.ok(!view.tasks.some(row=>row.id===t2.id));
    const stored=read(data).tasks.find(row=>row.id===t2.id);assert.equal(stored.sprintId,undefined);
  });

  await t.test('sprint events can be sent to connected tools',async()=>{
    const created=await api('/api/integrations',{provider:'webhook',name:'Sprint feed',config:{url:'https://example.com/sprints'},events:['sprint.started','sprint.completed']});
    assert.equal(created.status,201,JSON.stringify(created));
  });
});
