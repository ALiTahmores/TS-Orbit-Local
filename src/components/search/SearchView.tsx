import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, CalendarClock, ChevronLeft, ChevronRight, Download, HelpCircle, History, Layers, Lock, Play, Save, Search, Share2, SlidersHorizontal, Star, Terminal, Trash2, UserX, Bug, Clock } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { apiFetch } from '../../lib/api';
import { formatJalaliDate, localISODate } from '../../lib/dates';
import { cn } from '../../lib/utils';
import { FIELDS, OqlError, parse, quote, suggest, type Suggestion } from '../../lib/oql';
import { SideSheet, sheetInput, sheetLabel } from '../common/SideSheet';
import { TaskKey } from '../common/TaskKey';
import { EpicLozenge, TASK_TYPES, TaskTypeIcon } from '../common/TaskType';
import { TaskDetailModal } from '../tasks/TaskDetailModal';
import { Avatar, EmptyHint, PageHeader, PrimaryButton, SecondaryButton, Segmented, num, timeAgo } from '../ui/dashboard-kit';
import { PriorityFlag, StatusPill } from '../sprints/parts';
import { STATUS_LABEL } from '../../hooks/useSprints';

interface SearchRow {
  id: string; key: string; title: string; type: string; status: string; priority: string; storyPoints: number | null; projectId: string; projectTitle: string; labels: string[];
  assignees: Array<{ id: string; name: string; avatar?: string }>; epic: { id: string; key: string; title: string; color: string } | null;
  sprint: { id: string; name: string; state: string } | null; dueDate: string | null; createdAt: string; updatedAt: string;
}
interface SearchResult { query: string; total: number; page: number; pageSize: number; rows: SearchRow[]; error: { message: string; start: number; end: number } | null }
interface SavedFilter { id: string; name: string; query: string; description: string; shared: boolean; ownerId: string; ownerName: string; createdAt: string; updatedAt: string; canEdit: boolean }
interface FilterList { personal: SavedFilter[]; shared: SavedFilter[]; starred: string[]; canShare: boolean }

const PRIORITY_LABEL: Record<string, string> = { low: 'پایین', medium: 'متوسط', high: 'بالا', critical: 'فوری' };
const READY: Array<{ id: string; label: string; query: string; icon: React.ElementType }> = [
  { id: 'mine', label: 'کارهای باز من', query: 'assignee = currentUser() AND status = open ORDER BY priority DESC, due', icon: Layers },
  { id: 'overdue', label: 'از موعد گذشته', query: 'due < today AND status = open ORDER BY due', icon: AlertTriangle },
  { id: 'week', label: 'سررسید این هفته', query: 'due >= today AND due <= +7d AND status = open ORDER BY due', icon: CalendarClock },
  { id: 'unassigned', label: 'بدون مسئول', query: 'assignee is empty AND status = open AND type != epic ORDER BY priority DESC', icon: UserX },
  { id: 'bugs', label: 'باگ‌های باز', query: 'type = bug AND status = open ORDER BY priority DESC', icon: Bug },
  { id: 'sprint', label: 'اسپرینت جاری', query: 'sprint = activeSprint() ORDER BY status, priority DESC', icon: Clock },
  { id: 'recent', label: 'تغییرات ۷ روز اخیر', query: 'updated >= -7d ORDER BY updated DESC', icon: History },
];
const SORTABLE: Array<{ field: string; label: string }> = [
  { field: 'key', label: 'کلید' }, { field: 'title', label: 'عنوان' }, { field: 'status', label: 'وضعیت' }, { field: 'priority', label: 'اولویت' },
  { field: 'assignee', label: 'مسئول' }, { field: 'points', label: 'امتیاز' }, { field: 'due', label: 'سررسید' }, { field: 'updated', label: 'به‌روزرسانی' },
];
const LAST_QUERY = 'orbit.search.last';
const read = () => { try { return localStorage.getItem(LAST_QUERY); } catch { return null; } };
const remember = (value: string) => { try { localStorage.setItem(LAST_QUERY, value); } catch { /* storage may be unavailable */ } };
const withOrder = (query: string, field: string, dir: 'asc' | 'desc') => `${query.replace(/\s*\border\s+by\b[\s\S]*$/i, '').trim()} ORDER BY ${field} ${dir.toUpperCase()}`.trim();
const orderOf = (query: string) => { const match = /\border\s+by\s+([^\s,]+)(?:\s+(asc|desc))?/i.exec(query); return match ? { field: match[1].toLowerCase(), dir: (match[2] || 'asc').toLowerCase() } : null; };

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await apiFetch(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return response.json();
}

/** Jira-style issue navigator: ready and saved filters, simple or OQL search, sortable results, bulk change and export. */
export const SearchView: React.FC = () => {
  const { projects, tasks, teamMembers, userRole, activeWorkspaceId } = useProject();
  const [query, setQuery] = useState(() => read() ?? READY[0].query);
  const [draft, setDraft] = useState(query);
  const [mode, setMode] = useState<'simple' | 'oql'>('oql');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FilterList | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A message above the results: failures in red, completed changes in green.
  const [notice, setNoticeState] = useState<{ text: string; ok: boolean } | null>(null);
  const setNotice = (text: string, ok = false) => setNoticeState(text ? { text, ok } : null);
  const sequence = useRef(0);
  const canWrite = !['VIEWER', 'CLIENT', 'READ_ONLY', 'GUEST'].includes(String(userRole || '').toUpperCase());

  const run = useCallback(async (text: string, at: number) => {
    const id = ++sequence.current;
    setLoading(true);
    try {
      const value = await call<SearchResult>(`/api/search?q=${encodeURIComponent(text)}&page=${at}&pageSize=50&today=${localISODate()}&offset=${new Date().getTimezoneOffset()}`);
      if (id === sequence.current) { setResult(value); if (!value.error) remember(text); }
    } catch (failure) { if (id === sequence.current) setNotice(failure instanceof Error ? failure.message : 'جستجو انجام نشد.'); }
    finally { if (id === sequence.current) setLoading(false); }
  }, []);
  // Results stay current: any change to the workspace's tasks reruns the search.
  useEffect(() => { const timer = setTimeout(() => { void run(query, page); }, 150); return () => clearTimeout(timer); }, [query, page, tasks, run, activeWorkspaceId]);
  const loadFilters = useCallback(async () => { try { setFilters(await call<FilterList>('/api/filters')); } catch { /* the page still works without saved filters */ } }, []);
  useEffect(() => { void loadFilters(); }, [loadFilters, activeWorkspaceId]);
  useEffect(() => { setSelected(current => current.filter(id => result?.rows.some(row => row.id === id))); }, [result]);

  const apply = (text: string) => { setDraft(text); setQuery(text); setPage(1); setSelected([]); };
  const epics = useMemo(() => tasks.filter(task => task.type === 'epic'), [tasks]);
  const values = useMemo(() => ({
    project: projects.map(project => project.title).filter(Boolean),
    assignee: teamMembers.map(member => member.name).filter(Boolean), creator: teamMembers.map(member => member.name).filter(Boolean),
    epic: epics.map(epic => epic.key || epic.title).filter(Boolean) as string[],
    sprint: [...new Set(projects.flatMap(project => ((project as any).sprints || []).map((sprint: any) => sprint.name)))].filter(Boolean) as string[],
    labels: [...new Set(tasks.flatMap(task => (task.tags || []) as string[]))].slice(0, 200),
  }), [projects, teamMembers, epics, tasks]);

  const sortBy = (field: string) => {
    const current = orderOf(query);
    apply(withOrder(query, field, current?.field === field && current.dir === 'asc' ? 'desc' : current?.field === field ? 'asc' : field === 'title' || field === 'key' ? 'asc' : 'desc'));
  };

  const exportCsv = async () => {
    try {
      const rows: SearchRow[] = [];
      for (let at = 1; at <= 5; at++) {
        const value = await call<SearchResult>(`/api/search?q=${encodeURIComponent(query)}&page=${at}&pageSize=200&today=${localISODate()}&offset=${new Date().getTimezoneOffset()}`);
        rows.push(...value.rows);
        if (value.rows.length < 200) break;
      }
      const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const header = ['کلید', 'عنوان', 'نوع', 'وضعیت', 'اولویت', 'مسئول', 'پروژه', 'اپیک', 'اسپرینت', 'امتیاز', 'سررسید', 'به‌روزرسانی'];
      const lines = rows.map(row => [row.key, row.title, TASK_TYPES.find(type => type.value === row.type)?.label || row.type, STATUS_LABEL[row.status] || row.status, PRIORITY_LABEL[row.priority] || row.priority,
        row.assignees.map(person => person.name).join('، '), row.projectTitle, row.epic?.title || '', row.sprint?.name || '', row.storyPoints ?? '', row.dueDate || '', row.updatedAt.slice(0, 10)].map(cell).join(','));
      const blob = new Blob(['﻿' + [header.map(cell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob); link.download = `orbit-search-${localISODate()}.csv`; link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (failure) { setNotice(failure instanceof Error ? failure.message : 'خروجی ساخته نشد.'); }
  };
  const star = async (filter: SavedFilter, on: boolean) => { try { await call(`/api/filters/${filter.id}`, 'PUT', { starred: on }); await loadFilters(); } catch (failure) { setNotice(failure instanceof Error ? failure.message : 'انجام نشد.'); } };
  const removeFilter = async (filter: SavedFilter) => {
    if (!window.confirm(`فیلتر «${filter.name}» حذف شود؟`)) return;
    try { await call(`/api/filters/${filter.id}`, 'DELETE'); await loadFilters(); } catch (failure) { setNotice(failure instanceof Error ? failure.message : 'حذف انجام نشد.'); }
  };

  const allSelected = !!result?.rows.length && result.rows.every(row => selected.includes(row.id));
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  const detailTask = detail ? tasks.find(task => task.id === detail) || null : null;
  const order = orderOf(query);
  const starred = filters ? [...filters.personal, ...filters.shared].filter(filter => filters.starred.includes(filter.id)) : [];

  return (
    <div className="space-y-5 text-start">
      <PageHeader title="جستجوی پیشرفته" description="هر کاری را با فیلترهای آماده، جستجوی ساده یا زبان OQL پیدا کنید؛ فیلترها را ذخیره و با تیم به اشتراک بگذارید و چند کار را یکجا تغییر دهید."
        actions={<>
          <SecondaryButton icon={Download} onClick={() => void exportCsv()} disabled={!result?.total}>خروجی CSV</SecondaryButton>
          <PrimaryButton icon={Save} onClick={() => setSaving(true)} disabled={!!result?.error}>ذخیرهٔ فیلتر</PrimaryButton>
        </>} />

      {notice && (
        <div role={notice.ok ? 'status' : 'alert'} className={cn('rounded-xl border px-4 py-3 text-xs font-semibold flex items-center justify-between gap-3', notice.ok
          ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
          : 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300')}>
          <span>{notice.text}</span><button type="button" onClick={() => setNotice('')} className="font-bold underline cursor-pointer">بستن</button>
        </div>
      )}

      <div className="grid lg:grid-cols-[250px_minmax(0,1fr)] gap-5 items-start">
        <aside className="order-last lg:order-none rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] p-3 space-y-4 lg:sticky lg:top-4" aria-label="فیلترها">
          <FilterGroup title="فیلترهای آماده">
            {READY.map(item => <FilterButton key={item.id} label={item.label} icon={item.icon} active={query === item.query} onClick={() => apply(item.query)} />)}
          </FilterGroup>
          {starred.length > 0 && <FilterGroup title="ستاره‌دار">{starred.map(filter => <SavedItem key={'s' + filter.id} filter={filter} starred active={query === filter.query} onApply={apply} onStar={star} onDelete={removeFilter} />)}</FilterGroup>}
          <FilterGroup title="فیلترهای من" empty={filters && !filters.personal.length ? 'هنوز فیلتری ذخیره نکرده‌اید.' : undefined}>
            {filters?.personal.map(filter => <SavedItem key={filter.id} filter={filter} starred={filters.starred.includes(filter.id)} active={query === filter.query} onApply={apply} onStar={star} onDelete={removeFilter} />)}
          </FilterGroup>
          <FilterGroup title="فیلترهای مشترک تیم" empty={filters && !filters.shared.length ? 'فیلتر مشترکی نیست.' : undefined}>
            {filters?.shared.map(filter => <SavedItem key={filter.id} filter={filter} starred={filters.starred.includes(filter.id)} active={query === filter.query} onApply={apply} onStar={star} onDelete={removeFilter} />)}
          </FilterGroup>
        </aside>

        <div className="space-y-4 min-w-0">
          {/* On phones the search comes first; ready filters sit above it as a row of chips. */}
          <div className="lg:hidden flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1" role="group" aria-label="فیلترهای آماده">
            {READY.map(item => (
              <button key={item.id} type="button" onClick={() => apply(item.query)} aria-pressed={query === item.query}
                className={cn('h-8 px-3 rounded-full text-[11px] font-bold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer border',
                  query === item.query ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300')}>
                <item.icon size={13} />{item.label}
              </button>
            ))}
          </div>
          <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Segmented label="نوع جستجو" value={mode} onChange={setMode} options={[{ value: 'simple', label: <><SlidersHorizontal size={14} />ساده</> }, { value: 'oql', label: <><Terminal size={14} />OQL</> }]} />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{loading ? 'در حال جستجو…' : result && !result.error ? `${num(result.total)} نتیجه` : ''}</span>
            </div>
            {mode === 'simple'
              ? <SimpleSearch projects={projects} members={teamMembers} epics={epics} sprints={values.sprint} onQuery={apply} current={query} />
              : <OqlEditor draft={draft} onDraft={setDraft} onRun={() => apply(draft)} values={values} serverError={result?.error && result.query === draft ? result.error : null} />}
          </section>

          {canWrite && selected.length > 0 && result && (
            <BulkBar ids={selected} members={teamMembers} epics={epics} onDone={async (message, ok) => { setSelected([]); setNotice(message, ok); await run(query, page); }} onClear={() => setSelected([])} />
          )}

          <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] overflow-hidden" aria-busy={loading}>
            {!result ? <div className="h-72 animate-pulse bg-slate-50 dark:bg-slate-900" />
              : result.error ? <EmptyHint icon={AlertTriangle} title="جستجو قابل اجرا نیست." text={result.error.message} />
              : result.rows.length === 0 ? <EmptyHint icon={Search} title="کاری پیدا نشد." text="شرط‌ها را کمتر کنید یا یکی از فیلترهای آماده را امتحان کنید." />
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400">
                      <tr>
                        {canWrite && <th className="w-10 p-3"><input type="checkbox" aria-label="انتخاب همه" className="accent-blue-600" checked={allSelected} onChange={() => setSelected(allSelected ? [] : result.rows.map(row => row.id))} /></th>}
                        {SORTABLE.map(column => (
                          <th key={column.field} className={cn('p-3 text-start font-bold whitespace-nowrap', ['assignee', 'points', 'updated'].includes(column.field) && 'hidden lg:table-cell', column.field === 'due' && 'hidden md:table-cell')}
                            aria-sort={order?.field === column.field ? (order.dir === 'desc' ? 'descending' : 'ascending') : undefined}>
                            <button type="button" onClick={() => sortBy(column.field)} className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer">
                              {column.label}{order?.field === column.field && (order.dir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                      {result.rows.map(row => {
                        const overdue = !!row.dueDate && row.dueDate < localISODate() && !['completed', 'cancelled'].includes(row.status);
                        return (
                          <tr key={row.id} className={cn('hover:bg-slate-50/70 dark:hover:bg-slate-900/40', selected.includes(row.id) && 'bg-blue-50/50 dark:bg-blue-500/5')}>
                            {canWrite && <td className="p-3"><input type="checkbox" aria-label={`انتخاب ${row.title}`} className="accent-blue-600" checked={selected.includes(row.id)} onChange={() => setSelected(selected.includes(row.id) ? selected.filter(id => id !== row.id) : [...selected, row.id])} /></td>}
                            <td className="p-3 whitespace-nowrap"><span className="inline-flex items-center gap-1.5"><TaskTypeIcon type={row.type} size={16} /><TaskKey value={row.key} /></span></td>
                            <td className="p-3 min-w-56">
                              <button type="button" onClick={() => setDetail(row.id)} className="text-start text-[13px] font-semibold text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer">{row.title}</button>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                                <span>{row.projectTitle}</span>
                                {row.epic && <EpicLozenge title={row.epic.title} color={row.epic.color} />}
                                {row.sprint && <span className="h-5 px-1.5 rounded bg-slate-100 dark:bg-slate-800 inline-flex items-center font-bold">{row.sprint.name}</span>}
                              </div>
                            </td>
                            <td className="p-3"><StatusPill status={row.status} /></td>
                            <td className="p-3 whitespace-nowrap"><span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 font-semibold"><PriorityFlag priority={row.priority} decorative />{PRIORITY_LABEL[row.priority] || row.priority}</span></td>
                            <td className="p-3 hidden lg:table-cell">{row.assignees[0] ? <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Avatar name={row.assignees[0].name} size={22} /><span className="text-slate-700 dark:text-slate-200">{row.assignees[0].name}</span></span> : <span className="text-slate-400">بدون مسئول</span>}</td>
                            <td className="p-3 hidden lg:table-cell tabular-nums font-bold text-slate-600 dark:text-slate-300">{row.storyPoints === null ? '–' : num(row.storyPoints)}</td>
                            <td className={cn('p-3 hidden md:table-cell whitespace-nowrap', overdue ? 'text-rose-600 font-bold' : 'text-slate-600 dark:text-slate-300')}>{row.dueDate ? formatJalaliDate(row.dueDate) : '—'}</td>
                            <td className="p-3 hidden lg:table-cell whitespace-nowrap text-slate-500">{timeAgo(row.updatedAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            {result && !result.error && result.total > result.pageSize && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                <span>{`صفحهٔ ${num(page)} از ${num(pages)}`}</span>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="صفحهٔ قبل" disabled={page <= 1} onClick={() => setPage(page - 1)} className="w-8 h-8 rounded-lg inline-flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"><ChevronRight size={15} className="rtl:rotate-0 ltr:rotate-180" /></button>
                  <button type="button" aria-label="صفحهٔ بعد" disabled={page >= pages} onClick={() => setPage(page + 1)} className="w-8 h-8 rounded-lg inline-flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"><ChevronLeft size={15} className="rtl:rotate-0 ltr:rotate-180" /></button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {saving && <SaveSheet query={query} canShare={!!filters?.canShare} onClose={() => setSaving(false)} onSaved={async () => { setSaving(false); await loadFilters(); }} />}
      {detailTask && <TaskDetailModal task={detailTask} isOpen onClose={() => setDetail(null)} />}
    </div>
  );
};

const FilterGroup: React.FC<{ title: string; empty?: string; children?: React.ReactNode }> = ({ title, empty, children }) => (
  <div>
    <h2 className="px-2 pb-1.5 text-[11px] font-black text-slate-500 dark:text-slate-400">{title}</h2>
    {empty ? <p className="px-2 text-[11px] text-slate-400">{empty}</p> : <ul className="space-y-0.5">{children}</ul>}
  </div>
);
const FilterButton: React.FC<{ label: string; icon: React.ElementType; active: boolean; onClick: () => void }> = ({ label, icon: Icon, active, onClick }) => (
  <li>
    <button type="button" onClick={onClick} aria-current={active || undefined}
      className={cn('w-full h-8 px-2 rounded-lg text-start text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors', active ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800')}>
      <Icon size={14} className="shrink-0 opacity-70" />{label}
    </button>
  </li>
);
const SavedItem: React.FC<{ filter: SavedFilter; starred: boolean; active: boolean; onApply: (query: string) => void; onStar: (filter: SavedFilter, on: boolean) => void; onDelete: (filter: SavedFilter) => void }> = ({ filter, starred, active, onApply, onStar, onDelete }) => (
  <li className={cn('group flex items-center gap-1 rounded-lg', active ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}>
    <button type="button" onClick={() => onApply(filter.query)} title={filter.description || filter.query}
      className={cn('flex-1 min-w-0 h-8 px-2 text-start text-xs font-semibold inline-flex items-center gap-2 cursor-pointer truncate', active ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200')}>
      {filter.shared ? <Share2 size={13} className="shrink-0 opacity-60" aria-label="مشترک" /> : <Lock size={13} className="shrink-0 opacity-60" aria-label="شخصی" />}
      <span className="truncate">{filter.name}</span>
    </button>
    <button type="button" onClick={() => onStar(filter, !starred)} aria-pressed={starred} aria-label={starred ? `برداشتن ستارهٔ ${filter.name}` : `ستاره زدن به ${filter.name}`}
      className={cn('w-7 h-7 rounded-md inline-flex items-center justify-center cursor-pointer', starred ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500 opacity-0 group-hover:opacity-100 focus:opacity-100')}>
      <Star size={13} fill={starred ? 'currentColor' : 'none'} />
    </button>
    {filter.canEdit && (
      <button type="button" onClick={() => onDelete(filter)} aria-label={`حذف ${filter.name}`}
        className="w-7 h-7 rounded-md inline-flex items-center justify-center text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"><Trash2 size={13} /></button>
    )}
  </li>
);

/** Builds a query from dropdowns; the OQL it writes is shown so people learn the language. */
const SimpleSearch: React.FC<{ projects: any[]; members: any[]; epics: any[]; sprints: string[]; current: string; onQuery: (query: string) => void }> = ({ projects, members, epics, onQuery, current }) => {
  const [form, setForm] = useState({ project: '', type: '', status: 'open', priority: '', assignee: '', epic: '', sprint: '', text: '' });
  const built = useMemo(() => {
    const parts: string[] = [];
    if (form.project) parts.push(`project = ${quote(form.project)}`);
    if (form.type) parts.push(`type = ${form.type}`);
    if (form.status) parts.push(`status = ${form.status}`);
    if (form.priority) parts.push(`priority = ${form.priority}`);
    if (form.assignee === 'me') parts.push('assignee = currentUser()'); else if (form.assignee === 'none') parts.push('assignee is empty'); else if (form.assignee) parts.push(`assignee = ${quote(form.assignee)}`);
    if (form.epic === 'none') parts.push('epic is empty'); else if (form.epic) parts.push(`epic = ${quote(form.epic)}`);
    if (form.sprint === 'active') parts.push('sprint = activeSprint()'); else if (form.sprint === 'open') parts.push('sprint in openSprints()'); else if (form.sprint === 'none') parts.push('sprint is empty');
    if (form.text.trim()) parts.push(`text ~ ${quote(form.text.trim())}`);
    return `${parts.join(' AND ')} ORDER BY updated DESC`.trim();
  }, [form]);
  useEffect(() => { if (built !== current) { const timer = setTimeout(() => onQuery(built), 250); return () => clearTimeout(timer); } }, [built]); // eslint-disable-line react-hooks/exhaustive-deps
  const field = 'h-9 w-full px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200';
  const select = (key: keyof typeof form, label: string, options: Array<[string, string]>) => (
    <label className="block space-y-1"><span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{label}</span>
      <select value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} className={field}>
        <option value="">همه</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </label>
  );
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {select('project', 'پروژه', projects.map(project => [project.title, project.title]))}
        {select('type', 'نوع', TASK_TYPES.map(type => [type.value, type.label]))}
        {select('status', 'وضعیت', [['open', 'همهٔ کارهای باز'], ['closed', 'بسته‌شده'], ...Object.entries(STATUS_LABEL)])}
        {select('priority', 'اولویت', Object.entries(PRIORITY_LABEL))}
        {select('assignee', 'مسئول', [['me', 'خودم'], ['none', 'بدون مسئول'], ...members.map(member => [member.name, member.name] as [string, string])])}
        {select('epic', 'اپیک', [['none', 'بدون اپیک'], ...epics.map(epic => [epic.key || epic.title, epic.title] as [string, string])])}
        {select('sprint', 'اسپرینت', [['active', 'اسپرینت فعال'], ['open', 'اسپرینت‌های باز'], ['none', 'در بک‌لاگ']])}
        <label className="block space-y-1"><span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">متن</span>
          <input value={form.text} onChange={event => setForm({ ...form, text: event.target.value })} placeholder="در عنوان یا توضیح…" className={field} />
        </label>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap"><Terminal size={12} aria-hidden="true" />OQL: <code dir="ltr" className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">{built}</code></p>
    </div>
  );
};

/** The OQL editor: suggestions as you type, the error pointing at its place, Enter to search. */
const OqlEditor: React.FC<{ draft: string; onDraft: (value: string) => void; onRun: () => void; values: Partial<Record<string, string[]>>; serverError: SearchResult['error'] }> = ({ draft, onDraft, onRun, values, serverError }) => {
  const input = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(draft.length);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [help, setHelp] = useState(false);
  // Enter picks a suggestion only after the arrows chose one; otherwise it searches.
  const [navigated, setNavigated] = useState(false);
  useEffect(() => { setNavigated(false); }, [draft]);
  const local = useMemo(() => { try { parse(draft); return null; } catch (error) { return error instanceof OqlError ? { message: error.message, start: error.start, end: error.end } : null; } }, [draft]);
  const error = local || serverError;
  const hints = useMemo(() => open ? suggest(draft, cursor, values) : { from: 0, to: 0, items: [] as Suggestion[] }, [open, draft, cursor, values]);
  useEffect(() => { setActive(0); }, [hints.items.length, cursor]);
  const accept = (item: Suggestion) => {
    const next = draft.slice(0, hints.from) + item.insert + draft.slice(hints.to);
    const at = hints.from + item.insert.length;
    onDraft(next); setCursor(at);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(at, at); });
  };
  const show = (element: HTMLTextAreaElement) => { setCursor(element.selectionStart ?? element.value.length); setOpen(true); };
  const runNow = () => {
    setOpen(false);
    if (local) { input.current?.focus(); input.current?.setSelectionRange(local.start, Math.max(local.end, local.start + 1)); return; }
    onRun();
  };
  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="flex items-start gap-2">
          <textarea ref={input} dir="auto" rows={2} value={draft} spellCheck={false} role="combobox" aria-expanded={open && hints.items.length > 0} aria-controls="oql-suggestions" aria-autocomplete="list"
            aria-activedescendant={open && hints.items[active] ? `oql-option-${active}` : undefined} aria-label="جستجوی OQL" aria-invalid={!!error} aria-describedby="oql-status"
            onChange={event => { onDraft(event.target.value); show(event.target); }} onClick={event => show(event.currentTarget)} onFocus={event => show(event.currentTarget)}
            onBlur={() => setTimeout(() => setOpen(false), 120)} onKeyUp={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) show(event.currentTarget); }}
            onKeyDown={event => {
              const items = hints.items;
              if (open && items.length && event.key === 'ArrowDown') { event.preventDefault(); setNavigated(true); setActive((active + 1) % items.length); }
              else if (open && items.length && event.key === 'ArrowUp') { event.preventDefault(); setNavigated(true); setActive((active - 1 + items.length) % items.length); }
              else if (open && items[active] && (event.key === 'Tab' || (event.key === 'Enter' && navigated))) { event.preventDefault(); accept(items[active]); }
              else if (event.key === 'Escape') setOpen(false);
              else if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); runNow(); }
            }}
            className={cn('flex-1 min-h-16 px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-900 font-mono text-[13px] leading-6 text-slate-800 dark:text-slate-100 resize-y focus:outline-none focus:ring-2',
              error ? 'border-rose-300 dark:border-rose-500/50 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20 focus:border-blue-500')} />
          <PrimaryButton icon={Play} onClick={runNow} className="h-10">جستجو</PrimaryButton>
        </div>
        {open && hints.items.length > 0 && (
          <ul id="oql-suggestions" role="listbox" dir="ltr" className="absolute z-30 mt-1 start-0 w-72 max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1">
            {hints.items.map((item, index) => (
              <li key={item.label + index} id={`oql-option-${index}`} role="option" aria-selected={index === active}
                onMouseDown={event => { event.preventDefault(); accept(item); }} onMouseEnter={() => setActive(index)}
                className={cn('px-3 py-1.5 text-xs flex items-center justify-between gap-3 cursor-pointer', index === active ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-200' : 'text-slate-700 dark:text-slate-200')}>
                <span className="font-mono font-semibold">{item.label}</span>{item.hint && <span className="text-[11px] text-slate-400" dir="rtl">{item.hint}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div id="oql-status" className="flex flex-wrap items-center justify-between gap-2 min-h-5">
        {error ? <p role="alert" className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{`${error.message} (نویسهٔ ${num(error.start + 1)})`}</p>
          : <p className="text-[11px] text-slate-500 dark:text-slate-400">Enter برای جستجو، Tab برای پذیرفتن پیشنهاد، Shift+Enter برای خط تازه.</p>}
        <button type="button" onClick={() => setHelp(!help)} aria-expanded={help} className="text-[11px] font-bold text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 cursor-pointer"><HelpCircle size={13} />راهنمای OQL</button>
      </div>
      {help && <OqlHelp onExample={value => { onDraft(value); setCursor(value.length); }} />}
    </div>
  );
};

const OqlHelp: React.FC<{ onExample: (value: string) => void }> = ({ onExample }) => (
  <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-4 grid md:grid-cols-2 gap-4 text-xs">
    <div className="space-y-2">
      <h3 className="font-black text-slate-800 dark:text-slate-100">فیلدها</h3>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {Object.entries(FIELDS).map(([name, def]) => <li key={name} className="flex items-center justify-between gap-2"><code dir="ltr" className="font-mono text-blue-700 dark:text-blue-300">{name}</code><span className="text-slate-500">{def.label}</span></li>)}
      </ul>
      <p className="text-[11px] leading-5 text-slate-500">عملگرها: <code dir="ltr">= != ~ !~ &gt; &gt;= &lt; &lt;= IN · NOT IN · IS EMPTY</code>؛ ترکیب با <code dir="ltr">AND</code> (و)، <code dir="ltr">OR</code> (یا)، <code dir="ltr">NOT</code> و پرانتز؛ مرتب‌سازی با <code dir="ltr">ORDER BY field DESC</code>.</p>
      <p className="text-[11px] leading-5 text-slate-500">تاریخ‌ها: <code dir="ltr">today</code>، <code dir="ltr">-7d</code>، <code dir="ltr">+2w</code>، <code dir="ltr">1405/08/29</code> یا <code dir="ltr">2026-11-20</code>. توابع: <code dir="ltr">currentUser()</code>، <code dir="ltr">openSprints()</code>، <code dir="ltr">activeSprint()</code>.</p>
    </div>
    <div className="space-y-2">
      <h3 className="font-black text-slate-800 dark:text-slate-100">نمونه‌ها</h3>
      {['type = bug AND priority >= high AND status = open', 'assignee = currentUser() AND due <= +7d ORDER BY due', 'epic is empty AND type in (story, task) AND status != done', 'labels = urgent OR text ~ "پرداخت"', 'وضعیت = باز و مسئول = من'].map(example => (
        <button key={example} type="button" onClick={() => onExample(example)} className="block w-full text-start px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 cursor-pointer">
          <code dir="auto" className="font-mono text-[11px] text-slate-700 dark:text-slate-200">{example}</code>
        </button>
      ))}
    </div>
  </div>
);

/** One change for every selected task; each task still follows its own rules. */
const BulkBar: React.FC<{ ids: string[]; members: any[]; epics: any[]; onDone: (message: string, ok: boolean) => Promise<void>; onClear: () => void }> = ({ ids, members, epics, onDone, onClear }) => {
  const [change, setChange] = useState({ status: '', priority: '', assigneeId: '', epicId: '' });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const changes: Record<string, string | null> = {};
    if (change.status) changes.status = change.status;
    if (change.priority) changes.priority = change.priority;
    if (change.assigneeId) changes.assigneeId = change.assigneeId === 'none' ? '' : change.assigneeId;
    if (change.epicId) changes.epicId = change.epicId === 'none' ? null : change.epicId;
    if (!Object.keys(changes).length) return;
    setBusy(true);
    try {
      const value = await call<{ updated: number; failed: Array<{ key: string; message: string }> }>('/api/search/bulk', 'PUT', { taskIds: ids, changes });
      await onDone(value.failed.length ? `${num(value.updated)} کار تغییر کرد؛ ${num(value.failed.length)} کار تغییر نکرد: ${value.failed.slice(0, 3).map(item => `${item.key} (${item.message})`).join('، ')}` : `${num(value.updated)} کار تغییر کرد.`, value.failed.length === 0);
      setChange({ status: '', priority: '', assigneeId: '', epicId: '' });
    } catch (failure) { await onDone(failure instanceof Error ? failure.message : 'تغییر گروهی انجام نشد.', false); } finally { setBusy(false); }
  };
  const field = 'h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200';
  return (
    <section aria-label="تغییر گروهی" className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-500/5 p-3 flex flex-wrap items-center gap-2">
      <span className="text-xs font-black text-blue-800 dark:text-blue-200">{`${num(ids.length)} کار انتخاب شد`}</span>
      <select aria-label="وضعیت تازه" value={change.status} onChange={event => setChange({ ...change, status: event.target.value })} className={field}><option value="">وضعیت…</option>{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select aria-label="اولویت تازه" value={change.priority} onChange={event => setChange({ ...change, priority: event.target.value })} className={field}><option value="">اولویت…</option>{Object.entries(PRIORITY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select aria-label="مسئول تازه" value={change.assigneeId} onChange={event => setChange({ ...change, assigneeId: event.target.value })} className={field}><option value="">مسئول…</option><option value="none">بدون مسئول</option>{members.map(member => <option key={member.id} value={member.userId || member.id}>{member.name}</option>)}</select>
      <select aria-label="اپیک تازه" value={change.epicId} onChange={event => setChange({ ...change, epicId: event.target.value })} className={field}><option value="">اپیک…</option><option value="none">بدون اپیک</option>{epics.map(epic => <option key={epic.id} value={epic.id}>{epic.key ? `${epic.key} · ` : ''}{epic.title}</option>)}</select>
      <PrimaryButton onClick={() => void submit()} disabled={busy || !(change.status || change.priority || change.assigneeId || change.epicId)} className="h-9">اعمال</PrimaryButton>
      <button type="button" onClick={onClear} className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer ms-auto">لغو انتخاب</button>
    </section>
  );
};

/** Saves the current query as a personal or shared filter. */
const SaveSheet: React.FC<{ query: string; canShare: boolean; onClose: () => void; onSaved: () => Promise<void> }> = ({ query, canShare, onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try { await call('/api/filters', 'POST', { name, query, description, shared }); await onSaved(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'ذخیره انجام نشد.'); } finally { setBusy(false); }
  };
  return (
    <SideSheet title="ذخیرهٔ فیلتر" description="فیلتر ذخیره‌شده همیشه نتیجهٔ تازه را نشان می‌دهد." submitLabel="ذخیره" saving={busy} error={error} onSubmit={submit} onClose={onClose}>
      <label className="block space-y-1.5"><span className={sheetLabel}>نام فیلتر</span><input value={name} onChange={event => setName(event.target.value)} className={sheetInput} required maxLength={120} placeholder="مثال: باگ‌های فوری وب‌سایت" /></label>
      <label className="block space-y-1.5"><span className={sheetLabel}>توضیح</span><input value={description} onChange={event => setDescription(event.target.value)} className={sheetInput} maxLength={500} /></label>
      <div className="space-y-1.5"><span className={sheetLabel}>جستجو</span><code dir="ltr" className="block px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-[12px] font-mono text-slate-700 dark:text-slate-200 break-all">{query || '(همهٔ کارها)'}</code></div>
      <label className={cn('flex items-start gap-3 p-3 rounded-xl border cursor-pointer', shared ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-500/10' : 'border-slate-200 dark:border-slate-700', !canShare && 'opacity-60 cursor-not-allowed')}>
        <input type="checkbox" checked={shared} disabled={!canShare} onChange={event => setShared(event.target.checked)} className="mt-0.5 accent-blue-600" />
        <span><span className="block text-[13px] font-bold text-slate-800 dark:text-slate-100">اشتراک با تیم</span>
          <span className="block text-[11px] text-slate-500">{canShare ? 'همهٔ اعضای فضای کاری این فیلتر را می‌بینند؛ هر کس فقط کارهایی را می‌بیند که به آن‌ها دسترسی دارد.' : 'اشتراک فیلتر با اعضایی است که اجازهٔ ویرایش دارند.'}</span></span>
      </label>
    </SideSheet>
  );
};

export default SearchView;
