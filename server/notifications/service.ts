import { ScopedState, activeMember, departmentAction, manager, membership, type Scope } from '../policy/scope.ts';
import { DomainError, identifier, now } from '../domain/repository.ts';

interface NotificationOptions {
  scoped: ScopedState;
  broadcast: (event: string, payload: any) => void;
  broadcastWorkspace?: (workspaceId: string, event: string, payload: any) => void;
}
interface ParentReferences {
  projectId?: string;
  taskId?: string;
  departmentId?: string;
  conversationId?: string;
  messageId?: string;
  fileId?: string;
}
export interface NotificationInput extends ParentReferences {
  workspaceId: string;
  recipientIds: string[];
  title: string;
  description: string;
  type: string;
  link?: string;
  actorId?: string;
  eventKey?: string;
}
export interface ActivityInput extends ParentReferences {
  workspaceId: string;
  actorId?: string;
  action: string;
  targetId?: string;
  targetCollection?: string;
  details?: string;
  eventKey?: string;
  accessSnapshot?: { departmentIds: string[]; conversationId?: string; participantIds?: string[] };
}
const parentCollections: Record<string, string> = { projectId: 'projects', taskId: 'tasks', departmentId: 'departments', conversationId: 'conversations', messageId: 'messages', fileId: 'files' };
const targetCollections = new Set(['projects', 'tasks', 'subtasks', 'comments', 'timeEntries', 'milestones', 'files', 'fileVersions', 'feedback', 'conversations', 'messages', 'conversationRequests', 'organizations', 'departments', 'departmentReports', 'departmentTemplates', 'teams', 'moduleDefinitions', 'moduleInstances', 'moduleRecords', 'navigationGroups', 'navigationItems', 'contentCenter', 'qaBugs']);
const actionTargets: Array<[string, string]> = [['TIME_ENTRY_', 'timeEntries'], ['CONVERSATION_REQUEST_', 'conversationRequests'], ['CONVERSATION_', 'conversations'], ['PROJECT_', 'projects'], ['TASK_', 'tasks'], ['SUBTASK_', 'subtasks'], ['COMMENT_', 'comments'], ['MILESTONE_', 'milestones'], ['FILE_', 'files'], ['FEEDBACK_', 'feedback'], ['MESSAGE_', 'messages'], ['TEAM_', 'teams'], ['DEPARTMENT_', 'departments'], ['ORGANIZATION_', 'organizations'], ['REPORT_', 'departmentReports']];
const invalid = (message = 'اطلاعات رویداد معتبر نیست.'): never => { throw new DomainError(422, 'INVALID_EVENT', message); };
const string = (value: any, maximum: number, required = true): string => {
  if (typeof value !== 'string' || value.length > maximum || required && !value.trim()) invalid();
  return value.trim();
};
const copied = (value: any) => JSON.parse(JSON.stringify(value));

/** Server events and personal inbox state share the request's durable transaction.
 * There is deliberately no endpoint for accepting client-authored notifications. */
export class NotificationService {
  constructor(readonly options: NotificationOptions) {}
  get scoped(): ScopedState { return this.options.scoped; }
  get state(): any { return this.scoped.raw; }
  private scope(): Scope {
    const scope = this.scoped.current();
    if (!scope || scope.kind !== 'workspace' || !activeMember(scope.user) || !membership(this.state, scope.user, scope.workspaceId)) throw new DomainError(403, 'WORKSPACE_FORBIDDEN', 'فضای کاری معتبر لازم است.');
    return scope;
  }
  private emit(workspaceId: string, event: string): void {
    const scope = this.scoped.current();
    if (scope?.kind === 'workspace' && scope.workspaceId === workspaceId) this.options.broadcast(event, { type: 'data_changed' });
    else this.options.broadcastWorkspace?.(workspaceId, event, { type: 'data_changed' });
  }
  private recipient(row: any): string | null {
    const values = [row.userId, row.recipientId, row.recipientUserId].filter(value => typeof value === 'string' && value.length);
    return values.length && new Set(values).size === 1 ? values[0] : null;
  }
  private parentVisible(row: any, scope: Scope, allowDeleted = false): boolean {
    for (const [field, collection] of Object.entries(parentCollections)) {
      if (row[field] === undefined || row[field] === null || row[field] === '') continue;
      const parent = this.state[collection]?.find((item: any) => item.id === row[field]);
      if (!parent || !allowDeleted && parent.deletedAt) return false;
      if (allowDeleted && parent.deletedAt) {
        if (this.scoped.scopeOf(collection, parent) !== scope.workspaceId || this.scoped.departmentIdsOf(collection, parent).some(id => !departmentAction(this.scoped, scope.user, scope.workspaceId, id, 'read'))) return false;
        const conversationId = collection === 'conversations' ? parent.id : parent.conversationId;
        if (conversationId && !this.scoped.participant(scope.user.id, conversationId, scope.workspaceId)) return false;
      } else if (!this.scoped.visible(collection, parent, scope)) return false;
    }
    if (row.conversationId && !this.scoped.participant(scope.user.id, row.conversationId, scope.workspaceId)) return false;
    if (row.messageId) {
      const message = this.state.messages.find((item: any) => item.id === row.messageId);
      if (!message || !this.scoped.participant(scope.user.id, message.conversationId, scope.workspaceId)) return false;
    }
    return true;
  }
  visible(row: any, scope = this.scope()): boolean {
    return !row.dismissedAt && this.recipient(row) === scope.user.id && this.scoped.visible('notifications', row, scope) && this.parentVisible(row, scope)
      && (!row.accessSnapshot || this.snapshotVisible(row.accessSnapshot, scope));
  }
  private notificationDTO(row: any): any {
    const result: any = { id: row.id, workspaceId: row.workspaceId, userId: this.recipient(row), recipientUserId: this.recipient(row), title: typeof row.title === 'string' ? row.title : '', description: typeof row.description === 'string' ? row.description : '', type: typeof row.type === 'string' ? row.type : 'system', read: row.read === true, timestamp: row.timestamp || row.createdAt || '', createdAt: row.createdAt || row.timestamp || '' };
    for (const key of ['readAt', 'link', ...Object.keys(parentCollections)]) if (row[key] !== undefined) result[key] = row[key];
    return result;
  }
  list(): any[] {
    const scope = this.scope();
    return this.state.notifications.filter((row: any) => this.visible(row, scope)).map((row: any) => this.notificationDTO(row));
  }
  markRead(id: string): any {
    const scope = this.scope();
    const row = this.state.notifications.find((item: any) => item.id === id && this.visible(item, scope));
    if (!row) throw new DomainError(404, 'NOTIFICATION_NOT_FOUND', 'اعلان در دسترس نیست.');
    if (row.read !== true) { row.read = true; row.readAt = now(); this.emit(scope.workspaceId, 'app_notifications_updated'); }
    return this.notificationDTO(row);
  }
  markAllRead(): { success: true; changed: number } {
    const scope = this.scope(); let changed = 0;
    for (const row of this.state.notifications) if (this.visible(row, scope) && row.read !== true) { row.read = true; row.readAt = now(); changed++; }
    if (changed) this.emit(scope.workspaceId, 'app_notifications_updated');
    return { success: true, changed };
  }
  clear(): { success: true; changed: number } {
    const scope = this.scope(); let changed = 0;
    for (const row of this.state.notifications) if (this.visible(row, scope)) { row.dismissedAt = now(); changed++; }
    if (changed) this.emit(scope.workspaceId, 'app_notifications_updated');
    return { success: true, changed };
  }
  private eventScope(input: { workspaceId: string; actorId?: string }): void {
    const scope = this.scoped.current();
    if (scope && (scope.kind !== 'workspace' || scope.workspaceId !== input.workspaceId || input.actorId && input.actorId !== scope.user.id)) throw new DomainError(403, 'EVENT_SCOPE_FORBIDDEN', 'دامنه یا نویسندهٔ رویداد معتبر نیست.');
    const workspace = this.state.workspaces.find((row: any) => row.id === input.workspaceId);
    if (!activeMember(workspace)) throw new DomainError(403, 'WORKSPACE_FORBIDDEN', 'فضای کاری معتبر لازم است.');
    if (input.actorId) {
      const actor = this.state.users.find((row: any) => row.id === input.actorId);
      if (!activeMember(actor) || !membership(this.state, actor, input.workspaceId)) throw new DomainError(403, 'EVENT_ACTOR_FORBIDDEN', 'نویسندهٔ معتبر لازم است.');
    }
  }
  private parents(input: ParentReferences, workspaceId: string, allowDeleted = false): any {
    const result: any = {};
    for (const [field, collection] of Object.entries(parentCollections)) if ((input as any)[field] !== undefined) {
      const value = string((input as any)[field], 200);
      const row = this.state[collection]?.find((item: any) => item.id === value);
      if (!row || !allowDeleted && row.deletedAt || this.scoped.scopeOf(collection, row) !== workspaceId) invalid('منبع رویداد در فضای کاری معتبر نیست.');
      result[field] = value;
    }
    // Conflicting parents must never turn a notification into a capability.
    if (this.scoped.scopeOf('event', { workspaceId, ...result }) !== workspaceId) invalid();
    return result;
  }
  notify(input: NotificationInput): any[] {
    this.eventScope(input);
    if (!Array.isArray(input.recipientIds) || input.recipientIds.length > 500 || input.recipientIds.some(id => typeof id !== 'string' || !id || id.length > 200)) invalid();
    const title = string(input.title, 500), description = string(input.description, 20_000, false), type = string(input.type, 100);
    const eventKey = input.eventKey === undefined ? undefined : string(input.eventKey, 500);
    const link = input.link === undefined ? undefined : string(input.link, 1000, false);
    if (link && (/^[a-z][a-z\d+.-]*:/i.test(link) || link.startsWith('//') || /[\r\n\\]/.test(link))) invalid('پیوند داخلی معتبر لازم است.');
    const parents = this.parents(input, input.workspaceId), created: any[] = [], actorId = input.actorId || this.scoped.current()?.user.id;
    for (const userId of new Set(input.recipientIds)) {
      if (userId === actorId) continue;
      const user = this.state.users.find((row: any) => row.id === userId);
      if (!activeMember(user) || !membership(this.state, user, input.workspaceId)) continue;
      const scope: Scope = { kind: 'workspace', user, workspaceId: input.workspaceId, path: '/api/notifications', method: 'GET' };
      const row = { id: identifier('notification'), workspaceId: input.workspaceId, userId, title, description, type, read: false, timestamp: now(), createdAt: now(), ...parents, ...(eventKey ? { eventKey } : {}), ...(link ? { link } : {}) };
      if (!this.visible(row, scope) || eventKey && this.state.notifications.some((item: any) => item.workspaceId === input.workspaceId && this.recipient(item) === userId && item.eventKey === eventKey)) continue;
      this.state.notifications.unshift(row); created.push(this.notificationDTO(row));
    }
    if (created.length) this.emit(input.workspaceId, 'app_notifications_updated');
    return created;
  }
  private target(row: any): { collection: string; row: any } | null {
    if (!row.targetId) return null;
    const named = typeof row.targetCollection === 'string' && targetCollections.has(row.targetCollection) ? row.targetCollection : actionTargets.find(([prefix]) => String(row.action).startsWith(prefix))?.[1];
    if (named) { const target = this.state[named]?.find((item: any) => item.id === row.targetId); return target ? { collection: named, row: target } : null; }
    const matches = [...targetCollections].flatMap(collection => (this.state[collection] || []).filter((item: any) => item.id === row.targetId).map((target: any) => ({ collection, row: target })));
    return matches.length === 1 ? matches[0] : null;
  }
  private snapshotVisible(snapshot: any, scope: Scope): boolean {
    if (!snapshot || !Array.isArray(snapshot.departmentIds) || snapshot.departmentIds.some((id: any) => typeof id !== 'string' || !departmentAction(this.scoped, scope.user, scope.workspaceId, id, 'read'))) return false;
    if (snapshot.participantIds !== undefined && (!Array.isArray(snapshot.participantIds) || snapshot.participantIds.some((id: any) => typeof id !== 'string') || !snapshot.participantIds.includes(scope.user.id))) return false;
    return !snapshot.conversationId || typeof snapshot.conversationId === 'string' && this.scoped.participant(scope.user.id, snapshot.conversationId, scope.workspaceId);
  }
  private activityVisible(row: any, scope: Scope): boolean {
    if (this.scoped.scopeOf('auditLogs', row) !== scope.workspaceId || !this.parentVisible(row, scope, true)) return false;
    if (row.accessSnapshot?.participantIds !== undefined && !this.snapshotVisible(row.accessSnapshot, scope)) return false;
    const target = this.target(row);
    if (target) return target.row.deletedAt
      ? this.scoped.scopeOf(target.collection, target.row) === scope.workspaceId && this.snapshotVisible(row.accessSnapshot, scope)
      : this.scoped.visible(target.collection, target.row, scope);
    if (row.accessSnapshot) return this.snapshotVisible(row.accessSnapshot, scope);
    // Unresolved historical rows have no trustworthy department snapshot.
    return (row.userId || row.actorId) === scope.user.id || manager(membership(this.state, scope.user, scope.workspaceId));
  }
  private activityDTO(row: any): any {
    const actorId = row.actorId || row.userId;
    const actor = this.state.users.find((item: any) => item.id === actorId);
    const result: any = { id: row.id, workspaceId: row.workspaceId, action: row.action, timestamp: row.timestamp || row.createdAt || '', ...(actorId ? { userId: actorId, actorId } : {}), user: actor?.name || 'سیستم' };
    for (const key of ['targetId', 'targetCollection', 'details', ...Object.keys(parentCollections)]) if (row[key] !== undefined) result[key] = row[key];
    if (row.targetId) result.target = row.targetId;
    return result;
  }
  activity(): any[] {
    const scope = this.scope();
    return this.state.auditLogs.filter((row: any) => this.activityVisible(row, scope)).slice(0, 500).map((row: any) => this.activityDTO(row));
  }
  recordActivity(input: ActivityInput): any {
    this.eventScope(input);
    const action = string(input.action, 100), details = input.details === undefined ? '' : string(input.details, 20_000, false);
    const eventKey = input.eventKey === undefined ? undefined : string(input.eventKey, 500);
    const actorId = this.scoped.current()?.user.id || input.actorId;
    if (eventKey) {
      const existing = this.state.auditLogs.find((row: any) => row.workspaceId === input.workspaceId && row.eventKey === eventKey && row.userId === actorId);
      if (existing) return this.activityDTO(existing);
    }
    if (input.targetCollection !== undefined && !targetCollections.has(input.targetCollection)) invalid();
    const row: any = { id: identifier('audit'), workspaceId: input.workspaceId, ...(actorId ? { userId: actorId } : {}), action, details, timestamp: now(), ...this.parents(input, input.workspaceId, true), ...(input.targetId ? { targetId: string(input.targetId, 200) } : {}), ...(input.targetCollection ? { targetCollection: input.targetCollection } : {}), ...(eventKey ? { eventKey } : {}) };
    const target = this.target(row);
    if (target) {
      if (this.scoped.scopeOf(target.collection, target.row) !== input.workspaceId) invalid();
      row.targetCollection = target.collection;
      row.accessSnapshot = { departmentIds: this.scoped.departmentIdsOf(target.collection, target.row), ...(target.collection === 'conversations' ? { conversationId: target.row.id } : target.row.conversationId ? { conversationId: target.row.conversationId } : {}) };
    } else if (input.accessSnapshot) {
      if (!Array.isArray(input.accessSnapshot.departmentIds) || input.accessSnapshot.departmentIds.length > 200 || input.accessSnapshot.departmentIds.some(id => typeof id !== 'string' || id.length > 200)) invalid();
      if (input.accessSnapshot.participantIds !== undefined && (!Array.isArray(input.accessSnapshot.participantIds) || input.accessSnapshot.participantIds.length > 5000 || input.accessSnapshot.participantIds.some(id => typeof id !== 'string' || !id || id.length > 200))) invalid();
      row.accessSnapshot = copied(input.accessSnapshot);
    }
    this.state.auditLogs.unshift(row); this.emit(input.workspaceId, 'app_activity_updated');
    return this.activityDTO(row);
  }
}
export const createNotificationService = (options: NotificationOptions): NotificationService => new NotificationService(options);
