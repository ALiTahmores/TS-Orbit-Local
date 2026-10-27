import { formatJalaliDateTime } from '../../lib/dates';
import {AssetManager} from '../assets/AssetManager';
import { assignedIds, taskStatus, taskPriority } from '../../lib/domain';
import { LocalImage } from '../common/LocalImage';
import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  CheckCircle2, 
  Circle, 
  Calendar, 
  Clock, 
  Tag, 
  User, 
  MessageSquare, 
  Paperclip, 
  Send, 
  Trash2, 
  Plus, 
  Save, 
  ChevronRight, 
  Briefcase,
  AlertTriangle,
  FileText,
  Sliders,
  Share2
} from 'lucide-react';
import { useProjectContext } from '../../context/ProjectContext';
import { Task, SubTask, TaskPriority, TaskStatus, DepartmentKey } from '../../types';
import { cn } from '../../lib/utils';
import { JalaliDateInput } from '../common/JalaliDateInput';
import { dueDate as canonicalDueDate } from '../../lib/taskAnalytics';
import { deadlineEditPatch } from '../../lib/formValues';

const toPersianDigits = (n: string | number): string => {
  if (n === undefined || n === null) return '';
  return n.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)] || '۰');
};

interface TaskFullManageViewProps {
  taskId: string;
  onBack: () => void;
}

export const TaskFullManageView: React.FC<TaskFullManageViewProps> = ({
  taskId,
  onBack
}) => {
  const { 
    tasks, 
    projects, 
    teamMembers, 
    currentUser, 
    updateTask, 
    updateTaskStatus, 
    deleteTask, 
    addTaskComment,
    addTaskTimeEntry, 
    locale 
  } = useProjectContext();

  const isRtl = locale !== 'en';
  const task = tasks.find(t => t.id === taskId);

  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState<string>(taskStatus(task?.status || 'pending'));
  const [priority, setPriority] = useState<string>(taskPriority(task?.priority || 'medium'));
  const [dueDate, setDueDate] = useState(canonicalDueDate(task) || '');
  const [deadlineChanged, setDeadlineChanged] = useState(false);
  const [estimatedHours, setEstimatedHours] = useState(String(task?.estimatedHours || 0));
  const [entryHours, setEntryHours] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>(assignedIds(task));
  const [dependencies, setDependencies] = useState<string[]>(task?.dependencies || []);
  const [linksText, setLinksText] = useState((task?.links || []).join('\n'));
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setTitle(task?.title || ''); setDescription(task?.description || '');
    setStatus(taskStatus(task?.status || 'pending')); setPriority(taskPriority(task?.priority || 'medium'));
    setDueDate(canonicalDueDate(task) || ''); setDeadlineChanged(false); setEstimatedHours(String(task?.estimatedHours || 0));
    setSubtasks(task?.subtasks || []); setMemberIds(assignedIds(task)); setDependencies(task?.dependencies || []); setLinksText((task?.links || []).join('\n'));
  },[task?.id]);
  const [subtasks, setSubtasks] = useState<SubTask[]>(task?.subtasks || []);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newComment, setNewComment] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  if (!task) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">
          {isRtl ? 'وظیفه مورد نظر یافت نشد.' : 'Task not found.'}
        </h3>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
        >
          {isRtl ? 'بازگشت به لیست وظایف' : 'Back to Tasks'}
        </button>
      </div>
    );
  }

  const project = projects.find(p => p.id === task.projectId);

  const handleSave = async () => {
    if(saving) return;
    setSaving(true); setSaveError(''); setIsSaved(false);
    try {
      const saved = await updateTask(task.id, {title,description,status,priority,
        ...deadlineEditPatch(dueDate, deadlineChanged),
        estimatedHours:Number(estimatedHours),subtasks,assignedMemberIds:memberIds,dependencies,
        links:linksText.split('\n').map(link=>link.trim()).filter(Boolean)});
      setSubtasks(saved.subtasks || []);
      setStatus(taskStatus(saved.status));setPriority(taskPriority(saved.priority));
      setDeadlineChanged(false);
      setIsSaved(true);
    } catch(error) { setSaveError(error instanceof Error ? error.message : 'ذخیره انجام نشد.'); }
    finally { setSaving(false); }
  };
  const handleTimeEntry = async (event:React.FormEvent) => {
    event.preventDefault(); setSaveError('');
    try { await addTaskTimeEntry(task.id,Number(entryHours),entryNote.trim()); setEntryHours(''); setEntryNote(''); }
    catch(error) { setSaveError(error instanceof Error ? error.message : 'ثبت زمان انجام نشد.'); }
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks(prev => [
      ...prev,
      { id: `st_${Date.now()}`, title: newSubtaskTitle.trim(), completed: false }
    ]);
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (stId: string) => {
    setSubtasks(prev => prev.map(s => s.id === stId ? { ...s, completed: !s.completed } : s));
  };

  const handleRemoveSubtask = (stId: string) => {
    setSubtasks(prev => prev.filter(s => s.id !== stId));
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !addTaskComment) return;
    try { await addTaskComment(task.id, newComment.trim()); setNewComment(''); }
    catch(error) { setSaveError(error instanceof Error ? error.message : 'نظر ثبت نشد.'); }
  };

  return (
    <div className={`space-y-6 font-sans ${isRtl ? 'dir-rtl' : 'dir-ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {saveError && <div role="alert" className="p-4 rounded-xl bg-red-50 text-red-700">{saveError}</div>}
      {/* Top Header Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <ArrowRight className="w-5 h-5"/>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                {project ? (project.title || project.name) : 'پروژه عمومی'}
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-xs font-mono text-slate-400 font-bold">
                {task.id}
              </span>
            </div>
            <h1 className="text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5">
              {title || task.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSaved && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4"/>
              <span>{isRtl ? 'تغییرات ذخیره شد' : 'Saved'}</span>
            </span>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-5 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-xs shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer transition-all"
          >
            <Save className="w-4 h-4"/>
            <span>{isRtl ? 'ذخیره تغییرات' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left details & Right sidebar specs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Area (2 Cols): Title, Description, Subtasks, Comments */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Title & Description Editor Card */}
          <div className="p-6 bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRtl ? 'عنوان وظیفه' : 'Task Title'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRtl ? 'شرح و نیازمندی‌های اجرایی وظیفه' : 'Description & Requirements'}
              </label>
              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-medium leading-relaxed resize-none"
              />
            </div>
          </div>

          {/* Subtasks / Checklist Card */}
          <div className="p-6 bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600"/>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {isRtl ? 'چک‌لیست و زیرکارهای پروژه' : 'Subtasks Checklist'}
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 rounded-xl">
                {toPersianDigits(subtasks.filter(s => s.completed).length)} / {toPersianDigits(subtasks.length)}
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } }}
                placeholder={isRtl ? "افزودن مرحله جدید به چک‌لیست..." : "Add a step to checklist..."}
                className="flex-1 h-10 px-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="px-4 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4"/>
                <span>{isRtl ? 'افزودن' : 'Add'}</span>
              </button>
            </div>

            <div className="space-y-2">
              {subtasks.map((st) => (
                <div 
                  key={st.id} 
                  className={cn(
                    "flex items-center justify-between p-3 rounded-2xl border transition-all",
                    st.completed 
                      ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40 text-slate-400"
                      : "bg-slate-50/60 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                  )}
                >
                  <div 
                    onClick={() => handleToggleSubtask(st.id)}
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                  >
                    {st.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0"/>
                    ) : (
                      <Circle className="w-5 h-5 text-slate-400 shrink-0"/>
                    )}
                    <span className={cn("text-xs font-bold", st.completed && "line-through text-slate-400")}>
                      {st.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSubtask(st.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Comments and Team Notes Card */}
          <div className="p-6 bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600"/>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {isRtl ? 'گفتگو و یادداشت‌های فنی وظیفه' : 'Comments & Notes'}
                </h3>
              </div>
            </div>

            {/* Existing comments */}
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {(task.comments || []).length > 0 ? (
                task.comments?.map((c: any, idx: number) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/80 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{c.authorName || c.author || c.userName || 'کاربر'}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{formatJalaliDateTime(c.createdAt || c.date)}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{c.text || c.content}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs font-bold">
                  {isRtl ? 'هنوز نظری برای این وظیفه ثبت نشده است.' : 'No comments yet.'}
                </div>
              )}
            </div>

            {/* New Comment Input */}
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={isRtl ? "ثبت یادداشت یا گزارش پیشرفت..." : "Add a comment..."}
                className="flex-1 h-10 px-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-4 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5"/>
                <span>{isRtl ? 'ارسال' : 'Send'}</span>
              </button>
            </form>
          </div>

        </div>

        {/* Right Sidebar Specs (1 Col) */}
        <div className="space-y-6">
          
          {/* Status & Priority Box */}
          <div className="p-6 bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
              {isRtl ? 'وضعیت و اولویت وظیفه' : 'Status & Priority'}
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRtl ? 'وضعیت اجرایی' : 'Status'}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:border-blue-500 text-xs"
              >
                <option value="pending">{isRtl ? 'در انتظار' : 'To Do'}</option>
                <option value="inprogress">{isRtl ? 'در حال انجام' : 'In Progress'}</option>
                <option value="review">{isRtl ? 'در حال بررسی' : 'Review'}</option>
                <option value="blocked">{isRtl ? 'متوقف' : 'Blocked'}</option>
                <option value="cancelled">{isRtl ? 'لغوشده' : 'Cancelled'}</option>
                <option value="completed">{isRtl ? 'تکمیل‌شده' : 'Completed'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRtl ? 'اولویت وظیفه' : 'Priority'}
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:border-blue-500 text-xs"
              >
                <option value="critical">{isRtl ? 'فوری' : 'Urgent'}</option>
                <option value="high">{isRtl ? 'بالا' : 'High'}</option>
                <option value="medium">{isRtl ? 'متوسط' : 'Medium'}</option>
                <option value="low">{isRtl ? 'پایین' : 'Low'}</option>
              </select>
            </div>

            <div>
              <label htmlFor="task-manage-due-date" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRtl ? 'سررسید' : 'Due Date'}
              </label>
              <JalaliDateInput id="task-manage-due-date" value={dueDate} onChange={value => { setDueDate(value); setDeadlineChanged(true); }} placeholder="بدون سررسید" className="[&>button]:h-11" />
            </div>
          </div>

          <AssetManager taskId={task.id} projectId={task.projectId} compact/>
          {/* Time & Tracking Box */}
          <div className="p-6 bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
              {isRtl ? 'زمان‌سنجی و ردیابی کارکرد' : 'Time Tracking'}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isRtl ? 'تخمین (ساعت)' : 'Estimated (h)'}
                </label>
                <input
                  type="number"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center font-mono font-bold text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isRtl ? 'ثبت شده (ساعت)' : 'Logged (h)'}
                </label>
                <input
                  type="number"
                  value={task.loggedHours || 0}
                  readOnly
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center font-mono font-bold text-xs"
                />
              </div>
            </div>
          </div>

          <form onSubmit={handleTimeEntry} className="p-6 bg-white dark:bg-slate-900 rounded-3xl border space-y-3">
            <h3 className="text-sm font-bold">{isRtl ? 'ثبت کارکرد جدید' : 'Log work'}</h3>
            <label className="block text-xs">{isRtl ? 'ساعت کارکرد' : 'Hours'}<input aria-label="Work hours" type="number" min="0.01" max="24" step="0.01" value={entryHours} onChange={event=>setEntryHours(event.target.value)} required className="block w-full p-2 rounded border dark:bg-slate-800"/></label>
            <label className="block text-xs">{isRtl ? 'شرح کارکرد' : 'Work note'}<input aria-label="Work note" value={entryNote} onChange={event=>setEntryNote(event.target.value)} className="block w-full p-2 rounded border dark:bg-slate-800"/></label>
            <button type="submit" className="rounded-xl px-4 py-2 bg-blue-600 text-white text-xs">{isRtl ? 'ثبت زمان' : 'Log time'}</button>
            {(task.timeEntries || []).map(entry=><p key={entry.id} className="text-xs">{entry.hours}h — {entry.note}</p>)}
          </form>
          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border space-y-3">
            <h3 className="text-sm font-bold">{isRtl ? 'اعضای مجری' : 'Assignees'}</h3>
            {teamMembers.map(member=>{ const id=(member as any).userId || member.id; return <label key={id} className="flex gap-2 text-xs"><input type="checkbox" checked={memberIds.includes(id)} onChange={event=>setMemberIds(previous=>event.target.checked?[...previous,id]:previous.filter(value=>value!==id))}/>{member.name}</label>; })}
            <h3 className="text-sm font-bold">{isRtl ? 'پیش‌نیازها' : 'Dependencies'}</h3>
            {tasks.filter(candidate=>candidate.projectId===task.projectId && candidate.id!==task.id).map(candidate=><label key={candidate.id} className="flex gap-2 text-xs"><input type="checkbox" checked={dependencies.includes(candidate.id)} onChange={event=>setDependencies(previous=>event.target.checked?[...previous,candidate.id]:previous.filter(value=>value!==candidate.id))}/>{candidate.title}</label>)}
            <label className="block text-xs">{isRtl ? 'لینک‌ها؛ هر نشانی در یک خط' : 'Links; one URL per line'}<textarea value={linksText} onChange={event=>setLinksText(event.target.value)} className="block w-full p-2 rounded border dark:bg-slate-800"/></label>
          </div>

        </div>

      </div>
    </div>
  );
};
