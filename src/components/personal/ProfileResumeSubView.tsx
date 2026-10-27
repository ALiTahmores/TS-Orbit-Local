import React, { useEffect, useState } from 'react';
import { AtSign, CalendarDays, CheckCheck, Copy, KeyRound, Mail, Pencil, Phone, RefreshCw, Users } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { invitePath } from '../../lib/pendingInvite';
import { LocalImage } from '../common/LocalImage';
import { useProject } from '../../context/ProjectContext';
import { formatJalaliDate } from '../../lib/dates';

const toPersianDigits = (n: string | number | undefined | null): string =>
  n === undefined || n === null ? '' : n.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)] || '۰');

const jalaliDate = (value?: string) => {
  const date = value ? new Date(value) : undefined;
  return date && !Number.isNaN(date.getTime()) ? formatJalaliDate(date) : '';
};

/** The signed-in user's profile, the workspace invite and its members — all from stored data. */
export const ProfileResumeSubView: React.FC = () => {
  const { currentUser, teamMembers, activeWorkspaceId, locale, getRoleLabel, setActiveTab, setActiveSubTab } = useProject();
  const isRtl = locale === 'fa';

  const [workspace, setWorkspace] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let current = true;
    setWorkspace(null);
    if (!currentUser?.id) return;
    apiFetch('/api/workspaces')
      .then(response => response.json())
      .then(data => { if (current) setWorkspace((data.workspaces || []).find((item: any) => item.id === activeWorkspaceId) || null); })
      .catch(() => undefined);
    return () => { current = false; };
  }, [currentUser?.id, activeWorkspaceId]);

  const inviteCode: string = workspace?.inviteCode || '';
  const canInvite = !!inviteCode;

  const copyInvite = async () => {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(invitePath(inviteCode));
    setCopied(true); setNotice('لینک دعوت کپی شد.');
    setTimeout(() => { setCopied(false); setNotice(''); }, 2500);
  };

  const regenerateInvite = async () => {
    setRegenerating(true);
    try {
      const response = await apiFetch('/api/workspaces/regenerate-invite', { method: 'POST', body: JSON.stringify({ workspaceId: workspace?.id }) });
      const data = await response.json();
      if (data.inviteCode) { setWorkspace((prev: any) => ({ ...prev, inviteCode: data.inviteCode })); setNotice('کد دعوت جدید فعال شد؛ لینک قبلی دیگر کار نمی‌کند.'); }
    } catch { /* The request error is shown by the app's error toast. */ }
    finally { setRegenerating(false); setTimeout(() => setNotice(''), 3500); }
  };

  const editProfile = () => { setActiveTab('settings'); setActiveSubTab('profile'); };
  const details = [
    { icon: Mail, label: 'ایمیل', value: currentUser?.email },
    { icon: Phone, label: 'شماره همراه', value: currentUser?.phone ? toPersianDigits(currentUser.phone) : '' },
    { icon: AtSign, label: 'نام کاربری', value: currentUser?.username ? `@${currentUser.username}` : '' },
    { icon: CalendarDays, label: 'عضویت از', value: jalaliDate(currentUser?.createdAt) },
  ];

  return (
    <div className="w-full space-y-6 font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Profile */}
        <section className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3 sm:gap-4">
            <LocalImage src={currentUser?.avatar} alt={currentUser?.name || ''} className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl object-cover border border-slate-200 dark:border-slate-700" />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-slate-900 dark:text-white truncate">{currentUser?.name}</h1>
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-1">{getRoleLabel(currentUser?.role)}</p>
              {currentUser?.jobTitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{currentUser.jobTitle}</p>}
            </div>
            <button type="button" onClick={editProfile} aria-label="ویرایش پروفایل" className="shrink-0 inline-flex items-center justify-center gap-1.5 w-10 h-10 sm:w-auto sm:h-auto sm:px-4 sm:py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer">
              <Pencil size={14} /> <span className="hidden sm:inline">ویرایش پروفایل</span>
            </button>
          </div>

          {currentUser?.bio && <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{currentUser.bio}</p>}

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {details.map(item => (
              <div key={item.label} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <item.icon size={16} className="text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <dt className="text-[11px] font-bold text-slate-400">{item.label}</dt>
                  <dd className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" dir={item.label === 'ایمیل' || item.label === 'نام کاربری' ? 'ltr' : undefined}>{item.value || 'ثبت نشده'}</dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        {/* Invite */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">دعوت به فضای کاری</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{workspace?.name || ''}</p>
          </div>
          {canInvite ? (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">هر کسی این لینک را باز کند، پس از ورود یا ثبت‌نام به این فضای کاری می‌پیوندد.</p>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-bold inline-flex items-center gap-1.5"><KeyRound size={13} /> کد دعوت</span>
                <code dir="ltr" className="font-mono text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 truncate max-w-[60%]">{inviteCode}</code>
              </div>
              <input readOnly dir="ltr" value={invitePath(inviteCode)} onFocus={event => event.currentTarget.select()} aria-label="لینک دعوت" className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-mono text-[11px]" />
              <div className="flex items-center gap-2">
                <button type="button" onClick={copyInvite} className="flex-1 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer">
                  {copied ? <CheckCheck size={16} /> : <Copy size={15} />} {copied ? 'کپی شد' : 'کپی لینک دعوت'}
                </button>
                <button type="button" onClick={regenerateInvite} disabled={regenerating} title="ساخت کد جدید و باطل کردن لینک قبلی" className="h-10 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
                  <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} /> کد جدید
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">ساخت لینک دعوت فقط برای مدیران این فضای کاری فعال است.</p>
          )}
          {notice && <p role="status" className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{notice}</p>}
        </section>
      </div>

      {/* Members */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <h2 className="text-base font-black text-slate-900 dark:text-white inline-flex items-center gap-2">
          <Users size={18} className="text-blue-600" /> اعضای فضای کاری
          <span className="text-xs font-bold text-slate-400">({toPersianDigits(teamMembers.length)})</span>
        </h2>
        {teamMembers.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">هنوز عضو دیگری به این فضای کاری اضافه نشده است.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {teamMembers.map(member => (
              <li key={member.id} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                <LocalImage src={member.avatar} alt={member.name} className="w-10 h-10 rounded-xl object-cover" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{member.name}{member.id === currentUser?.id ? ' (شما)' : ''}</p>
                  <p className="text-[11px] font-bold text-slate-400">{getRoleLabel(member.role)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
