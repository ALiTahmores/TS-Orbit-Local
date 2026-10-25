import { isAccountActive } from './auth/index.ts';
import type { CloudRealtime, CloudEvent, PresenceLease } from './cloud/realtime.ts';
import type { Server } from 'socket.io';
import type { PersistenceCoordinator } from './persistence.ts';
import { ScopedState, membership, type Scope } from './policy/scope.ts';
import { sanitize } from './policy/index.ts';

interface RealtimeOptions { markRead?: (conversationId:string, body:any)=>any; validationIntervalMs?:number; cloud?:CloudRealtime; queueEvent?:(event:CloudEvent)=>void; }
export function attachRealtime(io:Server,auth:any,scoped:ScopedState,persistence:PersistenceCoordinator,options:RealtimeOptions={}) {
  const cloud=options.cloud; let leases:PresenceLease[]=[]; let ticking=false; let closed=false; let lastPrune=0;let announcedPresence=new Set<string>();
  const unit=(operation:()=>any)=>cloud?persistence.mutateResult(operation):Promise.resolve().then(operation);
  const live=(socket:any)=>{
    const access=auth.verifyAccessToken(socket.data.accessToken),workspaceId=socket.data.workspaceId;
    if(!membership(scoped.raw,access.user,workspaceId))throw new Error('WORKSPACE_FORBIDDEN');
    return {access,scope:{kind:'workspace',user:access.user,workspaceId,path:'/events',method:'GET'} as Scope};
  };
  io.use((socket,next)=>{
    void unit(()=>{try{
      const {token,workspaceId}=socket.handshake.auth||{};
      if(typeof token!=='string'||typeof workspaceId!=='string'||!workspaceId)throw new Error('UNAUTHENTICATED');
      const access=auth.verifyAccessToken(token);
      if(!membership(scoped.raw,access.user,workspaceId))throw new Error('WORKSPACE_FORBIDDEN');
      socket.data={accessToken:token,userId:access.user.id,sessionId:access.session.id,workspaceId};persistence.afterCommit(()=>next());
    }catch(error:any){
      const denied=new Error('Realtime authorization required') as any;
      denied.data={status:error.message==='WORKSPACE_FORBIDDEN'?403:401,code:error.message==='WORKSPACE_FORBIDDEN'?'WORKSPACE_FORBIDDEN':'UNAUTHENTICATED'};next(denied);
    }}).catch(()=>next(new Error('STORAGE_UNAVAILABLE')));
  });
  const presence=(userId:string,workspaceId:string):boolean=>{
    if(cloud)return leases.some(lease=>lease.userId===userId&&lease.workspaceId===workspaceId&&lease.expiresAt>Date.now()&&scoped.raw.userSessions.some((session:any)=>session.id===lease.sessionId&&session.status==='active'&&Date.parse(session.expiresAt)>Date.now())&&scoped.raw.users.some((user:any)=>user.id===userId&&isAccountActive(user)&&membership(scoped.raw,user,workspaceId)));
    for(const socket of io.sockets.sockets.values()){
      if(!socket.connected||socket.data.userId!==userId||socket.data.workspaceId!==workspaceId)continue;
      try{live(socket);return true;}catch{socket.disconnect(true);}
    }
    return false;
  };
  const deliver=(originWorkspace:string,room:string|null,event:string,payload:any,excludeSocketId?:string)=>{
    for(const socket of io.sockets.sockets.values()){
      try{
        if(socket.id===excludeSocketId)continue;
        const {scope}=live(socket);if(scope.workspaceId!==originWorkspace)continue;
        if(room?.startsWith('user_')&&scope.user.id!==room.slice(5))continue;
        const conversationId=room?.startsWith('conv_')?room.slice(5):payload?.conversationId;
        const canReadConversation=typeof conversationId==='string'&&scoped.participant(scope.user.id,conversationId,scope.workspaceId);
        if(event==='app_chat_updated'){
          // A removed participant must also drop its cached projection. An
          // otherwise unrelated member receives no private conversation ID.
          socket.emit(event,{type:'data_changed',...(canReadConversation?{conversationId}:{})});continue;
        }
        if(room?.startsWith('conv_')&&(!canReadConversation||(event==='typing_status'&&!socket.rooms.has(room))))continue;
        if(['app_tasks_updated','app_projects_updated','app_files_updated','app_feedback_updated','app_notifications_updated','app_activity_updated','app_chat_requests_updated'].includes(event)){
          socket.emit(event,{type:'data_changed'});continue;
        }
        if(['new_message','message_updated','message_deleted','reactions_updated','pinned_updated','message_seen'].includes(event)){
          if(!canReadConversation)continue;
          socket.emit(event,{type:'data_changed',conversationId});continue;
        }
        let data=payload;
        const collection=({wp_sites_updated:'wpSites',wp_logs_updated:'wpLogs',wp_webhooks_updated:'wpWebhooks'} as Record<string,string>)[event]||(event.endsWith('_updated')?event.slice(0,-8):'');
        if(Array.isArray(data)&&Array.isArray(scoped.raw[collection]))data=data.filter((row:any)=>{
          const record=scoped.raw[collection].find((record:any)=>record.id===row.id||(collection==='wpSites'&&record.projectId===row.projectId));
          return record&&scoped.visible(collection,record,scope);
        });
        socket.emit(event,sanitize(data,scope,scoped));
      }catch{socket.disconnect(true);}
    }
  };
  const publish=(room:string|null,event:string,payload:any)=>{
    const scope=scoped.current();if(!scope||scope.kind!=='workspace')return;
    const snapshot=payload===undefined?null:JSON.parse(JSON.stringify(payload));
    if(cloud)options.queueEvent!({instanceId:cloud.instanceId,workspaceId:scope.workspaceId,room,event,payload:snapshot});
    else persistence.afterCommit(()=>deliver(scope.workspaceId,room,event,snapshot));
  };
  const broadcastWorkspace=(workspaceId:string,event:string,payload:any)=>{
    if(!scoped.raw.workspaces.some((workspace:any)=>workspace.id===workspaceId))return;
    const snapshot=payload===undefined?null:JSON.parse(JSON.stringify(payload));
    if(cloud)options.queueEvent!({instanceId:cloud.instanceId,workspaceId,room:null,event,payload:snapshot});
    else persistence.afterCommit(()=>deliver(workspaceId,null,event,snapshot));
  };
  const announcePresence=(userId:string,workspaceId:string)=>deliver(workspaceId,null,'online_status',{userId,status:presence(userId,workspaceId)?'online':'offline'});
  const input=(socket:any,data:any,fields:string[])=>{
    const {scope}=live(socket);
    if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!fields.includes(key))
      ||data.userId!==undefined&&data.userId!==scope.user.id||data.workspaceId!==undefined&&data.workspaceId!==scope.workspaceId)throw new Error('FORBIDDEN');
    if(data.conversationId!==undefined&&(typeof data.conversationId!=='string'||!data.conversationId||data.conversationId.length>200))throw new Error('FORBIDDEN');
    return scope;
  };
  const acknowledge=(callback:any,value:any)=>{if(typeof callback==='function'){if(cloud&&persistence.isActive())persistence.afterCommit(()=>callback(value));else callback(value);}};
  io.on('connection',socket=>{
    socket.join('user_'+socket.data.userId);socket.join('workspace_'+socket.data.workspaceId);
    // Presence is derived from authenticated live sockets, never account state.
    if(!cloud)announcePresence(socket.data.userId,socket.data.workspaceId);
    const timer=cloud?null:setInterval(()=>{
      try{
        const {scope}=live(socket);
        for(const room of socket.rooms)if(room.startsWith('conv_')&&!scoped.participant(scope.user.id,room.slice(5),scope.workspaceId)){
          socket.leave(room);socket.emit('app_chat_updated',{type:'data_changed'});
        }
      }catch{socket.disconnect(true);}
    },options.validationIntervalMs||1000);timer?.unref();
    socket.on('join',(data:any,callback:any)=>{void unit(()=>{
      try{
        const scope=input(socket,data,['userId','workspaceId','conversationId']);
        if(data.conversationId){
          if(!scoped.participant(scope.user.id,data.conversationId,scope.workspaceId))throw new Error('FORBIDDEN');
          socket.join('conv_'+data.conversationId);
        }
        acknowledge(callback,{ok:true});
      }catch{acknowledge(callback,{error:'FORBIDDEN'});}
    }).catch(()=>acknowledge(callback,{error:'STORAGE_UNAVAILABLE'}));});
    socket.on('leave',(data:any,callback:any)=>{void unit(()=>{
      try{input(socket,data,['userId','workspaceId','conversationId']);if(!data.conversationId)throw new Error('FORBIDDEN');socket.leave('conv_'+data.conversationId);acknowledge(callback,{ok:true});}
      catch{acknowledge(callback,{error:'FORBIDDEN'});}
    }).catch(()=>acknowledge(callback,{error:'STORAGE_UNAVAILABLE'}));});
    socket.on('typing',(data:any,callback:any)=>{void unit(()=>{
      try{
        const scope=input(socket,data,['userId','workspaceId','conversationId','isTyping']);
        if(typeof data.isTyping!=='boolean'||!scoped.participant(scope.user.id,data.conversationId,scope.workspaceId)||!socket.rooms.has('conv_'+data.conversationId))throw new Error('FORBIDDEN');
        if(cloud)options.queueEvent!({instanceId:cloud.instanceId,workspaceId:scope.workspaceId,room:'conv_'+data.conversationId,event:'typing_status',payload:{conversationId:data.conversationId,userId:scope.user.id,username:scope.user.name,isTyping:data.isTyping},excludeSocketId:socket.id});
        else for(const peer of io.sockets.sockets.values()){
          try{
            const target=live(peer).scope;
            if(peer.id!==socket.id&&target.workspaceId===scope.workspaceId&&peer.rooms.has('conv_'+data.conversationId)&&scoped.participant(target.user.id,data.conversationId,target.workspaceId))
              peer.emit('typing_status',{conversationId:data.conversationId,userId:scope.user.id,username:scope.user.name,isTyping:data.isTyping});
          }catch{peer.disconnect(true);}
        }
        acknowledge(callback,{ok:true});
      }catch{acknowledge(callback,{error:'FORBIDDEN'});}
    }).catch(()=>acknowledge(callback,{error:'STORAGE_UNAVAILABLE'}));});
    socket.on('seen',(data:any,callback:any)=>{
      try{
        void persistence.mutateResult(()=>{
          const current=input(socket,data,['userId','workspaceId','conversationId','messageId']);
          if(!options.markRead)throw new Error('FORBIDDEN');
          if(!scoped.participant(current.user.id,data.conversationId,current.workspaceId))throw new Error('FORBIDDEN');
          return scoped.run(current,()=>options.markRead!(data.conversationId,data.messageId===undefined?{}:{messageId:data.messageId}));
        }).then(result=>acknowledge(callback,{ok:true,...result}),error=>acknowledge(callback,{error:error.status&&error.status<500?error.code||'FORBIDDEN':'STORAGE_UNAVAILABLE'}));
      }catch{acknowledge(callback,{error:'FORBIDDEN'});}
    });
    socket.on('disconnect',()=>{if(timer)clearInterval(timer);if(cloud)void unit(()=>cloud.remove(socket.id)).catch(()=>{});else announcePresence(socket.data.userId,socket.data.workspaceId);});
  });
  const tick=async()=>{
    if(!cloud||closed||ticking||!io.sockets.sockets.size)return; ticking=true;
    try{await persistence.mutateResult(async()=>{
      const local:PresenceLease[]=[];
      for(const socket of io.sockets.sockets.values())try{const {access,scope}=live(socket);for(const room of socket.rooms)if(room.startsWith('conv_')&&!scoped.participant(scope.user.id,room.slice(5),scope.workspaceId)){socket.leave(room);persistence.afterCommit(()=>{socket.emit('app_chat_updated',{type:'data_changed'});});}local.push({socketId:socket.id,userId:scope.user.id,sessionId:access.session.id,workspaceId:scope.workspaceId,expiresAt:Date.parse(access.session.expiresAt)});}catch{socket.disconnect(true);}
      await cloud.heartbeat(local); const fresh=await cloud.refreshPresence(); const batch=await cloud.poll();const pruneAt=Date.now();const pruning=pruneAt-lastPrune>=60000;if(pruning)await cloud.prune();
      persistence.afterCommit(()=>{leases=fresh;for(const event of batch.events)deliver(event.workspaceId,event.room,event.event,event.payload,event.excludeSocketId);batch.commit();if(pruning)lastPrune=pruneAt;
        const candidates=new Map(fresh.map(lease=>[JSON.stringify([lease.userId,lease.workspaceId]),lease]));
        const online=new Set([...candidates].filter(([,lease])=>presence(lease.userId,lease.workspaceId)).map(([key])=>key));
        for(const key of new Set([...announcedPresence,...online]))if(announcedPresence.has(key)!==online.has(key)){const [userId,workspaceId]=JSON.parse(key);announcePresence(userId,workspaceId);}
        announcedPresence=online;
      });
    });}catch{/* Next tick retries the same uncommitted cursor. */}finally{ticking=false;}
  };
  const cloudTimer=cloud?setInterval(()=>void tick(),options.validationIntervalMs||1000):null;cloudTimer?.unref();
  return {close:async()=>{closed=true;if(cloudTimer)clearInterval(cloudTimer);if(cloud)await persistence.mutateResult(()=>cloud.close());},presence,broadcast:(event:string,payload:any)=>publish(null,event,payload),broadcastWorkspace,broadcastRoom:(room:string,event:string,payload:any)=>publish(room,event,payload),
    revokeSessions:(ids:string[])=>{for(const socket of io.sockets.sockets.values())if(ids.includes(socket.data.sessionId))socket.disconnect(true);}
  };
}
