import React,{useEffect,useState,useRef} from 'react';
import {useProject} from '../../context/ProjectContext';
import {apiFetch} from '../../lib/api';
import {downloadAsset} from '../../lib/assets';
import {feedbackEventText} from '../../lib/portal';
import {getSocket} from '../../lib/socket';
import {PublicClientPortal} from '../PublicClientPortal';

export const ClientPortalView:React.FC<{projectOverride?:any}>=({projectOverride})=>{
  const {selectedProject,projects,activeWorkspaceId,currentUser}=useProject();
  const id=projectOverride?.id || selectedProject?.id;
  const project=projects.find(candidate=>candidate.id===id);
  return project&&id&&id!=='no_project'?<PortalControls key={JSON.stringify([activeWorkspaceId,currentUser?.id,id])} project={project}/>:<p>یک پروژه انتخاب کنید.</p>;
};

const PortalControls:React.FC<{project:any}>=({project})=>{
  const {refreshAllData,saveProjectPortal}=useProject();
  const id=project.id,scope=useRef(0),loadSequence=useRef(0);
  const [feedback,setFeedback]=useState<any[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[expires,setExpires]=useState(''),[preview,setPreview]=useState(false),[replies,setReplies]=useState<Record<string,string>>({}),[message,setMessage]=useState(''),[clientVisible,setClientVisible]=useState(false);
  const load=async()=>{
    const generation=scope.current,request=++loadSequence.current;
    const response=await apiFetch('/api/projects/'+encodeURIComponent(id)+'/feedbacks');
    const rows=await response.json();
    if(!Array.isArray(rows))throw new Error('فهرست بازخوردها معتبر نیست.');
    if(generation===scope.current&&request===loadSequence.current)setFeedback(rows);
  };
  useEffect(()=>{
    const generation=++scope.current;
    const refresh=(event?:{projectId?:string})=>{if(event?.projectId&&event.projectId!==id)return;void load().catch(error=>{if(generation===scope.current)setError(error.message);});};
    refresh();const socket=getSocket();socket?.on('app_feedback_updated',refresh);
    return()=>{scope.current++;socket?.off('app_feedback_updated',refresh);};
  },[id]);
  useEffect(()=>{
    const date=project.portalExpiresAt?new Date(project.portalExpiresAt):null;
    setExpires(date&&!Number.isNaN(date.getTime())?new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16):'');
  },[project.portalExpiresAt]);
  const perform=async(operation:(current:()=>boolean)=>Promise<void>)=>{
    const generation=scope.current,current=()=>generation===scope.current;
    setBusy(true);setError('');setNotice('');
    try{await operation(current);}catch(error){if(current())setError(error instanceof Error?error.message:'عملیات انجام نشد.');}finally{if(current())setBusy(false);}
  };
  const revoked=project.portalRevokedAt||project.clientPortalRevokedAt||project.portalRevoked||project.clientPortalRevoked;
  const token=revoked?'':project.portalToken||project.clientPortalToken||'';
  const link=token?window.location.origin+'/?portalToken='+encodeURIComponent(token):'';
  const expiry=()=>expires?new Date(expires).toISOString():null;
  const control=(method:'PUT'|'POST'|'DELETE',path:'/portal'|'/portal-token',withExpiry=false,enabled?:boolean)=>perform(async current=>{
    const body=withExpiry?{...(enabled!==undefined?{enabled}:{}),expiresAt:expiry()}:undefined;
    await saveProjectPortal(id,method,path,body);
    if(current()){setNotice('تنظیمات پورتال در سرور ذخیره شد.');await refreshAllData();}
  });
  const updateFeedback=(item:any,status:string)=>perform(async current=>{
    const reply=replies[item.id]?.trim();
    await apiFetch('/api/projects/'+encodeURIComponent(id)+'/feedbacks/'+encodeURIComponent(item.id)+'/status',{method:'PUT',body:JSON.stringify({status,...(reply?{reply}:{})})});
    if(!current())return;await load();if(current())setReplies(previous=>({...previous,[item.id]:''}));
  });
  const statusLabels:Record<string,string>={pending:'در انتظار بررسی',in_progress:'در حال بررسی',resolved:'برطرف شده',approved:'تأیید شده',rejected:'رد شده'};
  return <section className="space-y-4" dir="rtl"><h2 className="font-bold">مدیریت پورتال مشتری — {project.title}</h2>{error&&<p role="alert" className="text-red-600">{error}</p>}{notice&&<p role="status" className="text-green-700 text-xs">{notice}</p>}
    <div className="p-5 rounded-2xl border bg-white dark:bg-slate-900 space-y-3">
      <label className="block text-xs">تاریخ انقضای لینک<input aria-label="انقضای پورتال" type="datetime-local" value={expires} disabled={busy} onChange={event=>setExpires(event.target.value)} className="block p-2 border rounded dark:bg-slate-800"/></label>
      <p className="text-xs">{project.portalExpiresAt?'انقضای ثبت‌شده: '+project.portalExpiresAt:'بدون تاریخ انقضا'}{project.portalRevokedAt?' — لینک لغو شده است.':''}</p>
      <div className="flex gap-3 flex-wrap">
        <button disabled={busy} onClick={()=>control('PUT','/portal',true,!project.clientPortalEnabled)} className="text-xs p-2 rounded bg-blue-600 text-white">{project.clientPortalEnabled?'غیرفعال کردن پورتال':'فعال کردن پورتال'}</button>
        <button disabled={busy} onClick={()=>control('PUT','/portal',true,project.clientPortalEnabled===true)} className="text-xs p-2 border rounded">ذخیره انقضا</button>
        <button disabled={busy} onClick={()=>control('POST','/portal-token',true)} className="text-xs p-2 border rounded">تولید / چرخش لینک امن</button>
        <button disabled={busy||!token} onClick={()=>control('DELETE','/portal-token')} className="text-xs text-red-600">لغو لینک پورتال</button>
      </div>
      <input aria-label="لینک پورتال" value={link} readOnly className="w-full p-2 border rounded dark:bg-slate-800"/>
      <div className="flex gap-3"><button disabled={!link||busy} onClick={()=>perform(()=>navigator.clipboard.writeText(link))} className="text-xs">کپی لینک کارفرما</button><button disabled={!link} onClick={()=>window.open(link,'_blank','noopener,noreferrer')} className="text-xs">مشاهده مستقیم پورتال</button><button disabled={!link} onClick={()=>setPreview(true)} className="text-xs">پیش‌نمایش دیدگاه کارفرما</button></div>
    </div>
    <form onSubmit={event=>{event.preventDefault();if(!message.trim()||busy)return;void perform(async current=>{
      await apiFetch('/api/projects/'+encodeURIComponent(id)+'/feedbacks',{method:'POST',body:JSON.stringify({message:message.trim(),category:'general',clientVisible})});
      if(!current())return;await load();if(current())setMessage('');
    });}} className="p-4 border rounded-xl space-y-2">
      <label className="block text-xs">یادداشت مدیریت<textarea aria-label="یادداشت مدیریت" disabled={busy} value={message} onChange={event=>setMessage(event.target.value)} className="block w-full p-2 border rounded dark:bg-slate-800"/></label>
      <label className="flex gap-2 text-xs"><input type="checkbox" checked={clientVisible} disabled={busy} onChange={event=>setClientVisible(event.target.checked)}/>نمایش یادداشت و پاسخ‌های آن به مشتری</label>
      <button disabled={busy||!message.trim()} className="text-xs">ثبت یادداشت</button>
    </form>
    <div className="space-y-3">{feedback.map(item=><article key={item.id} className="p-4 border rounded-xl bg-white dark:bg-slate-900 space-y-2">
      <p className="font-bold text-xs">{item.senderName} — {item.createdAt}</p><p className="text-sm whitespace-pre-wrap">{item.message}</p><p className="text-xs">وضعیت: {statusLabels[item.status]||item.status} — {item.clientVisible?'قابل مشاهده برای مشتری':'داخلی'}</p>
      <div className="flex gap-2">{(item.attachments||[]).map((attachment:any)=>{const assetId=typeof attachment==='string'?attachment:attachment.id;return <button key={assetId} disabled={busy} onClick={()=>perform(async current=>{const response=await apiFetch('/api/files/'+encodeURIComponent(assetId));const asset=await response.json();if(current())await downloadAsset(asset);})} className="text-xs text-blue-600">دانلود پیوست</button>;})}</div>
      <input aria-label={'پاسخ '+item.id} placeholder="پاسخ به مشتری..." disabled={busy} value={replies[item.id]||''} onChange={event=>setReplies(previous=>({...previous,[item.id]:event.target.value}))} className="w-full p-2 border rounded dark:bg-slate-800"/>
      <div className="flex gap-2 flex-wrap"><button disabled={busy||!replies[item.id]?.trim()} onClick={()=>updateFeedback(item,item.status)} className="p-2 rounded bg-blue-600 text-white text-xs">ارسال پاسخ</button>{Object.entries(statusLabels).map(([status,label])=><button key={status} disabled={busy} onClick={()=>updateFeedback(item,status)} className="p-2 border rounded text-xs">{label}</button>)}<button disabled={busy} onClick={()=>perform(async current=>{await apiFetch('/api/projects/'+encodeURIComponent(id)+'/feedbacks/'+encodeURIComponent(item.id),{method:'DELETE'});if(current())await load();})} className="text-xs text-red-600">حذف بازخورد</button></div>
      {(item.replies||[]).map((reply:any)=><p key={reply.id} className="text-xs text-blue-600">{reply.senderName} — {reply.createdAt} — {reply.message}</p>)}
      {(item.history||[]).map((entry:any,index:number)=><p key={entry.id||index} className="text-xs text-slate-500">{entry.createdAt} — {feedbackEventText(entry)}{entry.actorName?' — '+entry.actorName:''}</p>)}
    </article>)}</div>
    {preview&&<div className="fixed inset-0 z-50 overflow-y-auto bg-white dark:bg-slate-950"><button onClick={()=>setPreview(false)} className="fixed top-2 left-2 z-[99999] p-2 bg-slate-800 text-white rounded">بستن پیش‌نمایش</button><PublicClientPortal tokenParam={token}/></div>}
  </section>;
};
