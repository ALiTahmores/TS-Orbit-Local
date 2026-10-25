import { randomUUID } from 'node:crypto';
export interface CloudEvent { instanceId:string; workspaceId:string; room:string|null; event:string; payload:any; excludeSocketId?:string; }
export interface PresenceLease { socketId:string; userId:string; sessionId:string; workspaceId:string; expiresAt:number; }
export function createCloudRealtime(store:{query:(sql:string,values?:any[])=>Promise<{rows:any[]}>}) {
  const instanceId=randomUUID(); let cursor='0';
  return {
    instanceId,
    async initialize(){
      await store.query(`CREATE TABLE IF NOT EXISTS orbit_rt_events (seq BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), event JSONB NOT NULL)`);
      await store.query(`CREATE TABLE IF NOT EXISTS orbit_rt_presence (instance_id TEXT NOT NULL, socket_id TEXT NOT NULL, user_id TEXT NOT NULL, session_id TEXT NOT NULL, workspace_id TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, PRIMARY KEY(instance_id,socket_id))`);
      const result=await store.query('SELECT COALESCE(MAX(seq),0)::text AS seq FROM orbit_rt_events'); cursor=String(result.rows[0]?.seq||'0');
    },
    async heartbeat(leases:PresenceLease[]){
      if(!leases.length)return;
      const rows=leases.map(lease=>({socket_id:lease.socketId,user_id:lease.userId,session_id:lease.sessionId,workspace_id:lease.workspaceId,expires_at:new Date(Math.min(lease.expiresAt,Date.now()+15000)).toISOString()}));
      await store.query(`INSERT INTO orbit_rt_presence(instance_id,socket_id,user_id,session_id,workspace_id,expires_at) SELECT $1,x.socket_id,x.user_id,x.session_id,x.workspace_id,x.expires_at FROM jsonb_to_recordset($2::jsonb) AS x(socket_id text,user_id text,session_id text,workspace_id text,expires_at timestamptz) ON CONFLICT(instance_id,socket_id) DO UPDATE SET expires_at=EXCLUDED.expires_at`,[instanceId,JSON.stringify(rows)]);
    },
    async remove(socketId:string){await store.query('DELETE FROM orbit_rt_presence WHERE instance_id=$1 AND socket_id=$2',[instanceId,socketId]);},
    async refreshPresence():Promise<PresenceLease[]>{const result=await store.query('SELECT socket_id,user_id,session_id,workspace_id,expires_at FROM orbit_rt_presence WHERE expires_at > now()');return result.rows.map(row=>({socketId:row.socket_id,userId:row.user_id,sessionId:row.session_id,workspaceId:row.workspace_id,expiresAt:new Date(row.expires_at).getTime()}));},
    async poll(){const result=await store.query('SELECT seq::text,event,created_at FROM orbit_rt_events WHERE seq > $1 ORDER BY seq LIMIT 1000',[cursor]);const next=result.rows.length?String(result.rows.at(-1).seq):cursor;return {events:result.rows.filter(row=>row.event?.event!=='typing_status'||Date.parse(row.created_at)>Date.now()-10000).map(row=>row.event as CloudEvent),commit:()=>{cursor=next;}};},
    async prune(){await store.query(`DELETE FROM orbit_rt_presence WHERE expires_at <= now()`);await store.query(`DELETE FROM orbit_rt_events WHERE created_at < now() - interval '1 day'`);},
    async close(){await store.query('DELETE FROM orbit_rt_presence WHERE instance_id=$1',[instanceId]);},
  };
}
export type CloudRealtime=ReturnType<typeof createCloudRealtime>;
