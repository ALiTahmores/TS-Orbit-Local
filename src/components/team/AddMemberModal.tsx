import { apiFetch } from '../../lib/api';
import { LocalImage } from '../common/LocalImage';
import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { 
  UserPlus, 
  X, 
  User, 
  Phone, 
  Search, 
  Check, 
  Shield, 
  AtSign, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  ChevronDown,
  KeyRound,
  Building2,
  Briefcase,
  Layers,
  Code2,
  Palette,
  CheckCheck,
  Eye,
  Lock
} from 'lucide-react';
import { WorkspaceRole } from '../../types';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLES_LIST = [
  { id: 'DEVELOPER', labelFa: 'توسعه‌دهنده', labelEn: 'Developer', desc: 'ایجاد، ویرایش و تحویل وظایف', icon: Code2 },
  { id: 'PROJECT_MANAGER', labelFa: 'مدیر پروژه', labelEn: 'Project Manager', desc: 'تقسیم وظایف و پیگیری سررسیدها', icon: Briefcase },
  { id: 'DESIGNER', labelFa: 'طراح', labelEn: 'Designer', desc: 'طراحی و بازبینی تجربهٔ کاربری', icon: Palette },
  { id: 'QA_ENGINEER', labelFa: 'کنترل کیفیت', labelEn: 'QA Engineer', desc: 'تست، ثبت خطا و تأیید نسخه‌ها', icon: CheckCheck },
  { id: 'SPECIALIST', labelFa: 'متخصص', labelEn: 'Specialist', desc: 'همکاری در پروژه‌ها و وظایف', icon: Layers },
  { id: 'VIEWER', labelFa: 'فقط مشاهده', labelEn: 'Viewer', desc: 'دیدن گزارش‌ها بدون امکان ویرایش', icon: Eye },
];

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  isOpen,
  onClose
}) => {
  const { locale, fetchTeamMembers, fetchChatUsers, triggerSuccessEvent, departments, departmentMembers, fetchOrgData } = useProject();
  const isRtl = locale === 'fa';

  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'auto' | 'phone' | 'inviteCode'>('auto');
  const [isSearching, setIsSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<any | null>(null);
  const [matchedWorkspace, setMatchedWorkspace] = useState<any | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<WorkspaceRole>('DEVELOPER');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setIsSearching(false);
      setFoundUser(null);
      setMatchedWorkspace(null);
      setSearchError(null);
      setSelectedRole('DEVELOPER');
      setSelectedDept('');
      setIsSubmitting(false);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  // Dual lookup logic (Phone number OR Invite Code OR username)
  const handleSearchUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim().replace(/^@/, '');
    if (!query) {
      setSearchError(isRtl ? 'ایمیل یا نام کاربری دقیق را وارد کنید' : 'Enter an exact email or username');
      return;
    }

    setSearchError(null);
    setFoundUser(null);
    setMatchedWorkspace(null);
    setSuccessMessage(null);
    setIsSearching(true);

    try {
      const token = localStorage.getItem('token');
      const res = await apiFetch(`/api/users/lookup?q=${encodeURIComponent(query)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();

      const results = Array.isArray(data) ? data : data.user ? [data.user] : [];
      const normalizedQuery = query.replace(/^@/, '').toLowerCase();
      const exactUsername = results.filter((user: any) => String(user.username || '').toLowerCase() === normalizedQuery);
      const match = results.length === 1 ? results[0] : exactUsername.length === 1 ? exactUsername[0] : undefined;
      if (res.ok && match) {
        setFoundUser(match);
      } else {
        setSearchError(data.message || (isRtl ? 'حساب یکتا یافت نشد؛ نام کاربری دقیق را وارد کنید.' : 'No unique account found; enter the exact username.'));
      }
    } catch {
      setSearchError(isRtl ? 'خطا در برقراری ارتباط با سرور' : 'Server communication error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMember = async () => {
    if (!foundUser) return;
    setIsSubmitting(true);
    setSearchError(null);

    try {
      const token = localStorage.getItem('token');
      const activeWorkspaceId = localStorage.getItem('activeWorkspaceId');

      // Call backend API to add member to workspace
      const res = await apiFetch('/api/workspaces/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
          targetUserId: foundUser.id,
          role: selectedRole
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'خطا در افزودن عضو به فضای کاری');
      }

      // Department membership lives in the organisation model, not on the workspace member.
      if (selectedDept) {
        const memberIds = [...new Set([...(departmentMembers || []).filter((row: any) => row.departmentId === selectedDept).map((row: any) => row.userId), foundUser.id])];
        const assigned = await apiFetch(`/api/org/departments/${encodeURIComponent(selectedDept)}/members`, { method: 'PUT', body: JSON.stringify({ memberIds }) });
        if (!assigned.ok) throw new Error(isRtl ? 'عضو افزوده شد، اما ثبت دپارتمان انجام نشد.' : 'Member added, but the department could not be saved.');
      }

      // Reload the committed member list (team pages and chat contacts) from the server.
      await Promise.all([fetchTeamMembers(), fetchChatUsers(), selectedDept ? fetchOrgData() : undefined]).catch(() => undefined);

      const roleLabel = ROLES_LIST.find(role => role.id === selectedRole);
      const message = isRtl
        ? `«${foundUser.name}» با نقش «${roleLabel?.labelFa || selectedRole}» به فضای کاری افزوده شد.`
        : `${foundUser.name} was added to the workspace as ${roleLabel?.labelEn || selectedRole}.`;
      setSuccessMessage(message);
      triggerSuccessEvent(isRtl ? 'عضو جدید اضافه شد' : 'Member added', message);

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setSearchError(err.message || (isRtl ? 'افزودن کاربر با خطا مواجه شد' : 'Failed to add member'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto dir-rtl font-sans"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* 1. Translucent Gradient Backdrop (Background remains bright, sharp & readable) */}
      <div 
        onClick={onClose}
        className="fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 animate-in fade-in cursor-pointer"
      />

      {/* 2. Modal Card Container with High-Contrast Elevation */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200/90 dark:border-slate-800 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-[#1e2338] flex items-center justify-between bg-slate-50/70 dark:bg-[#16192e] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-white">
                {isRtl ? 'افزودن عضو یا متخصص به فضای کاری' : 'Add Team Member to Workspace'}
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                {isRtl ? 'افزودن حساب موجود با ایمیل یا نام کاربری دقیق' : 'Add an existing account by exact email or username'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 scrollbar-thin">
          
          {/* Dual Lookup Input Box */}
          <form onSubmit={handleSearchUser} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {isRtl ? 'ایمیل یا نام کاربری همکار' : 'Colleague email or username'}
              </label>
            </div>

            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isRtl ? 'ایمیل دقیق یا @username همکار' : 'Exact email or @username'}
                className="w-full h-12 ps-11 pe-20 rounded-2xl bg-slate-50 dark:bg-[#181c30] border border-slate-200 dark:border-[#262c45] text-slate-800 dark:text-white text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-start"
              />
              <div className="absolute start-3.5 flex items-center pointer-events-none text-slate-400">
                <Search size={16} />
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="absolute end-2 h-8 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isSearching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                <span>{isRtl ? 'جستجو' : 'Search'}</span>
              </button>
            </div>
            
            <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-0.5">
              <KeyRound size={12} className="text-amber-500 shrink-0" />
              <span>{isRtl ? 'جستجو با ایمیل یا نام کاربری دقیق انجام می‌شود. پیوستن با کد دعوت از فهرست فضای کاری است.' : 'Search by exact email or username. Join with an invite code from the workspace menu.'}</span>
            </div>
          </form>

          {/* Search Error Notice */}
          {searchError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle size={16} className="shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {/* Success Confirmation Toast */}
          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-emerald-600 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Discovered User / Specialist Profile Card Preview */}
          {foundUser && (
            <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-[#181c30] border border-blue-500/40 shadow-md space-y-4 animate-in fade-in duration-200">
              
              {/* User Identity Banner */}
              <div className="flex items-center gap-3">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg overflow-hidden shadow-xs shrink-0">
                  {foundUser.avatar ? (
                    <LocalImage src={foundUser.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{foundUser.name ? foundUser.name.charAt(0) : 'U'}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-slate-800 dark:text-white truncate">
                      {foundUser.name}
                    </h4>
                    <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>{isRtl ? 'حساب فعال' : 'Active'}</span>
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-mono font-bold flex items-center gap-0.5">
                      <AtSign size={11} />
                      <span>{foundUser.username || 'user'}</span>
                    </span>
                    {foundUser.phone && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono dir-ltr">
                        {foundUser.phone}
                      </span>
                    )}
                  </div>

                  {matchedWorkspace && (
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 mt-1">
                      <Building2 size={11} />
                      <span>{isRtl ? `تطبیق یافته از: ${matchedWorkspace.name}` : `Matched from: ${matchedWorkspace.name}`}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Role Selection Grid */}
              <div className="space-y-2 pt-3 border-t border-slate-200/70 dark:border-[#252a42]">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Shield size={13} className="text-blue-500" />
                  <span>{isRtl ? 'نقش و سطح دسترسی عضو در کارگاه:' : 'Select Workspace Role:'}</span>
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ROLES_LIST.map((roleItem) => {
                    const Icon = roleItem.icon;
                    const isSelected = selectedRole === roleItem.id;
                    return (
                      <button
                        key={roleItem.id}
                        type="button"
                        onClick={() => setSelectedRole(roleItem.id as WorkspaceRole)}
                        className={`p-2.5 rounded-xl border text-start transition-all cursor-pointer flex items-start gap-2.5 ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                            : 'bg-white dark:bg-[#131627] border-slate-200 dark:border-[#22273e] text-slate-700 dark:text-slate-300 hover:border-blue-400'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400'
                        }`}>
                          <Icon size={13} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">{isRtl ? roleItem.labelFa : roleItem.labelEn}</div>
                          <div className={`text-[9px] mt-0.5 leading-snug line-clamp-1 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                            {roleItem.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Department Selection (only departments defined in this workspace) */}
              {(departments || []).length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-[#252a42]">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers size={13} className="text-indigo-500" />
                    <span>{isRtl ? 'دپارتمان (اختیاری):' : 'Department (optional):'}</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {[{ id: '', name: isRtl ? 'بدون دپارتمان' : 'None' }, ...departments].map((dept: any) => (
                      <button
                        key={dept.id || 'none'}
                        type="button"
                        onClick={() => setSelectedDept(dept.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center truncate ${
                          selectedDept === dept.id
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {dept.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Member Confirm Action Button */}
              <button
                type="button"
                onClick={handleAddMember}
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/25 mt-2 active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <UserPlus size={16} />
                )}
                <span>{isRtl ? 'تأیید و افزودن به اعضای فضای کاری' : 'Confirm & Add to Workspace'}</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AddMemberModal;
