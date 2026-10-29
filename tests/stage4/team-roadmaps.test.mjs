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

// Team roadmaps become project checklists: default teams arrive once, a project's
// teams get a checklist copy, members tick steps and only managers change which
// checklists a project carries.
const root=path.resolve(import.meta.dirname,'../..');
const password='TeamRoadmapFixture42!';
const environment=data=>({...process.env,PROJECT_ROOT:root,NODE_ENV:'production',DATA_DIR:data,HOST:'127.0.0.1',PORT:'3000',APP_ORIGIN:'',ALLOW_NETWORK_ACCESS:'',LEGACY_DB_IMPORT:''});
function read(data){const db=new DatabaseSync(path.join(data,'orbit.sqlite'),{readOnly:true});try{return Object.fromEntries(collectionNames.map(name=>[name,db.prepare(`SELECT payload FROM "${name}" ORDER BY ordinal`).all().map(row=>JSON.parse(row.payload))]));}finally{db.close();}}
async function start(data){const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));const origin=`http://127.0.0.1:${port}`;const child=spawn(process.execPath,[path.join(root,'dist/server/server.cjs')],{cwd:root,env:{...environment(data),PORT:String(port),APP_ORIGIN:origin},windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);for(let i=0;i<200;i++){if(child.exitCode!==null)throw new Error(output);try{if((await fetch(origin+'/api/projects',{signal:AbortSignal.timeout(1000)})).status===401)return{child,origin};}catch{}await new Promise(resolve=>setTimeout(resolve,50));}child.kill();throw new Error('Team roadmap startup failed: '+output);}
async function stop(runtime){if(!runtime||runtime.child.exitCode!==null||runtime.child.signalCode!==null)return;const closed=once(runtime.child,'close');runtime.child.kill();await closed;}
async function request(runtime,endpoint,{body,token,workspace,method=body===undefined?'GET':'POST'}={}){const response=await fetch(runtime.origin+endpoint,{method,signal:AbortSignal.timeout(8000),headers:{...(body===undefined?{}:{'content-type':'application/json'}),...(token?{authorization:'Bearer '+token}:{}),...(workspace?{'x-workspace-id':workspace}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const value=await response.text();let result;try{result=JSON.parse(value);}catch{result=value;}return{status:response.status,body:result};}

test('team roadmaps seed once, copy into projects and tick under policy',{timeout:120000},async t=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'orbit-team-roadmaps-')),data=path.join(temporary,'data');let runtime;
  t.after(async()=>{await stop(runtime);fs.rmSync(temporary,{recursive:true,force:true});});
  const bootstrap=spawnSync(process.execPath,[path.join(root,'dist/server/local-account.cjs'),'bootstrap','--email','roadmap-owner@example.test','--name','Roadmap Owner','--phone','09110000011','--password-stdin'],{cwd:root,env:environment(data),input:password+'\n'+password+'\n',encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(bootstrap.status,0,bootstrap.stdout+bootstrap.stderr);
  runtime=await start(data);
  const login=async email=>{const result=await request(runtime,'/api/auth/login',{body:{identifier:email,password}});assert.equal(result.status,200,JSON.stringify(result));return result.body;};
  const owner=await login('roadmap-owner@example.test');
  assert.equal((await request(runtime,'/api/auth/register',{body:{email:'roadmap-member@example.test',name:'Roadmap Member',username:'roadmap_member',phone:'09110000012',password}})).status,201);
  const member=await login('roadmap-member@example.test');
  const seed=read(data),a=seed.users.find(user=>user.email==='roadmap-owner@example.test'),b=seed.users.find(user=>user.email==='roadmap-member@example.test'),wa=a.personalWorkspaceId;
  const api=(endpoint,body,method,actor='owner')=>request(runtime,endpoint,{body,method:method||(body===undefined?'GET':'POST'),token:actor==='owner'?owner.token:member.token,workspace:wa});
  assert.equal((await api('/api/workspaces/members',{workspaceId:wa,targetUserId:b.id,role:'MEMBER'})).status,200);
  let teams,seo,design,project,checklist;

  await t.test('default teams arrive once, for managers only, with chat channels',async()=>{
    assert.equal((await api('/api/teams/defaults',{},'POST','member')).status,403);
    const first=await api('/api/teams/defaults',{});assert.equal(first.status,200,JSON.stringify(first));assert.equal(first.body.created.length,6);
    assert.deepEqual((await api('/api/teams/defaults',{})).body.created,[]);
    teams=read(data).teams.filter(row=>row.workspaceId===wa);assert.equal(teams.length,6);
    for(const team of teams){assert.ok(team.roadmap.phases.length>=5,team.name);assert.ok(team.customFields.templateKey);assert.equal(read(data).conversations.filter(row=>row.teamId===team.id).length,4);}
    seo=teams.find(row=>row.customFields.templateKey==='seo');design=teams.find(row=>row.customFields.templateKey==='uiux');
    // A deleted default team is never added back.
    assert.equal((await api('/api/org/teams/'+teams.find(row=>row.customFields.templateKey==='social').id,undefined,'DELETE')).status,200);
    assert.deepEqual((await api('/api/teams/defaults',{})).body.created,[]);
  });

  await t.test('roadmaps are validated before a team is saved',async()=>{
    const step=(id,title='Step')=>({id,title,required:true});
    assert.equal((await api('/api/org/teams/'+seo.id,{roadmap:{phases:[{id:'p1',title:'One',steps:[step('s1'),step('s1')]}]}},'PUT')).status,422,'Duplicate step IDs');
    assert.equal((await api('/api/org/teams/'+seo.id,{roadmap:{phases:[{id:'p1',title:'One',steps:[{...step('s1'),owner:'x'}]}]}},'PUT')).status,422,'Unknown step field');
    assert.equal((await api('/api/org/teams/'+seo.id,{roadmap:{phases:[{id:'bad id',title:'One',steps:[]}]}},'PUT')).status,422,'Identifier characters');
    assert.equal((await api('/api/org/teams/'+seo.id,{roadmap:{phases:[{id:'p1',title:'',steps:[]}]}},'PUT')).status,422,'Empty phase title');
    assert.equal((await api('/api/org/teams/'+seo.id,{roadmap:{phases:[]}},'PUT','member')).status,403);
    const saved=await api('/api/org/teams/'+design.id,{roadmap:{phases:[{id:'d1',title:'Design',steps:[step('d1-a','Wireframes'),{id:'d1-b',title:'Prototype',required:false}]}]}},'PUT');
    assert.equal(saved.status,200,JSON.stringify(saved));assert.equal(saved.body.roadmap.phases[0].steps[1].required,false);
  });

  await t.test('a project copies the roadmap of each assigned team',async()=>{
    const created=await api('/api/projects',{title:'Roadmap project',assignedTeamIds:[seo.id]});assert.equal(created.status,201,JSON.stringify(created));project=created.body;
    assert.equal(project.teamChecklists.length,1);checklist=project.teamChecklists[0];
    assert.equal(checklist.teamId,seo.id);assert.deepEqual(checklist.phases.map(phase=>phase.id),seo.roadmap.phases.map(phase=>phase.id));
    assert.ok(checklist.phases.flatMap(phase=>phase.steps).every(step=>step.completed===false));
  });

  await t.test('members tick steps; the tick is stored with who and when',async()=>{
    const stepId=checklist.phases[0].steps[0].id,route=`/api/projects/${project.id}/checklists/${checklist.id}/steps/${stepId}`;
    const ticked=await api(route,{completed:true},'PUT','member');assert.equal(ticked.status,200,JSON.stringify(ticked));
    let step=read(data).projects.find(row=>row.id===project.id).teamChecklists[0].phases[0].steps[0];
    assert.equal(step.completed,true);assert.equal(step.completedById,b.id);assert.equal(step.completedByName,'Roadmap Member');assert.ok(step.completedAt);
    assert.equal((await api(route,{completed:true,completedById:a.id},'PUT','member')).status,422,'Actor fields are not accepted');
    assert.equal((await api(`/api/projects/${project.id}/checklists/${checklist.id}/steps/missing`,{completed:true},'PUT','member')).status,404);
    assert.equal((await api(route,{completed:false},'PUT')).status,200);
    step=read(data).projects.find(row=>row.id===project.id).teamChecklists[0].phases[0].steps[0];
    assert.equal(step.completed,false);assert.equal(step.completedById,null);
    assert.equal((await api(route,{completed:true},'PUT','member')).status,200);
  });

  await t.test('assigning another team adds its checklist and keeps earlier ticks',async()=>{
    const updated=await api('/api/projects/'+project.id,{assignedTeamIds:[seo.id,design.id]},'PUT');assert.equal(updated.status,200,JSON.stringify(updated));
    const lists=read(data).projects.find(row=>row.id===project.id).teamChecklists;
    assert.deepEqual(lists.map(row=>row.teamId),[seo.id,design.id]);assert.equal(lists[0].phases[0].steps[0].completed,true);
    assert.equal(lists[1].phases[0].steps[1].required,false);
  });

  await t.test('only managers add or remove checklists',async()=>{
    const custom=(await api('/api/org/teams',{name:'Empty roadmap team'})).body;
    assert.equal((await api(`/api/projects/${project.id}/checklists`,{teamId:custom.id})).status,422,'A team without a roadmap has nothing to copy');
    assert.equal((await api(`/api/projects/${project.id}/checklists`,{teamId:seo.id})).status,409);
    const brand=teams.find(row=>row.customFields.templateKey==='brand');
    assert.equal((await api(`/api/projects/${project.id}/checklists`,{teamId:brand.id},'POST','member')).status,403);
    const added=await api(`/api/projects/${project.id}/checklists`,{teamId:brand.id});assert.equal(added.status,201,JSON.stringify(added));
    assert.ok(read(data).projects.find(row=>row.id===project.id).assignedTeamIds.includes(brand.id));
    assert.equal((await api(`/api/projects/${project.id}/checklists/${added.body.id}`,undefined,'DELETE','member')).status,403);
    assert.equal((await api(`/api/projects/${project.id}/checklists/${added.body.id}`,undefined,'DELETE')).status,200);
    assert.equal(read(data).projects.find(row=>row.id===project.id).teamChecklists.length,2);
  });
});
