import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  Trophy, 
  Clock, 
  Zap,
  Sparkles
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useUserAnalytics } from '../../hooks/useUserAnalytics';
import { 
  PersonalProductivityChartWidget, 
  Personal12TabsHealthWidget, 
  PersonalGamificationCard, 
  Personal12TabActionMatrix 
} from './PersonalGamificationWidgets';

const toPersianDigits = (n: string | number): string => {
  if (n === undefined || n === null) return '';
  return n.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)] || '۰');
};

export const MyDashboardSubView: React.FC = () => {
  const { locale } = useProject();
  const analytics = useUserAnalytics();

  const isRtl = locale === 'fa';

  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(6312); // 01:45:12 default

  React.useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const toggleTimer = () => setIsTimerRunning(!isTimerRunning);

  const formatTimer = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full space-y-6 font-sans text-right" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* 1. ROW 1: HEADER BANNER (مرکز فرماندهی شخصی) */}
      <div className="bg-white dark:bg-[#121621] border border-slate-200/80 dark:border-slate-800/80 shadow-sm rounded-3xl p-6 transition-colors duration-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1.5 border border-blue-200/50 dark:border-blue-800/50">
                <Sparkles size={13} />
                <span>✨ پیشخوان اختصاصی پرسنل TS Orbit</span>
              </span>

              <span className="bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1.5 border border-amber-200/60 dark:border-amber-800/60">
                <Trophy size={13} />
                <span>سطح {toPersianDigits(analytics.levelNumber)} - {analytics.levelTitle}</span>
                <span className="opacity-40">•</span>
                <span className="font-mono text-[11px]">{toPersianDigits(analytics.calculatedXP)} / {toPersianDigits(analytics.levelXPMax)} XP</span>
              </span>
            </div>

            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              سلام، {analytics.userName} 👋
            </h1>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              شما امروز <span className="font-bold text-slate-900 dark:text-white">{toPersianDigits(analytics.activeTasksCount)} تسک</span> در حال انجام، <span className="font-bold text-slate-900 dark:text-white">{toPersianDigits(analytics.myProjectsCount)} پروژه</span> با ددلاین نزدیک و <span className="font-bold text-slate-900 dark:text-white">{toPersianDigits(analytics.pendingReviewsCount)} درخواست</span> بررسی دارید.
            </p>
          </div>

          {/* ACTIVE TIMER WIDGET */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 flex items-center gap-3.5 shrink-0 self-start md:self-auto">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
              <Clock size={20} />
            </div>
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">تایمر فعال کاری</span>
              <div className="text-lg font-black font-mono text-slate-900 dark:text-white tracking-wider">
                {toPersianDigits(formatTimer(timerSeconds))}
              </div>
            </div>
            <button
              type="button"
              onClick={toggleTimer}
              className={`p-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center shadow-sm ${
                isTimerRunning 
                  ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isTimerRunning ? <Pause size={18} /> : <Play size={18} className="translate-x-0.5" />}
            </button>
          </div>
        </div>

        {/* Clean Progress Bar */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-3 text-xs font-bold">
          <span className="text-slate-500 dark:text-slate-400 shrink-0">پیشرفت سطح {toPersianDigits(analytics.levelNumber)}:</span>
          <div className="w-full bg-slate-100 dark:bg-slate-800/80 rounded-full h-2 overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
            <div className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${analytics.levelProgressPercent}%` }} />
          </div>
          <span className="text-blue-600 dark:text-blue-400 font-mono shrink-0">{toPersianDigits(analytics.levelProgressPercent)}٪</span>
        </div>
      </div>

      {/* 2. ROW 2: DUAL ANALYTICS CARDS (LAYOUT CLONED 1:1 FROM BUSINESS DASHBOARD) */}
      <div dir="ltr" className="w-full grid grid-cols-12 gap-6 items-stretch select-none">
        <div className="col-span-12 lg:col-span-8 h-full">
          <PersonalProductivityChartWidget />
        </div>
        <div className="col-span-12 lg:col-span-4 h-full">
          <Personal12TabsHealthWidget />
        </div>
      </div>

      {/* 3. ROW 3: GAMIFICATION & REWARDS CARD */}
      <PersonalGamificationCard />

      {/* 4. ROW 4: 12-TAB QUICK ACTION MATRIX */}
      <Personal12TabActionMatrix />
    </div>
  );
};

