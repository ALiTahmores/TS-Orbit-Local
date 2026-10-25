import React,{useEffect,useRef,useState} from 'react';
import {Download,Eye,FileText,History,Search,Trash2,UploadCloud,X} from 'lucide-react';
import {apiFetch} from '../../lib/api';
import {downloadAsset,uploadAsset,canPreviewAsset,type ManagedAsset} from '../../lib/assets';
import {formatJalaliDateTime} from '../../lib/dates';
import {AssetImagePreview} from './AssetImagePreview';
import {useProject} from '../../context/ProjectContext';
import {getSocket} from '../../lib/socket';

const CATEGORIES:[string,string][]=[['general','عمومی'],['documents','اسناد'],['design','طراحی'],['images','تصاویر'],['contracts','قراردادها'],['content','محتوا'],['seo','سئو'],['dev','فنی']];
const categoryLabel=(value?:string)=>CATEGORIES.find(([key])=>key===value)?.[1]||value||'عمومی';
/** "۲٫۴ مگابایت" from a byte count. */
export const formatBytes=(bytes?:number)=>{
  if(bytes===undefined||bytes===null||Number.isNaN(Number(bytes)))return '';
  const units=['بایت','کیلوبایت','مگابایت','گیگابایت'];let value=Number(bytes),unit=0;
  while(value>=1024&&unit<units.length-1){value/=1024;unit++;}
  return `${value.toLocaleString('fa-IR',{maximumFractionDigits:unit?1:0})} ${units[unit]}`;
};
const field='w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 disabled:opacity-60';
const iconButton='inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

interface AssetManagerProps {projectId?:string;taskId?:string;personal?:boolean;compact?:boolean;assetId?:string}
export const AssetManager:React.FC<AssetManagerProps> = props=>{
  const {activeWorkspaceId,currentUser}=useProject();
  return <AssetManagerView key={JSON.stringify([activeWorkspaceId,currentUser?.id,props.projectId,props.taskId,props.personal,props.assetId])} {...props}/>;
};
const AssetManagerView:React.FC<AssetManagerProps> = ({projectId,taskId,personal=false,compact=false,assetId})=>{
  const {activeWorkspaceId,currentUser,tasks}=useProject();
  const [assets,setAssets]=useState<ManagedAsset[]>([]),[file,setFile]=useState<File|null>(null),[name,setName]=useState(''),[category,setCategory]=useState('general'),[tag,setTag]=useState('');
  const [search,setSearch]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[dragging,setDragging]=useState(false);
  const [preview,setPreview]=useState<ManagedAsset|null>(null);
  const [selected,setSelected]=useState<ManagedAsset|null>(null),[versions,setVersions]=useState<any[]>([]),[versionsError,setVersionsError]=useState(''),[loading,setLoading]=useState(true);
  const input=useRef<HTMLInputElement>(null),versionInput=useRef<HTMLInputElement>(null),view=useRef(0),selection=useRef(0),loadSequence=useRef(0);
  const load=async()=>{const generation=view.current,request=++loadSequence.current;const response=await apiFetch('/api/files');const rows=await response.json();if(!Array.isArray(rows))throw new Error('فهرست فایل‌ها دریافت نشد.');if(generation===view.current&&request===loadSequence.current){setAssets(rows);setSelected(previous=>rows.find((row:ManagedAsset)=>row.id===previous?.id)||null);setLoading(false);}};
  useEffect(()=>{const generation=++view.current;const failure=(error:Error)=>{if(generation===view.current){setError(error.message);setLoading(false);}};void load().catch(failure);const refresh=()=>{void load().catch(failure);};window.addEventListener('orbit:assets-updated',refresh);const socket=getSocket();socket?.on('app_files_updated',refresh);socket?.on('connect',refresh);return()=>{view.current++;window.removeEventListener('orbit:assets-updated',refresh);socket?.off('app_files_updated',refresh);socket?.off('connect',refresh);};},[activeWorkspaceId,currentUser?.id,projectId,taskId,personal,assetId]);
  useEffect(()=>{const revision=++selection.current;setVersions([]);setVersionsError('');if(!selected)return;const id=selected.id,generation=view.current;apiFetch('/api/files/'+encodeURIComponent(id)+'/versions').then(response=>response.json()).then(rows=>{if(generation===view.current&&revision===selection.current)setVersions(rows);}).catch(error=>{if(generation===view.current&&revision===selection.current)setVersionsError(error.message);});return()=>{selection.current++;};},[selected?.id,selected?.version]);
  const perform=async(operation:(current:()=>boolean)=>Promise<void>)=>{const generation=view.current;const current=()=>generation===view.current;setError('');setStatus('');setBusy(true);try{await operation(current);}catch(error){if(current())setError(error instanceof Error?error.message:'عملیات انجام نشد.');}finally{if(current())setBusy(false);}};
  const choose=(chosen:File|null)=>{setFile(chosen);setName(chosen?.name||'');};
  const upload=async(event:React.FormEvent)=>{event.preventDefault();if(!file||busy)return;await perform(async current=>{await uploadAsset(file,{name:name.trim()||file.name,projectId,taskId,category,tag});if(!current())return;await load();if(!current())return;choose(null);if(input.current)input.current.value='';setStatus('فایل بارگذاری شد.');});};
  const change=async(asset:ManagedAsset,updates:Record<string,any>)=>perform(async current=>{await apiFetch('/api/files/'+encodeURIComponent(asset.id),{method:'PUT',body:JSON.stringify(updates)});if(!current())return;await load();if(current())window.dispatchEvent(new Event('orbit:assets-updated'));});
  const remove=async(asset:ManagedAsset)=>{if(!window.confirm(`فایل «${asset.name}» حذف شود؟`))return;await perform(async current=>{await apiFetch('/api/files/'+encodeURIComponent(asset.id),{method:'DELETE'});if(!current())return;await load();if(!current())return;window.dispatchEvent(new Event('orbit:assets-updated'));setStatus('فایل حذف شد.');});};
  const taskAttachmentIds=new Set((tasks.find(task=>task.id===taskId)?.attachments||[]).map((attachment:any)=>typeof attachment==='string'?attachment:attachment.id));
  const rows=assets.filter(asset=>(!assetId||asset.id===assetId)&&(!projectId||asset.projectId===projectId)&&(!taskId||asset.taskId===taskId||taskAttachmentIds.has(asset.id))&&(!personal||(asset.uploadedBy?.id||asset.uploadedById)===currentUser?.id)&&asset.name.toLowerCase().includes(search.toLowerCase()));
  const sizeOf=(asset:any)=>formatBytes(asset.byteSize)||asset.formattedSize||'';
  const meta=(asset:any)=>[sizeOf(asset),asset.version?`نسخهٔ ${Number(asset.version).toLocaleString('fa-IR')}`:'',categoryLabel(asset.category),asset.uploadedBy?.name,formatJalaliDateTime(asset.updatedAt||asset.createdAt)].filter(Boolean).join(' • ');

  return <section className="space-y-4" dir="rtl" aria-label="مدیریت فایل‌ها">
    {preview&&<AssetImagePreview asset={preview} onClose={()=>setPreview(null)}/>}
    {!compact&&<h2 className="font-black text-lg text-slate-900 dark:text-white">{personal?'فایل‌های من':'فایل‌ها'}</h2>}
    {error&&<p role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold">{error}</p>}
    {status&&<p role="status" className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold">{status}</p>}

    {!assetId&&<form onSubmit={upload} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
      <div
        onDragOver={event=>{event.preventDefault();setDragging(true);}}
        onDragLeave={()=>setDragging(false)}
        onDrop={event=>{event.preventDefault();setDragging(false);const dropped=event.dataTransfer.files?.[0];if(dropped&&!busy)choose(dropped);}}
        className={`flex flex-col sm:flex-row items-center gap-3 p-4 rounded-xl border-2 border-dashed transition-colors ${dragging?'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30':'border-slate-200 dark:border-slate-700'}`}
      >
        <UploadCloud size={26} className="text-blue-500 shrink-0"/>
        <div className="flex-1 text-center sm:text-right min-w-0">
          {file?<><p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" dir="auto">{file.name}</p><p className="text-[11px] text-slate-500">{formatBytes(file.size)}</p></>
            :<p className="text-xs text-slate-500 dark:text-slate-400">فایل را اینجا رها کنید یا از رایانه انتخاب کنید.</p>}
        </div>
        <input ref={input} id={`file-input-${projectId||taskId||'personal'}`} aria-label="انتخاب فایل" type="file" disabled={busy} onChange={event=>choose(event.target.files?.[0]||null)} className="sr-only"/>
        <button type="button" disabled={busy} onClick={()=>input.current?.click()} className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer shrink-0">{file?'تغییر فایل':'انتخاب فایل'}</button>
      </div>
      {file&&<div className="grid sm:grid-cols-3 gap-3">
        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 space-y-1">نام فایل<input aria-label="نام فایل" value={name} onChange={event=>setName(event.target.value)} className={field}/></label>
        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 space-y-1">دسته‌بندی<select aria-label="دسته‌بندی فایل" value={category} onChange={event=>setCategory(event.target.value)} className={field}>{CATEGORIES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 space-y-1">برچسب (اختیاری)<input aria-label="برچسب فایل" value={tag} onChange={event=>setTag(event.target.value)} className={field}/></label>
      </div>}
      {file&&<div className="flex justify-end gap-2">
        <button type="button" disabled={busy} onClick={()=>{choose(null);if(input.current)input.current.value='';}} className="h-9 px-4 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">انصراف</button>
        <button type="submit" disabled={busy} className="h-9 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">{busy?'در حال بارگذاری…':'بارگذاری فایل'}</button>
      </div>}
    </form>}

    {!assetId&&<div className="relative">
      <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
      <input type="search" aria-label="جستجوی فایل" value={search} onChange={event=>setSearch(event.target.value)} placeholder="جستجو در نام فایل‌ها…" className={`${field} pr-9`}/>
    </div>}

    <div className="space-y-2">
      {loading?<p role="status" className="text-xs text-slate-500">در حال دریافت فایل‌ها…</p>:!rows.length&&<p className="text-xs text-slate-500 dark:text-slate-400 p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">{search?'فایلی با این نام پیدا نشد.':'هنوز فایلی در این بخش بارگذاری نشده است.'}</p>}
      {rows.map(asset=><article key={asset.id} className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0"><FileText size={17}/></div>
            <div className="min-w-0"><h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate" dir="auto">{asset.name}</h3><p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{meta(asset)}</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {canPreviewAsset(asset)&&<button type="button" disabled={busy} onClick={()=>setPreview(asset)} className={`${iconButton} text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800`}><Eye size={14}/>پیش‌نمایش</button>}
            <button type="button" disabled={busy||asset.contentAvailable===false} onClick={()=>perform(()=>downloadAsset(asset))} className={`${iconButton} text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40`}><Download size={14}/>دانلود</button>
            <button type="button" onClick={()=>setSelected(asset)} className={`${iconButton} text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800`}><History size={14}/>جزئیات و نسخه‌ها</button>
            <button type="button" disabled={busy} onClick={()=>void remove(asset)} aria-label={`حذف ${asset.name}`} className={`${iconButton} text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40`}><Trash2 size={14}/></button>
          </div>
        </div>
        {asset.contentAvailable===false&&<p className="text-[11px] text-amber-700 dark:text-amber-400">محتوای این فایل در دسترس نیست؛ از «جزئیات و نسخه‌ها» نسخهٔ جدیدی بارگذاری کنید.</p>}
        <div className="flex flex-wrap gap-4 pt-1 border-t border-slate-100 dark:border-slate-800">
          <label className="inline-flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer pt-2"><input type="checkbox" className="w-4 h-4 accent-blue-600" checked={asset.approved===true} disabled={busy} onChange={event=>change(asset,{approved:event.target.checked})}/>تأییدشده</label>
          <label className="inline-flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer pt-2"><input type="checkbox" className="w-4 h-4 accent-blue-600" checked={asset.clientVisible===true} disabled={busy} onChange={event=>change(asset,{clientVisible:event.target.checked})}/>نمایش در پورتال کارفرما {asset.clientVisible&&!asset.approved?<span className="text-amber-600">(پس از تأیید)</span>:null}</label>
        </div>
      </article>)}
    </div>

    {selected&&<div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="جزئیات و نسخه‌های فایل">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/60" onClick={()=>setSelected(null)}/>
      <div className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl space-y-4">
        <div className="flex items-center justify-between gap-3"><h3 className="font-black text-sm text-slate-900 dark:text-white truncate" dir="auto">{selected.name}</h3><button type="button" onClick={()=>setSelected(null)} aria-label="بستن" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><X size={16}/></button></div>
        <form key={selected.id+':'+selected.name+':'+selected.category+':'+selected.tag} onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);void change(selected,{name:String(data.get('name')||'').trim(),category:String(data.get('category')||''),tag:String(data.get('tag')||'')});}} className="grid sm:grid-cols-3 gap-3">
          <label className="sm:col-span-3 text-[11px] font-bold text-slate-500 space-y-1">نام<input name="name" aria-label="ویرایش نام فایل" required defaultValue={selected.name} className={field}/></label>
          <label className="text-[11px] font-bold text-slate-500 space-y-1">دسته‌بندی<select name="category" aria-label="ویرایش دسته فایل" defaultValue={selected.category||'general'} className={field}>{CATEGORIES.map(([value,label])=><option key={value} value={value}>{label}</option>)}{selected.category&&!CATEGORIES.some(([value])=>value===selected.category)&&<option value={selected.category}>{selected.category}</option>}</select></label>
          <label className="sm:col-span-2 text-[11px] font-bold text-slate-500 space-y-1">برچسب<input name="tag" aria-label="ویرایش برچسب فایل" defaultValue={selected.tag||''} className={field}/></label>
          <div className="sm:col-span-3 flex justify-end"><button disabled={busy} className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">ذخیرهٔ مشخصات</button></div>
        </form>
        <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">نسخه‌ها</h4>
            <input ref={versionInput} aria-label="بارگذاری نسخهٔ جدید" type="file" disabled={busy} className="sr-only" onChange={event=>{const element=event.target,chosen=element.files?.[0];if(chosen)void perform(async current=>{await uploadAsset(chosen,{note:'نسخه جدید'},selected.id);if(!current())return;await load();if(current()){element.value='';setStatus('نسخهٔ جدید بارگذاری شد.');}});}}/>
            <button type="button" disabled={busy} onClick={()=>versionInput.current?.click()} className={`${iconButton} border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800`}><UploadCloud size={14}/>بارگذاری نسخهٔ جدید</button>
          </div>
          {versionsError&&<p role="alert" className="text-xs text-rose-600">{versionsError}</p>}
          {versions.map(version=><div key={version.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-[11px]">
            <span className="text-slate-600 dark:text-slate-300">{[`نسخهٔ ${Number(version.version).toLocaleString('fa-IR')}`,formatBytes(version.byteSize)||version.size,version.uploadedBy?.name,formatJalaliDateTime(version.createdAt)].filter(Boolean).join(' • ')}</span>
            <button type="button" disabled={busy||version.contentAvailable===false} onClick={()=>perform(()=>downloadAsset({...selected,name:version.name||selected.name,contentAvailable:version.contentAvailable},version.id))} className={`${iconButton} text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 shrink-0`}><Download size={13}/>دانلود</button>
          </div>)}
        </div>
        {selected.sha256&&<details className="text-[11px] text-slate-500"><summary className="cursor-pointer select-none">شناسهٔ محتوا (برای بررسی سلامت فایل)</summary><code dir="ltr" className="block mt-1.5 break-all">{selected.sha256}</code></details>}
      </div>
    </div>}
  </section>;
};
