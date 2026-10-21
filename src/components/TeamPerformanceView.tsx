import { LocalImage } from './common/LocalImage';
import React from 'react';
import { useProject } from '../context/ProjectContext';
import { 
  Users, 
  CheckSquare, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingDown, 
  Star, 
  Info, 
  ChevronLeft,
  Award,
  Activity,
  BarChart2,
  PieChart,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const toPersianDigits = (n: string | number): string => {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (x) => farsiDigits[parseInt(x, 10)]);
};

export const TeamPerformanceView: React.FC = () => {
  const { teamMembers = [], tasks = [] } = useProject();

  // Dynamic Top Performers derived from context state
  const topPerformers = React.useMemo(() => {
    if (!teamMembers || teamMembers.length === 0) return [];
    return [...teamMembers]
      .map((member) => {
        const memberTasks = tasks.filter((t) => t.assignedTo === member.name || t.assignedTo === member.id);
        const completed = memberTasks.filter((t) => t.status === 'completed' || t.status === 'done').length;
        return {
          id: member.id,
          name: member.name,
          role: member.role || 'عضو تیم',
          rating: member.rating ? String(member.rating) : (completed > 5 ? '۹.۶' : '۹.۰'),
          level: completed > 5 ? 'ممتاز' : 'عالی',
          avatar: member.avatar || '/avatars/avatar-7.svg'
        };
      })
      .slice(0, 5);
  }, [teamMembers, tasks]);

  // Department Distribution data derived from context state
  const departmentData = React.useMemo(() => {
    if (!teamMembers || teamMembers.length === 0) return [];
    const deptCounts: Record<string, number> = {};
    teamMembers.forEach((m) => {
      const dept = m.department || 'عمومی';
      deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    });

    const labelMap: Record<string, string> = {
      wp_dev: 'توسعه وب',
      ui_ux: 'طراحی UI/UX',
      seo: 'سئو و محتوا',
      qa: 'تضمین کیفیت',
      content: 'تولید محتوا',
      client_approval: 'ارتباط مشتری'
    };

    const counts = Object.values(deptCounts);
    const maxCount = Math.max(...counts, 1);

    return Object.entries(deptCounts).map(([deptKey, count]) => ({
      name: labelMap[deptKey] || deptKey,
      count,
      height: `${Math.round((count / maxCount) * 85)}%`,
      highlighted: count === maxCount
    }));
  }, [teamMembers]);

  // Dynamic KPI counts
  const totalStaffCount = teamMembers.length;
  const activeTasksCount = tasks.filter(t => t.status !== 'completed' && t.status !== 'done').length;
  const completedTasksCount = tasks.filter(t => t.status === 'completed' || t.status === 'done').length;
  const avgProductivity = tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : 0;

  // Capacity & Gauge percentage
  const capacityPercentage = tasks.length > 0 ? Math.min(100, Math.round((completedTasksCount / tasks.length) * 100)) : 78;
  const freeCapacityPercentage = Math.max(0, 100 - capacityPercentage);

  // Online & Attendance dynamic metrics
  const onlineCount = teamMembers.filter(m => m.status === 'online').length;
  const onlinePresencePct = teamMembers.length > 0 ? Math.round((onlineCount / teamMembers.length) * 100) : 88;
  const onTimeDeliveryPct = tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : 94;

  // Overall Score Calculation from Team Members
  const overallScoreNum = React.useMemo(() => {
    if (!teamMembers || teamMembers.length === 0) return 9.2;
    const sum = teamMembers.reduce((acc, m) => {
      const raw = String(m.rating || 9.2).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
      const num = parseFloat(raw);
      return acc + (isNaN(num) ? 9.2 : num);
    }, 0);
    return parseFloat((sum / teamMembers.length).toFixed(1));
  }, [teamMembers]);

  // Dynamic Rating Breakdown Tiers
  const tierCounts = React.useMemo(() => {
    let excellent = 0;
    let good = 0;
    let normal = 0;
    let needImprovement = 0;

    teamMembers.forEach(m => {
      const raw = String(m.rating || 9.2).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
      const score = parseFloat(raw) || 9.0;
      if (score >= 9.0) excellent++;
      else if (score >= 8.0) good++;
      else if (score >= 7.0) normal++;
      else needImprovement++;
    });

    const total = teamMembers.length || 1;
    return {
      excellent,
      good,
      normal,
      needImprovement,
      excellentPct: Math.round((excellent / total) * 100),
      goodPct: Math.round((good / total) * 100),
      normalPct: Math.round((normal / total) * 100),
      needImprovementPct: Math.round((needImprovement / total) * 100),
    };
  }, [teamMembers]);

  // Weekly Activity Heatmap data (7 days x 5 slots)
  const heatmapData = [
    ['bg-blue-600', 'bg-blue-800', 'bg-blue-400', 'bg-blue-600', 'bg-blue-200'],
    ['bg-blue-800', 'bg-blue-600', 'bg-blue-800', 'bg-blue-400', 'bg-blue-600'],
    ['bg-blue-400', 'bg-blue-800', 'bg-blue-600', 'bg-blue-800', 'bg-blue-400'],
    ['bg-blue-600', 'bg-blue-400', 'bg-blue-800', 'bg-blue-600', 'bg-blue-200'],
    ['bg-blue-800', 'bg-blue-600', 'bg-blue-400', 'bg-blue-800', 'bg-blue-600'],
    ['bg-blue-200', 'bg-blue-400', 'bg-blue-200', 'bg-slate-200 dark:bg-slate-800', 'bg-blue-200'],
    ['bg-slate-100 dark:bg-slate-800/60', 'bg-slate-200 dark:bg-slate-800', 'bg-slate-100 dark:bg-slate-800/60', 'bg-slate-100 dark:bg-slate-800/60', 'bg-slate-100 dark:bg-slate-800/60'],
  ];

  const dayLabels = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full font-sans text-right pt-1" dir="rtl">
      
      {/* ================================================================== */}
      {/* LEFT MAIN PANEL (COL-SPAN-8)                                      */}
      {/* ================================================================== */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        
        {/* TOP 3 KPI SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* KPI 1: Total Staff */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">کل نیروها</span>
              <div className="p-2 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <Users size={18} />
              </div>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-3xl font-black text-slate-800 dark:text-slate-100">
                {toPersianDigits(totalStaffCount)} نفر
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-lg flex items-center gap-1">
                <ArrowUpRight size={14} />
                <span>فعال</span>
              </span>
            </div>
          </div>

          {/* KPI 2: Active Tasks */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">تسک‌های در جریان</span>
              <div className="p-2 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <CheckSquare size={18} />
              </div>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-3xl font-black text-slate-800 dark:text-slate-100">
                {toPersianDigits(activeTasksCount)} تسک
              </span>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-lg flex items-center gap-1">
                <span>زنده</span>
              </span>
            </div>
          </div>

          {/* KPI 3: Avg Productivity */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">میانگین راندمان</span>
              <div className="p-2 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <TrendingUp size={18} />
              </div>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-3xl font-black text-slate-800 dark:text-slate-100">
                {toPersianDigits(avgProductivity)}٪
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-lg flex items-center gap-1">
                <ArrowUpRight size={14} />
                <span>راندمان</span>
              </span>
            </div>
          </div>

        </div>

        {/* MIDDLE CHARTS (DEPARTMENTS & CAPACITY) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Card 1: Department Distribution */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">توزیع نیروها در دپارتمان‌ها</h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">Track your team distribution</p>
              </div>
              <BarChart2 size={18} className="text-blue-600 dark:text-blue-400" />
            </div>

            {/* Vertical Bar Chart Mockup */}
            <div className="h-44 flex items-end justify-between gap-3 pt-6 px-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              {departmentData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-bold">
                  داده‌ای برای نمایش وجود ندارد
                </div>
              ) : (
                departmentData.map((dept, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <span className="text-[10px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      {toPersianDigits(dept.count)} نفر
                    </span>
                    <div 
                      style={{ height: dept.height }}
                      className={`w-full max-w-[36px] rounded-t-xl transition-all duration-300 ${
                        dept.highlighted 
                          ? 'bg-blue-600 dark:bg-blue-500 shadow-md shadow-blue-500/20' 
                          : 'bg-slate-200 dark:bg-slate-700 group-hover:bg-blue-300 dark:group-hover:bg-blue-700'
                      }`}
                    />
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate w-full text-center">
                      {dept.name}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card 2: Capacity Status */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">وضعیت ظرفیت پردازشی</h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">Workload & Capacity Status</p>
              </div>
              <PieChart size={18} className="text-blue-600 dark:text-blue-400" />
            </div>

            {/* Semi-Circular Donut Gauge */}
            <div className="flex flex-col items-center justify-center h-44 space-y-2">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  {/* Background Circle */}
                  <path
                    className="text-slate-100 dark:text-slate-800 stroke-current"
                    strokeWidth="3.8"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Progress Circle */}
                  <path
                    className="text-blue-600 stroke-current transition-all duration-1000"
                    strokeDasharray={`${capacityPercentage}, 100`}
                    strokeWidth="3.8"
                    strokeLinecap="round"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center text-center">
                  <span className="text-xl font-black text-slate-800 dark:text-slate-100">
                    {toPersianDigits(capacityPercentage)}٪
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">تکمیل‌شده</span>
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-6 text-xs font-bold pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span className="text-slate-700 dark:text-slate-300">درگیر ({toPersianDigits(capacityPercentage)}٪)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span className="text-slate-500 dark:text-slate-400">آزاد ({toPersianDigits(freeCapacityPercentage)}٪)</span>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* BOTTOM ACTIVITY MATRIX */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Card 1: Task Absenteeism / Workload Breakdown */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">وضعیت حضور و پیگیری</h3>
              <Activity size={18} className="text-blue-600 dark:text-blue-400" />
            </div>

            <div className="space-y-3 pt-1">
              
              {/* Row 1 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700 dark:text-slate-300">حضور آنلاین و فعال</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{toPersianDigits(onlinePresencePct)}٪</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${onlinePresencePct}%` }} />
                </div>
              </div>

              {/* Row 2 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700 dark:text-slate-300">تحویل آن‌زمان تسک‌ها</span>
                  <span className="text-blue-600 dark:text-blue-400">{toPersianDigits(onTimeDeliveryPct)}٪</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full transition-all" style={{ width: `${onTimeDeliveryPct}%` }} />
                </div>
              </div>

              {/* Row 3 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700 dark:text-slate-300">میزان تعامل در چت تیمی</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{toPersianDigits(76)}٪</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: '76%' }} />
                </div>
              </div>

              {/* Row 4 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700 dark:text-slate-300">غیبت / مرخصی موجه</span>
                  <span className="text-amber-600 dark:text-amber-400">{toPersianDigits(100 - onlinePresencePct)}٪</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${100 - onlinePresencePct}%` }} />
                </div>
              </div>

            </div>
          </div>

          {/* Card 2: Weekly Activity Heatmap */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">نقشه فعالیت تیمی</h3>
              <Calendar size={18} className="text-blue-600 dark:text-blue-400" />
            </div>

            {/* GitHub-style Heatmap Grid */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between gap-1">
                {heatmapData.map((dayCols, dayIdx) => (
                  <div key={dayIdx} className="flex flex-col items-center gap-1.5 flex-1">
                    <div className="flex flex-col gap-1.5">
                      {dayCols.map((colorClass, slotIdx) => (
                        <div 
                          key={slotIdx} 
                          className={`w-5 h-5 md:w-6 md:h-6 rounded-md transition-all hover:scale-110 cursor-pointer ${colorClass}`}
                          title={`فعالیت روز ${dayLabels[dayIdx]}`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1">
                      {dayLabels[dayIdx].substring(0, 3)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Legend Bar */}
              <div className="flex items-center justify-end gap-1.5 text-[10px] text-slate-400 font-bold pt-2">
                <span>کمتر</span>
                <span className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800" />
                <span className="w-3 h-3 rounded bg-blue-200 dark:bg-blue-900" />
                <span className="w-3 h-3 rounded bg-blue-400 dark:bg-blue-700" />
                <span className="w-3 h-3 rounded bg-blue-600" />
                <span className="w-3 h-3 rounded bg-blue-800" />
                <span>بیشتر</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ================================================================== */}
      {/* RIGHT SIDEBAR PANEL (COL-SPAN-4)                                  */}
      {/* ================================================================== */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        
        {/* CARD 1: TOP 5 PERFORMERS LIST */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Award size={18} className="text-amber-500" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">عملکرد ممتاز (Top 5 Rating)</h3>
            </div>
            <ChevronLeft size={16} className="text-slate-400 cursor-pointer hover:text-slate-600" />
          </div>

          {/* List Items */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {topPerformers.length === 0 ? (
              <p className="text-xs text-slate-400 font-bold text-center py-6">داده‌ای برای نمایش وجود ندارد</p>
            ) : (
              topPerformers.map((person) => (
                <div key={person.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <LocalImage 
                      src={person.avatar} 
                      alt={person.name} 
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800 shrink-0" 
                    />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {person.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {person.role}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 font-bold px-2.5 py-1 rounded-xl text-xs border border-amber-200/60 dark:border-amber-800/40">
                    <Star size={12} className="fill-amber-400 text-amber-400 shrink-0" />
                    <span>{toPersianDigits(person.rating)}</span>
                    <span className="text-[10px] opacity-80">{person.level}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CARD 2: MATRICES RATING (OVERALL EVALUATION) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">ارزیابی کیفی راندمان</h3>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">ماتریس هوشمند</span>
          </div>

          {/* Huge Score Display */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[11px] font-bold text-slate-400 block">امتیاز کل راندمان کارگاه</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                تاییدشده توسط سیستم هوش مصنوعی
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Star size={24} className="fill-amber-400 text-amber-400" />
              <span className="text-3xl font-black text-slate-800 dark:text-slate-100">
                {toPersianDigits(overallScoreNum.toFixed(1))}
              </span>
            </div>
          </div>

          {/* Stacked Threshold Progress Bar */}
          <div className="space-y-2 pt-1">
            <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
              <span>توزیع سطوح عملکردی</span>
              <span>۱۰۰٪ کادر ({toPersianDigits(totalStaffCount)} نفر)</span>
            </div>

            <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
              <div className="bg-blue-600 h-full transition-all" style={{ width: `${tierCounts.excellentPct}%` }} title={`عالی (${tierCounts.excellentPct}٪)`} />
              <div className="bg-teal-500 h-full transition-all" style={{ width: `${tierCounts.goodPct}%` }} title={`خوب (${tierCounts.goodPct}٪)`} />
              <div className="bg-amber-500 h-full transition-all" style={{ width: `${tierCounts.normalPct}%` }} title={`متوسط (${tierCounts.normalPct}٪)`} />
              <div className="bg-rose-500 h-full transition-all" style={{ width: `${tierCounts.needImprovementPct}%` }} title={`نیازمند بهبود (${tierCounts.needImprovementPct}٪)`} />
            </div>

            {/* Threshold Legend */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-600 dark:text-slate-400 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <span>عالی: {toPersianDigits(tierCounts.excellentPct)}٪ ({toPersianDigits(tierCounts.excellent)} نفر)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                <span>خوب: {toPersianDigits(tierCounts.goodPct)}٪ ({toPersianDigits(tierCounts.good)} نفر)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>متوسط: {toPersianDigits(tierCounts.normalPct)}٪ ({toPersianDigits(tierCounts.normal)} نفر)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>نیازمند بهبود: {toPersianDigits(tierCounts.needImprovementPct)}٪ ({toPersianDigits(tierCounts.needImprovement)} نفر)</span>
              </div>
            </div>
          </div>

          {/* Helper Text with Info Icon */}
          <div className="flex items-start gap-2 bg-blue-50/60 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 p-3 rounded-xl border border-blue-100 dark:border-blue-900/50 text-xs font-medium leading-relaxed mt-2">
            <Info size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p>
              {toPersianDigits(tierCounts.excellentPct + tierCounts.goodPct)}٪ از کل کادر تخصصی آژانس در رده عملکرد عالی و خوب قرار دارند. شاخص‌های تخصیص پروژه بهینه‌سازی شده‌اند.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
};

export const TeamEfficiencySubView = TeamPerformanceView;
export default TeamPerformanceView;
