import { apiFetch, clearCredential } from '../lib/api';
import { LocalImage } from './common/LocalImage';
import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { CustomSelect, CustomSelectOption } from './common/CustomSelect';
import { TabManager } from './TabManager';
import { 
  Settings, 
  Palette, 
  Globe, 
  Bell, 
  User, 
  Building2, 
  ShieldCheck, 
  Sliders, 
  Save, 
  CheckCircle2, 
  AlertTriangle,
  Lock,
  Eye,
  Laptop,
  Check,
  Smartphone,
  Activity,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { ActiveSessions } from './settings/ActiveSessions';
import { changedAvatar } from '../lib/formValues';

/** A square 256px WebP data URL cropped from the centre of the chosen image. */
const resizeAvatar = (file: File) => new Promise<string>((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    const size = 256, side = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size });
    const context = canvas.getContext('2d');
    if (!context || !side) return reject(new Error('image'));
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    const webp = canvas.toDataURL('image/webp', 0.85);
    resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85));
  };
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
  image.src = url;
});

const SETTINGS_CATEGORY_IDS =new Set(['appearance', 'localization', 'notifications', 'profile', 'organization', 'security', 'modules']);

export const SystemSettingsView: React.FC = () => {
  const { 
    currentUser, 
    userRole, 
    locale, 
    setLocale, 
    theme, 
    setTheme, 
    t,
    getRoleLabel,
    updateProfile,
    fetchTeamMembers,
    activeWorkspaceId,
    workspaces,
    setWorkspaces,
    activeSubTab,
    setActiveSubTab
  } = useProject();

  // The sidebar and the page tabs select a category through activeSubTab; the
  // in-page menu writes it back so all three stay on the same section.
  const [activeCategory, setActiveCategoryState] = useState<string>(() => SETTINGS_CATEGORY_IDS.has(activeSubTab) ? activeSubTab : 'appearance');
  const setActiveCategory = (id: string) => { setActiveCategoryState(id); setActiveSubTab(id); };
  useEffect(() => { if (SETTINGS_CATEGORY_IDS.has(activeSubTab)) setActiveCategoryState(activeSubTab); }, [activeSubTab]);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [teamMembers, setSystemUsers] = useState<any[]>([]);
  const fetchSystemUsers = async () => {
    if (currentUser?.systemRole !== "ADMIN") { setSystemUsers([]); return; }
    try { const response=await apiFetch("/api/owner/users"); setSystemUsers(await response.json()); } catch { setSystemUsers([]); }
  };

  // System account display role management
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [selectedMemberRole, setSelectedMemberRole] = useState<string>('USER');
  const [updatingRole, setUpdatingRole] = useState<boolean>(false);

  // Local state for user-specific settings (persists in localStorage per user)
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifInApp, setNotifInApp] = useState(true);
  const [notifAssignment, setNotifAssignment] = useState(true);
  const [notifUpdates, setNotifUpdates] = useState(true);
  const [notifMentions, setNotifMentions] = useState(false);
  const [notifDeadlines, setNotifDeadlines] = useState(true);

  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profilePhone, setProfilePhone] = useState(currentUser?.phone || '');
  const [profileAvatar, setProfileAvatar] = useState(currentUser?.avatar || '');
  const [profileBio, setProfileBio] = useState(currentUser?.bio || '');
  const [profileEmail, setProfileEmail] = useState(currentUser?.email || '');
  const [profileVerificationPassword, setProfileVerificationPassword] = useState('');
  const [profileJobTitle, setProfileJobTitle] = useState(currentUser?.jobTitle || '');
  const [timeFormat, setTimeFormat] = useState('24h');
  const [dateFormat, setDateFormat] = useState('fa');
  const [timezone, setTimezone] = useState('Asia/Tehran');
  const [dashboardPref, setDashboardPref] = useState('standard');

  // Organization settings are the active workspace's name and description, stored on the server.
  const activeWorkspace: any = workspaces.find(workspace => workspace.id === activeWorkspaceId);
  const canManageOrg = userRole === 'OWNER' || userRole === 'ADMIN';
  const [orgName, setOrgName] = useState('');
  const [orgInfo, setOrgInfo] = useState('');
  const [savingOrg, setSavingOrg] = useState(false);
  useEffect(() => {
    setOrgName(activeWorkspace?.name || '');
    setOrgInfo(activeWorkspace?.description || '');
  }, [activeWorkspace?.id, activeWorkspace?.name, activeWorkspace?.description]);

  // Local state for Security settings
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Load preferences from localStorage on mount or user switch
  useEffect(() => {
    if (currentUser?.id) {
      const userSetKey = `userSettings_${currentUser.id}`;
      const savedUser = localStorage.getItem(userSetKey);
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (parsed.notifEmail !== undefined) setNotifEmail(parsed.notifEmail);
          if (parsed.notifInApp !== undefined) setNotifInApp(parsed.notifInApp);
          if (parsed.notifAssignment !== undefined) setNotifAssignment(parsed.notifAssignment);
          if (parsed.notifUpdates !== undefined) setNotifUpdates(parsed.notifUpdates);
          if (parsed.notifMentions !== undefined) setNotifMentions(parsed.notifMentions);
          if (parsed.notifDeadlines !== undefined) setNotifDeadlines(parsed.notifDeadlines);

          if (parsed.timeFormat !== undefined) setTimeFormat(parsed.timeFormat);
          if (parsed.dateFormat !== undefined) setDateFormat(parsed.dateFormat);
          if (parsed.timezone !== undefined) setTimezone(parsed.timezone);
          if (parsed.dashboardPref !== undefined) setDashboardPref(parsed.dashboardPref);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.systemRole === "ADMIN") { void fetchSystemUsers(); } else setSystemUsers([]);
  }, [currentUser]);

  const handleUpdateUserRole = async () => {
    if (!selectedMemberId) {
      triggerToast(locale === 'fa' ? 'لطفاً یک کاربر را انتخاب کنید.' : 'Please select a user first.', true);
      return;
    }

    const member = teamMembers?.find(m => m.id === selectedMemberId);
    if (!member) return;

    if (member.id === currentUser?.id) {
      triggerToast(locale === 'fa' ? 'شما نمی‌توانید نقش خودتان را تغییر دهید.' : 'You cannot change your own role.', true);
      return;
    }

    try {
      setUpdatingRole(true);
      const token = localStorage.getItem('token');
      const res = await apiFetch(`/api/users/${selectedMemberId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: selectedMemberRole })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Error updating user role');
      }

      triggerToast(locale === 'fa' ? `سمت کاربر «${member.name}» با موفقیت به نقش ${selectedMemberRole} تغییر یافت.` : `User role for "${member.name}" successfully updated to ${selectedMemberRole}.`);
      await fetchSystemUsers();
    } catch (err: any) {
      triggerToast(err.message || (locale === 'fa' ? 'خطا در ارتباط با سرور' : 'Connection error'), true);
    } finally {
      setUpdatingRole(false);
    }
  };

  // Toast notifier
  const triggerToast = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 4000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  const handleSaveUserSettings = () => {
    if (!currentUser?.id) return;
    const userSetKey = `userSettings_${currentUser.id}`;
    const existing = JSON.parse(localStorage.getItem(userSetKey) || '{}');
    
    const updated = {
      ...existing,
      locale,
      theme,
      notifEmail,
      notifInApp,
      notifAssignment,
      notifUpdates,
      notifMentions,
      notifDeadlines,
      timeFormat,
      dateFormat,
      timezone,
      dashboardPref
    };

    localStorage.setItem(userSetKey, JSON.stringify(updated));
    triggerToast(locale === 'fa' ? 'تنظیمات شخصی شما با موفقیت ذخیره و اعمال گردید.' : 'Your personal preferences have been saved successfully.');
  };

  const handleSaveProfile = async () => {
    if (!currentUser?.id) return;
    const success = await updateProfile(
      profileName,
      profilePhone,
      changedAvatar(currentUser.avatar, profileAvatar),
      profileBio,
      profileEmail,
      profileJobTitle,
      profileVerificationPassword
    );
    if (success) {
      setProfileVerificationPassword('');
      triggerToast(locale === 'fa' ? 'پروفایل شما با موفقیت ذخیره و به‌روزرسانی شد.' : 'Your profile has been saved and updated successfully.');
    } else {
      triggerToast(locale === 'fa' ? 'خطا در ذخیره و به‌روزرسانی اطلاعات پروفایل.' : 'Error saving profile details.', true);
    }
  };

  const handleSaveOrgSettings = async () => {
    if (!canManageOrg || !activeWorkspace) return;
    if (!orgName.trim()) {
      triggerToast(locale === 'fa' ? 'نام فضای کاری نمی‌تواند خالی باشد.' : 'Workspace name is required.', true);
      return;
    }
    setSavingOrg(true);
    try {
      const response = await apiFetch(`/api/workspaces/${encodeURIComponent(activeWorkspace.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ name: orgName.trim(), description: orgInfo.trim() })
      });
      const result = await response.json();
      if (result.workspace) setWorkspaces(workspaces.map(workspace => workspace.id === result.workspace.id ? { ...workspace, ...result.workspace } : workspace));
      triggerToast(locale === 'fa' ? 'مشخصات فضای کاری ذخیره شد.' : 'Workspace details saved.');
    } catch {
      triggerToast(locale === 'fa' ? 'ذخیرهٔ مشخصات فضای کاری انجام نشد.' : 'Saving workspace details failed.', true);
    } finally {
      setSavingOrg(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      triggerToast(locale === 'fa' ? 'لطفاً رمز عبور فعلی را وارد کنید.' : 'Current password is required.', true);
      return;
    }
    if (newPassword.length < 12 || new TextEncoder().encode(newPassword).length > 72) {
      triggerToast(locale === 'fa' ? 'رمز عبور جدید باید حداقل ۱۲ کاراکتر باشد (حداکثر ۷۲ حرف لاتین).' : 'New password must be at least 12 characters and no more than 72 UTF-8 bytes.', true);
      return;
    }
    if (newPassword !== confirmPassword) {
      triggerToast(locale === 'fa' ? 'رمز عبور جدید با تکرار آن همخوانی ندارد.' : 'Passwords do not match.', true);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || (locale === 'fa' ? 'تغییر رمز انجام نشد.' : 'Password change failed.'));
      triggerToast(locale === 'fa' ? 'رمز عبور شما با موفقیت تغییر یافت.' : 'Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      sessionStorage.setItem('orbit_auth_notice','رمز عبور تغییر کرد و نشست‌های قبلی پایان یافتند؛ دوباره وارد شوید.');
      clearCredential();
    } catch (error) {
      triggerToast(error instanceof Error ? error.message : (locale === 'fa' ? 'خطا در ارتباط با سرور محلی.' : 'Local server connection failed.'), true);
    }
  };

  const categories = [
    { id: 'appearance', label: t('cat_appearance'), icon: Palette, roles: [] },
    { id: 'localization', label: t('cat_localization'), icon: Globe, roles: [] },
    { id: 'notifications', label: t('cat_notifications'), icon: Bell, roles: [] },
    { id: 'profile', label: t('cat_profile'), icon: User, roles: [] },
    { id: 'organization', label: t('cat_organization'), icon: Building2, roles: ['OWNER', 'ADMIN'] },
    { id: 'security', label: t('cat_security'), icon: ShieldCheck, roles: [] },
    { id: 'modules', label: t('cat_modules'), icon: Sliders, roles: ['OWNER'] },
  ];

  // Filter visible tabs based on user role permissions
  const visibleCategories = categories.filter(cat => {
    if (cat.roles.length === 0) return true;
    return cat.roles.includes(userRole);
  });

  return (
    <div className="w-full space-y-6" id="saas-settings-center">
      
      {/* Toast Alert Systems */}
      {successMsg && (
        <div className="fixed bottom-6 left-6 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce z-50 text-xs font-bold font-sans">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="fixed bottom-6 left-6 bg-rose-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce z-50 text-xs font-bold font-sans">
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Panel Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-lg font-black text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Settings className="text-blue-600 animate-spin-slow" size={20} />
            <span>{t('settings_title')}</span>
          </h1>
          <p className="text-[11px] text-slate-450 dark:text-slate-400">
            {t('settings_subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
            {t('profile_status')}: {getRoleLabel(currentUser?.role)}
          </span>
        </div>
      </div>

      {/* Side Navigation & Settings Body Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Right Nav Rail (Category Menu) */}
        <div className="lg:col-span-1 space-y-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-2xs space-y-1">
            {visibleCategories.map(cat => {
              const IconComp = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-right cursor-pointer ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <IconComp size={15} className={isActive ? 'text-white' : 'text-slate-400'} />
                  <span className="truncate">{cat.label}</span>
                </button>
              );
            })}
          </div>

          <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 p-4 rounded-2xl text-[10px] leading-relaxed text-blue-800 dark:text-blue-300">
            <Lock size={14} className="text-blue-600 mb-1" />
            <span>
              {locale === 'fa' 
                ? 'سطوح دسترسی پورتال برای امنیت بیشتر به‌صورت پویا با مدیریت مالک سیستم تنظیم شده و کلیه فعالیت‌ها مانیتور می‌شوند.'
                : 'Portal permissions are dynamically enforced according to organizational policy and all settings actions are securely logged.'}
            </span>
          </div>
        </div>

        {/* Left Active Pane */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xs min-h-[400px]">
            
            {/* CATEGORY: APPEARANCE */}
            {activeCategory === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
                    <Palette size={16} className="text-blue-600" /> {t('cat_appearance')}
                  </h2>
                  <p className="text-[11px] text-slate-450 dark:text-slate-400 mt-1.5">{t('appearance_desc')}</p>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">{t('theme_preference')}</label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Light theme */}
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`flex items-center gap-3 p-4 rounded-xl border text-right cursor-pointer transition-all ${
                        theme === 'light'
                          ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/10 ring-2 ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${theme === 'light' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 dark:bg-slate-850 text-slate-400'}`}>
                        <Check size={14} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">{t('theme_light')}</span>
                        <span className="text-[9.5px] text-slate-400">حالت روشن اداری پیش‌فرض</span>
                      </div>
                    </button>

                    {/* Dark theme */}
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`flex items-center gap-3 p-4 rounded-xl border text-right cursor-pointer transition-all ${
                        theme === 'dark'
                          ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/10 ring-2 ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 dark:bg-slate-850 text-slate-400'}`}>
                        <Eye size={14} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">{t('theme_dark')}</span>
                        <span className="text-[9.5px] text-slate-400">حالت تاریک زیبا و چشم‌نواز</span>
                      </div>
                    </button>

                    {/* System theme */}
                    <button
                      type="button"
                      onClick={() => setTheme('system')}
                      className={`flex items-center gap-3 p-4 rounded-xl border text-right cursor-pointer transition-all ${
                        theme === 'system'
                          ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/10 ring-2 ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${theme === 'system' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 dark:bg-slate-850 text-slate-400'}`}>
                        <Laptop size={14} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">{t('theme_system')}</span>
                        <span className="text-[9.5px] text-slate-400 font-mono">طابق با تنظیمات ویندوز/سیستم</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-150 dark:border-slate-800/60 flex justify-end">
                  <button
                    onClick={handleSaveUserSettings}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <Save size={13} />
                    <span>{t('save')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* CATEGORY: LOCALIZATION */}
            {activeCategory === 'localization' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
                    <Globe size={16} className="text-blue-600" /> {t('cat_localization')}
                  </h2>
                  <p className="text-[11px] text-slate-450 dark:text-slate-400 mt-1.5">{t('loc_desc')}</p>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">{t('lang_preference')}</label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Persian Localization */}
                    <button
                      type="button"
                      onClick={() => setLocale('fa')}
                      className={`flex items-center justify-between p-4 rounded-xl border text-right cursor-pointer transition-all ${
                        locale === 'fa'
                          ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/10 ring-2 ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xs">فارس</div>
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">{t('lang_fa')}</span>
                          <span className="text-[9.5px] text-slate-450">راست‌چین کامل و بومی‌سازی شده</span>
                        </div>
                      </div>
                      {locale === 'fa' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                    </button>

                    {/* English Localization */}
                    <button
                      type="button"
                      onClick={() => setLocale('en')}
                      className={`flex items-center justify-between p-4 rounded-xl border text-right cursor-pointer transition-all ${
                        locale === 'en'
                          ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/10 ring-2 ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold font-mono text-xs">EN</div>
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">{t('lang_en')}</span>
                          <span className="text-[9.5px] text-slate-450">Left-aligned (LTR) SaaS Localization</span>
                        </div>
                      </div>
                      {locale === 'en' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 p-4 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 block">پشتیبانی جهت و ترازبندی</span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    با کلیک بر روی زبان انگلیسی، بدنه کل نرم‌افزار به صورت خودکار چپ‌چین شده و ترازهای متنی تغییر می‌کنند تا کارفرمایان یا کاربران بین‌المللی تجربه کاربری یکپارچه‌ای کسب نمایند.
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-150 dark:border-slate-800/60 flex justify-end">
                  <button
                    onClick={handleSaveUserSettings}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <Save size={13} />
                    <span>{t('save')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* CATEGORY: NOTIFICATIONS */}
            {activeCategory === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
                    <Bell size={16} className="text-blue-600" /> {t('cat_notifications')}
                  </h2>
                  <p className="text-[11px] text-slate-450 dark:text-slate-400 mt-1.5">{t('notif_preferences')}</p>
                </div>

                <div className="space-y-3.5">
                  {[
                    { state: notifEmail, setter: setNotifEmail, label: t('notif_email'), desc: 'ارسال ایمیل‌های تجمیعی هفتگی و روزانه از روند کارگاه وردپرس' },
                    { state: notifInApp, setter: setNotifInApp, label: t('notif_in_app'), desc: 'نمایش پاپ‌آپ‌های زنده درون‌برنامه‌ای در هدر پورتال' },
                    { state: notifAssignment, setter: setNotifAssignment, label: t('notif_assignment'), desc: 'اطلاع‌رسانی سریع به محض واگذاری تسک جدید' },
                    { state: notifUpdates, setter: setNotifUpdates, label: t('notif_updates'), desc: 'اعلان به روز رسانی وضعیت‌های سئو، گزارش یا باگ‌یابی' },
                    { state: notifMentions, setter: setNotifMentions, label: t('notif_mentions'), desc: 'اعلان لحظه‌ای زمانی که همکاران شما را منشن می‌کنند' },
                    { state: notifDeadlines, setter: setNotifDeadlines, label: t('notif_deadlines'), desc: 'یادآوری ۴۸ ساعت پیش از ضرب‌الاجل انقضای کارهای سئو' },
                  ].map((notif, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 rounded-xl">
                      <div className="space-y-0.5 text-right">
                        <span className="text-xs font-black text-slate-800 dark:text-slate-150 block">{notif.label}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-400">{notif.desc}</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={notif.state}
                          onChange={e => notif.setter(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-150 dark:border-slate-800/60 flex justify-end">
                  <button
                    onClick={handleSaveUserSettings}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <Save size={13} />
                    <span>{t('save')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* CATEGORY: PROFILE */}
            {activeCategory === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
                    <User size={16} className="text-blue-600" /> {t('cat_profile')}
                  </h2>
                  <p className="text-[11px] text-slate-450 dark:text-slate-400 mt-1.5">{t('profile_info')}</p>
                </div>

                {/* Profile Photo / Avatar Editor */}
                <div className="bg-slate-50/50 dark:bg-[#0d0d0f]/50 border border-slate-150/55 dark:border-zinc-800/80 p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-5">
                  <div className="relative w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xl border-4 border-white dark:border-zinc-950 shadow-md overflow-hidden shrink-0">
                    <LocalImage src={profileAvatar} alt={profileName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="space-y-2 flex-1 w-full text-right sm:text-right">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">تصویر پروفایل</span>
                    <div className="flex flex-wrap items-center gap-2.5 mt-1" role="radiogroup" aria-label="انتخاب تصویر پروفایل">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={!profileAvatar || profileAvatar.startsWith('data:image/svg')}
                        aria-label="حروف اول نام"
                        title="حروف اول نام"
                        onClick={() => setProfileAvatar('')}
                        className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${!profileAvatar || profileAvatar.startsWith('data:image/svg') ? 'border-blue-600 scale-110 shadow-sm' : 'border-transparent opacity-75 hover:opacity-100'}`}
                      >
                        <LocalImage src="" alt={profileName} className="w-full h-full object-cover" />
                      </button>
                      {Array.from({ length: 8 }, (_, index) => `/avatars/avatar-${index}.svg`).map((presetUrl, index) => (
                        <button
                          key={presetUrl}
                          type="button"
                          role="radio"
                          aria-checked={profileAvatar === presetUrl}
                          aria-label={`تصویر آماده ${(index + 1).toLocaleString('fa-IR')}`}
                          onClick={() => setProfileAvatar(presetUrl)}
                          className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${
                            profileAvatar === presetUrl ? 'border-blue-600 scale-110 shadow-sm' : 'border-transparent opacity-75 hover:opacity-100'
                          }`}
                        >
                          <LocalImage src={presetUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center mt-2.5">
                      <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-blue-400 cursor-pointer">
                        بارگذاری تصویر از رایانه
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="sr-only"
                          onChange={async event => {
                            const file = event.target.files?.[0];
                            event.target.value = '';
                            if (!file) return;
                            try { setProfileAvatar(await resizeAvatar(file)); }
                            catch { triggerToast(locale === 'fa' ? 'این تصویر قابل استفاده نیست؛ یک فایل PNG، JPG یا WebP انتخاب کنید.' : 'This image cannot be used; choose a PNG, JPG or WebP file.', true); }
                          }}
                        />
                      </label>
                      <span className="text-[10px] text-slate-400">تصویر به اندازهٔ ۲۵۶ پیکسل کوچک می‌شود. برای اعمال، «ذخیره» را بزنید.</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-450 dark:text-slate-400 block mb-1">{t('profile_name')}</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={e => setProfileName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-450 dark:text-slate-400 block mb-1">{t('profile_phone')}</label>
                    <input
                      type="text"
                      value={profilePhone}
                      onChange={e => setProfilePhone(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-450 dark:text-slate-400 block mb-1">{locale === 'fa' ? 'عنوان شغلی / تخصص' : 'Job Title / Role Display'}</label>
                    <input
                      type="text"
                      value={profileJobTitle}
                      onChange={e => setProfileJobTitle(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                      placeholder={locale === 'fa' ? 'مثال: توسعه‌دهنده وردپرس، طراح رابط کاربری' : 'e.g. WordPress Developer, UI Designer'}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-450 dark:text-slate-400 block mb-1">{t('profile_email')}</label>
                    <input
                      type="text"
                      value={profileEmail}
                      onChange={e => setProfileEmail(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  {(profileEmail.trim().toLowerCase() !== (currentUser?.email || '').toLowerCase() || profilePhone.replace(/[^0-9]/g,'') !== (currentUser?.phone || '').replace(/[^0-9]/g,'')) && (
                    <div className="md:col-span-2">
                      <label htmlFor="profile-verification-password" className="text-xs block mb-1">{locale === 'fa' ? 'رمز عبور فعلی برای تایید تغییر ایمیل یا تلفن' : 'Current password to confirm email or phone change'}</label>
                      <input id="profile-verification-password" type="password" autoComplete="current-password" value={profileVerificationPassword} onChange={event=>setProfileVerificationPassword(event.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs" />
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black text-slate-450 dark:text-slate-400 block mb-1">درباره من / بیوگرافی کوتاه</label>
                    <textarea
                      rows={3}
                      value={profileBio}
                      onChange={e => setProfileBio(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
                      placeholder="مهارت‌ها، سوابق یا خلاصه تخصص خود را بنویسید..."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-450 dark:text-slate-400 block mb-1">{t('profile_status')}</label>
                    <span className="w-full bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-bold block">
                      ✓ {t('profile_verified')}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />

                <div className="space-y-4">
                  <h3 className="font-bold text-xs text-slate-700 dark:text-slate-300">تنظیمات زمانی و قالب‌ها</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1">{t('time_format')}</label>
                      <CustomSelect 
                        options={[
                          { value: '24h', label: '۲۴ ساعته (14:30)' },
                          { value: '12h', label: '۱۲ ساعته (02:30 PM)' },
                        ]}
                        value={timeFormat}
                        onChange={val => setTimeFormat(val)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1">{t('date_format')}</label>
                      <CustomSelect 
                        options={[
                          { value: 'fa', label: 'تقویم جلالی (۱۴۰۵/۰۴/۲۰)' },
                          { value: 'en', label: 'Gregorian Calendar (2026/07/11)' },
                        ]}
                        value={dateFormat}
                        onChange={val => setDateFormat(val)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1">{t('timezone')}</label>
                      <CustomSelect 
                        options={[
                          { value: 'Asia/Tehran', label: 'Asia/Tehran (GMT +3:30)' },
                          { value: 'UTC', label: 'UTC (GMT +0:00)' },
                          { value: 'Europe/London', label: 'Europe/London (GMT +1:00)' },
                        ]}
                        value={timezone}
                        onChange={val => setTimezone(val)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1">نمای پیش‌فرض کارتابل</label>
                      <CustomSelect 
                        options={[
                          { value: 'standard', label: 'نمای تفصیلی استاندارد' },
                          { value: 'compact', label: 'نمای متراکم (بنتو بهینه)' },
                        ]}
                        value={dashboardPref}
                        onChange={val => setDashboardPref(val)}
                      />
                    </div>
                  </div>
                </div>

                {currentUser?.systemRole === 'ADMIN' && (
                  <div className="pt-5 border-t border-slate-100 dark:border-slate-800/80 mt-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="text-amber-500" size={16} />
                      <h3 className="font-bold text-xs text-slate-700 dark:text-slate-300">
                        {locale === 'fa' ? 'مدیریت حساب‌ها: سمت نمایشی پرسنل' : 'Account Management: Display Roles'}
                      </h3>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      {locale === 'fa' 
                        ? 'سمت نمایشی حساب را ویرایش کنید. این تغییر مجوز سیستمی یا عضویت فضای کاری ایجاد نمی‌کند.' 
                        : 'Edit the account display role. This does not grant system privileges or workspace membership.'}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1">
                          {locale === 'fa' ? 'انتخاب کاربر / پرسنل کارگاه' : 'Select Team Member'}
                        </label>
                        <CustomSelect
                          options={[
                            { value: '', label: locale === 'fa' ? '-- انتخاب یک عضو --' : '-- Select a member --' },
                            ...(teamMembers?.filter(m => m.id !== currentUser?.id && m.systemRole !== 'ADMIN').map(m => ({
                              value: m.id,
                              label: `${m.name} (${getRoleLabel ? getRoleLabel(m.role) : m.role})`
                            })) || [])
                          ]}
                          value={selectedMemberId}
                          onChange={(val) => {
                            setSelectedMemberId(val);
                            const member = teamMembers?.find(m => m.id === val);
                            if (member) {
                              setSelectedMemberRole(member.role);
                            }
                          }}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1">
                          {locale === 'fa' ? 'تعیین سمت نمایشی حساب' : 'Assign Account Display Role'}
                        </label>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <CustomSelect
                              options={[
                                { value: 'USER', label: 'USER' },
{ value: 'CLIENT', label: 'CLIENT' },
{ value: 'DEVELOPER', label: 'DEVELOPER' },
{ value: 'PROJECT_MANAGER', label: 'PROJECT_MANAGER' },
{ value: 'SPECIALIST', label: 'SPECIALIST' },
{ value: 'SEO_SPECIALIST', label: 'SEO_SPECIALIST' },
{ value: 'CONTENT_CREATOR', label: 'CONTENT_CREATOR' },
{ value: 'DESIGNER', label: 'DESIGNER' },
{ value: 'QA_ENGINEER', label: 'QA_ENGINEER' },
{ value: 'MEMBER', label: 'MEMBER' },
{ value: 'VIEWER', label: 'VIEWER' },
                              ]}
                              value={selectedMemberRole}
                              onChange={(val) => setSelectedMemberRole(val)}
                              disabled={!selectedMemberId}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={handleUpdateUserRole}
                            disabled={updatingRole || !selectedMemberId}
                            className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-sm flex items-center gap-1 shrink-0 ${
                              (!selectedMemberId || updatingRole)
                                ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed text-slate-500' 
                                : 'bg-amber-500 hover:bg-amber-600 cursor-pointer'
                            }`}
                          >
                            {updatingRole ? '...' : (locale === 'fa' ? 'ذخیره سمت' : 'Save Role')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-150 dark:border-slate-800/60 flex justify-end">
                  <button
                    onClick={handleSaveProfile}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <Save size={13} />
                    <span>{t('save')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* CATEGORY: ORGANIZATION (Admin/Owner Only) */}
            {activeCategory === 'organization' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
                    <Building2 size={16} className="text-blue-600" /> {t('cat_organization')}
                  </h2>
                  <p className="text-[11px] text-slate-450 dark:text-slate-400 mt-1.5">{t('org_settings')}</p>
                </div>

                {canManageOrg ? (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label htmlFor="org-name" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">{t('org_name')}</label>
                        <input
                          id="org-name"
                          type="text"
                          maxLength={120}
                          value={orgName}
                          onChange={e => setOrgName(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="org-info" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">{t('org_info')}</label>
                        <textarea
                          id="org-info"
                          rows={3}
                          maxLength={2000}
                          value={orgInfo}
                          onChange={e => setOrgInfo(e.target.value)}
                          placeholder="توضیح کوتاهی دربارهٔ تیم یا کسب‌وکار شما"
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-150 dark:border-slate-800/60 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void handleSaveOrgSettings()}
                        disabled={savingOrg}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-60"
                      >
                        <Save size={13} />
                        <span>{savingOrg ? 'در حال ذخیره…' : t('save')}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-150 dark:border-rose-900/40 p-5 rounded-2xl flex gap-3 text-xs text-rose-700 dark:text-rose-300">
                    <Lock size={20} className="shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold block">عدم دسترسی مجاز</span>
                      {t('org_only_admin')}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CATEGORY: SECURITY */}
            {activeCategory === 'security' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-blue-600" /> {t('cat_security')}
                  </h2>
                  <p className="text-[11px] text-slate-450 dark:text-slate-400 mt-1.5">{t('security_policies')}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Password block */}
                  <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                    <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1.5">{t('sec_change_password')}</h3>
                    
                    <div>
                      <label className="text-[10px] text-slate-400 dark:text-slate-400 block mb-1">رمز عبور فعلی</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 dark:text-slate-400 block mb-1">{t('sec_new_password')}</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 dark:text-slate-400 block mb-1">{t('sec_confirm_password')}</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs"
                      />
                    </div>

                    <div className="text-[10px] text-slate-450 leading-relaxed dark:text-slate-400">
                      ℹ️ {t('sec_password_policy')}
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      به‌روزرسانی رمز عبور کاربری
                    </button>
                  </form>

                  {/* Active sessions block */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1.5">{t('sec_active_sessions')}</h3>
                    
                    <ActiveSessions onNotice={triggerToast} />
                  </div>
                </div>
              </div>
            )}

            {/* CATEGORY: MODULES / WORKSPACE (System Owner Only) */}
            {activeCategory === 'modules' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
                    <Sliders size={16} className="text-blue-600" /> {t('cat_modules')}
                  </h2>
                  <p className="text-[11px] text-slate-450 dark:text-slate-400 mt-1.5">{t('workspace_modules')}</p>
                </div>

                {userRole === 'OWNER' ? (
                  <div className="space-y-4">
                    <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 p-4 rounded-xl text-xs text-blue-800 dark:text-blue-300">
                      <span className="font-extrabold block">⚙️ مرکز مدیریت ماژول‌ها و تب‌های پورتال</span>
                      {t('module_desc')}
                    </div>
                    {/* Render TabManager perfectly inside! */}
                    <TabManager />
                  </div>
                ) : (
                  <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-150 dark:border-rose-900/40 p-5 rounded-2xl flex gap-3 text-xs text-rose-700 dark:text-rose-300">
                    <Lock size={20} className="shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold block">عدم دسترسی مجاز</span>
                      {t('module_owner_only')}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
};
