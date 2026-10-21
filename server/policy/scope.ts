import { AsyncLocalStorage } from 'node:async_hooks';
import { chatParticipant } from '../chat/access.ts';

export interface Scope { kind: 'workspace' | 'system'; user: any; workspaceId: string; path: string; method: string; }
const denied = new Set(['PENDING', 'PENDING_APPROVAL', 'INVITED', 'REJECTED', 'BLOCKED', 'SUSPENDED', 'INACTIVE', 'REVOKED', 'DISABLED', 'DELETED', 'DEACTIVATED']);
export function activeMember(member: any): boolean {
  return !!member && typeof member === 'object' && member.isActive !== false && member.active !== false
    && !member.deletedAt && !member.revokedAt && !['status', 'accountStatus', 'approvalStatus', 'role'].some(key => denied.has(String(member[key] || '').toUpperCase()));
}
export function membership(state: any, user: any, workspaceId: string): any | null {
  const workspace = state.workspaces.find((row: any) => row.id === workspaceId);
  if (!workspace || !activeMember(workspace) || !user) return null;
  // Identity, rather than email or an unverified user-side membership copy,
  // determines a grant. No system-role bypass exists for business data.
  const entry = (workspace.members || []).find((row: any) => row?.userId === user.id);
  if (entry && !activeMember(entry)) return null;
  if (workspace.ownerId === user.id) return { role: 'OWNER', permissions: ['*'] };
  return activeMember(entry) ? entry : null;
}
export function accessibleWorkspaces(state: any, user: any): string[] {
  return state.workspaces.filter((row: any) => membership(state, user, row.id)).map((row: any) => row.id);
}
export function manager(member: any): boolean { return !!member && ['OWNER', 'ADMIN', 'MANAGER', 'PROJECT_MANAGER'].includes(String(member.role).toUpperCase()); }
export function writer(member: any): boolean {
  if (!member || ['VIEWER', 'CLIENT', 'READ_ONLY', 'GUEST'].includes(String(member.role).toUpperCase())) return false;
  return manager(member) || (member.permissions || []).some((value: string) => ['*', 'write', 'create', 'update', 'tasks.write'].includes(value));
}
const parentFields: Record<string, string> = { projectId: 'projects', taskId: 'tasks', parentTaskId: 'tasks', teamId: 'teams', targetTeamId:'teams', departmentId: 'departments',
  organizationId: 'organizations', conversationId: 'conversations', messageId: 'messages', definitionId: 'moduleDefinitions', moduleDefinitionId: 'moduleDefinitions',
  moduleInstanceId: 'moduleInstances', moduleId: 'moduleInstances', navigationGroupId: 'navigationGroups', groupId: 'navigationGroups', fileId: 'files' };
const identityCollections = new Set(['userProfiles', 'userSettings', 'userSessions', 'loginHistory', 'userDevices', 'securityEvents', 'profileImages', 'userPreferences', 'userActivities']);
const systemCollections = new Set(['users', 'userProfiles', 'userSettings', 'userSessions', 'loginHistory', 'userDevices', 'securityEvents', 'profileImages', 'userPreferences', 'userActivities', 'approvalRequests', 'approvalHistory', 'notificationQueue', 'emailQueue', 'apiLogs', 'auditLogs']);
const chatCollections = new Set(['conversations', 'conversationMembers', 'messages', 'pinnedMessages', 'messageReactions', 'readReceipts', 'departmentChats', 'departmentChannels']);

export class ScopedState {
  private context = new AsyncLocalStorage<Scope>();
  readonly state: any;
  constructor(readonly raw: any) {
    this.state = new Proxy(raw, {
      get: (_target, key: string) => {
        const value = raw[key];
        if (!Array.isArray(value)) {
          if (key === 'settings' && this.current()?.kind === 'workspace') {
            const row = raw.userSettings.find((item: any) => item.userId === this.current()!.user.id);
            return row || {};
          }
          return value;
        }
        return this.array(key);
      },
      set: (_target, key: string, value: any) => {
        if (Array.isArray(raw[key])) { this.merge(key, this.rows(key), value); return true; }
        if (this.current()?.kind !== 'system') throw Object.assign(new Error('Protected state property'), { status: 403 });
        raw[key] = value; return true;
      },
    });
  }
  current(): Scope | undefined { return this.context.getStore(); }
  run<T>(scope: Scope, callback: () => T): T { return this.context.run(scope, callback); }
  scopeOf(collection: string, record: any, visited = new Set<any>()): string | null {
    if (!record || typeof record !== 'object' || visited.has(record)) return null;
    visited.add(record);
    if (collection === 'workspaces') return record.id;
    const scopes = new Set<string>();
    if (typeof record.workspaceId === 'string' && record.workspaceId) {
      if (!this.raw.workspaces.some((workspace: any) => workspace.id === record.workspaceId)) return null;
      scopes.add(record.workspaceId);
    }
    for (const [field, target] of Object.entries(parentFields)) {
      const id = record[field];
      if (!id || (field === 'departmentId' && id === 'AGENCY')) continue;
      const parent = (this.raw[target] || []).find((item: any) => item.id === id);
      if (!parent) return null;
      const scope = this.scopeOf(target, parent, new Set(visited));
      if (!scope) return null;
      scopes.add(scope);
    }
    return scopes.size === 1 ? [...scopes][0] : null;
  }
  memberIds(workspaceId: string): Set<string> {
    const workspace = this.raw.workspaces.find((row: any) => row.id === workspaceId);
    return new Set([workspace?.ownerId, ...(workspace?.members || []).filter(activeMember).map((row: any) => row.userId)].filter(Boolean));
  }
  participant(userId: string, conversationId: string, workspaceId: string): boolean {
    return chatParticipant(this, userId, conversationId, workspaceId);
  }
  teamLeader(userId: string, teamId: string, workspaceId: string): boolean {
    const team = this.raw.teams.find((row: any) => row.id === teamId);
    return !!team && this.scopeOf('teams', team) === workspaceId &&
      (team.leaderId === userId || this.raw.teamMembers.some((row: any) => row.teamId === teamId && row.userId === userId && row.isLeader === true && activeMember(row)));
  }
  visible(collection: string, row: any, scope = this.current()): boolean {
    if (!scope) return false;
    if (scope.kind === 'system') return systemCollections.has(collection);
    if (collection === 'workspaces') return scope.path === '/api/workspaces' ? !!membership(this.raw, scope.user, row.id) : row.id === scope.workspaceId;
    if (collection === 'users') return this.memberIds(scope.workspaceId).has(row.id);
    if (identityCollections.has(collection)) return row.userId === scope.user.id;
    if (['approvalRequests', 'approvalHistory', 'notificationQueue', 'emailQueue', 'apiLogs'].includes(collection)) return false;
    if (collection === 'teamMembers' && !row.teamId && !row.workspaceId) return this.memberIds(scope.workspaceId).has(row.userId || row.id);
    if (collection === 'conversationPermissions') return this.scopeOf(collection, row) === scope.workspaceId && (row.userId === scope.user.id || manager(membership(this.raw, scope.user, scope.workspaceId)) || this.teamLeader(scope.user.id, row.teamId, scope.workspaceId));
    if (collection === 'conversationRequests') {
      const team = this.raw.teams.find((item: any) => item.id === row.targetTeamId);
      return team && this.scopeOf('conversationRequests',row)===scope.workspaceId && this.visible('teams',team,scope) && (row.senderId === scope.user.id || manager(membership(this.raw, scope.user, scope.workspaceId)) || this.teamLeader(scope.user.id, team.id, scope.workspaceId));
    }
    if (this.scopeOf(collection, row) !== scope.workspaceId) return false;
    if (collection === 'files' || collection === 'fileVersions') {
      const file = collection === 'files' ? row : this.raw.files.find((item: any) => item.id === row.fileId);
      if (!file || row.deletedAt || file.deletedAt) return false;
      if (file.conversationId && !this.participant(scope.user.id, file.conversationId, scope.workspaceId)) return false;
    }
    if (collection === 'departmentReports' && (row.scope === 'agency' || row.departmentId === 'AGENCY') && !Array.isArray(row.reportDepartmentIds) && row.creatorId !== scope.user.id && !manager(membership(this.raw,scope.user,scope.workspaceId))) return false;
    if (this.departmentIdsOf(collection, row).some(departmentId => !departmentAction(this, scope.user, scope.workspaceId, departmentId, 'read'))) return false;
    if (collection === 'notifications') return row.userId === scope.user.id || row.recipientId === scope.user.id || row.recipientUserId === scope.user.id;
    if (chatCollections.has(collection)) {
      const conversationId = collection === 'conversations' ? row.id : row.conversationId || (row.messageId ? this.raw.messages.find((message: any) => message.id === row.messageId)?.conversationId : undefined);
      return !!conversationId && this.participant(scope.user.id, conversationId, scope.workspaceId);
    }
    return true;
  }
  rows(collection: string): any[] { return (this.raw[collection] || []).filter((row: any) => this.visible(collection, row)); }
  departmentOf(collection: string, row: any, visited = new Set<any>()): string | null {
    return this.departmentIdsOf(collection, row, visited)[0] || null;
  }
  departmentIdsOf(collection: string, row: any, visited = new Set<any>()): string[] {
    if (!row || visited.has(row)) return [];
    visited.add(row);
    const ids = new Set<string>();
    if (Array.isArray(row.reportDepartmentIds)) for (const id of row.reportDepartmentIds) if (typeof id === 'string') ids.add(id);
    if (collection === 'departments') ids.add(row.id);
    if (row.departmentId && row.departmentId !== 'AGENCY') ids.add(row.departmentId);
    if (row.department && this.raw.departments.some((department: any) => department.id === row.department)) ids.add(row.department);
    for (const [field, parent] of Object.entries({ taskId: 'tasks', parentTaskId: 'tasks', projectId: 'projects', teamId: 'teams', targetTeamId:'teams', moduleInstanceId: 'moduleInstances', moduleId: 'moduleInstances', conversationId: 'conversations', messageId: 'messages', fileId: 'files' })) {
      const record = (this.raw[parent] || []).find((item: any) => item.id === row[field]);
      if (record) for (const id of this.departmentIdsOf(parent, record, new Set(visited))) ids.add(id);
    }
    return [...ids];
  }
  private stamp(collection: string, row: any): any {
    const scope = this.current();
    if (!scope || !row || typeof row !== 'object') throw Object.assign(new Error('Missing record scope'), { status: 403 });
    if (scope.kind === 'system') {
      if (!systemCollections.has(collection)) throw Object.assign(new Error('System role has no business bypass'), { status: 403 });
      return row;
    }
    if (collection === 'users' || collection === 'workspaces') throw Object.assign(new Error('Use identity/workspace services'), { status: 403 });
    if (!identityCollections.has(collection)) {
      if (row.workspaceId && row.workspaceId !== scope.workspaceId) throw Object.assign(new Error('Wrong workspace'), { status: 403 });
      row.workspaceId = scope.workspaceId;
      if (collection === 'notifications' && !row.userId && !row.recipientId) row.userId = scope.user.id;
    }
    return row;
  }
  private merge(collection: string, before: any[], after: any[]): void {
    if (!Array.isArray(after)) throw Object.assign(new Error('Invalid collection'), { status: 422 });
    const original = this.raw[collection];
    const visible = new Set(before);
    for (const row of after) {
      if (original.includes(row) && !visible.has(row)) throw Object.assign(new Error('Foreign record mutation'), { status: 403 });
      if (!original.includes(row)) this.stamp(collection, row);
    }
    this.raw[collection] = [...original.filter((row: any) => !visible.has(row)), ...after];
  }
  private array(collection: string): any[] {
    const view = this.rows(collection);
    const initial = [...view];
    const operations = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin']);
    return new Proxy(view, {
      get: (target, key, receiver) => operations.has(String(key)) ? (...args: any[]) => {
        const result = (Array.prototype as any)[key].apply(target, args);
        this.merge(collection, initial, target);
        initial.splice(0, initial.length, ...target);
        return result;
      } : Reflect.get(target, key, receiver),
      set: (target, key, value) => {
        const result = Reflect.set(target, key, value);
        this.merge(collection, initial, target);
        initial.splice(0, initial.length, ...target);
        return result;
      },
    });
  }
}

/** Explicit department permissions can restrict an existing workspace grant;
 * they cannot turn a viewer or an outsider into a writer. Team IDs are resolved
 * from server-owned team membership, never user-supplied profile roles. */
export function departmentAction(scoped: ScopedState, user: any, workspaceId: string, departmentId: string | null, action: string): boolean {
  const grant = membership(scoped.raw, user, workspaceId);
  if (!grant) return false;
  if (manager(grant)) return true;
  if (action !== 'read' && !writer(grant)) return false;
  if (!departmentId || departmentId === 'AGENCY') return true;
  const department = scoped.raw.departments.find((row: any) => row.id === departmentId);
  if (!department || scoped.scopeOf('departments', department) !== workspaceId) return false;
  const roles = new Set([String(grant.role || '').toUpperCase()]);
  for (const row of scoped.raw.departmentMembers) if (row.userId === user.id && row.departmentId === departmentId && activeMember(row)) roles.add(String(row.role || '').toUpperCase());
  for (const row of scoped.raw.teamMembers) {
    if (row.userId !== user.id || !activeMember(row)) continue;
    const team = scoped.raw.teams.find((team: any) => team.id === row.teamId);
    if (team && scoped.scopeOf('teams', team) === workspaceId) roles.add(String(team.id).toUpperCase());
  }
  const rules = scoped.raw.departmentPermissions.filter((row: any) => row.departmentId === departmentId && row.action === action && roles.has(String(row.role || '').toUpperCase()) && scoped.scopeOf('departmentPermissions', row) === workspaceId);
  return !rules.some((row: any) => row.isAllowed === false);
}
