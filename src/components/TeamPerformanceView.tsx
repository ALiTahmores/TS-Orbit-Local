import { LocalImage } from './common/LocalImage';
import React from 'react';
import { useProject } from '../context/ProjectContext';
import { Users, CheckSquare, TrendingUp, Clock, Calendar, BarChart2, Award } from 'lucide-react';
import { completedAt, deliveredOnTime, isOverdue, tasksAssignedTo } from '../lib/taskAnalytics';
import { STATUS_LABELS, statusKey } from '../lib/taskLabels';

const toPersianDigits = (n: string | number): string => {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (x) => farsiDigits[parseInt(x, 10)]);
};

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const isOpen = (task: any) => task.status !== 'completed' && task.status !== 'cancelled';
const rate = (values: (boolean | undefined)[]) => {
  const judged = values.filter((value): value is boolean => value !== undefined);
  return judged.length ? Math.round(judged.filter(Boolean).length / judged.length * 100) : null;
};
const percent = (value: number | null) => value === null ? '—' : `${toPersianDigits(value)}٪`;
const HEAT = ['bg-slate-100 dark:bg-slate-800/60', 'bg-blue-200 dark:bg-blue-900', 'bg-blue-400 dark:bg-blue-700', 'bg-blue-600', 'bg-blue-800'];

/** Team delivery metrics computed from stored tasks only. */
export const TeamPerformanceView: React.FC = () => {
  const { teamMembers = [], tasks = [], getRoleLabel } = useProject();

  const memberRows = React.useMemo(() => teamMembers.map(member => {
    const assigned = tasksAssignedTo(tasks, member.id);
    const completed = assigned.filter(task => task.status === 'completed');
    return {
      member,
      open: assigned.filter(isOpen).length,
      overdue: assigned.filter(task => isOverdue(task)).length,
      completed: completed.length,
      onTime: rate(completed.map(deliveredOnTime)),
    };
  }).sort((a, b) => b.completed - a.completed || b.open - a.open), [teamMembers, tasks]);

  const completedTasks = tasks.filter(task => task.status === 'completed');
  const openTasks = tasks.filter(isOpen);
  const completionRate = tasks.length ? Math.round(completedTasks.length / tasks.length * 100) : null;
  const onTimeRate = rate(completedTasks.map(deliveredOnTime));

  const statusRows = React.useMemo(() => (['pending', 'inprogress', 'review', 'blocked'] as const).map(key => ({
    key, label: STATUS_LABELS[key].fa, count: openTasks.filter(task => statusKey(task.status) === key).length,
  })), [openTasks]);
  const maxStatus = Math.max(1, ...statusRows.map(row => row.count));

  // Completions per weekday for the last four weeks (rows = weeks, oldest first).
  const heatmap = React.useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today.getTime() - ((today.getDay() + 1) % 7) * DAY);
    const first = new Date(weekStart.getTime() - 21 * DAY);
    const grid = Array.from({ length: 4 }, () => Array.from({ length: 7 }, () => 0));
    for (const task of completedTasks) {
      const at = completedAt(task);
      if (!at) continue;
      const index = Math.floor((new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() - first.getTime()) / DAY);
      if (index >= 0 && index < 28) grid[Math.floor(index / 7)][index % 7]++;
    }
    return { grid, max: Math.max(0, ...grid.flat()) };
  }, [completedTasks]);
  const heatClass = (count: number) => !count || !heatmap.max ? HEAT[0] : HEAT[Math.min(4, Math.ceil(count / heatmap.max * 4))];

  const kpis = [
    { label: 'اعضای تیم', value: `${toPersianDigits(teamMembers.length)} نفر`, icon: Users },
    { label: 'وظایف باز', value: toPersianDigits(openTasks.length), icon: CheckSquare },
    { label: 'نرخ تکمیل', value: percent(completionRate), icon: TrendingUp },
    { label: 'تحویل به‌موقع', value: percent(onTimeRate), icon: Clock },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full font-sans text-right pt-1" dir="rtl">
      <div className="lg:col-span-8 flex flex-col gap-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map(kpi => (
            <div key={kpi.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{kpi.label}</span>
                <div className="p-2 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"><kpi.icon size={16} /></div>
              </div>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{kpi.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Open tasks by status */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">وظایف باز بر اساس وضعیت</h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">کارهایی که هنوز تکمیل نشده‌اند</p>
              </div>
              <BarChart2 size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            {openTasks.length === 0 ? (
              <p className="text-xs text-slate-400 font-bold text-center py-10">وظیفهٔ بازی وجود ندارد.</p>
            ) : (
              <div className="space-y-3 pt-1">
                {statusRows.map(row => (
                  <div key={row.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700 dark:text-slate-300">{row.label}</span>
                      <span className={row.key === 'blocked' && row.count ? 'text-rose-600' : 'text-slate-500'}>{toPersianDigits(row.count)}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${row.key === 'blocked' ? 'bg-rose-500' : 'bg-blue-600'}`} style={{ width: `${row.count / maxStatus * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completion heatmap */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">نقشهٔ تکمیل وظایف</h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">چهار هفتهٔ اخیر، هر خانه یک روز</p>
              </div>
              <Calendar size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="space-y-1.5" role="table" aria-label="تعداد وظایف تکمیل‌شده در هر روز">
              <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] gap-1.5 text-[9px] font-bold text-slate-400 text-center">
                <span />
                {WEEKDAYS.map(day => <span key={day} className="truncate">{day}</span>)}
              </div>
              {heatmap.grid.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] gap-1.5 items-center">
                  <span className="text-[9px] font-bold text-slate-400">{weekIndex === 3 ? 'این هفته' : `${toPersianDigits(3 - weekIndex)} هفته پیش`}</span>
                  {week.map((count, dayIndex) => (
                    <div key={dayIndex} title={`${WEEKDAYS[dayIndex]}: ${toPersianDigits(count)} وظیفه`} className={`h-6 rounded-md ${heatClass(count)}`} />
                  ))}
                </div>
              ))}
              <div className="flex items-center justify-end gap-1.5 text-[10px] text-slate-400 font-bold pt-2">
                <span>کمتر</span>
                {HEAT.map(cls => <span key={cls} className={`w-3 h-3 rounded ${cls}`} />)}
                <span>بیشتر</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Per-member delivery */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Award size={18} className="text-amber-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">کارکرد اعضا</h3>
          </div>
          {memberRows.length === 0 ? (
            <p className="text-xs text-slate-400 font-bold text-center py-6">هنوز عضوی در این فضای کاری نیست.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {memberRows.map(({ member, open, overdue, completed, onTime }) => (
                <div key={member.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <LocalImage src={member.avatar} alt={member.name} className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800 shrink-0" />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{member.name}</h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{getRoleLabel(member.role)}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-4 gap-1 text-center text-[10px]">
                    {[['باز', toPersianDigits(open)], ['تکمیل', toPersianDigits(completed)], ['تأخیر', toPersianDigits(overdue)], ['به‌موقع', percent(onTime)]].map(([label, value]) => (
                      <div key={label} className={`rounded-lg py-1 bg-slate-50 dark:bg-slate-800/60 ${label === 'تأخیر' && overdue ? 'text-rose-600' : 'text-slate-700 dark:text-slate-200'}`}>
                        <dt className="text-slate-400 font-bold">{label}</dt>
                        <dd className="font-black">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-400 leading-relaxed">«به‌موقع» سهم وظایف تکمیل‌شده‌ای است که پیش از سررسید یا در روز سررسید بسته شده‌اند.</p>
        </div>
      </div>
    </div>
  );
};

export const TeamEfficiencySubView = TeamPerformanceView;
export default TeamPerformanceView;
