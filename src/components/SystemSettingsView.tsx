import { apiFetch, clearCredential } from '../lib/api';
import { LocalImage } from './common/LocalImage';
import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { TabManager } from './TabManager';
import { AlertTriangle, CheckCircle2, Laptop, Lock, Moon, Sun } from 'lucide-react';
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
    { id: 'appearance', label: 'ظاهر و تم', roles: [] as string[] },
    { id: 'localization', label: 'زبان و زمان', roles: [] as string[] },
    { id: 'notifications', label: 'اعلان‌ها', roles: [] as string[] },
    { id: 'profile', label: 'حساب کاربری', roles: [] as string[] },
    { id: 'organization', label: 'فضای کاری', roles: ['OWNER', 'ADMIN'] },
    { id: 'security', label: 'امنیت', roles: [] as string[] },
    { id: 'modules', label: 'ماژول‌ها', roles: ['OWNER'] },
  ];

  // Filter visible tabs based on user role permissions
  const visibleCategories = categories.filter(cat => {
    if (cat.roles.length === 0) return true;
    return cat.roles.includes(userRole);
  });

  const field = 'w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';
  const saveButton = (onClick: () => void, busy = false) => (
    <button type="button" onClick={onClick} disabled={busy} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-60 cursor-pointer">
      {busy ? 'در حال ذخیره…' : 'ذخیرهٔ تغییرات'}
    </button>
  );
  const choice = (selected: boolean) => `flex items-center gap-3 p-3.5 rounded-xl border text-start transition-colors cursor-pointer ${selected ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 ring-1 ring-blue-600' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`;
  const radioDot = (selected: boolean) => (
    <span className={`ms-auto shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${selected ? 'border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}>
      {selected && <span className="w-2 h-2 rounded-full bg-blue-600" />}
    </span>
  );
  const toggle = (checked: boolean, onChange: (value: boolean) => void, label: string, description: string) => (
    <label className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0 cursor-pointer">
      <span className="space-y-0.5">
        <span className="block text-[13px] font-semibold text-slate-800 dark:text-slate-100">{label}</span>
        <span className="block text-[11px] leading-5 text-slate-500 dark:text-slate-400">{description}</span>
      </span>
      <span className="relative shrink-0 mt-0.5">
        <input type="checkbox" role="switch" checked={checked} onChange={event => onChange(event.target.checked)} className="sr-only peer" />
        <span className="block w-9 h-5 rounded-full bg-slate-200 dark:bg-slate-700 peer-checked:bg-blue-600 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/40" />
        <span className="absolute top-0.5 start-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4 rtl:peer-checked:-translate-x-4" />
      </span>
    </label>
  );
  const noAccess = (text: string) => (
    <div className="flex gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-300">
      <Lock size={16} className="shrink-0 mt-0.5 text-slate-400" />
      <span>{text}</span>
    </div>
  );
  const active = visibleCategories.find(category => category.id === activeCategory) || visibleCategories[0];

  return (
    <div className="w-full max-w-5xl space-y-6 text-start" id="saas-settings-center">
      {(successMsg || errorMsg) && (
        <div role="status" className={`fixed bottom-24 lg:bottom-6 end-4 sm:end-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-bold text-white ${errorMsg ? 'bg-rose-600' : 'bg-slate-900 dark:bg-slate-700'}`}>
          {errorMsg ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} className="text-emerald-400" />}
          <span>{errorMsg || successMsg}</span>
        </div>
      )}

      <header className="space-y-1">
        <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">تنظیمات</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">ظاهر، زبان، اعلان‌ها، حساب کاربری و امنیت خود را از اینجا مدیریت کنید.</p>
      </header>

      <nav role="tablist" aria-label="بخش‌های تنظیمات" className="tab-scroller page-bleed gap-6 border-b border-slate-200 dark:border-slate-800">
        {visibleCategories.map(category => {
          const selected = category.id === active.id;
          return (
            <button key={category.id} type="button" role="tab" aria-selected={selected} aria-current={selected ? 'page' : undefined} onClick={() => setActiveCategory(category.id)}
              className={`relative h-11 text-[13px] font-bold whitespace-nowrap transition-colors cursor-pointer ${selected ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
              {category.label}
              {selected && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-blue-600" />}
            </button>
          );
        })}
      </nav>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 sm:px-7">
        {active.id === 'appearance' && <>
          <SectionHeader title="ظاهر" description="پوسته و چیدمان برنامه روی این دستگاه." actions={saveButton(handleSaveUserSettings)} />
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            <SettingRow title="پوسته" description="روشن، تاریک یا هماهنگ با سیستم‌عامل.">
              <div className="grid sm:grid-cols-3 gap-3">
                {([['light', 'روشن', Sun], ['dark', 'تاریک', Moon], ['system', 'هماهنگ با سیستم', Laptop]] as const).map(([value, label, Icon]) => (
                  <button key={value} type="button" role="radio" aria-checked={theme === value} onClick={() => setTheme(value)} className={choice(theme === value)}>
                    <Icon size={16} className="shrink-0 text-slate-500 dark:text-slate-400" />
                    <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{label}</span>
                    {radioDot(theme === value)}
                  </button>
                ))}
              </div>
            </SettingRow>
            <SettingRow title="چیدمان کارتابل" description="تراکم نمایش کارت‌ها در پیشخوان.">
              <select aria-label="چیدمان کارتابل" value={dashboardPref} onChange={event => setDashboardPref(event.target.value)} className={`${field} sm:max-w-xs`}>
                <option value="standard">استاندارد</option>
                <option value="compact">فشرده</option>
              </select>
            </SettingRow>
          </div>
        </>}

        {active.id === 'localization' && <>
          <SectionHeader title="زبان و زمان" description="زبان رابط و نمایش تاریخ و ساعت." actions={saveButton(handleSaveUserSettings)} />
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            <SettingRow title="زبان رابط" description="با تغییر زبان، جهت صفحه هم راست‌به‌چپ یا چپ‌به‌راست می‌شود.">
              <div className="grid sm:grid-cols-2 gap-3">
                {([['fa', 'فارسی', 'FA'], ['en', 'English', 'EN']] as const).map(([value, label, badge]) => (
                  <button key={value} type="button" role="radio" aria-checked={locale === value} onClick={() => setLocale(value)} className={choice(locale === value)}>
                    <span className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-black text-slate-600 dark:text-slate-300 flex items-center justify-center">{badge}</span>
                    <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{label}</span>
                    {radioDot(locale === value)}
                  </button>
                ))}
              </div>
            </SettingRow>
            <SettingRow title="تقویم" description="قالب نمایش تاریخ‌ها در برنامه.">
              <select aria-label="تقویم" value={dateFormat} onChange={event => setDateFormat(event.target.value)} className={`${field} sm:max-w-xs`}>
                <option value="fa">تقویم جلالی (۱۴۰۵/۰۴/۲۰)</option>
                <option value="en">Gregorian (2026/07/11)</option>
              </select>
            </SettingRow>
            <SettingRow title="قالب ساعت">
              <select aria-label="قالب ساعت" value={timeFormat} onChange={event => setTimeFormat(event.target.value)} className={`${field} sm:max-w-xs`}>
                <option value="24h">۲۴ ساعته (14:30)</option>
                <option value="12h">۱۲ ساعته (02:30 PM)</option>
              </select>
            </SettingRow>
            <SettingRow title="منطقهٔ زمانی">
              <select aria-label="منطقهٔ زمانی" value={timezone} onChange={event => setTimezone(event.target.value)} className={`${field} sm:max-w-xs`} dir="ltr">
                <option value="Asia/Tehran">Asia/Tehran (GMT +3:30)</option>
                <option value="UTC">UTC (GMT +0:00)</option>
                <option value="Europe/London">Europe/London (GMT +1:00)</option>
              </select>
            </SettingRow>
          </div>
        </>}

        {active.id === 'notifications' && <>
          <SectionHeader title="اعلان‌ها" description="انتخاب کنید دربارهٔ چه چیزهایی و از چه راهی باخبر شوید." actions={saveButton(handleSaveUserSettings)} />
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            <SettingRow title="روش دریافت" description="اعلان‌ها از کدام راه به شما برسد.">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {toggle(notifInApp, setNotifInApp, 'درون برنامه', 'نمایش اعلان در نوار بالای برنامه.')}
                {toggle(notifEmail, setNotifEmail, 'ایمیل', 'خلاصهٔ روزانه و هفتگی کارها.')}
              </div>
            </SettingRow>
            <SettingRow title="رویدادها" description="رویدادهایی که برایشان اعلان می‌گیرید.">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {toggle(notifAssignment, setNotifAssignment, 'واگذاری وظیفه', 'وقتی وظیفهٔ جدیدی به شما سپرده شود.')}
                {toggle(notifUpdates, setNotifUpdates, 'تغییر وضعیت', 'وقتی وضعیت وظیفه یا پروژهٔ شما تغییر کند.')}
                {toggle(notifMentions, setNotifMentions, 'نام بردن از شما', 'وقتی همکاران در گفتگو یا نظر از شما نام ببرند.')}
                {toggle(notifDeadlines, setNotifDeadlines, 'یادآوری سررسید', '۴۸ ساعت پیش از سررسید وظیفه‌ها.')}
              </div>
            </SettingRow>
          </div>
        </>}

        {active.id === 'profile' && <>
          <SectionHeader title="اطلاعات شخصی" description="نام، تصویر و اطلاعات تماس شما برای همکاران." actions={saveButton(() => void handleSaveProfile())} />
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            <SettingRow title="نام">
              <input aria-label="نام" type="text" value={profileName} onChange={event => setProfileName(event.target.value)} className={field} />
            </SettingRow>
            <SettingRow title="ایمیل">
              <input aria-label="ایمیل" type="email" dir="ltr" value={profileEmail} onChange={event => setProfileEmail(event.target.value)} className={`${field} text-start`} />
            </SettingRow>
            <SettingRow title="تلفن همراه">
              <input aria-label="تلفن همراه" type="tel" dir="ltr" value={profilePhone} onChange={event => setProfilePhone(event.target.value)} className={`${field} text-start`} />
            </SettingRow>
            {(profileEmail.trim().toLowerCase() !== (currentUser?.email || '').toLowerCase() || profilePhone.replace(/[^0-9]/g, '') !== (currentUser?.phone || '').replace(/[^0-9]/g, '')) && (
              <SettingRow title="تأیید تغییر" description="برای تغییر ایمیل یا تلفن، رمز عبور فعلی را وارد کنید.">
                <input id="profile-verification-password" aria-label="رمز عبور فعلی" type="password" autoComplete="current-password" value={profileVerificationPassword} onChange={event => setProfileVerificationPassword(event.target.value)} className={field} />
              </SettingRow>
            )}
            <SettingRow title="تصویر پروفایل" description="یکی از تصاویر آماده را انتخاب کنید یا تصویر خودتان را بارگذاری کنید.">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="shrink-0 w-16 h-16 rounded-full bg-blue-600 text-white overflow-hidden">
                  <LocalImage src={profileAvatar} alt={profileName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="space-y-3 min-w-0">
                  <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="انتخاب تصویر پروفایل">
                    <button type="button" role="radio" aria-checked={!profileAvatar || profileAvatar.startsWith('data:image/svg')} aria-label="حروف اول نام" title="حروف اول نام" onClick={() => setProfileAvatar('')}
                      className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${!profileAvatar || profileAvatar.startsWith('data:image/svg') ? 'border-blue-600' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                      <LocalImage src="" alt={profileName} className="w-full h-full object-cover" />
                    </button>
                    {Array.from({ length: 8 }, (_, index) => `/avatars/avatar-${index}.svg`).map((presetUrl, index) => (
                      <button key={presetUrl} type="button" role="radio" aria-checked={profileAvatar === presetUrl} aria-label={`تصویر آماده ${(index + 1).toLocaleString('fa-IR')}`} onClick={() => setProfileAvatar(presetUrl)}
                        className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${profileAvatar === presetUrl ? 'border-blue-600' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                        <LocalImage src={presetUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                      بارگذاری تصویر
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={async event => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (!file) return;
                        try { setProfileAvatar(await resizeAvatar(file)); }
                        catch { triggerToast(locale === 'fa' ? 'این تصویر قابل استفاده نیست؛ یک فایل PNG، JPG یا WebP انتخاب کنید.' : 'This image cannot be used; choose a PNG, JPG or WebP file.', true); }
                      }} />
                    </label>
                    <span className="text-[11px] text-slate-400">PNG، JPG یا WebP؛ برای اعمال، تغییرات را ذخیره کنید.</span>
                  </div>
                </div>
              </div>
            </SettingRow>
            <SettingRow title="عنوان شغلی">
              <input aria-label="عنوان شغلی" type="text" value={profileJobTitle} onChange={event => setProfileJobTitle(event.target.value)} placeholder="مثلاً توسعه‌دهندهٔ وردپرس" className={field} />
            </SettingRow>
            <SettingRow title="درباره من" description="چند جمله دربارهٔ مهارت‌ها و تجربهٔ شما.">
              <textarea aria-label="درباره من" rows={4} value={profileBio} onChange={event => setProfileBio(event.target.value)} placeholder="مهارت‌ها، سوابق یا خلاصهٔ تخصص خود را بنویسید…" className={`${field} h-auto py-2.5 leading-6`} />
            </SettingRow>
            <SettingRow title="نقش در فضای کاری">
              <span className="inline-flex items-center gap-2 h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">
                <CheckCircle2 size={14} className="text-emerald-500" />{getRoleLabel(currentUser?.role)}
              </span>
            </SettingRow>
            {currentUser?.systemRole === 'ADMIN' && (
              <SettingRow title="سمت نمایشی پرسنل" description="فقط عنوان نمایشی حساب تغییر می‌کند؛ دسترسی سیستمی یا عضویت فضای کاری ایجاد نمی‌شود.">
                <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
                  <select aria-label="انتخاب کاربر" value={selectedMemberId} onChange={event => { setSelectedMemberId(event.target.value); const member = teamMembers?.find(row => row.id === event.target.value); if (member) setSelectedMemberRole(member.role); }} className={field}>
                    <option value="">انتخاب کاربر</option>
                    {teamMembers?.filter(row => row.id !== currentUser?.id && row.systemRole !== 'ADMIN').map(row => <option key={row.id} value={row.id}>{`${row.name} (${getRoleLabel ? getRoleLabel(row.role) : row.role})`}</option>)}
                  </select>
                  <select aria-label="سمت نمایشی" value={selectedMemberRole} onChange={event => setSelectedMemberRole(event.target.value)} disabled={!selectedMemberId} className={field}>
                    {['USER', 'CLIENT', 'DEVELOPER', 'PROJECT_MANAGER', 'SPECIALIST', 'SEO_SPECIALIST', 'CONTENT_CREATOR', 'DESIGNER', 'QA_ENGINEER', 'MEMBER', 'VIEWER'].map(role => <option key={role} value={role}>{getRoleLabel ? getRoleLabel(role) : role}</option>)}
                  </select>
                  <button type="button" onClick={handleUpdateUserRole} disabled={updatingRole || !selectedMemberId} className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer">
                    {updatingRole ? '…' : 'ثبت سمت'}
                  </button>
                </div>
              </SettingRow>
            )}
          </div>
          <div className="flex justify-end gap-2 py-5 border-t border-slate-200 dark:border-slate-800">{saveButton(() => void handleSaveProfile())}</div>
        </>}

        {active.id === 'organization' && <>
          <SectionHeader title="فضای کاری" description="نام و معرفی فضای کاری که اعضا می‌بینند." actions={canManageOrg ? saveButton(() => void handleSaveOrgSettings(), savingOrg) : undefined} />
          {canManageOrg ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              <SettingRow title="نام فضای کاری">
                <input id="org-name" aria-label="نام فضای کاری" type="text" maxLength={120} value={orgName} onChange={event => setOrgName(event.target.value)} className={field} />
              </SettingRow>
              <SettingRow title="معرفی" description="توضیح کوتاهی دربارهٔ تیم یا کسب‌وکار شما.">
                <textarea id="org-info" aria-label="معرفی فضای کاری" rows={4} maxLength={2000} value={orgInfo} onChange={event => setOrgInfo(event.target.value)} className={`${field} h-auto py-2.5 leading-6`} />
              </SettingRow>
            </div>
          ) : <div className="py-6">{noAccess(t('org_only_admin'))}</div>}
        </>}

        {active.id === 'security' && <>
          <SectionHeader title="امنیت" description="رمز عبور و دستگاه‌هایی که با حساب شما وارد شده‌اند." />
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            <SettingRow title="تغییر رمز عبور" description="دست‌کم ۱۲ کاراکتر. پس از تغییر، از همهٔ نشست‌ها خارج می‌شوید.">
              <form onSubmit={handleChangePasswordSubmit} className="space-y-3">
                <input aria-label="رمز عبور فعلی" placeholder="رمز عبور فعلی" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className={field} />
                <input aria-label="رمز عبور جدید" placeholder="رمز عبور جدید" type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} className={field} />
                <input aria-label="تکرار رمز عبور جدید" placeholder="تکرار رمز عبور جدید" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className={field} />
                <button type="submit" className="inline-flex items-center h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer">به‌روزرسانی رمز عبور</button>
              </form>
            </SettingRow>
            <SettingRow title="نشست‌های فعال" description="دستگاه‌هایی که الان با حساب شما وارد شده‌اند.">
              <ActiveSessions onNotice={triggerToast} />
            </SettingRow>
          </div>
        </>}

        {active.id === 'modules' && <>
          <SectionHeader title="ماژول‌ها" description={t('module_desc')} />
          <div className="py-6">{userRole === 'OWNER' ? <TabManager /> : noAccess(t('module_owner_only'))}</div>
        </>}
      </section>
    </div>
  );
};

const SectionHeader: React.FC<{ title: string; description?: string; actions?: React.ReactNode }> = ({ title, description, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 py-5 border-b border-slate-200 dark:border-slate-800">
    <div className="space-y-0.5 min-w-0">
      <h2 className="text-[15px] font-black text-slate-900 dark:text-white">{title}</h2>
      {description && <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>}
    </div>
    {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
  </div>
);

/** One setting: its name and explanation beside the control, as in a settings form. */
const SettingRow: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <div className="grid gap-3 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-10 py-5">
    <div className="space-y-0.5">
      <h3 className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{title}</h3>
      {description && <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">{description}</p>}
    </div>
    <div className="min-w-0 max-w-2xl">{children}</div>
  </div>
);
