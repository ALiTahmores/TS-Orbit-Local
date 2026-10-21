import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import express from 'express';

const root=path.resolve(import.meta.dirname,'../..');
test('organization cascades preserve private durable history and clean only owned chat assets',async t=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'orbit-stage6-cascade-'));
  t.after(()=>{assert.equal(path.dirname(path.resolve(temporary)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(temporary).startsWith('orbit-stage6-cascade-'));fs.rmSync(temporary,{recursive:true,force:true});});
  const compiled=path.join(temporary,'cascade.cjs');
  await build({stdin:{contents:"export {createOrganizationRouter} from './server/domain/organization.ts'; export {ChatService} from './server/chat/service.ts'; export {createChatRouter} from './server/chat/router.ts'; export {NotificationService} from './server/notifications/service.ts'; export {createNotificationRouter} from './server/notifications/router.ts'; export {createFileService,createFileRouter} from './server/files/index.ts'; export {ScopedState,membership} from './server/policy/scope.ts'; export {PersistenceCoordinator} from './server/persistence.ts'; export {SqliteStore,emptyState} from './server/db/store.ts';",resolveDir:root},outfile:compiled,bundle:true,platform:'node',target:'node24',format:'cjs',logLevel:'silent'});
  const {createOrganizationRouter,ChatService,createChatRouter,NotificationService,createNotificationRouter,createFileService,createFileRouter,ScopedState,membership,PersistenceCoordinator,SqliteStore,emptyState}=createRequire(import.meta.url)(compiled);
  const ok=(result,status=200)=>{assert.equal(result.status,status,JSON.stringify(result.body));return result.body;};
  const fixture=async name=>{
    const directory=path.join(temporary,name);fs.mkdirSync(directory);
    const state=emptyState();state.users=['owner','lead','member','bystander','manager','foreign'].map(id=>({id,name:id,username:id,email:id+'@example.invalid',accountStatus:'ACTIVE'}));
    state.workspaces=[{id:'wa',ownerId:'owner',members:[...['lead','member','bystander'].map(userId=>({userId,role:'MEMBER',permissions:['read','write']})),{userId:'manager',role:'MANAGER'}]},{id:'wb',ownerId:'foreign',members:[]}];
    state.organizations=[{id:'organization',workspaceId:'wa',name:'Org'}];state.departments=[{id:'department',organizationId:'organization',workspaceId:'wa',name:'Dept'}];state.teams=[{id:'team',workspaceId:'wa',departmentId:'department',name:'Team',leaderId:'lead'}];state.teamMembers=[{id:'tm_lead',workspaceId:'wa',teamId:'team',userId:'lead',isLeader:true},{id:'tm_member',workspaceId:'wa',teamId:'team',userId:'member'}];
    const scoped=new ScopedState(state),store=new SqliteStore(path.join(directory,'orbit.sqlite'));store.saveState(state);let snapshot;
    const db={getState:()=>state,beginTransaction(){snapshot=structuredClone(state);store.begin();},commitTransaction(){store.saveState(state);store.commit();snapshot=undefined;},rollbackTransaction(){store.rollback();if(snapshot){for(const key of Object.keys(state))delete state[key];Object.assign(state,snapshot);snapshot=undefined;}}};
    const persistence=new PersistenceCoordinator(db),events=[],broadcast=(event,payload)=>persistence.afterCommit(()=>events.push({event,payload}));
    const files=createFileService({scoped,dataDir:directory,persistence,broadcast}),notifications=new NotificationService({scoped,broadcast}),chat=new ChatService({scoped,files,broadcast,notify:input=>notifications.notify(input),recordActivity:input=>notifications.recordActivity(input)});
    const app=express();app.use(express.json());app.use(persistence.middleware);app.use((req,res,next)=>{const user=state.users.find(row=>row.id===(req.headers['x-test-user']||'owner'));if(!membership(state,user,'wa'))return res.status(403).json({error:'FORBIDDEN'});if(req.method==='DELETE')persistence.afterCommit(()=>files.collectDeleted());scoped.run({kind:'workspace',user,workspaceId:'wa',method:req.method,path:req.path},next);});
    app.use('/api',createOrganizationRouter({scoped,broadcast}));app.use('/api',createChatRouter(chat));app.use('/api',createNotificationRouter(notifications));app.use('/api',createFileRouter(files));app.use((error,_req,res,_next)=>res.status(error.status||500).json({error:error.code||error.message}));
    const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const origin='http://127.0.0.1:'+server.address().port;
    const call=async(route,body,method=body===undefined?'GET':'POST',user='owner')=>{const response=await fetch(origin+'/api'+route,{method,headers:{'content-type':'application/json','x-test-user':user},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:response.status,body:await response.json()};};
    const conversation=ok(await call('/chat/conversations',{isGroup:true,teamId:'team',memberIds:['member']},'POST','lead'),201);
    const bytes=Buffer.from('actual retained conversation bytes');const upload=await fetch(origin+'/api/files',{method:'POST',headers:{'Content-Type':'text/plain','x-test-user':'lead','X-File-Metadata':encodeURIComponent(JSON.stringify({name:'Original.txt',conversationId:conversation.id}))},body:bytes});const asset=ok({status:upload.status,body:await upload.json()},201);
    const message=ok(await call('/chat/conversations/'+conversation.id+'/messages',{content:'private event',attachmentIds:[asset.id]},'POST','lead'),201);
    const inbox=ok(await call('/notifications',undefined,'GET','member'));const notification=inbox.find(row=>row.messageId===message.id);assert.ok(notification);ok(await call('/notifications/'+notification.id+'/read',{},'PUT','member'));
    const auditIds=ok(await call('/activity-logs',undefined,'GET','member')).filter(row=>row.conversationId===conversation.id).map(row=>row.id);assert.ok(auditIds.length>=2);
    const stop=async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await persistence.stop();store.close();};
    return{state,store,directory,events,files,call,conversation,message,asset,notification,auditIds,stop};
  };
  for(const [name,route] of [['team','/teams/team'],['department','/org/departments/department'],['organization','/organizations/organization']])await t.test(name+' delete commits real media, notification and activity history without widening privacy',async()=>{
    const f=await fixture(name);try{
      const before=structuredClone(f.state),blob=path.join(f.files.storage.blobs,f.state.files.find(row=>row.id===f.asset.id).storageKey);assert.equal(fs.readFileSync(blob).toString(),'actual retained conversation bytes');
      ok(await f.call(route,{},'DELETE'));const persisted=f.store.loadState();assert.equal(persisted.teams.length,0);assert.equal(persisted.conversations.some(row=>row.id===f.conversation.id),false);assert.equal(persisted.messages.some(row=>row.id===f.message.id),false);assert.equal(persisted.files.some(row=>row.id===f.asset.id),false);assert.equal(persisted.fileVersions.some(row=>row.fileId===f.asset.id),false);assert.equal(fs.existsSync(blob),false);
      const history=persisted.auditLogs.filter(row=>f.auditIds.includes(row.id));assert.equal(history.length,f.auditIds.length);for(const row of history){assert.equal(row.conversationId,undefined);assert.equal(row.messageId,undefined);assert.equal(row.accessSnapshot.conversationId,undefined);assert.deepEqual(row.accessSnapshot.participantIds.sort(),['lead','member']);}
      const notification=persisted.notifications.find(row=>row.id===f.notification.id),original=before.notifications.find(row=>row.id===f.notification.id);assert.equal(notification.read,true);assert.equal(notification.readAt,original.readAt);assert.equal(notification.title,original.title);assert.equal(notification.description,original.description);assert.equal(notification.messageId,undefined);assert.equal(notification.conversationId,undefined);
      assert.ok(ok(await f.call('/notifications',undefined,'GET','member')).some(row=>row.id===notification.id));
      const ownActivity=ok(await f.call('/activity-logs',undefined,'GET','member')).map(row=>row.id);assert.ok(f.auditIds.every(id=>ownActivity.includes(id)));
      for(const user of ['owner','manager','bystander']){const activity=ok(await f.call('/activity-logs',undefined,'GET',user));assert.equal(activity.some(row=>f.auditIds.includes(row.id)),false,user+' cannot read private room history');}
      if(name==='team'){
        f.state.departmentPermissions.push({id:'deny',workspaceId:'wa',departmentId:'department',role:'MEMBER',action:'read',isAllowed:false});f.store.saveState(f.state);
        assert.equal(ok(await f.call('/activity-logs',undefined,'GET','member')).some(row=>f.auditIds.includes(row.id)),false);assert.equal(ok(await f.call('/notifications',undefined,'GET','member')).some(row=>row.id===notification.id),false);
      }
      f.state.workspaces[0].members=f.state.workspaces[0].members.filter(row=>row.userId!=='member');f.store.saveState(f.state);assert.equal((await f.call('/notifications',undefined,'GET','member')).status,403);
    }finally{await f.stop();}
  });
  await t.test('SQL failure restores detached history and metadata and preserves every content byte',async()=>{
    const f=await fixture('rollback');try{
      const before=structuredClone(f.state),events=f.events.length,blob=path.join(f.files.storage.blobs,f.state.files[0].storageKey),bytes=fs.readFileSync(blob);
      f.store.database.exec("CREATE TRIGGER reject_team_delete BEFORE DELETE ON teams BEGIN SELECT RAISE(ABORT,'fixture delete failure'); END");
      assert.equal((await f.call('/teams/team',{},'DELETE')).status,503);assert.deepEqual(f.state,before);assert.deepEqual(f.store.loadState(),JSON.parse(JSON.stringify(before)));assert.deepEqual(fs.readFileSync(blob),bytes);assert.equal(f.events.length,events);
    }finally{await f.stop();}
  });
  await t.test('a shared project asset cannot be detached into a workspace-visible file by deletion',async()=>{
    const f=await fixture('mixed-parent');try{
      f.state.projects.push({id:'project',workspaceId:'wa',title:'Project'});f.state.files[0].projectId='project';f.state.fileVersions[0].projectId='project';f.store.saveState(f.state);const before=structuredClone(f.state);
      assert.equal((await f.call('/teams/team',{},'DELETE')).status,409);assert.deepEqual(f.state,before);assert.ok(fs.existsSync(path.join(f.files.storage.blobs,f.state.files[0].storageKey)));
    }finally{await f.stop();}
  });
  await t.test('a historical file version with a different conversation parent blocks deletion',async()=>{
    const f=await fixture('mixed-version');try{
      const other=ok(await f.call('/chat/conversations',{isGroup:true,title:'Other room',memberIds:['lead']}),201);
      f.state.fileVersions[0].conversationId=other.id;f.store.saveState(f.state);const before=structuredClone(f.state);assert.equal((await f.call('/teams/team',{},'DELETE')).status,409);assert.deepEqual(f.state,before);
    }finally{await f.stop();}
  });
  for(const kind of ['attachment','reply','read-cursor'])await t.test('outside '+kind+' prevents a destructive legacy cascade',async()=>{
    const f=await fixture(kind);try{
      const other=ok(await f.call('/chat/conversations',{isGroup:true,title:'Other room',memberIds:['lead']}),201);
      const row=ok(await f.call('/chat/conversations/'+other.id+'/messages',{content:'Outside message'}),201);
      if(kind==='attachment')f.state.messages.find(message=>message.id===row.id).attachments=[{id:f.asset.id,versionId:f.asset.currentVersionId}];
      if(kind==='reply')f.state.messages.find(message=>message.id===row.id).replyToMessageId=f.message.id;
      if(kind==='read-cursor')f.state.readReceipts.push({id:'outside-receipt',workspaceId:'wa',conversationId:other.id,userId:'owner',lastReadMessageId:f.message.id});
      f.store.saveState(f.state);const before=structuredClone(f.state),events=f.events.length;assert.equal((await f.call('/teams/team',{},'DELETE')).status,409);assert.deepEqual(f.state,before);assert.equal(f.events.length,events);
    }finally{await f.stop();}
  });
  await t.test('deleted department notification keeps its recipient and read flag without an orphan parent',async()=>{
    const f=await fixture('department-notification');try{
      f.state.notifications.push({id:'department-request-notification',workspaceId:'wa',userId:'member',departmentId:'department',title:'Request response',description:'Historic response',type:'chat.request_response',read:true,readAt:'2026-01-01T00:00:00.000Z'});f.store.saveState(f.state);
      ok(await f.call('/org/departments/department',{},'DELETE'));const row=f.store.loadState().notifications.find(row=>row.id==='department-request-notification');assert.equal(row.departmentId,undefined);assert.equal(row.read,true);assert.equal(row.readAt,'2026-01-01T00:00:00.000Z');assert.ok(ok(await f.call('/notifications',undefined,'GET','member')).some(item=>item.id===row.id));assert.equal(ok(await f.call('/notifications',undefined,'GET','manager')).some(item=>item.id===row.id),false);
    }finally{await f.stop();}
  });
});
