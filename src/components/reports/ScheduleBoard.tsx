import React, { useMemo, useState } from 'react';
import { CalendarDays, CalendarX2, X } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { CustomSelect } from '../common/CustomSelect';
import { assignedIds, persianDateParts } from '../../lib/domain';
import { dueDate, todayISO } from '../../lib/taskAnalytics';
import { jalaliMonthName, jalaliWeekdaysShort, formatJalaliDate } from '../../lib/dates';
import { statusKey, statusLabel } from '../../lib/taskLabels';
import { isEnglish } from '../../lib/locale';
import { cn } from '../../lib/utils';
import { AvatarStack, EmptyHint, Panel, Segmented, num } from '../ui/dashboard-kit';

const DAY = 86_400_000;
const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T12:00:00`) + days * DAY).toISOString().slice(0, 10);
const diff = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / DAY);
const parts = (iso: string) => persianDateParts(new Date(`${iso}T12:00:00`));
const weekday = (iso: string) => jalaliWeekdaysShort()[(new Date(`${iso}T12:00:00`).getDay() + 1) % 7];

const statusTone: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', inprogress: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  review: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300', blocked: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300', cancelled: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

type Group = 'overdue' | 'today' | 'week' | 'next' | 'later' | 'none';
const groups: { key: Group; title: string }[] = [
  { key: 'overdue', title: 'عقب‌افتاده' }, { key: 'today', title: 'امروز' }, { key: 'week', title: 'شش روز آینده' },
  { key: 'next', title: 'هفتهٔ بعد' }, { key: 'later', title: 'بعدتر' }, { key: 'none', title: 'بدون سررسید' },
];

/** Every task placed on the calendar, with the next two weeks' load at a glance. */
export const ScheduleBoard: React.FC = () => {
  const { tasks, projects, teamMembers, currentUser, setActiveTab, setActiveSubTab } = useProject();
  const [projectId, setProjectId] = useState('all');
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [showDone, setShowDone] = useState(false);
  const [day, setDay] = useState('');
  const today = todayISO();
  const names = useMemo(() => new Map<string, string>((teamMembers || []).map(member => [member.id, member.name])), [teamMembers]);
  const projectTitles = useMemo(() => new Map<string, string>(projects.map(project => [project.id, project.title])), [projects]);

  const visible = useMemo(() => tasks.filter(task => (projectId === 'all' || task.projectId === projectId)
    && (scope === 'all' || assignedIds(task).includes(currentUser?.id))
    && (showDone || !['completed', 'cancelled'].includes(statusKey(task.status)))), [tasks, projectId, scope, showDone, currentUser?.id]);

  // Open work due on each of the next fourteen days.
  const load = useMemo(() => Array.from({ length: 14 }, (_, index) => {
    const iso = addDays(today, index);
    return { iso, count: visible.filter(task => dueDate(task) === iso && !['completed', 'cancelled'].includes(statusKey(task.status))).length };
  }), [visible, today]);
  const peak = Math.max(1, ...load.map(row => row.count));

  const grouped = useMemo(() => {
    const result: Record<Group, typeof visible> = { overdue: [], today: [], week: [], next: [], later: [], none: [] };
    for (const task of visible) {
      const due = dueDate(task);
      if (day && due !== day) continue;
      const open = !['completed', 'cancelled'].includes(statusKey(task.status));
      const key: Group = !due ? 'none' : due < today ? (open ? 'overdue' : 'later') : due === today ? 'today' : diff(today, due) <= 6 ? 'week' : diff(today, due) <= 13 ? 'next' : 'later';
      result[key].push(task);
    }
    for (const key of Object.keys(result) as Group[]) result[key].sort((a, b) => (dueDate(a) || '9999').localeCompare(dueDate(b) || '9999'));
    return result;
  }, [visible, day, today]);
  const total = groups.reduce((sum, group) => sum + grouped[group.key].length, 0);

  return (
    <div className="space-y-6 text-start">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="کارهای نمایش‌داده‌شده" value={scope} onChange={setScope} options={[{ value: 'all', label: 'همهٔ کارها' }, { value: 'mine', label: 'کارهای من' }]} />
          <label className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" checked={showDone} onChange={event => setShowDone(event.target.checked)} className="accent-blue-600" />نمایش کارهای تمام‌شده
          </label>
        </div>
        <div className="w-full lg:w-64">
          <CustomSelect options={[{ value: 'all', label: 'همهٔ پروژه‌ها' }, ...projects.map(project => ({ value: project.id, label: project.title }))]} value={projectId} onChange={setProjectId} buttonClassName="text-xs font-bold py-2" />
        </div>
      </div>

      <Panel title="بار کاری دو هفتهٔ آینده" description="تعداد کارهای باز با سررسید هر روز؛ روی یک روز بزنید تا فقط کارهای همان روز را ببینید." icon={CalendarDays}
        action={day ? <button type="button" onClick={() => setDay('')} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"><X size={12} />{formatJalaliDate(day)}</button> : undefined}
        bodyClassName="pt-4">
        <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5 sm:gap-2">
          {load.map(row => {
            const date = parts(row.iso), selected = day === row.iso, isToday = row.iso === today;
            return (
              <button key={row.iso} type="button" onClick={() => setDay(selected ? '' : row.iso)} aria-pressed={selected} title={`${formatJalaliDate(row.iso)}: ${num(row.count)} کار`}
                className={cn('flex flex-col items-center gap-1.5 rounded-xl py-2 cursor-pointer transition-colors', selected ? 'bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-500/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60')}>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{weekday(row.iso)}</span>
                <span className="h-16 w-full flex items-end justify-center px-1.5">
                  <span className={cn('w-full max-w-6 rounded-md', row.count ? (isToday ? 'bg-blue-600' : 'bg-blue-300 dark:bg-blue-500/50') : 'bg-slate-100 dark:bg-slate-800')} style={{ height: `${row.count ? Math.max(14, row.count / peak * 100) : 8}%` }} />
                </span>
                <span className={cn('text-[11px] tabular-nums', isToday ? 'font-black text-blue-600 dark:text-blue-400' : 'font-bold text-slate-700 dark:text-slate-200')}>{num(date.day)}</span>
                <span className="text-[10px] text-slate-400 tabular-nums">{row.count ? num(row.count) : '·'}</span>
              </button>
            );
          })}
        </div>
      </Panel>

      {total === 0 ? (
        <Panel><EmptyHint icon={CalendarX2} title="کاری برای این نما نیست." text={day ? 'برای این روز کاری با سررسید ثبت نشده است.' : 'فیلترها را تغییر دهید یا برای وظایف سررسید بگذارید.'} /></Panel>
      ) : groups.filter(group => grouped[group.key].length).map(group => (
        <section key={group.key} aria-label={group.title} className="space-y-2">
          <h2 className="flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-200 px-1">
            <span className={cn('w-2 h-2 rounded-full', group.key === 'overdue' ? 'bg-rose-500' : group.key === 'today' ? 'bg-amber-500' : group.key === 'none' ? 'bg-slate-300' : 'bg-blue-500')} />
            {group.title}<span className="text-slate-400 font-bold tabular-nums">{num(grouped[group.key].length)}</span>
          </h2>
          <ul className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] divide-y divide-slate-100 dark:divide-slate-800/70">
            {grouped[group.key].map(task => {
              const due = dueDate(task), date = due ? parts(due) : null, key = statusKey(task.status);
              const people = assignedIds(task).map(id => ({ id, name: names.get(id) || '' })).filter(person => person.name);
              return (
                <li key={task.id}>
                  <button type="button" onClick={() => { setActiveTab('tasks'); setActiveSubTab('kanban_board'); }} className="w-full text-start px-4 py-3 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                    <span className={cn('w-12 shrink-0 rounded-xl py-1.5 text-center', group.key === 'overdue' ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-slate-50 dark:bg-slate-800/60')}>
                      <span className={cn('block text-sm font-black tabular-nums leading-5', group.key === 'overdue' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100')}>{date ? num(date.day) : '—'}</span>
                      <span className="block text-[9px] font-bold text-slate-500 dark:text-slate-400">{date ? jalaliMonthName(date.month) : ''}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-[13px] font-bold truncate', key === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100')}>{task.title}</span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">{projectTitles.get(task.projectId) || 'بدون پروژه'}{group.key === 'overdue' && due ? ` · ${num(diff(due, today))} روز تأخیر` : ''}</span>
                    </span>
                    <span className="hidden md:block w-28"><span className="block h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${key === 'completed' ? 100 : Math.max(0, Math.min(100, Number(task.progress) || 0))}%` }} /></span></span>
                    <span className="hidden sm:inline-flex"><AvatarStack people={people} size={24} max={3} /></span>
                    <span className={cn('shrink-0 h-6 px-2 rounded-md text-[10px] font-bold inline-flex items-center', statusTone[key] || statusTone.pending)}>{statusLabel(task.status, isEnglish() ? 'en' : 'fa')}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default ScheduleBoard;
