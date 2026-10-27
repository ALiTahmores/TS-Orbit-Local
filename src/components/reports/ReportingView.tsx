import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Network,
  AlertTriangle,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ChevronRight,
  Layers
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { DepartmentReportsView } from '../DepartmentReportsView';
import { ProjectRoadmapPlan } from './roadmap/ProjectRoadmapPlan';
import { assignedIds } from '../../lib/domain';
import { deliveredOnTime, dueDate, isOverdue, todayISO } from '../../lib/taskAnalytics';
import { statusLabel } from '../../lib/taskLabels';

export type SubReportTab = 'analytics' | 'roadmap' | 'bottlenecks' | 'timeline';

interface ReportingViewProps {
  initialSubTab?: SubReportTab;
  onSubTabChange?: (tab: SubReportTab) => void;
}

const fa = (value: number | string) => String(value).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const DAY = 24 * 60 * 60 * 1000;
const jalali = (iso?: string) => {
  const date = iso ? new Date(`${iso.slice(0, 10)}T00:00:00`) : undefined;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
};
const daysBetween = (fromISO: string, toISO: string) => Math.round((new Date(`${toISO}T00:00:00`).getTime() - new Date(`${fromISO}T00:00:00`).getTime()) / DAY);

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ElementType; label: string; badge?: number }> = ({ active, onClick, icon: Icon, label, badge }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
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
  const { projects, selectedProject, tasks, teamMembers } = useProject();

  const [currentSubTab, setCurrentSubTab] = useState<SubReportTab>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) setCurrentSubTab(initialSubTab);
  }, [initialSubTab]);

  const handleTabChange = (tab: SubReportTab) => {
    setCurrentSubTab(tab);
    onSubTabChange?.(tab);
  };

  const activeProj = selectedProject && selectedProject.id !== 'no_project' ? selectedProject : projects[0] || null;
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

  const projectTitle = (id: string) => projects.find(p => p.id === id)?.title || '—';
  const ownerName = (task: any) => {
    const ids = assignedIds(task);
    return teamMembers.filter(m => ids.includes(m.id)).map(m => m.name).join('، ') || task.assignedTo || 'بدون مسئول';
  };

  // Projects ranked by how many of their open tasks are blocked or overdue.
  const projectsAtRisk = useMemo(() => projects.map(project => {
    const own = tasks.filter(t => t.projectId === project.id);
    return { project, blocked: own.filter(t => t.status === 'blocked').length, overdue: own.filter(t => isOverdue(t, today)).length };
  }).filter(row => row.blocked + row.overdue > 0).sort((a, b) => (b.blocked + b.overdue) - (a.blocked + a.overdue)), [projects, tasks, today]);

  const issueRows = useMemo(() => {
    const seen = new Set<string>();
    return [...metrics.blocked, ...metrics.overdue].filter(task => !seen.has(task.id) && !!seen.add(task.id));
  }, [metrics]);

  const timelineTasks = useMemo(() => activeProj
    ? tasks.filter(t => t.projectId === activeProj.id).sort((a, b) => (dueDate(a) || '9999').localeCompare(dueDate(b) || '9999'))
    : [], [tasks, activeProj]);
  const projectDeadline = activeProj ? (activeProj.deadline || activeProj.dueDate || '').slice(0, 10) : '';

  const card = 'p-5 rounded-2xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 shadow-sm';

  return (
    <div className="w-full space-y-6 font-vazirmatn transition-colors duration-200">
      <div className="flex items-center gap-2 justify-start overflow-x-auto pb-1 select-none scrollbar-none" dir="rtl">
        <TabButton active={currentSubTab === 'analytics'} onClick={() => handleTabChange('analytics')} icon={BarChart3} label="تحلیل عملکرد" />
        <TabButton active={currentSubTab === 'roadmap'} onClick={() => handleTabChange('roadmap')} icon={Network} label="نقشهٔ راه پروژه" />
        <TabButton active={currentSubTab === 'bottlenecks'} onClick={() => handleTabChange('bottlenecks')} icon={AlertTriangle} label="موانع و تأخیرها" badge={issueRows.length} />
        <TabButton active={currentSubTab === 'timeline'} onClick={() => handleTabChange('timeline')} icon={Calendar} label="زمان‌بندی وظایف" />
      </div>

      {currentSubTab === 'analytics' && (
        <div className="w-full animate-in fade-in duration-300">
          <DepartmentReportsView
            kpiCards={
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" dir="rtl">
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

      {currentSubTab === 'bottlenecks' && (
        <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
          <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-50 via-white to-slate-50 dark:from-rose-950/40 dark:via-[#0d1424] dark:to-[#070b14] border border-rose-200 dark:border-rose-800/40 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30"><ShieldAlert size={24} /></div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">موانع و تأخیرها</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  وظایفی که متوقف شده‌اند یا از سررسیدشان گذشته است، به همراه پروژه‌هایی که بیشترین مورد را دارند.
                </p>
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 text-xs font-black self-start md:self-auto">
              {fa(issueRows.length)} مورد
            </span>
          </div>

          {projectsAtRisk.length > 0 && (
            <div className="p-6 rounded-2xl bg-white dark:bg-[#0d1424]/90 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Layers size={16} className="text-amber-500" />
                <span>پروژه‌های در معرض تأخیر</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {projectsAtRisk.slice(0, 6).map(({ project, blocked, overdue }) => (
                  <div key={project.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 space-y-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-300 block truncate">{project.title}</span>
                    <div className="flex items-center gap-3 text-[11px] font-bold">
                      {blocked > 0 && <span className="text-rose-600 dark:text-rose-400">{fa(blocked)} متوقف</span>}
                      {overdue > 0 && <span className="text-amber-600 dark:text-amber-400">{fa(overdue)} دارای تأخیر</span>}
                      <span className="text-slate-400 mr-auto">پیشرفت {fa(project.progress || 0)}٪</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-6 rounded-2xl bg-white dark:bg-[#0d1424]/90 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-500" />
              <span>فهرست وظایف متوقف یا دارای تأخیر</span>
            </h4>
            {issueRows.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-center">
                <CheckCircle2 size={28} className="text-emerald-500" />
                <span className="font-bold text-sm text-slate-800 dark:text-slate-300">موردی ثبت نشده است.</span>
                <span className="text-xs text-slate-500">هیچ وظیفه‌ای متوقف نیست و سررسید هیچ وظیفهٔ بازی نگذشته است.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs min-w-[640px]">
                  <thead>
                    <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <th className="pb-3 font-bold">عنوان وظیفه</th>
                      <th className="pb-3 font-bold">پروژه</th>
                      <th className="pb-3 font-bold">مسئول</th>
                      <th className="pb-3 font-bold">وضعیت</th>
                      <th className="pb-3 font-bold">سررسید</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {issueRows.map(t => {
                      const due = dueDate(t);
                      const late = due && due < today ? daysBetween(due, today) : 0;
                      return (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 font-bold text-slate-800 dark:text-slate-200">{t.title}</td>
                          <td className="py-3 text-slate-500 dark:text-slate-400">{projectTitle(t.projectId)}</td>
                          <td className="py-3 text-slate-700 dark:text-slate-300 font-medium">{ownerName(t)}</td>
                          <td className="py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.status === 'blocked' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{statusLabel(t.status)}</span></td>
                          <td className={`py-3 ${late ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-500'}`}>
                            {due ? jalali(due) : 'بدون سررسید'}{late ? ` (${fa(late)} روز تأخیر)` : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {currentSubTab === 'timeline' && (
        <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#0d1424]/90 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">زمان‌بندی وظایف</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {activeProj ? `وظایف پروژهٔ «${activeProj.title}» به ترتیب سررسید` : 'ابتدا یک پروژه بسازید.'}
                </p>
              </div>
              {projectDeadline && (
                <span className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 font-bold text-xs self-start sm:self-auto">
                  پایان پروژه: {jalali(projectDeadline)}
                  {projectDeadline >= today ? ` (${fa(daysBetween(today, projectDeadline))} روز مانده)` : ' (گذشته)'}
                </span>
              )}
            </div>

            {timelineTasks.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">{activeProj ? 'هنوز وظیفه‌ای برای این پروژه ثبت نشده است.' : ''}</p>
            ) : (
              <ol className="space-y-3">
                {timelineTasks.map(task => {
                  const due = dueDate(task);
                  const done = task.status === 'completed';
                  const late = isOverdue(task, today);
                  return (
                    <li key={task.id} className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${late ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50' : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800'}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${done ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : late ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                          {done ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">{task.title}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{ownerName(task)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs shrink-0">
                        <span className={late ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-slate-400'}>{due ? jalali(due) : 'بدون سررسید'}</span>
                        <span className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">{statusLabel(task.status)}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportingView;
