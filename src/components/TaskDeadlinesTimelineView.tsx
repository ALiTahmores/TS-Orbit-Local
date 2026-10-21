import React, { useState, useEffect, useMemo } from 'react';
import { useProject } from '../context/ProjectContext';
import { TaskPriority, TaskStatus } from '../types';
import { 
  BarChart2, 
  Calendar, 
  Clock, 
  User, 
  Folder, 
  Search, 
  Filter, 
  CheckCircle2, 
  Sparkles, 
  Users,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  X,
  ExternalLink,
  Tag,
  Plus,
  Layers,
  ArrowRightLeft
} from 'lucide-react';
import { CustomSelect, CustomSelectOption } from './common/CustomSelect';
import { CreateTaskModal } from './projects/CreateTaskModal';
import { 
  getTehranParts, 
  getTehranTimeBadgeString, 
  getTehranCurrentTimeMinutes,
  formatTehranJalali,
  calculateLiveLineTopPx,
  TEHRAN_TIMEZONE 
} from '../utils/timeUtils';
import { toPersianDigits } from '../utils/formatters';

interface TeamTimelineDef {
  id: string;
  name: string;
  leader: string;
  totalTasks: number;
  startDate: string;
  deadlineDate: string;
  elapsedPct: number;
  status: 'on_track' | 'warning' | 'critical' | 'completed';
}

const TEAM_TIMELINES: TeamTimelineDef[] = [
  {
    id: 'wp_dev',
    name: 'dept_wp_dev',
    leader: 'سارا احمدی',
    totalTasks: 4,
    startDate: '۱۴۰۵/۰۴/۰۱',
    deadlineDate: '۱۴۰۵/۰۴/۲۵',
    elapsedPct: 65,
    status: 'on_track'
  },
  {
    id: 'ui_ux',
    name: 'dept_uiux',
    leader: 'مریم نوری',
    totalTasks: 3,
    startDate: '۱۴۰۵/۰۴/۰۵',
    deadlineDate: '۱۴۰۵/۰۴/۲۰',
    elapsedPct: 80,
    status: 'warning'
  },
  {
    id: 'seo',
    name: 'dept_seo',
    leader: 'محمد کریمی',
    totalTasks: 5,
    startDate: '۱۴۰۵/۰۴/۱۰',
    deadlineDate: '۱۴۰۵/۰۵/۰۵',
    elapsedPct: 45,
    status: 'on_track'
  },
  {
    id: 'qa',
    name: 'dept_qa',
    leader: 'نیلوفر امینی',
    totalTasks: 2,
    startDate: '۱۴۰۵/۰۴/۱۵',
    deadlineDate: '۱۴۰۵/۰۴/۳۰',
    elapsedPct: 30,
    status: 'on_track'
  }
];

// Base days definition for Persian Week (Saturday = index 0)
const BASE_DAYS_DEF = [
  { persIdx: 0, faName: 'شنبه', enName: 'Saturday', baseNum: 6 },
  { persIdx: 1, faName: 'یکشنبه', enName: 'Sunday', baseNum: 7 },
  { persIdx: 2, faName: 'دوشنبه', enName: 'Monday', baseNum: 8 },
  { persIdx: 3, faName: 'سه‌شنبه', enName: 'Tuesday', baseNum: 9 },
  { persIdx: 4, faName: 'چهارشنبه', enName: 'Wednesday', baseNum: 10 },
  { persIdx: 5, faName: 'پنجشنبه', enName: 'Thursday', baseNum: 11 },
  { persIdx: 6, faName: 'جمعه', enName: 'Friday', baseNum: 12 },
];

const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
];

interface CalendarEventBlock {
  id: string;
  dayIdx: number;
  startHourIdx: number;
  durationHours: number;
  title: string;
  assignee: string;
  avatarLetter: string;
  typeColor: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple';
  project: string;
  loggedHours: string;
}

const BASE_EVENTS: CalendarEventBlock[] = [
  {
    id: 'evt-1',
    dayIdx: 0,
    startHourIdx: 2,
    durationHours: 2,
    title: 'بررسی معماری دیتابیس و APIها',
    assignee: 'سارا احمدی',
    avatarLetter: 'س',
    typeColor: 'blue',
    project: 'پورتال مشتریان',
    loggedHours: '۲ ساعت'
  },
  {
    id: 'evt-2',
    dayIdx: 1,
    startHourIdx: 4,
    durationHours: 1.5,
    title: 'تکمیل دیزاین سیستم تاریک',
    assignee: 'مریم نوری',
    avatarLetter: 'م',
    typeColor: 'purple',
    project: 'سایت فروشگاهی',
    loggedHours: '۱.۵ ساعت'
  },
  {
    id: 'evt-3',
    dayIdx: 3,
    startHourIdx: 1,
    durationHours: 3,
    title: 'تست امنیت و QA نهایی',
    assignee: 'نیلوفر امینی',
    avatarLetter: 'ن',
    typeColor: 'emerald',
    project: 'اپلیکیشن موبایل',
    loggedHours: '۳ ساعت'
  },
  {
    id: 'evt-4',
    dayIdx: 4,
    startHourIdx: 3,
    durationHours: 2,
    title: 'بهینه‌سازی سئو و کلمات کلیدی',
    assignee: 'محمد کریمی',
    avatarLetter: 'م',
    typeColor: 'amber',
    project: 'پورتال خبری',
    loggedHours: '۲ ساعت'
  }
];

export const TaskDeadlinesTimelineView: React.FC = () => {
  const { projects, tasks, t, locale } = useProject();
  const [viewMode, setViewMode] = useState<'outlook' | 'team_deadlines'>('outlook');
  const [timeGrain, setTimeGrain] = useState<string>('work_week'); // 'work_week' | 'daily' | 'monthly'
  const [dateOffset, setDateOffset] = useState<number>(0);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<CalendarEventBlock | null>(null);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);

  const isRtl = locale === 'fa';

  const formatDigits = (num: number | string) => {
    if (!isRtl) return String(num);
    return toPersianDigits(num);
  };

  // Real-time Tehran time state updated every minute
  const [tehranTimeState, setTehranTimeState] = useState(() => {
    const parts = getTehranParts();
    // Convert JS dayOfWeek (Sun=0..Sat=6) to Persian week index (Sat=0..Fri=6)
    const tehranTodayPersianIdx = (parts.dayOfWeek + 1) % 7;
    return {
      parts,
      tehranTodayPersianIdx,
      badge: getTehranTimeBadgeString(),
      topPx: calculateLiveLineTopPx(64, 8)
    };
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const parts = getTehranParts();
      const tehranTodayPersianIdx = (parts.dayOfWeek + 1) % 7;
      setTehranTimeState({
        parts,
        tehranTodayPersianIdx,
        badge: getTehranTimeBadgeString(),
        topPx: calculateLiveLineTopPx(64, 8)
      });
    }, 30000); // refresh every 30 seconds

    return () => clearInterval(timer);
  }, []);

  const allEvents = useMemo(() => {
    const taskEvents: CalendarEventBlock[] = (tasks || []).map((tItem, idx) => {
      const dayIdx = (idx * 2) % 7;
      const startHourIdx = (idx % 6) + 1;
      const typeColor: CalendarEventBlock['typeColor'] = 
        tItem.priority === 'critical' ? 'rose' :
        tItem.priority === 'high' ? 'amber' :
        tItem.department === 'ui_ux' ? 'purple' :
        tItem.department === 'seo' ? 'emerald' : 'blue';

      return {
        id: tItem.id,
        dayIdx,
        startHourIdx,
        durationHours: 2,
        title: tItem.title,
        assignee: tItem.assignedTo || (isRtl ? 'کاربر سیستم' : 'System User'),
        avatarLetter: (tItem.assignedTo || 'U')[0],
        typeColor,
        project: projects.find(p => p.id === tItem.projectId)?.title || (isRtl ? 'پروژه عمومی' : 'General Project'),
        loggedHours: isRtl ? '۲ ساعت' : '2 hours'
      };
    });

    return [...BASE_EVENTS, ...taskEvents];
  }, [tasks, projects, isRtl]);

  const getEventCardStyle = (color: CalendarEventBlock['typeColor']) => {
    switch (color) {
      case 'blue':
        return 'bg-blue-50/90 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100 border-r-4 border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/80';
      case 'emerald':
        return 'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-100 border-r-4 border-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/80';
      case 'amber':
        return 'bg-amber-50/90 dark:bg-amber-950/60 text-amber-900 dark:text-amber-100 border-r-4 border-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/80';
      case 'rose':
        return 'bg-rose-50/90 dark:bg-rose-950/60 text-rose-900 dark:text-rose-100 border-r-4 border-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/80';
      case 'purple':
        return 'bg-purple-50/90 dark:bg-purple-950/60 text-purple-900 dark:text-purple-100 border-r-4 border-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/80';
      default:
        return 'bg-slate-50 dark:bg-[#131b2e] text-slate-800 dark:text-slate-100 border-r-4 border-slate-500';
    }
  };

  // Compute active days list relative to Tehran timezone & offset
  const currentDays = useMemo(() => {
    return BASE_DAYS_DEF.map((d) => {
      const num = d.baseNum + dateOffset * 7;
      const isToday = d.persIdx === tehranTimeState.tehranTodayPersianIdx && dateOffset === 0;
      return { 
        ...d, 
        displayName: isRtl ? d.faName : d.enName,
        dateNum: formatDigits(num > 0 ? num : Math.abs(num) + 1), 
        isToday 
      };
    });
  }, [dateOffset, tehranTimeState.tehranTodayPersianIdx, isRtl]);

  // Range Header text dynamically formatted
  const rangeHeaderText = useMemo(() => {
    if (timeGrain === 'daily') {
      return isRtl
        ? `سه‌شنبه ${formatDigits(9 + dateOffset)} تیر ۱۴۰۵ ${dateOffset === 0 ? `(${t('today')})` : ''}`
        : `Tuesday, ${formatDigits(9 + dateOffset)} July 2026 ${dateOffset === 0 ? `(${t('today')})` : ''}`;
    }
    if (timeGrain === 'monthly') {
      return isRtl 
        ? `تیر - مرداد ۱۴۰۵ ${dateOffset === 0 ? '(ماه جاری)' : `(ماه ${formatDigits(dateOffset > 0 ? `+${dateOffset}` : dateOffset)})`}`
        : `July - August 2026 ${dateOffset === 0 ? '(Current Month)' : `(Month ${formatDigits(dateOffset > 0 ? `+${dateOffset}` : dateOffset)})`}`;
    }
    return isRtl 
      ? (dateOffset === 0 ? 'تیر - مرداد ۱۴۰۵ (هفته جاری)' : `هفته (${formatDigits(dateOffset > 0 ? `+${dateOffset}` : dateOffset)})`)
      : (dateOffset === 0 ? 'July - August 2026 (Current Week)' : `Week (${formatDigits(dateOffset > 0 ? `+${dateOffset}` : dateOffset)})`);
  }, [timeGrain, dateOffset, isRtl, t]);

  const TIME_GRAIN_OPTIONS: CustomSelectOption[] = [
    { value: 'work_week', label: t('work_week') },
    { value: 'daily', label: t('daily') },
    { value: 'monthly', label: t('monthly') },
  ];

  return (
    <div className={`space-y-6 ${isRtl ? 'font-vazirmatn text-right' : 'font-sans text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* TOP TOOLBAR & CONTROL NAVIGATION */}
      <div className="bg-white dark:bg-[#0d121f] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left Navigation Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setDateOffset(0)}
              className="px-3.5 py-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/80 rounded-xl text-xs font-extrabold border border-blue-200 dark:border-blue-800 transition-all cursor-pointer shadow-2xs"
            >
              {t('today_with_en')}
            </button>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#131b2e] rounded-xl p-0.5 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDateOffset(prev => prev + 1)}
                className="p-1.5 hover:bg-white dark:hover:bg-[#17223b] rounded-lg text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title={t('next_period')}
              >
                {isRtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
              <button
                type="button"
                onClick={() => setDateOffset(prev => prev - 1)}
                className="p-1.5 hover:bg-white dark:hover:bg-[#17223b] rounded-lg text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title={t('prev_period')}
              >
                {isRtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>

            <span className="text-xs font-black text-slate-800 dark:text-slate-100 px-2 font-mono">
              {rangeHeaderText}
            </span>
          </div>

          {/* View Switcher Toggle & Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            
            {/* View Mode Toggle */}
            <div className="bg-slate-100 dark:bg-[#131b2e] p-1 rounded-xl flex items-center gap-1 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('outlook')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'outlook'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#17223b]'
                }`}
              >
                <CalendarDays size={14} />
                <span>{t('outlook_grid')}</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('team_deadlines')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'team_deadlines'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#17223b]'
                }`}
              >
                <BarChart2 size={14} />
                <span>{t('team_deadlines')}</span>
              </button>
            </div>

            {/* Time Grain Dropdown */}
            <div className="w-36">
              <CustomSelect
                options={TIME_GRAIN_OPTIONS}
                value={timeGrain}
                onChange={(val) => setTimeGrain(val)}
              />
            </div>

            {/* Action Button: Create Task */}
            <button
              type="button"
              onClick={() => setIsCreateTaskModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer shrink-0"
            >
              <Plus size={16} />
              <span>+ {t('new_task_btn')}</span>
            </button>

          </div>

        </div>
      </div>

      {/* SUB-TAB 1: OUTLOOK TIME GRID VIEW */}
      {viewMode === 'outlook' && (
        <div className="bg-white dark:bg-[#0d121f] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          
          {/* WEEKLY GRID VIEW */}
          {timeGrain === 'work_week' && (
            <div className="overflow-x-auto">
              <div className="min-w-[880px]">
                
                {/* Scrollable Container with Sticky Header */}
                <div className="max-h-[600px] overflow-y-auto custom-scrollbar relative">
                  
                  {/* Sticky Day Headers Row */}
                  <div className="sticky top-0 z-20 grid grid-cols-8 border-b border-slate-200 dark:border-slate-800 bg-slate-50/95 dark:bg-[#131b2e]/95 backdrop-blur-xs text-xs font-bold">
                    <div className={`p-3 text-center ${isRtl ? 'border-l' : 'border-r'} border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-mono`}>
                      {t('hour_day')}
                    </div>

                    {currentDays.map((day) => (
                      <div
                        key={day.persIdx}
                        className={`p-3 text-center ${isRtl ? 'border-l' : 'border-r'} border-slate-200 dark:border-slate-800 last:border-none ${
                          day.isToday ? 'bg-blue-50/90 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-black' : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>{day.displayName}</span>
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[11px] ${
                            day.isToday ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-300 dark:ring-blue-800' : 'bg-slate-200 dark:bg-[#17223b] text-slate-800 dark:text-slate-200'
                          }`}>
                            {day.dateNum}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Time Slots Grid with Dynamic Tehran Red Line */}
                  <div className="relative divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                    
                    {/* LIVE TEHRAN CURRENT TIME INDICATOR LINE */}
                    {dateOffset === 0 && (
                      <div 
                        className="absolute left-0 right-0 z-10 pointer-events-none flex items-center transition-all duration-500"
                        style={{ top: `${Math.min(760, Math.max(20, tehranTimeState.topPx))}px` }}
                      >
                        <div className="w-full border-t-2 border-dashed border-rose-500 shadow-xs" />
                        <span className={`bg-rose-600 text-white font-mono text-[9px] font-black px-2 py-0.5 rounded-md shrink-0 ${isRtl ? 'mr-2' : 'ml-2'} shadow-sm border border-rose-400/30`}>
                          {tehranTimeState.badge}
                        </span>
                      </div>
                    )}

                    {TIME_SLOTS.map((time, hourIdx) => (
                      <div key={time} className="grid grid-cols-8 min-h-[64px]">
                        
                        {/* Time Label */}
                        <div className={`p-2 ${isRtl ? 'border-l' : 'border-r'} border-slate-200 dark:border-slate-800 text-center font-mono text-slate-400 dark:text-slate-500 text-[11px] bg-slate-50/40 dark:bg-[#131b2e]/30 flex items-center justify-center font-bold select-none`}>
                          {formatDigits(time)}
                        </div>

                        {/* Day Cells for this Hour Slot */}
                        {currentDays.map((day) => {
                          const cellEvents = allEvents.filter(
                            (e) => e.dayIdx === day.persIdx && Math.floor(e.startHourIdx) === hourIdx
                          );

                          return (
                            <div
                              key={day.persIdx}
                              className={`p-1 ${isRtl ? 'border-l' : 'border-r'} border-slate-200 dark:border-slate-800 last:border-none relative group hover:bg-slate-50/50 dark:hover:bg-[#131b2e]/40 transition-colors ${
                                day.isToday ? 'bg-blue-50/10 dark:bg-blue-950/10' : ''
                              }`}
                            >
                              {cellEvents.map((evt) => (
                                <div
                                  key={evt.id}
                                  onClick={() => setSelectedTaskDetail(evt)}
                                  className={`rounded-lg p-2 shadow-2xs transition-all hover:scale-[1.02] cursor-pointer space-y-1 ${getEventCardStyle(evt.typeColor)}`}
                                  style={{
                                    minHeight: `${Math.max(52, evt.durationHours * 58)}px`
                                  }}
                                >
                                  <h5 className="font-extrabold text-[11px] leading-tight line-clamp-2">
                                    {t(evt.title)}
                                  </h5>

                                  <div className="flex items-center justify-between text-[10px] font-bold pt-1 opacity-90">
                                    <div className="flex items-center gap-1">
                                      <div className="w-4 h-4 rounded-full bg-slate-800 text-white flex items-center justify-center text-[8px] font-black shrink-0">
                                        {evt.avatarLetter}
                                      </div>
                                      <span className="truncate max-w-[75px]">{t(evt.assignee)}</span>
                                    </div>
                                    <span className="font-mono text-[9px]">{formatDigits(evt.durationHours)}h</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}

                      </div>
                    ))}

                  </div>

                </div>

              </div>
            </div>
          )}

          {/* DAILY VIEW */}
          {timeGrain === 'daily' && (
            <div className="p-4 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-3 flex items-center justify-between text-xs font-bold text-blue-900 dark:text-blue-200">
                <div className="flex items-center gap-2">
                  <CalendarDays size={18} className="text-blue-600 dark:text-blue-400" />
                  <span>{isRtl ? 'برنامه‌ریزی تفصیلی روز سه‌شنبه ۹ تیر ۱۴۰۵ (Tehran Time)' : 'Detailed Daily Schedule - Tuesday Jun 30, 2026 (Tehran Time)'}</span>
                </div>
                <span className="px-2.5 py-1 bg-blue-600 text-white rounded-full text-[10px] font-black">
                  {formatDigits(2)} {t('scheduled_tasks')}
                </span>
              </div>

              <div className="max-h-[550px] overflow-y-auto custom-scrollbar space-y-3">
                {TIME_SLOTS.map((time, hourIdx) => {
                  const dayEvents = allEvents.filter(
                    (e) => e.dayIdx === 3 && Math.floor(e.startHourIdx) === hourIdx
                  );

                  return (
                    <div key={time} className="flex items-start gap-4 p-3 bg-slate-50 dark:bg-[#131b2e] rounded-xl border border-slate-200/60 dark:border-slate-800">
                      <div className="w-16 text-center font-mono text-xs font-extrabold text-slate-500 dark:text-slate-400 pt-1 shrink-0">
                        {formatDigits(time)}
                      </div>

                      <div className="flex-1 space-y-2">
                        {dayEvents.length === 0 ? (
                          <p className="text-xs text-slate-400 dark:text-slate-500 italic py-1">{t('free_hour')}</p>
                        ) : (
                          dayEvents.map((evt) => (
                            <div
                              key={evt.id}
                              onClick={() => setSelectedTaskDetail(evt)}
                              className={`p-3 rounded-xl shadow-2xs border-r-4 cursor-pointer space-y-2 transition-all hover:scale-[1.01] ${getEventCardStyle(evt.typeColor)}`}
                            >
                              <div className="flex items-center justify-between">
                                <h4 className="font-extrabold text-xs">{t(evt.title)}</h4>
                                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/60 dark:bg-[#0d121f]">
                                  {formatDigits(evt.durationHours)} {t('hours_unit')}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[11px] font-medium pt-1 border-t border-black/5 dark:border-white/5">
                                <span className="flex items-center gap-1">
                                  <Folder size={12} />
                                  <span>{t(evt.project)}</span>
                                </span>
                                <span className="flex items-center gap-1 font-bold">
                                  <User size={12} />
                                  <span>{t('assigned_lead')}: {t(evt.assignee)}</span>
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MONTHLY VIEW */}
          {timeGrain === 'monthly' && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-extrabold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#131b2e] p-2 rounded-xl">
                {BASE_DAYS_DEF.map((d) => (
                  <div key={d.persIdx}>{isRtl ? d.faName : d.enName}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 30 }, (_, i) => i + 1).map((dayNum) => {
                  const hasEvents = dayNum === 6 || dayNum === 7 || dayNum === 9 || dayNum === 11;
                  const isToday = dayNum === 9;

                  return (
                    <div
                      key={dayNum}
                      className={`min-h-[85px] p-2 rounded-xl border transition-all text-xs flex flex-col justify-between ${
                        isToday
                          ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-500 font-extrabold shadow-2xs'
                          : 'bg-white dark:bg-[#131b2e] border-slate-200/80 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-mono font-extrabold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {formatDigits(dayNum)}
                        </span>
                        {isToday && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-600 text-white font-bold">
                            {t('today')}
                          </span>
                        )}
                      </div>

                      {hasEvents && (
                        <div className="space-y-1 mt-1">
                          <div className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[9px] font-extrabold truncate">
                            {isRtl ? 'جلسه تیم فرانت' : 'Frontend Meeting'}
                          </div>
                          <div className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[9px] font-extrabold truncate">
                            {isRtl ? 'دیزاین سیستم' : 'Design System'}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

      {/* SUB-TAB 2: TEAM PHASE DEADLINES & PROGRESS BARS VIEW */}
      {(viewMode === 'team_deadlines') && (
        <div className="space-y-6 pt-2">

          {/* Team Deadline Progress Cards Container */}
          <div className="bg-white dark:bg-[#0d121f] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-500/20 shrink-0">
                  <Users size={20} className="stroke-[2]" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-slate-100 text-base">
                    {t('team_deadlines_title')}
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
                    {t('team_deadlines_desc')}
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-xs font-black rounded-full border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                {t('active_departments_count')}
              </span>
            </div>

            {/* Timeline Rows */}
            <div className="space-y-4">
              {TEAM_TIMELINES.map((team) => (
                <div
                  key={team.id}
                  className="p-4 bg-slate-50 dark:bg-[#131b2e] rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 transition-all hover:border-blue-500/40"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs font-bold">
                    <div className="flex items-center gap-3">
                      <span className="font-black text-slate-800 dark:text-slate-100 text-sm">
                        {t(team.name)}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                        {t('leader')}: {t(team.leader)}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-slate-200 dark:bg-[#17223b] text-slate-700 dark:text-slate-200 text-[10px] font-black border border-slate-300 dark:border-slate-700">
                        {formatDigits(team.totalTasks)} {t('active_tasks')}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span>{t('start')}: {formatDigits(team.startDate)}</span>
                      <span>←</span>
                      <span className="text-blue-600 dark:text-blue-400 font-black">{t('deadline')}: {formatDigits(team.deadlineDate)}</span>
                    </div>
                  </div>

                  {/* Dual-Color Progress Bar Container */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-slate-400 dark:text-slate-500">{t('elapsed_progress_desc')}</span>
                      <span className="font-mono text-blue-600 dark:text-blue-400 font-black">
                        {formatDigits(team.elapsedPct)}٪
                      </span>
                    </div>
                    <div className="h-3.5 w-full bg-slate-200 dark:bg-[#0d121f] rounded-full overflow-hidden p-0.5 border border-slate-300/40 dark:border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          team.status === 'critical'
                            ? 'bg-gradient-to-r from-amber-500 to-rose-600'
                            : team.status === 'warning'
                            ? 'bg-gradient-to-r from-blue-500 to-amber-500'
                            : 'bg-gradient-to-r from-emerald-500 to-blue-600'
                        }`}
                        style={{ width: `${team.elapsedPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TASK DETAIL POPUP MODAL */}
      {selectedTaskDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto" dir={isRtl ? 'rtl' : 'ltr'}>
          <div 
            onClick={() => setSelectedTaskDetail(null)}
            className="fixed inset-0 z-0 bg-black/40 dark:bg-black/70 backdrop-blur-[1px] transition-opacity duration-200 animate-in fade-in cursor-pointer"
          />
          <div className="relative z-10 bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 rounded-[28px] max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {t('priority_high')}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {t('status_inprogress')}
                  </span>
                </div>
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-snug">
                  {t(selectedTaskDetail.title)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTaskDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-[#131b2e] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold text-slate-700 dark:text-slate-300">
              <div className="bg-slate-50 dark:bg-[#131b2e] p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block">{t('related_project_name')}</span>
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-extrabold">
                  <Folder size={14} />
                  <span>{t(selectedTaskDetail.project)}</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#131b2e] p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block">{t('assigned_lead')}</span>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-black">
                    {selectedTaskDetail.avatarLetter}
                  </div>
                  <span>{t(selectedTaskDetail.assignee)}</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#131b2e] p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block">{t('allocated_time_window')}</span>
                <div className="flex items-center gap-1 font-mono text-[11px]">
                  <Clock size={13} className="text-slate-400" />
                  <span>{formatDigits(selectedTaskDetail.durationHours)} {t('hours_unit')}</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#131b2e] p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block">{t('logged_work')}</span>
                <div className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">
                  {selectedTaskDetail.loggedHours}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedTaskDetail(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-[#131b2e]"
              >
                {t('close')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedTaskDetail(null);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold transition-colors cursor-pointer flex items-center gap-1"
              >
                <ExternalLink size={14} />
                <span>{t('view_in_kanban')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW TASK MODAL */}
      <CreateTaskModal
        isOpen={isCreateTaskModalOpen}
        onClose={() => setIsCreateTaskModalOpen(false)}
      />

    </div>
  );
};

export const TechnicalTasksSubView = TaskDeadlinesTimelineView;
export const CalendarGanttView = TaskDeadlinesTimelineView;
export default TaskDeadlinesTimelineView;

