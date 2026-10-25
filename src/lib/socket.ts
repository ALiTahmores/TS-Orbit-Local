import { io, Socket } from 'socket.io-client';
import { getApiIdentity, clearCredential } from './api';
let socket: Socket | null=null;
type EventHandler=(...args:any[])=>void;
const internalListeners=new Map<string,Set<EventHandler>>();
export const emitInternalEvent=(event:string,...args:any[])=>internalListeners.get(event)?.forEach(fn=>fn(...args));
export const registerInternalListener=(event:string,handler:EventHandler)=>{if(!internalListeners.has(event))internalListeners.set(event,new Set());internalListeners.get(event)!.add(handler);return()=>internalListeners.get(event)?.delete(handler);};
export const getSocket=():Socket|null=>{
  if(typeof window==='undefined')return null;
  const token=localStorage.getItem('token');const {userId,workspaceId}=getApiIdentity();
  if(!token||!userId||!workspaceId)return null;
  if(!socket){
    socket=io(window.location.origin,{auth:{token,workspaceId},transports:['websocket'],autoConnect:false,reconnection:true,reconnectionAttempts:Infinity,reconnectionDelay:700,reconnectionDelayMax:8000,randomizationFactor:0.4,timeout:5000});
    socket.on('connect_error',(error:any)=>{
      // Connectivity failure never creates a local success or bypasses authorization.
      if(error?.data?.status===401||error?.data?.code==='UNAUTHENTICATED'||error?.data?.code==='SESSION_REVOKED')clearCredential();
    });
    socket.connect();
  }
  return socket;
};
export const isRealtimeOffline=()=>!socket?.connected;
export const disconnectSocket=()=>{socket?.disconnect();socket=null;};
if(typeof window!=='undefined'){
  window.addEventListener('orbit:identity-change',disconnectSocket);
  window.addEventListener('orbit:session-ended',disconnectSocket);
}

