import React, { useEffect, useRef, useState } from 'react';
import { formatJalaliDayMonth } from '../../lib/dates';
import { cn } from '../../lib/utils';
import { num } from '../ui/dashboard-kit';
import type { SprintReport } from '../../hooks/useSprints';

/*
 * Charts follow the dataviz method: blue is the work (remaining / completed),
 * orange is the plan it is measured against (scope / commitment) — a pair that
 * passes the palette validator in light and dark — and the ideal or average line
 * is a dashed gray reference, not a series. Time runs left to right; every chart
 * has a legend, a hover read-out and a table view.
 */
const BLUE = 'stroke-[#155DFC] dark:stroke-[#4D8DFF]', BLUE_FILL = 'fill-[#155DFC] dark:fill-[#4D8DFF]';
const ORANGE = 'stroke-[#EB6834] dark:stroke-[#D95926]', ORANGE_FILL = 'fill-[#EB6834] dark:fill-[#D95926]';
const REFERENCE = 'stroke-slate-400 dark:stroke-slate-500';
const GRID = 'stroke-slate-200 dark:stroke-slate-800';
const AXIS_TEXT = 'fill-slate-400 dark:fill-slate-500 text-[10px]';
const RING = 'stroke-white dark:stroke-[#0d121f]';

/** The smallest "round" top (four equal steps of 1, 2, 2.5 or 5 × 10ⁿ) that fits the value. */
const niceMax = (value: number) => {
  if (value <= 4) return 4;
  const raw = value / 4, magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(unit => unit * magnitude).find(candidate => candidate >= raw) || magnitude * 10;
  return step * 4;
};

/** Draw at the container's real width, so text keeps its size in narrow panels and on phones. */
function useWidth(fallback = 640): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => { const next = Math.round(entry.contentRect.width); if (next > 0) setWidth(next); });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, Math.max(280, width)];
}
/** Axis values: whole numbers as is, halves and quarters with one decimal. */
const tick = (value: number) => num(value, Number.isInteger(value) ? 0 : 1);

const LegendItem: React.FC<{ swatch: 'line' | 'dash' | 'bar'; tone: 'blue' | 'orange' | 'gray'; label: string }> = ({ swatch, tone, label }) => {
  const color = tone === 'blue' ? 'bg-[#155DFC] dark:bg-[#4D8DFF] border-[#155DFC] dark:border-[#4D8DFF]' : tone === 'orange' ? 'bg-[#EB6834] dark:bg-[#D95926] border-[#EB6834] dark:border-[#D95926]' : 'border-slate-400 dark:border-slate-500';
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
      {swatch === 'bar' ? <span className={cn('w-2.5 h-2.5 rounded-[3px]', color)} />
        : <span className={cn('w-4 h-0 border-t-2', swatch === 'dash' ? 'border-dashed bg-transparent' : '', color, swatch !== 'bar' && 'bg-transparent')} />}
      {label}
    </span>
  );
};

const Tooltip: React.FC<{ left: number; children: React.ReactNode }> = ({ left, children }) => (
  <div className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 shadow-lg px-3 py-2 text-[11px] space-y-1"
    style={{ left: `clamp(0px, calc(${left}% - 72px), calc(100% - 150px))` }} dir="rtl">{children}</div>
);
const Row: React.FC<{ label: string; value: React.ReactNode; tone?: 'blue' | 'orange' | 'gray' }> = ({ label, value, tone }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
      {tone && <span className={cn('w-2 h-2 rounded-full', tone === 'blue' ? 'bg-[#155DFC] dark:bg-[#4D8DFF]' : tone === 'orange' ? 'bg-[#EB6834] dark:bg-[#D95926]' : 'bg-slate-400')} />}{label}
    </span>
    <span className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">{value}</span>
  </div>
);

export const BurndownChart: React.FC<{ data: NonNullable<SprintReport['burndown']> }> = ({ data }) => {
  const [hover, setHover] = useState<number | null>(null);
  const [box, W] = useWidth();
  const H = 250, M = { top: 18, right: 16, bottom: 30, left: 38 };
  const days = data.days, n = days.length;
  const unit = data.unit === 'points' ? 'امتیاز' : 'وظیفه';
  const max = niceMax(Math.max(1, ...days.map(day => Math.max(day.ideal, day.remaining ?? 0, day.scope ?? 0))));
  const x = (index: number) => M.left + (n === 1 ? (W - M.left - M.right) / 2 : index * (W - M.left - M.right) / (n - 1));
  const y = (value: number) => M.top + (1 - value / max) * (H - M.top - M.bottom);
  const known = days.map((day, index) => ({ ...day, index })).filter(day => day.remaining !== null) as Array<{ day: string; remaining: number; scope: number; ideal: number; index: number }>;
  const remaining = known.map((point, k) => `${k ? 'L' : 'M'}${x(point.index)},${y(point.remaining)}`).join(' ');
  const scope = known.map((point, k) => k ? `H${x(point.index)} V${y(point.scope)}` : `M${x(point.index)},${y(point.scope)}`).join(' ');
  const labelStep = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - M.left - M.right) / 72))));
  const last = known[known.length - 1];
  const markers = n <= 15 ? known : last ? [last] : [];
  const active = hover !== null ? days[hover] : null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <LegendItem swatch="line" tone="blue" label={`${unit} باقی‌مانده`} />
        <LegendItem swatch="line" tone="orange" label="کل کار اسپرینت" />
        <LegendItem swatch="dash" tone="gray" label="مسیر ایده‌آل" />
      </div>
      <div ref={box} className="relative" dir="ltr" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible" role="img" aria-label={`نمودار burndown: ${last ? `${num(last.remaining)} ${unit} باقی‌مانده از ${num(last.scope)}` : 'بدون داده'}`}>
          {[0, 0.25, 0.5, 0.75, 1].map(fraction => {
            const value = Math.round(max * fraction * 100) / 100;
            return (
              <g key={fraction}>
                <line x1={M.left} x2={W - M.right} y1={y(value)} y2={y(value)} className={GRID} strokeWidth={1} />
                <text x={M.left - 8} y={y(value)} dy="0.35em" textAnchor="end" className={AXIS_TEXT}>{tick(value)}</text>
              </g>
            );
          })}
          {days.map((day, index) => (index % labelStep === 0 || index === n - 1) && (n - 1 - index >= labelStep / 2 || index === n - 1) ? (
            <text key={day.day} x={x(index)} y={H - 8} textAnchor="middle" className={AXIS_TEXT}>{formatJalaliDayMonth(day.day)}</text>
          ) : null)}
          <path d={`M${x(0)},${y(days[0].ideal)} L${x(n - 1)},${y(0)}`} className={REFERENCE} strokeWidth={1.5} strokeDasharray="5 5" fill="none" />
          {active && <line x1={x(hover!)} x2={x(hover!)} y1={M.top} y2={H - M.bottom} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth={1} />}
          {known.length > 0 && <path d={scope} className={ORANGE} strokeWidth={2} fill="none" strokeLinejoin="round" />}
          {known.length > 0 && <path d={remaining} className={BLUE} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
          {markers.map(point => <circle key={point.day} cx={x(point.index)} cy={y(point.remaining)} r={4} className={cn(BLUE_FILL, RING)} strokeWidth={2} />)}
          {active && active.remaining !== null && <circle cx={x(hover!)} cy={y(active.remaining)} r={5} className={cn(BLUE_FILL, RING)} strokeWidth={2} />}
          {last && <text x={x(last.index)} y={y(last.remaining) - 10} textAnchor={last.index > n / 2 ? 'end' : 'start'} className="fill-slate-700 dark:fill-slate-200 text-[11px] font-bold">{`${num(last.remaining)} ${unit}`}</text>}
          {days.map((day, index) => {
            const half = n === 1 ? (W - M.left - M.right) / 2 : (W - M.left - M.right) / (n - 1) / 2;
            return <rect key={day.day} x={x(index) - half} y={M.top} width={half * 2} height={H - M.top - M.bottom} fill="transparent" onMouseEnter={() => setHover(index)} />;
          })}
        </svg>
        {active && (
          <Tooltip left={(x(hover!) / W) * 100}>
            <p className="font-bold text-slate-800 dark:text-slate-100">{formatJalaliDayMonth(active.day)}</p>
            {active.remaining === null ? <p className="text-slate-500">هنوز نرسیده</p> : <>
              <Row tone="blue" label="باقی‌مانده" value={num(active.remaining)} />
              <Row tone="orange" label="کل کار" value={num(active.scope)} />
            </>}
            <Row tone="gray" label="ایده‌آل" value={num(active.ideal)} />
          </Tooltip>
        )}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">نمایش جدول داده‌ها</summary>
        <div className="mt-2 max-h-60 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-start">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500"><tr><th className="p-2 text-start">روز</th><th className="p-2 text-start">باقی‌مانده</th><th className="p-2 text-start">کل کار</th><th className="p-2 text-start">ایده‌آل</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
              {days.map(day => <tr key={day.day}><td className="p-2">{formatJalaliDayMonth(day.day)}</td><td className="p-2 tabular-nums">{day.remaining === null ? '—' : num(day.remaining)}</td><td className="p-2 tabular-nums">{day.scope === null ? '—' : num(day.scope)}</td><td className="p-2 tabular-nums">{num(day.ideal)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
};

const roundedBar = (x: number, y: number, width: number, height: number) => {
  const r = Math.min(4, width / 2, height);
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
};

export const VelocityChart: React.FC<{ sprints: { id: string; name: string; committed: number; completed: number }[]; average: number }> = ({ sprints, average }) => {
  const [hover, setHover] = useState<number | null>(null);
  const [box, W] = useWidth();
  const H = 230, M = { top: 22, right: 16, bottom: 32, left: 38 };
  const n = sprints.length;
  const max = niceMax(Math.max(1, average, ...sprints.flatMap(row => [row.committed, row.completed])));
  const band = (W - M.left - M.right) / Math.max(1, n);
  const barWidth = Math.max(8, Math.min(28, (band - 18) / 2));
  const center = (index: number) => M.left + band * index + band / 2;
  const y = (value: number) => M.top + (1 - value / max) * (H - M.top - M.bottom);
  const base = H - M.bottom;
  const active = hover !== null ? sprints[hover] : null;
  const latest = n - 1;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <LegendItem swatch="bar" tone="orange" label="تعهد" />
        <LegendItem swatch="bar" tone="blue" label="انجام‌شده" />
        {average > 0 && <LegendItem swatch="dash" tone="gray" label="میانگین سه اسپرینت اخیر" />}
      </div>
      <div ref={box} className="relative" dir="ltr" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible" role="img" aria-label={`نمودار سرعت تیم در ${num(n)} اسپرینت؛ میانگین ${num(average)} امتیاز`}>
          {[0, 0.25, 0.5, 0.75, 1].map(fraction => {
            const value = Math.round(max * fraction * 100) / 100;
            return (
              <g key={fraction}>
                <line x1={M.left} x2={W - M.right} y1={y(value)} y2={y(value)} className={GRID} strokeWidth={1} />
                <text x={M.left - 8} y={y(value)} dy="0.35em" textAnchor="end" className={AXIS_TEXT}>{tick(value)}</text>
              </g>
            );
          })}
          {sprints.map((row, index) => {
            const committedHeight = base - y(row.committed), completedHeight = base - y(row.completed);
            const cx = center(index);
            return (
              <g key={row.id} onMouseEnter={() => setHover(index)}>
                <rect x={cx - band / 2} y={M.top} width={band} height={base - M.top} fill="transparent" className={hover === index ? 'fill-slate-100/70 dark:fill-slate-800/40' : ''} />
                {committedHeight > 0 && <path d={roundedBar(cx - barWidth - 1, y(row.committed), barWidth, committedHeight)} className={ORANGE_FILL} />}
                {completedHeight > 0 && <path d={roundedBar(cx + 1, y(row.completed), barWidth, completedHeight)} className={BLUE_FILL} />}
                {index === latest && <>
                  <text x={cx - barWidth / 2 - 1} y={y(row.committed) - 6} textAnchor="middle" className="fill-slate-600 dark:fill-slate-300 text-[10px] font-bold">{num(row.committed)}</text>
                  <text x={cx + barWidth / 2 + 1} y={y(row.completed) - 6} textAnchor="middle" className="fill-slate-600 dark:fill-slate-300 text-[10px] font-bold">{num(row.completed)}</text>
                </>}
                <text x={cx} y={H - 10} textAnchor="middle" className={AXIS_TEXT}>{row.name.length > Math.max(4, Math.floor(band / 7)) ? row.name.slice(0, Math.max(3, Math.floor(band / 7) - 1)) + '…' : row.name}</text>
              </g>
            );
          })}
          <line x1={M.left} x2={W - M.right} y1={base} y2={base} className="stroke-slate-300 dark:stroke-slate-700" strokeWidth={1} />
          {average > 0 && <line x1={M.left} x2={W - M.right} y1={y(average)} y2={y(average)} className={REFERENCE} strokeWidth={1.5} strokeDasharray="5 5" pointerEvents="none" />}
        </svg>
        {active && (
          <Tooltip left={(center(hover!) / W) * 100}>
            <p className="font-bold text-slate-800 dark:text-slate-100">{active.name}</p>
            <Row tone="orange" label="تعهد" value={num(active.committed)} />
            <Row tone="blue" label="انجام‌شده" value={num(active.completed)} />
            {active.committed > 0 && <Row label="تحقق تعهد" value={`${num(Math.round(100 * active.completed / active.committed))}٪`} />}
          </Tooltip>
        )}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">نمایش جدول داده‌ها</summary>
        <div className="mt-2 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-start">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500"><tr><th className="p-2 text-start">اسپرینت</th><th className="p-2 text-start">تعهد</th><th className="p-2 text-start">انجام‌شده</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
              {sprints.map(row => <tr key={row.id}><td className="p-2">{row.name}</td><td className="p-2 tabular-nums">{num(row.committed)}</td><td className="p-2 tabular-nums">{num(row.completed)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
};
