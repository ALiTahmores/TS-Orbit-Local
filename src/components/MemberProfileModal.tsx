import { LocalImage } from './common/LocalImage';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { TeamMember, Task, Project } from '../types';
import { X, Briefcase, CheckCircle2, Mail, Phone, AlertTriangle, ListTodo, Clock } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { deliveredOnTime, dueDate, isOverdue, tasksAssignedTo } from '../lib/taskAnalytics';
import { priorityKey, priorityLabel, statusLabel } from '../lib/taskLabels';
import { formatJalaliDate } from '../lib/dates';

const toPersianDigits = (n: string | number): string => {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (x) => farsiDigits[parseInt(x, 10)]);
};

const jalali = (iso?: string) => {
  const date = iso ? new Date(`${iso}T00:00:00`) : undefined;
  return date && !Number.isNaN(date.getTime()) ? formatJalaliDate(date) : 'بدون سررسید';
};

const PRIORITY_CLASS: Record<string, string> = {
  critical: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

interface MemberProfileModalProps {
  member: TeamMember | null;
  isOpen: boolean;
  onClose: () => void;
  allTasks?: Task[];
  allProjects?: Project[];
}

/** A member's profile with the tasks and projects actually assigned to them. */
export const MemberProfileModal: React.FC<MemberProfileModalProps> = ({
  member,
  isOpen,
  onClose,
  allTasks = [],
  allProjects = []
}) => {
  const { getRoleLabel, departments, departmentMembers } = useProject();
  const [activeTab, setActiveTab] = useState<'tasks' | 'projects'>('tasks');

  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('tasks');
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const data = useMemo(() => {
    if (!member) return null;
    const tasks = tasksAssignedTo(allTasks, member.id);
    const open = tasks.filter(task => task.status !== 'completed' && task.status !== 'cancelled');
    const completed = tasks.filter(task => task.status === 'completed');
    const judged = completed.map(deliveredOnTime).filter((value): value is boolean => value !== undefined);
    const projectIds = new Set(tasks.map(task => task.projectId));
    const departmentNames = (departmentMembers || [])
      .filter((row: any) => row.userId === member.id)
      .map((row: any) => (departments || []).find((department: any) => department.id === row.departmentId)?.name)
      .filter(Boolean);
    return {
      tasks: [...open.sort((a, b) => (dueDate(a) || '9999').localeCompare(dueDate(b) || '9999')), ...completed],
      open: open.length,
      completed: completed.length,
      overdue: open.filter(task => isOverdue(task)).length,
      onTime: judged.length ? Math.round(judged.filter(Boolean).length / judged.length * 100) : null,
      projects: allProjects.filter(project => projectIds.has(project.id)),
      departmentNames,
    };
  }, [member, allTasks, allProjects, departments, departmentMembers]);

  if (!isOpen || !member || !data) return null;

  const stats = [
    { label: 'وظایف باز', value: toPersianDigits(data.open), icon: ListTodo, tone: 'text-blue-600' },
    { label: 'تکمیل‌شده', value: toPersianDigits(data.completed), icon: CheckCircle2, tone: 'text-emerald-600' },
    { label: 'دارای تأخیر', value: toPersianDigits(data.overdue), icon: AlertTriangle, tone: data.overdue ? 'text-rose-600' : 'text-slate-500' },
    { label: 'تحویل به‌موقع', value: data.onTime === null ? '—' : `${toPersianDigits(data.onTime)}٪`, icon: Clock, tone: 'text-indigo-600' },
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto font-sans" role="dialog" aria-modal="true" aria-labelledby="member-profile-title">
      <div onClick={handleClose} className="fixed inset-0 z-0 bg-black/30 dark:bg-black/60 backdrop-blur-[1.5px] cursor-pointer" />

      <div
        className="relative z-10 w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[28px] shadow-2xl p-5 md:p-7 my-auto max-h-[92vh] flex flex-col cursor-default animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-start justify-between gap-4 pb-5 mb-5 border-b border-slate-200 dark:border-slate-800/80 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              <LocalImage src={member.avatar} alt={member.name} className="w-14 h-14 rounded-2xl object-cover ring-2 ring-blue-500/80 shadow-md" />
              <span
                title={member.status === 'online' ? 'آنلاین' : 'آفلاین'}
                className={`absolute -bottom-1 -end-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-950 ${member.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'}`}
              />
            </div>
            <div className="space-y-1 min-w-0">
              <h2 id="member-profile-title" className="text-xl font-black text-slate-900 dark:text-slate-100 truncate">{member.name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                {getRoleLabel(member.role)}
                {data.departmentNames.length > 0 && <span className="text-blue-600 dark:text-blue-400"> • {data.departmentNames.join('، ')}</span>}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                {member.email && (
                  <a href={`mailto:${member.email}`} className="inline-flex items-center gap-1 hover:text-blue-600" dir="ltr"><Mail size={12} /> {member.email}</a>
                )}
                {member.phone && (
                  <a href={`tel:${member.phone}`} className="inline-flex items-center gap-1 hover:text-blue-600" dir="ltr"><Phone size={12} /> {member.phone}</a>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="بستن"
            className="p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 scrollbar-thin">
          {/* STATS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map(item => (
              <div key={item.label} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span>{item.label}</span>
                  <item.icon size={15} className={item.tone} />
                </div>
                <div className={`text-2xl font-black mt-2 ${item.tone}`}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* TABS */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2" role="tablist">
            {([
              { id: 'tasks', label: `وظایف (${toPersianDigits(data.tasks.length)})`, icon: ListTodo },
              { id: 'projects', label: `پروژه‌ها (${toPersianDigits(data.projects.length)})`, icon: Briefcase },
            ] as const).map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <tab.icon size={14} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {activeTab === 'tasks' && (
            data.tasks.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">هنوز وظیفه‌ای به این عضو سپرده نشده است.</p>
            ) : (
              <div className="w-full overflow-x-auto scrollbar-thin">
                <table className="w-full text-start text-xs min-w-[560px]">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold">
                      <th className="py-3 px-2">عنوان</th>
                      <th className="py-3 px-2">پروژه</th>
                      <th className="py-3 px-2">اولویت</th>
                      <th className="py-3 px-2">وضعیت</th>
                      <th className="py-3 px-2">سررسید</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {data.tasks.map(task => (
                      <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-950">
                        <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">{task.title}</td>
                        <td className="py-3 px-2 text-slate-500">{allProjects.find(project => project.id === task.projectId)?.title || '—'}</td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${PRIORITY_CLASS[priorityKey(task.priority)] || PRIORITY_CLASS.medium}`}>{priorityLabel(task.priority)}</span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] font-bold">{statusLabel(task.status)}</span>
                        </td>
                        <td className={`py-3 px-2 ${isOverdue(task) ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>{jalali(dueDate(task))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === 'projects' && (
            data.projects.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">این عضو هنوز در پروژه‌ای وظیفه ندارد.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.projects.map(project => (
                  <div key={project.id} className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-slate-900 dark:text-white text-sm truncate">{project.title}</span>
                      <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-extrabold rounded-lg shrink-0">
                        پیشرفت {toPersianDigits(project.progress || 0)}٪
                      </span>
                    </div>
                    {project.description && <p className="text-xs text-slate-500 line-clamp-2">{project.description}</p>}
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full" style={{ width: `${project.progress || 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
