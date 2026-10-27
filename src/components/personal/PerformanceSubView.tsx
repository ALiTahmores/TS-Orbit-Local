import React, { useMemo } from 'react';
import { Award, CheckCircle2, Clock, ShieldCheck, AlertTriangle, BarChart2, ListTodo } from 'lucide-react';
import { useUserAnalytics } from '../../hooks/useUserAnalytics';
import { completedAt, dueDate, isOverdue } from '../../lib/taskAnalytics';
import { STATUS_LABELS, statusKey } from '../../lib/taskLabels';
import { formatJalaliDate, persianNumber } from '../../lib/dates';
import { ActivityHeatmap } from '../common/ActivityHeatmap';

const DAY = 24 * 60 * 60 * 1000;
const isOpen = (task: any) => !['completed', 'cancelled'].includes(statusKey(task.status));

/** Personal performance from the user's own assigned tasks; no score is shown without data. */
export const PerformanceSubView: React.FC = () => {
  const analytics = useUserAnalytics();

  const metrics = useMemo(() => {
    const completed = analytics.myTasks.filter(task => completedAt(task));
    const durations = completed
      .map(task => { const done = completedAt(task)!, created = task.createdAt ? new Date(task.createdAt) : undefined; return created && !Number.isNaN(created.getTime()) ? (done.getTime() - created.getTime()) / DAY : undefined; })
      .filter((days): days is number => days !== undefined && days >= 0);
    const sixMonthsAgo = Date.now() - 182 * DAY;
    const open = analytics.myTasks.filter(isOpen);
    return {
      completionRate: analytics.totalMyTasks ? Math.round(analytics.completedTasksCount / analytics.totalMyTasks * 100) : null,
      averageDays: durations.length ? durations.reduce((sum, days) => sum + days, 0) / durations.length : null,
      recentCompleted: completed.filter(task => completedAt(task)!.getTime() >= sixMonthsAgo).length,
      completionDates: completed.map(task => completedAt(task)!),
      statusRows: (['pending', 'inprogress', 'review', 'blocked'] as const).map(key => ({ key, label: STATUS_LABELS[key].fa, count: open.filter(task => statusKey(task.status) === key).length })),
      overdue: open.filter(task => isOverdue(task)).sort((a, b) => String(dueDate(a)).localeCompare(String(dueDate(b)))).slice(0, 6),
      openCount: open.length,
    };
  }, [analytics]);
  const maxStatus = Math.max(1, ...metrics.statusRows.map(row => row.count));

  const cards = [
    { label: 'نرخ تکمیل وظایف', value: metrics.completionRate === null ? '—' : `${persianNumber(metrics.completionRate)}٪`, hint: `${persianNumber(analytics.completedTasksCount)} از ${persianNumber(analytics.totalMyTasks)} وظیفهٔ واگذارشده`, icon: CheckCircle2, color: 'text-emerald-500' },
    { label: 'تحویل به‌موقع', value: analytics.onTimeDeliveryRate === null ? '—' : `${persianNumber(analytics.onTimeDeliveryRate)}٪`, hint: analytics.onTimeDeliveryRate === null ? 'هنوز وظیفهٔ سررسیددار تکمیل نشده' : 'از وظایف سررسیددارِ تکمیل‌شده', icon: ShieldCheck, color: 'text-blue-500' },
    { label: 'میانگین زمان انجام', value: metrics.averageDays === null ? '—' : `${persianNumber(metrics.averageDays.toFixed(1))} روز`, hint: 'از ثبت تا تکمیل', icon: Clock, color: 'text-indigo-500' },
    { label: 'تکمیل‌شده در ۶ ماه اخیر', value: persianNumber(metrics.recentCompleted), hint: `${persianNumber(analytics.overdueTasksCount)} وظیفه دارای تأخیر`, icon: AlertTriangle, color: 'text-amber-500' },
  ];

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"><Award className="w-6 h-6" /></div>
        <div>
          <h1 className="text-xl font-black text-slate-800 dark:text-slate-100">عملکرد من</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">آمار بر اساس وظایفی که به شما واگذار شده و تاریخچهٔ وضعیت آن‌ها محاسبه می‌شود.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(card => (
          <div key={card.label} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5"><card.icon size={14} className={card.color} />{card.label}</span>
            <div className={`text-2xl font-black ${card.color}`}>{card.value}</div>
            <span className="text-[10px] text-slate-400 font-bold">{card.hint}</span>
          </div>
        ))}
      </div>

      {analytics.totalMyTasks === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          هنوز وظیفه‌ای به شما واگذار نشده است؛ آمار عملکرد پس از انجام اولین وظایف نمایش داده می‌شود.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">وظایف باز من بر اساس وضعیت</h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{`${persianNumber(metrics.openCount)} وظیفهٔ باز`}</p>
              </div>
              <BarChart2 size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="space-y-3 pt-1">
              {metrics.statusRows.map(row => (
                <div key={row.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700 dark:text-slate-300">{row.label}</span>
                    <span className={row.key === 'blocked' && row.count ? 'text-rose-600' : 'text-slate-500'}>{persianNumber(row.count)}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${row.key === 'blocked' ? 'bg-rose-500' : 'bg-blue-600'}`} style={{ width: `${row.count / maxStatus * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <ActivityHeatmap dates={metrics.completionDates} title="روزهای تکمیل وظایف من" subtitle="چهار هفتهٔ اخیر، هر خانه یک روز" describe={count => `${persianNumber(count)} وظیفهٔ تکمیل‌شده`} />

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">وظایف دارای تأخیر</h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">سررسیدشان گذشته و هنوز باز هستند</p>
              </div>
              <ListTodo size={18} className="text-rose-500" />
            </div>
            {metrics.overdue.length === 0 ? (
              <p className="text-xs text-slate-400 font-bold text-center py-10">وظیفهٔ عقب‌افتاده‌ای ندارید.</p>
            ) : (
              <ul className="space-y-2">
                {metrics.overdue.map(task => (
                  <li key={task.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{task.title}</span>
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 shrink-0">{formatJalaliDate(dueDate(task))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
