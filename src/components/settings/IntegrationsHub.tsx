import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownToLine, Check, ChevronDown, Copy, GitBranch, KeyRound, Pencil, Plug, RefreshCw, Send, Trash2, Webhook } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useProject } from '../../context/ProjectContext';
import { cn } from '../../lib/utils';
import { SideSheet, sheetInput, sheetLabel } from '../common/SideSheet';
import { EmptyHint, Panel, PrimaryButton, SecondaryButton, num, timeAgo } from '../ui/dashboard-kit';

type Provider = 'slack' | 'teams' | 'discord' | 'telegram' | 'webhook' | 'incoming' | 'github';
interface Delivery { id: string; event: string; at: string; ok: boolean; status: number; ms: number; error?: string; direction?: 'in' }
interface Connection {
  id: string; provider: Provider; direction: 'outgoing' | 'incoming'; name: string; enabled: boolean; events: string[]; projectIds: string[]; target: string;
  projectId: string | null; transitionOnMerge: 'none' | 'review' | 'completed'; endpoint: string | null; lastDeliveryAt: string | null; lastStatus: 'ok' | 'failed' | null; deliveries: Delivery[]; signingKey?: string;
}
interface Hub { taskKeyPrefix: string; events: string[]; connections: Connection[] }

const providers: Record<Provider, { name: string; description: string; mark: React.ReactNode; tone: string }> = {
  slack: { name: 'Slack', description: 'رویدادهای پروژه و وظایف را در کانال Slack تیم بفرستید.', mark: 'S', tone: 'bg-[#4A154B] text-white' },
  teams: { name: 'Microsoft Teams', description: 'اطلاع‌رسانی در کانال Teams با کارت پیام.', mark: 'T', tone: 'bg-[#5059C9] text-white' },
  discord: { name: 'Discord', description: 'پیام رویدادها در کانال Discord از طریق webhook.', mark: 'D', tone: 'bg-[#5865F2] text-white' },
  telegram: { name: 'Telegram', description: 'ارسال رویدادها با ربات تلگرام به گروه یا کانال.', mark: <Send size={16} />, tone: 'bg-[#229ED9] text-white' },
  github: { name: 'GitHub', description: 'کامیت‌ها و درخواست‌های ادغام را با کلید وظیفه به آن وصل کنید.', mark: <GitBranch size={16} />, tone: 'bg-[#24292F] text-white' },
  webhook: { name: 'Webhook امضاشده', description: 'رویدادها به هر سرویس دلخواه، با امضای HMAC-SHA256.', mark: <Webhook size={16} />, tone: 'bg-slate-800 text-white' },
  incoming: { name: 'Webhook ورودی', description: 'ساخت وظیفه از فرم سایت، n8n، Zapier یا هر ابزار دیگر.', mark: <ArrowDownToLine size={16} />, tone: 'bg-emerald-600 text-white' },
};
const eventLabels: Record<string, string> = {
  'task.created': 'ساخت وظیفه', 'task.updated': 'ویرایش وظیفه', 'task.status_changed': 'تغییر وضعیت', 'task.completed': 'تکمیل وظیفه', 'task.assigned': 'واگذاری وظیفه',
  'task.deleted': 'حذف وظیفه', 'comment.created': 'نظر تازه', 'project.created': 'ساخت پروژه', 'project.updated': 'به‌روزرسانی پروژه', 'project.deleted': 'حذف پروژه', 'sprint.started': 'شروع اسپرینت', 'sprint.completed': 'پایان اسپرینت',
  'integration.test': 'پیام آزمایشی', 'task.create': 'ساخت وظیفه از بیرون',
};
const defaultEvents = ['task.created', 'task.completed', 'task.assigned', 'comment.created'];
const Mark: React.FC<{ provider: Provider; size?: number }> = ({ provider, size = 40 }) => (
  <span className={cn('rounded-xl inline-flex items-center justify-center font-black shrink-0', providers[provider].tone)} style={{ width: size, height: size, fontSize: size * 0.4 }}>{providers[provider].mark}</span>
);

const CopyField: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <span className={sheetLabel}>{label}</span>
      <div className="flex items-center gap-2">
        <code dir="ltr" className="flex-1 min-w-0 truncate h-10 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] leading-10 text-slate-700 dark:text-slate-200">{value}</code>
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }} aria-label={`کپی ${label}`}
          className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer">{copied ? <Check size={15} /> : <Copy size={15} />}</button>
      </div>
    </div>
  );
};

interface FormState { provider: Provider; id?: string; name: string; webhookUrl: string; url: string; botToken: string; chatId: string; projectId: string; transitionOnMerge: Connection['transitionOnMerge']; events: string[]; projectIds: string[] }
const emptyForm = (provider: Provider): FormState => ({ provider, name: providers[provider].name, webhookUrl: '', url: '', botToken: '', chatId: '', projectId: '', transitionOnMerge: 'review', events: defaultEvents, projectIds: [] });

/** Connect TS Orbit to the team's chat, code and automation tools. */
export const IntegrationsHub: React.FC = () => {
  const { projects } = useProject();
  const [hub, setHub] = useState<Hub | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState<Connection | null>(null);
  const [open, setOpen] = useState('');
  const [prefix, setPrefix] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try { const value = await (await apiFetch('/api/integrations')).json(); setHub(value); setPrefix(value.taskKeyPrefix); } catch { /* The error toast reports it. */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const edit = (row: Connection) => setForm({ ...emptyForm(row.provider), id: row.id, name: row.name, events: row.events, projectIds: row.projectIds, projectId: row.projectId || '', transitionOnMerge: row.transitionOnMerge });
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true); setError('');
    const config = form.provider === 'telegram' ? { botToken: form.botToken, chatId: form.chatId }
      : form.provider === 'webhook' ? { url: form.url }
      : form.provider === 'incoming' ? { projectId: form.projectId || null }
      : form.provider === 'github' ? { transitionOnMerge: form.transitionOnMerge }
      : { webhookUrl: form.webhookUrl };
    const outgoing = !['incoming', 'github'].includes(form.provider);
    const body = { name: form.name, config, ...(outgoing ? { events: form.events, projectIds: form.projectIds } : {}) };
    try {
      const response = await apiFetch(form.id ? `/api/integrations/${form.id}` : '/api/integrations', { method: form.id ? 'PUT' : 'POST', body: JSON.stringify(form.id ? body : { provider: form.provider, ...body }) });
      const saved = await response.json();
      setForm(null);
      if (saved.signingKey) setRevealed(saved);
      await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'ذخیره انجام نشد.'); } finally { setSaving(false); }
  };
  const act = async (id: string, request: () => Promise<Response>, after?: (value: any) => void) => {
    setBusy(id);
    try { const value = await (await request()).json(); after?.(value); await load(); } catch { /* The error toast reports it. */ } finally { setBusy(''); }
  };
  const toggle = (row: Connection) => act(row.id, () => apiFetch(`/api/integrations/${row.id}`, { method: 'PUT', body: JSON.stringify({ enabled: !row.enabled }) }));
  const test = (row: Connection) => act(row.id, () => apiFetch(`/api/integrations/${row.id}/test`, { method: 'POST', body: '{}' }), () => { setOpen(row.id); setTimeout(() => { void load(); }, 2500); });
  const rotate = (row: Connection) => { if (window.confirm('کلید تازه ساخته شود؟ ابزارهایی که از کلید فعلی استفاده می‌کنند تا به‌روزرسانی از کار می‌افتند.')) void act(row.id, () => apiFetch(`/api/integrations/${row.id}/rotate`, { method: 'POST', body: '{}' }), setRevealed); };
  const remove = (row: Connection) => { if (window.confirm(`اتصال «${row.name}» حذف شود؟`)) void act(row.id, () => apiFetch(`/api/integrations/${row.id}`, { method: 'DELETE' })); };
  const savePrefix = () => act('prefix', () => apiFetch('/api/integrations/settings', { method: 'PUT', body: JSON.stringify({ taskKeyPrefix: prefix.trim().toUpperCase() }) }));

  if (!hub) return <div className="h-48" aria-busy="true" />;
  const projectName = (id: string | null) => projects.find(project => project.id === id)?.title || '';

  return (
    <div className="space-y-6 text-start">
      <Panel title="اتصال‌های فعال" description="هر رویداد فقط پس از ثبت قطعی تغییر ارسال می‌شود؛ رازها فقط روی سرور می‌مانند." icon={Plug} bodyClassName="pt-3">
        {hub.connections.length === 0 ? <EmptyHint icon={Plug} title="هنوز ابزاری وصل نشده است." text="از فهرست زیر یک ابزار انتخاب کنید." /> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {hub.connections.map(row => (
              <li key={row.id} className="py-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Mark provider={row.provider} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">{row.name}
                      <span className={cn('h-5 px-1.5 rounded text-[10px] font-bold inline-flex items-center', row.direction === 'incoming' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300')}>{row.direction === 'incoming' ? 'دریافت' : 'ارسال'}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate" dir="auto">
                      {row.direction === 'incoming' ? (row.provider === 'github' ? `پس از ادغام: ${{ none: 'بدون تغییر وضعیت', review: 'در حال بررسی', completed: 'تکمیل‌شده' }[row.transitionOnMerge]}` : `وظایف در «${projectName(row.projectId) || 'پروژهٔ ارسالی'}»`)
                        : `${row.target} · ${num(row.events.length)} رویداد${row.projectIds.length ? ` · ${num(row.projectIds.length)} پروژه` : ' · همهٔ پروژه‌ها'}`}
                    </p>
                  </div>
                  <span className={cn('text-[11px] font-bold', row.lastStatus === 'failed' ? 'text-rose-600' : row.lastStatus === 'ok' ? 'text-emerald-600' : 'text-slate-400')}>
                    {row.lastDeliveryAt ? `${row.lastStatus === 'ok' ? 'موفق' : 'ناموفق'} · ${timeAgo(row.lastDeliveryAt)}` : 'بدون ارسال'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" role="switch" aria-checked={row.enabled} aria-label={`فعال بودن ${row.name}`} disabled={busy === row.id} onClick={() => void toggle(row)}
                      className={cn('relative w-10 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50 me-1', row.enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700')}><span className={cn('absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all', row.enabled ? 'start-5' : 'start-1')} /></button>
                    {row.direction === 'outgoing' && <IconButton label="ارسال پیام آزمایشی" onClick={() => void test(row)} disabled={busy === row.id || !row.enabled}><Send size={15} /></IconButton>}
                    {row.endpoint && <IconButton label="ساخت کلید تازه" onClick={() => rotate(row)} disabled={busy === row.id}><KeyRound size={15} /></IconButton>}
                    {row.provider === 'webhook' && <IconButton label="ساخت کلید امضای تازه" onClick={() => rotate(row)} disabled={busy === row.id}><KeyRound size={15} /></IconButton>}
                    <IconButton label="ویرایش" onClick={() => edit(row)}><Pencil size={15} /></IconButton>
                    <IconButton label="حذف" onClick={() => remove(row)} danger><Trash2 size={15} /></IconButton>
                    <IconButton label="سابقهٔ ارسال و دریافت" onClick={() => { const next = open === row.id ? '' : row.id; setOpen(next); if (next) void load(); }}><ChevronDown size={15} className={cn('transition-transform', open === row.id && 'rotate-180')} /></IconButton>
                  </div>
                </div>
                {row.endpoint && <div className="max-w-xl"><CopyField label="نشانی دریافت" value={row.endpoint} /></div>}
                {open === row.id && (
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3">
                    {row.deliveries.length === 0 ? <p className="text-[11px] text-slate-500 text-center py-3">هنوز چیزی ارسال یا دریافت نشده است.</p> : (
                      <ul className="space-y-1.5">
                        {row.deliveries.map(item => (
                          <li key={item.id} className="flex items-center gap-3 text-[11px]">
                            <span className={cn('w-2 h-2 rounded-full shrink-0', item.ok ? 'bg-emerald-500' : 'bg-rose-500')} />
                            <span className="font-bold text-slate-700 dark:text-slate-200">{eventLabels[item.event] || item.event}</span>
                            <span className="text-slate-500" dir="ltr">{item.status ? `HTTP ${item.status}` : item.error}{item.ms ? ` · ${item.ms}ms` : ''}</span>
                            <span className="ms-auto text-slate-400">{timeAgo(item.at)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <section aria-label="ابزارهای قابل اتصال" className="space-y-3">
        <h2 className="text-sm font-black text-slate-900 dark:text-white px-1">افزودن اتصال</h2>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {(Object.keys(providers) as Provider[]).map(provider => (
            <div key={provider} className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3"><Mark provider={provider} size={36} /><p className="text-sm font-bold text-slate-800 dark:text-slate-100">{providers[provider].name}</p></div>
              <p className="text-xs leading-6 text-slate-500 dark:text-slate-400 flex-1">{providers[provider].description}</p>
              <SecondaryButton icon={Plug} onClick={() => setForm(emptyForm(provider))} className="self-start" aria-label={`اتصال ${providers[provider].name}`}>اتصال</SecondaryButton>
            </div>
          ))}
        </div>
      </section>

      <Panel title="کلید وظایف" description={`هر وظیفه کلیدی مثل ${hub.taskKeyPrefix}-۱۲ دارد. کلید را در پیام کامیت یا عنوان درخواست ادغام بنویسید تا GitHub آن را به وظیفه وصل کند.`} icon={KeyRound}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1.5"><span className={sheetLabel}>پیشوند کلید</span>
            <input dir="ltr" value={prefix} onChange={event => setPrefix(event.target.value.toUpperCase())} maxLength={10} className={cn(sheetInput, 'w-40 font-mono')} aria-describedby="prefix-help" />
          </label>
          <PrimaryButton onClick={() => void savePrefix()} disabled={busy === 'prefix' || prefix === hub.taskKeyPrefix || !/^[A-Z][A-Z0-9]{1,9}$/.test(prefix)}>ذخیرهٔ پیشوند</PrimaryButton>
          <p id="prefix-help" className="text-[11px] text-slate-500 dark:text-slate-400 w-full">۲ تا ۱۰ حرف و رقم لاتین بزرگ که با حرف شروع شود؛ کلید وظایف قبلی هم با پیشوند تازه نمایش داده می‌شود.</p>
        </div>
      </Panel>

      {form && (
        <SideSheet title={form.id ? `ویرایش ${providers[form.provider].name}` : `اتصال ${providers[form.provider].name}`} description={providers[form.provider].description}
          submitLabel={form.id ? 'ذخیرهٔ تغییرات' : 'اتصال'} saving={saving} error={error} onSubmit={submit} onClose={() => { setForm(null); setError(''); }}>
          <label className="block space-y-1.5"><span className={sheetLabel}>نام اتصال</span><input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className={sheetInput} required maxLength={120} /></label>
          {['slack', 'teams', 'discord'].includes(form.provider) && (
            <label className="block space-y-1.5"><span className={sheetLabel}>نشانی Incoming Webhook</span>
              <input dir="ltr" type="url" value={form.webhookUrl} onChange={event => setForm({ ...form, webhookUrl: event.target.value })} className={sheetInput} required={!form.id}
                placeholder={form.provider === 'slack' ? 'https://hooks.slack.com/services/…' : form.provider === 'discord' ? 'https://discord.com/api/webhooks/…' : 'https://….webhook.office.com/…'} />
              {form.id && <span className="block text-[11px] text-slate-500">برای نگه داشتن نشانی فعلی خالی بگذارید.</span>}
            </label>
          )}
          {form.provider === 'webhook' && (
            <label className="block space-y-1.5"><span className={sheetLabel}>نشانی دریافت‌کننده (https)</span>
              <input dir="ltr" type="url" value={form.url} onChange={event => setForm({ ...form, url: event.target.value })} className={sheetInput} required={!form.id} placeholder="https://example.com/hooks/orbit" />
              <span className="block text-[11px] leading-5 text-slate-500">هر درخواست سرآیند X-Orbit-Signature با امضای HMAC-SHA256 بدنه دارد.</span>
            </label>
          )}
          {form.provider === 'telegram' && (<>
            <label className="block space-y-1.5"><span className={sheetLabel}>توکن ربات</span><input dir="ltr" value={form.botToken} onChange={event => setForm({ ...form, botToken: event.target.value })} className={sheetInput} required={!form.id} placeholder="123456789:AA…" autoComplete="off" /></label>
            <label className="block space-y-1.5"><span className={sheetLabel}>شناسهٔ گروه یا کانال</span><input dir="ltr" value={form.chatId} onChange={event => setForm({ ...form, chatId: event.target.value })} className={sheetInput} required={!form.id} placeholder="-1001234567890 یا @channel" /></label>
            <p className="text-[11px] leading-5 text-slate-500">ربات را به گروه یا کانال اضافه کنید و اجازهٔ ارسال پیام بدهید.</p>
          </>)}
          {form.provider === 'incoming' && (
            <label className="block space-y-1.5"><span className={sheetLabel}>پروژهٔ پیش‌فرض</span>
              <select value={form.projectId} onChange={event => setForm({ ...form, projectId: event.target.value })} className={sheetInput}>
                <option value="">بدون پیش‌فرض (projectId در درخواست)</option>
                {projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
              <span className="block text-[11px] leading-5 text-slate-500" dir="ltr">{'POST {"title","description","priority","dueDate","projectId","assigneeEmail"}'}</span>
            </label>
          )}
          {form.provider === 'github' && (
            <label className="block space-y-1.5"><span className={sheetLabel}>پس از ادغام درخواست، وضعیت وظیفه</span>
              <select value={form.transitionOnMerge} onChange={event => setForm({ ...form, transitionOnMerge: event.target.value as FormState['transitionOnMerge'] })} className={sheetInput}>
                <option value="review">در حال بررسی</option><option value="completed">تکمیل‌شده</option><option value="none">بدون تغییر</option>
              </select>
              <span className="block text-[11px] leading-5 text-slate-500">در GitHub، Settings › Webhooks: نشانی و کلید را وارد کنید، نوع محتوا application/json و رویدادهای Pushes و Pull requests.</span>
            </label>
          )}
          {!['incoming', 'github'].includes(form.provider) && (<>
            <fieldset className="space-y-2"><legend className={sheetLabel}>رویدادها</legend>
              <div className="grid grid-cols-2 gap-2">
                {hub.events.map(event => (
                  <label key={event} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input type="checkbox" className="accent-blue-600" checked={form.events.includes(event)} onChange={() => setForm({ ...form, events: form.events.includes(event) ? form.events.filter(item => item !== event) : [...form.events, event] })} />{eventLabels[event] || event}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2"><legend className={sheetLabel}>پروژه‌ها</legend>
              <p className="text-[11px] text-slate-500">هیچ پروژه‌ای انتخاب نشود یعنی همهٔ پروژه‌ها.</p>
              <div className="max-h-44 overflow-y-auto space-y-1.5 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5">
                {projects.map(project => (
                  <label key={project.id} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input type="checkbox" className="accent-blue-600" checked={form.projectIds.includes(project.id)} onChange={() => setForm({ ...form, projectIds: form.projectIds.includes(project.id) ? form.projectIds.filter(item => item !== project.id) : [...form.projectIds, project.id] })} />{project.title}
                  </label>
                ))}
              </div>
            </fieldset>
          </>)}
        </SideSheet>
      )}

      {revealed && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="کلید اتصال">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setRevealed(null)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xl text-start">
            <div className="flex items-center gap-3"><Mark provider={revealed.provider} size={36} /><div><p className="text-sm font-black text-slate-900 dark:text-white">{revealed.name}</p><p className="text-[11px] text-slate-500">این کلید فقط همین یک بار نمایش داده می‌شود؛ آن را در جای امن ذخیره کنید.</p></div></div>
            {revealed.endpoint && <CopyField label="نشانی دریافت" value={revealed.endpoint} />}
            {revealed.signingKey && <CopyField label={revealed.provider === 'incoming' ? 'کلید (سرآیند X-Orbit-Token یا امضای X-Orbit-Signature)' : revealed.provider === 'github' ? 'Secret در تنظیمات webhook گیت‌هاب' : 'کلید امضا'} value={revealed.signingKey} />}
            <div className="flex justify-end"><PrimaryButton onClick={() => setRevealed(null)}>ذخیره کردم</PrimaryButton></div>
          </div>
        </div>
      )}
    </div>
  );
};

const IconButton: React.FC<{ label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }> = ({ label, onClick, disabled, danger, children }) => (
  <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
    className={cn('w-9 h-9 rounded-lg inline-flex items-center justify-center cursor-pointer disabled:opacity-40 transition-colors', danger ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800')}>{children}</button>
);

export default IntegrationsHub;
