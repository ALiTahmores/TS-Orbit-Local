import { randomUUID } from 'node:crypto';
import type { ScopedState } from '../policy/scope.ts';

export class DomainError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
export interface DomainContext { scoped: ScopedState; broadcast: (event: string, payload: any) => void; notify?: (input:any)=>any; }
export class Repository<T extends { id: string; [key: string]: any } = any> {
  constructor(readonly scoped: ScopedState, readonly collection: string) {}
  all(): T[] { return this.scoped.rows(this.collection); }
  find(id: string): T | undefined { return this.all().find(row => row.id === id); }
  require(id: string): T { const row = this.find(id); if (!row) throw new DomainError(404, 'RESOURCE_NOT_FOUND', 'منبع در این فضای کاری یافت نشد.'); return row; }
  insert(row: T): T { this.scoped.state[this.collection].push(row); return row; }
  update(id: string, changes: Partial<T>): T { const row = this.require(id); Object.assign(row, changes); return row; }
  remove(id: string): void { this.require(id); this.scoped.state[this.collection] = this.all().filter(row => row.id !== id); }
  removeWhere(predicate: (row: T) => boolean): void { this.scoped.state[this.collection] = this.all().filter(row => !predicate(row)); }
}
export const identifier = (prefix: string) => prefix + '_' + randomUUID();
export const now = () => new Date().toISOString();
export function recordActivity(context: DomainContext, action: string, targetId: string, details = ''): void {
  const scope = context.scoped.current();
  if (!scope || scope.kind !== 'workspace') throw new DomainError(403, 'WORKSPACE_FORBIDDEN', 'فضای کاری معتبر لازم است.');
  const collections=['projects','tasks','subtasks','comments','timeEntries','milestones','files','fileVersions','feedback','conversations','messages','conversationRequests','organizations','departments','departmentReports','departmentTemplates','teams','moduleDefinitions','moduleInstances','navigationGroups','navigationItems','contentCenter','qaBugs'];
  const targetCollection=collections.find(name=>(context.scoped.raw[name]||[]).some((row:any)=>row.id===targetId&&context.scoped.scopeOf(name,row)===scope.workspaceId));
  const target=targetCollection?context.scoped.raw[targetCollection].find((row:any)=>row.id===targetId):undefined;
  const accessSnapshot=target?{departmentIds:context.scoped.departmentIdsOf(targetCollection!,target),...(target.conversationId?{conversationId:target.conversationId}:{})}:undefined;
  // The display name at the time of the action keeps the log readable after a rename or delete.
  const label=target&&typeof (target.title??target.name)==='string'?String(target.title??target.name).slice(0,200):'';
  context.scoped.state.auditLogs.unshift({ id: identifier('audit'), workspaceId: scope.workspaceId, userId: scope.user.id, action, targetId, details, timestamp: now(),...(targetCollection?{targetCollection,accessSnapshot}:{}),...(label?{targetName:label}:{}) });
  context.broadcast('app_activity_updated',{type:'data_changed'});
}
