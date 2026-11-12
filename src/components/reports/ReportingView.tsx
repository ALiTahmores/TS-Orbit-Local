import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Network,
  AlertTriangle,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Clock,
  ChevronRight
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { DepartmentReportsView } from '../DepartmentReportsView';
import { ProjectRoadmapPlan } from './roadmap/ProjectRoadmapPlan';
import { RiskReview } from './RiskReview';
import { ScheduleBoard } from './ScheduleBoard';
import { deliveredOnTime, isOverdue, todayISO } from '../../lib/taskAnalytics';

export type SubReportTab = 'analytics' | 'roadmap' | 'bottlenecks' | 'timeline';

interface ReportingViewProps {
  initialSubTab?: SubReportTab;
  onSubTabChange?: (tab: SubReportTab) => void;
}

const fa = (value: number | string) => String(value).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ElementType; label: string; badge?: number }> = ({ active, onClick, icon: Icon, label, badge }) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
      active
        ? 'bg-blue-600 text-white shadow-sm'
        : 'bg-white dark:bg-[#0d121f] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200/90 dark:border-slate-800'
    }`}
  >
    <Icon size={16} />
    <span>{label}</span>
    {!!badge && (
      <span className="min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">{fa(badge)}</span>
    )}
  </button>
);

export const ReportingView: React.FC<ReportingViewProps> = ({
  initialSubTab = 'analytics',
  onSubTabChange
}) => {
  const { projects, tasks } = useProject();

  const [currentSubTab, setCurrentSubTab] = useState<SubReportTab>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) setCurrentSubTab(initialSubTab);
  }, [initialSubTab]);

  const handleTabChange = (tab: SubReportTab) => {
    setCurrentSubTab(tab);
    onSubTabChange?.(tab);
  };

  const today = todayISO();

  const metrics = useMemo(() => {
    const completed = tasks.filter(t => t.status === 'completed');
    const judged = completed.map(deliveredOnTime).filter((value): value is boolean => value !== undefined);
    return {
      avgProgress: projects.length ? Math.round(projects.reduce((acc, p) => acc + (p.progress || 0), 0) / projects.length) : 0,
      completionRate: tasks.length ? Math.round(completed.length / tasks.length * 100) : 0,
      completed: completed.length,
      judged: judged.length,
      onTime: judged.length ? Math.round(judged.filter(Boolean).length / judged.length * 100) : null,
      blocked: tasks.filter(t => t.status === 'blocked'),
      overdue: tasks.filter(t => isOverdue(t, today)),
    };
  }, [tasks, projects, today]);

  const issueRows = useMemo(() => {
    const seen = new Set<string>();
    return [...metrics.blocked, ...metrics.overdue].filter(task => !seen.has(task.id) && !!seen.add(task.id));
  }, [metrics]);

  const card = 'p-5 rounded-2xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 shadow-sm';

  return (
    <div className="w-full space-y-6 font-vazirmatn transition-colors duration-200">
      <div className="tab-scroller page-bleed items-center gap-2 pb-1 select-none">
        <TabButton active={currentSubTab === 'analytics'} onClick={() => handleTabChange('analytics')} icon={BarChart3} label="تحلیل عملکرد" />
        <TabButton active={currentSubTab === 'roadmap'} onClick={() => handleTabChange('roadmap')} icon={Network} label="نقشهٔ راه پروژه" />
        <TabButton active={currentSubTab === 'bottlenecks'} onClick={() => handleTabChange('bottlenecks')} icon={AlertTriangle} label="موانع و تأخیرها" badge={issueRows.length} />
        <TabButton active={currentSubTab === 'timeline'} onClick={() => handleTabChange('timeline')} icon={Calendar} label="زمان‌بندی وظایف" />
      </div>

      {currentSubTab === 'analytics' && (
        <div className="w-full animate-in fade-in duration-300">
          <DepartmentReportsView
            kpiCards={
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className={card}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">میانگین پیشرفت پروژه‌ها</span>
                    <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"><TrendingUp size={18} /></div>
                  </div>
                  <div className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{fa(metrics.avgProgress)}٪</div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-3 overflow-hidden">
                    <div className="h-full bg-blue-600 dark:bg-blue-500 rounded-full" style={{ width: `${metrics.avgProgress}%` }} />
                  </div>
                </div>

                <div className={card}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">نرخ تکمیل وظایف</span>
                    <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><CheckCircle2 size={18} /></div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-900 dark:text-white">{fa(metrics.completionRate)}٪</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">{fa(metrics.completed)} از {fa(tasks.length)} وظیفه</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-3 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${metrics.completionRate}%` }} />
                  </div>
                </div>

                <div className={card}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">تحویل به‌موقع</span>
                    <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"><Clock size={18} /></div>
                  </div>
                  <div className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{metrics.onTime === null ? '—' : `${fa(metrics.onTime)}٪`}</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    {metrics.judged ? `بر اساس ${fa(metrics.judged)} وظیفهٔ تکمیل‌شدهٔ دارای سررسید` : 'هنوز وظیفهٔ تکمیل‌شده‌ای با سررسید ثبت نشده است.'}
                  </p>
                </div>

                <div className={card}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">نیازمند اقدام</span>
                    <div className={`p-2 rounded-xl ${issueRows.length ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}><AlertTriangle size={18} /></div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-900 dark:text-white">{fa(issueRows.length)}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">{fa(metrics.blocked.length)} متوقف، {fa(metrics.overdue.length)} دارای تأخیر</span>
                  </div>
                  <button type="button" onClick={() => handleTabChange('bottlenecks')} className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline mt-2 flex items-center gap-1 cursor-pointer">
                    <span>مشاهدهٔ موارد</span>
                    <ChevronRight size={12} className="rotate-180" />
                  </button>
                </div>
              </div>
            }
          />
        </div>
      )}

      {currentSubTab === 'roadmap' && (
        <div className="w-full animate-in fade-in duration-300">
          <ProjectRoadmapPlan />
        </div>
      )}

      {currentSubTab === 'bottlenecks' && <RiskReview />}

      {currentSubTab === 'timeline' && <ScheduleBoard />}
    </div>
  );
};

export default ReportingView;
