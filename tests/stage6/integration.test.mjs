import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {once} from 'node:events';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {io} from 'socket.io-client';
import {SqliteStore} from '../../server/db/store.ts';

const root=path.resolve(import.meta.dirname,'../..'),password='CollaborationFixture42!';
const env=data=>({...process.env,PROJECT_ROOT:root,NODE_ENV:'production',DATA_DIR:data,HOST:'127.0.0.1',PORT:'3000',APP_ORIGIN:'',ALLOW_NETWORK_ACCESS:'',LEGACY_DB_IMPORT:''});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function state(data){const store=new SqliteStore(path.join(data,'orbit.sqlite'));try{return store.loadState();}finally{store.close();}}
function sql(data,query){const db=new DatabaseSync(path.join(data,'orbit.sqlite'));try{db.exec(query);}finally{db.close();}}
async function start(data,reuse){const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=reuse||listener.address().port;await new Promise(resolve=>listener.close(resolve));const origin='http://127.0.0.1:'+port;
  const child=spawn(process.execPath,[path.join(root,'dist/server/server.cjs')],{cwd:root,env:{...env(data),PORT:String(port),APP_ORIGIN:origin},windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',value=>log+=value);child.stderr.on('data',value=>log+=value);
  for(let i=0;i<200;i++){if(child.exitCode!==null)throw Error(log);try{if((await fetch(origin+'/api/projects',{signal:AbortSignal.timeout(1000)})).status===401)return{child,origin,port,data};}catch{}await pause(50);}child.kill();throw Error('Startup failed: '+log);
}
async function stop(runtime){if(!runtime||runtime.child.exitCode!==null||runtime.child.signalCode!==null)return;const done=once(runtime.child,'close');runtime.child.kill();await done;}
async function connect(runtime,token,workspaceId){const socket=io(runtime.origin,{auth:{token,workspaceId},transports:['websocket'],forceNew:true,reconnection:false,timeout:4000});await Promise.race([once(socket,'connect'),once(socket,'connect_error').then(([error])=>{throw error;})]);return socket;}
const ack=(socket,event,payload)=>new Promise((resolve,reject)=>socket.timeout(5000).emit(event,payload,(error,value)=>error?reject(error):resolve(value)));

test('compiled collaboration preserves real media, permissions, receipts, sockets and restart',{timeout:120000},async t=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'orbit-stage6-integration-')),data=path.join(temporary,'data'),sockets=[];let runtime,wa,wb,a,b,v,c,dm,group,m1,m2,asset,voice;
  t.after(async()=>{for(const socket of sockets)socket.disconnect();await stop(runtime);assert.equal(path.dirname(path.resolve(temporary)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(temporary).startsWith('orbit-stage6-integration-'));fs.rmSync(temporary,{recursive:true,force:true});});
  const bootstrap=spawnSync(process.execPath,[path.join(root,'dist/server/local-account.cjs'),'bootstrap','--email','collab-owner@example.test','--name','Collaboration Owner','--phone','09117770001','--password-stdin'],{cwd:root,env:env(data),input:password+'\n'+password+'\n',windowsHide:true,encoding:'utf8'});assert.equal(bootstrap.status,0,bootstrap.stderr+bootstrap.stdout);
  const store=new SqliteStore(path.join(data,'orbit.sqlite'));try{const s=store.loadState();wa=s.users[0].personalWorkspaceId;wb='workspace-second';const digest=bcrypt.hashSync(password,10);
    for(const [id,name,role,personalWorkspaceId,n] of [['member','Member','USER',wb,2],['viewer','Viewer','USER',wa,3],['outsider','Outsider','USER',wb,4]])s.users.push({id,name,email:id+'@example.test',username:'collab_'+id,phone:'0911777000'+n,role,systemRole:'USER',accountStatus:'ACTIVE',status:'ACTIVE',approvalStatus:'approved',isActive:true,passwordHash:digest,localPasswordRequired:false,personalWorkspaceId});
    s.workspaces[0].members.push({userId:'member',role:'MEMBER',permissions:['read','write'],status:'ACTIVE'},{userId:'viewer',role:'VIEWER',permissions:['read'],status:'ACTIVE'});
    s.workspaces.push({id:wb,name:'Second Workspace',ownerId:'member',members:[{userId:'member',role:'OWNER',permissions:['*']},{userId:'outsider',role:'MEMBER',permissions:['read','write']}]});store.saveState(s);
  }finally{store.close();}
  runtime=await start(data);
  const request=async(endpoint,body,method=body===undefined?'GET':'POST',actor=a,workspace=wa)=>{const response=await fetch(runtime.origin+endpoint,{method,signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json',...(actor?{Authorization:'Bearer '+actor.token,'x-workspace-id':workspace}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:response.status,body:await response.json()};};
  const ok=(result,status=200)=>{assert.equal(result.status,status,JSON.stringify(result));return result.body;};
  a=ok(await request('/api/auth/login',{identifier:'collab-owner@example.test',password},'POST',null));b=ok(await request('/api/auth/login',{identifier:'member@example.test',password},'POST',null));v=ok(await request('/api/auth/login',{identifier:'viewer@example.test',password},'POST',null));c=ok(await request('/api/auth/login',{identifier:'outsider@example.test',password},'POST',null));
  let sa,sb,sc;
  await t.test('HTTP policy accepts real DM and actor-derived messages, rejects forged fields',async()=>{
    dm=ok(await request('/api/chat/conversations',{recipientId:'member'}),201);assert.deepEqual([...dm.participants].sort(),[a.user.id,'member'].sort());
    assert.equal(dm.permissions.send,true);assert.equal(typeof dm.permissions.manage,'boolean');
    assert.equal(ok(await request('/api/chat/conversations',{recipientId:'member'})).id,dm.id);
    m1=ok(await request('/api/chat/conversations/'+dm.id+'/messages',{content:'First actual message'}),201);assert.equal(m1.senderId,a.user.id);
    assert.equal((await request('/api/chat/conversations/'+dm.id+'/messages',{content:'spoof',senderId:'member'})).status,422);
    assert.equal((await request('/api/chat/conversations/'+dm.id+'/messages',undefined,'GET',c,wb)).status,404);
  });
  await t.test('authenticated sockets cannot join or type across workspace/identity',async()=>{
    sa=await connect(runtime,a.token,wa);sb=await connect(runtime,b.token,wa);sc=await connect(runtime,c.token,wb);sockets.push(sa,sb,sc);
    assert.equal((await ack(sa,'join',{userId:'member',conversationId:dm.id})).error,'FORBIDDEN');assert.equal((await ack(sc,'join',{conversationId:dm.id})).error,'FORBIDDEN');
    assert.equal((await ack(sa,'join',{conversationId:dm.id})).ok,true);assert.equal((await ack(sb,'join',{conversationId:dm.id})).ok,true);
    const typing=once(sb,'typing_status');assert.equal((await ack(sa,'typing',{conversationId:dm.id,isTyping:true})).ok,true);const [event]=await typing;assert.equal(event.userId,a.user.id);assert.equal(event.conversationId,dm.id);
    assert.equal((await ack(sa,'typing',{conversationId:dm.id,isTyping:true,userId:'member'})).error,'FORBIDDEN');
  });
  await t.test('presence is live and never rewrites account authority',async()=>{
    const users=ok(await request('/api/chat/users'));assert.equal(users.find(row=>row.id==='member').status,'online');
    const directory=ok(await request('/api/users'));assert.equal(directory.find(row=>row.id==='member').status,'online');assert.equal(directory.find(row=>row.id==='member').accountStatus,'ACTIVE');
    assert.equal(ok(await request('/api/stats')).onlineTeam,2);
    assert.equal(state(data).users.find(row=>row.id==='member').status,'ACTIVE');assert.equal(state(data).users.find(row=>row.id==='member').accountStatus,'ACTIVE');
  });
  await t.test('seen acknowledgement follows durable commit and failed SQL yields no success/event',async()=>{
    const receipt=await ack(sb,'seen',{conversationId:dm.id,messageId:m1.id});assert.equal(receipt.ok,true);assert.equal(state(data).readReceipts.find(row=>row.userId==='member'&&row.conversationId===dm.id).lastReadMessageId,m1.id);
    m2=ok(await request('/api/chat/conversations/'+dm.id+'/messages',{content:'Second unread message'}),201);
    sql(data,"CREATE TRIGGER stage6_fail_receipt BEFORE UPDATE ON readReceipts BEGIN SELECT RAISE(FAIL,'receipt write failure'); END;");
    const failed=await ack(sb,'seen',{conversationId:dm.id,messageId:m2.id});assert.equal(failed.error,'STORAGE_UNAVAILABLE');assert.notEqual(failed.ok,true);assert.equal(state(data).readReceipts.find(row=>row.userId==='member'&&row.conversationId===dm.id).lastReadMessageId,m1.id);
    sql(data,'DROP TRIGGER stage6_fail_receipt');assert.equal((await ack(sb,'seen',{conversationId:dm.id,messageId:m2.id})).ok,true);
    assert.equal((await ack(sb,'seen',{conversationId:dm.id,messageId:m1.id})).receipt.lastReadMessageId,m2.id);
  });
  await t.test('code to text conversion accepts explicit null, reply/reaction/pin persist',async()=>{
    const code=ok(await request('/api/chat/conversations/'+dm.id+'/messages',{content:'',codeSnippet:{language:'ts',code:'  const value = 1;\n'}}),201);assert.equal(code.codeSnippet.code,'  const value = 1;\n');
    const plain=ok(await request('/api/chat/messages/'+code.id,{content:'Plain text',codeSnippet:null},'PUT'));assert.equal(plain.content,'Plain text');assert.ok(!plain.codeSnippet);
    const reply=ok(await request('/api/chat/conversations/'+dm.id+'/messages',{content:'Real reply',replyToMessageId:m1.id},'POST',b),201);assert.equal(reply.replyToMessageId,m1.id);
    ok(await request('/api/chat/messages/'+m1.id+'/react',{emoji:'👍'},'POST',b));ok(await request('/api/chat/conversations/'+dm.id+'/pin',{messageId:m1.id,pin:true}));
    const messages=ok(await request('/api/chat/conversations/'+dm.id+'/messages'));assert.ok(messages.find(row=>row.id===m1.id).reactions.some(row=>row.userIds.includes('member')));assert.ok(messages.find(row=>row.id===m1.id).pinned);
  });
  const upload=async(bytes,metadata,mime,id)=>{const response=await fetch(runtime.origin+'/api/files'+(id?'/'+id+'/versions':''),{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+a.token,'x-workspace-id':wa,'Content-Type':mime,'X-File-Metadata':encodeURIComponent(JSON.stringify(metadata))},body:bytes});return{status:response.status,body:await response.json()};};
  await t.test('managed audio/file messages preserve their original bytes and version after replacement',async()=>{
    const bytes=Buffer.from('original conversation bytes');asset=ok(await upload(bytes,{name:'Chat.txt',conversationId:dm.id},'text/plain'),201);
    const sent=ok(await request('/api/chat/conversations/'+dm.id+'/messages',{content:'',attachmentIds:[asset.id]}),201);
    const next=ok(await upload(Buffer.from('new bytes'),{name:'Chat.txt'},'text/plain',asset.id),201);assert.notEqual(next.currentVersionId,asset.currentVersionId);
    const projected=ok(await request('/api/chat/conversations/'+dm.id+'/messages')).find(row=>row.id===sent.id).attachments[0];assert.equal(projected.versionId,asset.currentVersionId);
    const download=await fetch(runtime.origin+projected.downloadPath,{headers:{Authorization:'Bearer '+b.token,'x-workspace-id':wa}});assert.equal(download.status,200);assert.equal(sha(Buffer.from(await download.arrayBuffer())),sha(bytes));
    const audio=Buffer.from('1a45dfa39f4286810142f7810142f2810442f381084282847765626d','hex');voice=ok(await upload(audio,{name:'Voice.webm',conversationId:dm.id},'audio/webm'),201);assert.equal(voice.mimeType,'audio/webm');
    const voiceMessage=ok(await request('/api/chat/conversations/'+dm.id+'/messages',{content:'',voiceNote:{fileId:voice.id,durationSeconds:1.25}}),201);assert.equal(voiceMessage.voiceNote.fileId,voice.id);assert.equal(voiceMessage.attachments[0].mimeType,'audio/webm');
    assert.equal((await request('/api/chat/conversations/'+dm.id+'/messages',{content:'bad',attachmentIds:[voice.id]},'POST',b)).status,422);
  });
  await t.test('viewer read/preferences and personal inbox updates cannot mutate others',async()=>{
    group=ok(await request('/api/chat/conversations',{isGroup:true,title:'Scoped group',memberIds:['member','viewer']}),201);
    assert.equal(ok(await request('/api/chat/conversations',undefined,'GET',v)).find(row=>row.id===group.id).permissions.send,false);
    const msg=ok(await request('/api/chat/conversations/'+group.id+'/messages',{content:'Group notification'}),201);
    assert.equal((await request('/api/chat/conversations/'+group.id+'/messages',{content:'viewer write'},'POST',v)).status,403);
    assert.equal(ok(await request('/api/chat/conversations/'+group.id+'/read',{messageId:msg.id},'POST',v)).success,true);ok(await request('/api/chat/conversations/'+group.id+'/preferences',{muted:true},'PUT',v));
    const inbox=ok(await request('/api/notifications',undefined,'GET',b));const notification=inbox.find(row=>row.messageId===msg.id);assert.ok(notification);assert.equal(notification.read,false);
    assert.equal((await request('/api/notifications/'+notification.id+'/read',{},'PUT',v)).status,404);assert.equal(ok(await request('/api/notifications/'+notification.id+'/read',{},'PUT',b)).read,true);
    ok(await request('/api/notifications/clear',{},'POST',b));assert.deepEqual(ok(await request('/api/notifications',undefined,'GET',b)),[]);assert.ok(ok(await request('/api/notifications',undefined,'GET',v)).length>0);
  });
  await t.test('membership removal immediately denies bytes, read, socket actions and private projections',async()=>{
    ok(await request('/api/chat/conversations/'+group.id+'/members/member',{},'DELETE'));
    assert.equal((await request('/api/chat/conversations/'+group.id+'/messages',undefined,'GET',b)).status,404);assert.equal((await ack(sb,'join',{conversationId:group.id})).error,'FORBIDDEN');
    const projected=ok(await request('/api/chat/conversations',undefined,'GET',b));assert.ok(!projected.some(row=>row.id===group.id));
  });
  await t.test('task assignments produce one real recipient notification and roll back atomically',async()=>{
    const project=ok(await request('/api/projects',{title:'Assignment project'}),201);
    const task=ok(await request('/api/tasks',{title:'Assigned actual task',projectId:project.id,assignedMemberIds:['member']}),201);
    const assigned=()=>state(data).notifications.filter(row=>row.type==='task.assigned'&&row.taskId===task.id);assert.equal(assigned().length,1);assert.equal(assigned()[0].userId,'member');
    ok(await request('/api/tasks/'+task.id,{title:'Updated title'},'PUT'));assert.equal(assigned().length,1);
    sql(data,"CREATE TRIGGER stage6_fail_assignment BEFORE INSERT ON notifications WHEN json_extract(NEW.payload,'$.type')='task.assigned' BEGIN SELECT RAISE(FAIL,'assignment failure'); END;");
    const failed=await request('/api/tasks',{title:'Rolled back assignment',projectId:project.id,assignedMemberIds:['member']});assert.equal(failed.status,503);assert.ok(!state(data).tasks.some(row=>row.title==='Rolled back assignment'));assert.equal(assigned().length,1);
    sql(data,'DROP TRIGGER stage6_fail_assignment');
  });
  await t.test('expired socket credentials disconnect without any incoming action',async()=>{
    const claims=jwt.decode(a.token),secret=fs.readFileSync(path.join(data,'jwt-secret'),'utf8').trim();const token=jwt.sign({...claims,exp:Math.floor(Date.now()/1000)+2},secret,{algorithm:'HS256'});
    const socket=await connect(runtime,token,wa);sockets.push(socket);await Promise.race([once(socket,'disconnect'),pause(5000).then(()=>{throw Error('Expired socket stayed connected');})]);assert.equal(socket.connected,false);
  });
  await t.test('restart retains messages, immutable media, histories and per-user receipts',async()=>{
    for(const socket of sockets)socket.disconnect();const before=state(data);const port=runtime.port;await stop(runtime);runtime=await start(data,port);
    const messages=ok(await request('/api/chat/conversations/'+dm.id+'/messages',undefined,'GET',b));assert.ok(messages.some(row=>row.voiceNote?.fileId===voice.id));assert.ok(messages.some(row=>row.codeSnippet===undefined&&row.content==='Plain text'));
    const after=state(data);assert.deepEqual(after.readReceipts,before.readReceipts);assert.equal(after.users.find(row=>row.id==='member').status,'ACTIVE');
    const socket=await connect(runtime,b.token,wa);sockets.push(socket);assert.equal((await ack(socket,'join',{conversationId:dm.id})).ok,true);
    const activity=ok(await request('/api/activity-logs',undefined,'GET',b));assert.ok(activity.some(row=>row.action.startsWith('chat.')));assert.ok(!activity.some(row=>row.conversationId===group.id));
    const disconnected=once(socket,'disconnect');ok(await request('/api/auth/logout',{},'POST',b));await disconnected;assert.equal((await request('/api/chat/conversations',undefined,'GET',b)).status,401);
  });
});
