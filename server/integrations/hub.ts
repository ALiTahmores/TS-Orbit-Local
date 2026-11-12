import { Router } from 'express';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { activeMember, manager, membership, writer, type Scope, type ScopedState } from '../policy/scope.ts';
import { DomainError, identifier, now } from '../domain/repository.ts';

/*
 * The integrations hub: workspace events delivered to chat tools and signed
 * webhooks, and authenticated inbound hooks that create tasks or link commits
 * and pull requests to tasks. Connections live in the workspace's externalApis
 * rows (kind "integration"); their secrets never leave the server except a
 * signing key, shown once when it is created or rotated.
 */

export const INTEGRATION_EVENTS = ['task.created', 'task.updated', 'task.status_changed', 'task.completed', 'task.assigned', 'task.deleted', 'comment.created', 'project.created', 'project.updated', 'project.deleted', 'sprint.started', 'sprint.completed'] as const;
type Event = typeof INTEGRATION_EVENTS[number];
type Provider = 'slack' | 'teams' | 'discord' | 'telegram' | 'webhook' | 'incoming' | 'github';
const PROVIDERS: Record<Provider, { direction: 'outgoing' | 'incoming'; fields: string[] }> = {
  slack: { direction: 'outgoing', fields: ['webhookUrl'] },
  teams: { direction: 'outgoing', fields: ['webhookUrl'] },
  discord: { direction: 'outgoing', fields: ['webhookUrl'] },
  telegram: { direction: 'outgoing', fields: ['botToken', 'chatId'] },
  webhook: { direction: 'outgoing', fields: ['url'] },
  incoming: { direction: 'incoming', fields: ['projectId'] },
  github: { direction: 'incoming', fields: ['transitionOnMerge'] },
};
// Chat tools only accept their own webhook hosts.
const HOSTS: Partial<Record<Provider, (host: string) => boolean>> = {
  slack: host => host === 'hooks.slack.com',
  teams: host => /\.webhook\.office\.com$|\.logic\.azure\.com$|\.powerplatform\.com$/.test(host),
  discord: host => host === 'discord.com' || host === 'discordapp.com',
};
const DELIVERY_HISTORY = 25;
const STATUS_LABELS: Record<string, string> = { pending: 'در انتظار', inprogress: 'در حال انجام', review: 'در حال بررسی', completed: 'تکمیل‌شده', blocked: 'مسدود', cancelled: 'لغوشده' };
const fail = (status: number, code: string, message: string): never => { throw new DomainError(status, code, message); };

/** Public https endpoints only: never a local, private or link-local address. */
function publicUrl(value: any, label: string): URL {
  let url: URL;
  try { url = new URL(String(value || '')); } catch { return fail(422, 'INVALID_INTEGRATION', `${label} معتبر نیست.`); }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const privateV4 = /^(?:10|127|0)\.|^169\.254\.|^192\.168\.|^172\.(?:1[6-9]|2\d|3[01])\.|^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./;
  if (url.protocol !== 'https:' || url.username || url.password || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')
    || (isIP(host) === 4 && privateV4.test(host)) || (isIP(host) === 6 && /^(?:::1?$|f[cd]|fe[89ab])/.test(host))) fail(422, 'INVALID_INTEGRATION', `${label} باید نشانی عمومی https باشد.`);
  return url;
}
/** "hooks.slack.com/…a1b2": enough to recognise a target without exposing it. */
const masked = (value: string) => { try { const url = new URL(value); return `${url.hostname}/…${value.slice(-4)}`; } catch { return '…' + String(value).slice(-4); } };
const safeEqual = (a: string, b: string) => Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));

interface HubOptions {
  scoped: ScopedState;
  appOrigin: string;
  afterCommit: (operation: () => void | Promise<void>) => void;
  mutate: (operation: () => void | Promise<void>) => void;
  createTask: (scope: Scope, body: any) => any;
  comment: (scope: Scope, taskId: string, content: string) => any;
  setStatus: (scope: Scope, taskId: string, status: string, reason: string) => any;
  fetch?: typeof fetch;
}
export interface DomainEvent { workspaceId: string; actor: any; action: string; collection?: string; target?: any; targetId: string }

export class IntegrationHub {
  constructor(readonly options: HubOptions) {}
  get scoped(): ScopedState { return this.options.scoped; }
  get raw(): any { return this.scoped.raw; }

  private scope(): Scope {
    const scope = this.scoped.current();
    if (!scope || scope.kind !== 'workspace' || !membership(this.raw, scope.user, scope.workspaceId)) fail(403, 'WORKSPACE_FORBIDDEN', 'فضای کاری معتبر لازم است.');
    return scope!;
  }
  private manage(): Scope {
    const scope = this.scope();
    if (!manager(membership(this.raw, scope.user, scope.workspaceId))) fail(403, 'FORBIDDEN', 'مدیریت یکپارچه‌سازی‌ها با مدیران فضای کاری است.');
    return scope;
  }
  private rows(workspaceId: string): any[] { return this.raw.externalApis.filter((row: any) => row?.kind === 'integration' && row.workspaceId === workspaceId); }
  private find(id: string): any {
    const scope = this.manage();
    const row = this.rows(scope.workspaceId).find(item => item.id === id);
    if (!row) fail(404, 'INTEGRATION_NOT_FOUND', 'یکپارچه‌سازی یافت نشد.');
    return row;
  }
  prefix(workspaceId: string): string {
    const workspace = this.raw.workspaces.find((row: any) => row.id === workspaceId);
    return typeof workspace?.taskKeyPrefix === 'string' && /^[A-Z][A-Z0-9]{1,9}$/.test(workspace.taskKeyPrefix) ? workspace.taskKeyPrefix : 'TS';
  }

  private dto(row: any) {
    const config = row.config || {};
    const target = row.provider === 'telegram' ? (config.chatId ? `chat ${String(config.chatId).slice(-4)}` : '') : config.webhookUrl || config.url ? masked(config.webhookUrl || config.url) : '';
    return {
      id: row.id, provider: row.provider, direction: PROVIDERS[row.provider as Provider]?.direction || 'outgoing', name: row.name, enabled: row.enabled !== false,
      events: row.events || [], projectIds: row.projectIds || [], target,
      projectId: config.projectId || null, transitionOnMerge: config.transitionOnMerge || 'none',
      endpoint: PROVIDERS[row.provider as Provider]?.direction === 'incoming' ? `${this.options.appOrigin}/api/public/hooks/${row.id}` : null,
      createdAt: row.createdAt, updatedAt: row.updatedAt || row.createdAt, lastDeliveryAt: row.lastDeliveryAt || null, lastStatus: row.lastStatus || null,
      deliveries: (row.deliveries || []).slice(0, DELIVERY_HISTORY),
    };
  }

  list() {
    const scope = this.manage();
    return { taskKeyPrefix: this.prefix(scope.workspaceId), events: INTEGRATION_EVENTS, providers: Object.entries(PROVIDERS).map(([id, value]) => ({ id, direction: value.direction })), connections: this.rows(scope.workspaceId).map(row => this.dto(row)) };
  }

  private config(provider: Provider, input: any, previous: any = {}) {
    const config: any = { ...previous };
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !PROVIDERS[provider].fields.includes(key))) fail(422, 'INVALID_INTEGRATION', 'تنظیمات این اتصال معتبر نیست.');
    for (const [key, value] of Object.entries(input)) {
      // A blank secret on edit keeps the stored one.
      if ((value === '' || value === undefined) && ['webhookUrl', 'url', 'botToken'].includes(key) && previous[key]) continue;
      if (key === 'webhookUrl' || key === 'url') {
        const url = publicUrl(value, 'نشانی webhook');
        if (HOSTS[provider] && !HOSTS[provider]!(url.hostname.toLowerCase())) fail(422, 'INVALID_INTEGRATION', 'این نشانی متعلق به همین سرویس نیست.');
        config[key] = url.toString();
      } else if (key === 'botToken') {
        if (typeof value !== 'string' || !/^\d{5,15}:[A-Za-z0-9_-]{30,64}$/.test(value)) fail(422, 'INVALID_INTEGRATION', 'توکن ربات تلگرام معتبر نیست.');
        config.botToken = value;
      } else if (key === 'chatId') {
        if (typeof value !== 'string' || !/^(?:-?\d{3,20}|@[A-Za-z][A-Za-z0-9_]{3,31})$/.test(value)) fail(422, 'INVALID_INTEGRATION', 'شناسهٔ گفتگو یا کانال تلگرام معتبر نیست.');
        config.chatId = value;
      } else if (key === 'projectId') {
        if (value !== null && (typeof value !== 'string' || !this.scoped.rows('projects').some((row: any) => row.id === value))) fail(422, 'INVALID_INTEGRATION', 'پروژهٔ مقصد معتبر نیست.');
        config.projectId = value || null;
      } else if (key === 'transitionOnMerge') {
        if (!['none', 'review', 'completed'].includes(String(value))) fail(422, 'INVALID_INTEGRATION', 'وضعیت پس از ادغام معتبر نیست.');
        config.transitionOnMerge = value;
      }
    }
    for (const key of PROVIDERS[provider].fields) if (['webhookUrl', 'url', 'botToken', 'chatId'].includes(key) && !config[key]) fail(422, 'INVALID_INTEGRATION', 'اطلاعات اتصال کامل نیست.');
    return config;
  }
  private choices(body: any, previous?: any) {
    const events = body.events === undefined ? previous?.events || [] : body.events;
    const projectIds = body.projectIds === undefined ? previous?.projectIds || [] : body.projectIds;
    if (!Array.isArray(events) || events.some((event: any) => !INTEGRATION_EVENTS.includes(event))) fail(422, 'INVALID_INTEGRATION', 'رویداد انتخاب‌شده معتبر نیست.');
    const visible = new Set(this.scoped.rows('projects').map((row: any) => row.id));
    if (!Array.isArray(projectIds) || projectIds.some((id: any) => typeof id !== 'string' || !visible.has(id))) fail(422, 'INVALID_INTEGRATION', 'پروژهٔ انتخاب‌شده معتبر نیست.');
    return { events: [...new Set<string>(events)], projectIds: [...new Set<string>(projectIds)] };
  }
  private name(value: any, fallback?: string) {
    const name = value === undefined ? fallback : value;
    if (typeof name !== 'string' || !name.trim() || name.length > 120) fail(422, 'INVALID_INTEGRATION', 'نام اتصال لازم است.');
    return name!.trim();
  }

  create(body: any) {
    const scope = this.manage();
    const allowed = ['provider', 'name', 'config', 'events', 'projectIds'];
    if (!body || typeof body !== 'object' || Object.keys(body).some(key => !allowed.includes(key))) fail(422, 'INVALID_INTEGRATION', 'درخواست معتبر نیست.');
    const provider = body.provider as Provider;
    if (!PROVIDERS[provider]) fail(422, 'INVALID_INTEGRATION', 'سرویس انتخاب‌شده پشتیبانی نمی‌شود.');
    if (this.rows(scope.workspaceId).length >= 50) fail(409, 'INTEGRATION_LIMIT', 'سقف اتصال‌های این فضای کاری پر شده است.');
    const signingKey = PROVIDERS[provider].direction === 'incoming' || provider === 'webhook' ? randomBytes(24).toString('hex') : undefined;
    const row: any = {
      id: identifier('integ'), kind: 'integration', workspaceId: scope.workspaceId, provider, name: this.name(body.name),
      config: this.config(provider, body.config || {}), ...this.choices(body), enabled: true, createdById: scope.user.id, createdAt: now(), deliveries: [],
      ...(signingKey ? { signingSecret: signingKey } : {}),
    };
    this.scoped.state.externalApis.push(row);
    return { ...this.dto(row), ...(signingKey ? { signingKey } : {}) };
  }
  update(id: string, body: any) {
    const row = this.find(id);
    const allowed = ['name', 'config', 'events', 'projectIds', 'enabled'];
    if (!body || typeof body !== 'object' || Object.keys(body).some(key => !allowed.includes(key))) fail(422, 'INVALID_INTEGRATION', 'درخواست معتبر نیست.');
    if (body.enabled !== undefined && typeof body.enabled !== 'boolean') fail(422, 'INVALID_INTEGRATION', 'وضعیت اتصال معتبر نیست.');
    Object.assign(row, { name: this.name(body.name, row.name), ...this.choices(body, row), ...(body.config ? { config: this.config(row.provider, body.config, row.config) } : {}), ...(body.enabled !== undefined ? { enabled: body.enabled } : {}), updatedAt: now() });
    return this.dto(row);
  }
  remove(id: string) {
    const row = this.find(id);
    this.scoped.state.externalApis = this.scoped.state.externalApis.filter((item: any) => item.id !== row.id);
    return { success: true, deletedId: id };
  }
  rotate(id: string) {
    const row = this.find(id);
    if (!row.signingSecret) fail(422, 'INVALID_INTEGRATION', 'این اتصال کلید امضا ندارد.');
    row.signingSecret = randomBytes(24).toString('hex'); row.updatedAt = now();
    return { ...this.dto(row), signingKey: row.signingSecret };
  }
  setPrefix(body: any) {
    const scope = this.manage();
    if (!body || Object.keys(body).some(key => key !== 'taskKeyPrefix') || typeof body.taskKeyPrefix !== 'string' || !/^[A-Z][A-Z0-9]{1,9}$/.test(body.taskKeyPrefix)) fail(422, 'INVALID_PREFIX', 'پیشوند باید ۲ تا ۱۰ حرف و رقم لاتین بزرگ باشد و با حرف شروع شود.');
    const workspace = this.raw.workspaces.find((row: any) => row.id === scope.workspaceId);
    workspace.taskKeyPrefix = body.taskKeyPrefix; workspace.updatedAt = now();
    return { taskKeyPrefix: body.taskKeyPrefix };
  }
  /** A sample message to the connection, delivered after this request commits. */
  test(id: string) {
    const scope = this.manage(), row = this.find(id);
    if (PROVIDERS[row.provider as Provider].direction !== 'outgoing') fail(422, 'INVALID_INTEGRATION', 'اتصال ورودی پیام آزمایشی ندارد.');
    const message = { event: 'integration.test', occurredAt: now(), text: `پیام آزمایشی TS Orbit برای «${row.name}» از طرف ${scope.user.name || 'مدیر'}.`, data: { integrationId: row.id } };
    this.queue(row, message);
    return { queued: true };
  }

  // ---------------------------------------------------------------- outgoing

  /** Called for every recorded domain change inside its transaction. */
  emit(change: DomainEvent) {
    const events = this.events(change);
    if (!events.length) return;
    const rows = this.rows(change.workspaceId).filter(row => row.enabled !== false && PROVIDERS[row.provider as Provider]?.direction === 'outgoing');
    if (!rows.length) return;
    const snapshot = this.snapshot(change);
    for (const event of events) for (const row of rows) {
      if (!(row.events || []).includes(event)) continue;
      if ((row.projectIds || []).length && !(row.projectIds || []).includes(snapshot.projectId)) continue;
      this.queue(row, { event, occurredAt: now(), text: this.describe(event, snapshot, change.actor), data: snapshot, actor: { id: change.actor?.id, name: change.actor?.name || '' } });
    }
  }
  private events(change: DomainEvent): Event[] {
    const map: Record<string, Event[]> = {
      TASK_CREATED: ['task.created'], TASK_UPDATED: ['task.updated'], TASK_DELETED: ['task.deleted'], COMMENT_CREATED: ['comment.created'],
      PROJECT_CREATED: ['project.created'], PROJECT_UPDATED: ['project.updated'], PROJECT_ACTIVATED: ['project.updated'], PROJECT_DELETED: ['project.deleted'], TASK_ASSIGNED: ['task.assigned'],
      SPRINT_STARTED: ['sprint.started'], SPRINT_COMPLETED: ['sprint.completed'],
    };
    if (change.action === 'TASK_STATUS_CHANGED') return String(change.target?.status) === 'completed' ? ['task.status_changed', 'task.completed'] : ['task.status_changed'];
    return map[change.action] || [];
  }
  private snapshot(change: DomainEvent): any {
    const target = change.target || {};
    const project = (id: string) => this.raw.projects.find((row: any) => row.id === id);
    const names = (ids: any) => (Array.isArray(ids) ? ids : []).map((id: string) => this.raw.users.find((user: any) => user.id === id)?.name).filter(Boolean);
    const prefix = this.prefix(change.workspaceId);
    if (change.collection === 'tasks' || change.action.startsWith('TASK_')) {
      return { kind: 'task', id: change.targetId, key: target.number ? `${prefix}-${target.number}` : undefined, title: target.title || '', status: target.status, priority: target.priority,
        projectId: target.projectId || null, projectTitle: project(target.projectId)?.title || '', assignees: names(target.assignedMemberIds), dueDate: target.deadlineCanonical || target.deadline || null };
    }
    if (change.action.startsWith('SPRINT_')) {
      // Sprint actions target their project; the sprint is the running one, or the one that just closed.
      const sprints = Array.isArray(target.sprints) ? target.sprints : [];
      const sprint = change.action === 'SPRINT_STARTED' ? sprints.find((row: any) => row.state === 'active')
        : [...sprints].filter((row: any) => row.state === 'closed').sort((a: any, b: any) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')))[0];
      return { kind: 'sprint', id: sprint?.id || null, name: sprint?.name || '', goal: sprint?.goal || '', startDate: sprint?.startDate || null, endDate: sprint?.endDate || null,
        projectId: change.targetId, projectTitle: target.title || '', committedPoints: sprint?.report?.committedPoints ?? null, completedPoints: sprint?.report?.completedPoints ?? null,
        completedTasks: sprint?.report?.completedTasks ?? null, incompleteTasks: sprint?.report?.remainingTasks ?? null };
    }
    if (change.collection === 'comments') {
      const task = this.raw.tasks.find((row: any) => row.id === target.taskId);
      return { kind: 'comment', id: change.targetId, taskId: target.taskId, taskKey: task?.number ? `${prefix}-${task.number}` : undefined, taskTitle: task?.title || '', projectId: task?.projectId || null, content: String(target.content || '').slice(0, 1000) };
    }
    return { kind: 'project', id: change.targetId, title: target.title || '', status: target.status, projectId: change.targetId, progress: target.progress ?? null };
  }
  private describe(event: string, data: any, actor: any): string {
    const who = actor?.name ? ` · ${actor.name}` : '';
    const task = `${data.key ? data.key + ' ' : ''}«${data.title}»${data.projectTitle ? ` در ${data.projectTitle}` : ''}`;
    switch (event) {
      case 'task.created': return `وظیفهٔ تازه: ${task}${who}`;
      case 'task.updated': return `وظیفه ویرایش شد: ${task}${who}`;
      case 'task.status_changed': return `وضعیت ${task} → ${STATUS_LABELS[data.status] || data.status}${who}`;
      case 'task.completed': return `✅ ${task} تکمیل شد${who}`;
      case 'task.assigned': return `${task} به ${(data.assignees || []).join('، ') || 'عضو'} سپرده شد${who}`;
      case 'task.deleted': return `وظیفه حذف شد${data.title ? ': ' + task : ''}${who}`;
      case 'comment.created': return `نظر تازه روی ${data.taskKey ? data.taskKey + ' ' : ''}«${data.taskTitle}»: ${data.content.slice(0, 280)}${who}`;
      case 'project.created': return `پروژهٔ تازه: «${data.title}»${who}`;
      case 'project.updated': return `پروژه به‌روز شد: «${data.title}»${who}`;
      case 'project.deleted': return `پروژه حذف شد${who}`;
      case 'sprint.started': return `🏁 اسپرینت «${data.name}» در «${data.projectTitle}» شروع شد${data.goal ? ': ' + data.goal : ''}${who}`;
      case 'sprint.completed': return `🏆 اسپرینت «${data.name}» در «${data.projectTitle}» بسته شد: ${data.completedTasks ?? 0} کار انجام شد، ${data.incompleteTasks ?? 0} کار باز ماند${who}`;
      default: return event;
    }
  }
  private queue(row: any, message: any) {
    const target = { id: row.id, provider: row.provider as Provider, config: { ...row.config }, secret: row.signingSecret };
    this.options.afterCommit(() => this.deliver(target, message));
  }
  private request(target: { provider: Provider; config: any; secret?: string }, message: any): { url: string; init: RequestInit } {
    const link = this.options.appOrigin;
    if (target.provider === 'slack') return { url: target.config.webhookUrl, init: { body: JSON.stringify({ text: `${message.text}\n<${link}|TS Orbit>` }) } };
    if (target.provider === 'discord') return { url: target.config.webhookUrl, init: { body: JSON.stringify({ content: message.text.slice(0, 1900), allowed_mentions: { parse: [] } }) } };
    if (target.provider === 'teams') return { url: target.config.webhookUrl, init: { body: JSON.stringify({ '@type': 'MessageCard', '@context': 'https://schema.org/extensions', summary: message.text.slice(0, 120), themeColor: '155DFC', text: message.text, potentialAction: [{ '@type': 'OpenUri', name: 'TS Orbit', targets: [{ os: 'default', uri: link }] }] }) } };
    if (target.provider === 'telegram') return { url: `https://api.telegram.org/bot${target.config.botToken}/sendMessage`, init: { body: JSON.stringify({ chat_id: target.config.chatId, text: message.text, disable_web_page_preview: true }) } };
    const body = JSON.stringify({ event: message.event, occurredAt: message.occurredAt, actor: message.actor || null, data: message.data });
    const signature = createHmac('sha256', target.secret || '').update(body).digest('hex');
    return { url: target.config.url, init: { body, headers: { 'x-orbit-event': message.event, 'x-orbit-signature': `sha256=${signature}` } } };
  }
  async deliver(target: { id: string; provider: Provider; config: any; secret?: string }, message: any): Promise<void> {
    const started = Date.now();
    let ok = false, status = 0, error = '';
    try {
      const { url, init } = this.request(target, message);
      const response = await (this.options.fetch || fetch)(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000), ...init, headers: { 'content-type': 'application/json', 'user-agent': 'TS-Orbit-Integrations', ...(init.headers as any || {}) } });
      status = response.status; ok = response.ok;
      if (!ok) error = `HTTP ${status}`;
    } catch (failure: any) { error = failure?.name === 'TimeoutError' ? 'timeout' : 'network'; }
    const entry = { id: identifier('delivery'), event: message.event, at: now(), ok, status, ms: Date.now() - started, ...(error ? { error } : {}) };
    this.options.mutate(() => {
      const row = this.raw.externalApis.find((item: any) => item.id === target.id);
      if (!row) return;
      row.deliveries = [entry, ...(row.deliveries || [])].slice(0, DELIVERY_HISTORY);
      row.lastDeliveryAt = entry.at; row.lastStatus = ok ? 'ok' : 'failed';
    });
  }

  // ---------------------------------------------------------------- incoming

  /** A member who may still act for this workspace: the connection's creator. */
  private actorScope(row: any): Scope {
    const user = this.raw.users.find((item: any) => item.id === row.createdById);
    const grant = user && activeMember(user) && membership(this.raw, user, row.workspaceId);
    if (!grant || !writer(grant)) fail(403, 'INTEGRATION_ACTOR_UNAVAILABLE', 'سازندهٔ این اتصال دیگر دسترسی نوشتن ندارد.');
    return { kind: 'workspace', user, workspaceId: row.workspaceId, path: '/api/public/hooks', method: 'POST' };
  }
  private verify(row: any, request: any) {
    const raw = typeof request.rawBody === 'string' ? request.rawBody : '';
    const secret = String(row.signingSecret || '');
    const header = String(request.headers['x-hub-signature-256'] || request.headers['x-orbit-signature'] || '');
    if (header) {
      const expected = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
      if (!safeEqual(header, expected)) fail(401, 'INVALID_SIGNATURE', 'امضای درخواست معتبر نیست.');
      return;
    }
    // Tools that cannot sign (forms, no-code automations) send the key itself.
    const token = String(request.headers['x-orbit-token'] || '');
    if (row.provider !== 'incoming' || !token || !safeEqual(token, secret)) fail(401, 'INVALID_SIGNATURE', 'امضای درخواست معتبر نیست.');
  }
  receive(id: string, request: any) {
    const row = this.raw.externalApis.find((item: any) => item?.kind === 'integration' && item.id === id && PROVIDERS[item.provider as Provider]?.direction === 'incoming');
    if (!row || row.enabled === false) fail(404, 'INTEGRATION_NOT_FOUND', 'این نشانی فعال نیست.');
    const workspace = this.raw.workspaces.find((item: any) => item.id === row.workspaceId);
    if (!activeMember(workspace)) fail(404, 'INTEGRATION_NOT_FOUND', 'این نشانی فعال نیست.');
    this.verify(row, request);
    const scope = this.actorScope(row);
    const record = (event: string, ok: boolean, detail = '') => {
      row.deliveries = [{ id: identifier('delivery'), event, at: now(), ok, status: ok ? 200 : 422, ms: 0, direction: 'in', ...(detail ? { error: detail } : {}) }, ...(row.deliveries || [])].slice(0, DELIVERY_HISTORY);
      row.lastDeliveryAt = now(); row.lastStatus = ok ? 'ok' : 'failed';
    };
    return this.scoped.run(scope, () => row.provider === 'github' ? this.github(row, request, scope, record) : this.incoming(row, request.body, scope, record));
  }
  private incoming(row: any, body: any, scope: Scope, record: (event: string, ok: boolean, detail?: string) => void) {
    const allowed = ['title', 'description', 'priority', 'dueDate', 'projectId', 'assigneeEmail'];
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key)) || typeof body.title !== 'string' || !body.title.trim()) {
      record('task.create', false, 'invalid payload');
      fail(422, 'INVALID_PAYLOAD', 'عنوان وظیفه لازم است و فیلدهای مجاز: title, description, priority, dueDate, projectId, assigneeEmail.');
    }
    const projectId = body.projectId || row.config?.projectId;
    if (!projectId) { record('task.create', false, 'no project'); fail(422, 'INVALID_PAYLOAD', 'پروژهٔ مقصد مشخص نیست.'); }
    const assignee = typeof body.assigneeEmail === 'string' ? this.raw.users.find((user: any) => String(user.email || '').toLowerCase() === body.assigneeEmail.trim().toLowerCase() && membership(this.raw, user, row.workspaceId)) : null;
    const task = this.options.createTask(scope, { projectId, title: body.title.trim().slice(0, 500), description: typeof body.description === 'string' ? body.description.slice(0, 20000) : '',
      ...(body.priority ? { priority: body.priority } : {}), ...(body.dueDate ? { deadline: body.dueDate } : {}), ...(assignee ? { assignedMemberIds: [assignee.id] } : {}) });
    record('task.create', true);
    return { created: true, taskId: task.id, key: task.key || null };
  }
  private github(row: any, request: any, scope: Scope, record: (event: string, ok: boolean, detail?: string) => void) {
    const event = String(request.headers['x-github-event'] || '');
    const body = request.body || {};
    if (event === 'ping') { record('github.ping', true); return { ok: true }; }
    const prefix = this.prefix(row.workspaceId);
    const pattern = new RegExp(`\\b${prefix}-(\\d{1,7})\\b`, 'g');
    const tasks = new Map<number, any>(this.raw.tasks.filter((task: any) => task.workspaceId === row.workspaceId && Number.isInteger(task.number) && !task.deletedAt).map((task: any) => [task.number, task]));
    const linked = new Set<string>();
    const mention = (text: string) => [...String(text || '').matchAll(pattern)].map(match => tasks.get(Number(match[1]))).filter(Boolean);
    const repo = String(body.repository?.full_name || '').slice(0, 200);
    if (event === 'push') {
      for (const commit of (Array.isArray(body.commits) ? body.commits : []).slice(0, 50)) {
        const first = String(commit?.message || '').split('\n')[0].slice(0, 300);
        for (const task of mention(commit?.message)) {
          this.options.comment(scope, task.id, `🔗 کامیت ${String(commit.id || '').slice(0, 7)} در ${repo}: ${first}${commit.url ? `\n${commit.url}` : ''}`);
          linked.add(task.id);
        }
      }
    } else if (event === 'pull_request') {
      const pr = body.pull_request || {};
      const merged = body.action === 'closed' && pr.merged === true;
      if (['opened', 'reopened', 'closed', 'ready_for_review'].includes(body.action)) {
        for (const task of mention(`${pr.title || ''} ${pr.head?.ref || ''} ${pr.body || ''}`)) {
          const state = merged ? 'ادغام شد' : body.action === 'closed' ? 'بسته شد' : 'باز شد';
          this.options.comment(scope, task.id, `🔀 درخواست ادغام #${pr.number} در ${repo} ${state}: ${String(pr.title || '').slice(0, 300)}${pr.html_url ? `\n${pr.html_url}` : ''}`);
          const transition = row.config?.transitionOnMerge;
          if (merged && (transition === 'review' || transition === 'completed') && task.status !== transition && task.status !== 'completed') {
            try { this.options.setStatus(scope, task.id, transition, `ادغام PR #${pr.number}`); } catch { /* Dependencies or open subtasks keep the status. */ }
          }
          linked.add(task.id);
        }
      }
    }
    record(`github.${event || 'unknown'}`, true, linked.size ? '' : 'no task key');
    return { ok: true, linkedTasks: linked.size };
  }
}

export function createIntegrationRouter(hub: IntegrationHub): Router {
  const router = Router();
  const endpoint = (operation: (request: any) => any, status = 200) => (request: any, response: any, next: any) => {
    try { response.status(status).json(operation(request)); } catch (error) { next(error); }
  };
  router.get('/integrations', endpoint(() => hub.list()));
  router.post('/integrations', endpoint(request => hub.create(request.body), 201));
  router.put('/integrations/settings', endpoint(request => hub.setPrefix(request.body)));
  router.put('/integrations/:id', endpoint(request => hub.update(request.params.id, request.body)));
  router.delete('/integrations/:id', endpoint(request => hub.remove(request.params.id)));
  router.post('/integrations/:id/test', endpoint(request => hub.test(request.params.id), 202));
  router.post('/integrations/:id/rotate', endpoint(request => hub.rotate(request.params.id)));
  return router;
}

/** Unauthenticated inbound hooks; each request proves itself with the connection's key. */
export function createInboundHookRouter(hub: IntegrationHub): Router {
  const router = Router({ caseSensitive: true });
  router.post('/:id', (request: any, response: any) => {
    try { response.json(hub.receive(String(request.params.id), request)); }
    catch (error: any) { response.status(error?.status || 500).json({ error: error?.code || 'HOOK_FAILED', message: error?.status ? error.message : 'درخواست پردازش نشد.' }); }
  });
  return router;
}
