import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Award, 
  Zap, 
  Flame, 
  Target, 
  TrendingUp, 
  CheckSquare, 
  MessageSquare, 
  Calendar, 
  Activity, 
  Sparkles, 
  ChevronLeft,
  Files,
  ShieldCheck,
  CheckCircle2,
  Eye,
  HelpCircle,
  Ban,
  Filter,
  MoreHorizontal,
  RotateCcw,
  Download
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ComposedChart,
  Area
} from 'recharts';
import { useProject } from '../../context/ProjectContext';
import { useUserAnalytics } from '../../hooks/useUserAnalytics';
import { completionSeries, downloadCsv, seriesToCsv } from '../../lib/taskAnalytics';

const toPersianDigits = (n: string | number): string => {
  if (n === undefined || n === null) return '';
  return n.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)] || '۰');
};

// Custom animated counter to count numbers up in a premium way
const PremiumCounter: React.FC<{ value: number; duration?: number; suffix?: string }> = ({ value, duration = 1.2, suffix = '' }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) {
      setCount(end);
      return;
    }

    const totalMiliseconds = duration * 1000;
    const incrementTime = Math.max(Math.floor(totalMiliseconds / (end || 1)), 16);
    
    const timer = setInterval(() => {
      start += Math.ceil((end - start) * 0.15);
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(start);
      }
    }, incrementTime);

    return () => clearInterval(timer);
  }, [value, duration]);

  return <span className="font-sans font-black tabular-nums">{toPersianDigits(count)}{suffix}</span>;
};

// 1. Personal Productivity Trend Chart Widget (Dynamic Data - Cloned 1:1 from Business View)
export const PersonalProductivityChartWidget: React.FC = () => {
  const analytics = useUserAnalytics();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly'>('monthly');
  const [visibleSeries, setVisibleSeries] = useState({
    productivity: true,
    completed: true,
  });

  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);

  // Real buckets: tasks completed in each period and the share delivered by their due date.
  const series = useMemo(() => completionSeries(analytics.myTasks, period), [period, analytics.myTasks]);
  const chartData = useMemo(() => series.map(point => ({ name: point.name, Productivity: point.OnTime, Completed: point.Completed })), [series]);
  const hasCompletions = series.some(point => point.Completed > 0);

  const glassNoiseStyle = {
    backgroundImage: `radial-gradient(at top left, rgba(255, 255, 255, 0.035), transparent), url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.012'/%3E%3C/svg%3E")`
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={glassNoiseStyle}
      className="group relative rounded-3xl p-6 bg-white dark:bg-[#121621] border border-slate-200/80 dark:border-slate-800/80 shadow-sm transition-colors duration-200 flex flex-col justify-between h-full"
    >
      {/* Glow Effects */}
      <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 start-0 w-64 h-64 bg-[#5B7CFF]/5 dark:bg-[#5B7CFF]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 end-12 w-48 h-48 bg-[#FFD66B]/5 dark:bg-[#FFD66B]/5 rounded-full blur-2xl pointer-events-none" />
      </div>

      <div className="w-full flex flex-col h-full justify-between z-10">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 w-full">
          <div className="text-start">
            <span className="text-[10px] font-black text-[#5B7CFF] dark:text-[#5B7CFF] tracking-widest uppercase flex items-center gap-1.5 justify-start">
              <Sparkles size={11} className="text-[#5B7CFF]" />
              تحلیل داده‌های آماری
            </span>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
              روند انجام کارهای من
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              تعداد وظایف تکمیل‌شده و درصد تحویل به‌موقع در هر بازه.
            </p>
          </div>

          {/* Filter Controls */}
          <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-end">
            
            {/* Period Selector Capsule */}
            <div dir="ltr" className="flex items-center bg-slate-100/80 dark:bg-slate-900/80 p-1 rounded-full border border-slate-200/50 dark:border-slate-800/80">
              {(['daily', 'weekly', 'monthly', 'quarterly'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-[10px] font-black rounded-full transition-all duration-300 cursor-pointer ${
                    period === p 
                      ? 'bg-white dark:bg-[#121621] text-[#5B7CFF] shadow-sm border border-slate-200/50 dark:border-slate-800/80' 
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {p === 'daily' && 'روزانه'}
                  {p === 'weekly' && 'هفتگی'}
                  {p === 'monthly' && 'ماهانه'}
                  {p === 'quarterly' && 'فصلی'}
                </button>
              ))}
            </div>

            {/* Filter Action */}
            <div className="relative">
              <button 
                type="button"
                onClick={() => setFilterMenuOpen(!filterMenuOpen)}
                className={`p-2 rounded-lg bg-slate-100/60 dark:bg-slate-900/60 hover:bg-slate-200/80 dark:hover:bg-slate-800 border border-slate-200/40 dark:border-slate-800/80 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer transition-colors ${filterMenuOpen ? 'bg-slate-200 dark:bg-slate-800' : ''}`}
                title="فیلتر کردن داده‌ها"
              >
                <Filter size={14} />
              </button>
              <AnimatePresence>
                {filterMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setFilterMenuOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 5 }}
                      transition={{ duration: 0.15 }}
                      className="absolute end-0 mt-2 w-48 bg-white dark:bg-[#121621] border border-slate-200 dark:border-slate-800/80 rounded-xl shadow-xl p-2.5 z-40 text-start"
                    >
                      <span className="text-[10px] font-bold text-slate-400 block mb-2 px-1 border-b border-slate-100 dark:border-slate-800 pb-1 text-start">
                        فیلتر نمایش نمودارها
                      </span>
                      <button 
                        type="button"
                        onClick={() => setVisibleSeries(prev => ({ ...prev, productivity: !prev.productivity }))}
                        className="w-full flex items-center justify-between text-xs font-bold p-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 text-start cursor-pointer text-slate-700 dark:text-slate-200"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-[#5B7CFF] block" />
                        <span>تحویل به‌موقع (٪)</span>
                        <span className="text-[9px] text-slate-400">{visibleSeries.productivity ? 'ON' : 'OFF'}</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setVisibleSeries(prev => ({ ...prev, completed: !prev.completed }))}
                        className="w-full flex items-center justify-between text-xs font-bold p-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 text-start cursor-pointer text-slate-700 dark:text-slate-200"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FFD66B] block" />
                        <span>وظایف انجام شده</span>
                        <span className="text-[9px] text-slate-400">{visibleSeries.completed ? 'ON' : 'OFF'}</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Options Menu */}
            <div className="relative">
              <button 
                type="button"
                onClick={() => setOptionsMenuOpen(!optionsMenuOpen)}
                className={`p-2 rounded-lg bg-slate-100/60 dark:bg-slate-900/60 hover:bg-slate-200/80 dark:hover:bg-slate-800 border border-slate-200/40 dark:border-slate-800/80 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer transition-colors ${optionsMenuOpen ? 'bg-slate-200 dark:bg-slate-800' : ''}`}
                title="گزینه‌ها"
              >
                <MoreHorizontal size={14} />
              </button>
              <AnimatePresence>
                {optionsMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setOptionsMenuOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 5 }}
                      transition={{ duration: 0.15 }}
                      className="absolute end-0 mt-2 w-48 bg-white dark:bg-[#121621] border border-slate-200 dark:border-slate-800/80 rounded-xl shadow-xl p-2 z-40 text-start"
                    >
                      <button 
                        type="button"
                        onClick={() => {
                          setPeriod('monthly');
                          setVisibleSeries({ productivity: true, completed: true });
                          setOptionsMenuOpen(false);
                        }}
                        className="w-full text-xs font-bold p-2.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 text-start cursor-pointer flex items-center justify-between text-slate-700 dark:text-slate-200"
                      >
                        <RotateCcw size={12} />
                        <span>بازنشانی پیش‌فرض‌ها</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          downloadCsv(`my-tasks-${period}.csv`, seriesToCsv(series));
                          setOptionsMenuOpen(false);
                        }}
                        className="w-full text-xs font-bold p-2.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 text-start cursor-pointer flex items-center justify-between text-slate-700 dark:text-slate-200"
                      >
                        <Download size={12} />
                        <span>خروجی گزارش (CSV)</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>

        {/* Chart Area */}
        <div className="h-[210px] w-full mt-2 relative" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="personalBlueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5B7CFF" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#5B7CFF" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="personalYellowGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFD66B" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#FFD66B" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid 
                strokeDasharray="4 4" 
                stroke="currentColor" 
                className="text-slate-200/50 dark:text-slate-800/50" 
                vertical={false} 
                opacity={0.3} 
              />

              <XAxis 
                dataKey="name" 
                stroke="currentColor"
                className="text-slate-400 dark:text-slate-400 font-sans font-bold"
                fontSize={10} 
                tickLine={false}
                axisLine={false}
                dy={10}
              />

              <YAxis
                yAxisId="rate"
                stroke="currentColor"
                className="text-slate-400 dark:text-slate-400 font-sans font-bold"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
              />
              <YAxis yAxisId="count" orientation="right" hide allowDecimals={false} domain={[0, (max: number) => Math.max(4, max)]} />

              <Tooltip
                allowEscapeViewBox={{ x: true, y: true }}
                cursor={{ stroke: 'rgba(91, 124, 255, 0.15)', strokeWidth: 1.5, strokeDasharray: '3 3' }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white/95 dark:bg-[#121621]/95 border border-slate-200/60 dark:border-slate-800/80 backdrop-blur-md rounded-2xl p-4 shadow-2xl text-start z-50 min-w-44">
                        <span className="text-[10px] font-sans font-black text-slate-400 dark:text-slate-400 block mb-2 tracking-wide uppercase">
                          {label}
                        </span>
                        <div className="space-y-2">
                          {payload.filter(entry => entry.value !== null && entry.value !== undefined).map((entry, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-6 text-xs font-bold">
                              <span className="font-black font-sans tabular-nums" style={{ color: entry.color }}>
                                {toPersianDigits(entry.value as number)}{entry.name === 'Productivity' ? '٪' : ''}
                              </span>
                              <span className="text-slate-600 dark:text-slate-300">
                                {entry.name === 'Productivity' ? 'تحویل به‌موقع' : 'وظایف تکمیل‌شده'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {visibleSeries.productivity && (
                <Area
                  yAxisId="rate"
                  connectNulls
                  type="monotone"
                  dataKey="Productivity"
                  name="Productivity"
                  stroke="#5B7CFF"
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#personalBlueGradient)" 
                  animationDuration={1200}
                  activeDot={{ 
                    r: 5, 
                    stroke: '#5B7CFF', 
                    strokeWidth: 3, 
                    strokeOpacity: 0.35, 
                    fill: '#5B7CFF',
                    style: { filter: 'drop-shadow(0px 0px 6px #5B7CFF)' } 
                  }}
                />
              )}

              {visibleSeries.completed && (
                <Area
                  yAxisId="count"
                  type="monotone"
                  dataKey="Completed"
                  name="Completed"
                  stroke="#FFD66B" 
                  strokeWidth={1.8}
                  fillOpacity={1}
                  fill="url(#personalYellowGradient)"
                  animationDuration={1500}
                  activeDot={{ 
                    r: 4.5, 
                    stroke: '#FFD66B', 
                    strokeWidth: 3, 
                    strokeOpacity: 0.35, 
                    fill: '#FFD66B',
                    style: { filter: 'drop-shadow(0px 0px 5px #FFD66B)' } 
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          {!hasCompletions && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-xs font-bold text-slate-400 bg-white/80 dark:bg-[#121621]/80 px-3 py-1.5 rounded-xl">
                هنوز وظیفه‌ای در این بازه تکمیل نشده است.
              </span>
            </div>
          )}
        </div>

        {/* Footer Metrics matching Business View */}
        <div className="border-t border-neutral-100 dark:border-white/5 pt-3 mt-3 flex flex-wrap items-center justify-between text-xs font-bold text-neutral-500 dark:text-neutral-400 gap-4">
          <div className="flex items-center gap-6">
            <button 
              type="button"
              onClick={() => setVisibleSeries(p => ({ ...p, productivity: !p.productivity }))}
              className={`flex items-center gap-2 cursor-pointer transition-opacity ${visibleSeries.productivity ? 'opacity-100' : 'opacity-35'}`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#5B7CFF] shadow-[0_0_8px_rgba(91,124,255,0.4)]" />
              <span>تحویل به‌موقع (٪)</span>
            </button>
            <button
              type="button"
              onClick={() => setVisibleSeries(p => ({ ...p, completed: !p.completed }))}
              className={`flex items-center gap-2 cursor-pointer transition-opacity ${visibleSeries.completed ? 'opacity-100' : 'opacity-35'}`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFD66B] shadow-[0_0_8px_rgba(255,214,107,0.4)]" />
              <span>وظایف تکمیل‌شده</span>
            </button>
          </div>
        </div>

      </div>
    </motion.div>
  );
};

// 2. Personal Total Progress Donut Radial Gauge (Dynamic Data - Cloned 1:1 from Business View)
export const Personal12TabsHealthWidget: React.FC = () => {
  const analytics = useUserAnalytics();
  const [activeSegment, setActiveSegment] = useState<string | null>(null);

  const stats = useMemo(() => {
    const completed = analytics.completedTasksCount;
    const inprogress = analytics.activeTasksCount;
    const review = analytics.pendingReviewsCount;
    const qa = analytics.overdueTasksCount;
    const blocked = analytics.blockedTasksCount;
    // Rates are shares of all assigned tasks; with none assigned every ring stays empty.
    const total = Math.max(1, analytics.totalMyTasks);

    return {
      completed,
      inprogress,
      review,
      qa,
      blocked,
      total,
      completedRate: Math.round((completed / total) * 100),
      inprogressRate: Math.round((inprogress / total) * 100),
      reviewRate: Math.round((review / total) * 100),
      qaRate: Math.round((qa / total) * 100),
      blockedRate: Math.round((blocked / total) * 100)
    };
  }, [analytics]);

  const overallProgress = useMemo(() => {
    if (stats.total === 0) return 0;
    return Math.min(100, Math.round((stats.completed / stats.total) * 100));
  }, [stats]);

  const circularSegments = useMemo(() => {
    return [
      {
        id: 'completed',
        label: 'تکمیل شده',
        count: stats.completed,
        rate: stats.completedRate,
        color: '#4ADE80',
        radius: 41,
        strokeWidth: 5,
        icon: <CheckCircle2 size={11} className="text-[#4ADE80]" />
      },
      {
        id: 'inprogress',
        label: 'در حال اجرا',
        count: stats.inprogress,
        rate: stats.inprogressRate,
        color: '#5B7CFF',
        radius: 33,
        strokeWidth: 5,
        icon: <Zap size={11} className="text-[#5B7CFF]" />
      },
      {
        id: 'review',
        label: 'در حال بررسی',
        count: stats.review,
        rate: stats.reviewRate,
        color: '#7867FF',
        radius: 25,
        strokeWidth: 5,
        icon: <Eye size={11} className="text-[#7867FF]" />
      },
      {
        id: 'qa',
        label: 'دارای تأخیر',
        count: stats.qa,
        rate: stats.qaRate,
        color: '#F43F5E',
        radius: 17,
        strokeWidth: 5,
        icon: <HelpCircle size={11} className="text-[#F43F5E]" />
      },
      {
        id: 'blocked',
        label: 'مسدود شده',
        count: stats.blocked,
        rate: stats.blockedRate,
        color: '#FFD66B',
        radius: 9,
        strokeWidth: 5,
        icon: <Ban size={11} className="text-[#FFD66B]" />
      }
    ];
  }, [stats]);

  const activeSegmentDetails = useMemo(() => {
    if (!activeSegment) return null;
    return circularSegments.find(s => s.id === activeSegment);
  }, [activeSegment, circularSegments]);

  const glassNoiseStyle = {
    backgroundImage: `radial-gradient(at top left, rgba(255, 255, 255, 0.035), transparent), url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.012'/%3E%3C/svg%3E")`
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 }}
      style={glassNoiseStyle}
      className="group relative rounded-3xl p-6 bg-white dark:bg-[#121621] border border-slate-200/80 dark:border-slate-800/80 shadow-sm transition-colors duration-200 flex flex-col justify-between h-full"
    >
      {/* Background Glows */}
      <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-12 -end-12 w-40 h-40 rounded-full bg-[#5B7CFF]/8 dark:bg-[#5B7CFF]/4 blur-3xl pointer-events-none transition-all duration-500 group-hover:scale-125" />
        <div className="absolute -bottom-16 -start-16 w-40 h-40 rounded-full bg-[#4ADE80]/8 dark:bg-[#4ADE80]/4 blur-3xl pointer-events-none" />
      </div>

      <div className="w-full flex flex-col h-full justify-between space-y-4 z-10">
        
        {/* Header */}
        <div className="text-start">
          <span className="text-[10px] font-black text-[#5B7CFF] dark:text-[#5B7CFF] tracking-widest uppercase flex items-center gap-1.5 justify-start">
            <Sparkles size={11} className="text-[#5B7CFF]" />
            پایش میزان پیشرفت
          </span>
          <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
            پیشرفت کل کارهای من
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            نسبت وظایف تکمیل شده به کل کارهای محوله.
          </p>
        </div>

        {/* Concentric Progress Gauge */}
        <div className="flex-1 flex flex-col justify-center items-center py-2">
          <div className="relative w-40 h-40 flex items-center justify-center">
            
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {circularSegments.map((ring) => {
                const circumference = 2 * Math.PI * ring.radius;
                const isHovered = activeSegment === ring.id;
                const strokeOffset = circumference - (circumference * ring.rate) / 100;
                
                return (
                  <g 
                    key={ring.id}
                    className="cursor-pointer"
                    onMouseEnter={() => setActiveSegment(ring.id)}
                    onMouseLeave={() => setActiveSegment(null)}
                  >
                    {/* Track */}
                    <circle
                      cx="50"
                      cy="50"
                      r={ring.radius}
                      stroke="currentColor"
                      className="text-slate-200/80 dark:text-slate-800/80 transition-all duration-300"
                      strokeWidth={ring.strokeWidth}
                      fill="transparent"
                      style={{
                        opacity: activeSegment && !isHovered ? 0.35 : 1
                      }}
                    />

                    {/* Progress */}
                    <motion.circle
                      cx="50"
                      cy="50"
                      r={ring.radius}
                      stroke={ring.color}
                      strokeWidth={isHovered ? ring.strokeWidth + 1.5 : ring.strokeWidth}
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: strokeOffset }}
                      transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                      strokeLinecap="round"
                      fill="transparent"
                      style={{
                        filter: isHovered ? `drop-shadow(0 0 6px ${ring.color})` : 'none',
                        opacity: activeSegment && !isHovered ? 0.35 : 1,
                        transition: 'stroke-width 0.3s ease, opacity 0.3s ease, filter 0.3s ease'
                      }}
                    />

                    <circle
                      cx="50"
                      cy="50"
                      r={ring.radius}
                      stroke="transparent"
                      strokeWidth={10}
                      fill="transparent"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Center Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 pointer-events-none">
              <AnimatePresence mode="wait">
                {!activeSegmentDetails ? (
                  <motion.div
                    key="overall"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-center justify-center"
                  >
                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">
                      پیشرفت کل
                    </span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1 leading-none">
                      <PremiumCounter value={overallProgress} suffix="%" />
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-300 font-medium mt-1 leading-none">
                      {toPersianDigits(stats.completed)} از {toPersianDigits(analytics.totalMyTasks)} وظیفه
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key={activeSegmentDetails.id}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col items-center justify-center"
                  >
                    <span 
                      className="text-[10px] font-black uppercase tracking-wider leading-none"
                      style={{ color: activeSegmentDetails.color }}
                    >
                      {activeSegmentDetails.label}
                    </span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1 leading-none">
                      <PremiumCounter value={activeSegmentDetails.count} suffix="" />
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-300 font-medium mt-1 leading-none">
                      {toPersianDigits(activeSegmentDetails.rate)}٪ از کل
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Status Grid matching Business View */}
        <div className="w-full pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-2">
          {circularSegments.map((ring) => {
            const isSelected = activeSegment === ring.id;
            return (
              <div
                key={ring.id}
                onMouseEnter={() => setActiveSegment(ring.id)}
                onMouseLeave={() => setActiveSegment(null)}
                className={`flex items-center justify-between p-2 rounded-xl transition-all duration-300 text-xs font-bold cursor-pointer border ${
                  isSelected
                    ? 'bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 shadow-sm scale-[1.03]'
                    : 'bg-slate-50 dark:bg-slate-900/60 border-slate-100 dark:border-slate-800/80 hover:bg-slate-100/50 dark:hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ring.color, boxShadow: `0 0 6px ${ring.color}` }} />
                  <span className="text-slate-600 dark:text-slate-400 text-[10px] whitespace-nowrap">{ring.label}</span>
                </div>
                <span className="font-mono text-slate-900 dark:text-white text-[10px]">{toPersianDigits(ring.count)}</span>
              </div>
            );
          })}
        </div>

      </div>
    </motion.div>
  );
};


