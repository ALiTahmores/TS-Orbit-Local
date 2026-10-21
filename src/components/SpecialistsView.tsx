import { LocalImage } from './common/LocalImage';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { TeamMember, Task } from '../types';
import { MemberProfileModal } from './MemberProfileModal';
import { AddSpecialistModal } from './specialists/AddSpecialistModal';
import { AddMemberModal } from './team/AddMemberModal';
import { CustomSelect, CustomSelectOption } from './common/CustomSelect';
import { 
  Users, 
  Search, 
  Filter, 
  Star, 
  Mail, 
  MessageSquare, 
  MoreVertical, 
  Sparkles, 
  UserCheck, 
  TrendingUp, 
  BarChart2, 
  CheckCircle2, 
  Plus, 
  Download,
  Phone,
  Briefcase,
  Zap,
  SlidersHorizontal,
  Shield,
  Activity
} from 'lucide-react';

const DEPARTMENT_FILTER_OPTIONS: CustomSelectOption[] = [
  { value: 'all', label: 'همه دپارتمان‌ها' },
  { value: 'wp_dev', label: 'توسعه وب و وردپرس' },
  { value: 'ui_ux', label: 'طراحی UI/UX' },
  { value: 'seo', label: 'سئو و بهینه‌سازی' },
  { value: 'content', label: 'تولید محتوا' },
  { value: 'qa', label: 'تضمین کیفیت QA' },
  { value: 'client_approval', label: 'تاییدیه کارفرما' },
];

const STATUS_FILTER_OPTIONS: CustomSelectOption[] = [
  { value: 'all', label: 'وضعیت فعالیت (همه)' },
  { value: 'online', label: 'آنلاین و فعال' },
  { value: 'offline', label: 'آفلاین' },
  { value: 'away', label: 'مشغول / Away' },
];

const EFFICIENCY_FILTER_OPTIONS: CustomSelectOption[] = [
  { value: 'all', label: 'سطح راندمان (همه)' },
  { value: 'top', label: 'ممتاز (بالای ۹۰٪)' },
  { value: 'normal', label: 'عادی (۷۰٪ تا ۹۰٪)' },
];

const toPersianDigits = (n: string | number): string => {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (x) => farsiDigits[parseInt(x, 10)]);
};

// Helper for Persian digits


interface MemberCardProps {
  member: TeamMember;
  tasks: Task[];
  onOpenProfile: (member: TeamMember) => void;
  onToggleStatus: (memberId: string) => void;
}

const MemberCardItem: React.FC<MemberCardProps> = ({ member, tasks, onOpenProfile, onToggleStatus }) => {
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

  const memberTasks = tasks.filter(
    t => t.assignedTo === member.name || t.assignedTo === member.id
  );
  const activeTaskCount = memberTasks.length || member.taskCount || 4;

  let deptLabel = "توسعه فرانت‌اند";
  if (member.department === 'ui_ux') deptLabel = "طراحی UI/UX";
  if (member.department === 'seo') deptLabel = "سئو و مارکتینگ";
  if (member.department === 'content') deptLabel = "تولید محتوا";
  if (member.department === 'qa') deptLabel = "تضمین کیفیت QA";

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm transition-all duration-300 ease-out relative hover:-translate-y-1.5 hover:shadow-xl hover:border-slate-300 dark:hover:border-slate-700 group flex flex-col justify-between space-y-4 ${
        isMenuOpen ? 'z-30 relative' : 'relative z-0'
      }`}
    >
      {/* ATTACHED LEFT RATING BADGE (ALIGNED WITH AVATAR MIDPOINT) */}
      <div className="absolute left-0 top-[88px] bg-amber-50/90 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold px-2.5 py-1 rounded-r-xl border-y border-r border-amber-200/80 dark:border-amber-800/60 text-xs shadow-2xs flex items-center gap-1 z-10">
        <Star size={12} className="fill-amber-400 text-amber-400 shrink-0" />
        <span>{toPersianDigits("۴.۵")}</span>
      </div>

      {/* TOP-RIGHT ADMIN 3-DOT MENU */}
      <div ref={menuRef} className="absolute top-3.5 right-3.5 z-20">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen(!isMenuOpen);
          }}
          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="منوی مدیریت اعضا"
        >
          <MoreVertical size={18} />
        </button>

        {/* FUNCTIONAL 3-DOT POPOVER DROPDOWN (Z-50 STACKING) */}
        {isMenuOpen && (
          <div className="absolute top-10 right-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 w-52 text-xs font-sans text-right animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-1">
              <span className="text-[10px] text-slate-400 font-bold block">تنظیمات عضویت</span>
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 truncate block">{member.name}</span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(false);
                onOpenProfile(member);
              }}
              className="w-full text-right px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-2 rounded-xl cursor-pointer transition-colors"
            >
              <UserCheck size={14} className="text-blue-500 shrink-0" />
              <span>ارتقای نقش</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(false);
                onOpenProfile(member);
              }}
              className="w-full text-right px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-2 rounded-xl cursor-pointer transition-colors"
            >
              <SlidersHorizontal size={14} className="text-indigo-500 shrink-0" />
              <span>ویرایش پروفایل</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(false);
                onToggleStatus(member.id);
              }}
              className="w-full text-right px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-2 rounded-xl cursor-pointer transition-colors"
            >
              <Activity size={14} className="text-emerald-500 shrink-0" />
              <span>تغییر وضعیت</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(false);
                onOpenProfile(member);
              }}
              className="w-full text-right px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-2 rounded-xl cursor-pointer transition-colors"
            >
              <Sparkles size={14} className="text-amber-500 shrink-0" />
              <span>دسترسی‌ها</span>
            </button>

            <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(false);
                alert(`عضویت ${member.name} به حالت تعلیق درآمد.`);
              }}
              className="w-full text-right px-3 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2 rounded-xl cursor-pointer transition-colors"
            >
              <Shield size={14} className="text-rose-500 shrink-0" />
              <span>تعلیق عضویت</span>
            </button>
          </div>
        )}
      </div>

      {/* CENTER PROFILE BLOCK */}
      <div 
        onClick={() => onOpenProfile(member)}
        className="flex flex-col items-center text-center space-y-1.5 pt-1 cursor-pointer"
      >
        <div className="relative">
          <LocalImage
            src={member.avatar || "/avatars/avatar-5.svg"}
            alt={member.name}
            className="w-16 h-16 rounded-full object-cover ring-4 ring-slate-100 dark:ring-slate-800 shadow-sm group-hover:scale-105 transition-transform"
          />
          <span className={`absolute bottom-0 left-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
            member.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'
          }`} />
        </div>

        <h3 className="font-black text-slate-900 dark:text-slate-100 text-sm group-hover:text-blue-600 transition-colors pt-1">
          {member.name}
        </h3>

        <p className="text-[11px] text-slate-400 font-mono truncate max-w-[190px]">
          {member.email || `${member.id}@gmail.com`}
        </p>
      </div>

      {/* MIDDLE DUAL-COLUMN INFO BAR */}
      <div className="py-2.5 my-1 border-y border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-xs font-sans">
        
        {/* Right Column: Category / Role */}
        <div className="space-y-0.5 pr-1">
          <span className="text-[10px] text-slate-400 font-bold block">دپارتمان:</span>
          <div className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            <span className="truncate">{deptLabel}</span>
          </div>
        </div>

        {/* Left Column: Workload / Capacity */}
        <div className="space-y-0.5 pl-1 border-r border-slate-100 dark:border-slate-800/80">
          <span className="text-[10px] text-slate-400 font-bold block">ظرفیت کاری:</span>
          <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs block truncate">
            {toPersianDigits(activeTaskCount)} تسک فعال (۸۵٪)
          </span>
        </div>

      </div>

      {/* DUAL DIRECT ACTION BUTTONS (CALL & EMAIL) */}
      <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-4">
        {/* Email Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.location.href = `mailto:${member.email || member.id + '@gmail.com'}`;
          }}
          className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-medium py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 flex-1 transition-all duration-200 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white cursor-pointer"
        >
          <Mail size={14} className="shrink-0" />
          <span>ایمیل</span>
        </button>

        {/* Direct Call Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenProfile(member);
          }}
          className="bg-blue-50/60 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 flex-1 transition-all duration-200 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 shadow-sm cursor-pointer"
        >
          <Phone size={14} className="shrink-0" />
          <span>تماس</span>
        </button>
      </div>

    </div>
  );
};

export const SpecialistsView: React.FC = () => {
  const { teamMembers: contextMembers, tasks, projects } = useProject();

  // Selected Member for Profile Modal
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddSpecialistModalOpen, setIsAddSpecialistModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);

  // Status Overrides
  const [statusOverrides, setStatusOverrides] = useState<Record<string, 'online' | 'offline' | 'away'>>({});

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [efficiencyFilter, setEfficiencyFilter] = useState('all');

  // Combine Context Members with Overrides
  const membersList = useMemo(() => {
    const baseList = contextMembers || [];

    return baseList.map(member => ({
      ...member,
      status: statusOverrides[member.id] || member.status || 'online'
    }));
  }, [contextMembers, statusOverrides]);

  // Filtered Members
  const filteredMembers = useMemo(() => {
    return membersList.filter(member => {
      // Search
      const matchesSearch = 
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (member.role && member.role.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (member.department && member.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
        member.id.toLowerCase().includes(searchQuery.toLowerCase());

      // Department
      const matchesDept = departmentFilter === 'all' || member.department === departmentFilter;

      // Status
      const matchesStatus = statusFilter === 'all' || member.status === statusFilter;

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [membersList, searchQuery, departmentFilter, statusFilter]);

  // KPI Metrics Calculation
  const totalSpecialistsCount = membersList.length;
  const onlineCount = membersList.filter(m => m.status === 'online').length;
  const totalActiveTasks = tasks.length;
  const topPerformersCount = membersList.filter(m => (m.completedCount || 0) > 15).length;

  const handleOpenProfile = (member: TeamMember) => {
    setSelectedMember(member);
    setIsModalOpen(true);
  };

  const handleToggleStatus = (memberId: string) => {
    setStatusOverrides(prev => {
      const current = prev[memberId] || membersList.find(m => m.id === memberId)?.status || 'online';
      const next = current === 'online' ? 'offline' : 'online';
      return { ...prev, [memberId]: next };
    });
  };

  return (
    <div className="w-full space-y-4 font-sans text-right pt-1" dir="rtl">
      
      {/* 1. HERO HEADER BANNER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold border border-blue-200 dark:border-blue-800/80">
            <Sparkles size={14} />
            <span>مرکز پایش و هوش نیروی انسانی آژانس</span>
          </div>

          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100">
            مدیریت تیم‌ها و اعضا
          </h1>

          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-3xl leading-relaxed">
            هر عضو تیم دارای پروفایل کامل عملیاتی شامل مهارت‌ها، مسئولیت‌ها، سابقه پروژه‌ها، حجم کار، شاخص‌های راندمان و بینش‌های همکاری است.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          <button 
            type="button"
            onClick={() => setIsAddMemberModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Users size={16} />
            <span>افزودن عضو با ایمیل یا نام کاربری</span>
          </button>

          <button 
            type="button"
            onClick={() => setIsAddSpecialistModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>ایجاد دستی متخصص</span>
          </button>
          
          <button 
            type="button"
            className="hidden sm:flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
          >
            <Download size={15} />
            <span>خروجی اکسل</span>
          </button>
        </div>
      </div>

      {/* 2. SEARCH & MULTI-FILTER BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* Search Field */}
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو بر اساس نام، تخصص، ایمیل یا مهارت..."
            className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          />
        </div>

        {/* Custom Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          
          <div className="w-48">
            <CustomSelect
              options={DEPARTMENT_FILTER_OPTIONS}
              value={departmentFilter}
              onChange={(val) => setDepartmentFilter(val)}
              buttonClassName="bg-white dark:bg-[#121621] border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-xs shadow-xs hover:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all"
            />
          </div>

          <div className="w-48">
            <CustomSelect
              options={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              buttonClassName="bg-white dark:bg-[#121621] border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-xs shadow-xs hover:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all"
            />
          </div>

          <div className="w-48">
            <CustomSelect
              options={EFFICIENCY_FILTER_OPTIONS}
              value={efficiencyFilter}
              onChange={(val) => setEfficiencyFilter(val)}
              buttonClassName="bg-white dark:bg-[#121621] border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-xs shadow-xs hover:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all"
            />
          </div>

        </div>

      </div>

      {/* 4. PREMIUM MEMBER CARDS GRID */}
      {filteredMembers.length === 0 ? (
        <div className="col-span-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 font-bold space-y-2">
          <Users size={32} className="mx-auto text-slate-300 dark:text-slate-700" />
          <p>داده‌ای برای نمایش وجود ندارد</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {filteredMembers.map((member) => (
            <MemberCardItem
              key={member.id}
              member={member}
              tasks={tasks}
              onOpenProfile={handleOpenProfile}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}

      {/* MEMBER PROFILE DASHBOARD MODAL */}
      <MemberProfileModal
        member={selectedMember}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        allTasks={tasks}
        allProjects={projects}
      />

      {/* ADD NEW SPECIALIST MODAL */}
      <AddSpecialistModal
        isOpen={isAddSpecialistModalOpen}
        onClose={() => setIsAddSpecialistModalOpen(false)}
      />

      {/* ADD MEMBER VIA PHONE SEARCH MODAL */}
      <AddMemberModal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
      />

    </div>
  );
};

export const TeamMembersSubView = SpecialistsView;
export default SpecialistsView;

