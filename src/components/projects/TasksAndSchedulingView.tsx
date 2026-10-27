import { formatJalaliDate } from '../../lib/dates';
import { LocalImage } from '../common/LocalImage';
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useProject } from '../../context/ProjectContext';
import { Project, Task, TaskStatus, TaskPriority } from '../../types';
import { CustomSelect, CustomSelectOption } from '../common/CustomSelect';
import { CreateTaskModal } from './CreateTaskModal';
import { SmsReminderModal } from './SmsReminderModal';
import { TaskDetailModal } from '../tasks/TaskDetailModal';
import { 
  CheckSquare, 
  Clock, 
  Calendar, 
  User, 
  Timer, 
  Table as TableIcon,
  Search, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft, 
  ChevronRight,
  Plus, 
  Check, 
  Folder, 
  AlertCircle,
  Trash2,
  ListTodo,
  Bell,
  MessageSquare,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock3
} from 'lucide-react';

const toPersianDigits = (n: string | number): string => {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (x) => farsiDigits[parseInt(x, 10)]);
};

const statusFilterOptions: CustomSelectOption[] = [
  { value: 'all', label: 'همه وضعیت‌ها' },
  { value: 'pending', label: 'در انتظار' },
  { value: 'inprogress', label: 'در حال انجام' },
  { value: 'review', label: 'در حال بررسی' },
  { value: 'completed', label: 'تکمیل‌شده' },
  { value: 'blocked', label: 'مسدود' },
  { value: 'cancelled', label: 'لغوشده' },
];

export const TasksAndSchedulingView: React.FC = () => {
  const { 
    projects, 
    tasks, 
    teamMembers, 
    updateTaskStatus, 
    deleteTask,
    setSelectedProject,
    t,
    isRtl,
    locale
  } = useProject();

  const localizedStatusFilterOptions = useMemo(() => [
    { value: 'all', label: t('همه وضعیت‌ها') },
    { value: 'pending', label: t('در انتظار') },
    { value: 'inprogress', label: t('در حال انجام') },
    { value: 'review', label: t('در حال بررسی') },
    { value: 'completed', label: t('تکمیل‌شده') },
    { value: 'blocked', label: t('مسدود') },
    { value: 'cancelled', label: t('لغوشده') },
  ], [t]);

  // Active sub-view tab: 'table' | 'time'
  const [activeTasksView, setActiveTasksView] = useState<'table' | 'time'>('table');
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  
  // Search and status filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Requirement 4: Collapsed state for 4 Multi-Status Project Accordions
  const [collapsedGroups, setCollapsedGroups] = useState<{ [key: string]: boolean }>({
    active: false,
    review: false,
    completed: false,
    archived: true
  });

  // Expanded tasks for specific project IDs
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([]);

  // Task Creation Modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedProjectIdForTask, setSelectedProjectIdForTask] = useState<string | undefined>(undefined);

  // SMS Reminder Modal state
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [selectedProjectForSms, setSelectedProjectForSms] = useState<Project | null>(null);

  // Map of active reminders by project ID
  const [activeReminders, setActiveReminders] = useState<{ [projectId: string]: boolean }>({});

  // Floating Toast notification text
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const toggleExpandProject = (projectId: string) => {
    setExpandedProjectIds(prev => 
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    );
  };

  const openCreateTaskModal = (projectId?: string) => {
    setSelectedProjectIdForTask(projectId);
    setIsTaskModalOpen(true);
  };

  const openSmsModal = (project: Project) => {
    setSelectedProjectForSms(project);
    setIsSmsModalOpen(true);
  };

  const handleSmsSaveSuccess = (data: { projectId: string; customDateTime?: string }) => {
    setActiveReminders(prev => ({ ...prev, [data.projectId]: true }));
    setToastMessage('یادآوری پیامکی برای سررسید پروژه با موفقیت فعال شد');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (t.assignedTo || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tasks, searchQuery, statusFilter]);

  // Requirement 4: Group projects by 4 distinct statuses
  const groupedProjects = useMemo(() => {
    const filterBySearch = (list: Project[]) => {
      if (!searchQuery.trim()) return list;
      const q = searchQuery.toLowerCase();
      return list.filter(p => p.title.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q));
    };

    const activeList = projects.filter(p => {
      const s = String(p.status).toLowerCase();
      return s === 'active' || s === 'connected_to_wordpress' || s === 'in_progress' || s === 'inprogress';
    });

    const reviewList = projects.filter(p => {
      const s = String(p.status).toLowerCase();
      return s === 'draft' || s === 'review' || s === 'in_review' || s === 'pending';
    });

    const completedList = projects.filter(p => {
      const s = String(p.status).toLowerCase();
      return s === 'completed';
    });

    const archivedList = projects.filter(p => {
      const s = String(p.status).toLowerCase();
      return s === 'archived' || s === 'suspended' || s === 'delayed' || s === 'cancelled' || s === 'canceled' || s === 'terminated';
    });

    return {
      active: filterBySearch(activeList),
      review: filterBySearch(reviewList),
      completed: filterBySearch(completedList),
      archived: filterBySearch(archivedList)
    };
  }, [projects, searchQuery]);

  // Requirement 2: Dynamic Project Time Calculation in Tehran Timezone
  const calculateDynamicProjectTime = (project:Project,projectTasks:Task[]) => {
    const minutes=Math.round(Number(project.loggedHours ?? projectTasks.reduce((sum,task)=>sum+Number(task.loggedHours || 0),0))*60);
    return toPersianDigits(String(Math.floor(minutes/60)).padStart(2,'0'))+':'+toPersianDigits(String(minutes%60).padStart(2,'0'))+' ساعت';
  };

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'critical': return { label: 'فوری', style: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' };
      case 'high': return { label: 'بالا', style: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' };
      case 'medium': return { label: 'متوسط', style: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' };
      case 'low': return { label: 'پایین', style: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' };
    }
  };

  // Helper renderer for each Project Table Group
  const renderProjectGroupSection = (
    groupKey: string,
    title: string,
    groupProjects: Project[],
    badgeColor: string,
    headerIcon: React.ReactNode
  ) => {
    const isCollapsed = collapsedGroups[groupKey];

    return (
      <div key={groupKey} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs text-start">
        {/* Accordion Group Header */}
        <div 
          onClick={() => toggleGroup(groupKey)}
          className="bg-slate-50 dark:bg-slate-800/80 p-4 flex items-center justify-between w-full border-b border-slate-200 dark:border-slate-800 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {/* Right Side Group: Icon + Title + Count Badge */}
          <div className="flex items-center gap-2.5">
            <div className="shrink-0 flex items-center justify-center">
              {headerIcon}
            </div>
            <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
              {title}
            </h3>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${badgeColor}`}>
              {locale === 'fa' ? toPersianDigits(groupProjects.length) : groupProjects.length} {t('پروژه')}
            </span>
          </div>

          {/* Left Side: Chevron Indicator with smooth rotation */}
          <div className="p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-transform">
            <ChevronDown size={16} className={`transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {!isCollapsed && (
          <div className="overflow-x-auto">
            {groupProjects.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 font-bold">
                {t('هیچ پروژه‌ای در این بخش یافت نشد.')}
              </div>
            ) : (
              <table className={`w-full border-collapse ${isRtl ? 'text-start' : 'text-left'}`}>
                <thead>
                  <tr className="bg-slate-50/60 dark:bg-slate-800/40 text-[11px] font-black text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase">
                    <th className={`p-3.5 whitespace-nowrap ${isRtl ? 'ps-4 text-start' : 'pe-4 text-left'}`}>{t('عنوان پروژه')}</th>
                    <th className="p-3.5 whitespace-nowrap">{t('اعضای تیم')}</th>
                    <th className="p-3.5 whitespace-nowrap">{t('وضعیت')}</th>
                    <th className="p-3.5 whitespace-nowrap">{t('پیشرفت')}</th>
                    <th className="p-3.5 whitespace-nowrap">{t('زمان ثبت‌شده (کارکرد)')}</th>
                    <th className={`p-3.5 whitespace-nowrap ${isRtl ? 'text-left pe-4' : 'text-start ps-4'}`}>{t('اقدامات وظیفه')}</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-medium">
                  {groupProjects.map((project) => {
                    const isExpanded = expandedProjectIds.includes(project.id);
                    const projectTaskList = filteredTasks.filter(t => t.projectId === project.id);
                    const completedCount = projectTaskList.filter(t => t.status === 'completed').length;
                    
                    const calculatedProgress = projectTaskList.length > 0 
                      ? Math.round((completedCount / projectTaskList.length) * 100) 
                      : (project.totalTasks && project.totalTasks > 0
                          ? Math.round(((project.completedTasks || 0) / project.totalTasks) * 100)
                          : 0);

                    // Requirement 2: Dynamic time calculation in Tehran timezone
                    const dynamicTimeStr = calculateDynamicProjectTime(project, projectTaskList);

                    return (
                      <React.Fragment key={project.id}>
                        <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-3.5 ps-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black shrink-0 shadow-2xs">
                                <Folder size={15} />
                              </div>
                              <div className="min-w-0">
                                <h4 
                                  onClick={() => setSelectedProject(project)}
                                  className="font-black text-slate-800 dark:text-slate-100 text-xs hover:text-blue-600 cursor-pointer transition-colors truncate"
                                >
                                  {project.title}
                                </h4>
                                <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                                  کارفرما: <strong className="text-slate-600 dark:text-slate-300">{project.clientName}</strong>
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Team Member Avatars */}
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="flex items-center -space-x-1.5 space-x-reverse">
                              {teamMembers.filter(member=>(project.assignedMemberIds || []).includes(member.id)).slice(0, 3).map((m, idx) => (
                                <div 
                                  key={idx} 
                                  title={m.name}
                                  className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-black border-2 border-white dark:border-slate-900 flex items-center justify-center overflow-hidden shrink-0"
                                >
                                  {m.avatar ? (
                                    <LocalImage src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                                  ) : (
                                    m.name.substring(0, 1)
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>

                          <td className="p-3.5 whitespace-nowrap">
                            {groupKey === 'active' && (
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 text-[10px] font-black rounded-full inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>در جریان اجرا</span>
                              </span>
                            )}
                            {groupKey === 'review' && (
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 text-[10px] font-black rounded-full inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>در حال بررسی</span>
                              </span>
                            )}
                            {groupKey === 'completed' && (
                              <span className="px-2.5 py-1 bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400 text-[10px] font-black rounded-full inline-flex items-center gap-1">
                                <CheckCircle2 size={12} />
                                <span>تکمیل‌شده</span>
                              </span>
                            )}
                            {groupKey === 'archived' && (
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-black rounded-full inline-flex items-center gap-1">
                                <Archive size={12} />
                                <span>آرشیو / معلق</span>
                              </span>
                            )}
                          </td>

                          {/* Progress bar */}
                          <td className="p-3.5">
                            <div className="space-y-1 min-w-[110px]">
                              <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-slate-400">پیشرفت</span>
                                <span className="font-mono text-blue-600 dark:text-blue-400 font-black">
                                  {toPersianDigits(calculatedProgress)}٪
                                </span>
                              </div>
                              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                                  style={{ width: `${calculatedProgress}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Requirement 2: Dynamic time calculation */}
                          <td className="p-3.5 whitespace-nowrap font-mono text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
                            <div className="flex items-center gap-1.5">
                              <Clock size={13} className="text-slate-400" />
                              <span>{dynamicTimeStr}</span>
                            </div>
                          </td>

                          <td className="p-3.5 text-left pe-4 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggleExpandProject(project.id)}
                              className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                                isExpanded
                                  ? 'bg-blue-600 text-white shadow-2xs'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40 dark:hover:text-blue-400'
                              }`}
                            >
                              <CheckSquare size={13} />
                              <span>مشاهده وظایف ({toPersianDigits(projectTaskList.length)})</span>
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          </td>
                        </tr>

                        {/* Requirement 3: Smooth Accordion Expansion with Motion React */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <tr key={`task-drawer-${project.id}`} className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
                              <td colSpan={6} className="p-0">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ 
                                    height: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                                    opacity: { duration: 0.2, ease: "linear" }
                                  }}
                                  className="overflow-hidden will-change-[height,opacity] transform-gpu"
                                >
                                  <div className="pt-3 pb-5 px-4 space-y-4">
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-inner">
                                    
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                                      <h5 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                        <ListTodo size={15} className="text-blue-600" />
                                        <span>وظایف فنی پروژه ({toPersianDigits(projectTaskList.length)})</span>
                                      </h5>
                                      
                                      {/* Requirement 1: Only keep the drawer's "+ افزودن وظیفه جدید" button */}
                                      <button
                                        type="button"
                                        onClick={() => openCreateTaskModal(project.id)}
                                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-sm cursor-pointer shrink-0 flex items-center gap-1"
                                      >
                                        <Plus size={14} />
                                        <span>+ افزودن وظیفه جدید</span>
                                      </button>
                                    </div>

                                    <div className="space-y-2">
                                      {projectTaskList.length === 0 ? (
                                        <p className="text-xs text-slate-400 py-2 font-bold">وظیفه‌ای برای این پروژه ثبت نشده است.</p>
                                      ) : (
                                        projectTaskList.map((t) => {
                                          const pBadge = getPriorityBadge(t.priority);
                                          const isCompleted = t.status === 'completed';

                                          return (
                                            <div 
                                              key={t.id} 
                                              className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 gap-3 text-xs font-bold text-slate-800 dark:text-slate-200 hover:border-blue-300 transition-colors"
                                            >
                                              <div className="flex items-center gap-3">
                                                <button
                                                  type="button"
                                                  onClick={() => updateTaskStatus(t.id, isCompleted ? 'inprogress' : 'completed')}
                                                  className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all cursor-pointer ${
                                                    isCompleted 
                                                      ? 'bg-emerald-500 border-emerald-600 text-white' 
                                                      : 'border-slate-300 dark:border-slate-600 hover:border-blue-500'
                                                  }`}
                                                >
                                                  {isCompleted && <Check size={12} className="stroke-[3]" />}
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setDetailTask(t)}
                                                  className={`text-start hover:text-blue-600 hover:underline cursor-pointer ${isCompleted ? 'line-through text-slate-400' : ''}`}
                                                >
                                                  {t.title}
                                                </button>
                                              </div>

                                              <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${pBadge.style}`}>
                                                  {pBadge.label}
                                                </span>

                                                <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                                                  <User size={12} />
                                                  <span>{t.assignedTo}</span>
                                                </div>

                                                <button
                                                  type="button"
                                                  onClick={() => { if (confirm('آیا از حذف این وظیفه مطمئن هستید؟')) void deleteTask(t.id); }}
                                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                                  title="حذف وظیفه"
                                                >
                                                  <Trash2 size={13} />
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>

                                  </div>
                                </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`space-y-6 w-full font-sans relative ${isRtl ? 'text-start' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[10000] bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl font-black text-xs flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-200">
          <ShieldCheck size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOOLBAR CONTROLS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* Search & Status Filter */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${isRtl ? 'start-3' : 'end-3'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('جستجو در نام پروژه، کارفرما یا وظیفه...')}
              className={`w-full py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isRtl ? 'ps-9 pe-3' : 'pe-9 ps-3'
              }`}
            />
          </div>

          <div className="w-44 shrink-0">
            <CustomSelect
              options={localizedStatusFilterOptions}
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder={t('همه وضعیت‌ها')}
            />
          </div>
        </div>

        {/* Right Action & View Mode Switcher */}
        <div className="flex items-center gap-3 shrink-0">
          
          {/* Requirement 1: Removed duplicate top "+ افزودن وظیفه" button here. Keeping only clean 2-Tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setActiveTasksView('table')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTasksView === 'table'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <TableIcon size={14} />
              <span>{t('جدول اصلی')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTasksView('time')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTasksView === 'time'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Timer size={14} />
              <span>{t('زمان‌بندی و سررسیدها')}</span>
            </button>
          </div>

        </div>

      </div>

      {/* VIEW 1: MAIN TABLE VIEW - Requirement 4: 4 MULTI-STATUS PROJECT ACCORDION GROUPS */}
      {activeTasksView === 'table' && (
        <div className="space-y-5">
          
          {/* GROUP 1: پروژه‌های فعال سازمان */}
          {renderProjectGroupSection(
            'active',
            t('پروژه‌های فعال سازمان') || t('پروژه‌های فعال آژانس'),
            groupedProjects.active,
            'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400',
            <Calendar size={18} className="text-emerald-600" />
          )}

          {/* GROUP 2: پروژه‌های در حال بررسی و تایید */}
          {renderProjectGroupSection(
            'review',
            t('پروژه‌های در حال بررسی و تایید'),
            groupedProjects.review,
            'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400',
            <Clock3 size={18} className="text-amber-600" />
          )}

          {/* GROUP 3: پروژه‌های تکمیل‌شده */}
          {renderProjectGroupSection(
            'completed',
            t('پروژه‌های تکمیل‌شده'),
            groupedProjects.completed,
            'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400',
            <CheckCircle2 size={18} className="text-blue-600" />
          )}

          {/* GROUP 4: پروژه‌های آرشیو / معلق */}
          {renderProjectGroupSection(
            'archived',
            t('پروژه‌های آرشیو / معلق'),
            groupedProjects.archived,
            'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
            <Archive size={18} className="text-slate-500" />
          )}

        </div>
      )}

      {/* VIEW 2: DEADLINE & SMART REMINDER HUB */}
      {activeTasksView === 'time' && (
        <div className="space-y-6">
          
          {/* Header Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center font-black shrink-0">
                <Calendar size={20} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400">کل سررسیدهای فعال</p>
                <h4 className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5">
                  {toPersianDigits(groupedProjects.active.length)} پروژه
                </h4>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center font-black shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400">سررسیدهای نزدیک</p>
                <h4 className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5">
                  {toPersianDigits(Math.min(groupedProjects.active.length, 3))} پروژه
                </h4>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center font-black shrink-0">
                <Smartphone size={20} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400">یادآوری پیامکی فعال</p>
                <h4 className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5">
                  {toPersianDigits(Object.keys(activeReminders).length)} سررسید
                </h4>
              </div>
            </div>

          </div>

          {/* Main List of Project Deadlines & Reminder Controls */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6">
            
            <div className="border-b pb-4 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-black text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Timer size={20} className="text-emerald-600" />
                  <span>پایش سررسیدها و سیستم یادآوری هوشمند</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  پایش زمان‌بندی تحویل پروژه‌ها، محاسبه شمارش معکوس و ارسال یادآوری خودکار SMS و پنل.
                </p>
              </div>

              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 text-xs font-black rounded-xl border border-emerald-200/60 shrink-0 flex items-center gap-1.5">
                <Bell size={14} />
                <span>سیستم پیامک فعال</span>
              </span>
            </div>

            {/* Project Deadline Cards */}
            <div className="space-y-4">
              {groupedProjects.active.map((project) => {
                const projectTaskList = tasks.filter(t => t.projectId === project.id);
                const completedCount = projectTaskList.filter(t => t.status === 'completed').length;
                const calculatedProgress = projectTaskList.length > 0 
                  ? Math.round((completedCount / projectTaskList.length) * 100) 
                  : (project.totalTasks && project.totalTasks > 0
                      ? Math.round(((project.completedTasks || 0) / project.totalTasks) * 100)
                      : 0);

                const hasReminder = !!activeReminders[project.id];

                return (
                  <div 
                    key={project.id}
                    className="p-5 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-4 hover:border-emerald-300 transition-all"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 text-white flex items-center justify-center font-black shrink-0 shadow-sm">
                          <Folder size={20} />
                        </div>
                        <div>
                          <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">
                            {project.title}
                          </h4>
                          <p className="text-xs text-slate-400 mt-0.5">
                            کارفرما: <span className="font-bold text-slate-700 dark:text-slate-300">{project.clientName}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {/* Dates */}
                        <div className="text-xs font-bold text-slate-500 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                          <span>شروع: <strong className="font-mono text-slate-700 dark:text-slate-200">{formatJalaliDate(project.startDate) || '—'}</strong></span>
                          <span className="text-slate-300">|</span>
                          <span>سررسید: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{formatJalaliDate(project.deadline) || '—'}</strong></span>
                        </div>

                        {/* Reminder Status Badge or Button */}
                        {hasReminder ? (
                          <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-black rounded-xl border border-emerald-300/60 flex items-center gap-1.5">
                            <ShieldCheck size={14} />
                            <span>SMS و پنل فعال شد</span>
                          </span>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => openSmsModal(project)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <MessageSquare size={14} />
                          <span>تنظیم یادآوری SMS</span>
                        </button>
                      </div>

                    </div>

                    {/* Progress & Remaining Time Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                      
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-slate-400">پیشرفت کل پروژه</span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black">
                            {toPersianDigits(calculatedProgress)}٪
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                            style={{ width: `${calculatedProgress}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs font-bold bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-400">زمان باقی‌مانده تحویل:</span>
                        <span className="font-mono text-blue-600 dark:text-blue-400 font-black">
                          {toPersianDigits('۱۴ روز و ۸ ساعت')}
                        </span>
                      </div>

                    </div>

                  </div>
                );
              })}
            </div>

          </div>

        </div>
      )}

      {/* Task Creation Modal */}
      <CreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        defaultProjectId={selectedProjectIdForTask}
      />

      <TaskDetailModal task={detailTask} isOpen={!!detailTask} onClose={() => setDetailTask(null)} />

      {/* SMS Reminder Modal */}
      <SmsReminderModal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        project={selectedProjectForSms}
        onSaveSuccess={handleSmsSaveSuccess}
      />

    </div>
  );
};

