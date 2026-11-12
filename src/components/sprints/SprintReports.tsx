import React, { useState } from 'react';
import { BarChart3, CheckCircle2, CircleDashed, Gauge, PlusCircle, Target, TrendingDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { CustomSelect } from '../common/CustomSelect';
import { TaskKey } from '../common/TaskKey';
import { EmptyHint, Panel, Segmented, StatTile, num } from '../ui/dashboard-kit';
import { useSprintReport, type ReportItem, type SprintOverview } from '../../hooks/useSprints';
import { BurndownChart, VelocityChart } from './SprintCharts';
import { StatusPill, sprintDates } from './parts';

/** Burndown and summary for the running or a finished sprint, and the team's velocity across sprints. */
export const SprintReports: React.FC<{ data: SprintOverview; selected: string | null; onSelect: (id: string) => void; onOpen: (id: string) => void }> = ({ data, selected, onSelect, onOpen }) => {
  const options = [...data.sprints.filter(sprint => sprint.state === 'active'), ...data.closed];
  const current = selected && options.some(sprint => sprint.id === selected) ? selected : options[0]?.id || null;
  const sprint = options.find(row => row.id === current) || null;
  const { report, error } = useSprintReport(current);
  const [list, setList] = useState<'incomplete' | 'completed'>('incomplete');

  if (!sprint) return (
    <EmptyHint icon={BarChart3} title="هنوز اسپرینتی شروع نشده است." text="گزارش‌ها از اولین اسپرینتی که شروع کنید ساخته می‌شوند."
      className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d121f]" />
  );
  const summary = report?.summary;
  const tasksOnly = report?.burndown?.unit === 'tasks';
  const tile = (points: number, tasks: number) => tasksOnly ? `${num(tasks)} وظیفه` : `${num(points)} امتیاز`;
  const items = summary ? (list === 'completed' ? summary.completed : summary.incomplete) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          <CustomSelect options={options.map(row => ({ value: row.id, label: row.state === 'active' ? `${row.name} (در جریان)` : row.name }))} value={current || ''} onChange={onSelect} buttonClassName="text-xs font-bold py-2" />
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">{sprintDates(sprint)}</span>
        {sprint.goal && <span className="text-xs text-slate-600 dark:text-slate-300 inline-flex items-center gap-1"><Target size={13} className="text-slate-400" aria-hidden="true" />{sprint.goal}</span>}
      </div>

      {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile tone="blue" icon={Target} label="تعهد هنگام شروع" value={summary ? tile(summary.committedPoints, summary.committedTasks) : '—'} hint={summary && !tasksOnly ? `${num(summary.committedTasks)} وظیفه` : undefined} />
        <StatTile tone="amber" icon={PlusCircle} label="افزوده پس از شروع" value={summary ? tile(summary.addedPoints, summary.addedTasks) : '—'} hint={summary ? `${num(summary.removedTasks)} وظیفه خارج شد` : undefined} />
        <StatTile tone="emerald" icon={CheckCircle2} label="انجام‌شده" value={summary ? tile(summary.completedPoints, summary.completedTasks) : '—'} hint={summary && !tasksOnly ? `${num(summary.completedTasks)} وظیفه` : undefined} />
        <StatTile tone="slate" icon={CircleDashed} label={sprint.state === 'closed' ? 'باز مانده' : 'باقی‌مانده'} value={summary ? tile(summary.remainingPoints, summary.remainingTasks) : '—'} hint={summary && !tasksOnly ? `${num(summary.remainingTasks)} وظیفه` : undefined} />
      </div>

      <Panel title="نمودار burndown" icon={TrendingDown}
        description={tasksOnly ? 'وظایف این اسپرینت تخمین امتیاز ندارند، پس نمودار تعداد وظایف باز را نشان می‌دهد.' : 'امتیاز کار باقی‌مانده در هر روز، در برابر مسیر ایده‌آل تا پایان اسپرینت. خط نارنجی نشان می‌دهد کار اسپرینت چطور کم و زیاد شد.'}>
        {!report ? <div className="h-64 rounded-xl bg-slate-50 dark:bg-slate-900 animate-pulse" aria-busy="true" />
          : report.burndown ? <BurndownChart data={report.burndown} /> : <EmptyHint icon={TrendingDown} title="بازهٔ اسپرینت مشخص نیست." />}
      </Panel>

      <div className="grid lg:grid-cols-2 gap-5">
        <Panel title="سرعت تیم" icon={Gauge} description={data.velocity.sprints.length ? `میانگین سه اسپرینت اخیر: ${num(data.velocity.average)} امتیاز؛ مبنای خوبی برای برنامه‌ریزی اسپرینت بعدی.` : undefined}>
          {data.velocity.sprints.length ? <VelocityChart sprints={data.velocity.sprints} average={data.velocity.average} />
            : <EmptyHint icon={Gauge} title="هنوز اسپرینتی بسته نشده است." text="سرعت تیم پس از بستن اولین اسپرینت محاسبه می‌شود." />}
        </Panel>
        <Panel title="کارهای اسپرینت" icon={BarChart3} bodyClassName="pt-3"
          action={<Segmented label="فهرست کارها" value={list} onChange={setList} options={[{ value: 'incomplete', label: 'باز', count: summary?.incomplete.length }, { value: 'completed', label: 'انجام‌شده', count: summary?.completed.length }]} />}>
          {!summary ? <div className="h-40 rounded-xl bg-slate-50 dark:bg-slate-900 animate-pulse" aria-busy="true" />
            : items.length === 0 ? <EmptyHint icon={list === 'completed' ? CheckCircle2 : CircleDashed} title={list === 'completed' ? 'هنوز کاری انجام نشده است.' : 'کار بازی نمانده است.'} />
            : <ul className="divide-y divide-slate-100 dark:divide-slate-800/70 max-h-96 overflow-y-auto">{items.map(item => <ReportRow key={item.id} item={item} onOpen={onOpen} />)}</ul>}
        </Panel>
      </div>
    </div>
  );
};

const ReportRow: React.FC<{ item: ReportItem; onOpen: (id: string) => void }> = ({ item, onOpen }) => (
  <li className="flex items-center gap-3 py-2.5">
    <TaskKey value={item.key} />
    <button type="button" onClick={() => onOpen(item.id)} className="min-w-0 flex-1 text-start text-[13px] font-semibold text-slate-800 dark:text-slate-100 hover:text-blue-600 truncate cursor-pointer">{item.title}</button>
    {item.added && <span title="پس از شروع اسپرینت اضافه شد" className="h-5 px-1.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 text-[10px] font-bold inline-flex items-center shrink-0">افزوده</span>}
    <StatusPill status={item.status} />
    <span className={cn('min-w-7 h-6 px-1.5 rounded-md text-[11px] font-bold inline-flex items-center justify-center tabular-nums shrink-0', item.storyPoints === null ? 'text-slate-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')}>{item.storyPoints === null ? '–' : num(item.storyPoints)}</span>
  </li>
);
