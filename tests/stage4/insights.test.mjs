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

// Workspace insights are computed from rows the member may see, and a member's
// muted notification kinds are never delivered to them.
const root=path.resolve(import.meta.dirname,'../..');
const password='InsightFixture42!';
const environment=data=>({...process.env,PROJECT_ROOT:root,NODE_ENV:'production',DATA_DIR:data,HOST:'127.0.0.1',PORT:'3000',APP_ORIGIN:'',ALLOW_NETWORK_ACCESS:'',LEGACY_DB_IMPORT:''});
function read(data){const db=new DatabaseSync(path.join(data,'orbit.sqlite'),{readOnly:true});try{return Object.fromEntries(collectionNames.map(name=>[name,db.prepare(`SELECT payload FROM "${name}" ORDER BY ordinal`).all().map(row=>JSON.parse(row.payload))]));}finally{db.close();}}
async function start(data){const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));const origin=`http://127.0.0.1:${port}`;const child=spawn(process.execPath,[path.join(root,'dist/server/server.cjs')],{cwd:root,env:{...environment(data),PORT:String(port),APP_ORIGIN:origin},windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);for(let i=0;i<200;i++){if(child.exitCode!==null)throw new Error(output);try{if((await fetch(origin+'/api/projects',{signal:AbortSignal.timeout(1000)})).status===401)return{child,origin};}catch{}await new Promise(resolve=>setTimeout(resolve,50));}child.kill();throw new Error('Insights startup failed: '+output);}
async function stop(runtime){if(!runtime||runtime.child.exitCode!==null||runtime.child.signalCode!==null)return;const closed=once(runtime.child,'close');runtime.child.kill();await closed;}
async function request(runtime,endpoint,{body,token,workspace,method=body===undefined?'GET':'POST'}={}){const response=await fetch(runtime.origin+endpoint,{method,signal:AbortSignal.timeout(8000),headers:{...(body===undefined?{}:{'content-type':'application/json'}),...(token?{authorization:'Bearer '+token}:{}),...(workspace?{'x-workspace-id':workspace}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const value=await response.text();let result;try{result=JSON.parse(value);}catch{result=value;}return{status:response.status,body:result};}

test('insights summarise visible work and muted notifications stay silent',{timeout:120000},async t=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'orbit-insights-')),data=path.join(temporary,'data');let runtime;
  t.after(async()=>{await stop(runtime);fs.rmSync(temporary,{recursive:true,force:true});});
  const bootstrap=spawnSync(process.execPath,[path.join(root,'dist/server/local-account.cjs'),'bootstrap','--email','insight-owner@example.test','--name','Insight Owner','--phone','09110000021','--password-stdin'],{cwd:root,env:environment(data),input:password+'\n'+password+'\n',encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(bootstrap.status,0,bootstrap.stdout+bootstrap.stderr);
  runtime=await start(data);
  const login=async email=>{const result=await request(runtime,'/api/auth/login',{body:{identifier:email,password}});assert.equal(result.status,200,JSON.stringify(result));return result.body;};
  const owner=await login('insight-owner@example.test');
  for(const [email,name,username,phone] of [['insight-member@example.test','Insight Member','insight_member','09110000022'],['insight-viewer@example.test','Insight Viewer','insight_viewer','09110000023']])
    assert.equal((await request(runtime,'/api/auth/register',{body:{email,name,username,phone,password}})).status,201);
  const member=await login('insight-member@example.test'),viewer=await login('insight-viewer@example.test');
  const seed=read(data),a=seed.users.find(user=>user.email==='insight-owner@example.test'),b=seed.users.find(user=>user.email==='insight-member@example.test'),c=seed.users.find(user=>user.email==='insight-viewer@example.test'),wa=a.personalWorkspaceId;
  const as=actor=>actor==='member'?member.token:actor==='viewer'?viewer.token:owner.token;
  const api=(endpoint,body,method,actor='owner')=>request(runtime,endpoint,{body,method:method||(body===undefined?'GET':'POST'),token:as(actor),workspace:wa});
  assert.equal((await api('/api/workspaces/members',{workspaceId:wa,targetUserId:b.id,role:'MEMBER'})).status,200);
  assert.equal((await api('/api/workspaces/members',{workspaceId:wa,targetUserId:c.id,role:'VIEWER'})).status,200);
  const today='2026-11-12';
  const project=(await api('/api/projects',{title:'Insight project',deadline:'2026-12-30'})).body;
  const task=async(title,extra={})=>{const created=await api('/api/tasks',{projectId:project.id,title,...extra});assert.equal(created.status,201,JSON.stringify(created));return created.body;};
  const late=await task('Late task',{deadline:'2026-01-05',assignedMemberIds:[b.id],priority:'high'});
  const blocked=await task('Blocked task',{assignedMemberIds:[b.id]});
  const review=await task('Review task',{deadline:today,assignedMemberIds:[b.id]});
  await task('Urgent unassigned',{priority:'critical'});
  assert.equal((await api(`/api/tasks/${blocked.id}/status`,{status:'blocked'},'PUT')).status,200);
  assert.equal((await api(`/api/tasks/${review.id}/status`,{status:'review'},'PUT')).status,200);

  await t.test('overview counts open, overdue and the member own work',async()=>{
    const result=await api('/api/insights/overview?range=7&today='+today,undefined,'GET','member');
    assert.equal(result.status,200,JSON.stringify(result));
    assert.equal(result.body.kpis.openTasks,4);assert.equal(result.body.kpis.overdueTasks,1);assert.equal(result.body.today,today);
    assert.deepEqual(result.body.myWork.overdue.map(row=>row.id),[late.id]);assert.ok(result.body.myWork.overdue[0].daysOverdue>300);
    assert.deepEqual(result.body.myWork.review.map(row=>row.id),[review.id],'members see their own work waiting for review');
    assert.equal(result.body.projects[0].id,project.id);assert.equal(result.body.projects[0].health,'at_risk','one late and one blocked task put the project at risk');
    const range=await api('/api/insights/overview?range=999',undefined,'GET','member');assert.equal(range.body.range,7,'unknown ranges fall back to a week');
  });

  await t.test('risks list blocked, overdue and unassigned urgent work',async()=>{
    const result=await api('/api/insights/risks?today='+today);
    assert.equal(result.status,200,JSON.stringify(result));
    assert.equal(result.body.summary.blocked,1);assert.equal(result.body.summary.overdue,1);assert.equal(result.body.summary.unassigned,1);
    assert.equal(result.body.items[0].severity,'high');assert.ok(result.body.items.some(row=>row.id===late.id&&row.reasons.includes('overdue')));
    assert.equal(result.body.people[0].userId,b.id);
  });

  await t.test('team workload covers every member',async()=>{
    const result=await api('/api/insights/team?today='+today,undefined,'GET','viewer');
    assert.equal(result.status,200,JSON.stringify(result));
    const row=result.body.members.find(member=>member.id===b.id);
    assert.equal(row.open,3);assert.equal(row.overdue,1);assert.equal(row.blocked,1);assert.equal(row.review,1);
    assert.equal(result.body.totals.unassignedOpen,1);assert.equal(result.body.totals.members,3);
    assert.ok(!('email' in row),'team insights carry no contact details');
  });

  await t.test('members mute notification kinds for themselves only',async()=>{
    assert.deepEqual((await api('/api/notifications/preferences',undefined,'GET','viewer')).body.mutedTypes,[]);
    assert.equal((await api('/api/notifications/preferences',{mutedTypes:['not.a.type']},'PUT','member')).status,422);
    assert.equal((await api('/api/notifications/preferences',{mutedTypes:['task.assigned'],userId:a.id},'PUT','member')).status,422,'only the muted kinds can be sent');
    const muted=await api('/api/notifications/preferences',{mutedTypes:['task.assigned']},'PUT','viewer');
    assert.equal(muted.status,200,'viewers may change their own notification settings');
    assert.equal((await api('/api/notifications/preferences',{mutedTypes:['task.assigned']},'PUT','member')).status,200);
    const before=read(data).notifications.filter(row=>row.userId===b.id).length;
    await task('Quiet assignment',{assignedMemberIds:[b.id]});
    assert.equal(read(data).notifications.filter(row=>row.userId===b.id).length,before,'a muted kind creates no notification');
    assert.equal((await api('/api/notifications/preferences',{mutedTypes:[]},'PUT','member')).status,200);
    await task('Loud assignment',{assignedMemberIds:[b.id]});
    assert.equal(read(data).notifications.filter(row=>row.userId===b.id).length,before+1);
    assert.deepEqual((await api('/api/notifications/preferences',undefined,'GET','viewer')).body.mutedTypes,['task.assigned']);
  });
});
