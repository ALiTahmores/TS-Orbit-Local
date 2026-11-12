import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, ClipboardList, Clock, FolderKanban, History, Inbox, ListChecks, Plus, RotateCcw, ShieldCheck, Users
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useProject } from '../context/ProjectContext';
import { useInsights } from '../hooks/useInsights';
import { CustomSelect } from './common/CustomSelect';
import { PremiumAnalytics } from './widgets/PremiumAnalytics';
import { TeamWorkloadBalanceWidget } from './widgets/TeamWorkloadBalanceWidget';
import { WeeklyTimesheetWidget } from './widgets/WeeklyTimesheetWidget';
import { activityLabel } from '../lib/activityLabels';
import { formatJalaliDate, formatJalaliDayMonth } from '../lib/dates';
import { statusLabel } from '../lib/taskLabels';
import { isEnglish } from '../lib/locale';
import {
  AvatarStack, EmptyHint, HealthBadge, PageHeader, Panel, PrimaryButton, ProgressBar, SecondaryButton, Segmented, StatTile, num, percent, timeAgo, type Health
} from './ui/dashboard-kit';

interface TaskRef { id: string; title: string; projectId: string; projectTitle: string; status: string; priority: string; dueDate: string | null; daysOverdue: number; daysInStatus: number; assignees: { id: string; name: string }[] }
interface ProjectRow { id: string; title: string; progress: number; health: Health; openTasks: number; overdueTasks: number; blockedTasks: number; daysLeft: number | null; dueDate: string | null; lead: { id: string; name: string } | null; memberIds: string[] }
interface Overview {
  today: string; range: number; canManage: boolean;
  kpis: { activeProjects: number; totalProjects: number; openTasks: number; createdInRange: number; createdPrevRange: number; overdueTasks: number; dueThisWeek: number; completedInRange: number; completedPrevRange: number; onTimeRate: number | null; hoursInRange: number; hoursPrevRange: number };
  myWork: { overdue: TaskRef[]; today: TaskRef[]; upcoming: TaskRef[]; review: TaskRef[]; unscheduled: number };
  projects: ProjectRow[];
}

const priorityDot: Record<string, string> = { critical: 'bg-rose-500', urgent: 'bg-rose-500', high: 'bg-amber-500', medium: 'bg-blue-500', low: 'bg-slate-400' };

const DueLabel: React.FC<{ task: TaskRef; today: string }> = ({ task, today }) => {
  if (task.daysOverdue > 0) return <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">{`${num(task.daysOverdue)} روز تأخیر`}</span>;
  if (task.dueDate === today) return <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">امروز</span>;
  return <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{task.dueDate ? formatJalaliDayMonth(task.dueDate) : '—'}</span>;
};

/** The member's own queue: late, due today, coming up this week, and work waiting for review. */
const MyWork: React.FC<{ data: Overview; onOpen: () => void; onReview: (task: TaskRef, approve: boolean) => Promise<void> }> = ({ data, onOpen, onReview }) => {
  const groups = data.myWork;
  const initial = groups.overdue.length ? 'overdue' : groups.today.length ? 'today' : groups.upcoming.length ? 'upcoming' : groups.review.length ? 'review' : 'today';
  const [tab, setTab] = useState<'overdue' | 'today' | 'upcoming' | 'review'>(initial);
  const [busy, setBusy] = useState('');
  const rows = groups[tab];
  const review = async (task: TaskRef, approve: boolean) => { setBusy(task.id); try { await onReview(task, approve); } finally { setBusy(''); } };
  const empty = {
    overdue: 'هیچ کار عقب‌افتاده‌ای ندارید.', today: 'برای امروز کاری با سررسید ثبت نشده است.',
    upcoming: 'تا هفت روز آینده کاری با سررسید ندارید.', review: data.canManage ? 'کاری منتظر تأیید شما نیست.' : 'کاری از شما در انتظار بررسی نیست.',
  }[tab];
  return (
    <Panel title="کارهای من" description={groups.unscheduled ? `${num(groups.unscheduled)} کار باز شما سررسید ندارد.` : 'کارهایی که به شما سپرده شده یا منتظر تصمیم شماست.'} icon={ListChecks}
      action={<button type="button" onClick={onOpen} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">همهٔ کارها<ArrowLeft size={14} className="ltr:rotate-180" /></button>}
      className="col-span-12 xl:col-span-7" bodyClassName="pt-4 space-y-3">
      <Segmented label="دستهٔ کارها" value={tab} onChange={setTab} options={[
        { value: 'overdue', label: 'عقب‌افتاده', count: groups.overdue.length },
        { value: 'today', label: 'امروز', count: groups.today.length },
        { value: 'upcoming', label: 'این هفته', count: groups.upcoming.length },
        { value: 'review', label: data.canManage ? 'منتظر تأیید' : 'در بررسی', count: groups.review.length },
      ]} />
      {rows.length === 0 ? <EmptyHint icon={CheckCircle2} title={empty} /> : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
          {rows.map(task => (
            <li key={task.id} className="py-3 flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full shrink-0 ${priorityDot[task.priority] || priorityDot.medium}`} title={task.priority} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate">{task.title}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{task.projectTitle || 'بدون پروژه'} · {statusLabel(task.status, isEnglish() ? 'en' : 'fa')}</p>
              </div>
              {tab === 'review' && data.canManage ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button type="button" disabled={busy === task.id} onClick={() => void review(task, false)} className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"><RotateCcw size={13} />برگشت</button>
                  <button type="button" disabled={busy === task.id} onClick={() => void review(task, true)} className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"><CheckCircle2 size={13} />تأیید</button>
                </div>
              ) : <DueLabel task={task} today={data.today} />}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};

const ProjectHealth: React.FC<{ rows: ProjectRow[]; names: Map<string, string>; onOpen: (id: string) => void }> = ({ rows, names, onOpen }) => (
  <Panel title="سلامت پروژه‌ها" description="پروژه‌های باز، از پرخطرترین." icon={FolderKanban} className="col-span-12 xl:col-span-5" bodyClassName="pt-3">
    {rows.length === 0 ? <EmptyHint icon={FolderKanban} title="پروژهٔ بازی وجود ندارد." /> : (
      <ul className="space-y-1">
        {rows.map(row => (
          <li key={row.id}>
            <button type="button" onClick={() => onOpen(row.id)} className="w-full text-start p-3 -mx-1 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate">{row.title}</span>
                <HealthBadge health={row.health} />
              </div>
              <div className="flex items-center gap-3">
                <ProgressBar value={row.progress} className="flex-1" tone={row.health === 'off_track' ? 'rose' : row.health === 'at_risk' ? 'amber' : 'blue'} />
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 tabular-nums w-10 text-end">{percent(row.progress)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>{`${num(row.openTasks)} کار باز`}</span>
                  {row.overdueTasks > 0 && <span className="text-rose-600 dark:text-rose-400 font-bold">{`${num(row.overdueTasks)} عقب‌افتاده`}</span>}
                  {row.blockedTasks > 0 && <span className="text-amber-600 dark:text-amber-400 font-bold">{`${num(row.blockedTasks)} مسدود`}</span>}
                  {row.daysLeft !== null && <span>{row.daysLeft < 0 ? `${num(-row.daysLeft)} روز گذشته از موعد` : `${num(row.daysLeft)} روز تا موعد`}</span>}
                </span>
                <AvatarStack people={row.memberIds.map(id => ({ id, name: names.get(id) || '' })).filter(person => person.name)} size={22} max={3} />
              </div>
            </button>
          </li>
        ))}
      </ul>
    )}
  </Panel>
);

const ActivityFeed: React.FC<{ rows: any[] }> = ({ rows }) => (
  <Panel title="فعالیت‌های اخیر" description="آخرین تغییرات فضای کاری." icon={History} className="col-span-12 lg:col-span-6 xl:col-span-4" bodyClassName="pt-3">
    {rows.length === 0 ? <EmptyHint icon={History} title="هنوز فعالیتی ثبت نشده است." /> : (
      <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:start-[7px] before:w-px before:bg-slate-200 dark:before:bg-slate-800">
        {rows.slice(0, 7).map(row => (
          <li key={row.id} className="relative ps-6">
            <span className="absolute start-0 top-1.5 w-[15px] h-[15px] rounded-full bg-white dark:bg-[#0d121f] border-2 border-blue-500" />
            <p className="text-xs text-slate-700 dark:text-slate-200 leading-5"><span className="font-bold">{row.user || 'سیستم'}</span> {activityLabel(row.action)}{row.targetName ? <span className="text-slate-500 dark:text-slate-400"> · {row.targetName}</span> : null}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(row.timestamp)}</p>
          </li>
        ))}
      </ol>
    )}
  </Panel>
);

export const DashboardView: React.FC = () => {
  const { projects, tasks, teamMembers, selectedProject, setSelectedProject, deleteProject, setActiveTab, setActiveSubTab, currentUser, openNewProjectModal, updateTaskStatus, activityLogs, userRole } = useProject();
  const [range, setRange] = useState<'7' | '30'>('7');
  const { data } = useInsights<Overview>('overview', Number(range));
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const canCreateProject = ['OWNER', 'ADMIN', 'MANAGER', 'PROJECT_MANAGER'].includes(String(userRole).toUpperCase());

  useEffect(() => {
    if (currentUser?.systemRole !== 'ADMIN') return;
    apiFetch('/api/owner/approval-stats').then(response => response.json()).then(stats => { if (typeof stats?.pendingCount === 'number') setPendingApprovals(stats.pendingCount); }).catch(() => undefined);
  }, [currentUser?.systemRole]);

  const names = useMemo(() => new Map<string, string>((teamMembers || []).map(member => [member.id, member.name])), [teamMembers]);
  const go = (tab: string, sub: string) => { setActiveTab(tab); setActiveSubTab(sub); };
  const openProject = (id: string) => { const project = projects.find(row => row.id === id); if (project) setSelectedProject(project); go('projects', 'overview'); };
  const firstName = String(currentUser?.name || '').trim().split(/\s+/)[0] || '';
  const today = new Date();

  if (!projects.length) {
    return (
      <div className="w-full space-y-6 text-start">
        <PageHeader eyebrow={formatJalaliDate(today)} title={firstName ? `خوش آمدید، ${firstName}` : 'خوش آمدید'} description="این فضای کاری هنوز پروژه‌ای ندارد. با ساخت اولین پروژه، وظایف، تیم‌ها و گزارش‌ها از همین‌جا قابل پیگیری می‌شوند." />
        <Panel className="max-w-2xl">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: FolderKanban, title: 'پروژه بسازید', text: 'عنوان، موعد و تیم مسئول را مشخص کنید.' },
              { icon: ClipboardList, title: 'وظایف را بچینید', text: 'کارها را به اعضا بسپارید و سررسید بگذارید.' },
              { icon: ShieldCheck, title: 'پیشرفت را ببینید', text: 'عقب‌افتادگی‌ها و موانع خودکار اینجا می‌آیند.' },
            ].map(step => (
              <div key={step.title} className="space-y-2">
                <span className="w-9 h-9 rounded-xl bg-[#E8F1FF] dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 inline-flex items-center justify-center"><step.icon size={18} /></span>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{step.title}</p>
                <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">{step.text}</p>
              </div>
            ))}
          </div>
          {canCreateProject && <PrimaryButton icon={Plus} onClick={openNewProjectModal} className="mt-6">ثبت اولین پروژه</PrimaryButton>}
        </Panel>
      </div>
    );
  }

  const k = data?.kpis;
  const rangeLabel = range === '7' ? 'هفت روز' : 'سی روز';
  return (
    <div className="w-full space-y-6 text-start">
      <PageHeader eyebrow={formatJalaliDate(today)} title={firstName ? `سلام، ${firstName}` : 'میز کار'}
        description={k ? `${num(k.openTasks)} کار باز در فضای کاری؛ ${num(k.overdueTasks)} مورد از موعد گذشته و ${num(k.dueThisWeek)} مورد سررسید این هفته است.` : 'خلاصهٔ وضعیت پروژه‌ها و کارهای شما.'}
        actions={<>
          <Segmented label="بازهٔ زمانی" value={range} onChange={setRange} options={[{ value: '7', label: '۷ روز' }, { value: '30', label: '۳۰ روز' }]} />
          <div className="w-52">
            <CustomSelect options={projects.map(project => ({ value: project.id, label: project.title }))} value={selectedProject?.id || ''}
              onChange={value => { const project = projects.find(row => row.id === value); if (project) setSelectedProject(project); }}
              onDeleteOption={canCreateProject ? (value => { const project = projects.find(row => row.id === value); if (project && window.confirm(`آیا از حذف پروژه "${project.title}" اطمینان دارید؟`)) deleteProject(value); }) : undefined}
              deleteTooltip="حذف پروژه" buttonClassName="text-xs font-bold py-2" />
          </div>
          {canCreateProject && <PrimaryButton icon={Plus} onClick={openNewProjectModal}>پروژهٔ جدید</PrimaryButton>}
        </>} />

      {currentUser?.systemRole === 'ADMIN' && pendingApprovals > 0 && (
        <div role="status" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10">
          <div className="flex items-start gap-3">
            <Users size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200">{`${num(pendingApprovals)} درخواست عضویت منتظر بررسی است`}</p>
              <p className="text-xs text-amber-800/80 dark:text-amber-200/70 mt-0.5">هویت و نقش اعضای جدید را پیش از دسترسی به فضای کاری تأیید کنید.</p>
            </div>
          </div>
          <SecondaryButton onClick={() => go('approvals', 'approval_queue')}>بررسی درخواست‌ها</SecondaryButton>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile tone="blue" icon={FolderKanban} label="پروژه‌های فعال" value={k ? num(k.activeProjects) : '…'} hint={k ? `از ${num(k.totalProjects)} پروژهٔ فضای کاری` : undefined} onClick={() => go('projects', 'overview')} />
        <StatTile tone="slate" icon={Inbox} label="کارهای باز" value={k ? num(k.openTasks) : '…'} delta={k ? { current: k.createdInRange, previous: k.createdPrevRange, goodWhenUp: false } : null} hint={k ? `${num(k.createdInRange)} کار تازه در ${rangeLabel} اخیر` : undefined} onClick={() => go('tasks', 'kanban_board')} />
        <StatTile tone="rose" icon={AlertTriangle} label="عقب‌افتاده" value={k ? num(k.overdueTasks) : '…'} hint={k ? `${num(k.dueThisWeek)} کار سررسید این هفته` : undefined} onClick={() => go('dept_tech', 'bottlenecks')} />
        <StatTile tone="emerald" icon={CheckCircle2} label="تکمیل‌شده" value={k ? num(k.completedInRange) : '…'} delta={k ? { current: k.completedInRange, previous: k.completedPrevRange } : null} hint={k ? (k.onTimeRate === null ? `در ${rangeLabel} اخیر` : `${percent(k.onTimeRate)} به‌موقع در ${rangeLabel} اخیر`) : undefined} onClick={() => go('dept_tech', 'analytics')} />
      </div>

      <PremiumAnalytics tasks={tasks} projects={projects} selectedProject={selectedProject} isRtl={!isEnglish()} />

      {data && (
        <div className="grid grid-cols-12 gap-6">
          <MyWork data={data} onOpen={() => go('personal_tasks', 'my_tasks')} onReview={(task, approve) => updateTaskStatus(task.id, approve ? 'completed' : 'inprogress')} />
          <ProjectHealth rows={data.projects} names={names} onOpen={openProject} />
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <ActivityFeed rows={activityLogs || []} />
        <div className="col-span-12 lg:col-span-6 xl:col-span-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] p-5"><TeamWorkloadBalanceWidget borderless /></div>
        <div className="col-span-12 xl:col-span-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] p-5"><WeeklyTimesheetWidget borderless /></div>
      </div>

      {k && (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-400"><Clock size={12} />{`${num(k.hoursInRange, 1)} ساعت کار در ${rangeLabel} اخیر ثبت شده است.`}<CalendarClock size={12} className="ms-2" />{`داده‌ها تا ${formatJalaliDate(today)}`}</p>
      )}
    </div>
  );
};

export default DashboardView;
