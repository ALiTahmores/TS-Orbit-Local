import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import express from 'express';

const root=fileURLToPath(new URL('../../',import.meta.url));
test('project/task domain lifecycle preserves identities, relations and derived values',async t=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'orbit-stage4-core-'));
  const output=path.join(temporary,'core.cjs');
  await build({stdin:{contents:`export * from './server/domain/projects-tasks.ts';export * from './server/policy/scope.ts';export {collectionNames} from './server/db/schema.ts';`,resolveDir:root,sourcefile:'stage4-test.ts',loader:'ts'},outfile:output,bundle:true,platform:'node',target:'node24',format:'cjs',logLevel:'silent'});
  const {createProjectTaskRouter,ScopedState,collectionNames,membership,writer}=createRequire(import.meta.url)(output);
  const state=Object.fromEntries(collectionNames.map(name=>[name,[]]));
  state.users=[{id:'a',name:'Owner A',role:'USER',accountStatus:'ACTIVE'},{id:'b',name:'Member B',role:'USER',accountStatus:'ACTIVE'},{id:'c',name:'Owner C',role:'OWNER',systemRole:'ADMIN',accountStatus:'ACTIVE'},{id:'view',name:'Viewer',accountStatus:'ACTIVE'}];
  state.workspaces=[{id:'wa',ownerId:'a',members:[{userId:'a',role:'OWNER'},{userId:'b',role:'MEMBER',permissions:['read','write']},{userId:'view',role:'VIEWER'}]},{id:'wc',ownerId:'c',members:[{userId:'c',role:'OWNER'}]}];
  state.teams=[{id:'ta',name:'Team A',workspaceId:'wa'},{id:'tc',name:'Team C',workspaceId:'wc'}];
  state.departments=[{id:'da',name:'Department A',workspaceId:'wa'},{id:'dc',name:'Department C',workspaceId:'wc'}];
  const scoped=new ScopedState(state),events=[];
  const app=express();app.use(express.json());
  // The production PersistenceCoordinator provides the same rollback boundary.
  // Here the isolated router fixture snapshots only its disposable in-memory data.
  app.use((req,res,next)=>{const before=JSON.stringify(state),eventCount=events.length;const end=res.end;res.end=function(...args){if(res.statusCode>=400){for(const key of Object.keys(state))delete state[key];Object.assign(state,JSON.parse(before));events.length=eventCount;}return end.apply(this,args);};next();});
  app.use((req,res,next)=>{const user=state.users.find(user=>user.id===req.headers['x-actor']);if(!user)return res.status(401).json({error:'UNAUTHORIZED'});const workspaceId=req.headers['x-workspace-id']||'wa',grant=membership(state,user,workspaceId);if(!grant)return res.status(403).json({error:'WORKSPACE_FORBIDDEN'});if(req.method!=='GET'&&!writer(grant))return res.status(403).json({error:'READ_ONLY'});scoped.run({kind:'workspace',user,workspaceId,path:'/api'+req.path,method:req.method},next);});
  app.use('/api',createProjectTaskRouter({scoped,broadcast:(event,payload)=>events.push({event,payload:JSON.parse(JSON.stringify(payload))})}));
  app.use((error,req,res,next)=>res.status(error.status||500).json({error:error.code||'INTERNAL_ERROR',message:error.message}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}/api`;
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(temporary,{recursive:true,force:true});});
  const call=async(route,body,method=body===undefined?'GET':'POST',actor='a',workspace='wa')=>{const response=await fetch(base+route,{method,headers:{'content-type':'application/json','x-actor':actor,'x-workspace-id':workspace},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:response.status,body:await response.json()};};
  let first,second,foreign,task,dependency;

  await t.test('projects have UUIDs, server actor, strong portal token and no fabricated values',async()=>{
    const created=await call('/projects',{title:'Project A',workspaceId:'wa',assignedMemberIds:['a','b'],assignedTeamIds:['ta'],departmentId:'da',budget:'0',amount:0,currency:'IRT',deadline:'2027-01-15'});
    assert.equal(created.status,201);first=created.body;assert.match(first.id,/^proj_[0-9a-f-]{36}$/);assert.match(first.portalToken,/^[a-f0-9]{64}$/);assert.equal(first.createdById,'a');assert.equal(first.clientName,'');assert.equal(first.budget,'0');assert.equal(first.currency,'IRT');assert.equal(first.deadlineCanonical,'2027-01-15');assert.equal(first.progress,0);
    second=(await call('/projects',{title:'Project B'})).body;
    foreign=(await call('/projects',{title:'Foreign'},'POST','c','wc')).body;
    assert.equal((await call('/projects',{title:'No',createdById:'c'})).status,422);
    assert.equal((await call('/projects',{title:'No',assignedTeamIds:['tc']})).status,404);
    assert.equal((await call('/projects',{title:'No',teamLeadId:'c'})).status,404);
    assert.equal((await call('/projects',{title:'Wrong scope',workspaceId:'wc'})).status,422);
    const display=(await call('/projects',{title:'Legacy label',teamLead:'Owner C'})).body;assert.equal(display.teamLead,'Owner C');assert.equal(display.teamLeadId,'');
    assert.equal((await call('/projects',{title:'Foreign ID',teamLead:'c'})).status,404);
    assert.equal((await call('/projects',{title:'No',currency:'?'})).status,422);
    assert.equal((await call('/projects',{title:'No'},'POST','b')).status,403);
  });
  await t.test('task creation persists all modal fields, multi-assignees and initial comments atomically',async()=>{
    const result=await call('/tasks',{title:'Task A',projectId:first.id,status:'IN_PROGRESS',priority:'Urgent',assignedMemberIds:['a','b'],description:'Details',notes:'Private note',tags:['work','work'],estimatedHours:7.5,loggedHours:1.25,dueDate:'۱۴۰۵/۰۵/۳۰',departmentId:'da',teamId:'ta',clientVisible:true,links:['https://example.test/spec'],initialComments:['Initial note'],subtasks:[{id:'client-draft',title:'One',note:'Keep this note',completed:false},{title:'Two',completed:true}]});
    assert.equal(result.status,201);task=result.body;assert.equal(task.status,'inprogress');assert.equal(task.priority,'critical');assert.equal(task.creatorId,'a');assert.equal(task.loggedHours,1.25);assert.equal(task.commentsCount,1);assert.equal(task.linksCount,1);assert.equal(task.subtasks.length,2);assert.notEqual(task.subtasks[0].id,'client-draft');assert.deepEqual(task.assignees.map(user=>user.id),['a','b']);assert.deepEqual(task.tags,['work']);assert.equal(task.progress,50);assert.equal(task.dueDate,'۱۴۰۵/۰۵/۳۰');assert.match(task.dueDateCanonical,/^2026-08-/);const parts=Object.fromEntries(new Intl.DateTimeFormat('en-u-ca-persian',{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(task.dueDateCanonical)).map(part=>[part.type,part.value]));assert.deepEqual([parts.year,parts.month,parts.day],['1405','05','30']);
    assert.equal(state.comments.find(comment=>comment.taskId===task.id).userId,'a');
    const snapshot=JSON.stringify(state);assert.equal((await call('/tasks',{title:'Bad',projectId:first.id,initialComments:['good','  ']})).status,422);assert.equal(JSON.stringify(state),snapshot);
    assert.equal((await call('/tasks',{title:'Bad',projectId:first.id,assigneeId:'c'})).status,404);
    assert.equal((await call('/tasks',{title:'Bad',projectId:first.id,attachments:[{id:'fake',url:'#'}]})).status,404);
    assert.equal((await call('/tasks',{title:'Bad',projectId:first.id,progress:99})).status,422);
  });
  await t.test('live scoped lookups reject foreign parents and forged actor/child IDs',async()=>{
    assert.equal((await call('/projects/'+foreign.id)).status,404);
    assert.equal((await call('/tasks',{title:'Leak',projectId:foreign.id})).status,404);
    assert.equal((await call('/tasks/'+task.id,{projectId:foreign.id},'PUT')).status,404);
    assert.equal((await call('/tasks/'+task.id,{workspaceId:'wc'},'PUT')).status,422);
    assert.equal((await call('/tasks/'+task.id,{title:'No'},'PUT','view')).status,403);
    assert.equal((await call('/tasks/'+task.id,undefined,'GET','c','wc')).status,404);
    assert.deepEqual((await call('/tasks?projectId='+first.id)).body.map(row=>row.id),[task.id]);
  });
  await t.test('project lifecycle aliases retain the explicit reason and real date validation',async()=>{
    assert.equal((await call('/projects/'+first.id,{status:'on_hold',statusReason:'Waiting for client'},'PUT')).body.project.status,'delayed');
    assert.equal(state.projects.find(row=>row.id===first.id).statusHistory.at(-1).reason,'Waiting for client');
    assert.equal((await call('/projects/'+first.id,{status:'terminated'},'PUT')).body.project.status,'CANCELLED');
    assert.equal((await call('/projects/'+first.id,{status:'review'},'PUT')).body.project.status,'DRAFT');
    assert.equal((await call('/projects/'+first.id+'/activate',{},'PUT')).body.project.status,'ACTIVE');
    assert.equal((await call('/projects/'+first.id,{deadline:'۱۴۰۵/۱۲/۳۰'},'PUT')).status,422);
    assert.equal((await call('/projects/'+first.id,{deadline:'2027-02-31T08:00:00Z'},'PUT')).status,422);
  });
  await t.test('subtask completion and reopening recalculate task and project consistently',async()=>{
    let sub=task.subtasks.find(row=>!row.completed);
    assert.equal((await call('/subtasks/'+sub.id,{completed:true},'PUT')).status,200);
    let current=(await call('/tasks/'+task.id)).body;assert.equal(current.status,'completed');assert.equal(current.progress,100);assert.equal((await call('/projects/'+first.id)).body.completedTasks,1);
    assert.equal((await call('/subtasks/'+sub.id,{completed:false,note:'Reopened'},'PUT')).status,200);
    current=(await call('/tasks/'+task.id)).body;assert.equal(current.status,'inprogress');assert.equal(current.progress,50);assert.equal(current.subtasks[0].note,'Reopened');assert.equal((await call('/projects/'+first.id)).body.completedTasks,0);
    assert.equal((await call('/tasks/'+task.id+'/status',{status:'COMPLETED'},'PUT')).status,409);
    assert.equal((await call('/tasks/'+task.id,{status:'COMPLETED'},'PUT')).status,409);
    await call('/subtasks/'+sub.id,undefined,'DELETE');current=(await call('/tasks/'+task.id)).body;assert.equal(current.progress,100);assert.equal(current.status,'completed');
  });
  await t.test('dependencies reject cycles and every completion path enforces unfinished blockers',async()=>{
    dependency=(await call('/tasks',{title:'Dependency',projectId:second.id})).body;
    assert.equal((await call('/tasks/'+task.id,{status:'inprogress'},'PUT')).status,200);
    assert.equal((await call('/tasks/'+task.id,{dependencies:[dependency.id]},'PUT')).status,200);
    assert.equal((await call('/tasks/'+dependency.id,{dependencies:[task.id]},'PUT')).status,422);
    assert.equal((await call('/tasks/'+task.id+'/status',{status:'completed'},'PUT')).status,409);
    assert.equal((await call('/tasks/'+task.id,{status:'completed'},'PUT')).status,409);
    assert.equal((await call('/tasks',{title:'Bad completion',projectId:first.id,status:'completed',dependencies:[dependency.id]})).status,409);
    await call('/tasks/'+dependency.id+'/status',{status:'completed'},'PUT');
    assert.equal((await call('/tasks/'+task.id+'/status',{status:'completed',reason:'Approved'},'PUT')).status,200);
    assert.equal(state.tasks.find(row=>row.id===task.id).statusHistory.at(-1).reason,'Approved');
  });
  await t.test('comment ownership is enforced and edits/counts persist',async()=>{
    const comment=(await call('/tasks/'+task.id+'/comments',{content:'By member'},'POST','b')).body;
    assert.equal(comment.userId,'b');assert.equal((await call('/comments/'+comment.id,{content:'Member edit'},'PUT','b')).status,200);
    const ownerComment=(await call('/tasks/'+task.id+'/comments',{content:'By owner'})).body;
    assert.equal((await call('/comments/'+ownerComment.id,{content:'Hijack'},'PUT','b')).status,403);
    assert.equal((await call('/comments/'+comment.id,undefined,'DELETE','b')).status,200);
    assert.equal((await call('/tasks/'+task.id)).body.commentsCount,2);
  });
  await t.test('work entries round trip, enforce author, preserve old totals and reject negative totals',async()=>{
    const result=await call('/tasks/'+task.id+'/time-entries',{hours:2,note:'Implementation',startedAt:'2027-01-01T08:00:00Z',endedAt:'2027-01-01T10:00:00Z'},'POST','b');assert.equal(result.status,201);assert.equal(result.body.entry.userId,'b');assert.equal(result.body.task.loggedHours,3.25);
    state.users.find(user=>user.id==='b').name='Renamed member';const hydrated=(await call('/tasks/'+task.id)).body;assert.equal(hydrated.assignees.find(user=>user.id==='b').name,'Renamed member');assert.ok(hydrated.timeEntries.some(entry=>entry.note==='Implementation'));assert.equal(hydrated.linksCount,1);
    const entry=result.body.entry;
    assert.equal((await call('/time-entries/'+entry.id,{hours:3},'PUT','b')).body.task.loggedHours,4.25);
    assert.equal((await call('/tasks/'+task.id,{loggedHours:2},'PUT','b')).status,403);
    assert.equal((await call('/tasks/'+task.id,{loggedHours:1},'PUT')).body.loggedHours,1);
    assert.equal((await call('/time-entries/'+entry.id,undefined,'DELETE','b')).status,409);
    assert.equal((await call('/tasks/'+task.id,{loggedHours:5},'PUT')).body.loggedHours,5);
    assert.equal((await call('/time-entries/'+entry.id,undefined,'DELETE','b')).status,200);
    assert.equal((await call('/tasks/'+task.id)).body.loggedHours,2);
    assert.equal((await call('/tasks/'+task.id+'/time-entries',{hours:-1})).status,422);
    assert.equal((await call('/tasks/'+task.id+'/time-entries',{hours:1,startedAt:'2027-01-01'})).status,422);
    const legacy=(await call('/tasks',{title:'Legacy time',projectId:first.id})).body;state.tasks.find(row=>row.id===legacy.id).loggedHours=6;
    assert.equal((await call('/tasks/'+legacy.id)).body.loggedHours,6);
    const addition=await call('/tasks/'+legacy.id+'/time-entries',{hours:2});assert.equal(addition.body.task.loggedHours,8);assert.equal(state.timeEntries.find(row=>row.taskId===legacy.id&&row.kind==='legacy_baseline').hours,6);
  });
  await t.test('moving tasks updates both projects and child time-entry project IDs',async()=>{
    const old=(await call('/projects/'+first.id)).body.totalTasks;
    const result=await call('/tasks/'+task.id,{projectId:second.id},'PUT');assert.equal(result.status,200);
    assert.equal((await call('/projects/'+first.id)).body.totalTasks,old-1);assert.equal((await call('/projects/'+second.id)).body.totalTasks,2);
    assert.ok(state.timeEntries.filter(entry=>entry.taskId===task.id).every(entry=>entry.projectId===second.id));
  });
  await t.test('milestones support clearing fields and retain server dates without default deadlines',async()=>{
    const result=await call('/projects/'+second.id+'/milestones',{title:'Release',description:'Draft',deadline:'2027-02-28'});assert.equal(result.status,201);assert.match(result.body.id,/^ms_[0-9a-f-]{36}$/);
    assert.equal((await call('/milestones/'+result.body.id,{description:'',deadline:'',status:'completed'},'PUT')).body.description,'');
    assert.equal((await call('/projects/'+second.id+'/milestones',{title:'Invalid',deadline:'2027-02-31'})).status,422);
    const aliases=await call('/projects/'+second.id+'/milestones',{title:'Date aliases',dueDate:'2027-01-01',completed:true});assert.equal(aliases.status,201);assert.equal(aliases.body.deadline,'2027-01-01');assert.equal(aliases.body.status,'completed');
    assert.equal((await call('/milestones/'+aliases.body.id,{completed:false},'PUT')).body.status,'pending');
    assert.equal((await call('/milestones/'+result.body.id,undefined,'DELETE')).status,200);
  });
  await t.test('task delete cascades comments/subtasks/work logs and removes dependency references',async()=>{
    const parent=(await call('/tasks',{title:'Parent',projectId:first.id,subtasks:[{title:'Child'}],initialComments:['Comment'],loggedHours:2})).body;
    const dependent=(await call('/tasks',{title:'Dependent',projectId:second.id,dependencies:[parent.id]})).body;
    assert.equal((await call('/tasks/'+parent.id,undefined,'DELETE')).status,200);
    for(const collection of ['comments','subtasks','timeEntries'])assert.ok(!state[collection].some(row=>row.taskId===parent.id));
    assert.deepEqual(state.tasks.find(row=>row.id===dependent.id).dependencies,[]);
  });
  await t.test('legacy nested task cascade updates a hidden sibling project without exposing its rows',async()=>{
    const hidden=(await call('/projects',{title:'Hidden sibling project',departmentId:'da'})).body;
    const parent=(await call('/tasks',{title:'Visible cascade parent',projectId:second.id})).body;
    state.tasks.push({id:'legacy-nested-child',workspaceId:'wa',projectId:hidden.id,parentTaskId:parent.id,title:'Hidden nested child',status:'completed',loggedHours:2});
    Object.assign(state.projects.find(row=>row.id===hidden.id),{totalTasks:1,completedTasks:1,progress:100,loggedHours:2});
    state.departmentPermissions.push({id:'temporary-denial',workspaceId:'wa',departmentId:'da',role:'MEMBER',action:'read',isAllowed:false});
    assert.equal((await call('/tasks/'+parent.id,undefined,'DELETE','b')).status,200);
    const canonical=state.projects.find(row=>row.id===hidden.id);assert.equal(canonical.totalTasks,0);assert.equal(canonical.completedTasks,0);assert.equal(canonical.progress,0);assert.equal(canonical.loggedHours,0);assert.ok(!state.tasks.some(row=>row.id==='legacy-nested-child'));
    state.departmentPermissions=state.departmentPermissions.filter(row=>row.id!=='temporary-denial');
  });
  await t.test('business cascades refuse imported identity/session/profile references before changing any records',async()=>{
    const project=(await call('/projects',{title:'Identity reference guard'})).body;
    state.users.find(user=>user.id==='b').projectId=project.id;
    let before=JSON.stringify(state);let denied=await call('/projects/'+project.id,undefined,'DELETE');assert.equal(denied.status,409);assert.equal(denied.body.error,'UNSAFE_LEGACY_RELATION');assert.equal(JSON.stringify(state),before);
    delete state.users.find(user=>user.id==='b').projectId;
    for(const collection of ['userSessions','userProfiles','loginHistory','userDevices','securityEvents','profileImages','userPreferences','userActivities','approvalRequests','approvalHistory','notificationQueue','emailQueue']){
      state[collection].push({id:'identity-guard-'+collection,userId:'b',projectId:project.id,workspaceId:'wa'});before=JSON.stringify(state);
      denied=await call('/projects/'+project.id,undefined,'DELETE');assert.equal(denied.status,409,collection);assert.equal(denied.body.error,'UNSAFE_LEGACY_RELATION');assert.equal(JSON.stringify(state),before,collection);
      state[collection]=state[collection].filter(row=>row.id!=='identity-guard-'+collection);
    }
    assert.equal((await call('/projects/'+project.id,undefined,'DELETE')).status,200);
  });
  await t.test('project delete removes project children, preserves other workspace and unrelated project rows',async()=>{
    const preserved=JSON.stringify(state.projects.find(row=>row.id===foreign.id));
    state.notifications.push({id:'recipient-notice',workspaceId:'wa',projectId:second.id,userId:'b',title:'Task'});
    state.wpSites.push({id:'site',workspaceId:'wa',projectId:second.id});state.wpLogs.push({id:'wp-log',workspaceId:'wa',projectId:second.id});
    const result=await call('/projects/'+second.id,undefined,'DELETE');assert.equal(result.status,200,JSON.stringify(result.body));
    for(const collection of ['tasks','comments','subtasks','timeEntries','milestones','wpSites','wpLogs','notifications'])assert.ok(!state[collection].some(row=>row.projectId===second.id));
    assert.equal(JSON.stringify(state.projects.find(row=>row.id===foreign.id)),preserved);assert.ok(state.projects.some(row=>row.id===first.id));
  });
  await t.test('conflicting legacy parent scope blocks cascade instead of deleting foreign rows',async()=>{
    const child={id:'conflicting',workspaceId:'wc',projectId:first.id,taskId:state.tasks.find(row=>row.projectId===first.id).id,content:'Old inconsistent data'};state.comments.push(child);const before=JSON.stringify(state);
    assert.equal((await call('/projects/'+first.id,undefined,'DELETE')).status,409);assert.equal(JSON.stringify(state),before);
    assert.ok(events.some(event=>event.event==='app_tasks_updated'));assert.ok(events.some(event=>event.event==='app_projects_updated'));
  });
});
