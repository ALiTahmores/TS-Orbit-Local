import { projectStatusUI } from '../../lib/domain';
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useProject } from '../../context/ProjectContext';
import { Project } from '../../types';
import { CreateProjectModal } from './CreateProjectModal';
import { ProjectSettingsView } from './ProjectSettingsView';
import { StatusChangeReasonModal } from './StatusChangeReasonModal';
import { Tooltip } from '../common/Tooltip';
import Folder from '../ui/Folder';
import { 
  FolderGit, 
  Plus, 
  Search, 
  Trash2, 
  ExternalLink, 
  Calendar, 
  User, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Briefcase, 
  Filter, 
  FolderOpen,
  ArrowUpDown,
  Check,
  Building2,
  ShieldAlert,
  X,
  Edit3,
  Settings,
  ChevronDown
} from 'lucide-react';

const toPersianDigits = (n: string | number): string => {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (x) => farsiDigits[parseInt(x, 10)]);
};

interface ProjectsManagerViewProps {
  initialStatusFilter?: string;
  onOpenCreateModal?: () => void;
  onNavigateToOverview?: () => void;
}

export const ProjectsManagerView: React.FC<ProjectsManagerViewProps> = ({
  initialStatusFilter = 'all',
  onOpenCreateModal,
  onNavigateToOverview
}) => {
  const { 
    projects, 
    selectedProject, 
    setSelectedProject, 
    deleteProject,
    updateProject,
    t
  } = useProject();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'title' | 'progress' | 'deadline'>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Category classification helper
  const getProjectCategory = (project: Project): 'web' | 'design' | 'seo' | 'general' => {
    if (!project) return 'general';
    const text = ((project.title || '') + ' ' + (project.description || '')).toLowerCase();
    if (text.includes('طراحی') || text.includes('دیزاین') || text.includes('ui') || text.includes('ux') || text.includes('برند') || text.includes('لوگو')) {
      return 'design';
    }
    if (text.includes('سئو') || text.includes('محتوا') || text.includes('مارکتینگ') || text.includes('seo') || text.includes('تولید محتوا')) {
      return 'seo';
    }
    if (text.includes('توسعه') || text.includes('کد') || text.includes('سایت') || text.includes('وب') || text.includes('وردپرس') || text.includes('اپلیکیشن') || text.includes('برنامه')) {
      return 'web';
    }
    return 'general';
  };

  const folderCategories = [
    { id: 'all', name: 'همه پروژه‌ها', color: '#2563eb', desc: 'نمایش کلیه طرح‌ها' },
    { id: 'web', name: 'برنامه‌نویسی و وب', color: '#10b981', desc: 'توسعه وب‌سایت و سامانه' },
    { id: 'design', name: 'طراحی UI/UX و برندینگ', color: '#8b5cf6', desc: 'رابط کاربری و هویت بصری' },
    { id: 'seo', name: 'سئو و دیجیتال مارکتینگ', color: '#f59e0b', desc: 'بهینه‌سازی موتورهای جستجو' },
  ];

  const renderProjectPaperPreview = (proj?: Project, defaultLabel = 'پروژه') => {
    if (!proj) {
      return (
        <div className="w-full h-full p-1 flex items-center justify-center text-slate-400 dark:text-slate-500 text-[9px] font-bold">
          <span>{defaultLabel}</span>
        </div>
      );
    }
    return (
      <div className="w-full h-full p-1.5 flex flex-col justify-between text-right font-sans select-none pointer-events-none bg-white dark:bg-slate-900 rounded-md border border-slate-200/80 dark:border-slate-700/80">
        <div className="flex items-center gap-1 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
          <span className="text-[10px] font-black text-slate-800 dark:text-slate-100 truncate dir-rtl">
            {proj.title}
          </span>
        </div>
        <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 dark:text-slate-400">
          <span>{toPersianDigits(proj.progress || 0)}٪</span>
          <span className="truncate max-w-[50px]">{proj.clientName || 'کارفرما'}</span>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
    }
  }, [initialStatusFilter]);

  // Deletion Safety Modal State
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Dedicated Project Settings Page View State
  const [settingProject, setSettingProject] = useState<Project | null>(null);

  // Quick Modal Edit State
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Status Popover & Reason Modal States
  const [activePopoverProjectId, setActivePopoverProjectId] = useState<string | null>(null);
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; right: number } | null>(null);
  const [statusChangeTarget, setStatusChangeTarget] = useState<{ project: Project; newStatus: string } | null>(null);

  const handleConfirmStatusChange = async (reason: string) => {
    if (!statusChangeTarget) return;
    const { project, newStatus } = statusChangeTarget;
    
    const currentStatus = project.status || 'active';
    const newLog = {
      previousStatus: currentStatus,
      newStatus: newStatus,
      reason: reason,
      timestamp: new Date().toLocaleDateString('fa-IR') + ' - ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      username: 'راهبر سیستم'
    };

    const existingHistory = project.statusHistory || [];
    const updatedHistory = [...existingHistory, newLog];

    await updateProject(project.id, {
      status: newStatus as any,
      statusReason: reason
    });

    setStatusChangeTarget(null);
  };

  const renderInteractiveStatusTrigger = (project: Project) => {
    const currentSt = projectStatusUI(project.status);
    const isOpen = activePopoverProjectId === project.id;

    const getStatusDisplay = (st: string) => {
      switch (projectStatusUI(st)) {
        case 'connected_to_wordpress':
      case 'active':
        case 'in_progress':
          return {
            label: 'فعال',
            dotBg: 'bg-emerald-500 shadow-emerald-500/50',
            textColor: 'text-emerald-700 dark:text-emerald-400'
          };
        case 'suspended':
        case 'on_hold':
        case 'pending':
          return {
            label: 'در انتظار / تعلیق',
            dotBg: 'bg-amber-500 shadow-amber-500/50',
            textColor: 'text-amber-700 dark:text-amber-400'
          };
        case 'canceled':
        case 'terminated':
          return {
            label: 'لغو شده',
            dotBg: 'bg-rose-500 shadow-rose-500/50',
            textColor: 'text-rose-700 dark:text-rose-400'
          };
        case 'archived':
      case 'completed':
          return {
            label: 'تکمیل شده / آرشیو',
            dotBg: 'bg-slate-400 shadow-slate-400/50',
            textColor: 'text-slate-600 dark:text-slate-400'
          };
        default:
          return {
            label: 'فعال',
            dotBg: 'bg-emerald-500 shadow-emerald-500/50',
            textColor: 'text-emerald-700 dark:text-emerald-400'
          };
      }
    };

    const currentDisplay = getStatusDisplay(currentSt);

    const statusOptions = [
      { key: 'active', label: '🟢 فعال', hoverBg: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' },
      { key: 'suspended', label: '🟡 در انتظار / تعلیق', hoverBg: 'hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-400' },
      { key: 'canceled', label: '🔴 لغو شده', hoverBg: 'hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400' },
      { key: 'completed', label: '⚪ تکمیل شده / آرشیو', hoverBg: 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300' }
    ];

    return (
      <div className="relative inline-block text-right" dir="rtl">
        {/* Date-picker style trigger pill */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isOpen) {
              setActivePopoverProjectId(null);
              setPopoverCoords(null);
            } else {
              const rect = e.currentTarget.getBoundingClientRect();
              const right = Math.max(12, window.innerWidth - rect.right);
              const top = rect.bottom + 6;
              setPopoverCoords({ top, right });
              setActivePopoverProjectId(project.id);
            }
          }}
          className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 hover:border-blue-500/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all rounded-xl px-3 py-1.5 flex items-center justify-between gap-2.5 cursor-pointer shadow-2xs group whitespace-nowrap min-w-[130px]"
        >
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${currentDisplay.dotBg} shrink-0 animate-pulse`} />
            <span className={`text-xs font-black ${currentDisplay.textColor}`}>
              {currentDisplay.label}
            </span>
          </div>
          <ChevronDown size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
        </button>

        {/* Floating Popover Dropdown Menu Rendered via Portal */}
        {isOpen && popoverCoords && createPortal(
          <div className="fixed inset-0 z-[100] font-sans" dir="rtl">
            <div 
              className="fixed inset-0 bg-transparent" 
              onClick={(e) => {
                e.stopPropagation();
                setActivePopoverProjectId(null);
                setPopoverCoords(null);
              }} 
            />

            <div 
              style={{
                position: 'fixed',
                top: `${popoverCoords.top}px`,
                right: `${popoverCoords.right}px`,
              }}
              className="z-[101] min-w-[190px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 rounded-2xl shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="px-2.5 py-1 text-[10px] font-black text-slate-400 border-b border-slate-100 dark:border-slate-800">
                تغییر وضعیت پروژه
              </div>
              {statusOptions.map((opt) => {
                const isSelected = currentSt === opt.key || (opt.key === 'active' && (currentSt as string) === 'in_progress');
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePopoverProjectId(null);
                      setPopoverCoords(null);
                      if (!isSelected) {
                        setStatusChangeTarget({ project, newStatus: opt.key });
                      }
                    }}
                    className={`w-full px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${opt.hoverBg} ${
                      isSelected ? 'bg-slate-100 dark:bg-slate-800/80 font-black' : ''
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  };

  // Filtered & Sorted Projects
  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter(p => {
      if (!p || p.id === 'no_project') return false;
      
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = 
        !query || 
        p.title?.toLowerCase().includes(query) || 
        p.clientName?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query);

      const isCompleted = ['completed','archived','canceled'].includes(projectStatusUI(p.status));
      let matchesStatus = true;
      if (statusFilter === 'active') {
        matchesStatus = !isCompleted;
      } else if (statusFilter === 'completed') {
        matchesStatus = isCompleted;
      } else if (statusFilter !== 'all') {
        matchesStatus = projectStatusUI(p.status) === projectStatusUI(statusFilter);
      }

      let matchesCategory = true;
      if (categoryFilter !== 'all') {
        const cat = getProjectCategory(p);
        matchesCategory = cat === categoryFilter || (categoryFilter === 'web' && cat === 'general');
      }

      return matchesSearch && matchesStatus && matchesCategory;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortField === 'title') {
        comparison = (a.title || '').localeCompare(b.title || '', 'fa');
      } else if (sortField === 'progress') {
        comparison = (a.progress || 0) - (b.progress || 0);
      } else if (sortField === 'deadline') {
        comparison = (a.deadline || '').localeCompare(b.deadline || '');
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [projects, searchQuery, statusFilter, categoryFilter, sortField, sortOrder]);

  // Opening a project selects it everywhere and shows its own page.
  const handleSelectAndEnter = (project: Project) => {
    setSelectedProject(project);
    if (onNavigateToOverview) {
      onNavigateToOverview();
    } else {
      setSettingProject(project);
    }
  };

  const handleOpenProjectUrl = (project: Project) => {
    let url = (project.websiteUrl || '').trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleConfirmDelete = async () => {
    if (!deletingProject) return;
    setIsDeleting(true);
    try {
      await deleteProject(deletingProject.id);
    } catch (e) {
      console.error("Delete project error:", e);
    } finally {
      setIsDeleting(false);
      setDeletingProject(null);
    }
  };

  const triggerCreateModal = () => {
    if (onOpenCreateModal) {
      onOpenCreateModal();
    } else {
      window.dispatchEvent(new CustomEvent('open-create-project-modal'));
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (projectStatusUI(status)) {
      case 'connected_to_wordpress':
      case 'active':
      case 'in_progress':
        return (
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit whitespace-nowrap">
            <CheckCircle2 size={12} />
            <span>پروژه فعال</span>
          </span>
        );
      case 'archived':
      case 'completed':
        return (
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit whitespace-nowrap">
            <CheckCircle2 size={12} />
            <span>تکمیل شده</span>
          </span>
        );
      case 'on_hold':
      case 'pending':
      case 'suspended':
        return (
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1 w-fit whitespace-nowrap">
            <AlertTriangle size={12} />
            <span>در انتظار / تعلیق</span>
          </span>
        );
      case 'canceled':
      case 'terminated':
        return (
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1 w-fit whitespace-nowrap">
            <AlertTriangle size={12} />
            <span>لغو شده</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit whitespace-nowrap">
            <CheckCircle2 size={12} />
            <span>پروژه فعال</span>
          </span>
        );
    }
  };

  // Entering or leaving a project page starts at its top, not at the list's scroll position.
  useEffect(() => {
    document.getElementById('main-scroll-viewport')?.scrollTo({ top: 0 });
  }, [settingProject?.id]);

  if (settingProject) {
    return (
      <ProjectSettingsView
        project={projects.find(project=>project.id===settingProject.id) || settingProject}
        onBack={() => setSettingProject(null)}
      />
    );
  }

  return (
    <div className="w-full space-y-6 dir-rtl font-sans" dir="rtl" style={{ fontFeatureSettings: '"ss01" 1' }}>
      
      {/* 1. TOP ACTION BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
              <FolderGit size={22} className="stroke-[2]" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-800 dark:text-slate-100">
                مدیریت و لیست پروژه‌ها
              </h1>
              <p className="text-xs font-medium text-slate-400 mt-0.5">
                مدیریت متمرکز، فیلتر و کنترل وضعیت کلیه پروژه‌های ثبت‌شده در سامانه
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={triggerCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl border border-blue-400/20 shadow-xs hover:shadow-md hover:shadow-blue-500/15 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 text-sm cursor-pointer shrink-0"
          >
            <Plus size={16} />
            <span>{t('پروژه جدید')}</span>
          </button>
        </div>
      </div>

      {/* 3D INTERACTIVE FOLDER CATEGORIES */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FolderOpen size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">
                دسته‌بندی تعاملی پروژه‌ها
              </h2>
              <p className="text-[11px] font-medium text-slate-400">
                برای فیلتر جدول پروژه‌ها کلیک کنید؛ با هاور روی پوشه، پیش‌نمایش پروژه‌ها باز می‌شود.
              </p>
            </div>
          </div>
          {categoryFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>حذف فیلتر دسته‌بندی</span>
              <X size={13} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {folderCategories.map((cat) => {
            const catProjects = (projects || []).filter(
              p => p && p.id !== 'no_project' && (cat.id === 'all' || getProjectCategory(p) === cat.id)
            );

            const paperItems = [
              renderProjectPaperPreview(catProjects[0]),
              renderProjectPaperPreview(catProjects[1]),
              renderProjectPaperPreview(catProjects[2]),
            ];

            const isActive = categoryFilter === cat.id;

            return (
              <div
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-3 relative group ${
                  isActive
                    ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500/80 shadow-md scale-[1.02] ring-2 ring-blue-500/20'
                    : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="py-2 flex items-center justify-center">
                  <Folder
                    color={cat.color}
                    size={0.9}
                    items={paperItems}
                    isActive={isActive}
                  />
                </div>

                <div className="text-center space-y-0.5 w-full">
                  <span className={`text-xs font-black block transition-colors ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-100 group-hover:text-blue-600'
                  }`}>
                    {cat.name}
                  </span>
                  <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-slate-400">
                    <span>{cat.desc}</span>
                    <span>•</span>
                    <span className="text-slate-600 dark:text-slate-300 font-black">
                      {toPersianDigits(catProjects.length)} پروژه
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. PROJECTS TABLE & GRID LIST */}
      {filteredProjects.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xs overflow-visible relative z-10">
          <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
            <table className="w-full text-right text-xs border-collapse min-w-[750px]">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black">
                  <th className="py-3.5 px-4 text-right">عنوان پروژه</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">نام کارفرما</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">تاریخ شروع</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">سررسید</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap w-36">درصد پیشرفت</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">وضعیت</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap w-20">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {filteredProjects.map((project) => {
                  const isSelected = selectedProject?.id === project.id;
                  const isPopoverOpen = activePopoverProjectId === project.id;
                  const progressPct = Math.min(100, Math.max(0, project.progress || 0));

                  return (
                    <tr 
                      key={project.id}
                      className={`transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/30 ${
                        isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      } ${isPopoverOpen ? 'relative z-30' : 'relative z-0'}`}
                    >
                      {/* Title */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                            isSelected 
                              ? 'bg-blue-600 text-white shadow-sm' 
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}>
                            {project.title ? project.title.substring(0, 1) : 'پ'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <Tooltip content={project.title}>
                              <button
                                type="button"
                                onClick={() => handleSelectAndEnter(project)}
                                className="font-extrabold text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-xs block max-w-[180px] sm:max-w-[260px] xl:max-w-[320px] truncate text-right cursor-pointer"
                              >
                                {project.title}
                              </button>
                            </Tooltip>
                            {project.description && (
                              <Tooltip content={project.description}>
                                <p className="text-[11px] text-slate-400 block max-w-[180px] sm:max-w-[260px] xl:max-w-[320px] truncate mt-0.5 font-medium cursor-default">
                                  {project.description}
                                </p>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Client Name */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap text-slate-700 dark:text-slate-300 font-bold">
                        <Tooltip content={project.clientName || 'نامشخص'}>
                          <div className="flex items-center gap-1.5 cursor-default">
                            <User size={13} className="text-slate-400 shrink-0" />
                            <span className="block max-w-[110px] sm:max-w-[150px] truncate">{project.clientName || 'نامشخص'}</span>
                          </div>
                        </Tooltip>
                      </td>

                      {/* Start Date */}
                      <td className="py-3.5 px-4 text-center font-mono whitespace-nowrap text-slate-500 dark:text-slate-400">
                        <div className="flex items-center justify-center gap-1.5">
                          <Calendar size={13} className="text-slate-400 shrink-0" />
                          <span>{project.startDate ? toPersianDigits(project.startDate) : '—'}</span>
                        </div>
                      </td>

                      {/* Deadline */}
                      <td className="py-3.5 px-4 text-center font-mono whitespace-nowrap text-slate-500 dark:text-slate-400">
                        <div className="flex items-center justify-center gap-1.5">
                          <Clock size={13} className="text-slate-400 shrink-0" />
                          <span>{project.deadline ? toPersianDigits(project.deadline) : '—'}</span>
                        </div>
                      </td>

                      {/* Progress Bar */}
                      <td className="py-3.5 px-4 text-center w-36">
                        <div className="space-y-1 w-28 sm:w-32 mx-auto">
                          <div className="flex justify-between items-center text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
                            <span>پیشرفت</span>
                            <span className="text-blue-600 dark:text-blue-400 font-black">{toPersianDigits(progressPct)}٪</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 rounded-full ${
                                progressPct >= 100 
                                  ? 'bg-emerald-500' 
                                  : progressPct > 50 
                                  ? 'bg-blue-600' 
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Interactive Status Selector */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {renderInteractiveStatusTrigger(project)}
                      </td>

                      {/* Actions Column */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <Tooltip content={project.websiteUrl?.trim() ? 'مشاهده سایت' : 'آدرس وب‌سایت برای این پروژه ثبت نشده است'}>
                            <button
                              type="button"
                              disabled={!project.websiteUrl?.trim()}
                              aria-label={'مشاهده سایت ' + project.title}
                              onClick={() => handleOpenProjectUrl(project)}
                              className="p-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white dark:bg-blue-950/40 dark:hover:bg-blue-600 text-blue-600 dark:text-blue-400 rounded-xl transition-all cursor-pointer border border-blue-200/80 dark:border-blue-900/40 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-50 disabled:hover:text-blue-600"
                            >
                              <ExternalLink size={14} />
                            </button>
                          </Tooltip>

                          <Tooltip content="تنظیمات پروژه">
                            <button
                              type="button"
                              onClick={() => setSettingProject(project)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-all cursor-pointer border border-slate-200/80 dark:border-slate-700 shrink-0"
                            >
                              <Settings size={14} />
                            </button>
                          </Tooltip>

                          <Tooltip content="حذف پروژه">
                            <button
                              type="button"
                              onClick={() => setDeletingProject(project)}
                              className="p-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 rounded-xl transition-all cursor-pointer border border-rose-200/60 dark:border-rose-900/40 shrink-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* 3. ZERO STATE CARD */
        <div className="bg-white dark:bg-[#111322] border border-gray-200/70 dark:border-[#1E2235] rounded-2xl p-8 sm:p-12 text-center space-y-6 shadow-sm dark:shadow-2xl dir-rtl" dir="rtl">
          <div className="w-20 h-20 rounded-2xl bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-500 flex items-center justify-center mx-auto shadow-inner">
            <FolderOpen size={36} className="stroke-[1.75]" />
          </div>
          
          <div className="max-w-md mx-auto space-y-2 text-center">
            <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white">
              {t('هیچ پروژه‌ای یافت نشد. برای شروع، نخستین پروژه خود را ثبت کنید.')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t('با ایجاد اولین پروژه، امکان مدیریت وب‌سایت، ثبت تسک‌ها، بارگذاری رسانه‌ها و ارتباط با کارفرما فعال می‌گردد.')}
            </p>
          </div>

          <button
            type="button"
            onClick={triggerCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl border border-blue-400/20 shadow-xs hover:shadow-md hover:shadow-blue-500/15 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 text-sm cursor-pointer mx-auto"
          >
            <Plus size={18} className="stroke-[2.5]" />
            <span>{t('+ ثبت اولین پروژه')}</span>
          </button>
        </div>
      )}

      {/* 4. SAFETY DELETION CONFIRMATION MODAL */}
      {deletingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 dir-rtl" dir="rtl">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center shrink-0">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  تایید حذف کامل پروژه
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  عنوان پروژه: <span className="font-black text-slate-700 dark:text-slate-200">{deletingProject.title}</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              آیا از حذف کامل این پروژه و تمامی داده‌های آن مطمئن هستید؟
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingProject(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                <Trash2 size={14} />
                <span>{isDeleting ? 'در حال حذف...' : 'بله، حذف شود'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. EDIT PROJECT MODAL */}
      <CreateProjectModal 
        isOpen={!!editingProject} 
        onClose={() => setEditingProject(null)} 
        projectToEdit={editingProject} 
      />

      {/* 6. STATUS CHANGE REASON MODAL */}
      {statusChangeTarget && (
        <StatusChangeReasonModal
          isOpen={!!statusChangeTarget}
          project={statusChangeTarget.project}
          targetStatus={statusChangeTarget.newStatus}
          onClose={() => setStatusChangeTarget(null)}
          onConfirm={handleConfirmStatusChange}
        />
      )}

    </div>
  );
};

export default ProjectsManagerView;
