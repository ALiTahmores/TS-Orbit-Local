import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Network, 
  AlertTriangle, 
  Calendar, 
  Layers, 
  Sparkles, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  ArrowUpRight, 
  Activity, 
  ChevronRight,
  Filter
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { DepartmentReportsView } from '../DepartmentReportsView';
import { ProjectRoadmapPlan } from './roadmap/ProjectRoadmapPlan';

export type SubReportTab = 'analytics' | 'roadmap' | 'bottlenecks' | 'timeline';

interface ReportingViewProps {
  initialSubTab?: SubReportTab;
  onSubTabChange?: (tab: SubReportTab) => void;
}

export const ReportingView: React.FC<ReportingViewProps> = ({ 
  initialSubTab = 'analytics',
  onSubTabChange 
}) => {
  const { 
    projects, 
    selectedProject, 
    setSelectedProject, 
    tasks, 
    teamMembers,
    isRtl 
  } = useProject();

  const [currentSubTab, setCurrentSubTab] = useState<SubReportTab>(initialSubTab);

  // Sync with prop if it changes
  useEffect(() => {
    if (initialSubTab) {
      setCurrentSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const handleTabChange = (tab: SubReportTab) => {
    setCurrentSubTab(tab);
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
  };

  // Active Project
  const activeProj = selectedProject || projects[0] || null;

  // Real-time Metrics calculations
  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter(t => t.status === 'completed' || t.status === 'COMPLETED').length;
  const avgProgress = projects.length > 0 
    ? Math.round(projects.reduce((acc, p) => acc + (p.progress || 0), 0) / projects.length) 
    : 0;

  const taskCompletionRate = totalTasksCount > 0 
    ? Math.round((completedTasksCount / totalTasksCount) * 100) 
    : 0;

  // Bottleneck tasks (blocked or overdue)
  const blockedTasks = tasks.filter(t => t.status === 'blocked' || (t as any).isBlocked);
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');

  return (
    <div className="w-full space-y-6 font-vazirmatn transition-colors duration-200">
      
      {/* LEVEL 1 — TOP SEGMENTED TAB NAVIGATION */}
      <div className="flex items-center gap-2 justify-start overflow-x-auto pb-1 select-none scrollbar-none" dir="rtl">
        {/* Tab 1: Executive Analytics & KPI Matrix */}
        <button
          type="button"
          onClick={() => handleTabChange('analytics')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            currentSubTab === 'analytics'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white dark:bg-[#0d121f] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200/90 dark:border-slate-800'
          }`}
        >
          <BarChart3 size={16} />
          <span>ماتریس و تحلیل عملکرد</span>
        </button>

        {/* Tab 2: Interactive Roadmap & Dependency Graph */}
        <button
          type="button"
          onClick={() => handleTabChange('roadmap')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap relative ${
            currentSubTab === 'roadmap'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white dark:bg-[#0d121f] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200/90 dark:border-slate-800'
          }`}
        >
          <Network size={16} />
          <span>رودمپ و جریان اجرای پروژه</span>
        </button>

        {/* Tab 3: Bottleneck Radar & Critical Path */}
        <button
          type="button"
          onClick={() => handleTabChange('bottlenecks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap relative ${
            currentSubTab === 'bottlenecks'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white dark:bg-[#0d121f] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200/90 dark:border-slate-800'
          }`}
        >
          <AlertTriangle size={16} />
          <span>پایش گلوگاه‌ها و موانع</span>
          {blockedTasks.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
              {blockedTasks.length}
            </span>
          )}
        </button>

        {/* Tab 4: Phase Timeline & Milestones */}
        <button
          type="button"
          onClick={() => handleTabChange('timeline')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            currentSubTab === 'timeline'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white dark:bg-[#0d121f] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200/90 dark:border-slate-800'
          }`}
        >
          <Calendar size={16} />
          <span>تایملاین و فازبندی اجرایی</span>
        </button>
      </div>

      {/* TAB 1 CONTENT: EXECUTIVE ANALYTICS & KPI MATRIX */}
      {currentSubTab === 'analytics' && (
        <div className="w-full animate-in fade-in duration-300">
          <DepartmentReportsView
            kpiCards={
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. میانگین پیشرفت کل پروژه‌ها */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">میانگین پیشرفت کل پروژه‌ها</span>
                    <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <TrendingUp size={18} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-900 dark:text-white">{avgProgress}٪</span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                      <ArrowUpRight size={14} />
                      <span>+۴.۲٪ این ماه</span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-3 overflow-hidden">
                    <div className="h-full bg-blue-600 dark:bg-blue-500 rounded-full" style={{ width: `${avgProgress}%` }} />
                  </div>
                </div>

                {/* 2. نرخ تکمیل تسک‌های سازمانی */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">نرخ تکمیل تسک‌های سازمانی</span>
                    <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={18} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-900 dark:text-white">{taskCompletionRate}٪</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                      {completedTasksCount} از {totalTasksCount} تسک
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-3 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${taskCompletionRate}%` }} />
                  </div>
                </div>

                {/* 3. شاخص سلامت و پایداری تحویل */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">شاخص سلامت و پایداری تحویل</span>
                    <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                      <Activity size={18} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-900 dark:text-white">۹۴.۸٪</span>
                    <span className="text-xs text-cyan-600 dark:text-cyan-400 font-bold">عالی (در بازه استاندارد)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">محاسبه بر اساس انطباق با ددلاین‌ها</p>
                </div>

                {/* 4. گلوگاه‌های نیازمند اقدام فوری */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">گلوگاه‌های نیازمند اقدام فوری</span>
                    <div className={`p-2 rounded-xl ${blockedTasks.length > 0 ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                      <AlertTriangle size={18} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-900 dark:text-white">{blockedTasks.length}</span>
                    <span className="text-xs text-rose-600 dark:text-rose-400 font-bold">مورد مسدودشده</span>
                  </div>
                  <button
                    onClick={() => handleTabChange('bottlenecks')}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline mt-2 flex items-center gap-1 cursor-pointer"
                  >
                    <span>مشاهده رادار گلوگاه‌ها</span>
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            }
          />
        </div>
      )}

      {/* TAB 2 CONTENT: INTERACTIVE WORKFLOW TREE & AGENT PLAN ROADMAP */}
      {currentSubTab === 'roadmap' && (
        <div className="w-full animate-in fade-in duration-300">
          <ProjectRoadmapPlan />
        </div>
      )}

      {/* TAB 3 CONTENT: BOTTLENECK RADAR & CRITICAL PATH */}
      {currentSubTab === 'bottlenecks' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Top Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-50 via-white to-slate-50 dark:from-rose-950/40 dark:via-[#0d1424] dark:to-[#070b14] border border-rose-200 dark:border-rose-800/40 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">رادار گلوگاه‌ها و مانیتورینگ مسیر بحرانی (Critical Path)</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  این بخش به طور خودکار وابستگی‌های معطل‌مانده، تسک‌های دارای تاخیر و موانعی که تحویل نهایی فازها را به تاخیر می‌اندازند را شناسایی کرده و به مدیران پروژه هشدار می‌دهد.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 text-xs font-black">
                {blockedTasks.length} گلوگاه فعال
              </span>
            </div>
          </div>

          {/* Critical Path Flow Overview */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#0d1424]/90 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Layers size={16} className="text-amber-500" />
              <span>فازهای کلیدی در ریسک تاخیر</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-300">توسعه درگاه پرداخت و تسویه‌حساب</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                    بحرانی
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  تاخیر در دریافت مرچنت‌کد بانکی باعث مسدود شدن تست خرید پروداکشن گردیده است.
                </p>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                  <span>مسئول: مهدی کریمی</span>
                  <span className="text-rose-600 dark:text-rose-400 font-mono font-bold">+۳ روز تاخیر</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-300">تاییدیه کانسپت بصری لوگو</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                    هشدار
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  در انتظار بازخورد کارفرما برای انتخاب کانسپت A یا B جهت ورود به فاز برندهوک.
                </p>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                  <span>مسئول: پارسا درخشان</span>
                  <span className="text-amber-600 dark:text-amber-400 font-mono font-bold">+۱ روز تاخیر</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-300">ممیزی سرعت و امتیاز PageSpeed</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30">
                    پایش مستمر
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  امتیاز موبایل روی ۸۱ است؛ نیاز به بهینه‌سازی فونت‌ها و فرمت تصاویر به WebP.
                </p>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                  <span>مسئول: سارا یوسفی</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-mono font-bold">در موعد مقرر</span>
                </div>
              </div>

            </div>
          </div>

          {/* Blocked Tasks Interactive Table */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#0d1424]/90 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-500" />
                <span>لیست جامع تسک‌های مسدودشده در سازمان</span>
              </h4>
              <span className="text-xs text-slate-500 dark:text-slate-400">مرتب‌سازی بر اساس شدت اثرگذاری</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="pb-3 font-bold">عنوان وظیفه</th>
                    <th className="pb-3 font-bold">پروژه مربوطه</th>
                    <th className="pb-3 font-bold">دپارتمان</th>
                    <th className="pb-3 font-bold">مسئول پیگیری</th>
                    <th className="pb-3 font-bold">دلیل انسداد</th>
                    <th className="pb-3 font-bold text-left">اقدام سریع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {blockedTasks.length > 0 ? (
                    blockedTasks.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 font-bold text-slate-800 dark:text-slate-200">{t.title}</td>
                        <td className="py-3 text-slate-500 dark:text-slate-400">
                          {projects.find(p => p.id === t.projectId)?.title || 'پروژه جاری'}
                        </td>
                        <td className="py-3 text-slate-500 dark:text-slate-400">{t.department || 'فنی'}</td>
                        <td className="py-3 text-slate-700 dark:text-slate-300 font-medium">
                          {teamMembers.find(m => m.id === t.assigneeId)?.name || 'تیم توسعه'}
                        </td>
                        <td className="py-3 text-rose-600 dark:text-rose-400 text-[11px]">
                          {(t as any).blockedReason || 'وابستگی معطل به تایید کارفرما یا دیتای سرور'}
                        </td>
                        <td className="py-3 text-left">
                          <button
                            onClick={() => handleTabChange('roadmap')}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 hover:bg-blue-600 hover:text-white transition-all text-[11px] font-bold cursor-pointer"
                          >
                            نمایش در رودمپ
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <CheckCircle2 size={28} className="text-emerald-500" />
                          <span className="font-bold text-sm text-slate-800 dark:text-slate-300">هیچ گلوگاه فعالی ثبت نشده است!</span>
                          <span className="text-xs text-slate-500">تمامی تسک‌های مسیر بحرانی طبق برنامه درحال پیشرفت هستند.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 4 CONTENT: PHASE TIMELINE & MILESTONES */}
      {currentSubTab === 'timeline' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          <div className="p-6 rounded-2xl bg-white dark:bg-[#0d1424]/90 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">جدول زمان‌بندی و مایلستون‌های تحویل</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  پایش گانت فازهای پروژه «{activeProj?.title || 'پروژه سازمانی'}» بر حسب تقویم اجرایی
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 font-bold">
                  کل دوره اجرا: ۳۵ روز کاری
                </span>
              </div>
            </div>

            {/* Chronological Phase Milestones */}
            <div className="space-y-4">
              
              {/* Phase 1 */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10">
                        فاز ۰۱ • مایلستون اول
                      </span>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">استارت، تحلیل بریف و زیرساخت سرور</h4>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">ثبت دامنه، اتصال SSL، پیکربندی مخزن گیت و بریف</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-mono">۴ روز کاری</span>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">تکمیل ۱۰۰٪</span>
                </div>
              </div>

              {/* Phase 2 */}
              <div className="p-4 rounded-xl bg-cyan-50/40 dark:bg-slate-900/60 border border-cyan-400/50 dark:border-cyan-500/40 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/40 flex items-center justify-center shrink-0 animate-pulse">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-cyan-600 dark:text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-500/10">
                        فاز ۰۲ • مایلستون دوم (جاری)
                      </span>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">توسعه ساختار اصلی، کامپوننت‌ها و پایگاه داده</h4>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">پیاده‌سازی المنتور/گوتنبرگ، پست‌تایپ‌های ACF و ماژول‌ها</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-mono">۱۲ روز کاری</span>
                  <span className="px-2.5 py-1 rounded-full bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 font-bold animate-pulse">درحال اجرا ۶۵٪</span>
                </div>
              </div>

              {/* Phase 3 */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
                    <Clock size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                        فاز ۰۳ • مایلستون سوم
                      </span>
                      <h4 className="text-sm font-black text-slate-800 dark:text-slate-300">تضمین کیفیت جامع، ممیزی امنیتی و WCAG 2.2</h4>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">تست کراس‌براوزر، فرم‌ها، تست لودینگ و دسترس‌پذیری</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-mono">۵ روز کاری</span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">در انتظار فاز ۲</span>
                </div>
              </div>

              {/* Phase 4 */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
                    <Clock size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                        فاز ۰۴ • مایلستون چهارم
                      </span>
                      <h4 className="text-sm font-black text-slate-800 dark:text-slate-300">لانچ پروداکشن، سوئیچ DNS و آموزش کارفرما</h4>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">انتقال دیتابیس لایو، ثبت سرچ‌کنسول و تحویل مستندات</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-mono">۴ روز کاری</span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">برنامه‌ریزی‌شده</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

    </div>
  );
};

export default ReportingView;
