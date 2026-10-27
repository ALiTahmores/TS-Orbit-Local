import React, { useCallback, useEffect, useState } from 'react';
import { Laptop, LogOut, RefreshCw, Smartphone } from 'lucide-react';
import { apiFetch, clearCredential } from '../../lib/api';
import { formatJalaliDateTime } from '../../lib/dates';

interface SessionRow {
  id: string;
  status: string;
  current: boolean;
  createdAt: string;
  lastActivity?: string;
  expiresAt: string;
  ipAddress?: string;
  userAgent?: string;
}

/** Browser and OS named from the stored user agent, e.g. "Chrome · Windows". */
export const describeUserAgent = (agent = '') => {
  const browser = /Edg\//.test(agent) ? 'Edge' : /OPR\//.test(agent) ? 'Opera' : /Firefox\//.test(agent) ? 'Firefox' : /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : 'مرورگر';
  const os = /Windows/.test(agent) ? 'Windows' : /Android/.test(agent) ? 'Android' : /iPhone|iPad|iOS/.test(agent) ? 'iOS' : /Mac OS X|Macintosh/.test(agent) ? 'macOS' : /Linux/.test(agent) ? 'Linux' : '';
  return { label: os ? `${browser} · ${os}` : browser, mobile: /Android|iPhone|iPad|Mobile/.test(agent) };
};

const when = (iso?: string) => {
  const date = iso ? new Date(iso) : undefined;
  return date && !Number.isNaN(date.getTime()) ? formatJalaliDateTime(date) : '';
};

/** The signed-in user's active sessions, read from and revoked on the server. */
export const ActiveSessions: React.FC<{ onNotice: (message: string, isError?: boolean) => void }> = ({ onNotice }) => {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await apiFetch('/api/auth/sessions');
      const rows: SessionRow[] = await response.json();
      const now = Date.now();
      setSessions(rows.filter(row => row.status === 'active' && Date.parse(row.expiresAt) > now)
        .sort((a, b) => Number(b.current) - Number(a.current) || Date.parse(b.lastActivity || b.createdAt) - Date.parse(a.lastActivity || a.createdAt)));
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const terminate = async (session: SessionRow) => {
    if (session.current && !window.confirm('با پایان این نشست از همین دستگاه خارج می‌شوید. ادامه می‌دهید؟')) return;
    setBusy(session.id);
    try {
      const response = await apiFetch(`/api/auth/sessions/${encodeURIComponent(session.id)}/terminate`, { method: 'POST' });
      const result = await response.json();
      if (result.requiresLogin) { clearCredential(); return; }
      onNotice('نشست پایان یافت.');
      await load();
    } catch {
      onNotice('پایان دادن به نشست انجام نشد.', true);
    } finally {
      setBusy('');
    }
  };

  const terminateOthers = async () => {
    const others = (sessions || []).filter(session => !session.current);
    if (!others.length || !window.confirm(`${others.length.toLocaleString('fa-IR')} نشست دیگر پایان یابد؟`)) return;
    setBusy('others');
    try {
      for (const session of others) await apiFetch(`/api/auth/sessions/${encodeURIComponent(session.id)}/terminate`, { method: 'POST' });
      onNotice('همهٔ نشست‌های دیگر پایان یافتند.');
    } catch {
      onNotice('پایان دادن به برخی نشست‌ها انجام نشد.', true);
    } finally {
      setBusy('');
      await load();
    }
  };

  const others = (sessions || []).filter(session => !session.current).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">دستگاه‌هایی که اکنون با حساب شما وارد شده‌اند.</span>
        <button type="button" onClick={() => void load()} aria-label="به‌روزرسانی فهرست نشست‌ها" className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
          <RefreshCw size={13} />
        </button>
      </div>

      {sessions === null ? (
        <p className="text-xs text-slate-400">در حال دریافت…</p>
      ) : sessions.length === 0 ? (
        <p className="text-xs text-slate-400">نشست فعالی یافت نشد.</p>
      ) : (
        <ul className="space-y-2.5">
          {sessions.map(session => {
            const device = describeUserAgent(session.userAgent);
            const Icon = device.mobile ? Smartphone : Laptop;
            return (
              <li key={session.id} className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${session.current ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/40' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={session.current ? 'text-blue-600' : 'text-slate-500'} size={18} />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate" dir="ltr">{device.label}</span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {session.current ? 'همین دستگاه' : `آخرین فعالیت: ${when(session.lastActivity || session.createdAt)}`}
                      {session.ipAddress ? <> • <span dir="ltr">{session.ipAddress}</span></> : null}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void terminate(session)}
                  disabled={!!busy}
                  className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2 py-1 rounded-lg disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {session.current ? 'خروج' : 'پایان نشست'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {others > 0 && (
        <button
          type="button"
          onClick={() => void terminateOthers()}
          disabled={!!busy}
          className="w-full py-2 text-xs font-bold rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 inline-flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          <LogOut size={13} /> خروج از همهٔ دستگاه‌های دیگر
        </button>
      )}
    </div>
  );
};
