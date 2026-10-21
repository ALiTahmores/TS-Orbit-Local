import { getSocket } from '../../lib/socket';
import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useProject } from '../../context/ProjectContext';

const boards = {
  'wordpress-checklist': {label:'چک‌لیست وردپرس',title:'name',statuses:['pending','inprogress','completed','blocked'],categories:['hosting','domain','dns','cloudflare','wp_install','security','performance','development','testing']},
  'seo-checklist': {label:'چک‌لیست سئو',title:'name',statuses:['pending','inprogress','completed'],categories:['technical','on_page','schema','internal_links','search_console','analytics','keywords','audit']},
  'content-center': {label:'تولید محتوا',title:'pageName',statuses:['received','writing','review','approved','published'],categories:[]},
  'qa-bugs': {label:'کنترل کیفیت',title:'title',statuses:['pending','inprogress','fixed','verified','reopened'],categories:['responsive','forms','checkout','performance','browser','security','accessibility']},
};
type Board = keyof typeof boards;
/** All edits are committed through the API, including approval and QA transitions. */
export const DeliveryBoards:React.FC = () => {
  const { projects,teamMembers,activeWorkspaceId }=useProject();
  const [board,setBoard]=useState<Board>('wordpress-checklist');
  const [rows,setRows]=useState<any[]>([]);
  const [projectId,setProjectId]=useState('');
  const [editingId,setEditingId]=useState<string|null>(null);
  const [form,setForm]=useState<Record<string,any>>({});
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
  useEffect(()=>{setProjectId('');setRows([]);setEditingId(null);setForm({});setError('');void load().catch(()=>{});},[board,activeWorkspaceId]);
  useEffect(()=>{const socket=getSocket();const event=({'wordpress-checklist':'wordpressChecklist_updated','seo-checklist':'seoChecklist_updated','content-center':'contentCenter_updated','qa-bugs':'qaBugs_updated'})[board];const refresh=()=>{void load().catch(()=>{});};socket?.on(event,refresh);return()=>{socket?.off(event,refresh);};},[board,activeWorkspaceId]);
  const update=(field:string,value:any)=>setForm(previous=>({...previous,[field]:value}));
  const save=async(event:React.FormEvent)=>{
    event.preventDefault();setSaving(true);setError('');
    try {
      const payload={...form,projectId:form.projectId || projectId || null};
      await apiFetch('/api/'+board+(editingId?'/'+editingId:''),{method:editingId?'PUT':'POST',body:JSON.stringify(payload)});
      if(await load()){setForm({});setEditingId(null);}
    } catch(error) {setError(error instanceof Error?error.message:'ذخیره انجام نشد.');}
    finally {setSaving(false);}
  };
  const remove=async(id:string)=>{
    setError('');try {await apiFetch('/api/'+board+'/'+id,{method:'DELETE'});if(await load() && editingId===id){setEditingId(null);setForm({});}}
    catch(error){setError(error instanceof Error?error.message:'حذف انجام نشد.');}
  };
  const edit=(row:any)=>{
    const fields=isContent?['projectId','pageName','writerId','reviewerId','deadline','status','approvalStatus','contentBody']:isQa?['projectId','title','description','category','priority','severity','assigneeId','status','fixVersion']:['projectId','name','category','ownerId','assigneeId','dueDate','notes','priority','status','progress'];
    setForm(Object.fromEntries(fields.filter(field=>row[field]!==undefined).map(field=>[field,row[field]])));setEditingId(row.id);
  };
  const select=(field:string,label:string,options:string[]) => <label className="block text-xs">{label}<select aria-label={label} value={form[field] ?? ''} onChange={event=>update(field,event.target.value)} className="block w-full p-2 border rounded-lg dark:bg-slate-800"><option value="">انتخاب کنید</option>{options.map(value=><option key={value} value={value}>{value}</option>)}</select></label>;
  const member=(field:string,label:string)=><label className="block text-xs">{label}<select aria-label={label} value={form[field] || ''} onChange={event=>update(field,event.target.value || null)} className="block w-full p-2 border rounded-lg dark:bg-slate-800"><option value="">تعیین نشده</option>{teamMembers.map(person=><option key={person.id} value={(person as any).userId || person.id}>{person.name}</option>)}</select></label>;
  const input=(field:string,label:string,type='text')=><label className="block text-xs">{label}<input aria-label={label} type={type==='date' && form[field] && !/^\d{4}-\d{2}-\d{2}$/.test(form[field])?'text':type} value={form[field] ?? ''} onChange={event=>update(field,type==='number'?Number(event.target.value):event.target.value)} className="block w-full p-2 border rounded-lg dark:bg-slate-800"/></label>;
  return <section className="space-y-4" dir="rtl">
    <nav className="flex flex-wrap gap-2">{Object.entries(boards).map(([key,item])=><button type="button" key={key} onClick={()=>setBoard(key as Board)} className={'px-4 py-2 rounded-xl text-xs '+(board===key?'bg-blue-600 text-white':'bg-slate-100 dark:bg-slate-800')}>{item.label}</button>)}</nav>
    {error && <p role="alert" className="p-3 text-red-600">{error}</p>}
    <label className="block text-xs">فیلتر پروژه<select aria-label="Board project filter" value={projectId} onChange={event=>setProjectId(event.target.value)} className="block p-2 border rounded-lg dark:bg-slate-800"><option value="">تمام فضای کاری</option>{projects.map(project=><option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
    <form onSubmit={save} className="grid md:grid-cols-3 gap-3 p-5 border rounded-2xl bg-white dark:bg-slate-900">
      <h3 className="md:col-span-3 font-bold text-sm">{editingId?'ویرایش':'ایجاد'} {definition.label}</h3>
      {input(definition.title,isContent?'نام صفحه':isQa?'عنوان باگ':'نام مورد')}
      <label className="block text-xs">پروژه<select aria-label="Record project" value={form.projectId ?? projectId} onChange={event=>update('projectId',event.target.value || null)} className="block w-full p-2 border rounded-lg dark:bg-slate-800"><option value="">عمومی در فضای کاری</option>{projects.map(project=><option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
      {select('status','وضعیت',definition.statuses)}
      {!isContent && select('category','دسته‌بندی',definition.categories)}
      {!isContent && select('priority','اولویت',['low','medium','high','critical'])}
      {isContent? <>{member('writerId','نویسنده')}{member('reviewerId','بازبین')}{select('approvalStatus','وضعیت تأیید',['none','pending','approved','rejected'])}{input('deadline','سررسید','date')}</>:member(isQa?'assigneeId':'ownerId','مسئول')}
      {isQa?<>{select('severity','شدت',['minor','major','critical','blocker'])}{input('fixVersion','نسخه رفع')}</>:!isContent?<>{input('dueDate','سررسید','date')}{input('progress','پیشرفت','number')}</>:null}
      <label className="block text-xs md:col-span-3">{isContent?'متن محتوا':'توضیحات'}<textarea aria-label="Record details" value={form[isContent?'contentBody':isQa?'description':'notes'] || ''} onChange={event=>update(isContent?'contentBody':isQa?'description':'notes',event.target.value)} className="block w-full p-2 border rounded-lg dark:bg-slate-800"/></label>
      <div className="flex gap-2"><button disabled={saving} type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs">ذخیره</button><button type="button" onClick={()=>{setEditingId(null);setForm({});}} className="px-4 py-2 text-xs">پاک‌کردن فرم</button></div>
    </form>
    <div className="space-y-2">{rows.filter(row=>!projectId || row.projectId===projectId).map(row=><article key={row.id} className="flex flex-wrap justify-between items-center gap-3 p-4 border rounded-xl bg-white dark:bg-slate-900"><div><h4 className="font-bold text-xs">{row[definition.title]}</h4><p className="text-xs text-slate-500">{row.status} {row.progress!==undefined?`— ${row.progress}%`:''} — {row.owner || row.assignedTo || row.writer || ''}</p></div><div><button type="button" onClick={()=>edit(row)} className="px-3 py-2 text-blue-600 text-xs">ویرایش</button><button type="button" onClick={()=>remove(row.id)} className="px-3 py-2 text-red-600 text-xs">حذف</button></div></article>)}</div>
  </section>;
};
