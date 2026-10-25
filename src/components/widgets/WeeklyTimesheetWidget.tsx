import React, { useMemo } from 'react';
import { Clock, ArrowUpRight } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { weeklyTimeTotals } from '../../lib/taskAnalytics';

const toPersianDigits = (n: string | number): string => {
  if (n === undefined || n === null) return '';
  return n.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)]);
};

const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const formatHours = (hours: number) => {
  const minutes = Math.round(Math.abs(hours) * 60);
  return toPersianDigits(`${hours < 0 ? '−' : ''}${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`);
};

export interface WeeklyTimesheetWidgetProps {
  className?: string;
  borderless?: boolean;
}

/** Hours logged on this workspace's tasks during the current week (Saturday to Friday). */
export const WeeklyTimesheetWidget: React.FC<WeeklyTimesheetWidgetProps> = ({
  className = '',
  borderless = false,
}) => {
  const { setActiveTab, setActiveSubTab, locale, tasks } = useProject();
  const isRtl = locale === 'fa';

  const week = useMemo(() => {
    const totals = weeklyTimeTotals(tasks || []);
    const { start } = totals;
    const label = (date: Date) => date.toLocaleDateString('fa-IR', { day: 'numeric', month: 'long' });
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return { ...totals, range: `${label(start)} تا ${label(end)}` };
  }, [tasks]);

  const containerClasses = borderless
    ? `bg-transparent border-0 p-0 shadow-none font-sans flex flex-col justify-between space-y-4 w-full ${className}`
    : `bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all font-sans flex flex-col justify-between space-y-4 ${className}`;

  return (
    <div className={containerClasses} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <Clock className="w-5 h-5 text-blue-500 shrink-0" />
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">کارکرد ثبت‌شدهٔ این هفته</h3>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5">{week.range}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setActiveTab('tasks'); setActiveSubTab('kanban_board'); }}
          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
        >
          <span>وظایف</span>
          <ArrowUpRight size={13} />
        </button>
      </div>

      <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-50/80 to-indigo-50/50 dark:from-blue-950/30 dark:to-slate-800/60 border border-blue-100 dark:border-blue-900/40 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">مجموع ثبت‌شده</span>
          <div className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">
            {formatHours(week.total)} <span className="text-xs font-sans font-bold">ساعت</span>
          </div>
        </div>
        <div className="text-left">
          <span className="text-[10px] font-bold text-slate-400 block">میانگین روزانه</span>
          <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">{formatHours(week.average)} ساعت</span>
        </div>
      </div>

      {week.max === 0 ? (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          هنوز زمانی در این هفته ثبت نشده است. زمان کار را از بخش «ثبت زمان» در جزئیات هر وظیفه ثبت کنید.
        </p>
      ) : (
        <div className="grid grid-cols-7 gap-1.5 h-12 items-end bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-lg" aria-label="توزیع روزانهٔ کارکرد">
          {week.days.map((hours, index) => (
            <div
              key={WEEKDAYS[index]}
              title={`${WEEKDAYS[index]}: ${formatHours(hours)} ساعت`}
              className={`rounded-xs ${hours < 0 ? 'bg-rose-500' : index === week.todayIndex ? 'bg-emerald-500' : 'bg-blue-500'} ${hours === 0 ? 'opacity-25' : ''}`}
              style={{ height: `${week.max ? Math.max(8, Math.abs(hours) / week.max * 100) : 8}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
