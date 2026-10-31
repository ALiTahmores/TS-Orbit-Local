import { getSocket } from '../../lib/socket';
import React, { useEffect, useRef, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useProject } from '../../context/ProjectContext';
import { formatJalaliDate } from '../../lib/dates';
import { JalaliDateInput } from '../common/JalaliDateInput';
import { TeamChecklistPanel } from './TeamChecklistPanel';

const boards = {
  'wordpress-checklist': {label:'چک‌لیست وردپرس',title:'name',statuses:['pending','inprogress','completed','blocked'],categories:['hosting','domain','dns','cloudflare','wp_install','security','performance','development','testing']},
  'seo-checklist': {label:'چک‌لیست سئو',title:'name',statuses:['pending','inprogress','completed'],categories:['technical','on_page','schema','internal_links','search_console','analytics','keywords','audit']},
  'content-center': {label:'تولید محتوا',title:'pageName',statuses:['received','writing','review','approved','published'],categories:[]},
  'qa-bugs': {label:'کنترل کیفیت',title:'title',statuses:['pending','inprogress','fixed','verified','reopened'],categories:['responsive','forms','checkout','performance','browser','security','accessibility']},
};
type Board = keyof typeof boards;

// Stored values stay in English; people see these labels.
const LABELS: Record<string,string> = {
  pending:'در انتظار',inprogress:'در حال انجام',completed:'انجام‌شده',blocked:'متوقف',received:'دریافت‌شده',writing:'در حال نگارش',review:'در حال بازبینی',approved:'تأییدشده',published:'منتشرشده',fixed:'رفع‌شده',verified:'تأییدشده',reopened:'دوباره باز شده',rejected:'ردشده',none:'نیاز به تأیید ندارد',
  hosting:'هاست',domain:'دامنه',dns:'DNS',cloudflare:'Cloudflare',wp_install:'نصب وردپرس',security:'امنیت',performance:'سرعت و کارایی',development:'توسعه',testing:'تست',
  technical:'سئوی فنی',on_page:'سئوی داخلی',schema:'اسکیما',internal_links:'لینک‌سازی داخلی',search_console:'سرچ کنسول',analytics:'آنالیتیکس',keywords:'کلمات کلیدی',audit:'ممیزی',
  responsive:'نمایش در موبایل',forms:'فرم‌ها',checkout:'پرداخت',browser:'سازگاری مرورگر',accessibility:'دسترس‌پذیری',
  low:'پایین',medium:'متوسط',high:'بالا',critical:'فوری',minor:'جزئی',major:'مهم',blocker:'مانع انتشار',
};
const label=(value?:string)=>value?LABELS[value]||value:'';
const DONE=new Set(['completed','published','verified','approved','fixed']);
const field='w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500';
const fieldLabel='block text-[11px] font-bold text-slate-500 dark:text-slate-400 space-y-1';

type Tab = 'team-roadmap' | Board;
const TABS:[Tab,string][]=[['team-roadmap','چک‌لیست تیم'],...Object.entries(boards).map(([key,item]):[Tab,string]=>[key as Board,item.label])];

/** The first tab is the project's team checklist, shared with the roadmap page; the others are workspace boards. */
export const DeliveryBoards:React.FC = () => {
  const [tab,setTab]=useState<Tab>('team-roadmap');
  return <section className="space-y-4">
    <nav className="tab-scroller gap-2" aria-label="بخش‌های تحویل">{TABS.map(([key,text])=><button type="button" key={key} aria-pressed={tab===key} onClick={()=>setTab(key)} className={`shrink-0 h-9 px-4 rounded-xl text-xs font-bold transition-colors cursor-pointer ${tab===key?'bg-blue-600 text-white':'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>{text}</button>)}</nav>
    {tab==='team-roadmap'?<ProjectChecklist/>:<BoardView key={tab} board={tab}/>}
  </section>;
};

const ProjectChecklist:React.FC = () => {
  const { projects,selectedProject }=useProject();
  const [projectId,setProjectId]=useState('');
  const project=projects.find(row=>row.id===(projectId||selectedProject?.id))||projects[0];
  if(!project)return <p className="text-xs text-slate-500 dark:text-slate-400 p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">هنوز پروژه‌ای ثبت نشده است.</p>;
  return <div className="space-y-4">
    <label className={`${fieldLabel} w-full sm:w-64`}>پروژه<select aria-label="پروژهٔ چک‌لیست" value={project.id} onChange={event=>setProjectId(event.target.value)} className={field}>{projects.map(row=><option key={row.id} value={row.id}>{row.title}</option>)}</select></label>
    <TeamChecklistPanel project={project}/>
  </div>;
};

/** All edits are committed through the API, including approval and QA transitions. */
const BoardView:React.FC<{board:Board}> = ({board}) => {
  const { projects,teamMembers,activeWorkspaceId }=useProject();
  const [rows,setRows]=useState<any[]>([]);
  const [projectId,setProjectId]=useState('');
  const [editingId,setEditingId]=useState<string|null>(null);
  const [form,setForm]=useState<Record<string,any>>({});
  const [formOpen,setFormOpen]=useState(false);
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const viewKey=board+':'+activeWorkspaceId;
  const view=useRef({key:viewKey,version:0});
  if(view.current.key!==viewKey) view.current={key:viewKey,version:view.current.version+1};
  useEffect(()=>()=>{view.current.version++;},[]);
  const definition=boards[board];
  const isContent=board==='content-center', isQa=board==='qa-bugs';
  const load=async()=>{
    const version=view.current.version;
    if(view.current.key!==viewKey)return false;
    const response=await apiFetch('/api/'+board),rows=await response.json();
    if(view.current.key!==viewKey || view.current.version!==version)return false;
    setRows(rows);return true;
  };
  useEffect(()=>{setProjectId('');setRows([]);setEditingId(null);setForm({});setFormOpen(false);setError('');void load().catch(()=>{});},[board,activeWorkspaceId]);
  useEffect(()=>{const socket=getSocket();const event=({'wordpress-checklist':'wordpressChecklist_updated','seo-checklist':'seoChecklist_updated','content-center':'contentCenter_updated','qa-bugs':'qaBugs_updated'})[board];const refresh=()=>{void load().catch(()=>{});};socket?.on(event,refresh);socket?.on('connect',refresh);return()=>{socket?.off(event,refresh);socket?.off('connect',refresh);};},[board,activeWorkspaceId]);
  const update=(field:string,value:any)=>setForm(previous=>({...previous,[field]:value}));
  const reset=()=>{setEditingId(null);setForm({});setFormOpen(false);};
  const save=async(event:React.FormEvent)=>{
    event.preventDefault();setSaving(true);setError('');
    try {
      const payload={...form,projectId:form.projectId || projectId || null};
      await apiFetch('/api/'+board+(editingId?'/'+editingId:''),{method:editingId?'PUT':'POST',body:JSON.stringify(payload)});
      if(await load())reset();
    } catch(error) {setError(error instanceof Error?error.message:'ذخیره انجام نشد.');}
    finally {setSaving(false);}
  };
  const remove=async(row:any)=>{
    if(!window.confirm(`«${row[definition.title]||'این مورد'}» حذف شود؟`))return;
    setError('');try {await apiFetch('/api/'+board+'/'+row.id,{method:'DELETE'});if(await load() && editingId===row.id)reset();}
    catch(error){setError(error instanceof Error?error.message:'حذف انجام نشد.');}
  };
  const edit=(row:any)=>{
    const fields=isContent?['projectId','pageName','writerId','reviewerId','deadline','status','approvalStatus','contentBody']:isQa?['projectId','title','description','category','priority','severity','assigneeId','status','fixVersion']:['projectId','name','category','ownerId','assigneeId','dueDate','notes','priority','status','progress'];
    setForm(Object.fromEntries(fields.filter(field=>row[field]!==undefined).map(field=>[field,row[field]])));setEditingId(row.id);setFormOpen(true);
  };
  const select=(name:string,text:string,options:string[]) => <label className={fieldLabel}>{text}<select aria-label={text} value={form[name] ?? ''} onChange={event=>update(name,event.target.value)} className={field}><option value="">انتخاب کنید</option>{options.map(value=><option key={value} value={value}>{label(value)}</option>)}</select></label>;
  const member=(name:string,text:string)=><label className={fieldLabel}>{text}<select aria-label={text} value={form[name] || ''} onChange={event=>update(name,event.target.value || null)} className={field}><option value="">تعیین نشده</option>{teamMembers.map(person=><option key={person.id} value={(person as any).userId || person.id}>{person.name}</option>)}</select></label>;
  const input=(name:string,text:string,type='text')=>type==='date'
    ? <div className={fieldLabel}><span>{text}</span><JalaliDateInput value={/^\d{4}-\d{2}-\d{2}/.test(form[name]||'')?String(form[name]).slice(0,10):''} onChange={value=>update(name,value)} ariaLabel={text} placeholder="بدون سررسید"/></div>
    : <label className={fieldLabel}>{text}<input aria-label={text} type={type} min={type==='number'?0:undefined} max={type==='number'?100:undefined} value={form[name] ?? ''} onChange={event=>update(name,type==='number'?Number(event.target.value):event.target.value)} className={field}/></label>;
  const memberName=(id?:string)=>id?teamMembers.find(person=>((person as any).userId||person.id)===id)?.name||'':'';
  const visible=rows.filter(row=>!projectId || row.projectId===projectId);
  const done=visible.filter(row=>DONE.has(row.status)).length;

  return <div className="space-y-4">
    {error && <p role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold">{error}</p>}

    <div className="flex flex-wrap items-end justify-between gap-3">
      <label className={`${fieldLabel} w-60`}>پروژه<select aria-label="فیلتر پروژه" value={projectId} onChange={event=>setProjectId(event.target.value)} className={field}><option value="">همهٔ پروژه‌ها</option>{projects.map(project=><option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">{`${done.toLocaleString('fa-IR')} از ${visible.length.toLocaleString('fa-IR')} مورد انجام شده`}</span>
        {!formOpen&&<button type="button" onClick={()=>{setEditingId(null);setForm({});setFormOpen(true);}} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"><Plus size={14}/>مورد جدید</button>}
      </div>
    </div>

    {formOpen&&<form onSubmit={save} className="grid md:grid-cols-3 gap-3 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <h3 className="md:col-span-3 font-black text-sm text-slate-900 dark:text-white">{editingId?'ویرایش مورد':'مورد جدید'} — {definition.label}</h3>
      {input(definition.title,isContent?'نام صفحه':isQa?'عنوان خطا':'عنوان')}
      <label className={fieldLabel}>پروژه<select aria-label="پروژهٔ مورد" value={form.projectId ?? projectId} onChange={event=>update('projectId',event.target.value || null)} className={field}><option value="">بدون پروژه</option>{projects.map(project=><option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
      {select('status','وضعیت',definition.statuses)}
      {!isContent && select('category','دسته‌بندی',definition.categories)}
      {!isContent && select('priority','اولویت',['low','medium','high','critical'])}
      {isContent? <>{member('writerId','نویسنده')}{member('reviewerId','بازبین')}{select('approvalStatus','وضعیت تأیید',['none','pending','approved','rejected'])}{input('deadline','سررسید','date')}</>:member(isQa?'assigneeId':'ownerId','مسئول')}
      {isQa?<>{select('severity','شدت',['minor','major','critical','blocker'])}{input('fixVersion','نسخهٔ رفع')}</>:!isContent?<>{input('dueDate','سررسید','date')}{input('progress','پیشرفت (٪)','number')}</>:null}
      <label className={`${fieldLabel} md:col-span-3`}>{isContent?'متن محتوا':'توضیحات'}<textarea aria-label={isContent?'متن محتوا':'توضیحات'} rows={3} value={form[isContent?'contentBody':isQa?'description':'notes'] || ''} onChange={event=>update(isContent?'contentBody':isQa?'description':'notes',event.target.value)} className={`${field} h-auto py-2`}/></label>
      <div className="md:col-span-3 flex justify-end gap-2"><button type="button" onClick={reset} className="h-9 px-4 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">انصراف</button><button disabled={saving} type="submit" className="h-9 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">{saving?'در حال ذخیره…':'ذخیره'}</button></div>
    </form>}

    <div className="space-y-2">
      {visible.length===0&&<p className="text-xs text-slate-500 dark:text-slate-400 p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">هنوز موردی در این بخش ثبت نشده است.</p>}
      {visible.map(row=>{
        const owner=row.owner||row.assignedTo||row.writer||memberName(row.ownerId||row.assigneeId||row.writerId);
        const due=formatJalaliDate(row.dueDate||row.deadline);
        return <article key={row.id} className="flex flex-wrap justify-between items-center gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="min-w-0 space-y-1.5">
            <h4 className={`font-bold text-sm ${DONE.has(row.status)?'text-slate-400 line-through':'text-slate-800 dark:text-slate-100'}`}>{row[definition.title]}</h4>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
              {row.status&&<span className={`px-2 py-0.5 rounded-full ${DONE.has(row.status)?'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300':row.status==='blocked'||row.status==='reopened'?'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300':'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'}`}>{label(row.status)}</span>}
              {row.category&&<span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{label(row.category)}</span>}
              {(row.severity||row.priority)&&<span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{label(row.severity||row.priority)}</span>}
              {owner&&<span className="text-slate-500 dark:text-slate-400">{owner}</span>}
              {due&&<span className="text-slate-500 dark:text-slate-400">سررسید {due}</span>}
            </div>
            {row.progress!==undefined&&!isContent&&!isQa&&<div className="flex items-center gap-2 w-48"><div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-blue-600 rounded-full" style={{width:`${Math.min(100,Number(row.progress)||0)}%`}}/></div><span className="text-[10px] text-slate-500">{(Number(row.progress)||0).toLocaleString('fa-IR')}٪</span></div>}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={()=>edit(row)} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"><Pencil size={13}/>ویرایش</button>
            <button type="button" onClick={()=>void remove(row)} aria-label={`حذف ${row[definition.title]||''}`} className="inline-flex items-center h-8 px-2.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"><Trash2 size={13}/></button>
          </div>
        </article>;
      })}
    </div>
  </div>;
};
