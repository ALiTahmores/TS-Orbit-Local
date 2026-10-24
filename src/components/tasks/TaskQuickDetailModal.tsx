import { formatJalaliDate } from '../../lib/dates';
import {AssetManager} from '../assets/AssetManager';
import { LocalImage } from '../common/LocalImage';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Calendar, 
  Tag, 
  Paperclip, 
  MessageSquare, 
  User, 
  Maximize2, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  Layers,
  Send,
  FileText
} from 'lucide-react';
import { useProjectContext } from '../../context/ProjectContext';
import { Task, SubTask } from '../../types';
import { cn } from '../../lib/utils';

const toPersianDigits = (n: string | number): string => {
  if (n === undefined || n === null) return '';
  return n.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)] || '۰');
};

interface TaskQuickDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenFullManage?: (taskId: string) => void;
}

export const TaskQuickDetailModal: React.FC<TaskQuickDetailModalProps> = ({
  task:requestedTask,
  isOpen,
  onClose,
  onOpenFullManage
}) => {
  const { 
    tasks,
    currentUser, 
    projects, 
    updateTask, 
    updateTaskStatus, 
    addTaskComment, 
    locale 
  } = useProjectContext();

  const task=tasks.find(candidate=>candidate.id===requestedTask?.id) || null;
  const isRtl = locale !== 'en';
  const [error,setError]=useState('');
  const attempt=async(operation:()=>Promise<any>)=>{setError('');try{await operation();return true;}catch(error){setError(error instanceof Error?error.message:'عملیات انجام نشد.');return false;}};
  const [newComment, setNewComment] = useState('');

  if (!isOpen || !task || typeof document === 'undefined') return null;

  const project = projects.find(p => p.id === task.projectId);

  const handleToggleSubtask = (stId: string) => {
    const updatedSubtasks = (task.subtasks || []).map(st => 
      st.id === stId ? { ...st, completed: !st.completed } : st
    );
    const completedCount = updatedSubtasks.filter(s => s.completed).length;
    const progressVal = updatedSubtasks.length > 0 ? Math.round((completedCount / updatedSubtasks.length) * 100) : task.progress;

    if (updateTask) {
      void attempt(()=>updateTask(task.id, {
        subtasks: updatedSubtasks
      }));
    }
  };

  const handleStatusChange = (newStatus: string) => {
    if (updateTaskStatus) {
      void attempt(()=>updateTaskStatus(task.id, newStatus as any));
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    if (addTaskComment) {
      if(await attempt(()=>addTaskComment(task.id, newComment.trim()))) setNewComment('');
    }
  };

  const statusMap: Record<string, { label: string; color: string; bg: string }> = {
    'TODO': { label: 'در انتظار', color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-800' },
    'pending': { label: 'در انتظار', color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-800' },
    'IN_PROGRESS': { label: 'در حال انجام', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-950/60' },
    'inprogress': { label: 'در حال انجام', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-950/60' },
    'UNDER_REVIEW': { label: 'در حال بررسی', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/60' },
    'review': { label: 'در حال بررسی', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/60' },
    'COMPLETED': { label: 'تکمیل شده', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/60' },
    'completed': { label: 'تکمیل شده', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/60' }
  };

  const curStatus = statusMap[task.status] || statusMap['TODO'];

  return createPortal(
    <div className={`fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-sans ${isRtl ? 'dir-rtl' : 'dir-ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 z-0 bg-black/[0.12] dark:bg-black/[0.45] backdrop-blur-[2px] transition-opacity animate-in fade-in cursor-pointer"
      />

      {/* Modal Card */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-[#0d121f] rounded-[28px] border border-slate-200/90 dark:border-slate-800 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.2)] animate-in fade-in zoom-in-95 duration-150 overflow-hidden ${isRtl ? 'text-right' : 'text-left'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 px-7 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-[#0d121f]">
          <div className="flex items-center gap-2">
            <button 
              type="button" 
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4"/>
            </button>
            {onOpenFullManage && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFullManage(task.id);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-bold transition-all cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5"/>
                <span>{isRtl ? 'نمای کامل و مدیریت' : 'Full Screen'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className={cn("px-3 py-1 rounded-xl text-xs font-black border border-slate-200/60 dark:border-slate-700", curStatus.bg, curStatus.color)}>
              {curStatus.label}
            </span>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 sm:p-7 space-y-5 overflow-y-auto flex-1 text-xs">
          {error && <p role="alert" className="text-red-600">{error}</p>}
          {/* Project & Title */}
          <div>
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-1 block">
              {project ? (project.title || project.name) : 'پروژه عمومی'}
            </span>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
              {task.title}
            </h2>
          </div>

          {/* Key Specs Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80">
            <div>
              <span className="text-[10px] text-slate-400 font-bold block mb-1">{isRtl ? 'مهلت تحویل' : 'Due Date'}</span>
              <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200 font-mono">
                <Calendar className="w-3.5 h-3.5 text-slate-400"/>
                <span>{formatJalaliDate((task as any).deadlineCanonical || task.deadline || task.dueDate) || '—'}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-bold block mb-1">{isRtl ? 'اولویت' : 'Priority'}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {task.priority === 'critical' || task.priority === 'Urgent' ? '🔥 فوری' : (task.priority === 'high' || task.priority === 'High' ? '🔴 بالا' : '🟡 متوسط')}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-bold block mb-1">{isRtl ? 'پیشرفت' : 'Progress'}</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                {toPersianDigits(task.progress || 0)}٪
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-bold block mb-1">{isRtl ? 'ساعات تخمینی' : 'Hours'}</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                {toPersianDigits(task.estimatedHours || 0)} ساعت
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="font-black text-slate-800 dark:text-slate-200 mb-1.5">{isRtl ? 'شرح و نیازمندی‌ها' : 'Description'}</h4>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              {task.description || (isRtl ? 'توضیحات بیشتری برای این تسک ثبت نشده است.' : 'No description provided.')}
            </div>
          </div>

          {/* Assignees */}
          <div>
            <h4 className="font-black text-slate-800 dark:text-slate-200 mb-1.5">{isRtl ? 'اعضای مجری تسک' : 'Assignees'}</h4>
            <div className="flex items-center gap-2">
              {task.assignees && task.assignees.length > 0 ? (
                task.assignees.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <LocalImage src={a.avatar || "/avatars/avatar-5.svg"} alt={a.name} className="w-5 h-5 rounded-full object-cover"/>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{a.name}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <User className="w-4 h-4 text-slate-400"/>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{task.assignedTo || 'تعیین نشده'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Subtasks */}
          {task.subtasks && task.subtasks.length > 0 && (
            <div>
              <h4 className="font-black text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                <span>{isRtl ? 'چک‌لیست زیرتسک‌ها' : 'Subtasks'}</span>
                <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400">
                  {toPersianDigits(task.subtasks.filter(s => s.completed).length)} / {toPersianDigits(task.subtasks.length)}
                </span>
              </h4>
              <div className="space-y-1.5">
                {task.subtasks.map((st) => (
                  <div 
                    key={st.id} 
                    onClick={() => handleToggleSubtask(st.id)}
                    className={cn(
                      "flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer",
                      st.completed 
                        ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-slate-400 line-through"
                        : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-blue-400"
                    )}
                  >
                    {st.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0"/>
                    ) : (
                      <Circle className="w-4 h-4 text-slate-400 shrink-0"/>
                    )}
                    <span className="font-medium text-xs flex-1">{st.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Status Changers */}
          <div>
            <h4 className="font-black text-slate-800 dark:text-slate-200 mb-1.5">{isRtl ? 'تغییر سریع وضعیت' : 'Change Status'}</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleStatusChange('pending')}
                className={cn("p-2 rounded-xl text-center font-bold border transition-all cursor-pointer", task.status === 'pending' || task.status === 'TODO' ? "bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50")}
              >
                {isRtl ? '📋 در انتظار' : 'To Do'}
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('inprogress')}
                className={cn("p-2 rounded-xl text-center font-bold border transition-all cursor-pointer", task.status === 'inprogress' || task.status === 'IN_PROGRESS' ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50")}
              >
                {isRtl ? '⚡ در حال انجام' : 'In Progress'}
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('review')}
                className={cn("p-2 rounded-xl text-center font-bold border transition-all cursor-pointer", task.status === 'review' || task.status === 'UNDER_REVIEW' ? "bg-amber-600 text-white border-amber-600" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50")}
              >
                {isRtl ? '🔍 بررسی' : 'Review'}
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('completed')}
                className={cn("p-2 rounded-xl text-center font-bold border transition-all cursor-pointer", task.status === 'completed' || task.status === 'COMPLETED' ? "bg-emerald-600 text-white border-emerald-600" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50")}
              >
                {isRtl ? '✅ تکمیل' : 'Completed'}
              </button>
            </div>
          </div>
        </div>

        <div className="p-5"><AssetManager key={task.id} taskId={task.id} projectId={task.projectId} compact/></div>
        {/* Footer */}
        <div className="p-4 px-7 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-[#0d121f] flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-bold">
            {isRtl ? `شناسه: ${task.id}` : `ID: ${task.id}`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all cursor-pointer"
          >
            {isRtl ? 'بستن پنجره' : 'Close'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
