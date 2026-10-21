import { LocalImage } from '../common/LocalImage';
import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  MoreHorizontal, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FolderGit2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  PieChart as PieChartIcon
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { cn } from '../../lib/utils';
import { CreateProjectModal } from '../projects/CreateProjectModal';
import { canUserAccessProject } from '../../utils/helpers';

const toPersianDigits = (n: string | number): string => {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (x) => farsiDigits[parseInt(x, 10)]);
};

export const MyProjectsView: React.FC = () => {
  const { projects, tasks, currentUser, locale } = useProject();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const isRtl = locale !== 'en';

  // 1. STRICT PERSONAL DATA FILTERING
  const myProjects = useMemo(() => {
    if (!currentUser) return projects;
    const uId = String(currentUser.id || '');
    const uName = String(currentUser.name || '').trim();
    const uEmail = String(currentUser.email || '').trim();

    return projects.filter((p: any) => {
      if (!p) return false;
      return canUserAccessProject(currentUser, p);
    });
  }, [projects, currentUser]);

  // 2. DYNAMIC METRICS & OVERALL PROGRESS CALCULATION
  const metrics = useMemo(() => {
    const total = myProjects.length;
    const completed = myProjects.filter(p => {
      const s = String(p.status || '').toLowerCase().trim();
      return s === 'completed' || s === 'done' || Number(p.progress) === 100;
    }).length;

    const inProgress = myProjects.filter(p => {
      const s = String(p.status || '').toLowerCase().trim();
      return (s !== 'completed' && s !== 'done' && Number(p.progress || 0) < 100) || s === 'active' || s === 'in_progress' || s === 'inprogress';
    }).length;

    const atRisk = myProjects.filter(p => {
      const pr = String(p.priority || '').toLowerCase().trim();
      return pr === 'urgent' || pr === 'critical' || pr === 'high' || pr === 'فوری' || (p as any).isOverdue;
    }).length;

    const waiting = Math.max(0, total - (completed + inProgress));

    // Calculate Average Progress
    let avgProgress = 0;
    if (total > 0) {
      const sum = myProjects.reduce((acc, p) => acc + (Number(p.progress) || 0), 0);
      avgProgress = Math.round(sum / total);
    }

    return { total, completed, inProgress, atRisk, waiting, avgProgress };
  }, [myProjects]);

  // 3. SEARCH & CATEGORY FILTERING
  const filteredProjects = useMemo(() => {
    return myProjects.filter((p: any) => {
      const title = (p.title || p.name || '').toLowerCase();
      const client = (p.clientName || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      const matchesSearch = !searchQuery.trim() || 
        title.includes(searchQuery.toLowerCase()) || 
        client.includes(searchQuery.toLowerCase()) ||
        desc.includes(searchQuery.toLowerCase());

      let matchesStatus = true;
      const s = String(p.status || '').toLowerCase().trim();
      if (statusFilter === 'IN_PROGRESS') {
        matchesStatus = s === 'in_progress' || s === 'inprogress' || s === 'active' || (s !== 'completed' && s !== 'done' && Number(p.progress || 0) < 100);
      } else if (statusFilter === 'COMPLETED') {
        matchesStatus = s === 'completed' || s === 'done' || Number(p.progress) === 100;
      } else if (statusFilter === 'URGENT') {
        const pr = String(p.priority || '').toLowerCase().trim();
        matchesStatus = pr === 'urgent' || pr === 'critical' || pr === 'high' || pr === 'فوری';
      }

      let matchesCategory = true;
      if (categoryFilter !== 'ALL') {
        matchesCategory = (p.category === categoryFilter) || (p.assignedTeamIds && p.assignedTeamIds.includes(categoryFilter));
      }

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [myProjects, searchQuery, statusFilter, categoryFilter]);

  // Pagination (6 cards per page)
  const pageSize = 6;
  const totalPages = Math.ceil(filteredProjects.length / pageSize) || 1;
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // SVG Radial Calculation
  const strokeWidth = 10;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (metrics.avgProgress / 100) * circumference;

  return (
    <div className="w-full space-y-6 pb-12 font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* =================================================================== */}
      {/* TOP HEADER & ACTION BAR                                             */}
      {/* =================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/20 inline-flex">
              <FolderGit2 className="w-5 h-5" />
            </span>
            <span>{isRtl ? 'پروژه‌های من' : 'My Projects'}</span>
          </h1>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-400 mt-1">
            {isRtl ? 'مدیریت و پایش بلادرنگ پروژه‌ها، وظایف مرتبط و درصد پیشرفت اختصاصی شما' : 'Real-time overview and tracking of your personal assigned projects.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{isRtl ? 'ثبت پروژه جدید' : 'New Project'}</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* TWO-COLUMN LAYOUT: MAIN GRID (LEFT/CENTER) + ANALYTICS (RIGHT)       */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ================================================================= */}
        {/* MAIN COLUMN (8 COLS): SEARCH + FILTERS + PROJECT CARDS             */}
        {/* ================================================================= */}
        <div className="lg:col-span-8 space-y-5">
          
          {/* SEARCH & FILTERS BAR */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#121526] border border-slate-200/90 dark:border-[#1e2338] shadow-sm flex flex-wrap items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={isRtl ? "جستجوی پروژه، کارفرما یا توضیحات..." : "Search project, client, or details..."}
                className="w-full h-10 pr-9 pl-4 text-xs rounded-xl bg-slate-50 dark:bg-[#171b2f] border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>

            {/* Quick Status Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              {[
                { id: 'ALL', label: isRtl ? 'همه' : 'All' },
                { id: 'IN_PROGRESS', label: isRtl ? 'در جریان' : 'In Progress' },
                { id: 'COMPLETED', label: isRtl ? 'تکمیل شده' : 'Completed' },
                { id: 'URGENT', label: isRtl ? 'فوری' : 'Urgent' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0",
                    statusFilter === tab.id
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                      : "bg-slate-100 dark:bg-[#171b2f] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1f243d]"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* PROJECT CARDS GRID */}
          {filteredProjects.length === 0 ? (
            <div className="w-full py-16 flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-[#121526] rounded-3xl border border-dashed border-slate-200 dark:border-[#1e2338]">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                <FolderGit2 className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                {isRtl ? 'پروژه‌ای برای نمایش یافت نشد' : 'No personal projects found'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mb-5">
                {isRtl ? 'پروژه‌ای با معیارهای انتخابی وجود ندارد یا هنوز پروژه‌ای ثبت نکرده‌اید.' : 'No projects match your filter, or you have not created any projects yet.'}
              </p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{isRtl ? 'ایجاد پروژه جدید' : 'Create New Project'}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginatedProjects.map((project: any) => {
                const projectTasks = (tasks || []).filter(t => t.projectId === project.id);
                const completedTasks = projectTasks.filter(t => t.status === 'COMPLETED' || (t.status as any) === 'done' || (t.status as any) === 'completed').length;
                const totalTasksCount = projectTasks.length || project.totalTasks || 6;
                const progressVal = project.progress ?? (projectTasks.length > 0 ? Math.round((completedTasks / totalTasksCount) * 100) : 0);

                // Department / Category Chip
                const categoryName = project.category || (project.assignedTeamIds && project.assignedTeamIds[0] === 'team_uiux' ? 'طراحی رابط کاربری UI/UX' : project.assignedTeamIds && project.assignedTeamIds[0] === 'team_seo' ? 'سئو و بهینه‌سازی' : 'توسعه و برنامه‌نویسی');

                return (
                  <div
                    key={project.id}
                    className="p-5 rounded-2xl bg-white dark:bg-[#121526] border border-slate-200/90 dark:border-[#1e2338] shadow-sm hover:shadow-md hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all duration-200 flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Row: Category Tag & Status Badge */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#171b2f] text-slate-600 dark:text-slate-400 text-[10.5px] font-bold border border-slate-200/60 dark:border-slate-700/50">
                          {categoryName}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {project.priority === 'URGENT' || (project.priority as any) === 'urgent' ? (
                            <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-[10px] font-black border border-rose-200 dark:border-rose-900/50">
                              {isRtl ? 'فوری' : 'Urgent'}
                            </span>
                          ) : null}

                          <span className={cn(
                            "px-2.5 py-0.5 rounded-md text-[10.5px] font-bold",
                            project.status === 'COMPLETED' || (project.status as any) === 'completed' || progressVal === 100
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40"
                              : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40"
                          )}>
                            {project.status === 'COMPLETED' || progressVal === 100 
                              ? (isRtl ? 'تکمیل شده' : 'Completed') 
                              : (isRtl ? 'در جریان' : 'In Progress')}
                          </span>
                        </div>
                      </div>

                      {/* Project Title & Client */}
                      <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1 mb-1">
                        {project.title || project.name}
                      </h3>

                      {project.clientName && (
                        <p className="text-xs font-semibold text-slate-400 dark:text-slate-400 mb-4 line-clamp-1">
                          {isRtl ? `کارفرما: ${project.clientName}` : `Client: ${project.clientName}`}
                        </p>
                      )}

                      {/* Progress Bar & Percentage */}
                      <div className="space-y-1.5 mb-4">
                        <div className="flex items-center justify-between text-xs font-black">
                          <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium">
                            {isRtl ? 'درصد پیشرفت' : 'Progress'}
                          </span>
                          <span className="text-slate-800 dark:text-slate-200 font-mono">
                            {toPersianDigits(progressVal)}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#171b2f] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500"
                            style={{ width: `${progressVal}%` }}
                          />
                        </div>
                      </div>

                      {/* Task Completion Counter */}
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-4 bg-slate-50/80 dark:bg-[#171b2f]/60 p-2 rounded-xl">
                        <span className="text-[11px] font-medium">
                          {isRtl ? 'وظایف تکمیل شده:' : 'Tasks Completed:'}
                        </span>
                        <span className="font-mono text-blue-600 dark:text-blue-400 font-black">
                          {toPersianDigits(completedTasks)} / {toPersianDigits(totalTasksCount)}
                        </span>
                      </div>
                    </div>

                    {/* Footer: Due Date & Member Avatars */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-[#1e2338]">
                      {/* Due Date */}
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{toPersianDigits(project.deadline || project.dueDate || '1405/04/15')}</span>
                      </div>

                      {/* Overlapping Members */}
                      <div className="flex items-center -space-x-2 space-x-reverse">
                        {((project.assignedMembers && project.assignedMembers.length > 0) ? project.assignedMembers : [currentUser]).slice(0, 3).map((m: any, idx: number) => (
                          <LocalImage
                            key={idx}
                            src={m?.avatar || `/avatars/avatar-6.svg`}
                            alt={m?.name || "Member"}
                            title={m?.name || "Member"}
                            className="w-7 h-7 rounded-full border-2 border-white dark:border-[#121526] object-cover"
                          />
                        ))}
                        {(project.assignedMembers?.length || 1) > 3 && (
                          <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center border-2 border-white dark:border-[#121526]">
                            +{toPersianDigits((project.assignedMembers?.length || 0) - 3)}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {/* PAGINATION FOOTER */}
          {filteredProjects.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200/60 dark:border-[#1e2338]">
              <span className="text-xs text-slate-400 font-medium">
                {isRtl 
                  ? `نمایش ${toPersianDigits((currentPage - 1) * pageSize + 1)} تا ${toPersianDigits(Math.min(currentPage * pageSize, filteredProjects.length))} از ${toPersianDigits(filteredProjects.length)} پروژه`
                  : `Showing ${(currentPage - 1) * pageSize + 1} - ${Math.min(currentPage * pageSize, filteredProjects.length)} of ${filteredProjects.length} Projects`}
              </span>

              <div className="flex items-center gap-1.5" dir="ltr">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-[#171b2f] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4"/>
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                  <button
                    key={num}
                    onClick={() => setCurrentPage(num)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      currentPage === num
                        ? "bg-blue-600 text-white shadow-sm"
                        : "border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#171b2f]"
                    )}
                  >
                    {toPersianDigits(num)}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-[#171b2f] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4"/>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* ================================================================= */}
        {/* RIGHT ANALYTICS COLUMN (4 COLS): RADIAL GAUGE & STATUS SUMMARY    */}
        {/* ================================================================= */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* CARD 1: RADIAL CIRCULAR PROGRESS WIDGET */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#121526] border border-slate-200/90 dark:border-[#1e2338] shadow-sm flex flex-col items-center text-center relative overflow-hidden">
            <div className="w-full flex items-center justify-between mb-4">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{isRtl ? 'میانگین پیشرفت کل' : 'Overall Progress'}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                {isRtl ? 'بلادرنگ' : 'Live'}
              </span>
            </div>

            {/* Circular Gauge */}
            <div className="relative w-36 h-36 flex items-center justify-center my-2">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
                {/* Background Track */}
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth={strokeWidth}
                  className="text-slate-100 dark:text-[#191e35] fill-none"
                />
                {/* Animated Gradient Progress Stroke */}
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  stroke="url(#progressGradient)"
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out fill-none"
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#6366F1" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Central Value */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                  {toPersianDigits(metrics.avgProgress)}%
                </span>
                <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                  {isRtl ? 'نرخ تکمیل کل' : 'Completion Rate'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-medium leading-relaxed">
              {isRtl 
                ? `شما در حال حاضر ${toPersianDigits(metrics.inProgress)} پروژه فعال و ${toPersianDigits(metrics.completed)} پروژه تکمیل شده دارید.` 
                : `You currently have ${metrics.inProgress} active and ${metrics.completed} completed projects.`}
            </p>
          </div>

          {/* CARD 2: STATUS SUMMARY GRID */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#121526] border border-slate-200/90 dark:border-[#1e2338] shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-indigo-500" />
              <span>{isRtl ? 'تفکیک وضعیت پروژه‌ها' : 'Project Status Breakdown'}</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              {/* Item 1: Total */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#171b2f] border border-slate-200/60 dark:border-slate-700/50 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {isRtl ? 'کل پروژه‌ها' : 'Total'}
                </span>
                <span className="text-xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                  {toPersianDigits(metrics.total)}
                </span>
              </div>

              {/* Item 2: Completed */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  {isRtl ? 'تکمیل شده' : 'Completed'}
                </span>
                <span className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1 font-mono">
                  {toPersianDigits(metrics.completed)}
                </span>
              </div>

              {/* Item 3: In Progress */}
              <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                  {isRtl ? 'در حال اجرا' : 'In Progress'}
                </span>
                <span className="text-xl font-black text-blue-700 dark:text-blue-300 mt-1 font-mono">
                  {toPersianDigits(metrics.inProgress)}
                </span>
              </div>

              {/* Item 4: At Risk / Urgent */}
              <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                  {isRtl ? 'دارای ریسک/فوری' : 'At Risk'}
                </span>
                <span className="text-xl font-black text-rose-700 dark:text-rose-300 mt-1 font-mono">
                  {toPersianDigits(metrics.atRisk)}
                </span>
              </div>
            </div>
          </div>

          {/* CARD 3: QUICK PRO TIP / NOTICE */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-blue-600/10 via-indigo-600/5 to-transparent border border-blue-500/20 flex items-start gap-3.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white shrink-0 shadow-md shadow-blue-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">
                {isRtl ? 'همگام‌سازی خودکار و زنده' : 'Live Auto-Sync'}
              </h4>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {isRtl 
                  ? 'تمامی پروژه‌های ایجاد شده بلافاصله در پایگاه داده محلی ذخیره شده و با فضای کاری شما همگام می‌شوند.'
                  : 'All created projects are instantly synced with local storage and accessible across your workspace.'}
              </p>
            </div>
          </div>

        </div>

      </div>

      {/* Modal for Creating New Project */}
      <CreateProjectModal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
      />

    </div>
  );
};

export default MyProjectsView;
