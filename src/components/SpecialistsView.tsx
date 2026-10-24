import { LocalImage } from './common/LocalImage';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { TeamMember, Task } from '../types';
import { MemberProfileModal } from './MemberProfileModal';
import { AddMemberModal } from './team/AddMemberModal';
import { CustomSelect, CustomSelectOption } from './common/CustomSelect';
import { apiFetch } from '../lib/api';
import { downloadCsv, isOverdue, tasksAssignedTo } from '../lib/taskAnalytics';
import {
  Users,
  Search,
  Mail,
  MoreVertical,
  UserCheck,
  Download,
  Phone,
  UserMinus
} from 'lucide-react';

const STATUS_FILTER_OPTIONS: CustomSelectOption[] = [
  { value: 'all', label: 'همهٔ اعضا' },
  { value: 'online', label: 'آنلاین' },
  { value: 'offline', label: 'آفلاین' },
];

const toPersianDigits = (n: string | number): string => {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (x) => farsiDigits[parseInt(x, 10)]);
};

const isOpenTask = (task: Task) => task.status !== 'completed' && task.status !== 'cancelled';

interface MemberCardProps {
  member: TeamMember;
  tasks: Task[];
  roleLabel: string;
  departmentNames: string[];
  canRemove: boolean;
  onOpenProfile: (member: TeamMember) => void;
  onRemove: (member: TeamMember) => void;
}

const MemberCardItem: React.FC<MemberCardProps> = ({ member, tasks, roleLabel, departmentNames, canRemove, onOpenProfile, onRemove }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const openTasks = tasksAssignedTo(tasks, member.id).filter(isOpenTask);
  const overdueCount = openTasks.filter(task => isOverdue(task)).length;

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm transition-all duration-300 ease-out relative hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 group flex flex-col justify-between space-y-4 ${
        isMenuOpen ? 'z-30 relative' : 'relative z-0'
      }`}
    >
      {/* MEMBER MENU */}
      <div ref={menuRef} className="absolute top-3.5 right-3.5 z-20">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen(!isMenuOpen);
          }}
          aria-label={`گزینه‌های ${member.name}`}
          aria-expanded={isMenuOpen}
          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <MoreVertical size={18} />
        </button>

        {isMenuOpen && (
          <div className="absolute top-10 right-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 w-52 text-xs font-sans text-right animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(false);
                onOpenProfile(member);
              }}
              className="w-full text-right px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-2 rounded-xl cursor-pointer transition-colors"
            >
              <UserCheck size={14} className="text-blue-500 shrink-0" />
              <span>مشاهدهٔ پروفایل و وظایف</span>
            </button>

            {canRemove && (
              <>
                <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    onRemove(member);
                  }}
                  className="w-full text-right px-3 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2 rounded-xl cursor-pointer transition-colors"
                >
                  <UserMinus size={14} className="text-rose-500 shrink-0" />
                  <span>حذف از فضای کاری</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* CENTER PROFILE BLOCK */}
      <button
        type="button"
        onClick={() => onOpenProfile(member)}
        className="flex flex-col items-center text-center space-y-1.5 pt-1 cursor-pointer"
      >
        <div className="relative">
          <LocalImage
            src={member.avatar}
            alt={member.name}
            className="w-16 h-16 rounded-full object-cover ring-4 ring-slate-100 dark:ring-slate-800 shadow-sm group-hover:scale-105 transition-transform"
          />
          <span
            title={member.status === 'online' ? 'آنلاین' : 'آفلاین'}
            className={`absolute bottom-0 left-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
              member.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
          />
        </div>

        <h3 className="font-black text-slate-900 dark:text-slate-100 text-sm group-hover:text-blue-600 transition-colors pt-1">
          {member.name}
        </h3>

        <p className="text-[11px] text-slate-400 truncate max-w-[190px]" dir={member.email ? 'ltr' : undefined}>
          {member.email || 'ایمیل ثبت نشده'}
        </p>
      </button>

      {/* ROLE AND WORKLOAD */}
      <div className="py-2.5 my-1 border-y border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-xs font-sans">
        <div className="space-y-0.5 pr-1 min-w-0">
          <span className="text-[10px] text-slate-400 font-bold block">نقش</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 text-xs block truncate">{roleLabel}</span>
          {departmentNames.length > 0 && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">{departmentNames.join('، ')}</span>
          )}
        </div>

        <div className="space-y-0.5 pl-1 border-r border-slate-100 dark:border-slate-800/80 pr-2 min-w-0">
          <span className="text-[10px] text-slate-400 font-bold block">وظایف باز</span>
          <span className="font-black text-slate-800 dark:text-slate-100 text-xs block">
            {openTasks.length ? toPersianDigits(openTasks.length) : 'ندارد'}
          </span>
          {overdueCount > 0 && (
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block">{toPersianDigits(overdueCount)} دارای تأخیر</span>
          )}
        </div>
      </div>

      {/* CONTACT ACTIONS */}
      <div className="flex items-center gap-2">
        <a
          href={member.email ? `mailto:${member.email}` : undefined}
          aria-disabled={!member.email}
          onClick={(e) => { if (!member.email) e.preventDefault(); }}
          className={`bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-medium py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 flex-1 transition-all duration-200 ${member.email ? 'hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
        >
          <Mail size={14} className="shrink-0" />
          <span>ایمیل</span>
        </a>

        <a
          href={member.phone ? `tel:${member.phone}` : undefined}
          aria-disabled={!member.phone}
          onClick={(e) => { if (!member.phone) e.preventDefault(); }}
          title={member.phone ? undefined : 'شماره‌ای ثبت نشده است'}
          className={`bg-blue-50/60 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 flex-1 transition-all duration-200 ${member.phone ? 'hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
        >
          <Phone size={14} className="shrink-0" />
          <span>تماس</span>
        </a>
      </div>
    </div>
  );
};

export const SpecialistsView: React.FC = () => {
  const { teamMembers: contextMembers, tasks, projects, currentUser, getRoleLabel, departments, departmentMembers, activeWorkspaceId, fetchTeamMembers, fetchChatUsers, triggerSuccessEvent } = useProject();

  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const membersList = contextMembers || [];
  const myRole = membersList.find(member => member.id === currentUser?.id)?.role;
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';

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

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return membersList.filter(member => {
      const matchesSearch = !query ||
        member.name.toLowerCase().includes(query) ||
        (member.email || '').toLowerCase().includes(query) ||
        getRoleLabel(member.role).toLowerCase().includes(query);
      const matchesDept = departmentFilter === 'all' || (departmentMembers || []).some((row: any) => row.departmentId === departmentFilter && row.userId === member.id);
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'online') === (member.status === 'online');
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [membersList, searchQuery, departmentFilter, statusFilter, departmentMembers, getRoleLabel]);

  const handleOpenProfile = (member: TeamMember) => {
    setSelectedMember(member);
    setIsModalOpen(true);
  };

  const handleRemove = async (member: TeamMember) => {
    if (!window.confirm(`«${member.name}» از این فضای کاری حذف شود؟ وظایف و سوابق ثبت‌شده باقی می‌مانند.`)) return;
    try {
      await apiFetch(`/api/workspaces/members/${encodeURIComponent(member.id)}?workspaceId=${encodeURIComponent(activeWorkspaceId || '')}`, { method: 'DELETE' });
      await Promise.all([fetchTeamMembers(), fetchChatUsers()]).catch(() => undefined);
      triggerSuccessEvent('عضو حذف شد', `«${member.name}» دیگر به این فضای کاری دسترسی ندارد.`);
    } catch { /* The request error is shown by the app's error toast. */ }
  };

  const exportMembers = () => {
    const rows = [['نام', 'ایمیل', 'شماره همراه', 'نقش', 'دپارتمان', 'وظایف باز'], ...filteredMembers.map(member => [
      member.name, member.email || '', member.phone || '', getRoleLabel(member.role),
      (departmentsByUser.get(member.id) || []).join('، '),
      String(tasksAssignedTo(tasks, member.id).filter(isOpenTask).length)
    ])];
    downloadCsv('ts-orbit-members.csv', '﻿' + rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\r\n'));
  };

  return (
    <div className="w-full space-y-4 font-sans text-right pt-1" dir="rtl">

      {/* HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100">
            اعضای تیم
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-3xl leading-relaxed">
            {`${toPersianDigits(membersList.length)} عضو در این فضای کاری. برای دیدن وظایف هر نفر روی کارت او کلیک کنید.`}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {canManage && (
            <button
              type="button"
              onClick={() => setIsAddMemberModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Users size={16} />
              <span>افزودن عضو</span>
            </button>
          )}

          <button
            type="button"
            onClick={exportMembers}
            disabled={filteredMembers.length === 0}
            className="hidden sm:flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={15} />
            <span>خروجی CSV</span>
          </button>
        </div>
      </div>

      {/* SEARCH & FILTERS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3.5 top-3 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو بر اساس نام، ایمیل یا نقش…"
            aria-label="جستجوی اعضا"
            className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 min-w-0">
          {(departments || []).length > 0 && (
            <div className="w-48">
              <CustomSelect
                options={departmentOptions}
                value={departmentFilter}
                onChange={(val) => setDepartmentFilter(val)}
                buttonClassName="bg-white dark:bg-[#121621] border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-xs shadow-xs hover:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all"
              />
            </div>
          )}

          <div className="w-40">
            <CustomSelect
              options={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              buttonClassName="bg-white dark:bg-[#121621] border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-xs shadow-xs hover:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all"
            />
          </div>
        </div>
      </div>

      {/* MEMBER CARDS */}
      {filteredMembers.length === 0 ? (
        <div className="col-span-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 font-bold space-y-2">
          <Users size={32} className="mx-auto text-slate-300 dark:text-slate-700" />
          <p>{membersList.length === 0 ? 'هنوز عضوی به این فضای کاری اضافه نشده است.' : 'عضوی با این مشخصات پیدا نشد.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {filteredMembers.map((member) => (
            <MemberCardItem
              key={member.id}
              member={member}
              tasks={tasks}
              roleLabel={getRoleLabel(member.role)}
              departmentNames={departmentsByUser.get(member.id) || []}
              canRemove={canManage && member.id !== currentUser?.id && member.role !== 'OWNER'}
              onOpenProfile={handleOpenProfile}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      <MemberProfileModal
        member={selectedMember}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        allTasks={tasks}
        allProjects={projects}
      />

      <AddMemberModal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
      />

    </div>
  );
};

export const TeamMembersSubView = SpecialistsView;
export default SpecialistsView;
