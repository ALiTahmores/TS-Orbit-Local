import React from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, ListTodo } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useUserAnalytics } from '../../hooks/useUserAnalytics';
import {
  PersonalProductivityChartWidget,
  Personal12TabsHealthWidget
} from './PersonalGamificationWidgets';

const toPersianDigits = (n: string | number): string => {
  if (n === undefined || n === null) return '';
  return n.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)] || '۰');
};

export const MyDashboardSubView: React.FC = () => {
  const { locale, setActiveTab, setActiveSubTab } = useProject();
  const analytics = useUserAnalytics();
  const isRtl = locale === 'fa';
  const openMyTasks = () => { setActiveTab('personal_tasks'); setActiveSubTab('my_tasks'); };

  // Every figure below is counted from the tasks assigned to the signed-in user.
  const stats = [
    { label: 'وظایف باز', value: analytics.activeTasksCount, icon: ListTodo, tone: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50' },
    { label: 'سررسید امروز', value: analytics.todayTasksCount, icon: CalendarClock, tone: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50' },
    { label: 'دارای تأخیر', value: analytics.overdueTasksCount, icon: AlertTriangle, tone: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50' },
    { label: 'تکمیل‌شده', value: analytics.completedTasksCount, icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50' },
  ];

  return (
    <div className="w-full space-y-6 font-sans text-start" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-white dark:bg-[#121621] border border-slate-200/80 dark:border-slate-800/80 shadow-sm rounded-3xl p-6 transition-colors duration-200 space-y-5">
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {analytics.userName ? `سلام، ${analytics.userName}` : 'سلام'} 👋
          </h1>
          {/* Whole sentences, so each language keeps its own word order. */}
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {analytics.totalMyTasks === 0
              ? 'هنوز وظیفه‌ای به شما واگذار نشده است. وقتی وظیفه‌ای به شما سپرده شود، خلاصهٔ آن اینجا نمایش داده می‌شود.'
              : analytics.pendingReviewsCount > 0
                ? `شما ${toPersianDigits(analytics.activeTasksCount)} وظیفهٔ باز در ${toPersianDigits(analytics.myProjectsCount)} پروژه دارید و ${toPersianDigits(analytics.pendingReviewsCount)} مورد در انتظار بررسی است.`
                : `شما ${toPersianDigits(analytics.activeTasksCount)} وظیفهٔ باز در ${toPersianDigits(analytics.myProjectsCount)} پروژه دارید.`}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map(stat => (
            <button
              key={stat.label}
              type="button"
              onClick={openMyTasks}
              className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 hover:border-blue-300 dark:hover:border-blue-800 transition-colors text-start cursor-pointer"
            >
              <span className={`p-2 rounded-xl ${stat.tone}`}><stat.icon size={18} /></span>
              <span>
                <span className="block text-lg font-black text-slate-900 dark:text-white leading-none">{toPersianDigits(stat.value)}</span>
                <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">{stat.label}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div dir="ltr" className="w-full grid grid-cols-12 gap-6 items-stretch select-none">
        <div className="col-span-12 lg:col-span-8 h-full">
          <PersonalProductivityChartWidget />
        </div>
        <div className="col-span-12 lg:col-span-4 h-full">
          <Personal12TabsHealthWidget />
        </div>
      </div>
    </div>
  );
};
