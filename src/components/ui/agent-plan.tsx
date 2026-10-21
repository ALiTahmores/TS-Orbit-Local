import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  CircleDotDashed, 
  CircleAlert, 
  CircleX, 
  Circle, 
  ChevronDown, 
  Layers, 
  Clock, 
  User, 
  ArrowLeft,
  Sparkles,
  Link as LinkIcon,
  Check
} from 'lucide-react';

export type AgentPlanStatus = 'completed' | 'in_progress' | 'bottleneck' | 'blocked' | 'pending';

export interface AgentPlanSubtask {
  id: string;
  title: string;
  description?: string;
  status: AgentPlanStatus;
  required?: boolean;
  tools?: string[];
  assignee?: string;
  estimatedDays?: number;
  completedAt?: string;
}

export interface AgentPlanTask {
  id: string;
  phaseNumber?: string;
  title: string;
  description: string;
  status: AgentPlanStatus;
  teamLead?: string;
  teamName?: string;
  estimatedDays?: number;
  subtasks: AgentPlanSubtask[];
  tools?: string[];
  dependencies?: string[];
  branch?: 'wp' | 'custom' | 'all';
  evidenceRequired?: string[];
}

export interface AgentPlanProps {
  title?: string;
  subtitle?: string;
  tasks: AgentPlanTask[];
  onTaskStatusChange?: (taskId: string, newStatus: AgentPlanStatus) => void;
  onSubtaskToggle?: (taskId: string, subtaskId: string, completed: boolean) => void;
  className?: string;
  headerExtra?: React.ReactNode;
  overallProgress?: number;
  readOnly?: boolean;
  embedded?: boolean;
  hideHeader?: boolean;
}

// Status Indicator Helper
export const renderStatusBadge = (status: AgentPlanStatus, size: 'sm' | 'md' = 'md') => {
  const iconSize = size === 'sm' ? 13 : 15;
  
  switch (status) {
    case 'completed':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800`}>
          <CheckCircle2 size={iconSize} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>تکمیل‌شده</span>
        </span>
      );
    case 'in_progress':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800`}>
          <CircleDotDashed size={iconSize} className="shrink-0 text-blue-600 dark:text-blue-400 animate-spin-slow" />
          <span>در حال اجرا</span>
        </span>
      );
    case 'bottleneck':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800`}>
          <CircleAlert size={iconSize} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <span>گلوگاه / نیاز به پیگیری</span>
        </span>
      );
    case 'blocked':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800`}>
          <CircleX size={iconSize} className="shrink-0 text-rose-600 dark:text-rose-400" />
          <span>مسدودشده</span>
        </span>
      );
    case 'pending':
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700`}>
          <Circle size={iconSize} className="shrink-0 text-slate-400 dark:text-slate-500" />
          <span>در انتظار</span>
        </span>
      );
  }
};

// Status Icon Button Helper
export const StatusIconButton: React.FC<{
  status: AgentPlanStatus;
  onClick?: () => void;
  disabled?: boolean;
}> = ({ status, onClick, disabled }) => {
  const getIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />;
      case 'in_progress':
        return <CircleDotDashed size={18} className="text-blue-600 dark:text-blue-400 animate-spin-slow" />;
      case 'bottleneck':
        return <CircleAlert size={18} className="text-amber-600 dark:text-amber-400" />;
      case 'blocked':
        return <CircleX size={18} className="text-rose-600 dark:text-rose-400" />;
      case 'pending':
      default:
        return <Circle size={18} className="text-slate-400 dark:text-slate-500" />;
    }
  };

  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.85 }}
      whileHover={disabled ? undefined : { scale: 1.1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled && onClick) onClick();
      }}
      disabled={disabled}
      title="تغییر وضعیت فاز"
      className="p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0"
    >
      {getIcon()}
    </motion.button>
  );
};

export const AgentPlan: React.FC<AgentPlanProps> = ({
  title,
  subtitle,
  tasks,
  onTaskStatusChange,
  onSubtaskToggle,
  className = '',
  headerExtra,
  overallProgress,
  readOnly = false,
  embedded = false,
  hideHeader = false
}) => {
  // Track expanded state for each phase
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    tasks.forEach((t, idx) => {
      // Expand in_progress, bottleneck, or first task by default
      initial[t.id] = idx === 0 || t.status === 'in_progress' || t.status === 'bottleneck';
    });
    return initial;
  });

  const toggleExpand = (id: string) => {
    setExpandedTasks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Cycle status on task icon click: pending -> in_progress -> completed -> bottleneck -> blocked -> pending
  const cycleTaskStatus = (taskId: string, currentStatus: AgentPlanStatus) => {
    if (readOnly || !onTaskStatusChange) return;
    const statusCycle: AgentPlanStatus[] = ['pending', 'in_progress', 'completed', 'bottleneck', 'blocked'];
    const nextIndex = (statusCycle.indexOf(currentStatus) + 1) % statusCycle.length;
    onTaskStatusChange(taskId, statusCycle[nextIndex]);
  };

  // Calculate overall metrics if not passed
  const totalPhases = tasks.length;
  const completedPhases = tasks.filter((t) => t.status === 'completed').length;
  const calculatedProgress = overallProgress !== undefined 
    ? overallProgress 
    : (totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0);

  return (
    <div dir="rtl" className={`text-right w-full font-vazirmatn ${embedded ? '' : 'space-y-4'} ${className}`}>
      
      {/* CARD CONTAINER (TS Orbit Design Tokens) */}
      <div className={embedded ? 'w-full text-slate-800 dark:text-slate-100 transition-colors' : 'w-full bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-sm rounded-2xl p-4 sm:p-6 transition-colors'}>
        
        {/* HEADER SECTION (Skipped when hideHeader is true) */}
        {!hideHeader && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-slate-800/80">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  <Layers size={18} />
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {title || 'برنامه و جریان اجرای فازهای پروژه'}
                  </h2>
                  {subtitle && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* EXTRA ACTIONS & OVERALL PROGRESS */}
            <div className="flex flex-wrap items-center gap-3">
              {headerExtra}

              {/* Overall Progress Widget */}
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#131b2e] border border-slate-200/80 dark:border-slate-800/80">
                <div className="text-left">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-medium">پیشرفت کلی</span>
                  <span className="text-xs font-black font-mono text-slate-800 dark:text-slate-100">
                    {calculatedProgress}%
                  </span>
                </div>
                <div className="w-20 sm:w-28 h-2 bg-slate-200 dark:bg-slate-700/60 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${calculatedProgress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="h-full bg-blue-600 dark:bg-blue-500 rounded-full"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TASK / PHASES LIST */}
        <div className={`divide-y divide-slate-100 dark:divide-slate-800/60 ${hideHeader ? '' : 'pt-2'}`}>
          {tasks.map((task) => {
            const isExpanded = !!expandedTasks[task.id];
            const subtasksCount = task.subtasks?.length || 0;
            const completedSubtasks = task.subtasks?.filter((s) => s.status === 'completed').length || 0;
            const taskProgress = subtasksCount > 0 ? Math.round((completedSubtasks / subtasksCount) * 100) : 0;

            return (
              <div key={task.id} className="py-3 sm:py-4 transition-colors">
                
                {/* TASK ROW CONTAINER */}
                <div 
                  onClick={() => toggleExpand(task.id)}
                  className="p-3 sm:p-4 rounded-xl hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors cursor-pointer flex flex-col gap-3 group"
                >
                  {/* TOP BAR: RIGHT (Icon + Phase + Title) & LEFT (Badges + Chevron) */}
                  <div className="flex items-center justify-between gap-3 w-full">
                    
                    {/* RIGHT: Icon & Titles */}
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusIconButton 
                        status={task.status} 
                        onClick={() => cycleTaskStatus(task.id, task.status)}
                        disabled={readOnly}
                      />

                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {task.phaseNumber && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] font-bold">
                            {task.phaseNumber}
                          </span>
                        )}
                        <h3 className="text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm tracking-tight truncate">
                          {task.title}
                        </h3>
                      </div>
                    </div>

                    {/* LEFT: Metadata, Status Badge & Chevron */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      
                      {/* Subtasks Count Pill */}
                      {subtasksCount > 0 && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/80 px-2 py-0.5 rounded-md">
                          <span>{completedSubtasks}</span>
                          <span>/</span>
                          <span>{subtasksCount}</span>
                          <span className="mr-1 text-[10px] text-slate-400">تسک</span>
                        </span>
                      )}

                      {/* Status Indicator Badge */}
                      {renderStatusBadge(task.status, 'sm')}

                      {/* Expand/Collapse Chevron */}
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 p-1"
                      >
                        <ChevronDown size={18} />
                      </motion.div>
                    </div>
                  </div>

                  {/* BOTTOM INFO BAR: Description, Dependencies & Tool Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pr-8 text-[11px] text-slate-500 dark:text-slate-400">
                    <p className="line-clamp-1 max-w-2xl">
                      {task.description}
                    </p>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {/* Estimated Days */}
                      {task.estimatedDays !== undefined && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                          <Clock size={12} />
                          <span>{task.estimatedDays} روز کاری</span>
                        </span>
                      )}

                      {/* Team Lead */}
                      {task.teamLead && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                          <User size={12} />
                          <span className="truncate max-w-[140px]">{task.teamLead}</span>
                        </span>
                      )}

                      {/* Deliverables / Tools Pills */}
                      {task.tools && task.tools.length > 0 && (
                        <div className="flex items-center gap-1">
                          {task.tools.slice(0, 3).map((tool, i) => (
                            <span 
                              key={i} 
                              className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono text-[10px] px-2 py-0.5 rounded-lg"
                            >
                              {tool}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Task Subtask Progress Bar (when collapsed or partial) */}
                  {subtasksCount > 0 && (
                    <div className="w-full bg-slate-100 dark:bg-slate-800/60 h-1 rounded-full overflow-hidden mt-1">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          task.status === 'completed' 
                            ? 'bg-emerald-500' 
                            : task.status === 'bottleneck' 
                              ? 'bg-amber-500' 
                              : 'bg-blue-500'
                        }`}
                        style={{ width: `${taskProgress}%` }}
                      />
                    </div>
                  )}

                </div>

                {/* EXPANDABLE SUBTASKS CONTAINER (Strict Persian RTL Tree Lines) */}
                <AnimatePresence initial={false}>
                  {isExpanded && task.subtasks && task.subtasks.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      {/* TREE WRAPPER: Dashed line anchored to the RIGHT side */}
                      <div className="relative mt-2 mr-4 sm:mr-6 pb-2">
                        
                        {/* Connecting Dashed Tree Line: Right side */}
                        <div 
                          className="absolute right-[20px] top-1 bottom-4 w-0 border-r-2 border-dashed border-slate-200 dark:border-slate-800 pointer-events-none"
                        />

                        {/* SUBTASK ITEMS */}
                        <div className="space-y-1.5 pt-1">
                          {task.subtasks.map((subtask) => {
                            const isDone = subtask.status === 'completed';

                            return (
                              <div
                                key={subtask.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!readOnly && onSubtaskToggle) {
                                    onSubtaskToggle(task.id, subtask.id, !isDone);
                                  }
                                }}
                                className="group/sub relative flex items-start justify-between gap-3 pr-7 pl-2 py-2 rounded-xl hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors cursor-pointer"
                              >
                                {/* SUBTASK CONNECTOR BULLET / CHECKBOX (Right side) */}
                                <div className="absolute right-[14px] top-3.5 z-10 flex items-center justify-center">
                                  <motion.div
                                    whileTap={readOnly ? undefined : { scale: 0.8 }}
                                    className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center transition-all ${
                                      isDone
                                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                                        : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 group-hover/sub:border-blue-500'
                                    }`}
                                  >
                                    {isDone && <Check size={10} strokeWidth={3} />}
                                  </motion.div>
                                </div>

                                {/* SUBTASK TEXT & DETAILS */}
                                <div className="space-y-0.5 min-w-0 pr-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`font-bold text-xs transition-colors ${
                                      isDone 
                                        ? 'line-through text-slate-400 dark:text-slate-500' 
                                        : 'text-slate-800 dark:text-slate-200'
                                    }`}>
                                      {subtask.title}
                                    </span>

                                    {subtask.required && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 font-medium">
                                        الزامی
                                      </span>
                                    )}
                                  </div>

                                  {subtask.description && (
                                    <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                                      {subtask.description}
                                    </p>
                                  )}
                                </div>

                                {/* SUBTASK BADGES & TOOLS */}
                                <div className="flex items-center gap-2 shrink-0">
                                  {subtask.tools && subtask.tools.map((t, idx) => (
                                    <span 
                                      key={idx}
                                      className="hidden sm:inline-block bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono text-[10px] px-2 py-0.5 rounded-lg"
                                    >
                                      {t}
                                    </span>
                                  ))}

                                  {renderStatusBadge(subtask.status, 'sm')}
                                </div>

                              </div>
                            );
                          })}
                        </div>

                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
};
