import {apiFetch,ApiError,getApiIdentity} from './api';

/** Apply the server commit before any optional refetch can fail. */
export async function commitPortalChange(projectId:string,method:'PUT'|'POST'|'DELETE',path:'/portal'|'/portal-token',body:unknown,applyProject:(project:any)=>void):Promise<any> {
  if(!projectId.trim())throw new ApiError(422,'RESOURCE_ID_REQUIRED','شناسه پروژه لازم است.');
  const identity=getApiIdentity();
  const response=await apiFetch('/api/projects/'+encodeURIComponent(projectId)+path,{method,...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result=await response.json(),current=getApiIdentity();
  if(identity.userId!==current.userId||identity.workspaceId!==current.workspaceId)throw new ApiError(0,'STALE_REQUEST','نشست یا فضای کاری تغییر کرده است.');
  if(!result.project||result.project.id!==projectId||(result.project.workspaceId&&result.project.workspaceId!==identity.workspaceId))throw new ApiError(502,'INVALID_RESPONSE','پروژه تأییدشده از سرور دریافت نشد.');
  const project={...result.project,...(typeof result.token==='string'?{portalToken:result.token,clientPortalToken:result.token}:{})};
  applyProject(project);
  return project;
}

/** Read only the capability in the current address; never reuse a previous token. */
export function portalAddress(href:string):{token:string;projectId:string} {
  const url=new URL(href);
  const hash=url.hash.includes('?')?url.hash.slice(url.hash.indexOf('?')+1):url.hash.slice(1);
  const hashParams=new URLSearchParams(hash);
  return {
    token:url.searchParams.get('portalToken')??url.searchParams.get('token')??hashParams.get('portalToken')??hashParams.get('token')??'',
    projectId:url.searchParams.get('projectId')??hashParams.get('projectId')??''
  };
}

export function feedbackEventText(entry:{action?:string;fromStatus?:string;toStatus?:string},language='fa'):string {
  const statuses:Record<string,string>=language==='fa'?{pending:'در انتظار بررسی',in_progress:'در حال بررسی',resolved:'برطرف شده',approved:'تأیید شده',rejected:'رد شده'}:{};
  const status=(value:string)=>statuses[value]||value;
  if(entry.toStatus)return (entry.fromStatus?status(entry.fromStatus)+' ← ':'')+status(entry.toStatus);
  const actions:Record<string,string>=language==='fa'?{submitted:'ثبت بازخورد',replied:'ثبت پاسخ',status_changed:'تغییر وضعیت',deleted:'حذف بازخورد'}:{submitted:'Feedback submitted',replied:'Reply added',status_changed:'Status changed',deleted:'Feedback deleted'};
  return actions[entry.action||'']||entry.action||'—';
}
