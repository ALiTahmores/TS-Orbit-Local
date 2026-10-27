import React from 'react';
import { Calendar } from 'lucide-react';
import { persianNumber } from '../../lib/dates';

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const HEAT = ['bg-slate-100 dark:bg-slate-800/60', 'bg-blue-200 dark:bg-blue-900', 'bg-blue-400 dark:bg-blue-700', 'bg-blue-600', 'bg-blue-800'];

/** Counts per day over the last `weeks` Saturday-first weeks; rows are weeks, oldest first. */
export function dailyGrid(dates: Date[], weeks: number, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(today.getTime() - ((today.getDay() + 1) % 7) * DAY);
  const first = new Date(weekStart.getTime() - (weeks - 1) * 7 * DAY);
  const grid = Array.from({ length: weeks }, () => Array.from({ length: 7 }, () => 0));
  for (const at of dates) {
    if (Number.isNaN(at.getTime())) continue;
    const index = Math.round((new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() - first.getTime()) / DAY);
    if (index >= 0 && index < weeks * 7) grid[Math.floor(index / 7)][index % 7]++;
  }
  return { grid, max: Math.max(0, ...grid.flat()) };
}

interface ActivityHeatmapProps {
  dates: Date[];
  title: string;
  subtitle: string;
  /** "۳ وظیفه": the count with its unit, for each day's tooltip. */
  describe: (count: number) => string;
  weeks?: number;
}

/** A day-by-day intensity grid in the dashboard card style. */
export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ dates, title, subtitle, describe, weeks = 4 }) => {
  const { grid, max } = React.useMemo(() => dailyGrid(dates, weeks), [dates, weeks]);
  const heat = (count: number) => !count || !max ? HEAT[0] : HEAT[Math.min(4, Math.ceil(count / max * 4))];
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{subtitle}</p>
        </div>
        <Calendar size={18} className="text-blue-600 dark:text-blue-400" />
      </div>
      <div className="space-y-1.5" role="table" aria-label={title}>
        <div className="grid grid-cols-[4.5rem_repeat(7,minmax(0,1fr))] gap-1.5 text-[9px] font-bold text-slate-400 text-center">
          <span />
          {WEEKDAYS.map(day => <span key={day} className="truncate">{day}</span>)}
        </div>
        {grid.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-[4.5rem_repeat(7,minmax(0,1fr))] gap-1.5 items-center">
            <span className="text-[9px] font-bold text-slate-400 truncate">
              {weekIndex === weeks - 1 ? 'این هفته' : `${persianNumber(weeks - 1 - weekIndex)} هفته پیش`}
            </span>
            {week.map((count, dayIndex) => (
              <div key={dayIndex} title={`${WEEKDAYS[dayIndex]}: ${describe(count)}`} className={`h-6 rounded-md ${heat(count)}`} />
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
  );
};
