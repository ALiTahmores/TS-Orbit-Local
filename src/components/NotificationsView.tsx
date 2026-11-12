import React, { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, CheckCheck, ClipboardList, FolderKanban, MessageSquare, MessagesSquare, Settings2, Trash2, UserPlus } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { apiFetch } from '../lib/api';
import { formatJalaliDate, localISODate } from '../lib/dates';
import { cn } from '../lib/utils';
import { EmptyHint, PageHeader, Panel, SecondaryButton, Segmented, num, timeAgo } from './ui/dashboard-kit';

type Category = 'task' | 'chat' | 'feedback' | 'system';
// Kinds the server sends, grouped for the filter; older kinds keep their place.
const categoryOf = (type: string): Category =>
  /^task|deadline|approval/.test(type) ? 'task' : /^chat/.test(type) ? 'chat' : /feedback|project/.test(type) ? 'feedback' : 'system';
const kinds: Record<string, { label: string; icon: React.ElementType; tone: string }> = {
  'task.assigned': { label: 'واگذاری وظیفه', icon: ClipboardList, tone: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' },
  'chat.message': { label: 'پیام گفتگو', icon: MessageSquare, tone: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400' },
  'chat.request': { label: 'درخواست ارتباط', icon: UserPlus, tone: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },
  'chat.request_response': { label: 'پاسخ درخواست ارتباط', icon: MessagesSquare, tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
  client_feedback: { label: 'بازخورد کارفرما', icon: FolderKanban, tone: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' },
};
const kindOf = (type: string) => kinds[type] || kinds[{ task_assigned: 'task.assigned', project_updated: 'client_feedback' }[type] || ''] || { label: 'اعلان سیستم', icon: Bell, tone: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };
const DAY = 86_400_000;

/** The member's inbox: what happened, where, and one click to go there. */
export const NotificationsView: React.FC = () => {
  const { notifications, markNotificationAsRead, markAllNotificationsAsRead, clearNotifications, collaborationError, setActiveTab, setActiveSubTab } = useProject();
  const [filter, setFilter] = useState<'all' | 'unread' | Category>('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<{ mutedTypes: string[]; types: string[] } | null>(null);
  const [saving, setSaving] = useState('');

  useEffect(() => { apiFetch('/api/notifications/preferences').then(response => response.json()).then(setSettings).catch(() => undefined); }, []);

  const act = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'عملیات انجام نشد.'); } finally { setBusy(false); }
  };
  const toggleMute = async (type: string) => {
    if (!settings) return;
    const mutedTypes = settings.mutedTypes.includes(type) ? settings.mutedTypes.filter(item => item !== type) : [...settings.mutedTypes, type];
    setSaving(type);
    try {
      const response = await apiFetch('/api/notifications/preferences', { method: 'PUT', body: JSON.stringify({ mutedTypes }) });
      setSettings(await response.json());
    } catch { /* The error toast reports it. */ } finally { setSaving(''); }
  };

  const rows = useMemo(() => [...notifications].sort((a: any, b: any) => String(b.timestamp || '').localeCompare(String(a.timestamp || ''))), [notifications]);
  const counts = useMemo(() => {
    const result = { all: rows.length, unread: 0, task: 0, chat: 0, feedback: 0, system: 0 };
    for (const row of rows as any[]) { if (!row.read) result.unread++; result[categoryOf(String(row.type))]++; }
    return result;
  }, [rows]);
  const visible = rows.filter((row: any) => filter === 'all' || (filter === 'unread' ? !row.read : categoryOf(String(row.type)) === filter));

  // Today, yesterday, this week and earlier, by the viewer's calendar.
  const sections = useMemo(() => {
    const today = localISODate(), yesterday = localISODate(new Date(Date.now() - DAY)), weekAgo = localISODate(new Date(Date.now() - 6 * DAY));
    const result: { key: string; title: string; rows: any[] }[] = [{ key: 'today', title: 'امروز', rows: [] }, { key: 'yesterday', title: 'دیروز', rows: [] }, { key: 'week', title: 'این هفته', rows: [] }, { key: 'older', title: 'قدیمی‌تر', rows: [] }];
    for (const row of visible as any[]) {
      const day = row.timestamp ? localISODate(new Date(row.timestamp)) : '';
      result[day === today ? 0 : day === yesterday ? 1 : day >= weekAgo ? 2 : 3].rows.push(row);
    }
    return result.filter(section => section.rows.length);
  }, [visible]);

  const open = async (row: any) => {
    if (!row.read) await markNotificationAsRead(row.id).catch(() => undefined);
    const link = String(row.link || '');
    if (link === 'chat') { setActiveTab('chat'); setActiveSubTab('messenger'); }
    else if (link === 'personal_tasks' || categoryOf(String(row.type)) === 'task') { setActiveTab('personal_tasks'); setActiveSubTab('my_tasks'); }
    else if (categoryOf(String(row.type)) === 'feedback') { setActiveTab('projects'); setActiveSubTab('clients'); }
  };

  return (
    <div className="w-full space-y-6 text-start">
      <PageHeader title="اعلان‌ها" description={counts.unread ? `${num(counts.unread)} اعلان خوانده‌نشده دارید.` : 'همهٔ اعلان‌ها را خوانده‌اید.'}
        actions={<>
          <SecondaryButton icon={CheckCheck} disabled={busy || !counts.unread} onClick={() => void act(markAllNotificationsAsRead)}>خواندن همه</SecondaryButton>
          <SecondaryButton icon={Trash2} disabled={busy || !counts.all} onClick={() => { if (window.confirm('همهٔ اعلان‌ها از صندوق شما پاک شوند؟')) void act(clearNotifications); }}>پاک کردن صندوق</SecondaryButton>
        </>} />
      {(error || collaborationError) && <p role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold">{error || collaborationError}</p>}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 xl:col-span-8 space-y-4">
          <Segmented label="دستهٔ اعلان‌ها" value={filter} onChange={setFilter} options={[
            { value: 'all', label: 'همه', count: counts.all }, { value: 'unread', label: 'خوانده‌نشده', count: counts.unread },
            { value: 'task', label: 'وظایف', count: counts.task }, { value: 'chat', label: 'گفتگو', count: counts.chat },
            { value: 'feedback', label: 'کارفرما', count: counts.feedback }, { value: 'system', label: 'سیستم', count: counts.system },
          ]} />
          {sections.length === 0 ? (
            <Panel><EmptyHint icon={BellOff} title={counts.all ? 'اعلانی در این دسته نیست.' : 'صندوق اعلان‌های شما خالی است.'} text={counts.all ? undefined : 'واگذاری وظایف، پیام‌ها و بازخورد کارفرما اینجا نمایش داده می‌شوند.'} /></Panel>
          ) : sections.map(section => (
            <section key={section.key} aria-label={section.title} className="space-y-2">
              <h2 className="px-1 text-xs font-black text-slate-500 dark:text-slate-400">{section.title}</h2>
              <ul className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] divide-y divide-slate-100 dark:divide-slate-800/70 overflow-hidden">
                {section.rows.map((row: any) => {
                  const kind = kindOf(String(row.type)), Icon = kind.icon;
                  return (
                    <li key={row.id}>
                      <button type="button" onClick={() => void open(row)} className={cn('w-full text-start px-4 py-3.5 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer', !row.read && 'bg-blue-50/40 dark:bg-blue-500/[0.04]')}>
                        <span className={cn('w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0', kind.tone)}><Icon size={17} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className={cn('text-[13px] truncate', row.read ? 'font-semibold text-slate-700 dark:text-slate-300' : 'font-black text-slate-900 dark:text-white')}>{row.title}</span>
                            {!row.read && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" aria-label="خوانده‌نشده" />}
                          </span>
                          {row.description && <span className="block text-xs leading-5 text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{row.description}</span>}
                          <span className="block text-[10px] text-slate-400 mt-1">{kind.label} · {section.key === 'older' ? formatJalaliDate(row.timestamp) : timeAgo(row.timestamp)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <aside className="col-span-12 xl:col-span-4">
          <Panel title="تنظیمات اعلان" description="نوع‌هایی را که نمی‌خواهید دریافت کنید خاموش کنید؛ این تنظیم فقط برای شماست." icon={Settings2} bodyClassName="pt-3">
            {!settings ? <div className="h-24" aria-busy="true" /> : (
              <ul className="space-y-1">
                {settings.types.map(type => {
                  const kind = kindOf(type), Icon = kind.icon, enabled = !settings.mutedTypes.includes(type);
                  return (
                    <li key={type} className="flex items-center gap-3 py-2">
                      <span className={cn('w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0', kind.tone)}><Icon size={15} /></span>
                      <span className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-200">{kind.label}</span>
                      <button type="button" role="switch" aria-checked={enabled} aria-label={kind.label} disabled={saving === type} onClick={() => void toggleMute(type)}
                        className={cn('relative w-10 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500', enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700')}>
                        <span className={cn('absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all', enabled ? 'start-5' : 'start-1')} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
};

export default NotificationsView;
