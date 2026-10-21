import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Filter, 
  MoreHorizontal, 
  CheckCircle2, 
  Eye, 
  HelpCircle, 
  Ban, 
  Sparkles,
  ArrowUpRight,
  Zap,
  RotateCcw,
  Download
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  ComposedChart
} from 'recharts';
import { Task, Project } from '../../types';

interface PremiumAnalyticsProps {
  tasks: Task[];
  projects: Project[];
  selectedProject: Project | null;
  isRtl: boolean;
}

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

  return <span className="font-sans font-black tabular-nums">{count}{suffix}</span>;
};

export const PremiumAnalytics: React.FC<PremiumAnalyticsProps> = ({ 
  tasks, 
  projects, 
  selectedProject, 
  isRtl 
}) => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly'>('monthly');
  const [visibleSeries, setVisibleSeries] = useState({
    productivity: true,
    completed: true,
  });

  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [activeSegment, setActiveSegment] = useState<string | null>(null);

  // 1. DYNAMIC METRIC CALCULATIONS
  const projectTasks = useMemo(() => {
    const safeTasks = tasks || [];
    if (!selectedProject || selectedProject.id === 'all' || selectedProject.id === 'no_project') {
      return safeTasks;
    }
    return safeTasks.filter(t => t && t.projectId === selectedProject.id);
  }, [tasks, selectedProject]);

  const stats = useMemo(() => {
    const safeTasks = projectTasks || [];
    const total = safeTasks.length;
    if (total === 0) {
      return {
        total: 0,
        completed: 0,
        review: 0,
        inprogress: 0,
        qa: 0,
        blocked: 0,
        pending: 0,
        productivity: 82,
        health: 88,
        completedRate: 0,
        reviewRate: 0,
        inprogressRate: 0,
        qaRate: 0,
        blockedRate: 0
      };
    }

    const completed = safeTasks.filter(t => t && t.status === 'completed').length;
    const review = safeTasks.filter(t => t && t.status === 'review').length;
    const inprogress = safeTasks.filter(t => t && t.status === 'inprogress').length;
    const qa = safeTasks.filter(t => t && t.department === 'qa' && t.status !== 'completed').length;
    const blocked = safeTasks.filter(t => t && t.status === 'blocked').length;
    const pending = safeTasks.filter(t => t && t.status === 'pending').length;

    // Weighted Productivity formula
    const weightedSum = (completed * 100) + (review * 80) + (inprogress * 65) + (qa * 75) + (pending * 30) + (blocked * 5);
    const productivity = Math.round(weightedSum / total);

    // Health score: heavily reduced by blocked tasks, slightly by pending
    const health = Math.max(20, 100 - (blocked * 15) - (pending * 3));

    return {
      total,
      completed,
      review,
      inprogress,
      qa,
      blocked,
      pending,
      productivity: Math.min(100, Math.max(10, productivity)),
      health: Math.min(100, Math.max(10, health)),
      completedRate: Math.round((completed / total) * 100),
      reviewRate: Math.round((review / total) * 100),
      inprogressRate: Math.round((inprogress / total) * 100),
      qaRate: Math.round((qa / total) * 100),
      blockedRate: Math.round((blocked / total) * 100)
    };
  }, [projectTasks]);

  // Dynamic Overall progress calculation
  const overallProgress = useMemo(() => {
    if (stats.total === 0) return 0;
    return Math.min(100, Math.round((stats.completed / stats.total) * 100));
  }, [stats]);

  // 2. TIMESERIES GENERATION CORRELATED TO REAL APP METRICS
  const chartData = useMemo(() => {
    const baseProd = stats.total > 0 ? (stats.productivity || 0) : 0;
    const baseComp = stats.total > 0 ? (stats.completed || 0) : 0;

    if (period === 'daily') {
      const days = isRtl 
        ? ['شنبه', '۱شنبه', '۲شنبه', '۳شنبه', '۴شنبه', '۵شنبه', 'جمعه'] 
        : ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      
      return days.map((day, idx) => {
        const factor = 1 + (idx - 3) * 0.04;
        return {
          name: day,
          'Productivity': Math.min(100, Math.max(10, Math.round(baseProd * factor))),
          'Completed': Math.max(0, Math.round(baseComp * 0.45 + idx * 0.6))
        };
      });
    }

    if (period === 'weekly') {
      const weeks = isRtl
        ? ['هفته ۱', 'هفته ۲', 'هفته ۳', 'هفته ۴']
        : ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

      return weeks.map((week, idx) => {
        const factor = 0.85 + idx * 0.08;
        return {
          name: week,
          'Productivity': Math.min(100, Math.round(baseProd * factor)),
          'Completed': Math.max(1, Math.round(baseComp * (0.3 + idx * 0.25)))
        };
      });
    }

    if (period === 'quarterly') {
      const quarters = isRtl ? ['Q1', 'Q2', 'Q3', 'Q4'] : ['Q1', 'Q2', 'Q3', 'Q4'];
      return quarters.map((quarter, idx) => {
        const factor = [0.9, 1.05, 0.95, 1.12][idx];
        return {
          name: quarter,
          'Productivity': Math.min(100, Math.round(baseProd * factor)),
          'Completed': Math.max(2, Math.round(baseComp * 2.5 * factor))
        };
      });
    }

    // Default: Monthly (6 Months)
    const months = isRtl
      ? ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور']
      : ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

    return months.map((month, idx) => {
      const factor = [0.84, 0.92, 0.97, 1.02, 0.96, 1.06][idx];
      return {
        name: month,
        'Productivity': Math.min(100, Math.round(baseProd * factor)),
        'Completed': Math.max(1, Math.round(baseComp * (0.5 + idx * 0.15) * factor))
      };
    });
  }, [period, stats, isRtl]);

  const circularSegments = useMemo(() => {
    return [
      {
        id: 'completed',
        label: isRtl ? 'تکمیل شده' : 'Completed',
        count: stats.completed,
        rate: stats.completedRate,
        color: '#4ADE80',
        radius: 41,
        strokeWidth: 5,
        icon: <CheckCircle2 size={11} className="text-[#4ADE80]" />
      },
      {
        id: 'inprogress',
        label: isRtl ? 'در حال اجرا' : 'In Progress',
        count: stats.inprogress,
        rate: stats.inprogressRate,
        color: '#5B7CFF',
        radius: 33,
        strokeWidth: 5,
        icon: <Zap size={11} className="text-[#5B7CFF]" />
      },
      {
        id: 'review',
        label: isRtl ? 'در حال بررسی' : 'In Review',
        count: stats.review,
        rate: stats.reviewRate,
        color: '#7867FF',
        radius: 25,
        strokeWidth: 5,
        icon: <Eye size={11} className="text-[#7867FF]" />
      },
      {
        id: 'qa',
        label: isRtl ? 'تست کیفیت' : 'QA Testing',
        count: stats.qa,
        rate: stats.qaRate,
        color: '#FF78C8',
        radius: 17,
        strokeWidth: 5,
        icon: <HelpCircle size={11} className="text-[#FF78C8]" />
      },
      {
        id: 'blocked',
        label: isRtl ? 'مسدود شده' : 'Blocked',
        count: stats.blocked,
        rate: stats.blockedRate,
        color: '#FFD66B',
        radius: 9,
        strokeWidth: 5,
        icon: <Ban size={11} className="text-[#FFD66B]" />
      }
    ];
  }, [stats, isRtl]);

  const activeSegmentDetails = useMemo(() => {
    if (!activeSegment) return null;
    return circularSegments.find(s => s.id === activeSegment);
  }, [activeSegment, circularSegments]);

  const glassNoiseStyle = {
    backgroundImage: `radial-gradient(at top left, rgba(255, 255, 255, 0.035), transparent), url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.012'/%3E%3C/svg%3E")`
  };

  return (
    /* 
      Physical Left-to-Right layout is applied on desktop.
      As per requested swap:
      - LEFT CARD: Statistical Area Chart (68% width on desktop)
      - RIGHT CARD: Circular KPI Card showing overall progress (32% width on desktop, smaller width and height)
      We use items-start so each card takes only its necessary height, making the right card shorter as requested.
      We use gap-5 to match the spacing of other widgets on this page.
    */
    <div 
      dir="ltr" 
      className="w-full grid grid-cols-12 gap-6 items-stretch select-none"
    >
      
      {/* ==========================================
          LEFT SIDE: Hero Custom Area Chart (68%)
          ========================================== */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={glassNoiseStyle}
        className="col-span-12 lg:col-span-8 group relative rounded-3xl p-6 bg-white dark:bg-[#121621] border border-slate-200/80 dark:border-slate-800/80 shadow-sm transition-colors duration-200 flex flex-col justify-between"
      >
        {/* Glow Effects (Contained inside a nested overflow-hidden container to allow tooltip and dropdowns to escape the card bounds) */}
        <div className="absolute inset-0 rounded-[26px] overflow-hidden pointer-events-none z-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#5B7CFF]/5 dark:bg-[#5B7CFF]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-12 w-48 h-48 bg-[#FFD66B]/5 dark:bg-[#FFD66B]/5 rounded-full blur-2xl pointer-events-none" />
        </div>

        <div dir={isRtl ? 'rtl' : 'ltr'} className="w-full flex flex-col h-full justify-between z-10">
          
          {/* Large Substantial Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-5 w-full">
            <div className="text-right">
              <span className="text-[10px] font-black text-[#5B7CFF] dark:text-[#5B7CFF] tracking-widest uppercase flex items-center gap-1.5 justify-start">
                <Sparkles size={11} className="text-[#5B7CFF]" />
                {isRtl ? 'تحلیل داده‌های آماری' : 'Intelligent Trend Monitor'}
              </span>
              <h3 className="text-lg font-black text-neutral-900 dark:text-white mt-1">
                {isRtl ? 'نمودار راندمان و بهره‌وری کارگاه' : 'Workshop Standing & Efficiency Trends'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {isRtl ? 'روند پیشرفت تسک‌های بسته‌شده و راندمان کاری.' : 'Correlative speed indexing, task outputs, and workspace standing.'}
              </p>
            </div>

            {/* Premium Control Center */}
            <div className="flex items-center gap-3 self-stretch sm:self-auto justify-end">
              
              {/* Period Selector Capsule */}
              <div className="flex items-center bg-neutral-100/80 dark:bg-slate-900/80 p-1 rounded-full border border-neutral-200/40 dark:border-white/[0.04]">
                {(['daily', 'weekly', 'monthly', 'quarterly'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 text-[10px] font-black rounded-full transition-all duration-300 cursor-pointer ${
                      period === p 
                        ? 'bg-white dark:bg-[#1A1B23] text-[#5B7CFF] shadow-sm border border-neutral-200/50 dark:border-white/[0.03]' 
                        : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white'
                    }`}
                  >
                    {p === 'daily' && (isRtl ? 'روزانه' : 'Daily')}
                    {p === 'weekly' && (isRtl ? 'هفتگی' : 'Weekly')}
                    {p === 'monthly' && (isRtl ? 'ماهانه' : 'Monthly')}
                    {p === 'quarterly' && (isRtl ? 'فصلی' : 'Quarterly')}
                  </button>
                ))}
              </div>

              {/* Filter Action */}
              <div className="relative">
                <button 
                  onClick={() => setFilterMenuOpen(!filterMenuOpen)}
                  className={`p-2 rounded-lg bg-neutral-100/60 dark:bg-slate-900/60 hover:bg-neutral-200/80 dark:hover:bg-slate-800 border border-neutral-200/40 dark:border-white/[0.04] text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white cursor-pointer transition-colors ${filterMenuOpen ? 'bg-neutral-200 dark:bg-slate-800' : ''}`}
                  title={isRtl ? 'فیلتر کردن داده‌ها' : 'Filter Datasets'}
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
                        className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1E1F28] border border-neutral-200 dark:border-white/[0.08] rounded-xl shadow-xl p-2.5 z-40 text-right"
                      >
                        <span className="text-[10px] font-bold text-neutral-400 block mb-2 px-1 border-b border-neutral-100 dark:border-white/5 pb-1 text-right">
                          {isRtl ? 'فیلتر نمایش نمودارها' : 'Toggle Datasets'}
                        </span>
                        <button 
                          onClick={() => setVisibleSeries(prev => ({ ...prev, productivity: !prev.productivity }))}
                          className="w-full flex items-center justify-between text-xs font-bold p-2 rounded-md hover:bg-neutral-50 dark:hover:bg-white/5 text-right cursor-pointer text-neutral-700 dark:text-neutral-200"
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-[#5B7CFF] block" />
                          <span>{isRtl ? 'امتیاز راندمان کاری' : 'Productivity Index'}</span>
                          <span className="text-[9px] text-neutral-400">{visibleSeries.productivity ? 'ON' : 'OFF'}</span>
                        </button>
                        <button 
                          onClick={() => setVisibleSeries(prev => ({ ...prev, completed: !prev.completed }))}
                          className="w-full flex items-center justify-between text-xs font-bold p-2 rounded-md hover:bg-neutral-50 dark:hover:bg-white/5 text-right cursor-pointer text-neutral-700 dark:text-neutral-200"
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-[#FFD66B] block" />
                          <span>{isRtl ? 'تسک‌های انجام شده' : 'Completed Scale'}</span>
                          <span className="text-[9px] text-neutral-400">{visibleSeries.completed ? 'ON' : 'OFF'}</span>
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Reset/Options Action */}
              <div className="relative">
                <button 
                  onClick={() => setOptionsMenuOpen(!optionsMenuOpen)}
                  className={`p-2 rounded-lg bg-neutral-100/60 dark:bg-slate-900/60 hover:bg-neutral-200/80 dark:hover:bg-slate-800 border border-neutral-200/40 dark:border-white/[0.04] text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white cursor-pointer transition-colors ${optionsMenuOpen ? 'bg-neutral-200 dark:bg-slate-800' : ''}`}
                  title={isRtl ? 'گزینه‌ها' : 'Options'}
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
                        className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1E1F28] border border-neutral-200 dark:border-white/[0.08] rounded-xl shadow-xl p-2 z-40 text-right"
                      >
                        <button 
                          onClick={() => {
                            setPeriod('monthly');
                            setVisibleSeries({ productivity: true, completed: true });
                            setOptionsMenuOpen(false);
                          }}
                          className="w-full text-xs font-bold p-2.5 rounded-md hover:bg-neutral-50 dark:hover:bg-white/5 text-right cursor-pointer flex items-center justify-between text-neutral-700 dark:text-neutral-200"
                        >
                          <RotateCcw size={12} />
                          <span>{isRtl ? 'بازنشانی پیش‌فرض‌ها' : 'Reset Defaults'}</span>
                        </button>
                        <button 
                          onClick={() => {
                            alert(isRtl ? 'خروجی داده‌ها ذخیره شد.' : 'Monitoring logs successfully exported.');
                            setOptionsMenuOpen(false);
                          }}
                          className="w-full text-xs font-bold p-2.5 rounded-md hover:bg-neutral-50 dark:hover:bg-white/5 text-right cursor-pointer flex items-center justify-between text-neutral-700 dark:text-neutral-200"
                        >
                          <Download size={12} />
                          <span>{isRtl ? 'خروجی گزارش (CSV)' : 'Export CSV'}</span>
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

            </div>
          </div>

          {/* Premium High-Fidelity Chart Area */}
          <div className="h-[210px] w-full mt-2 relative">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  {/* Premium long glowing gradients */}
                  <linearGradient id="premiumBlueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5B7CFF" stopOpacity={0.16}/>
                    <stop offset="100%" stopColor="#5B7CFF" stopOpacity={0.00}/>
                  </linearGradient>
                  <linearGradient id="premiumYellowGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFD66B" stopOpacity={0.08}/>
                    <stop offset="100%" stopColor="#FFD66B" stopOpacity={0.00}/>
                  </linearGradient>
                </defs>

                {/* Minimal Grid styling */}
                <CartesianGrid 
                  strokeDasharray="4 4" 
                  stroke="currentColor" 
                  className="text-neutral-200/50 dark:text-neutral-800/30" 
                  vertical={false} 
                  opacity={0.3} 
                />

                <XAxis 
                  dataKey="name" 
                  stroke="currentColor"
                  className="text-neutral-400 dark:text-neutral-500 font-sans font-bold"
                  fontSize={10} 
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />

                <YAxis 
                  stroke="currentColor"
                  className="text-neutral-400 dark:text-neutral-500 font-sans font-bold"
                  fontSize={10} 
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                />

                {/* Beautiful Custom Premium Tooltip */}
                <Tooltip
                  allowEscapeViewBox={{ x: true, y: true }}
                  cursor={{ stroke: 'rgba(91, 124, 255, 0.15)', strokeWidth: 1.5, strokeDasharray: '3 3' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white/95 dark:bg-[#1A1B23]/95 border border-neutral-200/60 dark:border-white/[0.08] backdrop-blur-md rounded-2xl p-4 shadow-2xl text-right z-50 min-w-44">
                          <span className="text-[10px] font-sans font-black text-neutral-400 dark:text-neutral-500 block mb-2 tracking-wide uppercase">
                            {label}
                          </span>
                          <div className="space-y-2">
                            {payload.map((entry, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-6 text-xs font-bold">
                                <span className="font-black font-sans tabular-nums" style={{ color: entry.color }}>
                                  {entry.value}%
                                </span>
                                <span className="text-neutral-600 dark:text-neutral-300">
                                  {entry.name === 'Productivity' ? (isRtl ? 'راندمان کاری' : 'Productivity') : (isRtl ? 'کارهای تکمیل شده' : 'Completed Scale')}
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

                {/* Premium Area series with Bezier interpolation and gradient fill */}
                {visibleSeries.productivity && (
                  <Area 
                    type="monotone" 
                    dataKey="Productivity" 
                    name="Productivity"
                    stroke="#5B7CFF" 
                    strokeWidth={1.8}
                    fillOpacity={1} 
                    fill="url(#premiumBlueGradient)" 
                    animationDuration={1500}
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

                {/* Secondary Bezier Curve representing completed metrics */}
                {visibleSeries.completed && (
                  <Area 
                    type="monotone" 
                    dataKey="Completed" 
                    name="Completed"
                    stroke="#FFD66B" 
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#premiumYellowGradient)"
                    animationDuration={1800}
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
          </div>

          {/* Premium Bottom Legend Bar */}
          <div className="border-t border-neutral-100 dark:border-white/5 pt-3 mt-3 flex flex-wrap items-center justify-between text-xs font-bold text-neutral-500 dark:text-neutral-400 gap-4">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setVisibleSeries(p => ({ ...p, productivity: !p.productivity }))}
                className={`flex items-center gap-2 cursor-pointer transition-opacity ${visibleSeries.productivity ? 'opacity-100' : 'opacity-35'}`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#5B7CFF] shadow-[0_0_8px_rgba(91,124,255,0.4)]" />
                <span>{isRtl ? 'راندمان عملکرد پروژه' : 'Productivity Index'}</span>
              </button>
              <button 
                onClick={() => setVisibleSeries(p => ({ ...p, completed: !p.completed }))}
                className={`flex items-center gap-2 cursor-pointer transition-opacity ${visibleSeries.completed ? 'opacity-100' : 'opacity-35'}`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFD66B] shadow-[0_0_8px_rgba(255,214,107,0.4)]" />
                <span>{isRtl ? 'تسک‌های پایان یافته' : 'Completed Scale'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 bg-neutral-100 dark:bg-white/5 px-3.5 py-1.5 rounded-full text-[10px] font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
              <span>{isRtl ? 'مستقیماً متصل به پایگاه داده کلاینت' : 'Synchronized with active client nodes'}</span>
            </div>
          </div>

        </div>
      </motion.div>

      {/* ==========================================
          RIGHT SIDE: Single Glowing Progress Circle Card (32%)
          ========================================== */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 }}
        style={glassNoiseStyle}
        className="col-span-12 lg:col-span-4 group relative rounded-3xl p-6 bg-white dark:bg-[#121621] border border-slate-200/80 dark:border-slate-800/80 shadow-sm transition-colors duration-200 flex flex-col justify-between"
      >
        {/* Glow Effects (Contained inside a nested overflow-hidden container) */}
        <div className="absolute inset-0 rounded-[26px] overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-12 -left-12 w-40 h-40 rounded-full bg-[#5B7CFF]/8 dark:bg-[#5B7CFF]/4 blur-3xl pointer-events-none transition-all duration-500 group-hover:scale-125" />
          <div className="absolute -bottom-16 -right-16 w-40 h-40 rounded-full bg-[#4ADE80]/8 dark:bg-[#4ADE80]/4 blur-3xl pointer-events-none" />
        </div>

        {/* Localized inner flow */}
        <div dir={isRtl ? 'rtl' : 'ltr'} className="w-full flex flex-col h-full justify-between space-y-6 z-10">
          
          {/* Header */}
          <div className="text-right">
            <span className="text-[10px] font-black text-[#5B7CFF] dark:text-[#5B7CFF] tracking-widest uppercase flex items-center gap-1.5 justify-start">
              <Sparkles size={11} className="text-[#5B7CFF]" />
              {isRtl ? 'پایش میزان پیشرفت' : 'Progress Index'}
            </span>
            <h3 className="text-base font-black text-neutral-900 dark:text-white mt-1">
              {isRtl ? 'پیشرفت کل پروژه‌ها' : 'Overall Projects Progress'}
            </h3>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
              {isRtl ? 'نسبت تسک‌های تکمیل شده به کل کارهای محوله.' : 'Ratio of completed tasks relative to the overall workload.'}
            </p>
          </div>

          {/* Unified Progress Circle Visualizer (Concentric Rings) */}
          <div className="flex-1 flex flex-col justify-center items-center py-4">
            <div className="relative w-40 h-40 flex items-center justify-center">
              
              {/* Concentric Circle SVGs */}
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
                      {/* Background track circle */}
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

                      {/* Foreground progress circle */}
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

                      {/* Invisible wider hover-helper circle */}
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

              {/* Central text displaying overall or specific progress */}
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
                        {isRtl ? 'پیشرفت کل' : 'OVERALL PROGRESS'}
                      </span>
                      <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1 leading-none">
                        <PremiumCounter value={overallProgress} suffix="%" />
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-300 font-medium mt-1 leading-none">
                        {isRtl 
                          ? `${stats.completed} از ${stats.total} تسک` 
                          : `${stats.completed} / ${stats.total} Tasks`}
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
                        {isRtl 
                          ? `${activeSegmentDetails.rate}٪ از کل` 
                          : `${activeSegmentDetails.rate}% of total`}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* DYNAMIC KPI SUMMARY GRID WITH HOVER FEEDBACK */}
          <div className="w-full pt-4 border-t border-neutral-100 dark:border-white/5 grid grid-cols-2 gap-2">
            {circularSegments.map((ring) => {
              const isSelected = activeSegment === ring.id;
              return (
                <div
                  key={ring.id}
                  onMouseEnter={() => setActiveSegment(ring.id)}
                  onMouseLeave={() => setActiveSegment(null)}
                  className={`flex items-center justify-between p-2 rounded-xl transition-all duration-300 text-xs font-bold cursor-pointer border ${
                    isSelected
                      ? 'bg-neutral-100 dark:bg-white/[0.08] border-neutral-300 dark:border-white/20 shadow-sm scale-[1.03]'
                      : 'bg-neutral-50 dark:bg-white/[0.02] border-neutral-100 dark:border-white/[0.04] hover:bg-neutral-100/50 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ring.color, boxShadow: `0 0 6px ${ring.color}` }} />
                    <span className="text-neutral-600 dark:text-neutral-400 text-[10px] whitespace-nowrap">{ring.label}</span>
                  </div>
                  <span className="font-mono text-neutral-900 dark:text-white text-[10px]">{ring.count}</span>
                </div>
              );
            })}
          </div>

        </div>
      </motion.div>

    </div>
  );
};
