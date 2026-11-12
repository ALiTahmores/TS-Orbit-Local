import React, { useMemo, useState } from 'react';
import { AlertOctagon, CheckCircle2, Clock3, FolderKanban, Hourglass, Play, RotateCcw, Search, ShieldAlert, UserX, Users } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useInsights } from '../../hooks/useInsights';
import { formatJalaliDayMonth } from '../../lib/dates';
import { statusLabel } from '../../lib/taskLabels';
import { isEnglish } from '../../lib/locale';
import { cn } from '../../lib/utils';
import { Avatar, AvatarStack, EmptyHint, HealthBadge, Panel, ProgressBar, StatTile, num, percent, type Health } from '../ui/dashboard-kit';

type Reason = 'blocked' | 'stale_review' | 'overdue' | 'unassigned';
interface RiskItem { id: string; title: string; projectId: string; projectTitle: string; status: string; priority: string; dueDate: string | null; daysOverdue: number; daysInStatus: number; assignees: { id: string; name: string }[]; reasons: Reason[]; severity: 'high' | 'medium' | 'low' }
interface Risks {
  canManage: boolean;
  summary: { total: number; blocked: number; staleReview: number; overdue: number; unassigned: number; projectsAtRisk: number };
  aging: { fresh: number; week: number; fortnight: number; older: number };
  items: RiskItem[];
  projects: { id: string; title: string; health: Health; progress: number; overdueTasks: number; blockedTasks: number; daysLeft: number | null }[];
  people: { userId: string; name: string; overdue: number; blocked: number; review: number }[];
}

const reasonLabels: Record<Reason, string> = { blocked: 'مسدود', stale_review: 'بررسی معطل', overdue: 'عقب‌افتاده', unassigned: 'بدون مسئول' };
const reasonStyles: Record<Reason, string> = {
  blocked: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  stale_review: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
  overdue: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  unassigned: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};
const severityBar: Record<RiskItem['severity'], string> = { high: 'bg-rose-500', medium: 'bg-amber-500', low: 'bg-slate-300 dark:bg-slate-600' };

/**
 * Work that is stuck or late, why, and the one action that moves each item:
 * unblock it, decide a review, or open the owner's board.
 */
export const RiskReview: React.FC = () => {
  const { updateTaskStatus, setActiveTab, setActiveSubTab, setSelectedProject, projects } = useProject();
  const { data, reload } = useInsights<Risks>('risks');
  const [filter, setFilter] = useState<'all' | Reason>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');

  const items = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (data?.items || []).filter(item => (filter === 'all' || item.reasons.includes(filter))
      && (!text || item.title.toLowerCase().includes(text) || item.projectTitle.toLowerCase().includes(text) || item.assignees.some(person => person.name.toLowerCase().includes(text))));
  }, [data, filter, query]);

  const act = async (item: RiskItem, status: 'inprogress' | 'completed') => {
    setBusy(item.id);
    try { await updateTaskStatus(item.id, status); await reload(); } catch { /* The error toast reports it. */ } finally { setBusy(''); }
  };
  const openProject = (id: string) => { const project = projects.find(row => row.id === id); if (project) setSelectedProject(project); setActiveTab('projects'); setActiveSubTab('overview'); };
  const toggle = (value: Reason) => setFilter(current => current === value ? 'all' : value);

  if (!data) return <div className="h-40" aria-busy="true" />;
  const s = data.summary, agingTotal = Math.max(1, data.aging.fresh + data.aging.week + data.aging.fortnight + data.aging.older);

  return (
    <div className="space-y-6 text-start">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatTile tone="slate" icon={ShieldAlert} label="همهٔ موارد" value={num(s.total)} hint={`${num(s.projectsAtRisk)} پروژه در معرض خطر`} onClick={() => setFilter('all')} active={filter === 'all'} />
        <StatTile tone="rose" icon={AlertOctagon} label="مسدود" value={num(s.blocked)} hint="منتظر رفع مانع" onClick={() => toggle('blocked')} active={filter === 'blocked'} />
        <StatTile tone="amber" icon={Clock3} label="عقب‌افتاده" value={num(s.overdue)} hint="سررسید گذشته و باز" onClick={() => toggle('overdue')} active={filter === 'overdue'} />
        <StatTile tone="violet" icon={Hourglass} label="بررسی معطل" value={num(s.staleReview)} hint="بیش از دو روز در بررسی" onClick={() => toggle('stale_review')} active={filter === 'stale_review'} />
        <StatTile tone="blue" icon={UserX} label="فوری بدون مسئول" value={num(s.unassigned)} hint="اولویت بالا، بدون فرد مسئول" onClick={() => toggle('unassigned')} active={filter === 'unassigned'} />
      </div>

      <div className="grid grid-cols-12 gap-6">
        <Panel title="فهرست موانع و تأخیرها" description="از مهم‌ترین مورد؛ هر مورد علت و اقدام بعدی خودش را دارد." className="col-span-12 xl:col-span-8" bodyClassName="pt-4 space-y-3"
          action={<label className="relative block w-44 sm:w-56">
            <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="جستجوی کار، پروژه یا فرد" aria-label="جستجو در موانع"
              className="w-full h-9 ps-8 pe-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </label>}>
          {items.length === 0 ? (
            <EmptyHint icon={CheckCircle2} title={s.total ? 'موردی با این فیلتر نیست.' : 'هیچ کاری گیر نکرده است.'} text={s.total ? undefined : 'کار مسدود، عقب‌افتاده یا بررسی معطلی در این فضای کاری وجود ندارد.'} />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {items.map(item => (
                <li key={item.id} className="py-3.5 flex items-start gap-3">
                  <span className={cn('w-1 self-stretch rounded-full shrink-0', severityBar[item.severity])} aria-hidden="true" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100 me-1">{item.title}</p>
                      {item.reasons.map(reason => <span key={reason} className={cn('h-5 px-1.5 rounded text-[10px] font-bold inline-flex items-center', reasonStyles[reason])}>{reasonLabels[reason]}</span>)}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                      <button type="button" onClick={() => item.projectId && openProject(item.projectId)} className="hover:text-blue-600 hover:underline cursor-pointer">{item.projectTitle || 'بدون پروژه'}</button>
                      <span>{statusLabel(item.status, isEnglish() ? 'en' : 'fa')}</span>
                      {item.daysOverdue > 0 ? <span className="text-rose-600 dark:text-rose-400 font-bold">{`${num(item.daysOverdue)} روز تأخیر`}</span>
                        : <span>{`${num(item.daysInStatus)} روز در این وضعیت`}</span>}
                      {item.dueDate && <span>{`سررسید ${formatJalaliDayMonth(item.dueDate)}`}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline-flex"><AvatarStack people={item.assignees} size={24} max={3} /></span>
                    {item.status === 'blocked' && (
                      <button type="button" disabled={busy === item.id} onClick={() => void act(item, 'inprogress')} title="مانع برطرف شد؛ ادامهٔ کار"
                        className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"><Play size={12} />رفع انسداد</button>
                    )}
                    {item.status === 'review' && data.canManage && (<>
                      <button type="button" disabled={busy === item.id} onClick={() => void act(item, 'inprogress')} className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"><RotateCcw size={12} />برگشت</button>
                      <button type="button" disabled={busy === item.id} onClick={() => void act(item, 'completed')} className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"><CheckCircle2 size={12} />تأیید</button>
                    </>)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="col-span-12 xl:col-span-4 space-y-6">
          <Panel title="پروژه‌های در معرض خطر" icon={FolderKanban} bodyClassName="pt-3">
            {data.projects.length === 0 ? <EmptyHint title="همهٔ پروژه‌ها روی برنامه‌اند." /> : (
              <ul className="space-y-3">
                {data.projects.slice(0, 6).map(project => (
                  <li key={project.id}>
                    <button type="button" onClick={() => openProject(project.id)} className="w-full text-start space-y-2 cursor-pointer group">
                      <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600">{project.title}</span><HealthBadge health={project.health} /></div>
                      <ProgressBar value={project.progress} tone={project.health === 'off_track' ? 'rose' : 'amber'} />
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{`${percent(project.progress)} پیشرفت · ${num(project.overdueTasks)} عقب‌افتاده · ${num(project.blockedTasks)} مسدود`}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="عمر موارد" description="هر مورد چند روز است که گیر کرده." icon={Hourglass} bodyClassName="pt-3 space-y-3">
            {([['fresh', '۰ تا ۲ روز', 'bg-slate-400'], ['week', '۳ تا ۷ روز', 'bg-amber-400'], ['fortnight', '۸ تا ۱۴ روز', 'bg-orange-500'], ['older', 'بیش از ۱۴ روز', 'bg-rose-500']] as const).map(([key, label, color]) => (
              <div key={key} className="space-y-1.5">
                <div className="flex justify-between text-[11px]"><span className="text-slate-600 dark:text-slate-300">{label}</span><span className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">{num(data.aging[key])}</span></div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className={cn('h-full rounded-full', color)} style={{ width: `${data.aging[key] / agingTotal * 100}%` }} /></div>
              </div>
            ))}
          </Panel>

          <Panel title="افراد با بیشترین کار گیرکرده" icon={Users} bodyClassName="pt-3">
            {data.people.length === 0 ? <EmptyHint title="کار گیرکرده‌ای به کسی سپرده نشده است." /> : (
              <ul className="space-y-3">
                {data.people.slice(0, 6).map(person => (
                  <li key={person.userId} className="flex items-center gap-3">
                    <Avatar name={person.name} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{person.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{[person.overdue && `${num(person.overdue)} عقب‌افتاده`, person.blocked && `${num(person.blocked)} مسدود`, person.review && `${num(person.review)} بررسی معطل`].filter(Boolean).join(' · ')}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default RiskReview;
