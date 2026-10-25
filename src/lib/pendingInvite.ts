// Workspace invite links (/join/<code>). The code is kept for this browser tab until
// the visitor has signed in or registered, then exchanged for a membership once.
import { apiFetch } from './api';

const KEY = 'orbit_pending_invite';

export function invitePath(code: string) {
  return `${window.location.origin}/join/${encodeURIComponent(code)}`;
}

/** Move an invite code from the address bar into session storage; returns it. */
export function captureInviteFromUrl(): string | null {
  const match = /^\/join\/([A-Za-z0-9_-]{4,128})\/?$/.exec(window.location.pathname);
  if (!match) return pendingInvite();
  try {
    sessionStorage.setItem(KEY, match[1]);
    sessionStorage.setItem('orbit_auth_notice', 'برای پیوستن به فضای کاری دعوت‌شده، وارد حساب خود شوید یا ثبت‌نام کنید.');
  } catch { /* Storage blocked: the invite is used only in this page load. */ }
  window.history.replaceState(null, '', '/');
  return match[1];
}

export function pendingInvite(): string | null {
  try { return sessionStorage.getItem(KEY); } catch { return null; }
}

/** Join the invited workspace and open it. Throws the server's message on failure. */
export async function acceptPendingInvite(code: string): Promise<void> {
  const response = await apiFetch('/api/workspaces/join', { method: 'POST', body: JSON.stringify({ inviteCode: code }) });
  const data = await response.json();
  if (!data?.workspace?.id) throw new Error('پیوستن به فضای کاری انجام نشد.');
  localStorage.setItem('activeWorkspaceId', data.workspace.id);
  // A failed join must remain retryable on reload. Do not clear a newer invite
  // that was opened while this request was in flight.
  try { if (pendingInvite() === code) sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  window.location.reload();
}
