import { LocalImage } from '../common/LocalImage';
import React from 'react';
import { AlertCircle, CheckCircle2, Check, CornerUpLeft, Clock } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Task } from '../../types';
import { assignedIds } from '../../lib/domain';

const toPersianDigits = (n: string | number): string => {
  if (n === undefined || n === null) return '';
  return n.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)]);
};

export interface ProjectBlockersReviewWidgetProps {
  className?: string;
  onNavigateToTasks?: () => void;
  borderless?: boolean;
}

export const ProjectBlockersReviewWidget: React.FC<ProjectBlockersReviewWidgetProps> = ({
  className = '',
  onNavigateToTasks,
  borderless = false
}) => {
  const { tasks, projects, teamMembers, updateTaskStatus, setActiveTab, setActiveSubTab, locale } = useProject();
  const isRtl = locale === 'fa';

  // Live list of tasks currently stuck in 'review' (در بررسی) or 'blocked' (متوقف شده)
  const stuckTasks = (tasks || []).filter(
    (t) => t && (t.status === 'review' || t.status === 'blocked')
  );

  const handleNavigate = () => {
    if (onNavigateToTasks) {
      onNavigateToTasks();
    } else {
      setActiveTab('tasks');
      setActiveSubTab('kanban');
    }
  };

  const handleApprove = (taskId: string) => {
    updateTaskStatus(taskId, 'completed');
  };

  const handleRevision = (taskId: string) => {
    updateTaskStatus(taskId, 'inprogress');
  };

  const getProjectTitle = (projectId: string) => projects.find((p) => p.id === projectId)?.title || '';

  const getMemberDetails = (task: Task) => {
    const ids = assignedIds(task);
    const member = teamMembers.find((m) => ids.includes(m.id)) || teamMembers.find((m) => m.name === task.assignedTo);
    const name = member?.name || task.assignedTo || '';
    return { name: name || 'بدون مسئول', avatar: member?.avatar || '', hasOwner: !!name };
  };

  // Whole days since the task entered its current status (status history), else since its last update.
  const daysInStatus = (task: Task) => {
    const entry = [...((task as any).statusHistory || [])].reverse().find((item: any) => item?.newStatus === task.status);
    const since = new Date(entry?.timestamp || (task as any).updatedAt || '');
    return Number.isNaN(since.getTime()) ? undefined : Math.max(0, Math.floor((Date.now() - since.getTime()) / 86400000));
  };

  const containerClasses = borderless
    ? `bg-transparent border-0 p-0 shadow-none font-sans flex flex-col justify-between space-y-4 w-full ${className}`
    : `bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all font-sans flex flex-col justify-between space-y-4 ${className}`;

  return (
    <div
      className={containerClasses}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
              وظایف در انتظار بررسی یا متوقف‌شده
            </h3>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5">
              {stuckTasks.length > 0
                ? `${toPersianDigits(stuckTasks.length)} مورد نیاز به اقدام دارد`
                : 'موردی در انتظار اقدام نیست'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleNavigate}
          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
        >
          <span>مشاهدهٔ همهٔ وظایف</span>
        </button>
      </div>

      {/* CONTENT AREA */}
      {stuckTasks.length === 0 ? (
        /* EMPTY STATE */
        <div className="py-8 px-4 flex flex-col items-center justify-center text-center space-y-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed max-w-xs">
            هیچ وظیفه‌ای در انتظار بررسی یا متوقف‌شده نیست.
          </p>
        </div>
      ) : (
        /* TASK LIST */
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
          {stuckTasks.map((task) => {
            const member = getMemberDetails(task);
            const projTitle = getProjectTitle(task.projectId);
            const isBlocked = task.status === 'blocked';
            const days = daysInStatus(task);
            const waitingText = days === undefined ? '' : days === 0
              ? (isBlocked ? 'از امروز متوقف' : 'از امروز در انتظار بررسی')
              : `${toPersianDigits(days)} روز ${isBlocked ? 'متوقف' : 'در انتظار بررسی'}`;

            return (
              <div
                key={task.id}
                className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isBlocked
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40'
                    : 'bg-slate-50/80 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                {/* Left/Main Task Details */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <LocalImage
                    src={member.avatar}
                    alt={member.name}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0 mt-0.5"
                  />
                  <div className="min-w-0 flex-1 text-right space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                        {task.title}
                      </span>
                      {projTitle && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
                          {projTitle}
                        </span>
                      )}
                      {isBlocked && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50">
                          متوقف شده
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                      <span>مسئول: {member.name}</span>
                      {waitingText && (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Clock size={11} /> {waitingText}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/40 dark:border-slate-700/40 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => handleRevision(task.id)}
                    className="px-2.5 py-1.5 bg-slate-200/80 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                  >
                    <CornerUpLeft size={12} />
                    <span>{isBlocked ? 'ادامهٔ کار' : 'ارجاع جهت اصلاح'}</span>
                  </button>

                  {!isBlocked && (
                    <button
                      type="button"
                      onClick={() => handleApprove(task.id)}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                    >
                      <Check size={12} />
                      <span>تأیید و تکمیل</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
