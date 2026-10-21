import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {build} from 'esbuild';
import {emptyState} from '../../server/db/store.ts';
const result=await build({entryPoints:[path.resolve(import.meta.dirname,'../../server/policy/scope.ts')],platform:'node',format:'esm',bundle:true,write:false});
const {ScopedState,departmentAction}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));

test('department rules use authoritative membership, restrict all parent departments, and cannot elevate a viewer',()=>{
  const state=emptyState(),owner={id:'owner'},member={id:'member',role:'OWNER',memberships:[{workspaceId:'w',role:'OWNER'}]},viewer={id:'viewer'};
  state.users=[owner,member,viewer];state.workspaces=[{id:'w',ownerId:'owner',members:[{userId:'member',role:'MEMBER',permissions:['read','write']},{userId:'viewer',role:'VIEWER',permissions:['*']}]},{id:'other',ownerId:'owner'}];
  state.departments=[{id:'allowed',workspaceId:'w'},{id:'denied',workspaceId:'w'},{id:'foreign',workspaceId:'other'}];state.teams=[{id:'team',workspaceId:'w',departmentId:'denied'}];state.teamMembers=[{id:'tm',workspaceId:'w',teamId:'team',userId:'member'}];
  state.projects=[{id:'p',workspaceId:'w'}];state.tasks=[{id:'hidden',workspaceId:'w',projectId:'p',teamId:'team'},{id:'mixed',workspaceId:'w',projectId:'p',departmentId:'allowed',teamId:'team'},{id:'visible',workspaceId:'w',projectId:'p',departmentId:'allowed'}];
  state.departmentPermissions=[{id:'rule',workspaceId:'w',departmentId:'denied',role:'team',action:'read',isAllowed:false}];
  const scoped=new ScopedState(state),scope={kind:'workspace',user:member,workspaceId:'w',path:'/api/tasks',method:'GET'};
  assert.deepEqual(scoped.run(scope,()=>scoped.rows('tasks').map(row=>row.id)),['visible']);
  assert.equal(departmentAction(scoped,member,'w','denied','read'),false,'display OWNER never grants authority');
  assert.equal(departmentAction(scoped,owner,'w','denied','read'),true,'actual workspace owner can manage restrictions');
  state.departmentPermissions.push({id:'allow-viewer',workspaceId:'w',departmentId:'allowed',role:'VIEWER',action:'create',isAllowed:true});
  assert.equal(departmentAction(scoped,viewer,'w','allowed','create'),false);
  state.departmentPermissions.push({id:'write-deny',workspaceId:'w',departmentId:'allowed',role:'MEMBER',action:'update',isAllowed:false});
  assert.equal(departmentAction(scoped,member,'w','allowed','update'),false);
  assert.equal(departmentAction(scoped,member,'w','foreign','read'),false);
  state.departmentReports=[{id:'report',workspaceId:'w',departmentId:'AGENCY',reportDepartmentIds:['allowed','denied'],creatorId:'owner'},{id:'own',workspaceId:'w',departmentId:'AGENCY',reportDepartmentIds:['allowed'],creatorId:'member'},{id:'legacy',workspaceId:'w',departmentId:'AGENCY',creatorId:'owner'}];
  assert.deepEqual(scoped.run(scope,()=>scoped.rows('departmentReports').map(row=>row.id)),['own']);
});
