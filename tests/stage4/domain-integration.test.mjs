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
import { io } from 'socket.io-client';

const root=path.resolve(import.meta.dirname,'../..');
const password='DomainIntegrationFixture42!';
const environment=data=>({...process.env,PROJECT_ROOT:root,NODE_ENV:'production',DATA_DIR:data,HOST:'127.0.0.1',PORT:'3000',APP_ORIGIN:'',ALLOW_NETWORK_ACCESS:'',LEGACY_DB_IMPORT:''});
function read(data){const db=new DatabaseSync(path.join(data,'orbit.sqlite'),{readOnly:true});try{return Object.fromEntries(collectionNames.map(name=>[name,db.prepare(`SELECT payload FROM "${name}" ORDER BY ordinal`).all().map(row=>JSON.parse(row.payload))]));}finally{db.close();}}
async function start(data,reuse){const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=reuse||listener.address().port;await new Promise(resolve=>listener.close(resolve));const origin=`http://127.0.0.1:${port}`;const child=spawn(process.execPath,[path.join(root,'dist/server/server.cjs')],{cwd:root,env:{...environment(data),PORT:String(port),APP_ORIGIN:origin},windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);for(let i=0;i<200;i++){if(child.exitCode!==null)throw new Error(output);try{if((await fetch(origin+'/api/projects',{signal:AbortSignal.timeout(1000)})).status===401)return{child,origin,port};}catch{}await new Promise(resolve=>setTimeout(resolve,50));}child.kill();throw new Error('Domain integration startup failed: '+output);}
async function stop(runtime){if(!runtime||runtime.child.exitCode!==null||runtime.child.signalCode!==null)return;const closed=once(runtime.child,'close');runtime.child.kill();await closed;}
async function request(runtime,endpoint,{body,token,workspace,method=body===undefined?'GET':'POST'}={}){const response=await fetch(runtime.origin+endpoint,{method,signal:AbortSignal.timeout(8000),headers:{...(body===undefined?{}:{'content-type':'application/json'}),...(token?{authorization:'Bearer '+token}:{}),...(workspace?{'x-workspace-id':workspace}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const value=await response.text();let result;try{result=JSON.parse(value);}catch{result=value;}return{status:response.status,body:result};}

test('compiled domain services enforce policy, atomic SQL persistence and restart-safe relations',{timeout:120000},async t=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'orbit-domain-integration-')),data=path.join(temporary,'data');let runtime;const sockets=[];
  t.after(async()=>{sockets.forEach(socket=>socket.disconnect());await stop(runtime);assert.ok(path.basename(temporary).startsWith('orbit-domain-integration-'));fs.rmSync(temporary,{recursive:true,force:true});});
  const bootstrap=spawnSync(process.execPath,[path.join(root,'dist/server/local-account.cjs'),'bootstrap','--email','domain-owner@example.test','--name','Domain Owner','--phone','09110000001','--password-stdin'],{cwd:root,env:environment(data),input:password+'\n'+password+'\n',encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(bootstrap.status,0,bootstrap.stdout+bootstrap.stderr);
  runtime=await start(data);
  const login=async email=>{const result=await request(runtime,'/api/auth/login',{body:{identifier:email,password}});assert.equal(result.status,200,JSON.stringify(result));return result.body;};
  let owner=await login('domain-owner@example.test');
  const registered=await request(runtime,'/api/auth/register',{body:{email:'domain-member@example.test',name:'Domain Member',username:'domain_member',phone:'09110000002',password}});assert.equal(registered.status,201,JSON.stringify(registered));
  let member=await login('domain-member@example.test');
  const seed=read(data),a=seed.users.find(user=>user.email==='domain-owner@example.test'),b=seed.users.find(user=>user.email==='domain-member@example.test'),wa=a.personalWorkspaceId,wb=b.personalWorkspaceId;
  const api=(endpoint,body,method,actor='owner',workspace=wa)=>request(runtime,endpoint,{body,method:method||(body===undefined?'GET':'POST'),token:actor==='owner'?owner.token:member.token,workspace});
  const accepted=await api('/api/workspaces/members',{workspaceId:wa,targetUserId:b.id,role:'MEMBER'});assert.equal(accepted.status,200,JSON.stringify(accepted));
  let department,team,project,otherProject,foreignProject,task,blocker,definition,instance,record,check,content,bug,entry;

  await t.test('real managers create department/team/module hierarchy and ordinary writers cannot administer it',async()=>{
    department=await api('/api/org/departments',{name:'Engineering',leaderId:a.id});assert.equal(department.status,201,JSON.stringify(department));department=department.body;
    team=await api('/api/org/teams',{name:'Delivery',departmentId:department.id,leaderId:a.id,memberIds:[a.id,b.id]});assert.equal(team.status,201,JSON.stringify(team));team=team.body;
    definition=await api('/api/org/modules',{name:'Issues',structure:{fields:['title','state']}});assert.equal(definition.status,201,JSON.stringify(definition));definition=definition.body;
    instance=await api('/api/org/module-instances',{definitionId:definition.id,departmentId:department.id,config:{}});assert.equal(instance.status,201,JSON.stringify(instance));instance=instance.body;
    for(const [endpoint,body,method] of [['/api/org/departments',{name:'Forbidden'},'POST'],['/api/org/teams',{name:'Forbidden'},'POST'],['/api/org/modules',{name:'Forbidden'},'POST'],['/api/org/modules/'+definition.id,{name:'Hijacked'},'PUT'],['/api/org/permissions',{departmentId:department.id,role:team.id,action:'update',isAllowed:true},'PUT']])assert.equal((await api(endpoint,body,method,'member')).status,403,endpoint);
    const channels=read(data).conversations.filter(row=>row.teamId===team.id);assert.equal(channels.length,4);assert.ok(read(data).conversationMembers.some(row=>row.userId===b.id&&row.conversationId===channels.find(channel=>channel.channelType==='private_chat').id));
  });
  await t.test('all persisted task fields, nested records and counters survive an independent SQLite read',async()=>{
    project=await api('/api/projects',{title:'Domain Project',workspaceId:wa,departmentId:department.id,teamId:team.id,assignedMemberIds:[a.id,b.id],assignedTeamIds:[team.id],budget:'0',amount:0,currency:'IRT'});assert.equal(project.status,201,JSON.stringify(project));project=project.body;
    otherProject=(await api('/api/projects',{title:'Transfer target'})).body;
    foreignProject=(await api('/api/projects',{title:'Foreign personal project'},'POST','member',wb)).body;
    blocker=(await api('/api/tasks',{title:'Blocking task',projectId:project.id,departmentId:department.id},'POST','member')).body;
    task=await api('/api/tasks',{title:'Fully persisted task',projectId:project.id,departmentId:department.id,teamId:team.id,clientVisible:true,status:'IN_PROGRESS',priority:'High',assignedMemberIds:[a.id,b.id],estimatedHours:8.5,loggedHours:1.5,notes:'Persist this note',tags:['stage4'],dependencies:[blocker.id],dueDate:'2027-04-01',links:['https://example.test/spec'],initialComments:['Initial persisted comment'],subtasks:[{id:'client-draft-a',title:'First',note:'First note',completed:false},{id:'client-draft-b',title:'Second',completed:true}]},'POST','member');assert.equal(task.status,201,JSON.stringify(task));task=task.body;
    assert.equal(task.creatorId,b.id);assert.equal(task.status,'inprogress');assert.equal(task.priority,'high');assert.equal(task.progress,50);assert.equal(task.commentsCount,1);assert.equal(task.comments[0].content,'Initial persisted comment');assert.equal(task.loggedHours,1.5);assert.equal(task.linksCount,1);assert.deepEqual(task.assignees.map(row=>row.id),[a.id,b.id]);
    record=await api('/api/org/module-instances/'+instance.id+'/records',{data:{title:'First record',state:'open'}},'POST','member');assert.equal(record.status,201,JSON.stringify(record));record=record.body.record;
    assert.equal((await api('/api/org/module-instances/'+instance.id+'/records/'+record.id,{data:{title:'Edited',state:'review'}},'PUT','member')).status,200);
    assert.equal((await api('/api/org/module-instances/'+instance.id+'/records',{data:{unknown:'Forbidden'}},'POST','member')).status,422);
    const saved=read(data);assert.equal(saved.projects.find(row=>row.id===project.id).totalTasks,2);assert.equal(saved.tasks.find(row=>row.id===task.id).estimatedHours,8.5);assert.equal(saved.subtasks.filter(row=>row.taskId===task.id).length,2);assert.equal(saved.comments.filter(row=>row.taskId===task.id).length,1);assert.equal(saved.moduleInstances.find(row=>row.id===instance.id).config.records[0].data.title,'Edited');
    const milestone=await api('/api/projects/'+project.id+'/milestones',{title:'Milestone aliases',dueDate:'2027-04-02',completed:false});assert.equal(milestone.status,201,JSON.stringify(milestone));assert.equal(milestone.body.deadline,'2027-04-02');assert.equal((await api('/api/milestones/'+milestone.body.id,{completed:true},'PUT')).body.status,'completed');
  });
  await t.test('new domain routes reject cross-workspace IDs, forged actor fields and dependency cycles',async()=>{
    assert.equal((await api('/api/tasks/'+task.id,{projectId:foreignProject.id},'PUT')).status,404);
    assert.equal((await api('/api/tasks/'+task.id,{creatorId:a.id},'PUT','member')).status,422);
    assert.equal((await api('/api/tasks/'+blocker.id,{dependencies:[task.id]},'PUT','member')).status,422);
    assert.equal((await api('/api/tasks/'+task.id,undefined,'GET','member',wb)).status,404);
    assert.equal((await api('/api/org/module-instances/'+instance.id+'/records',{data:{title:'Leak'}},'POST','member',wb)).status,404);
    assert.equal((await api('/api/projects/'+foreignProject.id,undefined,'GET')).status,404);
  });
  await t.test('task completion, subtask reopening, real comments and work-entry updates persist coherently',async()=>{
    assert.equal((await api('/api/tasks/'+task.id+'/status',{status:'COMPLETED'},'PUT','member')).status,409);
    await api('/api/tasks/'+blocker.id+'/status',{status:'COMPLETED'},'PUT','member');
    const open=task.subtasks.find(row=>!row.completed);assert.equal((await api('/api/subtasks/'+open.id,{completed:true},'PUT','member')).status,200);
    assert.equal((await api('/api/tasks/'+task.id)).body.status,'completed');assert.equal((await api('/api/projects/'+project.id)).body.completedTasks,2);
    await api('/api/subtasks/'+open.id,{completed:false},'PUT','member');assert.equal((await api('/api/tasks/'+task.id)).body.status,'inprogress');assert.equal((await api('/api/projects/'+project.id)).body.completedTasks,1);
    const comment=await api('/api/tasks/'+task.id+'/comments',{content:'Owner note'});assert.equal(comment.status,201,JSON.stringify(comment));assert.equal((await api('/api/comments/'+comment.body.id,{content:'Hijack'},'PUT','member')).status,403);
    await api('/api/comments/'+comment.body.id,{content:'Owner edited note'},'PUT');const listing=(await api('/api/tasks')).body.find(row=>row.id===task.id);assert.ok(listing.comments.some(row=>row.content==='Owner edited note'));assert.equal(listing.commentsCount,2);
    const work=await api('/api/tasks/'+task.id+'/time-entries',{hours:2.25,note:'Real work',startedAt:'2027-01-01T08:00:00+03:30',endedAt:'2027-01-01T10:15:00+03:30'},'POST','member');assert.equal(work.status,201,JSON.stringify(work));entry=work.body.entry;assert.equal(work.body.task.loggedHours,3.75);
    const changed=await api('/api/time-entries/'+entry.id,{hours:3},'PUT','member');assert.equal(changed.status,200,JSON.stringify(changed));assert.equal(changed.body.task.loggedHours,4.5);assert.equal((await api('/api/tasks/'+task.id+'/time-entries')).body.find(row=>row.id===entry.id).hours,3);
  });
  await t.test('checklist, content review and QA lifecycle use real scoped records for ordinary writers',async()=>{
    check=await api('/api/wordpress-checklist',{projectId:project.id,name:'Real checklist',category:'security',assigneeId:b.id,priority:'high',dueDate:'2027-04-01'},'POST','member');assert.equal(check.status,201,JSON.stringify(check));check=check.body;
    const completed=await api('/api/wordpress-checklist/'+check.id,{status:'completed'},'PUT','member');assert.equal(completed.status,200,JSON.stringify(completed));assert.equal(completed.body.progress,100);
    content=await api('/api/content-center',{projectId:project.id,pageName:'Home',writerId:b.id,reviewerId:a.id,contentBody:'Actual text',status:'writing'});assert.equal(content.status,201,JSON.stringify(content));content=content.body;
    assert.equal((await api('/api/content-center/'+content.id,{contentBody:'Writer draft',status:'review'},'PUT','member')).status,200);
    assert.equal((await api('/api/content-center/'+content.id,{status:'approved'},'PUT','member')).status,403);
    assert.equal((await api('/api/content-center/'+content.id,{status:'approved'},'PUT')).status,200);assert.equal((await api('/api/content-center/'+content.id,{status:'published'},'PUT')).status,200);
    const revision=await api('/api/content-center/'+content.id,{contentBody:'Changed after approval'},'PUT','member');assert.equal(revision.status,200,JSON.stringify(revision));assert.equal(revision.body.status,'writing');assert.equal(revision.body.approvalStatus,'pending');
    bug=await api('/api/qa-bugs',{projectId:project.id,title:'Real QA bug',category:'forms',severity:'critical',assigneeId:b.id},'POST','member');assert.equal(bug.status,201,JSON.stringify(bug));bug=bug.body;
    assert.equal((await api('/api/qa-bugs/'+bug.id,{status:'verified'},'PUT','member')).status,409);assert.equal((await api('/api/qa-bugs/'+bug.id,{status:'fixed'},'PUT','member')).status,200);assert.equal((await api('/api/qa-bugs/'+bug.id,{status:'verified'},'PUT')).status,200);assert.equal((await api('/api/qa-bugs/'+bug.id,{status:'reopened'},'PUT','member')).body.reopenCount,1);
  });
  await t.test('explicit server-owned team permission denies apply to task and module rows without escalating privileges',async()=>{
    const rule=async(action,isAllowed)=>{const result=await api('/api/org/permissions',{departmentId:department.id,role:team.id,action,isAllowed},'PUT');assert.equal(result.status,200,JSON.stringify(result));};
    const teamOnly=(await api('/api/tasks',{title:'Team-only restricted task',projectId:otherProject.id,teamId:team.id})).body;
    const socket=io(runtime.origin,{transports:['websocket'],reconnection:false,timeout:3000,auth:{token:member.token,workspaceId:wa}});sockets.push(socket);await Promise.race([once(socket,'connect'),once(socket,'connect_error').then(([error])=>{throw error;})]);
    await rule('update',false);assert.equal((await api('/api/tasks/'+task.id,{title:'Denied update'},'PUT','member')).status,403);assert.equal((await api('/api/org/module-instances/'+instance.id+'/records/'+record.id,{data:{title:'Denied',state:'open'}},'PUT','member')).status,403);
    assert.equal((await api('/api/tasks/'+teamOnly.id,{title:'Denied team-only update'},'PUT','member')).status,403);
    assert.equal((await api('/api/tasks/'+task.id,{notes:'Manager bypass is explicit'},'PUT')).status,200);
    await rule('create',false);assert.equal((await api('/api/tasks',{title:'Denied create',projectId:project.id,departmentId:department.id},'POST','member')).status,403);assert.equal((await api('/api/org/module-instances/'+instance.id+'/records',{data:{title:'Denied',state:'open'}},'POST','member')).status,403);
    await rule('read',false);assert.equal((await api('/api/tasks/'+task.id,undefined,'GET','member')).status,404);assert.equal((await api('/api/tasks/'+teamOnly.id,undefined,'GET','member')).status,404);assert.ok(!(await api('/api/tasks',undefined,'GET','member')).body.some(row=>row.id===task.id));assert.ok(!(await api('/api/org/data',undefined,'GET','member')).body.moduleInstances.some(row=>row.id===instance.id));
    const delivered=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Workspace invalidation was not delivered.')),5000);socket.once('app_tasks_updated',payload=>{clearTimeout(timer);try{const serialized=JSON.stringify(payload);for(const secret of ['Fully persisted task','Team-only restricted task','Owner edited note',task.id,teamOnly.id])assert.ok(!serialized.includes(secret));if(Array.isArray(payload)){assert.ok(!payload.some(row=>row.id===task.id||row.id===teamOnly.id));}resolve();}catch(error){reject(error);}});});
    assert.equal((await api('/api/tasks/'+task.id,{notes:'Manager update while member read is denied'},'PUT')).status,200);await delivered;
    for(const action of ['update','create','read'])await rule(action,true);
    socket.disconnect();
    assert.equal((await api('/api/tasks/'+task.id,{notes:'Allowed again'},'PUT','member')).status,200);
    assert.equal((await api('/api/org/modules/'+definition.id,{name:'Still forbidden'},'PUT','member')).status,403);
    assert.equal((await api('/api/tasks/'+teamOnly.id,{},'DELETE')).status,200);
  });
  await t.test('a restricted writer cannot reduce canonical project counters to the visible task subset',async()=>{
    const hidden=(await api('/api/tasks',{title:'Hidden department task',projectId:otherProject.id,departmentId:department.id,status:'COMPLETED',loggedHours:4})).body;
    const visible=(await api('/api/tasks',{title:'Visible unrestricted task',projectId:otherProject.id,status:'pending',loggedHours:2})).body;
    const managerReport=await api('/api/org/reports/executive-summary',{});assert.equal(managerReport.status,201,JSON.stringify(managerReport));assert.ok(managerReport.body.reportDepartmentIds.includes(department.id));
    const denied=await api('/api/org/permissions',{departmentId:department.id,role:team.id,action:'read',isAllowed:false},'PUT');assert.equal(denied.status,200,JSON.stringify(denied));
    assert.equal((await api('/api/tasks/'+hidden.id,undefined,'GET','member')).status,404);
    const changed=await api('/api/tasks/'+visible.id,{title:'Updated visible task'},'PUT','member');assert.equal(changed.status,200,JSON.stringify(changed));
    const canonical=read(data).projects.find(row=>row.id===otherProject.id);assert.equal(canonical.totalTasks,2);assert.equal(canonical.completedTasks,1);assert.equal(canonical.progress,50);assert.equal(canonical.loggedHours,6);
    const restrictedReport=await api('/api/org/reports/executive-summary',{},'POST','member');assert.equal(restrictedReport.status,201,JSON.stringify(restrictedReport));assert.equal(restrictedReport.body.taskSummary.total,1);assert.equal(restrictedReport.body.projectSummary.avgProgress,0);assert.equal(restrictedReport.body.projectSummary.completedProjects,0);assert.ok(!(await api('/api/org/reports',undefined,'GET','member')).body.some(row=>row.id===managerReport.body.id));
    await api('/api/org/permissions',{departmentId:department.id,role:team.id,action:'read',isAllowed:true},'PUT');await api('/api/tasks/'+hidden.id,{},'DELETE');await api('/api/tasks/'+visible.id,{},'DELETE');
  });
  await t.test('SQL failure rolls back memory, child mutation, counters and business audit together',async()=>{
    const before=read(data),database=new DatabaseSync(path.join(data,'orbit.sqlite'));
    database.exec(`CREATE TRIGGER stage4_fixture_reject BEFORE UPDATE ON tasks WHEN json_extract(NEW.payload,'$.title')='REJECT_SQL' BEGIN SELECT RAISE(ABORT,'stage4 isolated fixture rejection'); END`);database.close();
    try{const rejected=await api('/api/tasks/'+task.id,{title:'REJECT_SQL',subtasks:[{title:'Must not survive'}],loggedHours:99},'PUT');assert.equal(rejected.status,503,JSON.stringify(rejected));const after=read(data);for(const collection of ['tasks','subtasks','comments','timeEntries','projects','auditLogs'])assert.deepEqual(after[collection],before[collection],collection);assert.equal((await api('/api/tasks/'+task.id)).body.title,'Fully persisted task');}
    finally{const repair=new DatabaseSync(path.join(data,'orbit.sqlite'));repair.exec('DROP TRIGGER stage4_fixture_reject');repair.close();}
  });
  await t.test('restart keeps token, comments, work entries, module rows, checklist/content/QA and counters',async()=>{
    const saved=read(data),port=runtime.port;await stop(runtime);runtime=undefined;runtime=await start(data,port);
    const restored=await api('/api/tasks/'+task.id);assert.equal(restored.status,200,JSON.stringify(restored));assert.equal(restored.body.loggedHours,4.5);assert.ok(restored.body.comments.some(row=>row.content==='Owner edited note'));assert.equal(restored.body.subtasks.length,2);assert.ok(restored.body.timeEntries.some(row=>row.note==='Real work'&&row.hours===3));assert.deepEqual(restored.body.assignees.map(row=>row.id),[a.id,b.id]);assert.equal(restored.body.linksCount,1);
    const after=read(data);for(const collection of ['projects','tasks','comments','subtasks','timeEntries','moduleInstances','wordpressChecklist','contentCenter','qaBugs'])assert.deepEqual(after[collection],saved[collection],collection);
    assert.equal((await api('/api/org/data')).body.moduleInstances.find(row=>row.id===instance.id).config.records[0].data.title,'Edited');
  });
  await t.test('task transfer updates both project counters and relational work-entry scope; delete cascades exactly',async()=>{
    const transfer=await api('/api/tasks/'+task.id,{projectId:otherProject.id},'PUT');assert.equal(transfer.status,200,JSON.stringify(transfer));assert.equal((await api('/api/projects/'+project.id)).body.totalTasks,1);assert.equal((await api('/api/projects/'+otherProject.id)).body.totalTasks,1);assert.ok(read(data).timeEntries.filter(row=>row.taskId===task.id).every(row=>row.projectId===otherProject.id));
    const removed=await api('/api/projects/'+otherProject.id,{},'DELETE');assert.equal(removed.status,200,JSON.stringify(removed));const saved=read(data);assert.ok(!saved.tasks.some(row=>row.id===task.id));for(const collection of ['subtasks','comments','timeEntries'])assert.ok(!saved[collection].some(row=>row.taskId===task.id),collection);assert.ok(saved.projects.some(row=>row.id===project.id));assert.ok(saved.projects.some(row=>row.id===foreignProject.id));
    assert.equal((await api('/api/projects/'+project.id,{},'DELETE')).status,200);const final=read(data);for(const collection of ['wordpressChecklist','contentCenter','qaBugs','milestones'])assert.ok(!final[collection].some(row=>row.projectId===project.id),collection);assert.ok(final.departments.some(row=>row.id===department.id));assert.ok(final.moduleInstances.some(row=>row.id===instance.id));
    const database=new DatabaseSync(path.join(data,'orbit.sqlite'),{readOnly:true});try{assert.equal(database.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(),[]);}finally{database.close();}
  });
});
