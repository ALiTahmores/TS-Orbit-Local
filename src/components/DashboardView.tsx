import { apiFetch } from '../lib/api';
import React, { useState, useMemo } from 'react';
import { useProject } from '../context/ProjectContext';
import { Task, Project } from '../types';
import { CustomSelect, CustomSelectOption } from './common/CustomSelect';
import { CreateProjectModal } from './projects/CreateProjectModal';
import { PremiumAnalytics } from './widgets/PremiumAnalytics';
import { ProjectBlockersReviewWidget } from './widgets/ProjectBlockersReviewWidget';
import { TeamWorkloadBalanceWidget } from './widgets/TeamWorkloadBalanceWidget';
import { WeeklyTimesheetWidget } from './widgets/WeeklyTimesheetWidget';
import { TeamGamificationLeaderboardWidget } from './widgets/TeamGamificationLeaderboardWidget';
import { 
  Activity, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  User, 
  TrendingUp, 
  Calendar, 
  ArrowUpRight,
  Database,
  Plus,
  FolderPlus,
  CheckCircle,
  Check,
  ExternalLink,
  Users,
  Layers,
  Star,
  CheckSquare,
  ShieldCheck,
  Zap,
  Flame,
  LineChart as LucideLineChart,
  Settings,
  Bell,
  Sparkles,
  Search,
  CheckSquare as CheckedIcon,
  GripVertical,
  RotateCcw
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart,
  Area,
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell, 
  Legend,
  Line,
  ComposedChart
} from 'recharts';

// Reusable design system cards
import { 
  MetricCard, 
  ChartCard, 
  ProjectCard, 
  TaskCard, 
  TeamCard, 
  ActivityCard, 
  QuickActionCard, 
  Dialog 
} from './DesignSystem';

export const DashboardView: React.FC = () => {
  const { 
    projects, 
    tasks, 
    teamMembers, 
    notifications,
    updateTaskStatus,
    setSelectedProject,
    setActiveTab,
    selectedProject,
    createProject,
    deleteProject,
    activeSubTab,
    setActiveSubTab,
    locale,
    t,
    currentUser,
    openNewProjectModal
  } = useProject();

  const isRtl = locale === 'fa';

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);

  React.useEffect(() => {
    if (currentUser?.systemRole === 'ADMIN') {
      const token = localStorage.getItem('token');
      if (token) {
        apiFetch('/api/owner/approval-stats', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        .then(res => {
          if (res.ok) return res.json();
        })
        .then(data => {
          if (data && typeof data.pendingCount === 'number') {
            setPendingApprovalsCount(data.pendingCount);
          }
        })
        .catch(() => {
          // Silently handle fetch failure
        });
      }
    }
  }, [currentUser]);
  
  // Create Project Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newBudget, setNewBudget] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newWebsiteUrl, setNewWebsiteUrl] = useState('');

  // Local feedback status indicators
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [lastActionTime, setLastActionTime] = useState<string | null>(null);

  // Drag-and-Drop state for bottom dashboard cards
  const STORAGE_KEY = 'dashboard_card_order_v8';
  const DEFAULT_CARD_ORDER = useMemo(() => [
    'quick_projects',
    'team_workload',
    'blockers_review',
    'tasks_priority',
    'activity',
    'realtime_sync',
    'weekly_timesheet'
  ], []);

  const [cardOrder, setCardOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 7 && parsed[0] === 'quick_projects') {
          return parsed;
        }
      }
    } catch {
      // Fallback to default
    }
    return [
      'quick_projects',
      'team_workload',
      'blockers_review',
      'tasks_priority',
      'activity',
      'realtime_sync',
      'weekly_timesheet'
    ];
  });

  const [isLayoutEditable, setIsLayoutEditable] = useState<boolean>(false);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedCardId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCardId !== id) {
      setDragOverCardId(id);
    }
  };

  const handleDragLeave = (e: React.DragEvent, id: string) => {
    if (dragOverCardId === id) {
      setDragOverCardId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedCardId;
    if (!sourceId || sourceId === targetId) {
      setDraggedCardId(null);
      setDragOverCardId(null);
      return;
    }

    const newOrder = [...cardOrder];
    const sourceIndex = newOrder.indexOf(sourceId);
    const targetIndex = newOrder.indexOf(targetId);

    if (sourceIndex !== -1 && targetIndex !== -1) {
      newOrder.splice(sourceIndex, 1);
      newOrder.splice(targetIndex, 0, sourceId);
      setCardOrder(newOrder);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
      } catch {
        // Silently handle storage error
      }
    }

    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  const handleDragEnd = () => {
    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  const handleResetCardOrder = () => {
    setCardOrder(DEFAULT_CARD_ORDER);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('dashboard_bottom_card_order');
    } catch {
      // Silently handle storage error
    }
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createProject(newTitle.trim(), newDesc.trim(), newBudget, newDeadline, newClient, newWebsiteUrl.trim());
      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      setNewWebsiteUrl('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSync = () => {
    setSyncStatus('syncing');
    setTimeout(() => {
      setSyncStatus('success');
      setLastActionTime(new Date().toLocaleTimeString('fa-IR'));
      setTimeout(() => setSyncStatus(null), 3000);
    }, 1500);
  };

  const safeProjects = projects || [];
  const safeTasks = tasks || [];
  const hasProjects = safeProjects.length > 0 && selectedProject?.id && selectedProject.id !== 'no_project';

  // Stats calculations
  const activeProjectsCount = safeProjects.filter(p => p && p.status === 'active').length;
  const criticalTasksCount = safeTasks.filter(t => t && t.priority === 'high' && t.status !== 'completed').length;
  const totalTasksCount = safeTasks.length;
  const completedTasksCount = safeTasks.filter(t => t && t.status === 'completed').length;

  const completionRate = totalTasksCount > 0 
    ? Math.round((completedTasksCount / totalTasksCount) * 100) 
    : 0;

  // Chart trend data points matching weekly shifts
  const trendData = useMemo(() => {
    return [
      { name: isRtl ? 'شنبه' : 'Sat', 'کارایی': 65, 'تسک': 4 },
      { name: isRtl ? '۱شنبه' : 'Sun', 'کارایی': 78, 'تسک': 6 },
      { name: isRtl ? '۲شنبه' : 'Mon', 'کارایی': 82, 'تسک': 8 },
      { name: isRtl ? '۳شنبه' : 'Tue', 'کارایی': 74, 'تسک': 5 },
      { name: isRtl ? '۴شنبه' : 'Wed', 'کارایی': 90, 'تسک': 11 },
      { name: isRtl ? '۵شنبه' : 'Thu', 'کارایی': 85, 'تسک': 9 },
      { name: isRtl ? 'جمعه' : 'Fri', 'کارایی': 95, 'تسک': 12 },
    ];
  }, [isRtl]);

  const departmentData = useMemo(() => {
    const counts: Record<string, number> = {
      'ui_ux': 0,
      'wp_dev': 0,
      'content': 0,
      'seo': 0,
      'qa': 0
    };
    tasks.forEach(t => {
      const d = t.department || 'wp_dev';
      if (counts[d] !== undefined) counts[d]++;
    });

    return [
      { name: isRtl ? 'رابط کاربری' : 'UI/UX Design', value: counts.ui_ux || 2, color: '#6C63FF' },
      { name: isRtl ? 'برنامه‌نویسی و توسعه' : 'Systems Engineering', value: counts.wp_dev || 4, color: '#F5D76E' },
      { name: isRtl ? 'تولید محتوا' : 'Copywriting', value: counts.content || 3, color: '#3b82f6' },
      { name: isRtl ? 'بهینه‌سازی سئو' : 'SEO Core', value: counts.seo || 2, color: '#10b981' },
      { name: isRtl ? 'کنترل کیفی QA' : 'QA Testing', value: counts.qa || 1, color: '#ef4444' },
    ];
  }, [tasks, isRtl]);

  const workshopGrowthData = useMemo(() => {
    return [
      { 
        name: isRtl ? 'فروردین' : 'Apr', 
        'سرعت و راندمان لود': 68, 
        'سلامت سئو و امنیت': 72, 
        'تسک‌های بسته شده': 14,
        'پایداری سرور': 98
      },
      { 
        name: isRtl ? 'اردیبهشت' : 'May', 
        'سرعت و راندمان لود': 74, 
        'سلامت سئو و امنیت': 78, 
        'تسک‌های بسته شده': 20,
        'پایداری سرور': 99
      },
      { 
        name: isRtl ? 'خرداد' : 'Jun', 
        'سرعت و راندمان لود': 80, 
        'سلامت سئو و امنیت': 81, 
        'تسک‌های بسته شده': 28,
        'پایداری سرور': 99
      },
      { 
        name: isRtl ? 'تیر' : 'Jul', 
        'سرعت و راندمان لود': 85, 
        'سلامت سئو و امنیت': 86, 
        'تسک‌های بسته شده': 36,
        'پایداری سرور': 99
      },
      { 
        name: isRtl ? 'مرداد' : 'Aug', 
        'سرعت و راندمان لود': 91, 
        'سلامت سئو و امنیت': 90, 
        'تسک‌های بسته شده': 45,
        'پایداری سرور': 100
      },
      { 
        name: isRtl ? 'شهریور' : 'Sep', 
        'سرعت و راندمان لود': 97, 
        'سلامت سئو و امنیت': 95, 
        'تسک‌های بسته شده': 58,
        'پایداری سرور': 100
      },
    ];
  }, [isRtl]);

  // Map of all bottom reorderable dashboard cards
  const cardsMap: Record<string, { colSpanClass: string; render: () => React.ReactNode }> = useMemo(() => {
    const actCard = {
      colSpanClass: "lg:col-span-1 col-span-1",
      render: () => (
        <>
          <div className="flex justify-between items-start">
            <h3 className="text-[11px] font-black text-text-secondary dark:text-slate-400 uppercase tracking-wider">
              {isRtl ? 'فعالیت‌های اخیر سامانه' : 'System Activity Log'}
            </h3>
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 bg-brand-accent/10 text-brand-accent rounded-lg"><Activity size={13} /></div>
              <div className={`p-1 transition-all duration-200 ${isLayoutEditable ? 'opacity-100 pointer-events-auto text-amber-500 dark:text-amber-400 cursor-grab active:cursor-grabbing hover:scale-110' : 'opacity-0 pointer-events-none text-text-secondary/40'}`} title={isRtl ? 'جابه‌جایی کارت' : 'Drag to reorder'}>
                <GripVertical size={14} />
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center py-2 relative">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="var(--border-primary)" strokeWidth="8" fill="transparent" />
                <circle cx="50" cy="50" r="40" stroke="var(--brand-accent)" strokeWidth="8" strokeDasharray={`${2 * Math.PI * 40}`} strokeDashoffset={`${2 * Math.PI * 40 * (1 - completionRate / 100)}`} strokeLinecap="round" fill="transparent" className="transition-all duration-700" />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-xl font-black font-mono text-text-primary dark:text-white">{completionRate}%</span>
                <span className="text-[8px] font-bold text-text-secondary dark:text-slate-400">{isRtl ? 'شاخص بسته شدن' : 'Done'}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-bold text-text-secondary dark:text-slate-400 border-t border-border-primary/50 dark:border-white/5 pt-2">
            <span>{isRtl ? 'کل وظایف:' : 'Total Tasks:'} <span className="text-text-primary dark:text-white font-mono">{totalTasksCount}</span></span>
            <span>{isRtl ? 'انجام شده:' : 'Done:'} <span className="text-brand-accent font-mono">{completedTasksCount}</span></span>
          </div>
        </>
      )
    };

    const teamWorkloadCard = {
      colSpanClass: "lg:col-span-2 col-span-1",
      render: () => (
        <TeamWorkloadBalanceWidget 
          borderless={true}
        />
      )
    };

    const projectsCard = {
      colSpanClass: "lg:col-span-1 col-span-1",
      render: () => (
        <>
          <div className="flex justify-between items-center">
            <h3 className="text-[11px] font-black text-text-secondary dark:text-slate-400 uppercase tracking-wider">
              {isRtl ? 'پروژه‌های فعال با دسترسی سریع' : 'Quick Projects List'}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[9px] bg-hover-overlay dark:bg-white/5 px-2.5 py-1 rounded-lg text-text-primary dark:text-white font-mono font-black">{projects.length} sites</span>
              <div className={`p-1 transition-all duration-200 ${isLayoutEditable ? 'opacity-100 pointer-events-auto text-amber-500 dark:text-amber-400 cursor-grab active:cursor-grabbing hover:scale-110' : 'opacity-0 pointer-events-none text-text-secondary/40'}`} title={isRtl ? 'جابه‌جایی کارت' : 'Drag to reorder'}>
                <GripVertical size={14} />
              </div>
            </div>
          </div>

          <div className="space-y-3 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
            {projects.slice(0, 3).map(p => {
              const isCurrent = p.id === selectedProject.id;
              const progressPct = p.progress || 0;
              
              return (
                <ProjectCard 
                  key={p.id}
                  title={p.title}
                  subtitle={p.description}
                  progress={progressPct}
                  isActive={isCurrent}
                  onClick={() => setSelectedProject(p)}
                />
              );
            })}
          </div>

          <div className="border-t border-border-primary/50 dark:border-white/5 pt-2 flex justify-between items-center text-[10px] font-bold text-text-secondary dark:text-slate-400">
            <span>{isRtl ? 'جهت نمایش آمار روی پروژه کلیک کنید' : 'Click to select project'}</span>
            <button onClick={() => setActiveTab('projects')} className="text-brand-accent hover:underline flex items-center gap-0.5">
              <span>{isRtl ? 'مدیریت تمام پروژه‌ها' : 'Manage Projects'}</span>
              <ArrowUpRight size={11} />
            </button>
          </div>
        </>
      )
    };

    const tasksCard = {
      colSpanClass: "lg:col-span-1 col-span-1",
      render: () => (
        <>
          <div className="flex justify-between items-center">
            <h3 className="text-[11px] font-black text-text-secondary dark:text-slate-400 uppercase tracking-wider">
              {isRtl ? 'وظایف با اولویت بالا' : 'High Priority Tasks'}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[9px] bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/15 px-2 py-0.5 rounded font-black font-mono">
                {criticalTasksCount} {isRtl ? 'کارهای فوری' : 'HIGH PRIORITY'}
              </span>
              <div className={`p-1 transition-all duration-200 ${isLayoutEditable ? 'opacity-100 pointer-events-auto text-amber-500 dark:text-amber-400 cursor-grab active:cursor-grabbing hover:scale-110' : 'opacity-0 pointer-events-none text-text-secondary/40'}`} title={isRtl ? 'جابه‌جایی کارت' : 'Drag to reorder'}>
                <GripVertical size={14} />
              </div>
            </div>
          </div>

          <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
            {safeTasks.filter(t => t && t.projectId === selectedProject.id && t.status !== 'completed').slice(0, 3).map(task => (
              <TaskCard 
                key={task.id}
                title={task.title}
                priority={task.priority as any}
                assignedTo={task.assignedTo}
                onComplete={() => updateTaskStatus(task.id, 'completed')}
              />
            ))}

            {safeTasks.filter(t => t && t.projectId === selectedProject.id && t.status !== 'completed').length === 0 && (
              <div className="py-6 text-center text-xs text-text-secondary dark:text-slate-400">
                🎉 {isRtl ? 'تمام وظایف اولویت‌دار این پروژه با موفقیت انجام شده است.' : 'All high priority items are completed.'}
              </div>
            )}
          </div>

          <div className="border-t border-border-primary/50 dark:border-white/5 pt-2 flex justify-between items-center text-[10px] font-bold text-text-secondary dark:text-slate-400">
            <span>{isRtl ? 'برای بستن کار، دکمه تیک را بزنید' : 'Toggle checkbox to complete tasks'}</span>
            <button onClick={() => setActiveTab('tasks')} className="text-brand-accent hover:underline flex items-center gap-0.5">
              <span>{isRtl ? 'برو به برد تسک‌ها' : 'Task Board'}</span>
              <ArrowUpRight size={11} />
            </button>
          </div>
        </>
      )
    };

    const syncCard = {
      colSpanClass: "lg:col-span-1 col-span-1",
      render: () => (
        <>
          <div className="flex justify-between items-center">
            <h3 className="text-[11px] font-black text-text-secondary dark:text-slate-400 uppercase tracking-wider">
              {isRtl ? 'وضعیت همگام‌سازی زنده' : 'Realtime Sync Monitor'}
            </h3>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <div className={`p-1 transition-all duration-200 ${isLayoutEditable ? 'opacity-100 pointer-events-auto text-amber-500 dark:text-amber-400 cursor-grab active:cursor-grabbing hover:scale-110' : 'opacity-0 pointer-events-none text-text-secondary/40'}`} title={isRtl ? 'جابه‌جایی کارت' : 'Drag to reorder'}>
                <GripVertical size={14} />
              </div>
            </div>
          </div>

          <div className="space-y-3 py-1">
            {teamMembers.slice(0, 3).map(m => (
              <TeamCard 
                key={m.id}
                name={m.name}
                role={m.department || 'TS Orbit Specialist'}
                isOnline={m.status === 'online'}
                taskCount={m.completedCount}
              />
            ))}
          </div>

          <div className="border-t border-border-primary/50 dark:border-white/5 pt-2 flex justify-between items-center text-[10px] font-bold text-text-secondary dark:text-slate-400">
            <span>{isRtl ? 'پرسنل در حال پایش سیستم' : 'Active tracking session'}</span>
            <button onClick={() => { setActiveTab('projects'); setActiveSubTab('team'); }} className="text-brand-accent hover:underline">
              {isRtl ? 'تیم فنی' : 'View Team'}
            </button>
          </div>
        </>
      )
    };

    const kpiCard = {
      colSpanClass: "lg:col-span-1 col-span-1",
      render: () => (
        <>
          <div className="flex justify-between items-center">
            <h3 className="text-[11px] font-black text-text-secondary dark:text-slate-400 uppercase tracking-wider">
              {isRtl ? 'خلاصه شاخص‌های کلیدی عملکرد' : 'KPI Summary Widget'}
            </h3>
            <div className="flex items-center gap-1.5">
              <Zap size={12} className="text-[#F5D76E]" />
              <div className={`p-1 transition-all duration-200 ${isLayoutEditable ? 'opacity-100 pointer-events-auto text-amber-500 dark:text-amber-400 cursor-grab active:cursor-grabbing hover:scale-110' : 'opacity-0 pointer-events-none text-text-secondary/40'}`} title={isRtl ? 'جابه‌جایی کارت' : 'Drag to reorder'}>
                <GripVertical size={14} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 py-1">
            <QuickActionCard 
              title={isRtl ? 'همگام‌سازی داده‌ها' : 'Data Sync'}
              icon={<Activity size={10} />}
              onClick={handleQuickSync}
            />
            <QuickActionCard 
              title={isRtl ? 'تازه‌سازی حافظه' : 'Purge Cache'}
              icon={<Database size={10} />}
              bgClass="bg-[#F5D76E]/15 text-[#F5D76E]"
              onClick={() => {
                setSyncStatus('caching');
                setTimeout(() => setSyncStatus(null), 1500);
              }}
            />
            <QuickActionCard 
              title={isRtl ? 'بهینه‌سازی داده‌ها' : 'Optimize DB'}
              icon={<CheckCircle size={10} />}
              bgClass="bg-emerald-500/15 text-emerald-500 dark:text-emerald-400"
              onClick={() => {
                setSyncStatus('optimizing');
                setTimeout(() => setSyncStatus(null), 1500);
              }}
            />
            <QuickActionCard 
              title={isRtl ? 'پروژه سازمانی' : 'New Project'}
              icon={<Plus size={10} />}
              bgClass="bg-blue-500/15 text-blue-500"
              onClick={openNewProjectModal}
            />
          </div>

          <div className="text-center h-4 flex items-center justify-center text-[9px] font-mono text-emerald-400 font-bold">
            {syncStatus === 'syncing' && <span>🔄 Connecting gateway...</span>}
            {syncStatus === 'success' && <span>✅ Synchronized successfully at {lastActionTime}</span>}
            {syncStatus === 'caching' && <span>⚡ Purging cache...</span>}
            {syncStatus === 'optimizing' && <span>📦 Re-indexing...</span>}
          </div>
        </>
      )
    };

    const blockersReviewCard = {
      colSpanClass: "lg:col-span-2 col-span-1",
      render: () => (
        <ProjectBlockersReviewWidget 
          borderless={true}
          onNavigateToTasks={() => {
            setActiveTab('tasks');
            setActiveSubTab('kanban');
          }}
        />
      )
    };

    const timesheetCard = {
      colSpanClass: "lg:col-span-1 col-span-1",
      render: () => (
        <WeeklyTimesheetWidget 
          borderless={true}
        />
      )
    };

    return {
      blockers_review: blockersReviewCard,
      review_pipeline: blockersReviewCard,
      activity: actCard,
      productivity_score: actCard,
      team_workload: teamWorkloadCard,
      system_health: teamWorkloadCard,
      wp_diagnostics: teamWorkloadCard,
      quick_projects: projectsCard,
      workspace_projects: projectsCard,
      tasks_priority: tasksCard,
      priority_checklist: tasksCard,
      realtime_sync: syncCard,
      active_specialists: syncCard,
      weekly_timesheet: timesheetCard,
      kpi_summary: timesheetCard,
      operational_actions: timesheetCard,
    };
  }, [
    completionRate, 
    totalTasksCount, 
    completedTasksCount, 
    selectedProject, 
    projects, 
    tasks, 
    criticalTasksCount, 
    teamMembers, 
    syncStatus, 
    lastActionTime, 
    isRtl, 
    isLayoutEditable, 
    updateTaskStatus, 
    setSelectedProject, 
    setActiveTab, 
    setActiveSubTab, 
    setShowCreateModal, 
    handleQuickSync
  ]);

  if (!hasProjects) {
    return (
      <div className="space-y-6 text-right w-full" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border-primary/50">
          <div>
            <h2 className="text-xl font-black text-text-primary dark:text-white flex items-center gap-2">
              <Zap className="text-brand-accent animate-pulse" size={20} />
              {isRtl ? 'میز فرمان و داشبورد مدیریتی' : 'Operations Command & Executive Dashboard'}
            </h2>
            <p className="text-xs text-text-secondary dark:text-slate-400 mt-1">
              {isRtl ? 'پایش زنده پیشرفت طرح‌ها، تخصیص استراتژیک وظایف و ارزیابی بهره‌وری دپارتمان‌های سازمانی' : 'Real-time monitoring of initiatives, strategic task allocation, and departmental productivity assessment'}
            </p>
          </div>
          <button 
            onClick={openNewProjectModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl border border-blue-400/20 shadow-xs hover:shadow-md hover:shadow-blue-500/15 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 text-sm cursor-pointer shrink-0"
          >
            <Plus size={16} />
            <span>{isRtl ? '+ ثبت اولین پروژه' : '+ Register First Project'}</span>
          </button>
        </div>

        <div className="py-16 bg-white dark:bg-[#111322] border border-gray-200/70 dark:border-[#1E2235] rounded-2xl shadow-sm dark:shadow-md flex flex-col items-center justify-center text-center p-8 max-w-lg mx-auto">
          <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-600 mb-4 animate-bounce">
            <LucideLineChart size={28} />
          </div>
          <h3 className="text-sm font-black text-text-primary dark:text-white">
            {isRtl ? 'هنوز پروژه‌ای در این فضای کاری تعریف نشده است' : 'No projects registered in this workspace yet'}
          </h3>
          <p className="text-xs text-text-secondary dark:text-slate-450 max-w-sm leading-relaxed mt-2">
            {isRtl ? 'جهت برنامه‌ریزی هدفمند، زمان‌بندی تسک‌ها بین اعضای تیم و دریافت گزارش‌های تحلیلی، اولین پروژه سازمانی خود را ثبت کنید.' : 'Create your first enterprise project to schedule tasks, assign teams, and monitor organizational performance.'}
          </p>
          <button
            onClick={openNewProjectModal}
            className="mt-5 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl border border-blue-400/20 shadow-xs hover:shadow-md hover:shadow-blue-500/15 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 text-sm cursor-pointer"
          >
            <Plus size={16} />
            <span>{isRtl ? '+ ثبت پروژه جدید' : '+ New Project'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-right w-full" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      
      {/* 1. TOP HEADER BRANDING & ACTION BLOCK */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-5 border-b border-border-primary/50 dark:border-white/5 shrink-0">
        <div>
          <div className="flex items-center gap-2 justify-start">
            <h2 className="text-lg font-black text-text-primary dark:text-white tracking-tight flex items-center gap-2">
              <Sparkles size={18} className="text-brand-accent" />
              {isRtl ? 'میز فرمان و داشبورد مدیریتی' : 'Operations Command & Executive Dashboard'}
            </h2>
            <span className="text-[10px] font-black bg-brand-accent/15 text-brand-accent px-2.5 py-0.5 rounded-full border border-brand-accent/20">
              {selectedProject.title}
            </span>
          </div>
          <p className="text-xs text-text-secondary dark:text-slate-400 mt-1.5 leading-relaxed text-right">
            {isRtl ? 'پایش زنده پیشرفت طرح‌ها، تخصیص استراتژیک وظایف و ارزیابی بهره‌وری دپارتمان‌های سازمانی' : 'Real-time monitoring of initiatives, strategic task allocation, and departmental productivity assessment'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-stretch lg:self-auto justify-end w-full sm:w-auto">
          <div className="w-56 sm:w-64 shrink-0">
            <CustomSelect 
              options={projects.map(p => ({ value: p.id, label: p.title }))}
              value={selectedProject.id}
              onChange={(val) => {
                const matched = projects.find(p => p.id === val);
                if (matched) setSelectedProject(matched);
              }}
              onDeleteOption={(val, e) => {
                const matched = projects.find(p => p.id === val);
                const title = matched ? matched.title : '';
                if (window.confirm(isRtl ? `آیا از حذف پروژه "${title}" اطمینان دارید؟` : `Are you sure you want to delete project "${title}"?`)) {
                  deleteProject(val);
                }
              }}
              deleteTooltip={isRtl ? "حذف پروژه" : "Delete project"}
              buttonClassName="text-xs sm:text-sm font-extrabold shadow-xs py-2"
            />
          </div>

          <button 
            onClick={openNewProjectModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl border border-blue-400/20 shadow-xs hover:shadow-md hover:shadow-blue-500/15 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 text-sm cursor-pointer shrink-0"
          >
            <Plus size={16} />
            <span>{isRtl ? '+ ثبت پروژه جدید' : '+ New Project'}</span>
          </button>
        </div>
      </div>

      {/* SYSTEM OWNER PENDING REGISTRATIONS ALERT BANNER */}
      {currentUser?.systemRole === 'ADMIN' && pendingApprovalsCount > 0 && (
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-5 rounded-[24px] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg border border-amber-500/30 animate-pulse text-right">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-white/10 rounded-2xl">
              <Users size={20} className="text-amber-100" />
            </div>
            <div>
              <h4 className="font-black text-sm">درخواست‌های عضویت جدید در انتظار تایید صلاحیت</h4>
              <p className="text-xs text-amber-100 mt-1">تعداد {pendingApprovalsCount} کاربر جدید ثبت‌نام کرده‌اند و در انتظار بررسی مدرک، تایید هویت و تخصیص نقش هستند.</p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTab('approvals');
              setActiveSubTab('approval_queue');
            }}
            className="px-5 py-2.5 bg-white text-amber-900 font-black text-xs rounded-xl hover:bg-amber-50 transition-all cursor-pointer shadow-md shrink-0"
          >
            ورود به مرکز تایید صلاحیت پرسنل
          </button>
        </div>
      )}

      {/* 2. TOP CHARTS ROW */}
      <PremiumAnalytics 
        tasks={tasks}
        projects={projects}
        selectedProject={selectedProject}
        isRtl={isRtl}
      />

      {/* 2.5 TEAM GAMIFICATION & LEADERBOARD WIDGET */}
      <TeamGamificationLeaderboardWidget />

      {/* 3. BOTTOM METRIC CARDS SECTION (INTERACTIVE DRAGGABLE REORDERABLE GRID) */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between w-full mb-4 pb-2 border-b border-slate-200/60 dark:border-slate-800 font-['Vazirmatn']">
          
          {/* RTL Right Side: Section Title */}
          <h3 className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-100">
            {isRtl ? 'کارت‌ها و ویجت‌های عملیاتی' : 'Operational Metrics & Widgets'}
          </h3>

          {/* RTL Left Side: Control Bar & Helper Text */}
          <div className="flex items-center gap-3">
            {/* Helper Guidance Badge */}
            {!isLayoutEditable ? (
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                {isRtl ? 'جهت تغییر چیدمان دکمه ویرایش را بزنید' : 'Click edit to customize layout'}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 text-xs font-semibold border border-amber-200/60 dark:border-amber-800/60 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                {isRtl ? 'حالت جابه‌جایی فعال است (کارت‌ها را بکشید)' : 'Drag mode active (drag cards)'}
              </span>
            )}

            {/* Primary Toggle Button */}
            <button
              type="button"
              onClick={() => setIsLayoutEditable(!isLayoutEditable)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                !isLayoutEditable
                  ? 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20'
              }`}
            >
              {!isLayoutEditable ? (
                <>
                  <GripVertical size={14} />
                  <span>{isRtl ? 'تغییر چیدمان' : 'Edit Layout'}</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>{isRtl ? 'ذخیره چیدمان' : 'Save Layout'}</span>
                </>
              )}
            </button>

            {/* Reset Layout button */}
            {JSON.stringify(cardOrder) !== JSON.stringify(DEFAULT_CARD_ORDER) && (
              <button
                type="button"
                onClick={handleResetCardOrder}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl shadow-2xs cursor-pointer"
                title={isRtl ? 'بازنشانی چیدمان ویجت‌ها' : 'Reset widget layout'}
              >
                <RotateCcw size={13} />
                <span className="hidden sm:inline">{isRtl ? 'بازنشانی' : 'Reset'}</span>
              </button>
            )}
          </div>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {cardOrder.map((cardId) => {
            const cardDef = cardsMap[cardId];
            if (!cardDef) return null;

            const isDragging = draggedCardId === cardId;
            const isDropTarget = dragOverCardId === cardId && draggedCardId !== cardId;

            return (
              <div
                key={cardId}
                draggable={isLayoutEditable}
                onDragStart={(e) => isLayoutEditable && handleDragStart(e, cardId)}
                onDragOver={(e) => isLayoutEditable && handleDragOver(e, cardId)}
                onDragLeave={(e) => isLayoutEditable && handleDragLeave(e, cardId)}
                onDrop={(e) => isLayoutEditable && handleDrop(e, cardId)}
                onDragEnd={handleDragEnd}
                className={`${cardDef.colSpanClass} bg-surface-primary dark:bg-[#1A1A24] border border-slate-200/80 dark:border-slate-800/80 rounded-[22px] p-6 transition-all duration-300 shadow-sm flex flex-col justify-between space-y-4 group relative select-none font-['Vazirmatn'] ${
                  isDragging ? 'opacity-40 scale-[0.98] shadow-2xl ring-2 ring-brand-accent/50 z-20' : ''
                } ${
                  isDropTarget ? 'ring-2 ring-dashed ring-amber-500 bg-amber-500/5 dark:bg-amber-500/10 scale-[1.01] z-10' : ''
                } ${
                  isLayoutEditable && !isDragging && !isDropTarget
                    ? 'border-dashed border-amber-400/60 dark:border-amber-500/50 ring-1 ring-amber-400/20 dark:ring-amber-500/20 hover:border-amber-500 shadow-md cursor-grab active:cursor-grabbing'
                    : !isDragging && !isDropTarget
                    ? 'border-border-primary/85 dark:border-white/5 hover:border-brand-accent/25 hover:shadow-md'
                    : ''
                }`}
              >
                {cardDef.render()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
