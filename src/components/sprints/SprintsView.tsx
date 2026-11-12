import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarRange, CheckCircle2, ChevronDown, Columns3, GripVertical, ListTodo, Pencil, Play, Plus, Rocket, Search, Target, Trash2, UserRound } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { localISODate } from '../../lib/dates';
import { cn } from '../../lib/utils';
import { CustomSelect } from '../common/CustomSelect';
import { SideSheet, sheetInput, sheetLabel } from '../common/SideSheet';
import { JalaliDateInput } from '../common/JalaliDateInput';
import { TaskKey } from '../common/TaskKey';
import { TaskDetailModal } from '../tasks/TaskDetailModal';
import { Avatar, EmptyHint, PageHeader, PrimaryButton, SecondaryButton, Segmented, num } from '../ui/dashboard-kit';
import { clockQuery, isClosedStatus, sprintCall, STATUS_GROUP, useSprints, type Sprint, type SprintOverview, type SprintTask } from '../../hooks/useSprints';
import { SprintBoard } from './SprintBoard';
import { SprintReports } from './SprintReports';
import { PriorityFlag, StatusPill, sprintDates, statusTone } from './parts';
import { EpicLozenge, TASK_TYPES, TaskTypeIcon, epicTone } from '../common/TaskType';
import { EpicsView } from './EpicsView';
import { Zap } from 'lucide-react';

type View = 'backlog' | 'board' | 'epics' | 'reports';
type EpicMap = Map<string, { title: string; color: string }>;
const READ_ONLY_ROLES = ['VIEWER', 'CLIENT', 'READ_ONLY', 'GUEST'];
const addDays = (iso: string, days: number) => new Date(Date.parse(iso + 'T00:00:00Z') + days * 86_400_000).toISOString().slice(0, 10);
const PointChips: React.FC<{ todo: number; progress: number; done: number }> = ({ todo, progress, done }) => (
  <span className="inline-flex items-center gap-1" aria-label={`امتیاز: ${num(todo)} در انتظار، ${num(progress)} در جریان، ${num(done)} انجام‌شده`}>
    <span title="امتیاز کارهای در انتظار" className={cn('min-w-7 h-6 px-1.5 rounded-md text-[11px] font-bold inline-flex items-center justify-center tabular-nums', statusTone.todo)}>{num(todo)}</span>
    <span title="امتیاز کارهای در جریان" className={cn('min-w-7 h-6 px-1.5 rounded-md text-[11px] font-bold inline-flex items-center justify-center tabular-nums', statusTone.progress)}>{num(progress)}</span>
    <span title="امتیاز کارهای انجام‌شده" className={cn('min-w-7 h-6 px-1.5 rounded-md text-[11px] font-bold inline-flex items-center justify-center tabular-nums', statusTone.done)}>{num(done)}</span>
  </span>
);
const pointsOf = (rows: SprintTask[], group?: 'todo' | 'progress' | 'done') => Math.round(rows.filter(row => !group || STATUS_GROUP[row.status] === group).reduce((total, row) => total + (row.storyPoints || 0), 0) * 100) / 100;

/** Scrum planning for one project: backlog and sprints, the running sprint's board and its reports. */
export const SprintsView: React.FC = () => {
  const { projects, selectedProject, tasks: allTasks, currentUser, userRole } = useProject();
  const [projectId, setProjectId] = useState('');
  useEffect(() => {
    if (projectId && projects.some(project => project.id === projectId)) return;
    setProjectId(selectedProject?.id && projects.some(project => project.id === selectedProject.id) ? selectedProject.id : projects[0]?.id || '');
  }, [projects, selectedProject, projectId]);
  const { data, error, reload, setData } = useSprints(projectId);
  const [view, setView] = useState<View>('backlog');
  const [query, setQuery] = useState('');
  const [mine, setMine] = useState(false);
  const [epicFilter, setEpicFilter] = useState<string>('all');
  useEffect(() => { setEpicFilter('all'); }, [projectId]);
  const epicMap: EpicMap = useMemo(() => new Map((data?.epics || []).map(epic => [epic.id, { title: epic.title, color: epic.color }])), [data]);
  const [detail, setDetail] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ kind: 'start' | 'edit' | 'complete'; sprint: Sprint } | null>(null);
  const [reportSprint, setReportSprint] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const canWrite = !READ_ONLY_ROLES.includes(String(userRole || '').toUpperCase());
  const active = data?.sprints.find(sprint => sprint.state === 'active') || null;
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (data?.tasks || []).filter(row => (!text || row.title.toLowerCase().includes(text) || (row.key || '').toLowerCase().includes(text)) && (!mine || row.assignees.some(person => person.id === currentUser?.id)));
  }, [data, query, mine, currentUser]);
  const planned = useMemo(() => epicFilter === 'all' ? visible : visible.filter(row => epicFilter === 'none' ? !row.epicId || !epicMap.has(row.epicId) : row.epicId === epicFilter), [visible, epicFilter, epicMap]);
  const detailTask = detail ? allTasks.find(task => task.id === detail) || null : null;
  const fail = (failure: unknown) => setNotice(failure instanceof Error ? failure.message : 'انجام نشد.');

  const createSprint = async () => {
    try { await sprintCall('/api/sprints', 'POST', { projectId }); await reload(); } catch (failure) { fail(failure); }
  };
  const removeSprint = async (sprint: Sprint) => {
    if (!window.confirm(`«${sprint.name}» حذف شود؟ وظایف آن به بک‌لاگ برمی‌گردند.`)) return;
    try { await sprintCall(`/api/sprints/${sprint.id}`, 'DELETE'); await reload(); } catch (failure) { fail(failure); }
  };

  if (!projects.length) return <EmptyHint icon={Rocket} title="هنوز پروژه‌ای نیست." text="برای برنامه‌ریزی اسپرینت، ابتدا یک پروژه بسازید." className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800" />;
  const daysLeft = active?.endDate ? Math.round((Date.parse(active.endDate) - Date.parse(localISODate())) / 86_400_000) : null;

  return (
    <div className="space-y-5 text-start">
      <PageHeader title="بک‌لاگ و اسپرینت‌ها"
        description={active ? `«${active.name}» در جریان است${daysLeft !== null ? (daysLeft >= 0 ? ` و ${num(daysLeft)} روز تا پایانش مانده` : ` و ${num(-daysLeft)} روز از پایانش گذشته`) : ''}.` : 'کارها را در اسپرینت‌های کوتاه برنامه‌ریزی کنید، با امتیاز تخمین بزنید و پیشرفت را روزبه‌روز ببینید.'}
        actions={<>
          <div className="w-56">
            <CustomSelect options={projects.map(project => ({ value: project.id, label: project.title }))} value={projectId} onChange={setProjectId} buttonClassName="text-xs font-bold py-2" />
          </div>
          {data?.canManage && view === 'backlog' && <PrimaryButton icon={Plus} onClick={() => void createSprint()}>اسپرینت تازه</PrimaryButton>}
        </>} />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <Segmented label="نمای اسپرینت" value={view} onChange={setView} options={[
          { value: 'backlog', label: <><ListTodo size={14} />بک‌لاگ</>, count: data ? data.tasks.filter(row => !row.sprintId).length : undefined },
          { value: 'board', label: <><Columns3 size={14} />اسپرینت فعال</> },
          { value: 'epics', label: <><Zap size={14} />اپیک‌ها</>, count: data ? data.epics.length : undefined },
          { value: 'reports', label: <><BarChart3 size={14} />گزارش‌ها</> },
        ]} />
        {(view === 'backlog' || view === 'board') && (
          <div className="flex items-center gap-2">
            <label className="relative flex-1 lg:w-72">
              <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" aria-hidden="true" />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="جستجو در عنوان یا کلید وظیفه…" aria-label="جستجو در وظایف"
                className={cn(sheetInput, 'ps-9')} />
            </label>
            <button type="button" aria-pressed={mine} onClick={() => setMine(!mine)}
              className={cn('h-10 px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors', mine ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800')}>
              <UserRound size={15} />فقط کارهای من
            </button>
          </div>
        )}
      </div>

      {(notice || error) && (
        <div role="alert" className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
          <span>{notice || error}</span>
          {notice && <button type="button" onClick={() => setNotice('')} className="font-bold underline cursor-pointer">بستن</button>}
        </div>
      )}

      {!data ? <PlannerSkeleton /> : view === 'backlog' ? (
        <BacklogPlanner data={data} rows={planned} projectId={projectId} canWrite={canWrite} filtered={!!query.trim() || mine || epicFilter !== 'all'}
          epicMap={epicMap} epicFilter={epicFilter} onEpicFilter={setEpicFilter}
          onOpen={setDetail} onChanged={setData} reload={reload} onError={fail}
          onStart={sprint => setSheet({ kind: 'start', sprint })} onEdit={sprint => setSheet({ kind: 'edit', sprint })}
          onComplete={sprint => setSheet({ kind: 'complete', sprint })} onDelete={sprint => void removeSprint(sprint)} />
      ) : view === 'epics' ? (
        <EpicsView projectId={projectId} onOpen={setDetail} onError={fail} />
      ) : view === 'board' ? (
        <SprintBoard sprint={active} epics={epicMap} rows={visible.filter(row => active && row.sprintId === active.id)} canWrite={canWrite} canManage={data.canManage}
          onOpen={setDetail} onComplete={() => active && setSheet({ kind: 'complete', sprint: active })} onChanged={reload} onError={fail}
          onBacklog={() => setView('backlog')} onReport={() => { setReportSprint(active?.id || null); setView('reports'); }} />
      ) : (
        <SprintReports data={data} selected={reportSprint} onSelect={setReportSprint} onOpen={setDetail} />
      )}

      {sheet && sheet.kind !== 'complete' && (
        <SprintSheet mode={sheet.kind} sprint={sheet.sprint} stats={sheet.sprint.stats} onClose={() => setSheet(null)}
          onSaved={async () => { setSheet(null); await reload(); if (sheet.kind === 'start') setView('board'); }} />
      )}
      {sheet?.kind === 'complete' && (
        <CompleteSheet sprint={sheet.sprint} futures={data?.sprints.filter(sprint => sprint.state === 'future') || []} onClose={() => setSheet(null)}
          onDone={async () => { const id = sheet.sprint.id; setSheet(null); await reload(); setReportSprint(id); setView('reports'); }} />
      )}
      {detailTask && <TaskDetailModal task={detailTask} isOpen onClose={() => setDetail(null)} />}
    </div>
  );
};

const PlannerSkeleton: React.FC = () => (
  <div className="space-y-4" aria-busy="true" aria-label="در حال بارگذاری">
    {[0, 1].map(index => (
      <div key={index} className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] p-5 space-y-3 animate-pulse">
        <div className="h-4 w-48 rounded bg-slate-100 dark:bg-slate-800" />
        {[0, 1, 2].map(row => <div key={row} className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900" />)}
      </div>
    ))}
  </div>
);

interface PlannerProps {
  data: SprintOverview; rows: SprintTask[]; projectId: string; canWrite: boolean; filtered: boolean;
  epicMap: EpicMap; epicFilter: string; onEpicFilter: (value: string) => void;
  onOpen: (id: string) => void; onChanged: (value: SprintOverview) => void; reload: () => Promise<void>; onError: (failure: unknown) => void;
  onStart: (sprint: Sprint) => void; onEdit: (sprint: Sprint) => void; onComplete: (sprint: Sprint) => void; onDelete: (sprint: Sprint) => void;
}

/** Sprints first (the running one on top), then the backlog; tasks move by drag and drop or the "move to" menu. */
const BacklogPlanner: React.FC<PlannerProps> = ({ data, rows, projectId, canWrite, filtered, epicMap, epicFilter, onEpicFilter, onOpen, onChanged, reload, onError, onStart, onEdit, onComplete, onDelete }) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const [target, setTarget] = useState<{ lane: string | null; before: string | null } | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const lanes: Array<{ id: string | null; sprint: Sprint | null }> = [...data.sprints.map(sprint => ({ id: sprint.id, sprint })), { id: null, sprint: null }];
  const hasActive = data.sprints.some(sprint => sprint.state === 'active');
  const firstFuture = data.sprints.find(sprint => sprint.state === 'future');

  const move = async (taskIds: string[], lane: string | null, before: string | null) => {
    // Show the new order at once; the server's answer replaces it.
    const moving = data.tasks.filter(row => taskIds.includes(row.id)).map(row => ({ ...row, sprintId: lane }));
    const rest = data.tasks.filter(row => !taskIds.includes(row.id));
    const at = before ? rest.findIndex(row => row.id === before) : -1;
    const insertAt = at >= 0 ? at : (() => { let last = -1; rest.forEach((row, index) => { if (row.sprintId === lane) last = index; }); return last + 1 || rest.length; })();
    onChanged({ ...data, tasks: [...rest.slice(0, insertAt), ...moving, ...rest.slice(insertAt)] });
    try { onChanged(await sprintCall<SprintOverview>('/api/backlog/move', 'PUT', { projectId, taskIds, sprintId: lane, ...(before ? { beforeTaskId: before } : {}) })); }
    catch (failure) { onError(failure); await reload(); }
  };
  const drop = (lane: string | null, before: string | null) => {
    const id = dragId;
    setDragId(null); setTarget(null);
    if (id && id !== before) void move([id], lane, before);
  };

  return (
    <div className="space-y-4">
      {data.epics.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1" role="group" aria-label="فیلتر اپیک">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 inline-flex items-center gap-1"><Zap size={13} aria-hidden="true" />اپیک:</span>
          {[{ id: 'all', title: 'همه' }, ...data.epics.map(epic => ({ id: epic.id, title: epic.title, color: epic.color })), { id: 'none', title: 'بدون اپیک' }].map(item => (
            <button key={item.id} type="button" aria-pressed={epicFilter === item.id} onClick={() => onEpicFilter(item.id)}
              className={cn('h-7 px-2.5 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors inline-flex items-center gap-1.5',
                epicFilter === item.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800')}>
              {'color' in item && <span className={cn('w-2 h-2 rounded-sm', epicTone(item.color as string).swatch)} aria-hidden="true" />}{item.title}
            </button>
          ))}
        </div>
      )}
      {lanes.map(({ id: laneId, sprint }) => {
        const laneRows = rows.filter(row => row.sprintId === laneId);
        const all = data.tasks.filter(row => row.sprintId === laneId);
        const key = laneId || 'backlog';
        const isCollapsed = !!collapsed[key];
        const over = !!dragId && target?.lane === laneId;
        return (
          <section key={key} aria-label={sprint ? sprint.name : 'بک‌لاگ'}
            className={cn('rounded-2xl border bg-white dark:bg-[#0d121f] transition-colors', over ? 'border-blue-400 dark:border-blue-500' : 'border-slate-200/80 dark:border-slate-800/80', sprint?.state === 'active' && !over && 'border-blue-200 dark:border-blue-900/60')}
            onDragOver={event => { if (!dragId) return; event.preventDefault(); if (target?.lane !== laneId || target.before) setTarget({ lane: laneId, before: null }); }}
            onDrop={event => { event.preventDefault(); drop(laneId, null); }}>
            <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 sm:px-5 py-3.5">
              <button type="button" onClick={() => setCollapsed({ ...collapsed, [key]: !isCollapsed })} aria-expanded={!isCollapsed} aria-label={isCollapsed ? 'باز کردن' : 'بستن'}
                className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <ChevronDown size={16} className={cn('transition-transform', isCollapsed && (document.dir === 'rtl' ? 'rotate-90' : '-rotate-90'))} />
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-black text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                  {sprint ? sprint.name : 'بک‌لاگ'}
                  {sprint?.state === 'active' && <span className="h-5 px-1.5 rounded bg-blue-600 text-white text-[10px] font-bold inline-flex items-center">فعال</span>}
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{sprint && sprintDates(sprint) ? `${sprintDates(sprint)} · ` : ''}{num(all.length)} وظیفه</span>
                </h2>
                {sprint?.goal && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1"><Target size={12} aria-hidden="true" />{sprint.goal}</p>}
              </div>
              <PointChips todo={pointsOf(all, 'todo')} progress={pointsOf(all, 'progress')} done={pointsOf(all, 'done')} />
              {sprint && data.canManage && <div className="flex items-center gap-1">
                {sprint.state === 'active' && <PrimaryButton icon={CheckCircle2} onClick={() => onComplete(sprint)} className="h-9">پایان اسپرینت</PrimaryButton>}
                {sprint.state === 'future' && sprint.id === firstFuture?.id && (
                  <SecondaryButton icon={Play} onClick={() => onStart(sprint)} disabled={hasActive || !all.length} className="h-9"
                    title={hasActive ? 'ابتدا اسپرینت فعال را ببندید.' : !all.length ? 'ابتدا وظیفه‌ای به این اسپرینت اضافه کنید.' : undefined}>شروع اسپرینت</SecondaryButton>
                )}
                <IconButton label={`ویرایش ${sprint.name}`} onClick={() => onEdit(sprint)}><Pencil size={15} /></IconButton>
                {sprint.state === 'future' && <IconButton label={`حذف ${sprint.name}`} onClick={() => onDelete(sprint)} danger><Trash2 size={15} /></IconButton>}
              </div>}
            </header>
            {!isCollapsed && (
              <div className="px-2 sm:px-3 pb-3">
                {laneRows.length === 0 ? (
                  <div className={cn('mx-2 rounded-xl border-2 border-dashed px-4 py-6 text-center text-xs text-slate-500 dark:text-slate-400', over ? 'border-blue-300 dark:border-blue-600' : 'border-slate-200 dark:border-slate-800')}>
                    {filtered && all.length ? 'هیچ وظیفه‌ای با این فیلتر نیست.' : sprint ? 'وظایف را از بک‌لاگ به اینجا بکشید یا از منوی «انتقال» استفاده کنید.' : 'بک‌لاگ خالی است؛ کار تازه‌ای اضافه کنید.'}
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {laneRows.map(row => (
                      <TaskRow key={row.id} row={row} epic={row.epicId ? epicMap.get(row.epicId) : undefined} onEpic={row.epicId ? () => onEpicFilter(row.epicId!) : undefined} lanes={lanes} canWrite={canWrite} dragging={dragId === row.id} indicator={!!dragId && target?.lane === laneId && target.before === row.id}
                        onOpen={onOpen} onMove={lane => void move([row.id], lane, null)} onError={onError}
                        onDragStart={() => setDragId(row.id)} onDragEnd={() => { setDragId(null); setTarget(null); }}
                        onDragOver={() => { if (dragId && (target?.lane !== laneId || target.before !== row.id)) setTarget({ lane: laneId, before: row.id }); }}
                        onDrop={() => drop(laneId, row.id)} />
                    ))}
                  </ul>
                )}
                {canWrite && <QuickCreate projectId={projectId} lane={laneId} epicId={epicFilter !== 'all' && epicFilter !== 'none' ? epicFilter : null} onCreated={async id => { if (laneId) await move([id], laneId, null); else await reload(); }} onError={onError} />}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

const IconButton: React.FC<{ label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }> = ({ label, onClick, danger, children }) => (
  <button type="button" onClick={onClick} aria-label={label} title={label}
    className={cn('w-9 h-9 rounded-lg inline-flex items-center justify-center cursor-pointer transition-colors', danger ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800')}>{children}</button>
);

const TaskRow: React.FC<{
  row: SprintTask; epic?: { title: string; color: string }; onEpic?: () => void; lanes: Array<{ id: string | null; sprint: Sprint | null }>; canWrite: boolean; dragging: boolean; indicator: boolean;
  onOpen: (id: string) => void; onMove: (lane: string | null) => void; onError: (failure: unknown) => void;
  onDragStart: () => void; onDragEnd: () => void; onDragOver: () => void; onDrop: () => void;
}> = ({ row, epic, onEpic, lanes, canWrite, dragging, indicator, onOpen, onMove, onError, onDragStart, onDragEnd, onDragOver, onDrop }) => {
  const [points, setPoints] = useState(row.storyPoints === null ? '' : String(row.storyPoints));
  useEffect(() => { setPoints(row.storyPoints === null ? '' : String(row.storyPoints)); }, [row.storyPoints]);
  const savePoints = async () => {
    const value = points.trim() === '' ? null : Number(points.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))));
    if (value === row.storyPoints || (value !== null && (!Number.isFinite(value) || value < 0 || value > 1000))) { setPoints(row.storyPoints === null ? '' : String(row.storyPoints)); return; }
    try { await sprintCall(`/api/tasks/${row.id}`, 'PUT', { storyPoints: value }); } catch (failure) { onError(failure); setPoints(row.storyPoints === null ? '' : String(row.storyPoints)); }
  };
  const person = row.assignees[0];
  return (
    <li draggable={canWrite} onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', row.id); onDragStart(); }} onDragEnd={onDragEnd}
      onDragOver={event => { event.preventDefault(); event.stopPropagation(); onDragOver(); }} onDrop={event => { event.preventDefault(); event.stopPropagation(); onDrop(); }}
      className={cn('relative flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1.5 px-2 py-2.5 rounded-lg group', dragging && 'opacity-40', canWrite && 'hover:bg-slate-50 dark:hover:bg-slate-900/60')}>
      {indicator && <span className="absolute inset-x-2 -top-px h-0.5 rounded bg-blue-500" aria-hidden="true" />}
      {canWrite && <GripVertical size={15} className="text-slate-300 dark:text-slate-600 cursor-grab shrink-0 hidden sm:block" aria-hidden="true" />}
      <TaskTypeIcon type={row.type} size={18} />
      <TaskKey value={row.key} />
      <button type="button" onClick={() => onOpen(row.id)} className={cn('min-w-0 flex-1 text-start text-[13px] font-semibold text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 truncate cursor-pointer', isClosedStatus(row.status) && 'line-through text-slate-400 dark:text-slate-500')}>{row.title}</button>
      <div className="flex items-center justify-end gap-2 shrink-0 ms-auto w-full sm:w-auto">
        {epic && <EpicLozenge title={epic.title} color={epic.color} onClick={onEpic} className="hidden md:inline-flex" />}
        <PriorityFlag priority={row.priority} />
        <StatusPill status={row.status} />
        {person ? <span title={row.assignees.map(item => item.name).join('، ')}><Avatar name={person.name} size={24} /></span>
          : <span title="بدون مسئول" className="w-6 h-6 rounded-full border border-dashed border-slate-300 dark:border-slate-600 inline-flex items-center justify-center text-slate-400"><UserRound size={12} /></span>}
        <input value={points} onChange={event => setPoints(event.target.value)} onBlur={() => void savePoints()} onKeyDown={event => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur(); }}
          disabled={!canWrite} inputMode="decimal" placeholder="–" aria-label={`امتیاز تخمین ${row.title}`} title="امتیاز تخمین (story point)"
          className="w-11 h-7 rounded-md bg-slate-100 dark:bg-slate-800 text-center text-[12px] font-bold text-slate-700 dark:text-slate-200 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70" />
        {canWrite && (
          <select value="" onChange={event => { if (event.target.value) onMove(event.target.value === '__backlog' ? null : event.target.value); }} aria-label={`انتقال ${row.title}`}
            className="h-7 w-20 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
            <option value="">انتقال…</option>
            {lanes.filter(lane => lane.id !== row.sprintId).map(lane => <option key={lane.id || 'backlog'} value={lane.id || '__backlog'}>{lane.sprint ? lane.sprint.name : 'بک‌لاگ'}</option>)}
          </select>
        )}
      </div>
    </li>
  );
};

const QuickCreate: React.FC<{ projectId: string; lane: string | null; epicId: string | null; onCreated: (id: string) => Promise<void>; onError: (failure: unknown) => void }> = ({ projectId, lane, epicId, onCreated, onError }) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'story' | 'task' | 'bug'>('story');
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    try { const task = await sprintCall<{ id: string }>('/api/tasks', 'POST', { projectId, title: title.trim(), type, ...(epicId ? { epicId } : {}) }); setTitle(''); await onCreated(task.id); }
    catch (failure) { onError(failure); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="mt-1 px-2">
      <label className="flex items-center gap-2 h-10 px-2 rounded-lg text-slate-400 focus-within:bg-slate-50 dark:focus-within:bg-slate-900/60 focus-within:text-slate-700">
        <Plus size={15} aria-hidden="true" />
        <TaskTypeIcon type={type} size={16} decorative />
        <select value={type} onChange={event => setType(event.target.value as typeof type)} aria-label="نوع کار تازه" disabled={busy}
          className="h-7 rounded-md bg-transparent text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500">
          {TASK_TYPES.filter(item => item.value !== 'epic').map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <input value={title} onChange={event => setTitle(event.target.value)} disabled={busy} maxLength={500}
          placeholder={lane ? 'افزودن وظیفهٔ تازه به این اسپرینت…' : 'افزودن وظیفهٔ تازه به بک‌لاگ…'} aria-label={lane ? 'وظیفهٔ تازه در اسپرینت' : 'وظیفهٔ تازه در بک‌لاگ'}
          className="flex-1 bg-transparent text-[13px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none" />
      </label>
    </form>
  );
};

/** Start a planned sprint, or edit a sprint's name, goal and dates. */
const SprintSheet: React.FC<{ mode: 'start' | 'edit'; sprint: Sprint; stats?: Sprint['stats']; onClose: () => void; onSaved: () => Promise<void> }> = ({ mode, sprint, stats, onClose, onSaved }) => {
  const today = localISODate();
  const [name, setName] = useState(sprint.name);
  const [goal, setGoal] = useState(sprint.goal);
  const [weeks, setWeeks] = useState<'1' | '2' | '3' | '4' | 'custom'>(sprint.startDate && sprint.endDate ? 'custom' : '2');
  const [startDate, setStartDate] = useState(sprint.startDate || (mode === 'start' ? today : ''));
  const [endDate, setEndDate] = useState(sprint.endDate || (mode === 'start' ? addDays(today, 13) : ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pick = (value: typeof weeks) => { setWeeks(value); if (value !== 'custom' && startDate) setEndDate(addDays(startDate, Number(value) * 7 - 1)); };
  const changeStart = (value: string) => { setStartDate(value); if (weeks !== 'custom' && value) setEndDate(addDays(value, Number(weeks) * 7 - 1)); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const body = { name, goal, ...(mode === 'start' || startDate || sprint.startDate ? { startDate } : {}), ...(mode === 'start' || endDate || sprint.endDate ? { endDate } : {}) };
      await sprintCall(mode === 'start' ? `/api/sprints/${sprint.id}/start` : `/api/sprints/${sprint.id}`, mode === 'start' ? 'POST' : 'PUT', body);
      await onSaved();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'ذخیره انجام نشد.'); } finally { setSaving(false); }
  };
  return (
    <SideSheet title={mode === 'start' ? `شروع ${sprint.name}` : `ویرایش ${sprint.name}`} description={mode === 'start' ? 'از لحظهٔ شروع، کارهای این اسپرینت تعهد تیم است و هر تغییر بعدی در نمودار burndown دیده می‌شود.' : undefined}
      submitLabel={mode === 'start' ? 'شروع اسپرینت' : 'ذخیرهٔ تغییرات'} saving={saving} error={error} onSubmit={submit} onClose={onClose}>
      {mode === 'start' && stats && (
        <p className="rounded-xl bg-blue-50 dark:bg-blue-500/10 px-3 py-2.5 text-xs text-blue-800 dark:text-blue-200">
          {`${num(stats.tasks)} وظیفه با ${num(stats.points)} امتیاز در این اسپرینت است${stats.estimated < stats.tasks ? `؛ ${num(stats.tasks - stats.estimated)} وظیفه هنوز تخمین ندارد` : ''}.`}
        </p>
      )}
      <label className="block space-y-1.5"><span className={sheetLabel}>نام اسپرینت</span><input value={name} onChange={event => setName(event.target.value)} className={sheetInput} required maxLength={120} /></label>
      {sprint.state !== 'active' && (
        <div className="space-y-1.5"><span className={sheetLabel}>مدت</span>
          <Segmented label="مدت اسپرینت" value={weeks} onChange={pick} options={[{ value: '1', label: '۱ هفته' }, { value: '2', label: '۲ هفته' }, { value: '3', label: '۳ هفته' }, { value: '4', label: '۴ هفته' }, { value: 'custom', label: 'دلخواه' }]} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><span className={sheetLabel} id="sprint-start">تاریخ شروع</span><JalaliDateInput value={startDate} onChange={changeStart} ariaLabel="تاریخ شروع اسپرینت" clearable={mode !== 'start' && sprint.state !== 'active'} /></div>
        <div className="space-y-1.5"><span className={sheetLabel}>تاریخ پایان</span><JalaliDateInput value={endDate} onChange={value => { setEndDate(value); setWeeks('custom'); }} ariaLabel="تاریخ پایان اسپرینت" min={startDate || undefined} clearable={mode !== 'start' && sprint.state !== 'active'} /></div>
      </div>
      <label className="block space-y-1.5"><span className={sheetLabel}>هدف اسپرینت</span>
        <textarea value={goal} onChange={event => setGoal(event.target.value)} maxLength={500} rows={3} placeholder="در پایان این اسپرینت چه چیزی آماده است؟" className={cn(sheetInput, 'h-auto py-2.5 leading-6')} />
      </label>
    </SideSheet>
  );
};

/** Closes the running sprint and decides where its open work goes. */
const CompleteSheet: React.FC<{ sprint: Sprint; futures: Sprint[]; onClose: () => void; onDone: () => Promise<void> }> = ({ sprint, futures, onClose, onDone }) => {
  const [moveTo, setMoveTo] = useState(futures[0]?.id || 'backlog');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const stats = sprint.stats;
  const open = stats ? stats.tasks - stats.doneTasks : 0;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setError('');
    try { await sprintCall(`/api/sprints/${sprint.id}/complete?${clockQuery()}`, 'POST', { moveTo }); await onDone(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'بستن اسپرینت انجام نشد.'); } finally { setSaving(false); }
  };
  const choice = (value: string, label: string, hint?: string) => (
    <label key={value} className={cn('flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors', moveTo === value ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-500/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300')}>
      <input type="radio" name="moveTo" value={value} checked={moveTo === value} onChange={() => setMoveTo(value)} className="mt-0.5 accent-blue-600" />
      <span><span className="block text-[13px] font-bold text-slate-800 dark:text-slate-100">{label}</span>{hint && <span className="block text-[11px] text-slate-500">{hint}</span>}</span>
    </label>
  );
  return (
    <SideSheet title={`پایان ${sprint.name}`} description="گزارش این اسپرینت ثبت و برای همیشه نگه داشته می‌شود." submitLabel="پایان اسپرینت" saving={saving} error={error} onSubmit={submit} onClose={onClose}>
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3"><p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">انجام‌شده</p><p className="text-lg font-black text-slate-900 dark:text-white">{num(stats.doneTasks)} <span className="text-xs font-semibold text-slate-500">{`وظیفه · ${num(stats.donePoints)} امتیاز`}</span></p></div>
          <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-3"><p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">باز</p><p className="text-lg font-black text-slate-900 dark:text-white">{num(open)} <span className="text-xs font-semibold text-slate-500">{`وظیفه · ${num(Math.round((stats.points - stats.donePoints) * 100) / 100)} امتیاز`}</span></p></div>
        </div>
      )}
      {open > 0 ? (
        <fieldset className="space-y-2">
          <legend className={cn(sheetLabel, 'mb-2')}>کارهای باز به کجا بروند؟</legend>
          {futures.map(row => choice(row.id, row.name, sprintDates(row) || 'اسپرینت برنامه‌ریزی‌شده'))}
          {choice('new', 'اسپرینت تازه', 'یک اسپرینت تازه ساخته و کارها به آن منتقل می‌شوند.')}
          {choice('backlog', 'بک‌لاگ', 'کارها به بالای بک‌لاگ برمی‌گردند.')}
        </fieldset>
      ) : <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><CalendarRange size={15} />همهٔ کارهای این اسپرینت انجام شده است.</p>}
    </SideSheet>
  );
};

export default SprintsView;
