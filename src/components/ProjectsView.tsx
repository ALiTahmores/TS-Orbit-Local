import { DeliveryBoards } from './projects/DeliveryBoards';
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useProject } from '../context/ProjectContext';
import { CustomSelect, CustomSelectOption } from './common/CustomSelect';
import { OverviewTab } from './projects/overview/OverviewTab';
import { ProjectFilesTab } from './projects/ProjectFilesTab';
import { ClientPortalView } from './projects/ClientPortalView';
import { ProjectsManagerView } from './projects/ProjectsManagerView';
import { ProjectSettingsView } from './projects/ProjectSettingsView';
import { TasksAndSchedulingView } from './projects/TasksAndSchedulingView';
import { CreateProjectModal } from './projects/CreateProjectModal';
import { SpecialistsView } from './SpecialistsView';
import { 
  Project, 
  Task, 
  TeamMember,
  TaskStatus,
  TaskPriority
} from '../types';
import { 
  Folder, 
  Calendar, 
  User2, 
  UserCheck,
  Plus, 
  CheckSquare, 
  Clock, 
  AlertCircle, 
  CheckCircle,
  FileText,
  Search,
  LayoutGrid,
  Shield,
  Activity,
  Trash2,
  ExternalLink,
  FolderPlus,
  ShieldAlert,
  Bell,
  Users,
  Filter,
  ArrowUpDown,
  EyeOff,
  Kanban,
  Timer,
  Flag,
  BarChart2,
  ListTodo,
  Sparkles,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Check,
  Building2,
  Globe,
  SlidersHorizontal,
  Columns,
  ListFilter,
  Layers,
  Award,
  Download,
  UploadCloud,
  Copy,
  Link as LinkIcon,
  MessageSquare,
  PieChart,
  ShieldCheck,
  Send,
  FileCode,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Share2,
  TrendingUp,
  DollarSign,
  Radio,
  FileCheck,
  Briefcase,
  Database,
  Code,
  RefreshCw,
  Zap,
  FolderOpen
} from 'lucide-react';

// Persian Digits Helper
const toPersianDigits = (n: string | number): string => {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (x) => farsiDigits[parseInt(x, 10)]);
};

export const ProjectsView: React.FC = () => {
  const { 
    projects, 
    tasks, 
    teamMembers,
    selectedProject, 
    setSelectedProject, 
    updateTaskStatus,
    updateProject, 
    createTask,
    createProject,
    currentUser,
    notifications,
    files,
    clients,
    activeSubTab,
    setActiveSubTab,
    openNewProjectModal,
    t,
    isRtl,
    locale
  } = useProject();

  // Active Main Navigation Item
  type NavigationTab = 'overview' | 'active_projects' | 'files' | 'portal' | 'tasks' | 'content-seo' | 'team' | 'feedback';

  const getInitialNavTab = (subTab: string): NavigationTab => {
    if (subTab === 'content-seo') return 'content-seo';
    if (subTab === 'files') return 'files';
    if (subTab === 'clients' || subTab === 'feedback' || subTab === 'portal') return 'portal';
    if (subTab === 'tasks' || subTab === 'tasks-schedule') return 'tasks';
    if (subTab === 'active_projects') return 'active_projects';
    if (subTab === 'team') return 'team';
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<NavigationTab>(() => getInitialNavTab(activeSubTab));

  // Synchronize state if activeSubTab changes from global navigation
  useEffect(() => {
    setActiveTab(getInitialNavTab(activeSubTab));
  }, [activeSubTab]);

  useEffect(() => {
    const handleOpenModal = () => openNewProjectModal();
    window.addEventListener('open-create-project-modal', handleOpenModal);
    return () => {
      window.removeEventListener('open-create-project-modal', handleOpenModal);
    };
  }, []);

  const handleTabChange = (tab: NavigationTab) => {
    setActiveTab(tab);
    if(tab==='content-seo') setActiveSubTab?.('content-seo');
    else if (tab === 'files') setActiveSubTab?.('files');
    else if (tab === 'portal' || tab === 'feedback') setActiveSubTab?.('clients');
    else if (tab === 'overview' || tab === 'active_projects') setActiveSubTab?.('overview');
    else if (tab === 'tasks') setActiveSubTab?.('tasks');
    else if (tab === 'team') setActiveSubTab?.('team');
  };

  // Tasks Secondary View Toggle: 'table' | 'gantt' | 'kanban' | 'time'
  const [activeTasksView, setActiveTasksView] = useState<'table' | 'gantt' | 'kanban' | 'time'>('table');

  // Search & Filter Toolbar States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<'name' | 'progress' | 'deadline'>('name');

  // Accordion Group Collapses in Tasks Table
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    'this_month': false,
    'next_month': false,
    'completed': false
  });

  // Table Row Selection
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  // Expanded Tasks Drawer per Project ID
  const [expandedTasksProjectId, setExpandedTasksProjectId] = useState<string | null>(null);

  // Status Popover state
  const [statusPopoverProjectId, setStatusPopoverProjectId] = useState<string | null>(null);
  const [statusPopoverCoords, setStatusPopoverCoords] = useState<{ top: number; right: number } | null>(null);

  // Local Project Status Overrides


  // Create Project Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newBudget, setNewBudget] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newWebsiteUrl, setNewWebsiteUrl] = useState('');

  // Quick Inline Task Creation Title
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // TAB: Content Lifecycle Pipeline State
  const [contentPipeline, setContentPipeline] = useState<any[]>([]);

  // TAB: SEO Checklist State
  const [seoChecklist, setSeoChecklist] = useState<any[]>([]);

  // TAB: File Assets State
  const [localAssets, setLocalAssets] = useState<any[]>([]);

  // TAB: Client Portal States
  const [isClientPortalActive, setIsClientPortalActive] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [clientFeedbacks, setClientFeedbacks] = useState<any[]>([]);

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const handleSelectAllInGroup = (groupProjects: Project[]) => {
    const groupIds = groupProjects.map(p => p.id);
    const allSelected = groupIds.every(id => selectedProjectIds.includes(id));
    if (allSelected) {
      setSelectedProjectIds(prev => prev.filter(id => !groupIds.includes(id)));
    } else {
      setSelectedProjectIds(prev => Array.from(new Set([...prev, ...groupIds])));
    }
  };

  const toggleProjectSelection = (id: string) => {
    setSelectedProjectIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const getProjectStatus = (project:Project):string => ({ACTIVE:'inprogress',IN_PROGRESS:'inprogress',DRAFT:'pending',COMPLETED:'completed',CANCELLED:'cancelled',ARCHIVED:'archived'}[project.status] || project.status);
  const setProjectStatus = async(projectId:string,newStatus:string) => {
    await updateProject(projectId,{status:newStatus as any}); setStatusPopoverProjectId(null);
  };
  const getProjectTrackedTime = (project:Project):string => {
    const minutes=Math.round(Number(project.loggedHours || 0)*60);return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createProject(
        newTitle.trim(), 
        newDesc.trim(), 
        newBudget, 
        newDeadline, 
        newClient, 
        newWebsiteUrl.trim()
      );
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

  const handleInlineAddTask = async (projectId: string) => {
    if (!newTaskTitle.trim()) return;
    await createTask({
      projectId,
      title: newTaskTitle.trim(),
      description: 'تسک سریع ایجاد شده از جدول پروژه‌ها',
      department: 'ui_ux',
      assignedMemberIds: currentUser?.id ? [currentUser.id] : [],
      priority: 'medium',
      status: 'pending',
      startDate: new Date().toISOString().slice(0,10)
    });
    setNewTaskTitle('');
  };

  const handleCopyClientLink = () => {
    const token=selectedProject?.portalToken || selectedProject?.clientPortalToken;
    if(!token) return;
    navigator.clipboard?.writeText(window.location.origin+'/?portalToken='+encodeURIComponent(token));
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const toggleSeoItem = (id: string) => {
    setSeoChecklist(prev => prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
  };

  const toggleFeedbackStatus = (id: string) => {
    setClientFeedbacks(prev => prev.map(fb => fb.id === id ? { ...fb, status: fb.status === 'resolved' ? 'pending' : 'resolved' } : fb));
  };

  // Filtered Projects
  const filteredProjects = useMemo(() => {
    const safeProjects = projects || [];
    const safeTasks = tasks || [];
    return safeProjects.filter(p => {
      if (!p) return false;
      const matchesSearch = 
        (p.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.clientName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.websiteUrl && p.websiteUrl.toLowerCase().includes(searchQuery.toLowerCase()));

      const status = getProjectStatus(p);
      const matchesStatus = statusFilter === 'all' || status === statusFilter;

      let matchesMember = true;
      if (selectedMemberFilter !== 'all') {
        const projTasks = safeTasks.filter(t => t && t.projectId === p.id);
        matchesMember = projTasks.some(t => t && t.assignedTo === selectedMemberFilter);
      }

      return matchesSearch && matchesStatus && matchesMember;
    }).sort((a, b) => {
      if (sortKey === 'name') {
        return a.title.localeCompare(b.title, 'fa');
      } else if (sortKey === 'progress') {
        return b.progress - a.progress;
      } else if (sortKey === 'deadline') {
        return a.deadline.localeCompare(b.deadline);
      }
      return 0;
    });
  }, [projects, searchQuery, statusFilter, selectedMemberFilter, sortKey, tasks]);

  // Grouping Projects logically for Accordions
  const groupedProjects = useMemo(() => {
    const thisMonthList: Project[] = [];
    const nextMonthList: Project[] = [];

    // Determine current Jalali year and month dynamically
    let currentJalaliYear = 1405;
    let currentJalaliMonth = 4;
    try {
      const parts = new Intl.DateTimeFormat('fa-IR-u-nu-latn').format(new Date()).split('/');
      currentJalaliYear = parseInt(parts[0], 10) || 1405;
      currentJalaliMonth = parseInt(parts[1], 10) || 4;
    } catch {
      currentJalaliYear = 1405;
      currentJalaliMonth = 4;
    }

    filteredProjects.forEach(p => {
      const status = getProjectStatus(p);
      // Exclude completed or archived projects from operations view (moved strictly to ProjectsManagerView archive tab)
      if (status === 'completed' || p.progress === 100) {
        return;
      }

      let projYear = currentJalaliYear;
      let projMonth = currentJalaliMonth;

      if (p.deadline) {
        const latinDeadline = p.deadline.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
        const parts = latinDeadline.split('/');
        if (parts.length >= 2) {
          projYear = parseInt(parts[0], 10) || currentJalaliYear;
          projMonth = parseInt(parts[1], 10) || currentJalaliMonth;
        }
      }

      // Strict exclusivity: Current or past due month -> thisMonthList, Future months -> nextMonthList
      if (projYear < currentJalaliYear || (projYear === currentJalaliYear && projMonth <= currentJalaliMonth)) {
        thisMonthList.push(p);
      } else {
        nextMonthList.push(p);
      }
    });

    return [
      {
        key: 'this_month',
        title: 'پروژه‌های این ماه',
        subtitle: 'پروژه‌های فعال با ددلاین جاری',
        colorBadge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        projects: thisMonthList
      },
      {
        key: 'next_month',
        title: 'پروژه‌های ماه آینده',
        subtitle: 'پروژه‌های برنامه‌ریزی شده فاز بعدی',
        colorBadge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
        projects: nextMonthList
      }
    ];
  }, [filteredProjects]);

  // Helper for tab human-readable titles in breadcrumb
  const getTabLabel = (tab: NavigationTab): string => {
    switch (tab) {
      case 'overview': return t('پیش‌نمایش کلی');
      case 'active_projects': return t('طرح‌های فعال');
      case 'files': return t('فایل‌ها و مدارک');
      case 'portal': return t('پورتال کارفرما');
      case 'tasks': return t('تسک‌ها و زمان‌بندی');
      case 'content-seo': return t('جریان محتوا و سئو');
      case 'team': return t('اعضای کارگاه و متخصصین');
      case 'feedback': return t('فیدبک کارفرمایان');
      default: return t('پیش‌نمایش کلی');
    }
  };

  // Render Status Pill Helper
  const renderStatusPill = (status: string, project: Project) => {
    let label = 'در حال انجام';
    let classes = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25';

    if (status === 'completed') {
      label = 'تکمیل شده';
      classes = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25';
    } else if (status === 'blocked') {
      label = 'مسدود / گیرکرده';
      classes = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25';
    } else if (status === 'review') {
      label = 'در حال بررسی';
      classes = 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25';
    }

    const isOpen = statusPopoverProjectId === project.id;

    return (
      <div className="relative inline-block text-right" dir="rtl">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isOpen) {
              setStatusPopoverProjectId(null);
              setStatusPopoverCoords(null);
            } else {
              const rect = e.currentTarget.getBoundingClientRect();
              const right = Math.max(12, window.innerWidth - rect.right);
              const top = rect.bottom + 6;
              setStatusPopoverCoords({ top, right });
              setStatusPopoverProjectId(project.id);
            }
          }}
          className={`px-3 py-1 rounded-full text-[11px] font-black border transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs hover:scale-[1.02] ${classes}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          <span>{label}</span>
          <ChevronDown size={11} className="opacity-70" />
        </button>

        {isOpen && statusPopoverCoords && createPortal(
          <div className="fixed inset-0 z-[100] font-sans" dir="rtl">
            <div 
              className="fixed inset-0 bg-transparent" 
              onClick={(e) => {
                e.stopPropagation();
                setStatusPopoverProjectId(null);
                setStatusPopoverCoords(null);
              }} 
            />

            <div 
              style={{
                position: 'fixed',
                top: `${statusPopoverCoords.top}px`,
                right: `${statusPopoverCoords.right}px`,
              }}
              className="z-[101] w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-1.5 text-xs space-y-1 animate-in fade-in zoom-in-95 duration-150"
            >
              <button
                onClick={() => {
                  setProjectStatus(project.id, 'completed');
                  setStatusPopoverProjectId(null);
                  setStatusPopoverCoords(null);
                }}
                className="w-full text-right px-2.5 py-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-bold flex items-center justify-between cursor-pointer"
              >
                <span>تکمیل شده</span>
                {status === 'completed' && <Check size={12} />}
              </button>
              <button
                onClick={() => {
                  setProjectStatus(project.id, 'inprogress');
                  setStatusPopoverProjectId(null);
                  setStatusPopoverCoords(null);
                }}
                className="w-full text-right px-2.5 py-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 font-bold flex items-center justify-between cursor-pointer"
              >
                <span>در حال انجام</span>
                {status === 'inprogress' && <Check size={12} />}
              </button>
              <button
                onClick={() => {
                  setProjectStatus(project.id, 'blocked');
                  setStatusPopoverProjectId(null);
                  setStatusPopoverCoords(null);
                }}
                className="w-full text-right px-2.5 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold flex items-center justify-between cursor-pointer"
              >
                <span>مسدود / گیرکرده</span>
                {status === 'blocked' && <Check size={12} />}
              </button>
              <button
                onClick={() => {
                  setProjectStatus(project.id, 'review');
                  setStatusPopoverProjectId(null);
                  setStatusPopoverCoords(null);
                }}
                className="w-full text-right px-2.5 py-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-bold flex items-center justify-between cursor-pointer"
              >
                <span>در حال بررسی</span>
                {status === 'review' && <Check size={12} />}
              </button>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  };

  // Member Avatar Stack Helper
  const renderAvatarStack = (project: Project) => {
    const projTasks = (tasks || []).filter(t => t && t.projectId === project.id);
    const assignedNames = Array.from(new Set(projTasks.map(t => t.assignedTo))).filter(Boolean);
    
    const safeMembers = teamMembers || [];
    const displayMembers = assignedNames.length > 0 
      ? safeMembers.filter(m => m && assignedNames.includes(m.name))
      : safeMembers.slice(0, 3);

    return (
      <div className="flex items-center -space-x-2 space-x-reverse">
        {displayMembers.slice(0, 3).map((member, idx) => (
          <div
            key={member.id || idx}
            className="group relative"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-blue-700 border-2 border-white dark:border-slate-900 text-white font-black text-[10px] flex items-center justify-center shadow-2xs hover:z-10 transition-transform hover:scale-110 cursor-pointer">
              {member.name ? member.name.substring(0, 1) : 'م'}
            </div>
            
            <div className="absolute bottom-full right-1/2 translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center z-50 pointer-events-none whitespace-nowrap">
              <div className="bg-slate-900 text-white text-[10px] font-extrabold px-2 py-1 rounded-md shadow-lg border border-slate-700">
                {member.name} ({member.department || 'متخصص'})
              </div>
              <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1" />
            </div>
          </div>
        ))}

        {displayMembers.length > 3 && (
          <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 text-slate-600 dark:text-slate-300 font-extrabold text-[9px] flex items-center justify-center shadow-2xs font-mono">
            +{toPersianDigits(displayMembers.length - 3)}
          </div>
        )}
      </div>
    );
  };

  if (activeTab === 'team') {
    return <SpecialistsView />;
  }

  return (
    <div className="w-full font-sans text-right space-y-4" dir="rtl">

      {/* FLOATING OUTER SUB-HEADER TOP NAVIGATION TABS (MATCHING REFERENCE STYLING) */}
      <div className="flex items-center gap-2 mb-4 justify-start overflow-x-auto pb-1 select-none">
        <button
          type="button"
          onClick={() => handleTabChange('overview')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'overview' || activeTab === 'active_projects'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200/80 dark:border-slate-700/80'
          }`}
        >
          <Folder size={16} />
          <span>{t('همه پروژه‌ها')}</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('tasks')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'tasks'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200/80 dark:border-slate-700/80'
          }`}
        >
          <CheckSquare size={16} />
          <span>{t('تسک‌ها و زمان‌بندی')}</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('files')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'files'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200/80 dark:border-slate-700/80'
          }`}
        >
          <FolderOpen size={16} />
          <span>{t('فایل‌ها و مدارک')}</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('portal')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'portal' || activeTab === 'feedback'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200/80 dark:border-slate-700/80'
          }`}
        >
          <UserCheck size={16} />
          <span>{t('فیدبک کارفرمایان')}</span>
        </button>
      </div>

      {/* MAIN WORKSPACE CANVAS INNER CARD CONTAINER */}
      <div className="flex h-full min-h-[calc(100vh-180px)] w-full bg-slate-50/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">

        {/* MAIN WORKSPACE CANVAS (FLEX-1 FULL WIDTH) */}
        <main className="flex-1 flex flex-col w-full min-w-0 bg-white dark:bg-slate-950 overflow-hidden">
          
          {/* LEAN SINGLE STICKY HEADER BAR */}
          <header className="h-14 min-h-[56px] shrink-0 border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md select-none sticky top-0 z-20">
            
            {/* RTL Right: Breadcrumb Path */}
            <div className="flex items-center gap-3 min-w-0 shrink">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 truncate">
                <span>{t('پروژه‌ها')}</span>
                <ChevronLeft size={12} className={`text-slate-400 shrink-0 ${isRtl ? 'rotate-0' : 'rotate-180'}`} />
                <span className="text-slate-700 dark:text-slate-200 font-extrabold truncate">
                  {selectedProject && selectedProject.id !== 'no_project' ? selectedProject.title : t('همه پروژه‌ها')}
                </span>
                <ChevronLeft size={12} className={`text-slate-400 shrink-0 ${isRtl ? 'rotate-0' : 'rotate-180'}`} />
                <span className="text-blue-600 dark:text-blue-400 font-black shrink-0">{getTabLabel(activeTab)}</span>
              </div>
            </div>

          </header>

          {/* WORKSPACE CANVAS CONTENT */}
          <div className="flex-1 w-full min-w-0 overflow-x-hidden overflow-y-auto p-4 sm:p-6 space-y-6">

          <div className="flex flex-wrap gap-2 mb-4"><button type="button" onClick={()=>handleTabChange('overview')} className="px-3 py-2 border rounded-xl text-xs">نمای پروژه‌ها</button><button type="button" onClick={()=>handleTabChange('content-seo')} className="px-3 py-2 border rounded-xl text-xs">چک‌لیست، محتوا و کنترل کیفیت</button></div>
          {/* ================================================================== */}
          {/* TAB 1: CENTRALIZED PROJECT MANAGER (همه پروژه‌ها)                   */}
          {/* ================================================================== */}
          {activeTab === 'overview' && (
            <>
            <ProjectsManagerView 
              initialStatusFilter="all"
              onOpenCreateModal={openNewProjectModal}
            />
            {selectedProject?.id&&selectedProject.id!=='no_project'&&<section aria-label="فایل‌های نمای کلی پروژه" className="space-y-3"><h2 className="font-bold text-sm">فایل‌های پروژه — {selectedProject.title}</h2><ProjectFilesTab/></section>}
            </>
          )}

          {/* ================================================================== */}
          {/* TAB: ACTIVE PROJECTS (طرح‌های فعال) - LINKS DIRECTLY TO MANAGER     */}
          {/* ================================================================== */}
          {activeTab === 'active_projects' && (
            <ProjectsManagerView 
              initialStatusFilter="active"
              onOpenCreateModal={openNewProjectModal}
            />
          )}

          {/* ================================================================== */}
          {/* TAB 2: FILES & ASSETS                                              */}
          {/* ================================================================== */}
          {activeTab === 'files' && <ProjectFilesTab />}

          {/* ================================================================== */}
          {/* TAB 3: CLIENT PORTAL & FEEDBACK HUB                                */}
          {/* ================================================================== */}
          {(activeTab === 'portal' || activeTab === 'feedback') && (
            <ProjectSettingsView 
              project={selectedProject || projects[0]} 
              onBack={() => handleTabChange('overview')}
              initialTab="portal"
            />
          )}

          {/* ================================================================== */}
          {/* TAB 4: TASKS & GANTT SCHEDULING                                    */}
          {/* ================================================================== */}
          {activeTab === 'tasks' && <TasksAndSchedulingView />}

          {/* ================================================================== */}
          {/* TAB 5: CONTENT & SEO                                               */}
          {/* ================================================================== */}
          {activeTab === 'content-seo' && <DeliveryBoards />}

          {/* ================================================================== */}
          {/* TAB: TEAM WORKLOAD & MEMBERS (اعضای کارگاه فنی و متخصصین)        */}
          {/* ================================================================== */}
          {activeTab === 'team' && (
            <SpecialistsView />
          )}

        </div>
      </main>
      </div>

    </div>
  );
};
