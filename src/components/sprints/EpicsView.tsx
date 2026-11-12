import React, { useMemo, useState } from 'react';
import { CalendarRange, ChevronDown, GanttChartSquare, LayoutList, Link2, Pencil, Plus, Search, Unlink, Zap } from 'lucide-react';
import { formatJalaliDayMonth, jalaliMonthLabel, jalaliMonthOf, localISODate } from '../../lib/dates';
import { cn } from '../../lib/utils';
import { SideSheet, sheetInput, sheetLabel } from '../common/SideSheet';
import { JalaliDateInput } from '../common/JalaliDateInput';
import { TaskKey } from '../common/TaskKey';
import { EPIC_COLORS, TaskTypeIcon, epicTone } from '../common/TaskType';
import { Avatar, EmptyHint, PrimaryButton, SecondaryButton, Segmented, num } from '../ui/dashboard-kit';
import { useEpics, type Epic } from '../../hooks/useEpics';
import { isClosedStatus, sprintCall, type SprintTask } from '../../hooks/useSprints';
import { StatusPill } from './parts';

const DAY = 86_400_000;
const dateRange = (epic: Epic) => epic.startDate && epic.dueDate ? `${formatJalaliDayMonth(epic.startDate)} تا ${formatJalaliDayMonth(epic.dueDate)}` : epic.dueDate ? `تا ${formatJalaliDayMonth(epic.dueDate)}` : epic.startDate ? `از ${formatJalaliDayMonth(epic.startDate)}` : '';

/** Share of linked work done, in progress and waiting — by story points when the work is estimated, otherwise by count. */
function split(children: SprintTask[]) {
  const byPoints = children.some(row => (row.storyPoints || 0) > 0);
  const weight = (row: SprintTask) => byPoints ? row.storyPoints || 0 : 1;
  const total = children.reduce((sum, row) => sum + weight(row), 0);
  const done = children.filter(row => isClosedStatus(row.status)).reduce((sum, row) => sum + weight(row), 0);
  const active = children.filter(row => ['inprogress', 'review'].includes(row.status)).reduce((sum, row) => sum + weight(row), 0);
  return { byPoints, total, done, active, waiting: Math.max(0, total - done - active) };
}

const ProgressSegments: React.FC<{ rows: SprintTask[]; className?: string }> = ({ rows, className }) => {
  const { total, done, active, waiting } = split(rows);
  const width = (value: number) => total ? `${(value / total) * 100}%` : '0%';
  return (
    <div className={cn('flex h-2 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 gap-px', className)} role="img"
      aria-label={`انجام‌شده ${num(done)}، در جریان ${num(active)}، در انتظار ${num(waiting)}`}>
      {done > 0 && <span className="bg-emerald-500 h-full" style={{ width: width(done) }} />}
      {active > 0 && <span className="bg-blue-500 h-full" style={{ width: width(active) }} />}
      {waiting > 0 && <span className="bg-slate-300 dark:bg-slate-600 h-full" style={{ width: width(waiting) }} />}
    </div>
  );
};

/** Epics of one project: progress cards or a timeline, with linking of loose work. */
export const EpicsView: React.FC<{ projectId: string; onOpen: (id: string) => void; onError: (failure: unknown) => void }> = ({ projectId, onOpen, onError }) => {
  const { data, error, reload, setData } = useEpics(projectId);
  const [mode, setMode] = useState<'list' | 'timeline'>('list');
  const [sheet, setSheet] = useState<{ kind: 'epic'; epic: Epic | null } | { kind: 'link'; epic: Epic } | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (error) return <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>;
  if (!data) return <div className="h-64 rounded-2xl bg-slate-50 dark:bg-slate-900 animate-pulse" aria-busy="true" />;

  const unlink = async (epic: Epic, row: SprintTask) => {
    try { setData(await sprintCall('/api/epics/link', 'PUT', { projectId, epicId: null, taskIds: [row.id] })); } catch (failure) { onError(failure); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="نمای اپیک‌ها" value={mode} onChange={setMode} options={[{ value: 'list', label: <><LayoutList size={14} />فهرست</> }, { value: 'timeline', label: <><GanttChartSquare size={14} />زمان‌بندی</> }]} />
        {data.unassigned.tasks > 0 && <p className="text-xs text-slate-500 dark:text-slate-400">{`${num(data.unassigned.tasks)} کار باز هنوز در هیچ اپیکی نیست.`}</p>}
        {data.canWrite && <PrimaryButton icon={Plus} onClick={() => setSheet({ kind: 'epic', epic: null })} className="ms-auto">اپیک تازه</PrimaryButton>}
      </div>

      {data.epics.length === 0 ? (
        <EmptyHint icon={Zap} title="این پروژه هنوز اپیکی ندارد." text="اپیک‌ها کارهای بزرگ را به استوری، وظیفه و باگ می‌شکنند و پیشرفت هر هدف را جدا نشان می‌دهند."
          action={data.canWrite ? <SecondaryButton icon={Plus} onClick={() => setSheet({ kind: 'epic', epic: null })}>ساخت اولین اپیک</SecondaryButton> : undefined}
          className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d121f]" />
      ) : mode === 'timeline' ? (
        <EpicTimeline epics={data.epics} onEdit={epic => data.canWrite ? setSheet({ kind: 'epic', epic }) : onOpen(epic.id)} />
      ) : (
        <div className="grid xl:grid-cols-2 gap-4">
          {data.epics.map(epic => {
            const parts = split(epic.children);
            const expanded = !!open[epic.id];
            return (
              <article key={epic.id} className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] overflow-hidden">
                <div className={cn('h-1', epicTone(epic.color).solid)} aria-hidden="true" />
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <TaskTypeIcon type="epic" size={20} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <TaskKey value={epic.key} />
                        <button type="button" onClick={() => onOpen(epic.id)} className="text-start text-sm font-black text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer">{epic.title}</button>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="inline-flex items-center gap-1"><CalendarRange size={12} aria-hidden="true" />{dateRange(epic) || 'بدون زمان‌بندی'}</span>
                        <StatusPill status={epic.status} />
                      </p>
                    </div>
                    {epic.owner && <span title={epic.owner.name}><Avatar name={epic.owner.name} size={26} /></span>}
                  </div>
                  {epic.description && <p className="text-xs leading-6 text-slate-600 dark:text-slate-300 line-clamp-2">{epic.description}</p>}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      <span>{epic.progress.tasks ? (parts.byPoints ? `${num(epic.progress.donePoints)} از ${num(epic.progress.points)} امتیاز` : `${num(epic.progress.done)} از ${num(epic.progress.tasks)} کار`) : 'هنوز کاری به این اپیک وصل نشده'}</span>
                      <span className="text-slate-800 dark:text-slate-100">{num(epic.progress.percent)}٪</span>
                    </div>
                    <ProgressSegments rows={epic.children} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(['story', 'task', 'bug'] as const).filter(type => epic.types[type] > 0).map(type => (
                      <span key={type} className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300"><TaskTypeIcon type={type} size={15} />{num(epic.types[type])}</span>
                    ))}
                    {epic.progress.blocked > 0 && <span className="text-[11px] font-bold text-rose-600">{`${num(epic.progress.blocked)} مسدود`}</span>}
                    <span className="ms-auto flex items-center gap-1">
                      {data.canWrite && <SecondaryButton icon={Link2} onClick={() => setSheet({ kind: 'link', epic })} className="h-8 px-2.5">افزودن کار</SecondaryButton>}
                      {data.canWrite && <button type="button" onClick={() => setSheet({ kind: 'epic', epic })} aria-label={`ویرایش ${epic.title}`} title="ویرایش اپیک"
                        className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><Pencil size={14} /></button>}
                    </span>
                  </div>
                  {epic.children.length > 0 && (
                    <div>
                      <button type="button" onClick={() => setOpen({ ...open, [epic.id]: !expanded })} aria-expanded={expanded}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer">
                        <ChevronDown size={14} className={cn('transition-transform', expanded && 'rotate-180')} />{`کارهای اپیک (${num(epic.children.length)})`}
                      </button>
                      {expanded && (
                        <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800/70">
                          {epic.children.map(row => (
                            <li key={row.id} className="flex items-center gap-2 py-2">
                              <TaskTypeIcon type={row.type} size={16} /><TaskKey value={row.key} />
                              <button type="button" onClick={() => onOpen(row.id)} className={cn('min-w-0 flex-1 text-start text-xs font-semibold text-slate-800 dark:text-slate-100 hover:text-blue-600 truncate cursor-pointer', isClosedStatus(row.status) && 'line-through text-slate-400')}>{row.title}</button>
                              <StatusPill status={row.status} />
                              {data.canWrite && <button type="button" onClick={() => void unlink(epic, row)} aria-label={`جدا کردن ${row.title} از اپیک`} title="جدا کردن از اپیک"
                                className="w-7 h-7 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"><Unlink size={13} /></button>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {sheet?.kind === 'epic' && <EpicSheet projectId={projectId} epic={sheet.epic} onClose={() => setSheet(null)} onSaved={async () => { setSheet(null); await reload(); }} />}
      {sheet?.kind === 'link' && <LinkSheet projectId={projectId} epic={sheet.epic} candidates={data.candidates} onClose={() => setSheet(null)} onSaved={value => { setData(value); setSheet(null); }} />}
    </div>
  );
};

/** Epics as bars across Persian months; time runs with the reading direction. */
const EpicTimeline: React.FC<{ epics: Epic[]; onEdit: (epic: Epic) => void }> = ({ epics, onEdit }) => {
  const today = localISODate();
  const scheduled = epics.filter(epic => epic.startDate || epic.dueDate);
  const unscheduled = epics.filter(epic => !epic.startDate && !epic.dueDate);
  const { from, days, months } = useMemo(() => {
    const stamps = scheduled.flatMap(epic => [epic.startDate, epic.dueDate].filter(Boolean)).map(iso => Date.parse(iso + 'T00:00:00Z'));
    const start = Math.min(Date.parse(today + 'T00:00:00Z'), ...stamps) - 7 * DAY, end = Math.max(Date.parse(today + 'T00:00:00Z'), ...stamps) + 7 * DAY;
    const count = Math.min(1100, Math.round((end - start) / DAY) + 1);
    const result: Array<{ index: number; label: string }> = [];
    let previous = '';
    for (let index = 0; index < count; index++) {
      const month = jalaliMonthOf(new Date(start + index * DAY).toISOString().slice(0, 10));
      const key = `${month.year}-${month.month}`;
      if (key !== previous) { result.push({ index, label: jalaliMonthLabel(month) }); previous = key; }
    }
    return { from: start, days: count, months: result };
  }, [scheduled, today]);
  const position = (iso: string) => Math.max(0, Math.min(100, ((Date.parse(iso + 'T00:00:00Z') - from) / DAY) / days * 100));
  const todayAt = position(today);

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] p-4 space-y-4">
      {scheduled.length > 0 && (
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="flex">
              <div className="w-52 shrink-0" />
              <div className="relative flex-1 h-8 border-b border-slate-200 dark:border-slate-800">
                {months.map(month => (
                  <span key={month.index} className="absolute top-0 h-full border-s border-slate-200 dark:border-slate-800 ps-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap"
                    style={{ insetInlineStart: `${(month.index / days) * 100}%` }}>{month.label}</span>
                ))}
              </div>
            </div>
            {scheduled.map(epic => {
              const start = epic.startDate || epic.dueDate, end = epic.dueDate || epic.startDate;
              const at = position(start), width = Math.max(1.2, position(end) - at + 100 / days);
              const tone = epicTone(epic.color);
              const late = !!epic.dueDate && epic.dueDate < today && epic.progress.percent < 100;
              return (
                <div key={epic.id} className="flex items-center border-b border-slate-100 dark:border-slate-800/60 last:border-b-0">
                  <div className="w-52 shrink-0 py-2.5 pe-3 flex items-center gap-2 min-w-0">
                    <span className={cn('w-2.5 h-2.5 rounded-sm shrink-0', tone.swatch)} aria-hidden="true" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" title={epic.title}>{epic.title}</span>
                  </div>
                  <div className="relative flex-1 h-11">
                    {months.map(month => <span key={month.index} className="absolute inset-y-0 border-s border-slate-100 dark:border-slate-800/60" style={{ insetInlineStart: `${(month.index / days) * 100}%` }} aria-hidden="true" />)}
                    <span className="absolute inset-y-0 w-px bg-rose-400" style={{ insetInlineStart: `${todayAt}%` }} aria-hidden="true" />
                    <button type="button" onClick={() => onEdit(epic)} title={`${epic.title} · ${dateRange(epic)} · ${num(epic.progress.percent)}٪`}
                      className={cn('absolute top-2.5 h-6 rounded-md overflow-hidden cursor-pointer ring-offset-1 hover:ring-2 hover:ring-slate-300 dark:hover:ring-slate-600 text-start', tone.track, late && 'ring-2 ring-rose-400')}
                      style={{ insetInlineStart: `${at}%`, width: `${Math.min(width, 100 - at)}%` }}>
                      <span className={cn('absolute inset-y-0 start-0', tone.solid)} style={{ width: `${epic.progress.percent}%` }} aria-hidden="true" />
                      <span className="relative px-2 text-[10px] font-black leading-6 text-slate-900 dark:text-white whitespace-nowrap">{`${num(epic.progress.percent)}٪`}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-px bg-rose-400" aria-hidden="true" />امروز</span>
        <span>بخش پررنگ هر نوار، کار انجام‌شدهٔ اپیک است.</span>
      </p>
      {unscheduled.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-black text-slate-700 dark:text-slate-200">بدون زمان‌بندی</h3>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map(epic => (
              <button key={epic.id} type="button" onClick={() => onEdit(epic)} className="inline-flex items-center gap-2 h-8 px-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 cursor-pointer">
                <span className={cn('w-2.5 h-2.5 rounded-sm', epicTone(epic.color).swatch)} aria-hidden="true" />{epic.title}<CalendarRange size={13} className="text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** Creates an epic, or edits its name, description, colour and dates. */
const EpicSheet: React.FC<{ projectId: string; epic: Epic | null; onClose: () => void; onSaved: () => Promise<void> }> = ({ projectId, epic, onClose, onSaved }) => {
  const [title, setTitle] = useState(epic?.title || '');
  const [description, setDescription] = useState(epic?.description || '');
  const [color, setColor] = useState(epic?.color || 'violet');
  const [startDate, setStartDate] = useState(epic?.startDate || '');
  const [dueDate, setDueDate] = useState(epic?.dueDate || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (startDate && dueDate && dueDate < startDate) { setError('پایان اپیک باید پس از شروع آن باشد.'); return; }
    setSaving(true); setError('');
    try {
      const body = { title, description, epicColor: color, ...(epic ? { startDate, dueDate } : { ...(startDate ? { startDate } : {}), ...(dueDate ? { dueDate } : {}) }) };
      await sprintCall(epic ? `/api/tasks/${epic.id}` : '/api/tasks', epic ? 'PUT' : 'POST', epic ? body : { ...body, projectId, type: 'epic' });
      await onSaved();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'ذخیره انجام نشد.'); } finally { setSaving(false); }
  };
  const remove = async () => {
    if (!epic || !window.confirm(`اپیک «${epic.title}» حذف شود؟ کارهای آن حذف نمی‌شوند و فقط از اپیک جدا می‌شوند.`)) return;
    setSaving(true);
    try { await sprintCall(`/api/tasks/${epic.id}`, 'DELETE'); await onSaved(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'حذف انجام نشد.'); setSaving(false); }
  };
  return (
    <SideSheet title={epic ? `ویرایش ${epic.title}` : 'اپیک تازه'} description="اپیک یک هدف بزرگ است که با استوری‌ها، وظایف و باگ‌ها پیش می‌رود."
      submitLabel={epic ? 'ذخیرهٔ تغییرات' : 'ساخت اپیک'} saving={saving} error={error} onSubmit={submit} onClose={onClose}
      footerStart={epic ? <button type="button" onClick={() => void remove()} className="text-xs font-bold text-rose-600 hover:underline cursor-pointer">حذف اپیک</button> : undefined}>
      <label className="block space-y-1.5"><span className={sheetLabel}>نام اپیک</span><input value={title} onChange={event => setTitle(event.target.value)} className={sheetInput} required maxLength={500} placeholder="مثال: ورود و ثبت‌نام بدون رمز" /></label>
      <label className="block space-y-1.5"><span className={sheetLabel}>توضیح</span>
        <textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} maxLength={20000} placeholder="چه مسئله‌ای حل می‌شود و کی تمام است؟" className={cn(sheetInput, 'h-auto py-2.5 leading-6')} />
      </label>
      <fieldset className="space-y-2"><legend className={sheetLabel}>رنگ</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(EPIC_COLORS).map(([value, tone]) => (
            <button key={value} type="button" role="radio" aria-checked={color === value} aria-label={tone.label} title={tone.label} onClick={() => setColor(value)}
              className={cn('w-8 h-8 rounded-full cursor-pointer ring-offset-2 dark:ring-offset-slate-900', tone.swatch, color === value ? 'ring-2 ring-slate-900 dark:ring-white' : 'hover:ring-2 hover:ring-slate-300')} />
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><span className={sheetLabel}>شروع</span><JalaliDateInput value={startDate} onChange={setStartDate} ariaLabel="تاریخ شروع اپیک" /></div>
        <div className="space-y-1.5"><span className={sheetLabel}>پایان</span><JalaliDateInput value={dueDate} onChange={setDueDate} ariaLabel="تاریخ پایان اپیک" min={startDate || undefined} /></div>
      </div>
    </SideSheet>
  );
};

/** Picks open work without an epic and links it to this one. */
const LinkSheet: React.FC<{ projectId: string; epic: Epic; candidates: SprintTask[]; onClose: () => void; onSaved: (value: any) => void }> = ({ projectId, epic, candidates, onClose, onSaved }) => {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const text = query.trim().toLowerCase();
  const rows = candidates.filter(row => !text || row.title.toLowerCase().includes(text) || (row.key || '').toLowerCase().includes(text));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!picked.length) { setError('دست‌کم یک کار انتخاب کنید.'); return; }
    setSaving(true); setError('');
    try { onSaved(await sprintCall('/api/epics/link', 'PUT', { projectId, epicId: epic.id, taskIds: picked })); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'ذخیره انجام نشد.'); } finally { setSaving(false); }
  };
  return (
    <SideSheet title={`افزودن کار به ${epic.title}`} description="کارهای بازی که هنوز در هیچ اپیکی نیستند." submitLabel={picked.length ? `افزودن ${num(picked.length)} کار` : 'افزودن'}
      saving={saving} error={error} onSubmit={submit} onClose={onClose}>
      <label className="relative block">
        <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" aria-hidden="true" />
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="جستجو در عنوان یا کلید…" aria-label="جستجو در کارها" className={cn(sheetInput, 'ps-9')} />
      </label>
      {rows.length === 0 ? <p className="text-xs text-slate-500 text-center py-6">{candidates.length ? 'کاری با این جستجو پیدا نشد.' : 'همهٔ کارهای باز این پروژه در اپیک‌ها هستند.'}</p> : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 max-h-[55vh] overflow-y-auto">
          {rows.map(row => (
            <li key={row.id}>
              <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900">
                <input type="checkbox" className="accent-blue-600" checked={picked.includes(row.id)} onChange={() => setPicked(picked.includes(row.id) ? picked.filter(id => id !== row.id) : [...picked, row.id])} />
                <TaskTypeIcon type={row.type} size={16} /><TaskKey value={row.key} />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{row.title}</span>
                <StatusPill status={row.status} />
              </label>
            </li>
          ))}
        </ul>
      )}
    </SideSheet>
  );
};
