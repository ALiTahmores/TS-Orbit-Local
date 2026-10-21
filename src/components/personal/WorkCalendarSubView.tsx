import React, { useState } from 'react';
import { Calendar, ChevronRight, ChevronLeft, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

const toPersianDigits = (n: string | number): string => {
  if (n === undefined || n === null) return '';
  return n.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)] || '۰');
};

export const WorkCalendarSubView: React.FC = () => {
  const { tasks, projects, teamMembers, locale } = useProject();
  const isRtl = locale === 'fa';
  const currentUser = teamMembers[0] || { name: 'علیرضا شریفی', role: 'مدیر پروژه' };

  const [currentMonth, setCurrentMonth] = useState('مرداد ۱۴۰۵');

  // Days in month mock representation
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

  const myTasks = tasks.filter(t => t.assignedTo === currentUser.name || t.assignedTo === 'علیرضا شریفی' || !t.assignedTo);

  return (
    <div className="space-y-6 font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-500" />
            <span>تقویم کاری و مهلت‌ها (Work Calendar)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
            مشاهده تقویم هجری شمسی، زمان‌بندی تحویل پروژه‌ها و ددلاین تسک‌های شخصی شما
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl text-xs font-bold">
          <button type="button" className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-lg cursor-pointer">
            <ChevronRight size={16} />
          </button>
          <span className="px-3 text-slate-800 dark:text-slate-100 font-black">{currentMonth}</span>
          <button type="button" className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-lg cursor-pointer">
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>

      {/* CALENDAR GRID & TIMELINE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CALENDAR GRID (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-black text-slate-400 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span>ش</span><span>ی</span><span>د</span><span>س</span><span>چ</span><span>پ</span><span>ج</span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {daysInMonth.map((day) => {
              const isToday = day === 13;
              const hasTask = day === 15 || day === 20 || day === 25;

              return (
                <div
                  key={day}
                  className={`min-h-[64px] p-2 rounded-xl border flex flex-col justify-between transition-all cursor-pointer ${
                    isToday
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-[1.02]'
                      : hasTask
                      ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40 text-slate-800 dark:text-slate-100'
                      : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span className={`text-xs font-black font-mono ${isToday ? 'text-white' : ''}`}>
                    {toPersianDigits(day)}
                  </span>
                  {hasTask && (
                    <span className={`text-[8px] font-bold px-1 py-0.5 rounded truncate ${isToday ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'}`}>
                      ددلاین پروژه
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* TIMELINE LIST (1 col) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">دیدارهای مهم و ددلاین‌ها</h3>
            <Clock size={16} className="text-amber-500" />
          </div>

          <div className="space-y-3">
            {myTasks.slice(0, 5).map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 space-y-1"
              >
                <div className="flex justify-between items-center text-xs font-black text-slate-800 dark:text-slate-100">
                  <span className="truncate">{t.title}</span>
                  <span className="text-[10px] text-amber-600 font-mono shrink-0">{toPersianDigits(t.deadline || '۱۴۰۵/۰۵/۱۵')}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-bold">پروژه: خط تولید داروماپک</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
