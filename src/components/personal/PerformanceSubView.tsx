import React, { useMemo } from 'react';
import { Award, CheckCircle2, Clock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useUserAnalytics } from '../../hooks/useUserAnalytics';
import { completedAt } from '../../lib/taskAnalytics';

const toPersianDigits = (n: string | number): string => {
  if (n === undefined || n === null) return '';
  return n.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)] || '۰');
};

const DAY = 24 * 60 * 60 * 1000;

/** Personal performance from the user's own assigned tasks; no score is shown without data. */
export const PerformanceSubView: React.FC = () => {
  const { locale } = useProject();
  const isRtl = locale === 'fa';
  const analytics = useUserAnalytics();

  const metrics = useMemo(() => {
    const completed = analytics.myTasks.filter(task => completedAt(task));
    const durations = completed
      .map(task => { const done = completedAt(task)!, created = task.createdAt ? new Date(task.createdAt) : undefined; return created && !Number.isNaN(created.getTime()) ? (done.getTime() - created.getTime()) / DAY : undefined; })
      .filter((days): days is number => days !== undefined && days >= 0);
    const sixMonthsAgo = Date.now() - 182 * DAY;
    return {
      completionRate: analytics.totalMyTasks ? Math.round(analytics.completedTasksCount / analytics.totalMyTasks * 100) : null,
      averageDays: durations.length ? durations.reduce((sum, days) => sum + days, 0) / durations.length : null,
      recentCompleted: completed.filter(task => completedAt(task)!.getTime() >= sixMonthsAgo).length,
    };
  }, [analytics]);

  const cards = [
    { label: 'نرخ تکمیل وظایف', value: metrics.completionRate === null ? '—' : `${toPersianDigits(metrics.completionRate)}٪`, hint: `${toPersianDigits(analytics.completedTasksCount)} از ${toPersianDigits(analytics.totalMyTasks)} وظیفهٔ واگذارشده`, icon: CheckCircle2, color: 'text-emerald-500' },
    { label: 'تحویل به‌موقع', value: analytics.onTimeDeliveryRate === null ? '—' : `${toPersianDigits(analytics.onTimeDeliveryRate)}٪`, hint: analytics.onTimeDeliveryRate === null ? 'هنوز وظیفهٔ سررسیددار تکمیل نشده' : 'از وظایف سررسیددارِ تکمیل‌شده', icon: ShieldCheck, color: 'text-blue-500' },
    { label: 'میانگین زمان انجام', value: metrics.averageDays === null ? '—' : `${toPersianDigits(metrics.averageDays.toFixed(1))} روز`, hint: 'از ثبت تا تکمیل', icon: Clock, color: 'text-indigo-500' },
    { label: 'تکمیل‌شده در ۶ ماه اخیر', value: toPersianDigits(metrics.recentCompleted), hint: `${toPersianDigits(analytics.overdueTasksCount)} وظیفه دارای تأخیر`, icon: AlertTriangle, color: 'text-amber-500' },
  ];

  return (
    <div className="space-y-6 font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Award className="w-6 h-6 text-amber-500" />
          <span>عملکرد من</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
          آمار بر اساس وظایفی که به شما واگذار شده و تاریخچهٔ وضعیت آن‌ها محاسبه می‌شود.
        </p>
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

      {analytics.totalMyTasks === 0 && (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          هنوز وظیفه‌ای به شما واگذار نشده است؛ آمار عملکرد پس از انجام اولین وظایف نمایش داده می‌شود.
        </div>
      )}
    </div>
  );
};
