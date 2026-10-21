import test from 'node:test';
import assert from 'node:assert/strict';
import { taskTransport,assignedIds,jalaliToISO,persianDateParts,projectStatusUI,reportSnapshot } from '../../src/lib/domain.ts';

test('task editor sends canonical IDs and user-editable fields, discards actor and derived totals',()=>{
  const dto=taskTransport({id:'forged',workspaceId:'foreign',creatorId:'another',title:'Task',projectId:'project',status:'IN_PROGRESS',priority:'Urgent',assignedTo:'Untrusted label',assignees:[{id:'user-a',name:'Fake Name'},{id:'user-a'},{userId:'user-b'}],loggedHours:500,progress:100,comments:[{content:'fake'}],commentsCount:9,subtasks:[{id:'draft-1',title:'Step',completed:false}],initialComments:['actual comment'],estimatedHours:2,links:['https://example.org/spec']});
  assert.deepEqual(dto.assignedMemberIds,['user-a','user-b']);assert.equal(dto.status,'inprogress');assert.equal(dto.priority,'critical');assert.equal(dto.estimatedHours,2);assert.deepEqual(dto.initialComments,['actual comment']);
  for(const key of ['id','workspaceId','creatorId','assignedTo','loggedHours','progress','comments','commentsCount']) assert.equal(Object.hasOwn(dto,key),false,key);
});
test('partial task edit preserves assignments when untouched and allows explicit unassignment',()=>{
  assert.equal(Object.hasOwn(taskTransport({title:'Edited'}),'assignedMemberIds'),false);
  assert.deepEqual(taskTransport({assignedMemberIds:[]}).assignedMemberIds,[]);
  assert.deepEqual(assignedIds(undefined),[]);
  assert.deepEqual(assignedIds({assignedMemberIds:['authoritative'],assigneeId:'legacy'}),['authoritative']);
});
test('editing a persisted subtask sends only editable nested fields and its stable ID',()=>{
  const saved={id:'sub-server-1',title:'Actual persisted subtask',note:'Keep this',completed:false,taskId:'task-1',workspaceId:'workspace-1',createdById:'actor-1',createdAt:'2026-10-17T00:00:00.000Z',updatedAt:'2026-10-17T01:00:00.000Z'};
  assert.deepEqual(taskTransport({subtasks:[{...saved,completed:true}]}).subtasks,[{id:'sub-server-1',title:'Actual persisted subtask',note:'Keep this',completed:true}]);
});
test('Persian picker converts valid leap date to ISO without normalizing an invalid day',()=>{
  assert.equal(jalaliToISO(1403,12,30),'2025-03-20');
  assert.deepEqual(persianDateParts(new Date('2025-03-20T12:00:00Z')),{month:12,day:30,year:1403});
  assert.throws(()=>jalaliToISO(1404,12,30));assert.throws(()=>jalaliToISO(1405,7,31));
});
test('project status display agrees with canonical API statuses and legacy aliases',()=>{
  for(const [input,output] of Object.entries({COMPLETED:'completed',CANCELLED:'canceled',DRAFT:'pending',IN_PROGRESS:'in_progress',delayed:'suspended',on_hold:'suspended',ARCHIVED:'archived'})) assert.equal(projectStatusUI(input),output);
});
test('report view preserves zero counts in the saved department snapshot',()=>{
  const saved={scope:'department',metrics:{totalTasks:0,completed:0,overdue:0,velocity:0},projectSummary:{totalProjects:0,avgProgress:0},taskSummary:{total:0,completed:0,overdue:0},content:'No tasks in this department',liveProjects:[{id:'unrelated'}],liveTasks:[{priority:'critical'}]};
  const view=reportSnapshot(saved);
  assert.equal(view.totalProjects,0);assert.equal(view.totalTasks,0);assert.equal(view.overdue,0);assert.equal(view.velocity,0);assert.deepEqual(view.projects,[]);
});
test('legacy custom report data remains unknown rather than fabricating current metrics',()=>{
  const view=reportSnapshot({metrics:{custom:{totalTasks:99},totalTasks:'99'},custom:{budget:'legacy'},clientProjectsMatrix:[null,[],{id:'saved',name:'Saved project',progress:5}]});
  assert.equal(view.totalProjects,undefined);assert.equal(view.totalTasks,undefined);assert.equal(view.overdue,undefined);assert.deepEqual(view.projects,[{id:'saved',name:'Saved project',progress:5}]);
});
