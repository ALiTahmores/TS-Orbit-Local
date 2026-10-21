import React from 'react';
import { Clock, Play, Calendar, ChevronLeft, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

const toPersianDigits = (n: string | number): string => {
  if (n === undefined || n === null) return '';
  return n.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)]);
};

export interface WeeklyTimesheetWidgetProps {
  className?: string;
  borderless?: boolean;
}

export const WeeklyTimesheetWidget: React.FC<WeeklyTimesheetWidgetProps> = ({
  className = '',
  borderless = false,
}) => {
  const { setActiveTab, setActiveSubTab, locale } = useProject();
  const isRtl = locale === 'fa';

  const containerClasses = borderless
    ? `bg-transparent border-0 p-0 shadow-none font-sans flex flex-col justify-between space-y-4 w-full ${className}`
    : `bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all font-sans flex flex-col justify-between space-y-4 ${className}`;

  return (
    <div className={containerClasses} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* HEADER */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <Clock className="w-5 h-5 text-blue-500 shrink-0" />
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
              کارکرد و تایمشیت هفته
            </h3>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5">
              هفته جاری ({toPersianDigits('۱۰')} تا {toPersianDigits('۱۶')} مرداد ۱۴۰۵)
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setActiveTab('tasks');
            setActiveSubTab('timeline');
          }}
          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
        >
          <span>مشاهده گزارش</span>
          <ArrowUpRight size={13} />
        </button>
      </div>

      {/* METRICS SUMMARY */}
      <div className="space-y-3">
        {/* Main Hour Badge */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-50/80 to-indigo-50/50 dark:from-blue-950/30 dark:to-slate-800/60 border border-blue-100 dark:border-blue-900/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
              مجموع کارکرد ثبت شده
            </span>
            <div className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">
              {toPersianDigits('۴۲:۳۰')} <span className="text-xs font-sans font-bold">ساعت</span>
            </div>
          </div>

          <div className="text-left font-mono">
            <span className="text-[10px] font-bold text-slate-400 block">میانگین روزانه</span>
            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
              {toPersianDigits('۸:۳۰')} ساعت/روز
            </span>
          </div>
        </div>

        {/* ACTIVE TIMER STATUS */}
        <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              تایمر فعال: کدنویسی ماژول پرداخت
            </span>
          </div>

          <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60">
            {toPersianDigits('۰۱:۴۵:۱۲')}
          </span>
        </div>

        {/* DAILY BREAKDOWN PROGRESS MINI BARS */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-[10px] font-bold text-slate-400">
            <span>توزیع روزانه کارکرد:</span>
            <span className="font-mono text-slate-600 dark:text-slate-300">شن - چ‍ه</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5 h-7 items-end bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-lg">
            <div className="bg-blue-500 h-[80%] rounded-xs" title="شنبه: ۸ ساعت" />
            <div className="bg-blue-500 h-[95%] rounded-xs" title="یکشنبه: ۹.۵ ساعت" />
            <div className="bg-blue-500 h-[70%] rounded-xs" title="دوشنبه: ۷ ساعت" />
            <div className="bg-blue-500 h-[90%] rounded-xs" title="سه‌شنبه: ۹ ساعت" />
            <div className="bg-emerald-500 h-[100%] rounded-xs animate-pulse" title="چهارشنبه (در حال ثبت)" />
          </div>
        </div>
      </div>
    </div>
  );
};
