import React, { useState, useEffect } from 'react';
import { 
  Sun, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Play, 
  Pause, 
  RotateCcw, 
  FileText, 
  Flame, 
  Check
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

const toPersianDigits = (n: string | number): string => {
  if (n === undefined || n === null) return '';
  return n.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)] || '۰');
};

export const TodayPlannerSubView: React.FC = () => {
  const { tasks, teamMembers, updateTaskStatus, locale, currentUser, activeWorkspaceId } = useProject();
  const isRtl = locale === 'fa';
  const notesKey = `personalNotes:${currentUser?.id || ''}:${activeWorkspaceId}`;

  const [personalNotes, setPersonalNotes] = useState(() => {
    return localStorage.getItem(notesKey) || '';
  });

  useEffect(()=>setPersonalNotes(localStorage.getItem(notesKey)||''),[notesKey]);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPersonalNotes(e.target.value);
    localStorage.setItem(notesKey, e.target.value);
  };

  const [focusTimeLeft, setFocusTimeLeft] = useState(25 * 60);
  const [isFocusActive, setIsFocusActive] = useState(false);

  useEffect(() => {
    let timer: any;
    if (isFocusActive && focusTimeLeft > 0) {
      timer = setInterval(() => setFocusTimeLeft((prev) => prev - 1), 1000);
    } else if (focusTimeLeft === 0) {
      setIsFocusActive(false);
    }
    return () => clearInterval(timer);
  }, [isFocusActive, focusTimeLeft]);

  const toggleFocusTimer = () => setIsFocusActive(!isFocusActive);
  const resetFocusTimer = () => {
    setIsFocusActive(false);
    setFocusTimeLeft(25 * 60);
  };

  const formatMinSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const todayTasks = tasks.filter(t => (t.assignedTo === currentUser.name || t.assignedTo === 'علیرضا شریفی' || !t.assignedTo) && t.status !== 'completed');

  return (
    <div className="space-y-6 font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Sun className="w-6 h-6 text-amber-500" />
            <span>برنامه‌ریز امروز (Today Planner)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
            برنامه‌ریزی متمرکز، یادداشت‌های لحظه‌ای و تایمر تمرکز روزانه
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-3 py-1.5 rounded-xl border border-amber-200/50 dark:border-amber-900/50">
            امروز: ۱۳ مرداد ۱۴۰۵
          </span>
        </div>
      </div>

      {/* TOP ROW: FOCUS TIMER & SCRATCHPAD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-5 shadow-md space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-200 flex items-center gap-1.5">
              <Flame size={15} className="text-amber-400" />
              <span>تایمر تمرکز عمیق (Focus Mode)</span>
            </span>
            <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded-md text-indigo-100">
              ۲۵ دقیقه
            </span>
          </div>

          <div className="text-center py-2">
            <div className="text-3xl font-black font-mono tracking-widest text-indigo-100">
              {toPersianDigits(formatMinSec(focusTimeLeft))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={toggleFocusTimer}
              className={`px-4 py-2 rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1.5 cursor-pointer ${
                isFocusActive ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-500 hover:bg-indigo-600'
              }`}
            >
              {isFocusActive ? <Pause size={14} /> : <Play size={14} />}
              <span>{isFocusActive ? 'توقف موقت' : 'شروع تمرکز'}</span>
            </button>
            <button
              type="button"
              onClick={resetFocusTimer}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-indigo-200 transition-all cursor-pointer"
              title="بازنشانی"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <FileText size={15} className="text-blue-500" />
              <span>دفترچه یادداشت و ایده‌های روزانه (Personal Scratchpad)</span>
            </span>
            <span className="text-[10px] text-slate-400 font-bold">ذخیره‌سازی خودکار</span>
          </div>
          <textarea
            value={personalNotes}
            onChange={handleNotesChange}
            placeholder="یادداشت‌های سریع، شماره تلفن‌ها یا ایده‌های امروز..."
            className="w-full flex-1 p-3 bg-slate-50 dark:bg-slate-800/50 border-0 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 resize-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
            rows={4}
          />
        </div>
      </div>

      {/* TODAY'S TASKS & MEETINGS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
              تسک‌های امروز
            </h3>
            <span className="text-xs font-bold text-slate-500">
              {toPersianDigits(todayTasks.length)} مورد
            </span>
          </div>

          <div className="space-y-2.5">
            {todayTasks.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs font-bold">
                تمام برنامه‌های امروز به اتمام رسیده‌اند!
              </div>
            ) : (
              todayTasks.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => updateTaskStatus(t.id, 'completed')}
                      className="w-5 h-5 rounded border border-slate-300 dark:border-slate-600 hover:border-emerald-500 flex items-center justify-center cursor-pointer text-emerald-500"
                    >
                      <Check size={12} />
                    </button>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{t.title}</h4>
                      <span className="text-[10px] text-slate-400 font-bold block">{toPersianDigits(t.deadline || '۱۴۰۵/۰۵/۱۵')}</span>
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${t.priority === 'high' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                    {t.priority === 'high' ? 'ضروری' : 'عادی'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">جلسات و رویدادهای امروز</h3>
            <Calendar size={16} className="text-indigo-500" />
          </div>
          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs">
              <div className="font-bold text-slate-800 dark:text-slate-100">جلسه همگام‌سازی تیم فنی</div>
              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">ساعت ۱۰:۰۰ تا ۱۰:۳۰</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs">
              <div className="font-bold text-slate-800 dark:text-slate-100">بررسی معماری پروژه داروماپک</div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">ساعت ۱۴:۰۰ تا ۱۵:۰۰</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
