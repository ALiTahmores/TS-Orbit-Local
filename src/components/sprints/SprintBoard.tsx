import React, { useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Columns3, ListTodo, Target, UserRound } from 'lucide-react';
import { localISODate } from '../../lib/dates';
import { cn } from '../../lib/utils';
import { TaskKey } from '../common/TaskKey';
import { Avatar, EmptyHint, PrimaryButton, ProgressBar, SecondaryButton, num } from '../ui/dashboard-kit';
import { sprintCall, STATUS_LABEL, type Sprint, type SprintTask } from '../../hooks/useSprints';
import { PriorityFlag, sprintDates } from './parts';
import { EpicLozenge, TaskTypeIcon } from '../common/TaskType';

const COLUMNS: Array<{ status: string; title: string; accent: string }> = [
  { status: 'pending', title: 'در انتظار', accent: 'bg-slate-400' },
  { status: 'inprogress', title: 'در حال انجام', accent: 'bg-blue-500' },
  { status: 'blocked', title: 'مسدود', accent: 'bg-rose-500' },
  { status: 'review', title: 'در حال بررسی', accent: 'bg-violet-500' },
  { status: 'completed', title: 'انجام‌شده', accent: 'bg-emerald-500' },
];
const columnOf = (status: string) => status === 'cancelled' ? 'completed' : COLUMNS.some(column => column.status === status) ? status : 'pending';

interface Props {
  sprint: Sprint | null; rows: SprintTask[]; canWrite: boolean; canManage: boolean; epics?: Map<string, { title: string; color: string }>;
  onOpen: (id: string) => void; onComplete: () => void; onChanged: () => Promise<void>; onError: (failure: unknown) => void;
  onBacklog: () => void; onReport: () => void;
}

/** The running sprint as a board: one column per status, cards move by drag and drop or their status menu. */
export const SprintBoard: React.FC<Props> = ({ sprint, rows, canWrite, canManage, epics, onOpen, onComplete, onChanged, onError, onBacklog, onReport }) => {
  const [pending, setPending] = useState<Record<string, string>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const cards = useMemo(() => rows.map(row => pending[row.id] ? { ...row, status: pending[row.id] } : row), [rows, pending]);

  if (!sprint) return (
    <EmptyHint icon={Columns3} title="اسپرینت فعالی در جریان نیست." text="از بک‌لاگ، کارهای اسپرینت بعدی را انتخاب و آن را شروع کنید."
      action={<SecondaryButton icon={ListTodo} onClick={onBacklog}>رفتن به بک‌لاگ</SecondaryButton>}
      className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d121f]" />
  );

  const setStatus = async (id: string, status: string) => {
    const row = cards.find(item => item.id === id);
    if (!row || columnOf(row.status) === status) return;
    setPending(current => ({ ...current, [id]: status }));
    try { await sprintCall(`/api/tasks/${id}/status`, 'PUT', { status }); await onChanged(); }
    catch (failure) { onError(failure); }
    finally { setPending(current => { const next = { ...current }; delete next[id]; return next; }); }
  };

  const total = cards.reduce((sum, row) => sum + (row.storyPoints || 0), 0);
  const finished = cards.filter(row => columnOf(row.status) === 'completed');
  const donePoints = finished.reduce((sum, row) => sum + (row.storyPoints || 0), 0);
  const byPoints = total > 0;
  const progress = byPoints ? Math.round(100 * donePoints / total) : cards.length ? Math.round(100 * finished.length / cards.length) : 0;
  const daysLeft = sprint.endDate ? Math.round((Date.parse(sprint.endDate) - Date.parse(localISODate())) / 86_400_000) : null;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] p-5 flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-base font-black text-slate-900 dark:text-white flex flex-wrap items-center gap-2">{sprint.name}
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{sprintDates(sprint)}</span>
            {daysLeft !== null && <span className={cn('h-5 px-1.5 rounded text-[10px] font-bold inline-flex items-center', daysLeft < 0 ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : daysLeft <= 2 ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>
              {daysLeft < 0 ? `${num(-daysLeft)} روز از موعد گذشته` : daysLeft === 0 ? 'روز آخر' : `${num(daysLeft)} روز مانده`}
            </span>}
          </h2>
          {sprint.goal && <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5"><Target size={13} className="text-slate-400" aria-hidden="true" />{sprint.goal}</p>}
        </div>
        <div className="lg:w-72 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <span>{byPoints ? `${num(donePoints)} از ${num(total)} امتیاز` : `${num(finished.length)} از ${num(cards.length)} وظیفه`}</span><span>{num(progress)}٪</span>
          </div>
          <ProgressBar value={progress} tone="emerald" />
        </div>
        <div className="flex items-center gap-2">
          <SecondaryButton icon={BarChart3} onClick={onReport}>گزارش</SecondaryButton>
          {canManage && <PrimaryButton icon={CheckCircle2} onClick={onComplete}>پایان اسپرینت</PrimaryButton>}
        </div>
      </section>

      <div className="overflow-x-auto pb-2 -mx-1 px-1">
        <div className="grid grid-cols-5 gap-3 min-w-[860px]">
          {COLUMNS.map(column => {
            const list = cards.filter(row => columnOf(row.status) === column.status);
            const points = list.reduce((sum, row) => sum + (row.storyPoints || 0), 0);
            return (
              <section key={column.status} aria-label={column.title}
                onDragOver={event => { if (!dragId || !canWrite) return; event.preventDefault(); setOver(column.status); }}
                onDragLeave={() => setOver(current => current === column.status ? null : current)}
                onDrop={event => { event.preventDefault(); const id = dragId; setDragId(null); setOver(null); if (id) void setStatus(id, column.status); }}
                className={cn('rounded-2xl bg-slate-50 dark:bg-slate-900/50 p-2.5 min-h-64 flex flex-col gap-2 transition-colors', over === column.status && 'ring-2 ring-blue-400 bg-blue-50/50 dark:bg-blue-500/5')}>
                <header className="flex items-center gap-2 px-1.5 pt-1 pb-1.5">
                  <span className={cn('w-2 h-2 rounded-full', column.accent)} aria-hidden="true" />
                  <h3 className="text-xs font-black text-slate-700 dark:text-slate-200">{column.title}</h3>
                  <span className="text-[11px] font-bold text-slate-400">{num(list.length)}</span>
                  {points > 0 && <span className="ms-auto text-[10px] font-bold text-slate-400" title="مجموع امتیاز">{num(points)} امتیاز</span>}
                </header>
                {list.map(row => (
                  <article key={row.id} draggable={canWrite} onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', row.id); setDragId(row.id); }}
                    onDragEnd={() => { setDragId(null); setOver(null); }}
                    className={cn('rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111827] p-3 space-y-2.5 shadow-2xs hover:border-blue-300 dark:hover:border-blue-700 transition-colors', canWrite && 'cursor-grab', dragId === row.id && 'opacity-40', pending[row.id] && 'animate-pulse')}>
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => onOpen(row.id)} className="text-start text-[13px] font-semibold leading-6 text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer">{row.title}</button>
                      <PriorityFlag priority={row.priority} />
                    </div>
                    {row.epicId && epics?.get(row.epicId) && <EpicLozenge title={epics.get(row.epicId)!.title} color={epics.get(row.epicId)!.color} />}
                    <div className="flex items-center gap-2">
                      <TaskTypeIcon type={row.type} size={16} />
                      <TaskKey value={row.key} />
                      {row.status === 'cancelled' && <span className="text-[10px] font-bold text-slate-400">لغوشده</span>}
                      <span className="ms-auto flex items-center gap-1.5">
                        {row.storyPoints !== null && <span title="امتیاز تخمین" className="min-w-6 h-6 px-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 inline-flex items-center justify-center tabular-nums">{num(row.storyPoints)}</span>}
                        {row.assignees[0] ? <span title={row.assignees.map(person => person.name).join('، ')}><Avatar name={row.assignees[0].name} size={24} /></span>
                          : <span title="بدون مسئول" className="w-6 h-6 rounded-full border border-dashed border-slate-300 dark:border-slate-600 inline-flex items-center justify-center text-slate-400"><UserRound size={12} /></span>}
                      </span>
                    </div>
                    {canWrite && (
                      <select value={columnOf(row.status)} onChange={event => void setStatus(row.id, event.target.value)} aria-label={`وضعیت ${row.title}`}
                        className="w-full h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                        {COLUMNS.map(option => <option key={option.status} value={option.status}>{STATUS_LABEL[option.status] || option.title}</option>)}
                      </select>
                    )}
                  </article>
                ))}
                {list.length === 0 && <p className="text-center text-[11px] text-slate-400 py-6">{canWrite ? 'کارت را اینجا رها کنید' : 'خالی'}</p>}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};
