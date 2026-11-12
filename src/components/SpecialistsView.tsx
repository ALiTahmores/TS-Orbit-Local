import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Inbox, Search, UserMinus, UserPlus, Users } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { TeamMember } from '../types';
import { MemberProfileModal } from './MemberProfileModal';
import { AddMemberModal } from './team/AddMemberModal';
import { CustomSelect, CustomSelectOption } from './common/CustomSelect';
import { apiFetch } from '../lib/api';
import { downloadCsv } from '../lib/taskAnalytics';
import { useInsights } from '../hooks/useInsights';
import { cn } from '../lib/utils';
import { Avatar, EmptyHint, PageHeader, PrimaryButton, SecondaryButton, Segmented, StatTile, num, percent, timeAgo } from './ui/dashboard-kit';

interface MemberInsight {
  id: string; name: string; role: string; jobTitle: string; online: boolean; open: number; inProgress: number; review: number; blocked: number; overdue: number;
  completedInRange: number; completedPrevRange: number; onTimeRate: number | null; hoursInRange: number; utilization: number; projects: number; lastActiveAt: string | null; load: 'light' | 'balanced' | 'heavy';
}
interface TeamInsights { range: number; capacityHours: number; totals: { members: number; online: number; open: number; overdue: number; completedInRange: number; hoursInRange: number; unassignedOpen: number; heavy: number }; members: MemberInsight[] }

const STATUS_FILTER_OPTIONS: CustomSelectOption[] = [
  { value: 'all', label: 'همهٔ اعضا' },
  { value: 'online', label: 'آنلاین' },
  { value: 'offline', label: 'آفلاین' },
];
const loadStyles: Record<MemberInsight['load'], { label: string; className: string }> = {
  heavy: { label: 'پربار', className: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' },
  balanced: { label: 'متعادل', className: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' },
  light: { label: 'کم‌بار', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
};

/** Workspace members, how much work each carries, and whether it is moving. */
export const SpecialistsView: React.FC = () => {
  const { teamMembers: contextMembers, tasks, projects, currentUser, getRoleLabel, departments, departmentMembers, activeWorkspaceId, fetchTeamMembers, fetchChatUsers, triggerSuccessEvent } = useProject();
  const { data, reload } = useInsights<TeamInsights>('team');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loadFilter, setLoadFilter] = useState<'all' | MemberInsight['load']>('all');

  const membersList = contextMembers || [];
  const myRole = membersList.find(member => member.id === currentUser?.id)?.role;
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';
  const insightById = useMemo(() => new Map<string, MemberInsight>((data?.members || []).map(row => [row.id, row])), [data]);

  const departmentsByUser = useMemo(() => {
    const names = new Map<string, string>((departments || []).map((department: any) => [department.id, department.name]));
    const result = new Map<string, string[]>();
    for (const row of departmentMembers || []) {
      const name = names.get(row.departmentId);
      if (name) result.set(row.userId, [...(result.get(row.userId) || []), name]);
    }
    return result;
  }, [departments, departmentMembers]);

  const departmentOptions: CustomSelectOption[] = useMemo(() => [
    { value: 'all', label: 'همهٔ دپارتمان‌ها' },
    ...(departments || []).map((department: any) => ({ value: department.id, label: department.name }))
  ], [departments]);

  const online = (member: TeamMember) => insightById.get(member.id)?.online ?? member.status === 'online';
  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return membersList.filter(member => {
      const matchesSearch = !query || member.name.toLowerCase().includes(query) || (member.email || '').toLowerCase().includes(query) || getRoleLabel(member.role).toLowerCase().includes(query);
      const matchesDept = departmentFilter === 'all' || (departmentMembers || []).some((row: any) => row.departmentId === departmentFilter && row.userId === member.id);
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'online') === online(member);
      const matchesLoad = loadFilter === 'all' || insightById.get(member.id)?.load === loadFilter;
      return matchesSearch && matchesDept && matchesStatus && matchesLoad;
    }).sort((a, b) => (insightById.get(b.id)?.open || 0) - (insightById.get(a.id)?.open || 0) || a.name.localeCompare(b.name, 'fa'));
  }, [membersList, searchQuery, departmentFilter, statusFilter, loadFilter, departmentMembers, getRoleLabel, insightById]);

  const openProfile = (member: TeamMember) => { setSelectedMember(member); setIsModalOpen(true); };

  const handleRemove = async (member: TeamMember) => {
    if (!window.confirm(`«${member.name}» از این فضای کاری حذف شود؟ وظایف و سوابق ثبت‌شده باقی می‌مانند.`)) return;
    try {
      await apiFetch(`/api/workspaces/members/${encodeURIComponent(member.id)}?workspaceId=${encodeURIComponent(activeWorkspaceId || '')}`, { method: 'DELETE' });
      await Promise.all([fetchTeamMembers(), fetchChatUsers(), reload()]).catch(() => undefined);
      triggerSuccessEvent('عضو حذف شد', `«${member.name}» دیگر به این فضای کاری دسترسی ندارد.`);
    } catch { /* The request error is shown by the app's error toast. */ }
  };

  const exportMembers = () => {
    const rows = [['نام', 'ایمیل', 'شماره همراه', 'نقش', 'دپارتمان', 'وظایف باز', 'عقب‌افتاده', 'تکمیل‌شده در هفت روز', 'ساعت ثبت‌شده در هفت روز'], ...filteredMembers.map(member => {
      const row = insightById.get(member.id);
      return [member.name, member.email || '', member.phone || '', getRoleLabel(member.role), (departmentsByUser.get(member.id) || []).join('، '),
        String(row?.open ?? 0), String(row?.overdue ?? 0), String(row?.completedInRange ?? 0), String(row?.hoursInRange ?? 0)];
    })];
    downloadCsv('ts-orbit-members.csv', '﻿' + rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\r\n'));
  };

  const totals = data?.totals;
  const previousCompleted = (data?.members || []).reduce((sum, row) => sum + row.completedPrevRange, 0);
  const canRemove = (member: TeamMember) => canManage && member.id !== currentUser?.id && member.role !== 'OWNER';

  return (
    <div className="w-full space-y-6 text-start">
      <PageHeader title="اعضای تیم" description={totals ? `${num(totals.members)} عضو در این فضای کاری؛ ${num(totals.online)} نفر هم‌اکنون آنلاین‌اند.` : `${num(membersList.length)} عضو در این فضای کاری.`}
        actions={<>
          <SecondaryButton icon={Download} onClick={exportMembers} disabled={filteredMembers.length === 0}>خروجی CSV</SecondaryButton>
          {canManage && <PrimaryButton icon={UserPlus} onClick={() => setIsAddMemberModalOpen(true)}>افزودن عضو</PrimaryButton>}
        </>} />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile tone="blue" icon={Users} label="اعضا" value={num(totals?.members ?? membersList.length)} hint={totals ? `${num(totals.online)} نفر آنلاین` : undefined} />
        <StatTile tone="slate" icon={Inbox} label="کارهای باز تیم" value={totals ? num(totals.open) : '…'} hint={totals ? `${num(totals.unassignedOpen)} کار باز بدون مسئول` : undefined} />
        <StatTile tone="rose" icon={AlertTriangle} label="عقب‌افتاده" value={totals ? num(totals.overdue) : '…'} hint={totals ? `${num(totals.heavy)} عضو پربار` : undefined} onClick={() => setLoadFilter(loadFilter === 'heavy' ? 'all' : 'heavy')} active={loadFilter === 'heavy'} />
        <StatTile tone="emerald" icon={CheckCircle2} label="تکمیل در هفت روز" value={totals ? num(totals.completedInRange) : '…'} delta={totals ? { current: totals.completedInRange, previous: previousCompleted } : null} hint={totals ? `${num(totals.hoursInRange, 1)} ساعت کار ثبت‌شده` : undefined} />
      </div>

      <div className="flex flex-col xl:flex-row xl:items-center gap-3">
        <label className="relative flex-1">
          <Search size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="جستجو بر اساس نام، ایمیل یا نقش…" aria-label="جستجوی اعضا"
            className="w-full h-10 ps-10 pe-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="بار کاری" value={loadFilter} onChange={setLoadFilter} options={[{ value: 'all', label: 'همه' }, { value: 'heavy', label: 'پربار' }, { value: 'balanced', label: 'متعادل' }, { value: 'light', label: 'کم‌بار' }]} />
          {(departments || []).length > 0 && <div className="w-44"><CustomSelect options={departmentOptions} value={departmentFilter} onChange={setDepartmentFilter} buttonClassName="text-xs font-bold py-2" /></div>}
          <div className="w-36"><CustomSelect options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={setStatusFilter} buttonClassName="text-xs font-bold py-2" /></div>
        </div>
      </div>

      {filteredMembers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f]">
          <EmptyHint icon={Users} title={membersList.length === 0 ? 'هنوز عضوی به این فضای کاری اضافه نشده است.' : 'عضوی با این مشخصات پیدا نشد.'} action={canManage && membersList.length === 0 ? <PrimaryButton icon={UserPlus} onClick={() => setIsAddMemberModalOpen(true)}>افزودن عضو</PrimaryButton> : undefined} />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] overflow-hidden">
          <div className="hidden lg:grid grid-cols-[minmax(0,2.2fr)_repeat(4,minmax(0,1fr))_minmax(0,1.4fr)_minmax(0,1fr)_44px] gap-4 px-5 h-11 items-center bg-slate-50 dark:bg-slate-900/50 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <span>عضو</span><span>کارهای باز</span><span>عقب‌افتاده</span><span>تکمیل در هفت روز</span><span>به‌موقع</span><span>ساعت کار و ظرفیت</span><span>آخرین فعالیت</span><span />
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {filteredMembers.map(member => {
              const row = insightById.get(member.id), departmentsText = (departmentsByUser.get(member.id) || []).join('، ');
              return (
                <li key={member.id} className="grid grid-cols-2 lg:grid-cols-[minmax(0,2.2fr)_repeat(4,minmax(0,1fr))_minmax(0,1.4fr)_minmax(0,1fr)_44px] gap-x-4 gap-y-3 px-5 py-4 items-center">
                  <button type="button" onClick={() => openProfile(member)} className="col-span-2 lg:col-span-1 flex items-center gap-3 min-w-0 text-start cursor-pointer group">
                    <Avatar name={member.name} size={38} online={online(member)} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2"><span className="text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600">{member.name}</span>{row && <span className={cn('h-5 px-1.5 rounded text-[10px] font-bold inline-flex items-center shrink-0', loadStyles[row.load].className)}>{loadStyles[row.load].label}</span>}</span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">{[getRoleLabel(member.role), departmentsText].filter(Boolean).join(' · ')}</span>
                    </span>
                  </button>
                  <Metric label="کارهای باز" value={num(row?.open ?? 0)} detail={row && (row.review || row.blocked) ? `${num(row.review)} در بررسی · ${num(row.blocked)} مسدود` : undefined} />
                  <Metric label="عقب‌افتاده" value={num(row?.overdue ?? 0)} danger={!!row?.overdue} />
                  <Metric label="تکمیل در هفت روز" value={num(row?.completedInRange ?? 0)} detail={row ? `هفتهٔ قبل ${num(row.completedPrevRange)}` : undefined} />
                  <Metric label="به‌موقع" value={percent(row?.onTimeRate ?? null)} />
                  <div className="col-span-2 lg:col-span-1 space-y-1.5">
                    <div className="flex justify-between text-[11px]"><span className="lg:hidden text-slate-500">ساعت کار و ظرفیت</span><span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">{`${num(row?.hoursInRange ?? 0, 1)} ساعت`}</span><span className="text-slate-400 tabular-nums">{percent(row?.utilization ?? 0)}</span></div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className={cn('h-full rounded-full', (row?.utilization || 0) > 100 ? 'bg-rose-500' : 'bg-blue-600')} style={{ width: `${Math.min(100, row?.utilization || 0)}%` }} /></div>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{row?.lastActiveAt ? timeAgo(row.lastActiveAt) : '—'}</span>
                  <span className="flex justify-end">
                    {canRemove(member) && <button type="button" onClick={() => void handleRemove(member)} aria-label={`حذف ${member.name} از فضای کاری`} title="حذف از فضای کاری" className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"><UserMinus size={16} /></button>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <MemberProfileModal member={selectedMember} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} allTasks={tasks} allProjects={projects} />
      <AddMemberModal isOpen={isAddMemberModalOpen} onClose={() => { setIsAddMemberModalOpen(false); void reload(); }} />
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; detail?: string; danger?: boolean }> = ({ label, value, detail, danger }) => (
  <div className="min-w-0">
    <span className="lg:hidden block text-[10px] text-slate-500 dark:text-slate-400">{label}</span>
    <span className={cn('block text-sm font-black tabular-nums', danger ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100')}>{value}</span>
    {detail && <span className="block text-[10px] text-slate-400 truncate">{detail}</span>}
  </div>
);

export const TeamMembersSubView = SpecialistsView;
export default SpecialistsView;
