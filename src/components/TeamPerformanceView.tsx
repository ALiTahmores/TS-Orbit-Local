import React, { useMemo, useState } from 'react';
import { Award, BarChart2, CheckCircle2, Clock, Gauge, Timer } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { completedAt } from '../lib/taskAnalytics';
import { STATUS_LABELS, statusKey } from '../lib/taskLabels';
import { isEnglish } from '../lib/locale';
import { useInsights } from '../hooks/useInsights';
import { ActivityHeatmap } from './common/ActivityHeatmap';
import { cn } from '../lib/utils';
import { Avatar, EmptyHint, PageHeader, Panel, Segmented, StatTile, num, percent } from './ui/dashboard-kit';

interface MemberInsight { id: string; name: string; role: string; online: boolean; open: number; overdue: number; completedInRange: number; completedPrevRange: number; onTimeRate: number | null; hoursInRange: number; utilization: number }
interface TeamInsights { range: number; totals: { members: number; completedInRange: number; hoursInRange: number }; members: MemberInsight[] }

/** Delivery by member over a chosen period, compared with the period before it. */
export const TeamPerformanceView: React.FC = () => {
  const { tasks = [], getRoleLabel } = useProject();
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const { data } = useInsights<TeamInsights>('team', Number(range));
  const members = data?.members || [];
  const label = { '7': 'هفت روز', '30': 'سی روز', '90': 'نود روز' }[range];

  const previous = members.reduce((sum, row) => sum + row.completedPrevRange, 0);
  const judged = members.filter(row => row.onTimeRate !== null && row.completedInRange > 0);
  const onTime = judged.length ? Math.round(judged.reduce((sum, row) => sum + (row.onTimeRate || 0) * row.completedInRange, 0) / judged.reduce((sum, row) => sum + row.completedInRange, 0)) : null;
  const utilization = members.length ? Math.round(members.reduce((sum, row) => sum + row.utilization, 0) / members.length) : 0;
  const ranked = useMemo(() => [...members].sort((a, b) => b.completedInRange - a.completedInRange || (b.onTimeRate ?? -1) - (a.onTimeRate ?? -1)), [members]);
  const peak = Math.max(1, ...members.map(row => Math.max(row.completedInRange, row.completedPrevRange)));

  const open = tasks.filter(task => !['completed', 'cancelled'].includes(statusKey(task.status)));
  const statusRows = (['pending', 'inprogress', 'review', 'blocked'] as const).map(key => ({ key, label: STATUS_LABELS[key][isEnglish() ? 'en' : 'fa'], count: open.filter(task => statusKey(task.status) === key).length }));
  const maxStatus = Math.max(1, ...statusRows.map(row => row.count));
  const completionDates = useMemo(() => tasks.map(completedAt).filter((at): at is Date => !!at), [tasks]);

  return (
    <div className="w-full space-y-6 text-start">
      <PageHeader title="عملکرد تیم" description={`کارهای تحویل‌شده در ${label} اخیر، در مقایسه با ${label} پیش از آن.`}
        actions={<Segmented label="بازهٔ زمانی" value={range} onChange={setRange} options={[{ value: '7', label: '۷ روز' }, { value: '30', label: '۳۰ روز' }, { value: '90', label: '۹۰ روز' }]} />} />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile tone="emerald" icon={CheckCircle2} label="کارهای تحویل‌شده" value={data ? num(data.totals.completedInRange) : '…'} delta={data ? { current: data.totals.completedInRange, previous } : null} hint={data ? `دورهٔ قبل ${num(previous)}` : undefined} />
        <StatTile tone="blue" icon={Clock} label="تحویل به‌موقع" value={percent(onTime)} hint="از کارهای سررسیددار تحویل‌شده" />
        <StatTile tone="violet" icon={Timer} label="ساعت کار ثبت‌شده" value={data ? num(data.totals.hoursInRange, 1) : '…'} hint={`در ${label} اخیر`} />
        <StatTile tone="slate" icon={Gauge} label="میانگین بهره‌وری" value={percent(utilization)} hint="ساعت ثبت‌شده نسبت به ظرفیت ۴۰ ساعت در هفته" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        <Panel title="تحویل هر عضو" description={`${label} اخیر در برابر دورهٔ قبل.`} icon={BarChart2} className="col-span-12 xl:col-span-7" bodyClassName="pt-4"
          action={<span className="flex items-center gap-3 text-[10px] font-bold text-slate-500"><span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />این دوره</span><span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" />دورهٔ قبل</span></span>}>
          {!members.length ? <EmptyHint title="عضوی برای نمایش نیست." /> : (
            <ul className="space-y-3.5">
              {ranked.map(row => (
                <li key={row.id} className="grid grid-cols-[7rem_minmax(0,1fr)_2.5rem] items-center gap-3">
                  <span className="flex items-center gap-2 min-w-0"><Avatar name={row.name} size={26} /><span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{row.name}</span></span>
                  <span className="space-y-1">
                    <span className="block h-2.5 rounded-full bg-blue-600" style={{ width: `${Math.max(2, row.completedInRange / peak * 100)}%` }} />
                    <span className="block h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" style={{ width: `${Math.max(2, row.completedPrevRange / peak * 100)}%` }} />
                  </span>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100 tabular-nums text-end">{num(row.completedInRange)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="col-span-12 xl:col-span-5 grid gap-6">
          <Panel title="کارهای باز بر اساس وضعیت" icon={BarChart2} bodyClassName="pt-3 space-y-3">
            {statusRows.map(row => (
              <div key={row.key} className="space-y-1">
                <div className="flex justify-between text-xs"><span className="text-slate-600 dark:text-slate-300">{row.label}</span><span className={cn('font-bold tabular-nums', row.key === 'blocked' && row.count ? 'text-rose-600' : 'text-slate-700 dark:text-slate-200')}>{num(row.count)}</span></div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className={cn('h-full rounded-full', row.key === 'blocked' ? 'bg-rose-500' : 'bg-blue-600')} style={{ width: `${row.count / maxStatus * 100}%` }} /></div>
              </div>
            ))}
          </Panel>
          <ActivityHeatmap dates={completionDates} title="نقشهٔ تکمیل وظایف" subtitle="چهار هفتهٔ اخیر، هر خانه یک روز" describe={count => `${num(count)} وظیفه تکمیل شد`} />
        </div>
      </div>

      <Panel title="رتبه‌بندی تحویل" description="بر اساس تعداد کار تحویل‌شده و سپس به‌موقع بودن." icon={Award} bodyClassName="pt-2 px-0 pb-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead><tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-[11px]">
              {['#', 'عضو', 'تحویل‌شده', 'به‌موقع', 'باز', 'عقب‌افتاده', 'ساعت کار', 'بهره‌وری'].map(head => <th key={head} scope="col" className="px-5 h-10 text-start font-bold">{head}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {ranked.map((row, index) => (
                <tr key={row.id}>
                  <td className="px-5 py-3 font-black text-slate-400 tabular-nums">{num(index + 1)}</td>
                  <td className="px-5 py-3"><span className="flex items-center gap-2.5"><Avatar name={row.name} size={30} online={row.online} /><span><span className="block font-bold text-slate-800 dark:text-slate-100">{row.name}</span><span className="block text-[10px] text-slate-500">{getRoleLabel(row.role)}</span></span></span></td>
                  <td className="px-5 py-3 font-black text-slate-800 dark:text-slate-100 tabular-nums">{num(row.completedInRange)}</td>
                  <td className="px-5 py-3 tabular-nums">{percent(row.onTimeRate)}</td>
                  <td className="px-5 py-3 tabular-nums">{num(row.open)}</td>
                  <td className={cn('px-5 py-3 tabular-nums', row.overdue ? 'text-rose-600 font-bold' : '')}>{num(row.overdue)}</td>
                  <td className="px-5 py-3 tabular-nums">{num(row.hoursInRange, 1)}</td>
                  <td className="px-5 py-3"><span className="flex items-center gap-2"><span className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><span className={cn('block h-full rounded-full', row.utilization > 100 ? 'bg-rose-500' : 'bg-blue-600')} style={{ width: `${Math.min(100, row.utilization)}%` }} /></span><span className="tabular-nums text-slate-500">{percent(row.utilization)}</span></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};

export const TeamEfficiencySubView = TeamPerformanceView;
export default TeamPerformanceView;
