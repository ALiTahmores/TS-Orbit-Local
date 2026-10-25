import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import path from 'node:path';
import {Pool} from 'pg';
import {io} from 'socket.io-client';

// Explicit test database only. Every table is confined to a random schema; no
// application/default schema or real account is imported or removed.
const connectionString=process.env.CLOUD_TEST_DATABASE_URL;
const root=path.resolve(import.meta.dirname,'../..');
const requestTimings=[];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function unusedPort(){const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
async function stop(runtime){if(!runtime||runtime.child.exitCode!==null||runtime.child.signalCode!==null)return;const closed=once(runtime.child,'close');runtime.child.kill();await closed;}
async function request(runtime,endpoint,{body,method=body===undefined?'GET':'POST',token,workspace}={}){const started=Date.now();const response=await fetch(runtime.origin+endpoint,{method,signal:AbortSignal.timeout(20000),headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{}),...(workspace?{'x-workspace-id':workspace}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const parsed=await response.json();if(endpoint!=='/api/runtime')requestTimings.push({method,endpoint,status:response.status,ms:Date.now()-started});return{status:response.status,body:parsed};}
async function start(databaseUrl,port,appOrigin){const origin='http://127.0.0.1:'+port;let diagnostics='';const code=`const runtime=require(process.argv[1]);runtime.ready.then(({httpServer})=>httpServer.listen(Number(process.env.PORT),'127.0.0.1')).catch(()=>process.exit(1));`;
 const child=spawn(process.execPath,['-e',code,path.join(root,'dist/server/server.cjs')],{cwd:root,windowsHide:true,env:{...process.env,ORBIT_STORAGE:'postgres',VERCEL:'',DATABASE_URL:databaseUrl,APP_ORIGIN:appOrigin,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'production',PROJECT_ROOT:root,LEGACY_DB_IMPORT:'',BLOB_READ_WRITE_TOKEN:''},stdio:['ignore','pipe','pipe']});
 for(const output of [child.stdout,child.stderr])output.on('data',chunk=>{diagnostics+=String(chunk).replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[REDACTED_DATABASE_URL]');});
 const runtime={child,origin};for(let retry=0;retry<600;retry++){if(child.exitCode!==null)throw Error('Synthetic cloud server initialization failed: '+diagnostics);try{if((await request(runtime,'/api/runtime')).status===200)return runtime;}catch{}await delay(100);}await stop(runtime);throw Error('Synthetic cloud readiness timeout: '+diagnostics);
}
async function connect(runtime,token,workspaceId){const socket=io(runtime.origin,{auth:{token,workspaceId},transports:['websocket'],forceNew:true,reconnection:false,timeout:15000});try{await Promise.race([once(socket,'connect'),once(socket,'connect_error').then(()=>{throw Error('Synthetic cloud socket authorization failed');})]);return socket;}catch(error){socket.disconnect();throw error;}}
function event(socket,name,timeout=20000){return new Promise((resolve,reject)=>{const listener=payload=>{clearTimeout(timer);resolve(payload);};const timer=setTimeout(()=>{socket.off(name,listener);reject(Error('Cloud event timeout: '+name));},timeout);socket.once(name,listener);});}
const ok=(result,status=200)=>{assert.equal(result.status,status,result.body?.error||'Unexpected synthetic API status');return result.body;};

test('real cloud servers share durable identity, events, revocation and restart state',{skip:!connectionString,timeout:240000},async t=>{
 const began=Date.now();const phase=label=>t.diagnostic(label+': '+(Date.now()-began)+'ms');
 const namespace='orbit_server_test_'+randomUUID().replaceAll('-','');assert.match(namespace,/^orbit_server_test_[a-f0-9]{32}$/);
 const admin=new Pool({connectionString,max:2,connectionTimeoutMillis:10000});let created=false;const runtimes=[],sockets=[];
 try{
  await admin.query(`CREATE SCHEMA "${namespace}"`);created=true;
  const url=new URL(connectionString);url.searchParams.set('options','-c search_path='+namespace);
  // Confirm libpq startup options cannot accidentally fall through to public.
  const probe=new Pool({connectionString:url.href,max:1});try{assert.equal((await probe.query('SELECT current_schema() AS schema')).rows[0].schema,namespace);}finally{await probe.end();}
  const portA=await unusedPort(),portB=await unusedPort(),appOrigin='http://127.0.0.1:'+portA;
  let a=await start(url.href,portA,appOrigin);runtimes.push(a);let b=await start(url.href,portB,appOrigin);runtimes.push(b);phase('two servers initialized');
  const password='CloudProviderFixture!2026';
  const owner=ok(await request(a,'/api/auth/register',{body:{name:'Synthetic Cloud Owner',email:'cloud-owner@example.test',phone:'09000000101',password}}),201);
  const member=ok(await request(b,'/api/auth/register',{body:{name:'Synthetic Cloud Member',email:'cloud-member@example.test',phone:'09000000102',password}}),201);
  phase('accounts registered');const workspace=owner.workspace.id;
  ok(await request(b,'/api/workspaces/join',{token:member.token,body:{inviteCode:owner.workspace.inviteCode}}));
  // The second process must verify the first process's signing key and latest membership.
  assert.equal(ok(await request(b,'/api/auth/me',{token:owner.token})).user.id,owner.user.id);
  const socketA=await connect(a,owner.token,workspace),socketB=await connect(b,member.token,workspace);sockets.push(socketA,socketB);
  const changed=event(socketB,'app_projects_updated');
  const project=ok(await request(a,'/api/projects',{token:owner.token,workspace,body:{title:'Synthetic durable provider project'}}),201);
  assert.deepEqual(await changed,{type:'data_changed'});phase('cross-instance event delivered');
  assert.ok(ok(await request(b,'/api/projects',{token:member.token,workspace})).some(row=>row.id===project.id));
  // A failed mutation must leave no durable task in either process.
  assert.ok((await request(a,'/api/tasks',{token:owner.token,workspace,body:{title:'Rejected synthetic task',projectId:'missing-project'}})).status>=400);
  assert.equal(ok(await request(b,'/api/tasks',{token:member.token,workspace})).length,0);
  // Session revocation crosses instance boundaries through fresh auth, not process memory.
  const disconnected=event(socketB,'disconnect');ok(await request(a,'/api/auth/logout',{token:member.token,method:'POST'}));await disconnected;phase('remote socket revoked');
  assert.equal((await request(b,'/api/auth/me',{token:member.token})).status,401);
  socketA.disconnect();await stop(a);a=await start(url.href,portA,appOrigin);runtimes.push(a);phase('first instance restarted');
  assert.ok(ok(await request(a,'/api/projects',{token:owner.token,workspace})).some(row=>row.id===project.id));
  assert.equal((await request(a,'/api/auth/me',{token:member.token})).status,401);
  const persisted=await admin.query(`SELECT payload FROM "${namespace}".orbit_records WHERE collection='projects' AND entity_id=$1`,[project.id]);assert.equal(persisted.rows[0].payload.title,'Synthetic durable provider project');
 }finally{
  for(const timing of requestTimings)t.diagnostic(timing.method+' '+timing.endpoint+' '+timing.status+': '+timing.ms+'ms');
  for(const socket of sockets)socket.disconnect();for(const runtime of runtimes)await stop(runtime);
  if(created){assert.match(namespace,/^orbit_server_test_[a-f0-9]{32}$/);await admin.query(`DROP SCHEMA "${namespace}" CASCADE`);}await admin.end();
 }
});
