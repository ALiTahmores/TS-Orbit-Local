import {AssetManager} from '../../assets/AssetManager';
import { LocalImage } from '../../common/LocalImage';
import React, { useState, useMemo } from 'react';
import { useProject } from '../../../context/ProjectContext';
import { CustomSelect, CustomSelectOption } from '../../common/CustomSelect';

const deptOptions: CustomSelectOption[] = [
  { value: 'ui_ux', label: 'طراحی UI/UX' },
  { value: 'wp_dev', label: 'توسعه فرانت‌اند / وردپرس' },
  { value: 'content', label: 'سئو و محتوا' },
  { value: 'qa', label: 'تست QA' },
];

const priorityOptions: CustomSelectOption[] = [
  { value: 'low', label: 'پایین' },
  { value: 'medium', label: 'متوسط' },
  { value: 'high', label: 'بالا' },
  { value: 'critical', label: 'فوری / بحرانی' },
];
import { 
  TrendingUp, 
  CheckSquare, 
  CreditCard, 
  Users, 
  Plus, 
  Clock, 
  FolderOpen, 
  Link as LinkIcon, 
  Briefcase, 
  Activity, 
  ChevronLeft, 
  Sparkles, 
  Layers, 
  UserPlus, 
  X,
  ShieldCheck,
  Rocket
} from 'lucide-react';

const toPersianDigits = (n: string | number | null | undefined): string => {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (x) => farsiDigits[parseInt(x, 10)]);
};

const formatCurrency = (val?: string): string => {
  if (!val || !val.trim()) return 'تعریف نشده';
  return toPersianDigits(val);
};

const calculateDeadlineInfo = (deadlineStr?: string): { text: string; isNear: boolean } => {
  if (!deadlineStr || !deadlineStr.trim()) {
    return { text: 'بدون سررسید', isNear: false };
  }

  // Convert Persian digits to English digits for date calculation
  const normalized = deadlineStr.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
  const parts = normalized.split(/[\/\-]/).map(p => parseInt(p, 10));

  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    if (parts[0] > 1900) {
      const deadlineDate = new Date(parts[0], parts[1] - 1, parts[2]);
      const diffMs = deadlineDate.getTime() - Date.now();
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (daysLeft > 0) {
        return { text: `${toPersianDigits(daysLeft)} روز باقیمانده تا سررسید`, isNear: daysLeft <= 7 };
      } else if (daysLeft === 0) {
        return { text: 'امروز سررسید است', isNear: true };
      } else {
        return { text: `${toPersianDigits(Math.abs(daysLeft))} روز گذشته از سررسید`, isNear: true };
      }
    }
  }

  return { text: `سررسید: ${toPersianDigits(deadlineStr)}`, isNear: false };
};

export const OverviewTab: React.FC = () => {
  const { 
    selectedProject, 
    projects, 
    tasks, 
    notifications,
    teamMembers,
    currentUser, 
    createTask, 
    setActiveTab,
    t,
    getRoleLabel
  } = useProject();

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDept, setTaskDept] = useState('ui_ux');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [taskAssignedTo, setTaskAssignedTo] = useState(currentUser?.id || '');

  // Active project selection
  const currentProj = selectedProject || projects[0] || null;

  // Dynamic task metrics for current project
  const projectTasks = useMemo(() => {
    if (!currentProj) return [];
    return (tasks || []).filter(t => t && t.projectId === currentProj.id);
  }, [tasks, currentProj?.id]);

  const completedTasksCount = useMemo(() => {
    return (projectTasks || []).filter(t => t && t.status === 'completed').length;
  }, [projectTasks]);

  const inProgressTasksCount = useMemo(() => {
    return (projectTasks || []).filter(t => t && (t.status === 'inprogress' || (t.status as string) === 'in_progress')).length;
  }, [projectTasks]);

  const overdueTasksCount = useMemo(() => {
    return (projectTasks || []).filter(t => t && (t.status === 'blocked' || t.status === 'review' || t.status === 'cancelled')).length;
  }, [projectTasks]);

  const totalTasksCount = projectTasks.length;

  const progressPercentage = useMemo(() => {
    if (currentProj && typeof currentProj.progress === 'number' && currentProj.progress > 0) {
      return currentProj.progress;
    }
    if (totalTasksCount > 0) {
      return Math.round((completedTasksCount / totalTasksCount) * 100);
    }
    return 0;
  }, [currentProj?.progress, completedTasksCount, totalTasksCount]);

  // Active team members
  const projectMembers = useMemo(() => {
    if (teamMembers && teamMembers.length > 0) {
      return teamMembers;
    }
    return [];
  }, [teamMembers]);

  // Dynamic Roadmap phases
  const phases = useMemo(() => [
    {
      step: 1,
      title: 'طراحی UI/UX و پروتوتایپ',
      desc: 'تکمیل لایه‌بندی‌ها، وایرفریم‌ها و پروتوتایپ تعاملی در فیگما',
      status: progressPercentage >= 25 ? 'completed' : 'in_progress',
      progress: progressPercentage >= 25 ? 100 : Math.min(100, progressPercentage * 4)
    },
    {
      step: 2,
      title: 'توسعه فرانت‌اند و پیاده‌سازی',
      desc: 'کدنویسی کامپوننت‌های ری‌اکت، ریسپانسو و متحرکسازی فرانت‌اند',
      status: progressPercentage >= 60 ? 'completed' : progressPercentage >= 25 ? 'in_progress' : 'pending',
      progress: progressPercentage >= 60 ? 100 : progressPercentage < 25 ? 0 : Math.round(((progressPercentage - 25) / 35) * 100)
    },
    {
      step: 3,
      title: 'اتصال به دیتابیس و تست کیفیت',
      desc: 'پیکربندی APIها، تست امنیتی و پایش خطاهای احتمالی QA',
      status: progressPercentage >= 90 ? 'completed' : progressPercentage >= 60 ? 'in_progress' : 'pending',
      progress: progressPercentage >= 90 ? 100 : progressPercentage < 60 ? 0 : Math.round(((progressPercentage - 60) / 30) * 100)
    },
    {
      step: 4,
      title: 'تحویل نهایی و پورتال',
      desc: 'استقرار روی دامنه اصلی کلاینت و تحویل دسترسی پورتال اختصاصی',
      status: progressPercentage === 100 ? 'completed' : progressPercentage >= 90 ? 'in_progress' : 'pending',
      progress: progressPercentage === 100 ? 100 : progressPercentage < 90 ? 0 : Math.round(((progressPercentage - 90) / 10) * 100)
    }
  ], [progressPercentage]);

  // Dynamic Activity Timeline
  const activities = useMemo(() => {
    if (!currentProj) return [];

    // Filter notifications relevant to current project
    const relatedNotifs = (notifications || []).filter(n => 
      n.projectId === currentProj.id || (n.title && n.title.includes(currentProj.title))
    );

    if (relatedNotifs.length > 0) {
      return relatedNotifs.slice(0, 5).map(n => ({
        id: n.id,
        text: n.message || n.title,
        time: n.time || 'اخیراً',
        status: 'notification'
      }));
    }

    if (projectTasks.length > 0) {
      return projectTasks.slice(0, 5).map(t => ({
        id: t.id,
        text: t.status === 'completed'
          ? `${t.assignedTo || 'عضو تیم'} وظیفه «${t.title}» را تکمیل کرد`
          : `وظیفه «${t.title}» به ${t.assignedTo || 'عضو تیم'} ارجاع داده شد`,
        time: t.status === 'completed' ? 'تکمیل‌شده' : 'در حال انجام',
        status: t.status
      }));
    }

    return [];
  }, [notifications, projectTasks, currentProj?.id, currentProj?.title]);

  // Deadline info
  const deadlineInfo = calculateDeadlineInfo(currentProj?.deadline);

  // Handle new task submit
  const handleAddTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !currentProj) return;
    await createTask({
      projectId: currentProj.id,
      title: taskTitle.trim(),
      description: 'وظیفه جدید ثبت شده از پیش‌نمایش کلی پروژه',
      department: taskDept as any,
      assignedMemberIds:taskAssignedTo ? [taskAssignedTo] : [],
      priority: taskPriority,
      status: 'pending',
      startDate: new Date().toISOString().slice(0,10),
      deadline: currentProj.deadline || ''
    });
    setTaskTitle('');
    setIsTaskModalOpen(false);
  };

  if (!projects || projects.length === 0 || !currentProj || currentProj.id === 'no_project') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] p-8 sm:p-12 bg-white dark:bg-[#111322] border border-gray-200/70 dark:border-[#1E2235] rounded-2xl text-center space-y-6 shadow-2xl my-4 dir-rtl">
        <div className="w-20 h-20 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shadow-inner">
          <Briefcase size={36} className="stroke-[1.75]" />
        </div>
        
        <div className="max-w-md space-y-2 text-center">
          <h3 className="text-xl font-black text-slate-900 dark:text-white">
            {t('هنوز هیچ پروژه‌ای ایجاد نشده است')}
          </h3>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
            {t('اولین فضای کاری خود را ایجاد کنید تا پروژه‌ها، اعضا و جریان‌های کاری تیم خود را سازماندهی کنید.')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('open-create-project-modal'));
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
        >
          <Plus size={18} className="stroke-[2.5]" />
          <span>{t('+ ثبت اولین پروژه')}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 overflow-x-hidden space-y-5 p-1 text-start font-sans">

      {/* ====================================================================== */}
      {/* 1. HERO PROJECT BANNER & IDENTITY                                      */}
      {/* ====================================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Right Side: Title & Meta Badges */}
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {currentProj?.clientName && (
              <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/50 px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5">
                <Briefcase size={12} className="text-blue-600 dark:text-blue-400" />
                <span>کلاینت: {currentProj.clientName}</span>
              </span>
            )}

            <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full font-bold border border-slate-200/60 dark:border-slate-700/50">
              فضای کاری عملیاتی TS Orbit
            </span>

            <span className="text-[11px] bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-900/30 px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>در حال اجرا</span>
            </span>
          </div>

          <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5 truncate">
            <span className="p-2 bg-gradient-to-br from-blue-500/10 via-blue-600/15 to-slate-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
              <Sparkles size={20} />
            </span>
            <span className="truncate">{currentProj?.title || 'عنوان پروژه'}</span>
          </h1>
        </div>

        {/* Left Side: Deadline & Primary Trigger Button */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <div className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <Clock size={15} className="text-blue-600 dark:text-blue-400" />
            <span>{deadlineInfo.text}</span>
          </div>

          <button
            onClick={() => setIsTaskModalOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus size={16} className="stroke-[2.5]" />
            <span>+ ثبت وظیفه جدید برای این پروژه</span>
          </button>
        </div>
      </div>

      {/* QUICK NAVIGATION BAR */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('tasks')}
          className="px-3.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
        >
          <CheckSquare size={14} className="text-blue-600 dark:text-blue-400" />
          <span>وظایف و زمان‌بندی پروژه</span>
          <ChevronLeft size={12} className="text-slate-400" />
        </button>

        <button
          onClick={() => setActiveTab('portal')}
          className="px-3.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
        >
          <LinkIcon size={14} className="text-blue-600 dark:text-blue-400" />
          <span>پورتال اختصاصی کارفرما</span>
          <ChevronLeft size={12} className="text-slate-400" />
        </button>

        <button
          onClick={() => setActiveTab('files')}
          className="px-3.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
        >
          <FolderOpen size={14} className="text-blue-600 dark:text-blue-400" />
          <span>فایل‌ها و مستندات پروژه</span>
          <ChevronLeft size={12} className="text-slate-400" />
        </button>
      </div>

      {/* ====================================================================== */}
      {/* 2. 4 KEY PROJECT METRIC CARDS (GRID ROW 1)                             */}
      {/* ====================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 w-full">
        
        {/* CARD 1: OVERALL PROGRESS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3 flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 truncate">
              <TrendingUp size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="truncate">پیشرفت کل پروژه</span>
            </span>
            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md shrink-0">
              {toPersianDigits(progressPercentage)}٪
            </span>
          </div>

          <div className="space-y-2">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-700"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
              {totalTasksCount > 0 
                ? `${toPersianDigits(completedTasksCount)} وظیفه تکمیل‌شده از مجموع ${toPersianDigits(totalTasksCount)} وظیفه`
                : 'بدون وظیفه ثبت‌شده'}
            </p>
          </div>
        </div>

        {/* CARD 2: TASKS SUMMARY */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3 flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 truncate">
              <CheckSquare size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="truncate">خلاصه وضعیت وظایف</span>
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold shrink-0">
              کل: {toPersianDigits(totalTasksCount)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-900/30">
              <div className="text-xs font-bold">{toPersianDigits(completedTasksCount)}</div>
              <div className="text-[10px] font-bold mt-0.5">تکمیل</div>
            </div>

            <div className="p-1.5 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/40 dark:border-blue-900/30">
              <div className="text-xs font-bold">{toPersianDigits(inProgressTasksCount)}</div>
              <div className="text-[10px] font-bold mt-0.5">در انجام</div>
            </div>

            <div className="p-1.5 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/50">
              <div className="text-xs font-bold">{toPersianDigits(overdueTasksCount)}</div>
              <div className="text-[10px] font-bold mt-0.5">سایر</div>
            </div>
          </div>
        </div>

        {/* CARD 3: FINANCIAL & BUDGET */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3 flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 truncate">
              <CreditCard size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="truncate">بودجه و سلامت مالی</span>
            </span>
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md shrink-0">
              {currentProj?.budget ? `${toPersianDigits(progressPercentage)}٪ تخصیص` : 'بدون بودجه'}
            </span>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
              <span>بودجه کل: </span>
              <span className="text-blue-600 dark:text-blue-400">{formatCurrency(currentProj?.budget)}</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-700" 
                style={{ width: `${currentProj?.budget ? progressPercentage : 0}%` }} 
              />
            </div>
          </div>
        </div>

        {/* CARD 4: ASSIGNED TEAM STACK */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3 flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 truncate">
              <Users size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="truncate">تیم تخصصی پروژه</span>
            </span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
              {toPersianDigits(projectMembers.length)} عضو
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 gap-2">
            <div className="flex items-center -space-x-2 space-x-reverse min-w-0">
              {projectMembers.length > 0 ? (
                projectMembers.map((m, idx) => (
                  <LocalImage
                    key={m.id || idx}
                    src={m.avatar || '/avatars/avatar-7.svg'}
                    alt={m.name}
                    title={`${m.name} — ${getRoleLabel(m.role)}`}
                    className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 object-cover shadow-2xs"
                  />
                ))
              ) : (
                <span className="text-xs text-slate-400 font-medium">بدون عضو</span>
              )}
            </div>

            <button
              onClick={() => setActiveTab('team')}
              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-700 dark:text-slate-300 hover:text-blue-600 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1 cursor-pointer shrink-0"
            >
              <UserPlus size={12} />
              <span>+ افزودن عضو</span>
            </button>
          </div>
        </div>

      </div>

      {/* ====================================================================== */}
      {/* 3. SPLIT WORKSPACE: ROADMAP & ACTIVITY TIMELINE (ROW 2)               */}
      {/* ====================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 w-full">

        {/* ROADMAP & MILESTONES (XL: COL-SPAN-7) */}
        <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4 min-w-0">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Layers size={18} className="text-blue-600 dark:text-blue-400" />
              <span>مراحل و فازهای اصلی پروژه</span>
            </h3>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
              {toPersianDigits(phases.length)} فاز کلیدی
            </span>
          </div>

          {totalTasksCount === 0 ? (
            <div className="py-10 px-4 text-center space-y-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                هیچ فاز یا پیشرفتی ثبت نشده است. جهت شروع، اولین وظیفه پروژه را ایجاد کنید.
              </p>
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>ایجاد اولین وظیفه</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {phases.map((phase) => {
                const isCompleted = phase.status === 'completed';
                const isInProgress = phase.status === 'in_progress';

                return (
                  <div 
                    key={phase.step} 
                    className={`p-3.5 rounded-xl border space-y-2 transition-all ${
                      isCompleted 
                        ? 'border-emerald-200/60 dark:border-emerald-900/30 bg-emerald-500/5 dark:bg-emerald-950/10'
                        : isInProgress
                        ? 'border-blue-200/80 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20'
                        : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isCompleted
                            ? 'bg-emerald-600 text-white'
                            : isInProgress
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          {toPersianDigits(phase.step)}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{phase.title}</h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{phase.desc}</p>
                        </div>
                      </div>

                      <span className={`px-2.5 py-0.5 font-bold text-[11px] rounded-full flex items-center gap-1 shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-900/30'
                          : isInProgress
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/50 dark:border-blue-900/30'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {isCompleted ? (
                          <>
                            <ShieldCheck size={13} />
                            <span>تکمیل‌شده</span>
                          </>
                        ) : isInProgress ? (
                          <>
                            <Rocket size={13} />
                            <span>در حال انجام ({toPersianDigits(phase.progress)}٪)</span>
                          </>
                        ) : (
                          <>
                            <Clock size={13} />
                            <span>در انتظار</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="w-full bg-slate-200/60 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ${
                          isCompleted 
                            ? 'bg-emerald-600 dark:bg-emerald-500' 
                            : isInProgress 
                            ? 'bg-blue-600 dark:bg-blue-500' 
                            : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                        style={{ width: `${phase.progress}%` }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ACTIVITY TIMELINE (XL: COL-SPAN-5) */}
        <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4 min-w-0">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Activity size={18} className="text-blue-600 dark:text-blue-400" />
              <span>جریان آخرین تغییرات پروژه</span>
            </h3>
            {activities.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            )}
          </div>

          {activities.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              هنوز هیچ فعالیتی برای این پروژه ثبت نشده است
            </div>
          ) : (
            <div className="relative ps-4 border-s-2 border-slate-200 dark:border-slate-800 space-y-4 my-2">
              {activities.map((act) => (
                <div key={act.id} className="relative">
                  <span className="absolute -start-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400 border-2 border-white dark:border-slate-900" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug">
                      {act.text}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                      <Clock size={11} />
                      <span>{act.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ====================================================================== */}
      {/* QUICK TASK CREATION MODAL                                             */}
      {/* ====================================================================== */}
      {isTaskModalOpen && currentProj && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-start animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span className="p-1.5 bg-blue-100 dark:bg-blue-950 text-blue-600 rounded-lg">
                  <Plus size={16} />
                </span>
                ثبت وظیفه جدید برای {currentProj.title}
              </h3>
              <button 
                onClick={() => setIsTaskModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddTaskSubmit} className="space-y-3 text-xs font-medium">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">عنوان وظیفه</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="مثال: پیاده‌سازی صفحه اصلی"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">دپارتمان</label>
                  <CustomSelect
                    options={deptOptions}
                    value={taskDept}
                    onChange={(val) => setTaskDept(val)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">اولویت</label>
                  <CustomSelect
                    options={priorityOptions}
                    value={taskPriority}
                    onChange={(val) => setTaskPriority(val as any)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">مسئول انجام</label>
                <CustomSelect
                  options={
                    projectMembers.length > 0 
                      ? projectMembers.map(m => ({ value: (m as any).userId || m.id, label: m.name }))
                      : []
                  }
                  value={taskAssignedTo}
                  onChange={(val) => setTaskAssignedTo(val)}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer transition-all shadow-xs"
                >
                  ایجاد وظیفه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {currentProj&&<AssetManager key={currentProj.id} projectId={currentProj.id} compact/>}
    </div>
  );
};


