import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { ScopedState } from '../policy/scope.ts';
import { activeMember, manager, membership, writer } from '../policy/scope.ts';
import { DomainError, identifier, now } from '../domain/repository.ts';
import { dto, strings, text } from '../domain/models.ts';

export interface PortalFiles {
  listPublic(project: any): any[];
  sendPublic(req: any, res: any, next: any, project: any, fileId: string, versionId?: string): Promise<void> | void;
  uploadPublic(req: any, res: any, next: any, project: any): Promise<void> | void;
  validatePublicAttachment?(project: any, fileId: string): boolean;
}
export interface PortalOptions {
  files?: PortalFiles;
  broadcast?: (event: string, payload: any) => void;
  broadcastWorkspace?: (workspaceId: string, event: string, payload: any) => void;
}
const categories = new Set(['design', 'content', 'technical', 'general']);
const statuses = new Set(['pending', 'in_progress', 'resolved', 'approved', 'rejected']);
export function portalToken(project: any): string | undefined {
  const token = project.clientPortalToken || project.portalToken;
  if (typeof token !== 'string' || token.length < 20 || token.length > 300 || token === project.id || String(project.id).includes(token)) return undefined;
  return token;
}
export const portalRevoked = (project: any) => !!(project.portalRevokedAt || project.clientPortalRevokedAt || project.portalRevoked || project.clientPortalRevoked);
export function resolvePortalProject(state: any, scoped: ScopedState, token: string, at = Date.now()): any | undefined {
  if (typeof token !== 'string' || token.length < 20 || token.length > 300) return undefined;
  const input = Buffer.from(token);
  const matches = state.projects.filter((project: any) => {
    const workspaceId = scoped.scopeOf('projects', project);
    if (!workspaceId || !activeMember(state.workspaces.find((row: any) => row.id === workspaceId)) || project.deletedAt
      || !project.clientPortalEnabled || project.isPortalActive === false || portalRevoked(project)) return false;
    const stored = portalToken(project);
    if (!stored) return false;
    // Exact historical capabilities without expiry remain valid until explicitly revoked.
    for (const expiry of [project.portalExpiresAt, project.clientPortalExpiresAt]) {
      if (expiry == null) continue;
      try { if (Date.parse(portalExpiry(expiry, true)!) <= at) return false; }
      catch { return false; }
    }
    const expected = Buffer.from(stored);
    return expected.length === input.length && timingSafeEqual(expected, input);
  });
  return matches.length === 1 ? matches[0] : undefined;
}
export function portalExpiry(value: any, supplied: boolean): string | null {
  if (!supplied) return new Date(Date.now() + 30 * 86400_000).toISOString();
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 100 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new DomainError(422, 'VALIDATION_FAILED', 'تاریخ انقضای معتبر لازم است.');
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) throw new DomainError(422, 'VALIDATION_FAILED', 'تاریخ انقضای معتبر لازم است.');
  return new Date(value).toISOString();
}
export function setPortalExpiry(project: any, expiry: string | null): void { project.portalExpiresAt = expiry; project.clientPortalExpiresAt = expiry; }
export function rotatePortal(project: any, expiry: string | null): string {
  const token = randomBytes(32).toString('hex');
  project.portalToken = token; project.clientPortalToken = token;
  setPortalExpiry(project, expiry);
  project.portalRevokedAt = null; project.clientPortalRevokedAt = null;
  project.portalRevoked = false; project.clientPortalRevoked = false;
  project.portalRotatedAt = now(); project.updatedAt = now();
  return token;
}
export function publicProject(project: any): any {
  const fields = ['id', 'title', 'name', 'description', 'progress', 'totalTasks', 'completedTasks', 'status', 'deadline', 'dueDate', 'startDate', 'clientName', 'websiteUrl'];
  const result: any = Object.fromEntries(fields.filter(field => project[field] !== undefined).map(field => [field, project[field]]));
  if (!project.isBudgetConfidential && !project.isConfidential && project.budget !== undefined) result.budget = project.budget;
  return result;
}
export class FeedbackService {
  constructor(readonly state: any, readonly scoped: ScopedState, readonly options: PortalOptions = {}) {}
  project(id: string): any { const project = this.scoped.rows('projects').find((row: any) => row.id === id && !row.deletedAt); if (!project) throw new DomainError(404, 'RESOURCE_NOT_FOUND', 'پروژه یافت نشد.'); return project; }
  actor(manage = false): any {
    const scope = this.scoped.current();
    const grant = scope?.kind === 'workspace' && membership(this.state, scope.user, scope.workspaceId);
    if (!grant || !(manage ? manager(grant) : writer(grant))) throw new DomainError(403, 'PERMISSION_DENIED', 'دسترسی کافی ندارید.');
    return scope!.user;
  }
  matches(project: any, row: any): boolean { return row.projectId === project.id && this.scoped.scopeOf('feedback', row) === this.scoped.scopeOf('projects', project); }
  rows(project: any): any[] {
    const rows = this.state.feedback.filter((row: any) => this.matches(project, row));
    const ids = new Set(rows.map((row: any) => row.id));
    for (const row of project.clientFeedbacks || []) {
      if (!row || typeof row.id !== 'string' || ids.has(row.id) || row.projectId && row.projectId !== project.id || row.workspaceId && row.workspaceId !== this.scoped.scopeOf('projects', project)) continue;
      const candidate = { ...row, projectId: project.id, workspaceId: this.scoped.scopeOf('projects', project), legacyNested: true };
      if (this.matches(project, candidate)) { rows.push(candidate); ids.add(row.id); }
    }
    return rows;
  }
  require(project: any, id: string): any {
    const matches = this.rows(project).filter(row => row.id === id && !row.deletedAt);
    if (matches.length !== 1) throw new DomainError(404, 'RESOURCE_NOT_FOUND', 'بازخورد یافت نشد.');
    const row = matches[0];
    if (row.legacyNested) {
      if (this.state.feedback.some((item: any) => item.id === row.id)) throw new DomainError(409, 'DUPLICATE_ID', 'شناسهٔ بازخورد تکراری است.');
      delete row.legacyNested;
      this.state.feedback.push(row);
      project.clientFeedbacks = project.clientFeedbacks.filter((item: any) => item.id !== id);
    }
    return row;
  }
  category(value: any): string { const category = value === undefined ? 'general' : text(value, 'دسته‌بندی', true, 80); if (!categories.has(category)) throw new DomainError(422, 'VALIDATION_FAILED', 'دسته‌بندی معتبر نیست.'); return category; }
  publicVisible(row: any): boolean { return !row.deletedAt && (row.source === 'client_portal' || row.clientVisible === true || row.isPublic === true); }
  attachmentIds(project: any, value: any, publicOnly: boolean): string[] {
    return (Array.isArray(value) ? value : []).filter(id => typeof id === 'string' && this.state.files.some((file: any) => file.id === id && file.projectId === project.id && !file.deletedAt && this.scoped.scopeOf('files', file) === this.scoped.scopeOf('projects', project) && (!publicOnly || file.managed === true && this.options.files?.validatePublicAttachment?.(project, id) === true)));
  }
  validateAttachments(project: any, value: any, publicOnly: boolean): string[] {
    const ids = value === undefined ? [] : strings(value, 'پیوست‌ها', 30);
    const valid = this.attachmentIds(project, ids, publicOnly);
    if (ids.length !== valid.length || ids.some(id => !this.state.files.some((file: any) => file.id === id && file.managed === true))) throw new DomainError(422, 'INVALID_ATTACHMENT', 'پیوست معتبر و متعلق به همین پروژه لازم است.');
    return ids;
  }
  projectDTO(project: any, row: any, publicOnly = false): any {
    const result: any = { id: row.id, projectId: project.id, senderName: publicOnly && row.source !== 'client_portal' ? 'مدیریت پروژه' : row.senderName || 'مدیریت پروژه', senderRole: row.senderRole === 'client' || row.source === 'client_portal' ? 'client' : 'admin', category: categories.has(row.category) ? row.category : 'general', message: row.message ?? row.content ?? '', status: statuses.has(row.status) ? row.status : 'pending', createdAt: row.createdAt, attachments: this.attachmentIds(project, row.attachments, publicOnly) };
    result.history = (Array.isArray(row.history) ? row.history : []).map((entry: any) => Object.fromEntries(['id', 'action', 'fromStatus', 'toStatus', 'createdAt', ...(!publicOnly ? ['actorId', 'actorName'] : [])].filter(key => entry[key] !== undefined).map(key => [key, entry[key]])));
    result.replies = (Array.isArray(row.replies) ? row.replies : []).filter((reply: any) => !publicOnly || reply.clientVisible !== false).map((reply: any) => ({ id: reply.id, message: reply.message, createdAt: reply.createdAt, senderRole: 'admin', senderName: publicOnly ? 'مدیریت پروژه' : reply.actorName, ...(!publicOnly ? { actorId: reply.actorId } : {}) }));
    if (!publicOnly) Object.assign(result, { source: row.source, clientVisible: this.publicVisible(row), approved: row.approved === true, updatedAt: row.updatedAt });
    return result;
  }
  publicList(project: any): any[] { return this.rows(project).filter(row => this.publicVisible(row)).map(row => this.projectDTO(project, row, true)); }
  privateList(project: any): any[] { return this.rows(project).filter(row => !row.deletedAt).map(row => this.projectDTO(project, row)); }
  history(row: any, action: string, actor: any, fromStatus?: string, toStatus?: string): void {
    row.history = [...(Array.isArray(row.history) ? row.history : []), { id: identifier('feedback_event'), action, actorId: actor?.id ?? null, actorName: actor?.name ?? null, createdAt: now(), ...(fromStatus ? { fromStatus } : {}), ...(toStatus ? { toStatus } : {}) }];
  }
  publish(project: any): void {
    const workspaceId = this.scoped.scopeOf('projects', project)!;
    const emit = (event: string, payload: any) => this.scoped.current()?.kind === 'workspace' ? this.options.broadcast?.(event, payload) : this.options.broadcastWorkspace?.(workspaceId, event, payload);
    emit('app_feedback_updated', { projectId: project.id, type: 'data_changed' });
    emit('app_notifications_updated', []);
  }
  notify(project: any, row: any, actor?: any): void {
    const workspaceId = this.scoped.scopeOf('projects', project)!;
    const workspace = this.state.workspaces.find((item: any) => item.id === workspaceId);
    const owner = this.state.users.find((item: any) => item.id === workspace?.ownerId);
    if (owner && owner.id !== actor?.id && activeMember(owner) && membership(this.state, owner, workspaceId)) this.state.notifications.unshift({ id: identifier('notification'), workspaceId, projectId: project.id, feedbackId: row.id, userId: owner.id, title: 'بازخورد جدید پروژه', description: 'بازخورد جدیدی برای پروژه ثبت شد.', type: 'client_feedback', read: false, timestamp: now(), createdAt: now() });
    this.publish(project);
  }
  createPublic(project: any, body: any): any {
    const input = dto(body, ['senderName', 'content', 'category', 'attachments']);
    const row: any = { id: identifier('fb'), projectId: project.id, workspaceId: this.scoped.scopeOf('projects', project), senderName: text(input.senderName, 'نام', true, 100), senderRole: 'client', message: text(input.content, 'بازخورد', true, 10_000), category: this.category(input.category), attachments: this.validateAttachments(project, input.attachments, true), status: 'pending', source: 'client_portal', clientVisible: true, createdAt: now(), updatedAt: now(), history: [], replies: [] };
    row.content = row.message; this.history(row, 'submitted', null, undefined, 'pending');
    this.state.feedback.push(row); this.notify(project, row); return row;
  }
  createPrivate(project: any, body: any): any {
    const actor = this.actor(); const input = dto(body, ['message', 'category', 'attachments', 'clientVisible']);
    if (input.clientVisible !== undefined && typeof input.clientVisible !== 'boolean') throw new DomainError(422, 'VALIDATION_FAILED', 'وضعیت نمایش معتبر نیست.');
    if (input.clientVisible === true) this.actor(true);
    const row: any = { id: identifier('fb'), projectId: project.id, workspaceId: this.scoped.scopeOf('projects', project), creatorId: actor.id, senderName: actor.name, senderRole: 'admin', message: text(input.message, 'بازخورد', true, 10_000), category: this.category(input.category), attachments: this.validateAttachments(project, input.attachments, input.clientVisible === true), status: 'pending', source: 'internal', clientVisible: input.clientVisible === true, createdAt: now(), updatedAt: now(), history: [], replies: [] };
    this.history(row, 'submitted', actor, undefined, 'pending'); this.state.feedback.push(row); this.notify(project, row, actor); return row;
  }
  update(project: any, id: string, body: any): any {
    const actor = this.actor(true); const input = dto(body, ['status', 'reply']);
    if (!statuses.has(input.status)) throw new DomainError(422, 'VALIDATION_FAILED', 'وضعیت بازخورد معتبر نیست.');
    const reply = input.reply === undefined ? undefined : text(input.reply, 'پاسخ', true, 10_000);
    const row = this.require(project, id); const previous = row.status || 'pending';
    row.status = input.status; row.updatedAt = now();
    this.history(row, 'status_changed', actor, previous, row.status);
    row.approved = row.status === 'approved';
    if (row.approved) { row.approvedById = actor.id; row.approvedAt = now(); }
    else { row.approvedById = null; row.approvedAt = null; }
    if (reply !== undefined) { row.replies = [...(Array.isArray(row.replies) ? row.replies : []), { id: identifier('reply'), message: reply, actorId: actor.id, actorName: actor.name, createdAt: now(), clientVisible: this.publicVisible(row) }]; this.history(row, 'replied', actor); }
    this.publish(project); return row;
  }
  remove(project: any, id: string): void { const actor = this.actor(true); const row = this.require(project, id); row.deletedAt = now(); row.deletedById = actor.id; row.updatedAt = now(); this.history(row, 'deleted', actor); this.publish(project); }
}
