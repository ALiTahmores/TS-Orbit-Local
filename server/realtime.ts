import type { Server } from 'socket.io';
import type { PersistenceCoordinator } from './persistence.ts';
import { ScopedState, membership, type Scope } from './policy/scope.ts';
import { sanitize } from './policy/index.ts';

interface RealtimeOptions { markRead?: (conversationId:string, body:any)=>any; validationIntervalMs?:number; }
export function attachRealtime(io:Server,auth:any,scoped:ScopedState,persistence:PersistenceCoordinator,options:RealtimeOptions={}) {
  const live=(socket:any)=>{
    const access=auth.verifyAccessToken(socket.data.accessToken),workspaceId=socket.data.workspaceId;
    if(!membership(scoped.raw,access.user,workspaceId))throw new Error('WORKSPACE_FORBIDDEN');
    return {access,scope:{kind:'workspace',user:access.user,workspaceId,path:'/events',method:'GET'} as Scope};
  };
  io.use((socket,next)=>{
    try{
      const {token,workspaceId}=socket.handshake.auth||{};
      if(typeof token!=='string'||typeof workspaceId!=='string'||!workspaceId)throw new Error('UNAUTHENTICATED');
      const access=auth.verifyAccessToken(token);
      if(!membership(scoped.raw,access.user,workspaceId))throw new Error('WORKSPACE_FORBIDDEN');
      socket.data={accessToken:token,userId:access.user.id,sessionId:access.session.id,workspaceId};next();
    }catch(error:any){
      const denied=new Error('Realtime authorization required') as any;
      denied.data={status:error.message==='WORKSPACE_FORBIDDEN'?403:401,code:error.message==='WORKSPACE_FORBIDDEN'?'WORKSPACE_FORBIDDEN':'UNAUTHENTICATED'};next(denied);
    }
  });
  const presence=(userId:string,workspaceId:string):boolean=>{
    for(const socket of io.sockets.sockets.values()){
      if(!socket.connected||socket.data.userId!==userId||socket.data.workspaceId!==workspaceId)continue;
      try{live(socket);return true;}catch{socket.disconnect(true);}
    }
    return false;
  };
  const deliver=(originWorkspace:string,room:string|null,event:string,payload:any)=>{
    for(const socket of io.sockets.sockets.values()){
      try{
        const {scope}=live(socket);if(scope.workspaceId!==originWorkspace)continue;
        if(room?.startsWith('user_')&&scope.user.id!==room.slice(5))continue;
        const conversationId=room?.startsWith('conv_')?room.slice(5):payload?.conversationId;
        const canReadConversation=typeof conversationId==='string'&&scoped.participant(scope.user.id,conversationId,scope.workspaceId);
        if(event==='app_chat_updated'){
          // A removed participant must also drop its cached projection. An
          // otherwise unrelated member receives no private conversation ID.
          socket.emit(event,{type:'data_changed',...(canReadConversation?{conversationId}:{})});continue;
        }
        if(room?.startsWith('conv_')&&!canReadConversation)continue;
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
    persistence.afterCommit(()=>deliver(scope.workspaceId,room,event,snapshot));
  };
  const broadcastWorkspace=(workspaceId:string,event:string,payload:any)=>{
    if(!scoped.raw.workspaces.some((workspace:any)=>workspace.id===workspaceId))return;
    const snapshot=payload===undefined?null:JSON.parse(JSON.stringify(payload));
    persistence.afterCommit(()=>deliver(workspaceId,null,event,snapshot));
  };
  const announcePresence=(userId:string,workspaceId:string)=>deliver(workspaceId,null,'online_status',{userId,status:presence(userId,workspaceId)?'online':'offline'});
  const input=(socket:any,data:any,fields:string[])=>{
    const {scope}=live(socket);
    if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!fields.includes(key))
      ||data.userId!==undefined&&data.userId!==scope.user.id||data.workspaceId!==undefined&&data.workspaceId!==scope.workspaceId)throw new Error('FORBIDDEN');
    if(data.conversationId!==undefined&&(typeof data.conversationId!=='string'||!data.conversationId||data.conversationId.length>200))throw new Error('FORBIDDEN');
    return scope;
  };
  const acknowledge=(callback:any,value:any)=>{if(typeof callback==='function')callback(value);};
  io.on('connection',socket=>{
    socket.join('user_'+socket.data.userId);socket.join('workspace_'+socket.data.workspaceId);
    // Presence is derived from authenticated live sockets, never account state.
    announcePresence(socket.data.userId,socket.data.workspaceId);
    const timer=setInterval(()=>{
      try{
        const {scope}=live(socket);
        for(const room of socket.rooms)if(room.startsWith('conv_')&&!scoped.participant(scope.user.id,room.slice(5),scope.workspaceId)){
          socket.leave(room);socket.emit('app_chat_updated',{type:'data_changed'});
        }
      }catch{socket.disconnect(true);}
    },options.validationIntervalMs||1000);timer.unref();
    socket.on('join',(data:any,callback:any)=>{
      try{
        const scope=input(socket,data,['userId','workspaceId','conversationId']);
        if(data.conversationId){
          if(!scoped.participant(scope.user.id,data.conversationId,scope.workspaceId))throw new Error('FORBIDDEN');
          socket.join('conv_'+data.conversationId);
        }
        acknowledge(callback,{ok:true});
      }catch{acknowledge(callback,{error:'FORBIDDEN'});}
    });
    socket.on('leave',(data:any,callback:any)=>{
      try{input(socket,data,['userId','workspaceId','conversationId']);if(!data.conversationId)throw new Error('FORBIDDEN');socket.leave('conv_'+data.conversationId);acknowledge(callback,{ok:true});}
      catch{acknowledge(callback,{error:'FORBIDDEN'});}
    });
    socket.on('typing',(data:any,callback:any)=>{
      try{
        const scope=input(socket,data,['userId','workspaceId','conversationId','isTyping']);
        if(typeof data.isTyping!=='boolean'||!scoped.participant(scope.user.id,data.conversationId,scope.workspaceId)||!socket.rooms.has('conv_'+data.conversationId))throw new Error('FORBIDDEN');
        for(const peer of io.sockets.sockets.values()){
          try{
            const target=live(peer).scope;
            if(peer.id!==socket.id&&target.workspaceId===scope.workspaceId&&peer.rooms.has('conv_'+data.conversationId)&&scoped.participant(target.user.id,data.conversationId,target.workspaceId))
              peer.emit('typing_status',{conversationId:data.conversationId,userId:scope.user.id,username:scope.user.name,isTyping:data.isTyping});
          }catch{peer.disconnect(true);}
        }
        acknowledge(callback,{ok:true});
      }catch{acknowledge(callback,{error:'FORBIDDEN'});}
    });
    socket.on('seen',(data:any,callback:any)=>{
      try{
        const scope=input(socket,data,['userId','workspaceId','conversationId','messageId']);
        if(!options.markRead||!scoped.participant(scope.user.id,data.conversationId,scope.workspaceId))throw new Error('FORBIDDEN');
        void persistence.mutateResult(()=>{
          const current=live(socket).scope;
          if(!scoped.participant(current.user.id,data.conversationId,current.workspaceId))throw new Error('FORBIDDEN');
          return scoped.run(current,()=>options.markRead!(data.conversationId,data.messageId===undefined?{}:{messageId:data.messageId}));
        }).then(result=>acknowledge(callback,{ok:true,...result}),error=>acknowledge(callback,{error:error.status&&error.status<500?error.code||'FORBIDDEN':'STORAGE_UNAVAILABLE'}));
      }catch{acknowledge(callback,{error:'FORBIDDEN'});}
    });
    socket.on('disconnect',()=>{clearInterval(timer);announcePresence(socket.data.userId,socket.data.workspaceId);});
  });
  return {presence,broadcast:(event:string,payload:any)=>publish(null,event,payload),broadcastWorkspace,broadcastRoom:(room:string,event:string,payload:any)=>publish(room,event,payload),
    revokeSessions:(ids:string[])=>{for(const socket of io.sockets.sockets.values())if(ids.includes(socket.data.sessionId))socket.disconnect(true);}
  };
}
