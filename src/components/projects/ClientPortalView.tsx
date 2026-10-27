import React,{useEffect,useState,useRef} from 'react';
import {Copy,Eye,ExternalLink,KeyRound,Link2Off,MessageSquare,Paperclip,Send,ShieldCheck,Trash2} from 'lucide-react';
import {useProject} from '../../context/ProjectContext';
import {apiFetch} from '../../lib/api';
import {downloadAsset} from '../../lib/assets';
import {feedbackEventText} from '../../lib/portal';
import {getSocket} from '../../lib/socket';
import {formatJalaliDate,formatJalaliDateTime,localISODate} from '../../lib/dates';
import {JalaliDateInput} from '../common/JalaliDateInput';
import {PublicClientPortal} from '../PublicClientPortal';

export const ClientPortalView:React.FC<{projectOverride?:any}>=({projectOverride})=>{
  const {selectedProject,projects,activeWorkspaceId,currentUser}=useProject();
  const id=projectOverride?.id || selectedProject?.id;
  const project=projects.find(candidate=>candidate.id===id);
  return project&&id&&id!=='no_project'?<PortalControls key={JSON.stringify([activeWorkspaceId,currentUser?.id,id])} project={project}/>:<p className="text-sm text-slate-500">یک پروژه انتخاب کنید.</p>;
};

const card='p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4';
const field='w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 disabled:opacity-60';
const primary='inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors';
const secondary='inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors';
const danger='inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors';
const statusTone:Record<string,string>={pending:'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',in_progress:'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',resolved:'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',approved:'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',rejected:'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'};

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
    refresh();const socket=getSocket();socket?.on('app_feedback_updated',refresh);socket?.on('connect',refresh);
    return()=>{scope.current++;socket?.off('app_feedback_updated',refresh);socket?.off('connect',refresh);};
  },[id]);
  useEffect(()=>{
    const date=project.portalExpiresAt?new Date(project.portalExpiresAt):null;
    setExpires(date&&!Number.isNaN(date.getTime())?localISODate(date):'');
  },[project.portalExpiresAt]);
  const perform=async(operation:(current:()=>boolean)=>Promise<void>)=>{
    const generation=scope.current,current=()=>generation===scope.current;
    setBusy(true);setError('');setNotice('');
    try{await operation(current);}catch(error){if(current())setError(error instanceof Error?error.message:'عملیات انجام نشد.');}finally{if(current())setBusy(false);}
  };
  const revoked=project.portalRevokedAt||project.clientPortalRevokedAt||project.portalRevoked||project.clientPortalRevoked;
  const enabled=project.clientPortalEnabled===true&&!revoked;
  const token=revoked?'':project.portalToken||project.clientPortalToken||'';
  const link=token?window.location.origin+'/?portalToken='+encodeURIComponent(token):'';
  // The link stays valid through the whole chosen day.
  const expiry=()=>expires?new Date(`${expires}T23:59:59`).toISOString():null;
  const control=(method:'PUT'|'POST'|'DELETE',path:'/portal'|'/portal-token',withExpiry=false,enable?:boolean,done='تنظیمات پورتال ذخیره شد.')=>perform(async current=>{
    const body=withExpiry?{...(enable!==undefined?{enabled:enable}:{}),expiresAt:expiry()}:undefined;
    await saveProjectPortal(id,method,path,body);
    if(current()){setNotice(done);await refreshAllData();}
  });
  const updateFeedback=(item:any,status:string)=>perform(async current=>{
    const reply=replies[item.id]?.trim();
    await apiFetch('/api/projects/'+encodeURIComponent(id)+'/feedbacks/'+encodeURIComponent(item.id)+'/status',{method:'PUT',body:JSON.stringify({status,...(reply?{reply}:{})})});
    if(!current())return;await load();if(current())setReplies(previous=>({...previous,[item.id]:''}));
  });
  const statusLabels:Record<string,string>={pending:'در انتظار بررسی',in_progress:'در حال بررسی',resolved:'برطرف شده',approved:'تأیید شده',rejected:'رد شده'};
  const state=revoked?{label:'لینک لغو شده',tone:'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'}:enabled?{label:'فعال',tone:'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'}:{label:'غیرفعال',tone:'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'};

  return <section className="space-y-4" dir="rtl">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2"><ShieldCheck size={18} className="text-blue-600"/>پورتال کارفرما — {project.title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">کارفرما با این لینک، پیشرفت پروژه و فایل‌های تأییدشده را می‌بیند و بازخورد می‌فرستد.</p>
      </div>
      <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${state.tone}`}>{state.label}</span>
    </div>
    {error&&<p role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold">{error}</p>}
    {notice&&<p role="status" className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold">{notice}</p>}

    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">دسترسی کارفرما</h3>
        <button type="button" disabled={busy} onClick={()=>control('PUT','/portal',true,!enabled,enabled?'پورتال غیرفعال شد.':'پورتال فعال شد.')} className={enabled?secondary:primary}>{enabled?'غیرفعال کردن پورتال':'فعال کردن پورتال'}</button>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="portal-link" className="text-[11px] font-bold text-slate-500 dark:text-slate-400">لینک کارفرما</label>
        <div className="flex flex-wrap gap-2">
          <input id="portal-link" value={link||''} placeholder={revoked?'لینک لغو شده است؛ لینک جدید بسازید.':'هنوز لینکی ساخته نشده است.'} readOnly dir="ltr" onFocus={event=>event.currentTarget.select()} className={`${field} flex-1 min-w-[220px] font-mono text-[11px]`}/>
          <button type="button" disabled={!link||busy} onClick={()=>perform(async()=>{await navigator.clipboard.writeText(link);setNotice('لینک کپی شد.');})} className={secondary}><Copy size={14}/>کپی</button>
          <button type="button" disabled={!link||!enabled} onClick={()=>window.open(link,'_blank','noopener,noreferrer')} className={secondary}><ExternalLink size={14}/>باز کردن</button>
          <button type="button" disabled={!link} onClick={()=>setPreview(true)} className={secondary}><Eye size={14}/>پیش‌نمایش</button>
        </div>
        {link&&!enabled&&<p className="text-[11px] text-amber-600 dark:text-amber-400">تا وقتی پورتال غیرفعال است، این لینک برای کارفرما باز نمی‌شود.</p>}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5 w-56">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">تاریخ انقضای لینک</span>
          <JalaliDateInput value={expires} onChange={setExpires} disabled={busy} min={localISODate()} ariaLabel="تاریخ انقضای لینک پورتال" placeholder="بدون تاریخ انقضا"/>
        </div>
        <button type="button" disabled={busy} onClick={()=>control('PUT','/portal',true,project.clientPortalEnabled===true,'تاریخ انقضا ذخیره شد.')} className={secondary}>ذخیرهٔ انقضا</button>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 pb-2">{project.portalExpiresAt?`اعتبار تا پایان ${formatJalaliDate(project.portalExpiresAt)}`:'بدون تاریخ انقضا'}</span>
      </div>

      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
        <button type="button" disabled={busy} onClick={()=>{if(!token||window.confirm('لینک جدید ساخته شود؟ لینک فعلی دیگر کار نمی‌کند.'))void control('POST','/portal-token',true,undefined,'لینک جدید ساخته شد.');}} className={secondary}><KeyRound size={14}/>{token?'ساخت لینک جدید':'ساخت لینک'}</button>
        <button type="button" disabled={busy||!token} onClick={()=>{if(window.confirm('لینک کارفرما لغو شود؟ کارفرما دیگر به پورتال دسترسی نخواهد داشت.'))void control('DELETE','/portal-token',false,undefined,'لینک لغو شد.');}} className={danger}><Link2Off size={14}/>لغو لینک</button>
      </div>
    </div>

    <form onSubmit={event=>{event.preventDefault();if(!message.trim()||busy)return;void perform(async current=>{
      await apiFetch('/api/projects/'+encodeURIComponent(id)+'/feedbacks',{method:'POST',body:JSON.stringify({message:message.trim(),category:'general',clientVisible})});
      if(!current())return;await load();if(current())setMessage('');
    });}} className={card}>
      <label htmlFor="portal-note" className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"><MessageSquare size={16} className="text-blue-600"/>یادداشت مدیریت</label>
      <textarea id="portal-note" rows={3} disabled={busy} value={message} onChange={event=>setMessage(event.target.value)} placeholder="یادداشتی برای تیم، یا پیامی برای کارفرما بنویسید…" className={field}/>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"><input type="checkbox" checked={clientVisible} disabled={busy} onChange={event=>setClientVisible(event.target.checked)} className="w-4 h-4 accent-blue-600"/>کارفرما هم این یادداشت و پاسخ‌هایش را ببیند</label>
        <button type="submit" disabled={busy||!message.trim()} className={primary}><Send size={14}/>ثبت یادداشت</button>
      </div>
    </form>

    <div className="space-y-3">
      <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">بازخوردها و یادداشت‌ها</h3>
      {feedback.length===0&&<p className="text-xs text-slate-500 dark:text-slate-400 p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">هنوز بازخوردی ثبت نشده است.</p>}
      {feedback.map(item=><article key={item.id} className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-xs text-slate-800 dark:text-slate-100">{item.senderName||'بدون نام'}</p>
            <p className="text-[11px] text-slate-400">{formatJalaliDateTime(item.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusTone[item.status]||statusTone.pending}`}>{statusLabels[item.status]||item.status}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{item.clientVisible?'قابل مشاهده برای کارفرما':'داخلی'}</span>
          </div>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{item.message}</p>
        {(item.attachments||[]).length>0&&<div className="flex flex-wrap gap-2">{(item.attachments||[]).map((attachment:any,index:number)=>{const assetId=typeof attachment==='string'?attachment:attachment.id;return <button type="button" key={assetId} disabled={busy} onClick={()=>perform(async current=>{const response=await apiFetch('/api/files/'+encodeURIComponent(assetId));const asset=await response.json();if(current())await downloadAsset(asset);})} className={secondary}><Paperclip size={13}/>{typeof attachment==='object'&&attachment.name?attachment.name:`پیوست ${(index+1).toLocaleString('fa-IR')}`}</button>;})}</div>}
        {(item.replies||[]).length>0&&<ul className="space-y-1.5 border-r-2 border-blue-200 dark:border-blue-900 pr-3">{(item.replies||[]).map((reply:any)=><li key={reply.id} className="text-xs text-slate-700 dark:text-slate-200"><span className="font-bold">{reply.senderName}</span> <span className="text-slate-400">· {formatJalaliDateTime(reply.createdAt)}</span><p className="mt-0.5 whitespace-pre-wrap">{reply.message}</p></li>)}</ul>}
        <div className="flex flex-wrap gap-2">
          <input aria-label={`پاسخ به ${item.senderName||'بازخورد'}`} placeholder="پاسخ به کارفرما…" disabled={busy} value={replies[item.id]||''} onChange={event=>setReplies(previous=>({...previous,[item.id]:event.target.value}))} className={`${field} flex-1 min-w-[200px]`}/>
          <button type="button" disabled={busy||!replies[item.id]?.trim()} onClick={()=>updateFeedback(item,item.status)} className={primary}><Send size={14}/>ارسال پاسخ</button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-400 ml-1">تغییر وضعیت:</span>
          {Object.entries(statusLabels).map(([status,label])=><button type="button" key={status} disabled={busy||status===item.status} aria-pressed={status===item.status} onClick={()=>updateFeedback(item,status)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer disabled:cursor-default ${status===item.status?'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300':'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>{label}</button>)}
          <button type="button" disabled={busy} onClick={()=>{if(window.confirm('این بازخورد حذف شود؟'))void perform(async current=>{await apiFetch('/api/projects/'+encodeURIComponent(id)+'/feedbacks/'+encodeURIComponent(item.id),{method:'DELETE'});if(current())await load();});}} className={`${danger} mr-auto h-7`}><Trash2 size={13}/>حذف</button>
        </div>
        {(item.history||[]).length>0&&<details className="text-[11px] text-slate-500"><summary className="cursor-pointer select-none">تاریخچه ({(item.history||[]).length.toLocaleString('fa-IR')})</summary><ul className="mt-1.5 space-y-1">{(item.history||[]).map((entry:any,index:number)=><li key={entry.id||index}>{formatJalaliDateTime(entry.createdAt)} — {feedbackEventText(entry)}{entry.actorName?' — '+entry.actorName:''}</li>)}</ul></details>}
      </article>)}
    </div>

    {preview&&<div className="fixed inset-0 z-50 overflow-y-auto bg-white dark:bg-slate-950" role="dialog" aria-modal="true" aria-label="پیش‌نمایش پورتال کارفرما"><PublicClientPortal tokenParam={token} projectIdParam={id} isPreview onClosePreview={()=>setPreview(false)}/></div>}
  </section>;
};
