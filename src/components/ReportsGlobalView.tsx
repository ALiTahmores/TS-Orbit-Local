import React, { useState, useMemo, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { EmptyState } from './EmptyState';
import { DepartmentReportsView } from './DepartmentReportsView';
import { TeamPerformanceView } from './TeamPerformanceView';
import { Briefcase, CheckCircle, Clock, Users, ChevronDown, Download, Printer } from 'lucide-react';
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from 'recharts';
import { assignedIds } from '../lib/domain';
import { deliveredOnTime, downloadCsv, dueDate } from '../lib/taskAnalytics';
import { priorityLabel, statusLabel } from '../lib/taskLabels';

const fa = (value: number | string) => String(value).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const csv = (rows: string[][]) => '﻿' + rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');

export const ReportsGlobalView: React.FC = () => {
  const { projects, tasks, teamMembers, activeSubTab, openNewProjectModal } = useProject();

  const [activeReport, setActiveReport] = useState<'project' | 'team' | 'automated'>(() => {
    return activeSubTab === 'team_reports' ? 'team' : 'automated';
  });
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    if (activeSubTab === 'team_reports') {
      setActiveReport('team');
    }
  }, [activeSubTab]);

  const metrics = useMemo(() => {
    const open = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
    const judged = tasks.filter(t => t.status === 'completed').map(deliveredOnTime).filter((value): value is boolean => value !== undefined);
    return {
      activeProjects: projects.filter(p => p.status === 'active').length,
      avgProgress: projects.length ? Math.round(projects.reduce((acc, p) => acc + (p.progress || 0), 0) / projects.length) : 0,
      openPerMember: teamMembers.length ? open.length / teamMembers.length : 0,
      open: open.length,
      onTime: judged.length ? Math.round(judged.filter(Boolean).length / judged.length * 100) : null,
      judged: judged.length,
    };
  }, [projects, tasks, teamMembers]);

  const projectChartData = useMemo(() => projects.map(p => ({
    name: p.title.length > 18 ? `${p.title.slice(0, 17)}…` : p.title,
    progress: p.progress || 0,
  })), [projects]);

  const memberNames = (task: any) => {
    const ids = assignedIds(task);
    return teamMembers.filter(m => ids.includes(m.id)).map(m => m.name).join('، ') || task.assignedTo || '';
  };

  const handleExportCSV = (type: 'projects' | 'tasks') => {
    setExportOpen(false);
    const stamp = new Date().toISOString().slice(0, 10);
    if (type === 'projects') {
      downloadCsv(`ts-orbit-projects-${stamp}.csv`, csv([
        ['عنوان پروژه', 'وضعیت', 'پیشرفت (٪)', 'کارفرما', 'بودجه', 'تاریخ پایان'],
        ...projects.map(p => [p.title, p.status, String(p.progress || 0), p.clientName || '', p.budget || '', (p.deadline || '').slice(0, 10)]),
      ]));
    } else {
      downloadCsv(`ts-orbit-tasks-${stamp}.csv`, csv([
        ['عنوان وظیفه', 'پروژه', 'مسئول', 'اولویت', 'وضعیت', 'سررسید'],
        ...tasks.map(t => [t.title, projects.find(p => p.id === t.projectId)?.title || '', memberNames(t), priorityLabel(t.priority), statusLabel(t.status), dueDate(t) || '']),
      ]));
    }
  };

  if (projects.length === 0) {
    return (
      <div className="p-4" dir="rtl">
        <EmptyState
          id="global_reports_empty"
          title="هنوز گزارشی برای نمایش نیست"
          description="گزارش‌ها از پروژه‌ها و وظایف همین فضای کاری ساخته می‌شوند. ابتدا یک پروژه بسازید و برای آن وظیفه تعریف کنید."
          actionLabel="ساخت اولین پروژه"
          onAction={openNewProjectModal}
          iconType="report"
        />
      </div>
    );
  }

  if (activeSubTab === 'team_reports') {
    return <TeamPerformanceView />;
  }

  const cards = [
    { label: 'پروژه‌های فعال', value: `${fa(metrics.activeProjects)} از ${fa(projects.length)}`, hint: 'پروژه‌های در حال اجرا', icon: Briefcase, tone: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' },
    { label: 'میانگین پیشرفت پروژه‌ها', value: `${fa(metrics.avgProgress)}٪`, hint: 'از وظایف تکمیل‌شدهٔ هر پروژه', icon: CheckCircle, tone: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' },
    { label: 'وظایف باز به ازای هر عضو', value: fa(metrics.openPerMember.toFixed(1)), hint: `${fa(metrics.open)} وظیفهٔ باز، ${fa(teamMembers.length)} عضو`, icon: Users, tone: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20' },
    { label: 'تحویل به‌موقع', value: metrics.onTime === null ? '—' : `${fa(metrics.onTime)}٪`, hint: metrics.judged ? `از ${fa(metrics.judged)} وظیفهٔ دارای سررسید` : 'هنوز داده‌ای نیست', icon: Clock, tone: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' },
  ];

  const tabClass = (id: typeof activeReport) => `px-4 py-2 text-xs rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
    activeReport === id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'
  }`;

  return (
    <div id="reports_center" className="w-full space-y-6" dir="rtl">

      {/* EXPORT AND ACTIONS BAR */}
      <div className="flex flex-wrap justify-between items-center gap-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
        <div>
          <h2 className="text-sm font-black text-slate-800 dark:text-white">گزارش‌های فضای کاری</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">پیشرفت پروژه‌ها، کارکرد اعضا و گزارش‌های ذخیره‌شده.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen(open => !open)}
              aria-expanded={exportOpen}
              className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Download size={14} className="text-slate-500" />
              <span>خروجی CSV</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                <div className="absolute left-0 mt-1.5 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 overflow-hidden">
                  <button type="button" onClick={() => handleExportCSV('projects')} className="w-full text-right px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 block font-medium cursor-pointer">فهرست پروژه‌ها</button>
                  <button type="button" onClick={() => handleExportCSV('tasks')} className="w-full text-right px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 block font-medium cursor-pointer">فهرست وظایف</button>
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/10 cursor-pointer"
          >
            <Printer size={14} />
            <span>چاپ</span>
          </button>
        </div>
      </div>

      {/* OVERVIEW ROW CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(card => (
          <div key={card.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-2 shadow-sm">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">{card.label}</p>
              <p className="text-base font-black text-slate-800 dark:text-white mt-1">{card.value}</p>
              <span className="text-[10px] text-slate-400 mt-1 block truncate">{card.hint}</span>
            </div>
            <span className={`p-2.5 rounded-xl border shadow-sm shrink-0 ${card.tone}`}>
              <card.icon size={16} />
            </span>
          </div>
        ))}
      </div>

      {/* REPORT TABS */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 pb-2.5 gap-2 overflow-x-auto scrollbar-none">
        <button type="button" onClick={() => setActiveReport('automated')} className={tabClass('automated')}>گزارش‌های مدیریتی</button>
        <button type="button" onClick={() => setActiveReport('project')} className={tabClass('project')}>پیشرفت پروژه‌ها</button>
        <button type="button" onClick={() => setActiveReport('team')} className={tabClass('team')}>کارکرد اعضا</button>
      </div>

      {activeReport === 'project' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">مقایسهٔ پیشرفت پروژه‌ها</h3>
              <p className="text-[11px] text-slate-400 mt-1">درصد وظایف تکمیل‌شدهٔ هر پروژه</p>
            </div>
            <div className="h-64 w-full text-xs" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" tickLine={false} reversed />
                  <YAxis stroke="#64748b" tickLine={false} domain={[0, 100]} orientation="right" />
                  <Tooltip
                    formatter={(value: any) => [`${fa(value)}٪`, 'پیشرفت']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', direction: 'rtl', textAlign: 'right' }}
                  />
                  <Bar dataKey="progress" radius={[6, 6, 0, 0]}>
                    {projectChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3b82f6' : '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-xs text-slate-800 dark:text-white">پیشرفت هر پروژه</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">میانگین: {fa(metrics.avgProgress)}٪</p>
            </div>
            <div className="space-y-3.5">
              {projects.map(p => (
                <div key={p.id} className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[180px]">{p.title}</span>
                    <span>{fa(p.progress || 0)}٪</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p.progress > 80 ? 'bg-emerald-500' : p.progress > 40 ? 'bg-blue-500' : 'bg-amber-500'}`}
                      style={{ width: `${p.progress || 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeReport === 'team' && <TeamPerformanceView />}

      {activeReport === 'automated' && <DepartmentReportsView />}
    </div>
  );
};
