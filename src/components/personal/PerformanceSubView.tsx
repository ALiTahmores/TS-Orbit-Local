import React from 'react';
import { Award, CheckCircle2, Clock, ShieldCheck, Zap, Star, Trophy } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

const toPersianDigits = (n: string | number): string => {
  if (n === undefined || n === null) return '';
  return n.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)] || '۰');
};

export const PerformanceSubView: React.FC = () => {
  const { teamMembers, locale } = useProject();
  const isRtl = locale === 'fa';
  const currentUser = teamMembers[0] || { name: 'علیرضا شریفی', performanceScore: 96, completedTasks: 42 };

  return (
    <div className="space-y-6 font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-500" />
            <span>ارزیابی و کارنامه عملکرد (Performance Analytics)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
            آمار تحلیلی بازدهی، سرعت تحویل تسک‌ها، امتیاز مربیگری و مدال‌های کسب شده
          </p>
        </div>

        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/50 p-2 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
          <Trophy className="w-5 h-5 text-amber-500" />
          <span className="text-xs font-black text-amber-700 dark:text-amber-300">
            امتیاز کلی: {toPersianDigits(currentUser.performanceScore || 96)} از ۱۰۰
          </span>
        </div>
      </div>

      {/* METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-400 block">نرخ تکمیل تسک‌ها</span>
          <div className="text-2xl font-black text-emerald-500 font-mono">{toPersianDigits('۹۴٪')}</div>
          <span className="text-[10px] text-slate-400 font-bold">بسیار عالی</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-400 block">میانگین زمان انجام</span>
          <div className="text-2xl font-black text-blue-500 font-mono">{toPersianDigits('۱.۴')} روز</div>
          <span className="text-[10px] text-slate-400 font-bold">زیر میانگین تیم</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-400 block">تسک‌های تحویل‌شده</span>
          <div className="text-2xl font-black text-indigo-500 font-mono">{toPersianDigits(currentUser.completedTasks || 42)}</div>
          <span className="text-[10px] text-slate-400 font-bold">در ۶ ماه گذشته</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-400 block">امتیاز بازبینی کد</span>
          <div className="text-2xl font-black text-purple-500 font-mono">{toPersianDigits('۹۸/۱۰۰')}</div>
          <span className="text-[10px] text-slate-400 font-bold">بدون ریجکتی</span>
        </div>
      </div>

      {/* ACHIEVEMENTS & BADGES */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">
          مدال‌ها و افتخارات سازمانی (Badges & Achievements)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 flex items-center gap-3">
            <div className="p-3 bg-amber-500 text-white rounded-xl shrink-0">
              <Zap size={22} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">حل‌کننده سریع گلوگاه‌ها</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">رفع بیش از ۱۵ تسک مسدودکننده در کمتر از ۲۴ ساعت</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 flex items-center gap-3">
            <div className="p-3 bg-blue-500 text-white rounded-xl shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">پایبند ۱۰۰٪ به ددلاین‌ها</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">تحویل تمام فازهای پروژه بدون تاخیر زمانی</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/40 flex items-center gap-3">
            <div className="p-3 bg-indigo-500 text-white rounded-xl shrink-0">
              <Star size={22} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">استاد همکاری تیمی</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">بالاترین نرخ پاسخگویی و منشن فعال در گفتگوها</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
