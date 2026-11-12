import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { createHmac } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { collectionNames } from '../../server/db/schema.ts';

// Integrations are managed by workspace managers, never reveal their secrets,
// accept only public https targets on each service's own host, and inbound
// hooks act only when they prove themselves with the connection's key.
const root=path.resolve(import.meta.dirname,'../..');
const password='IntegrationFixture42!';
const environment=data=>({...process.env,PROJECT_ROOT:root,NODE_ENV:'production',DATA_DIR:data,HOST:'127.0.0.1',PORT:'3000',APP_ORIGIN:'',ALLOW_NETWORK_ACCESS:'',LEGACY_DB_IMPORT:''});
function read(data){const db=new DatabaseSync(path.join(data,'orbit.sqlite'),{readOnly:true});try{return Object.fromEntries(collectionNames.map(name=>[name,db.prepare(`SELECT payload FROM "${name}" ORDER BY ordinal`).all().map(row=>JSON.parse(row.payload))]));}finally{db.close();}}
async function start(data){const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));const origin=`http://127.0.0.1:${port}`;const child=spawn(process.execPath,[path.join(root,'dist/server/server.cjs')],{cwd:root,env:{...environment(data),PORT:String(port),APP_ORIGIN:origin},windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);for(let i=0;i<300;i++){if(child.exitCode!==null)throw new Error(output);try{if((await fetch(origin+'/api/projects',{signal:AbortSignal.timeout(1000)})).status===401)return{child,origin};}catch{}await new Promise(resolve=>setTimeout(resolve,50));}child.kill();throw new Error('Integrations startup failed: '+output);}
async function stop(runtime){if(!runtime||runtime.child.exitCode!==null||runtime.child.signalCode!==null)return;const closed=once(runtime.child,'close');runtime.child.kill();await closed;}
async function request(runtime,endpoint,{body,raw,token,workspace,headers={},method=body===undefined&&raw===undefined?'GET':'POST'}={}){const payload=raw!==undefined?raw:body===undefined?undefined:JSON.stringify(body);const response=await fetch(runtime.origin+endpoint,{method,signal:AbortSignal.timeout(8000),headers:{...(payload===undefined?{}:{'content-type':'application/json'}),...(token?{authorization:'Bearer '+token}:{}),...(workspace?{'x-workspace-id':workspace}:{}),...headers},...(payload===undefined?{}:{body:payload})});const value=await response.text();let result;try{result=JSON.parse(value);}catch{result=value;}return{status:response.status,body:result};}

test('integration hub manages connections, guards secrets and verifies inbound hooks',{timeout:120000},async t=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'orbit-integrations-')),data=path.join(temporary,'data');let runtime;
  t.after(async()=>{await stop(runtime);fs.rmSync(temporary,{recursive:true,force:true});});
  const bootstrap=spawnSync(process.execPath,[path.join(root,'dist/server/local-account.cjs'),'bootstrap','--email','integration-owner@example.test','--name','Integration Owner','--phone','09110000031','--password-stdin'],{cwd:root,env:environment(data),input:password+'\n'+password+'\n',encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(bootstrap.status,0,bootstrap.stdout+bootstrap.stderr);
  runtime=await start(data);
  const login=async email=>{const result=await request(runtime,'/api/auth/login',{body:{identifier:email,password}});assert.equal(result.status,200,JSON.stringify(result));return result.body;};
  const owner=await login('integration-owner@example.test');
  assert.equal((await request(runtime,'/api/auth/register',{body:{email:'integration-member@example.test',name:'Integration Member',username:'integration_member',phone:'09110000032',password}})).status,201);
  const member=await login('integration-member@example.test');
  const seed=read(data),a=seed.users.find(user=>user.email==='integration-owner@example.test'),b=seed.users.find(user=>user.email==='integration-member@example.test'),wa=a.personalWorkspaceId;
  const api=(endpoint,body,method,actor='owner')=>request(runtime,endpoint,{body,method:method||(body===undefined?'GET':'POST'),token:actor==='member'?member.token:owner.token,workspace:wa});
  assert.equal((await api('/api/workspaces/members',{workspaceId:wa,targetUserId:b.id,role:'MEMBER'})).status,200);
  const project=(await api('/api/projects',{title:'Integration project'})).body;
  const slackUrl='https://hooks.slack.com/services/T000/B000/abcdefghijklmnop';

  await t.test('only managers manage connections and targets stay on each service host',async()=>{
    assert.equal((await api('/api/integrations',undefined,'GET','member')).status,403);
    assert.equal((await api('/api/integrations',{provider:'slack',name:'Team',config:{webhookUrl:slackUrl},events:['task.created']},'POST','member')).status,403);
    for(const webhookUrl of ['https://evil.example.com/hook','http://hooks.slack.com/services/x','https://hooks.slack.com.evil.example/x'])
      assert.equal((await api('/api/integrations',{provider:'slack',name:'Bad',config:{webhookUrl},events:[]})).status,422,webhookUrl);
    for(const url of ['https://10.1.2.3/hook','https://localhost/hook','https://127.0.0.1:8443/hook','https://[::1]/hook','https://192.168.1.10/x'])
      assert.equal((await api('/api/integrations',{provider:'webhook',name:'Private',config:{url},events:[]})).status,422,url);
    assert.equal((await api('/api/integrations',{provider:'slack',name:'Bad event',config:{webhookUrl:slackUrl},events:['task.exploded']})).status,422);
    assert.equal((await api('/api/integrations',{provider:'telegram',name:'Bad bot',config:{botToken:'nope',chatId:'-1001234'},events:[]})).status,422);
  });

  let webhook,slack;
  await t.test('secrets are shown once and never listed',async()=>{
    const created=await api('/api/integrations',{provider:'slack',name:'Team channel',config:{webhookUrl:slackUrl},events:['task.created','task.completed'],projectIds:[project.id]});
    assert.equal(created.status,201,JSON.stringify(created));slack=created.body;
    assert.equal(slack.target,'hooks.slack.com/…mnop');assert.ok(!JSON.stringify(slack).includes('abcdefghijklmnop'));
    const signed=await api('/api/integrations',{provider:'webhook',name:'Data warehouse',config:{url:'https://example.com/orbit'},events:['task.created']});
    assert.equal(signed.status,201,JSON.stringify(signed));webhook=signed.body;assert.match(webhook.signingKey,/^[a-f0-9]{48}$/);
    const listed=await api('/api/integrations');
    assert.equal(listed.body.connections.length,2);assert.ok(!JSON.stringify(listed.body).includes(webhook.signingKey));assert.ok(!JSON.stringify(listed.body).includes('example.com/orbit'));
    assert.equal(listed.body.taskKeyPrefix,'TS');
    const legacy=await api('/api/external-connections',undefined,'GET','member');assert.ok(!JSON.stringify(legacy.body).includes('hooks.slack.com'),'the legacy list never carries hub targets');
    const edited=await api('/api/integrations/'+slack.id,{name:'Renamed',config:{webhookUrl:''},enabled:false},'PUT');
    assert.equal(edited.status,200,JSON.stringify(edited));assert.equal(edited.body.enabled,false);assert.equal(edited.body.target,'hooks.slack.com/…mnop','a blank secret keeps the stored one');
    const rotated=await api(`/api/integrations/${webhook.id}/rotate`,{});assert.equal(rotated.status,200);assert.notEqual(rotated.body.signingKey,webhook.signingKey);
  });

  await t.test('task keys follow the workspace prefix',async()=>{
    assert.equal((await api('/api/integrations/settings',{taskKeyPrefix:'bad prefix'},'PUT')).status,422);
    assert.equal((await api('/api/integrations/settings',{taskKeyPrefix:'APP'},'PUT')).status,200);
    const first=(await api('/api/tasks',{projectId:project.id,title:'First keyed task'})).body,second=(await api('/api/tasks',{projectId:project.id,title:'Second keyed task'})).body;
    assert.match(first.key,/^APP-\d+$/);assert.equal(Number(second.key.split('-')[1]),Number(first.key.split('-')[1])+1);
  });

  await t.test('inbound hooks create tasks only with the connection key',async()=>{
    const hook=(await api('/api/integrations',{provider:'incoming',name:'Website form',config:{projectId:project.id}})).body;
    assert.match(hook.endpoint,/\/api\/public\/hooks\/integ_/);
    const path_='/api/public/hooks/'+hook.id;
    assert.equal((await request(runtime,path_,{body:{title:'Unsigned'}})).status,401);
    assert.equal((await request(runtime,path_,{body:{title:'Wrong'},headers:{'x-orbit-token':'0'.repeat(48)}})).status,401);
    const created=await request(runtime,path_,{body:{title:'Lead from website',assigneeEmail:'integration-member@example.test',priority:'high'},headers:{'x-orbit-token':hook.signingKey}});
    assert.equal(created.status,200,JSON.stringify(created));assert.match(created.body.key,/^APP-\d+$/);
    const task=read(data).tasks.find(row=>row.id===created.body.taskId);assert.equal(task.projectId,project.id);assert.deepEqual(task.assignedMemberIds,[b.id]);
    const raw=JSON.stringify({title:'Signed lead'});
    const signed=await request(runtime,path_,{raw,headers:{'x-orbit-signature':'sha256='+createHmac('sha256',hook.signingKey).update(raw).digest('hex')}});
    assert.equal(signed.status,200,JSON.stringify(signed));
    assert.equal((await request(runtime,path_,{body:{title:'Extra',workspaceId:'x'},headers:{'x-orbit-token':hook.signingKey}})).status,422);
    assert.equal((await request(runtime,'/api/public/hooks/'+slack.id,{body:{title:'Outgoing ids are not inbound'},headers:{'x-orbit-token':hook.signingKey}})).status,404);
  });

  await t.test('GitHub commits and merged pull requests reach the referenced task',async()=>{
    const github=(await api('/api/integrations',{provider:'github',name:'Repository',config:{transitionOnMerge:'review'}})).body;
    const task=(await api('/api/tasks',{projectId:project.id,title:'Fix checkout'})).body;
    const send=async(event,payload,key=github.signingKey)=>{const raw=JSON.stringify(payload);return request(runtime,'/api/public/hooks/'+github.id,{raw,headers:{'x-github-event':event,'x-hub-signature-256':'sha256='+createHmac('sha256',key).update(raw).digest('hex')}});};
    assert.equal((await send('ping',{zen:'ok'})).status,200);
    assert.equal((await send('push',{commits:[]},'f'.repeat(48))).status,401);
    const pushed=await send('push',{repository:{full_name:'acme/shop'},commits:[{id:'abcdef1234567',message:`Handle empty cart ${task.key}\n\nDetails`,url:'https://github.com/acme/shop/commit/abcdef1'}]});
    assert.equal(pushed.status,200,JSON.stringify(pushed));assert.equal(pushed.body.linkedTasks,1);
    assert.ok(read(data).comments.some(row=>row.taskId===task.id&&row.content.includes('abcdef1')&&row.content.includes('acme/shop')));
    const merged=await send('pull_request',{action:'closed',repository:{full_name:'acme/shop'},pull_request:{number:7,merged:true,title:`${task.key} checkout fix`,html_url:'https://github.com/acme/shop/pull/7'}});
    assert.equal(merged.status,200,JSON.stringify(merged));
    assert.equal(read(data).tasks.find(row=>row.id===task.id).status,'review','a merged pull request moves the task to review');
    const listed=(await api('/api/integrations')).body.connections.find(row=>row.id===github.id);
    assert.ok(listed.deliveries.length>=3);assert.equal(listed.lastStatus,'ok');
  });
});
