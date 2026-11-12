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

// Issue types and epics: every task has a type; an epic groups stories, tasks and
// bugs of its own project, never another epic, is never planned in a sprint, and
// letting go of an epic (delete, retype, move) keeps its work.
const root=path.resolve(import.meta.dirname,'../..');
const password='EpicFixture42!';
const environment=data=>({...process.env,PROJECT_ROOT:root,NODE_ENV:'production',DATA_DIR:data,HOST:'127.0.0.1',PORT:'3000',APP_ORIGIN:'',ALLOW_NETWORK_ACCESS:'',LEGACY_DB_IMPORT:''});
function read(data){const db=new DatabaseSync(path.join(data,'orbit.sqlite'),{readOnly:true});try{return Object.fromEntries(collectionNames.map(name=>[name,db.prepare(`SELECT payload FROM "${name}" ORDER BY ordinal`).all().map(row=>JSON.parse(row.payload))]));}finally{db.close();}}
async function start(data){const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));const origin=`http://127.0.0.1:${port}`;const child=spawn(process.execPath,[path.join(root,'dist/server/server.cjs')],{cwd:root,env:{...environment(data),PORT:String(port),APP_ORIGIN:origin},windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);for(let i=0;i<300;i++){if(child.exitCode!==null)throw new Error(output);try{if((await fetch(origin+'/api/projects',{signal:AbortSignal.timeout(1000)})).status===401)return{child,origin};}catch{}await new Promise(resolve=>setTimeout(resolve,50));}child.kill();throw new Error('Epic startup failed: '+output);}
async function stop(runtime){if(!runtime||runtime.child.exitCode!==null||runtime.child.signalCode!==null)return;const closed=once(runtime.child,'close');runtime.child.kill();await closed;}
async function request(runtime,endpoint,{body,token,workspace,method=body===undefined?'GET':'POST'}={}){const payload=body===undefined?undefined:JSON.stringify(body);const response=await fetch(runtime.origin+endpoint,{method,signal:AbortSignal.timeout(8000),headers:{...(payload===undefined?{}:{'content-type':'application/json'}),...(token?{authorization:'Bearer '+token}:{}),...(workspace?{'x-workspace-id':workspace}:{})},...(payload===undefined?{}:{body:payload})});const value=await response.text();let result;try{result=JSON.parse(value);}catch{result=value;}return{status:response.status,body:result};}
const today=new Date().toISOString().slice(0,10);

test('issue types and epics group work without losing it',{timeout:120000},async t=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'orbit-epics-')),data=path.join(temporary,'data');let runtime;
  t.after(async()=>{await stop(runtime);fs.rmSync(temporary,{recursive:true,force:true});});
  const bootstrap=spawnSync(process.execPath,[path.join(root,'dist/server/local-account.cjs'),'bootstrap','--email','epic-owner@example.test','--name','Epic Owner','--phone','09110000051','--password-stdin'],{cwd:root,env:environment(data),input:password+'\n'+password+'\n',encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(bootstrap.status,0,bootstrap.stdout+bootstrap.stderr);
  runtime=await start(data);
  const login=async email=>{const result=await request(runtime,'/api/auth/login',{body:{identifier:email,password}});assert.equal(result.status,200,JSON.stringify(result));return result.body;};
  const owner=await login('epic-owner@example.test');
  assert.equal((await request(runtime,'/api/auth/register',{body:{email:'epic-viewer@example.test',name:'Epic Viewer',username:'epic_viewer',phone:'09110000052',password}})).status,201);
  const viewer=await login('epic-viewer@example.test');
  const wa=read(data).users.find(user=>user.email==='epic-owner@example.test').personalWorkspaceId;
  const tokens={owner:owner.token,viewer:viewer.token};
  const api=(endpoint,body,method,actor='owner')=>request(runtime,endpoint,{body,method:method||(body===undefined?'GET':'POST'),token:tokens[actor],workspace:wa});
  assert.equal((await api('/api/workspaces/members',{workspaceId:wa,targetUserId:read(data).users.find(user=>user.email==='epic-viewer@example.test').id,role:'VIEWER'})).status,200);
  const project=(await api('/api/projects',{title:'Epic project'})).body,other=(await api('/api/projects',{title:'Elsewhere'})).body;
  const task=async(body)=>{const created=await api('/api/tasks',{projectId:project.id,...body});assert.equal(created.status,201,JSON.stringify(created));return created.body;};
  const openTasks=async()=>(await api(`/api/insights/overview?range=7&today=${today}`)).body.kpis.openTasks;

  let epic,story,bug,plain,foreignEpic;
  await t.test('every task has a type; epics get a colour',async()=>{
    plain=await task({title:'Plain work'});assert.equal(plain.type,'task');
    story=await task({title:'Sign up with phone',type:'story',storyPoints:5});bug=await task({title:'Crash on logout',type:'BUG',storyPoints:2});
    assert.equal(story.type,'story');assert.equal(bug.type,'bug');
    assert.equal((await api('/api/tasks',{projectId:project.id,title:'Odd',type:'saga'})).status,422);
    const before=await openTasks();
    epic=await task({title:'Onboarding',type:'epic',startDate:today,dueDate:today});
    assert.equal(epic.type,'epic');assert.equal(epic.epicColor,'violet');
    assert.equal(await openTasks(),before,'an epic is not counted as open work');
    assert.equal((await api('/api/tasks/'+epic.id,{epicColor:'neon'},'PUT')).status,422);
    assert.equal((await api('/api/tasks/'+epic.id,{epicColor:'teal'},'PUT')).body.epicColor,'teal');
    foreignEpic=(await api('/api/tasks',{projectId:other.id,title:'Other epic',type:'epic'})).body;
  });

  await t.test('links stay inside one project and one level deep',async()=>{
    assert.equal((await api('/api/tasks/'+story.id,{epicId:epic.id},'PUT')).body.epicId,epic.id);
    assert.equal((await api('/api/tasks/'+bug.id,{epicId:plain.id},'PUT')).status,422,'only an epic can hold work');
    assert.equal((await api('/api/tasks/'+bug.id,{epicId:foreignEpic.id},'PUT')).status,422,'epics hold work of their own project');
    assert.equal((await api('/api/tasks/'+epic.id,{epicId:epic.id},'PUT')).status,422,'an epic is never inside an epic');
    assert.equal((await api('/api/tasks',{projectId:project.id,title:'Nested',type:'epic',epicId:epic.id})).status,422);
    const created=await task({title:'Welcome email',type:'story',epicId:epic.id,storyPoints:3});assert.equal(created.epicId,epic.id);
    assert.equal((await api('/api/tasks/'+created.id+'/status',{status:'completed'},'PUT')).status,200);
  });

  await t.test('the epics view shows progress from linked work',async()=>{
    const view=await api(`/api/epics?projectId=${project.id}`,undefined,'GET','viewer');
    assert.equal(view.status,200,JSON.stringify(view));assert.equal(view.body.canWrite,false);
    const row=view.body.epics.find(item=>item.id===epic.id);
    assert.equal(row.color,'teal');assert.equal(row.startDate,today);assert.equal(row.dueDate,today);
    assert.deepEqual({tasks:row.progress.tasks,done:row.progress.done,points:row.progress.points,donePoints:row.progress.donePoints,percent:row.progress.percent},{tasks:2,done:1,points:8,donePoints:3,percent:38});
    assert.deepEqual(row.types,{story:2,task:0,bug:0});
    assert.deepEqual(view.body.unassigned,{tasks:2,points:2},'plain work and the bug are not in an epic');
    assert.ok(!view.body.epics.some(item=>item.id===foreignEpic.id),'a project filter keeps other epics out');
    assert.ok(view.body.candidates.every(item=>item.type!=='epic'));
  });

  await t.test('work is linked and unlinked in bulk by writers',async()=>{
    assert.equal((await api('/api/epics/link',{projectId:project.id,epicId:epic.id,taskIds:[bug.id]},'PUT','viewer')).status,403);
    assert.equal((await api('/api/epics/link',{projectId:project.id,epicId:epic.id,taskIds:[foreignEpic.id]},'PUT')).status,422);
    assert.equal((await api('/api/epics/link',{projectId:project.id,epicId:epic.id,taskIds:[epic.id]},'PUT')).status,422);
    const linked=await api('/api/epics/link',{projectId:project.id,epicId:epic.id,taskIds:[bug.id,plain.id]},'PUT');
    assert.equal(linked.status,200,JSON.stringify(linked));assert.equal(linked.body.epics.find(item=>item.id===epic.id).progress.tasks,4);
    const unlinked=await api('/api/epics/link',{projectId:project.id,epicId:null,taskIds:[plain.id]},'PUT');
    assert.equal(unlinked.body.epics.find(item=>item.id===epic.id).progress.tasks,3);assert.equal(unlinked.body.unassigned.tasks,1);
  });

  await t.test('epics are not sprint work',async()=>{
    const sprint=(await api('/api/sprints',{projectId:project.id})).body;
    assert.equal((await api('/api/backlog/move',{projectId:project.id,taskIds:[epic.id],sprintId:sprint.id},'PUT')).status,422);
    assert.equal((await api('/api/backlog/move',{projectId:project.id,taskIds:[plain.id],sprintId:sprint.id},'PUT')).status,200);
    const view=(await api(`/api/sprints?projectId=${project.id}`)).body;
    assert.ok(!view.tasks.some(row=>row.id===epic.id));assert.deepEqual(view.epics.map(row=>row.id),[epic.id]);
    assert.equal(view.tasks.find(row=>row.id===bug.id).epicId,epic.id);assert.equal(view.tasks.find(row=>row.id===bug.id).type,'bug');
    const promoted=await api('/api/tasks/'+plain.id,{type:'epic'},'PUT');assert.equal(promoted.status,200);
    assert.equal(read(data).tasks.find(row=>row.id===plain.id).sprintId,undefined,'a task that becomes an epic leaves its sprint');
  });

  await t.test('letting go of an epic keeps its work',async()=>{
    assert.equal((await api('/api/tasks/'+bug.id,{projectId:other.id},'PUT')).status,200);
    assert.equal(read(data).tasks.find(row=>row.id===bug.id).epicId,null,'moving work to another project drops the link');
    assert.equal((await api('/api/tasks/'+epic.id,{type:'story'},'PUT')).status,200);
    assert.ok(read(data).tasks.filter(row=>row.projectId===project.id).every(row=>!row.epicId),'a retyped epic lets go of its work');
    const second=await task({title:'Payments',type:'epic'}),child=await task({title:'Card form',type:'story',epicId:second.id});
    assert.equal((await api('/api/tasks/'+second.id,undefined,'DELETE')).status,200);
    const stored=read(data).tasks.find(row=>row.id===child.id);assert.ok(stored,'the work of a deleted epic stays');assert.equal(stored.epicId,undefined);
  });
});
