import type { Request, Response, NextFunction } from 'express';
import { contracts } from './contracts.ts';
import { domainContracts } from '../domain/contracts.ts';
import { assetPortalContracts } from './stage5-contracts.ts';
import { collaborationContracts } from './stage6-contracts.ts';
import { FeedbackService } from '../portal/service.ts';
import { ScopedState, membership, accessibleWorkspaces, manager, writer, departmentAction, type Scope } from './scope.ts';
export { ScopedState, membership, accessibleWorkspaces, manager, writer } from './scope.ts';

const route = (path: string) => new RegExp('^' + path.split('/').map(part => part.startsWith(':') ? '([^/]+)' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/') + '/?$');
const systemPath = (method: string, path: string) => path.startsWith('/api/owner/') || path === '/api/logs'
  || (path.startsWith('/api/users') && !['GET', 'HEAD'].includes(method));
const scopedContracts = [...collaborationContracts, ...assetPortalContracts, ...domainContracts];
const definitions = [...scopedContracts, ...contracts.filter(item => !scopedContracts.some(domain => domain.method === item.method && domain.path === item.path))].map(item => ({ ...item, pattern: route(item.path) }));
const resources: Record<string, string> = { projects: 'projects', tasks: 'tasks', milestones: 'milestones', subtasks: 'subtasks', comments: 'comments', organizations: 'organizations', teams: 'teams',
  'content-center': 'contentCenter', 'qa-bugs': 'qaBugs', files: 'files', 'wordpress-checklist': 'wordpressChecklist', 'seo-checklist': 'seoChecklist',
  'external-connections': 'externalApis', departments: 'departments', modules: 'moduleDefinitions', 'module-instances': 'moduleInstances', templates: 'departmentTemplates', reports: 'departmentReports',
  conversations: 'conversations', messages: 'messages', requests: 'conversationRequests', notifications: 'notifications', 'time-entries': 'timeEntries', 'navigation-groups': 'navigationGroups', 'navigation-items': 'navigationItems', versions: 'fileVersions', feedbacks: 'feedback' };
const references: Record<string, string> = { projectId: 'projects', taskId: 'tasks', parentTaskId: 'tasks', departmentId: 'departments', teamId: 'teams', targetTeamId: 'teams', messageId: 'messages',
  conversationId: 'conversations', definitionId: 'moduleDefinitions', moduleDefinitionId: 'moduleDefinitions', moduleInstanceId: 'moduleInstances', organizationId: 'organizations', recipientId: 'users', leaderId: 'users', teamLeadId: 'users', leadId: 'users', assigneeId: 'users', ownerId: 'users', writerId: 'users', reviewerId: 'users', groupId: 'navigationGroups', moduleId: 'moduleInstances' };
const arrays: Record<string, string> = { assignedMemberIds: 'users', memberIds: 'users', userIds: 'users', assignedTeamIds: 'teams', dependencies: 'tasks', attachmentIds: 'files' };
const projectFields = ['title','name','description','websiteUrl','clientName','teamLead','teamLeadId','leadId','assignedMemberIds','assignedTeamIds','selectedTeams','department','category','budget','currency','amount',
  'dueDate','deadline','startDate','priority','status','isConfidential','isBudgetConfidential'];
const overrides: Record<string, string[]> = {
  'POST /api/projects': [...projectFields, 'workspaceId'], 'PUT /api/projects/:id': projectFields,
  'POST /api/tasks': ['workspaceId','projectId','title','description','assignedTo','assigneeId','assignedMemberIds','priority','department','deadline','tags','attachments','dependencies','estimatedHours','estimate'],
  'PUT /api/tasks/:id': ['projectId','title','description','assignedTo','assigneeId','assignedMemberIds','priority','department','deadline','tags','attachments','dependencies','estimatedHours','estimate','status'],
  'POST /api/org/departments': ['name','icon','color','description','leaderId','order','organizationId'],
  'POST /api/org/module-instances': ['definitionId','departmentId','name','config','organizationId'],
  'POST /api/org/reports': ['title','content','departmentId','scope','metrics','projectSummary','taskSummary','clientProjectsMatrix','departmentBreakdown','memberBottlenecks','bottlenecks','keyTakeaways','generatedAt','custom'],
  'DELETE /api/org/reports/bulk': ['ids'],
  'PUT /api/projects/:id/portal': ['enabled'], 'POST /api/projects/:id/portal-token': [],
};
const additional = [{ method: 'PUT', path: '/api/projects/:id/portal', pattern: route('/api/projects/:id/portal'), fields: ['enabled'] },
  { method: 'POST', path: '/api/projects/:id/portal-token', pattern: route('/api/projects/:id/portal-token'), fields: [] },
  { method: 'GET', path: '/api/sites/:projectId/key', pattern: route('/api/sites/:projectId/key'), fields: [] }];

function reject(res: Response, status: number, error: string, message: string): void { res.status(status).json({ error, message }); }
function safeJson(value: any, depth = 0): boolean {
  if (depth > 20) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.length <= 128_000;
  if (Array.isArray(value)) return value.length <= 500 && value.every(item => safeJson(item, depth + 1));
  if (value && typeof value === 'object') return Object.entries(value).every(([key, item]) => !['__proto__','prototype','constructor'].includes(key) && safeJson(item, depth + 1));
  return value === null || typeof value === 'boolean' || value === undefined;
}
function validField(key: string, value: any): boolean {
  const booleans = ['enabled','isAllowed','completed','pin','isGroup','isBudgetConfidential','isConfidential','isActive','clientVisible','approved','closed','muted'];
  if (booleans.includes(key)) return typeof value === 'boolean';
  if (['order','progress','estimatedHours','estimate','amount','hours','loggedHours'].includes(key)) return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= (key === 'progress' ? 100 : 1e12);
  if (['assignedMemberIds','assignedTeamIds','memberIds','userIds','attachmentIds','selectedTeams','dependencies','tags','ids'].includes(key)) return Array.isArray(value) && value.length <= 200 && value.every(item => typeof item === 'string' && item.length <= 200);
  if (key==='codeSnippet'&&value===null) return true;
  if (['codeSnippet','voiceNote'].includes(key)) return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (['attachments','mentions'].includes(key)) return Array.isArray(value) && value.length <= 50 && value.every(item => (key === 'attachments' && typeof item === 'string' && item.length <= 2000) || !!item && typeof item === 'object' && !Array.isArray(item));
  if (['assignees','subtasks'].includes(key)) return Array.isArray(value) && value.length <= 200 && value.every(item=>typeof item==='string'||!!item&&typeof item==='object'&&!Array.isArray(item));
  if (['links','initialComments'].includes(key)) return Array.isArray(value) && value.length<=100 && value.every(item=>typeof item==='string'&&item.length<=20_000);
  if (key==='name' && value && typeof value==='object' && !Array.isArray(value)) return Object.keys(value).every(key=>['fa','en'].includes(key)) && Object.values(value).every(item=>typeof item==='string'&&item.length<=200);
  if (['config','credentials','metrics','projectSummary','taskSummary','custom','customFields','payload','data'].includes(key)) return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (key === 'structure') return value !== null && typeof value === 'object';
  if (['clientProjectsMatrix','departmentBreakdown','memberBottlenecks','bottlenecks','keyTakeaways','defaultModules'].includes(key)) return Array.isArray(value);
  if (key.endsWith('Id') && value === null) return true;
  if (key === 'expiresAt' && value === null) return true;
  if (typeof value !== 'string') return false;
  const maximum = ['content','contentBody','description','notes','feedbackContent','requestText','message','reply'].includes(key) ? 20_000 : key.endsWith('Id') ? 200 : 500;
  if (value.length > maximum) return false;
  if (['title','name','pageName','content'].includes(key) && !value.trim()) return false;
  if (['websiteUrl','siteUrl','endpointUrl'].includes(key) && value) {
    try { const url = new URL(value); if (!['http:','https:'].includes(url.protocol) || url.username || url.password) return false; } catch { return false; }
  }
  return true;
}
export function createPolicy(scoped: ScopedState, authenticateToken: any) {
  const validateResource = (collection: string, id: any, scope: Scope): any => {
    if (typeof id !== 'string' || !id || id.length > 200) return null;
    let row = (scoped.raw[collection] || []).find((item: any) => item.id === id);
    if (!row && collection === 'feedback') {
      const match = /^\/api\/projects\/([^/]+)\/feedbacks\//.exec(scope.path);
      let projectId: string | undefined;
      try { projectId = match ? decodeURIComponent(match[1]) : undefined; } catch { return null; }
      const project = scoped.raw.projects.find((item: any) => item.id === projectId && scoped.visible('projects', item, scope));
      if (project) {
        const historical = new FeedbackService(scoped.raw, scoped).rows(project).filter((item: any) => item.id === id && !item.deletedAt);
        if (historical.length === 1) row = historical[0];
      }
    }
    return row && scoped.visible(collection, row, scope) ? row : null;
  };
  const middleware = (req: any, res: Response, next: NextFunction) => {
    if (!/^\/api\//i.test(req.path)) return next();
    authenticateToken(req, res, () => {
      const definition = [...definitions, ...additional].find(item => item.method === req.method && item.pattern.test(req.path));
      if (!definition) return reject(res, 404, 'ENDPOINT_NOT_FOUND', 'این مسیر تعریف نشده است.');
      const isSystem = systemPath(req.method, req.path);
      if (isSystem && req.user.systemRole !== 'ADMIN') return reject(res, 403, 'FORBIDDEN', 'مجوز مدیریت سیستم لازم است.');
      const headerScope = req.headers['x-workspace-id'];
      const queryScope = req.query.workspaceId;
      const bodyScope = req.body?.workspaceId;
      if ([headerScope, queryScope, bodyScope].some(value => value !== undefined && (typeof value !== 'string' || !value || value.length > 200))) return reject(res, 422, 'VALIDATION_FAILED', 'شناسهٔ فضای کاری نامعتبر است.');
      const specified = [headerScope, queryScope, bodyScope].filter(Boolean);
      if (new Set(specified).size > 1) return reject(res, 422, 'WORKSPACE_CONFLICT', 'فضای کاری درخواست با منبع داده مطابقت ندارد.');
      const granted = accessibleWorkspaces(scoped.raw, req.user);
      const workspaceId = specified[0] || (granted.includes(req.user.personalWorkspaceId) ? req.user.personalWorkspaceId : granted[0]);
      if (!isSystem && (!workspaceId || !granted.includes(workspaceId))) return reject(res, 403, 'WORKSPACE_FORBIDDEN', 'به این فضای کاری دسترسی ندارید.');
      const scope: Scope = { kind: isSystem ? 'system' : 'workspace', user: req.user, workspaceId: workspaceId || '', path: req.path, method: req.method };
      const grant = membership(scoped.raw, req.user, workspaceId);
      req.workspaceId = scope.workspaceId; req.workspaceMembership = grant;
      if (req.path.startsWith('/api/sites/') && req.path.endsWith('/key') && !manager(grant)) return reject(res, 403, 'FORBIDDEN', 'مجوز مدیریت فضای کاری لازم است.');
      const personalReadState = (req.method === 'PUT' && (/^\/api\/notifications\/(?:read-all|[^/]+\/read)$/.test(req.path) || /^\/api\/chat\/conversations\/[^/]+\/preferences$/.test(req.path))) || (req.method === 'POST' && (req.path === '/api/notifications/clear' || /^\/api\/chat\/conversations\/[^/]+\/read$/.test(req.path)));
      if (!isSystem && !['GET','HEAD'].includes(req.method) && !personalReadState) {
        const orgWriterOperation = /^\/api\/org\/module-instances\/[^/]+(?:\/records(?:\/[^/]+)?)?$/.test(req.path) && (req.method === 'PUT' || req.path.includes('/records')) || (req.method === 'POST' && (/^\/api\/org\/(?:reports(?:\/executive-summary)?|departments\/[^/]+\/reports)$/.test(req.path)));
        const feedbackCreation = req.method === 'POST' && /^\/api\/projects\/[^/]+\/feedbacks\/?$/.test(req.path);
        const manageOperation = (req.path.startsWith('/api/org/') && !orgWriterOperation) || (req.path.startsWith('/api/projects') && !feedbackCreation) || req.path.startsWith('/api/teams') || req.path.startsWith('/api/organizations')
          || req.path.startsWith('/api/sites/') || req.path.startsWith('/api/external-connections') || /\/portal(?:-token)?$/.test(req.path);
        if ((manageOperation && !manager(grant)) || (!manageOperation && !writer(grant))) return reject(res, 403, 'FORBIDDEN', 'مجوز انجام این عملیات را ندارید.');
      }
      const body = req.body || {};
      if (!['GET','HEAD'].includes(req.method)) {
        if (!body || typeof body !== 'object' || Array.isArray(body) || !safeJson(body)) return reject(res, 422, 'VALIDATION_FAILED', 'بدنهٔ درخواست نامعتبر است.');
        const isDomain = scopedContracts.some(item=>item.method===req.method&&item.path===definition.path);
        const fields: readonly string[] = isDomain ? definition.fields : overrides[req.method + ' ' + definition.path] || [...definition.fields];
        if (Object.keys(body).some(key => !fields.includes(key as any))) return reject(res, 422, 'PROTECTED_OR_UNKNOWN_FIELD', 'درخواست دارای فیلد تغییرناپذیر یا ناشناخته است.');
        if (Object.entries(body).some(([key, value]) => !(req.path.startsWith('/api/chat/') && key==='content' && typeof value==='string' && value.length<=20_000) && !validField(key, value))) return reject(res, 422, 'VALIDATION_FAILED', 'نوع یا اندازهٔ فیلد درخواست نامعتبر است.');
      }
      if (!isSystem) {
        const matched = definition.pattern.exec(req.path)!;
        const pieces = definition.path.split('/'); let index = 1;
        for (let i = 0; i < pieces.length; i++) if (pieces[i].startsWith(':')) {
          let id: string;
          try { id = decodeURIComponent(matched[index++]); } catch { return reject(res, 422, 'VALIDATION_FAILED', 'شناسه نامعتبر است.'); }
          const parameter = pieces[i].slice(1);
          const collection = parameter === 'projectId' ? 'projects' : parameter === 'taskId' ? 'tasks' : parameter === 'teamId' ? 'teams' : resources[pieces[i-1]];
          if (collection && !validateResource(collection, id, scope)) return reject(res, 404, 'RESOURCE_NOT_FOUND', 'این منبع در فضای کاری در دسترس نیست.');
          if (collection && !['GET','HEAD'].includes(req.method) && !personalReadState) {
            const record = validateResource(collection, id, scope);
            const departmentIds = record ? scoped.departmentIdsOf(collection, record) : [];
            const action = req.method === 'POST' ? 'create' : req.method === 'DELETE' ? 'delete' : 'update';
            if (departmentIds.some(departmentId => !departmentAction(scoped, req.user, scope.workspaceId, departmentId, action))) return reject(res, 403, 'DEPARTMENT_FORBIDDEN', 'مجوز این عملیات در دپارتمان را ندارید.');
          }
        }
        for (const [field, collection] of Object.entries(references)) {
          if (body[field] && !(field === 'departmentId' && body[field] === 'AGENCY') && !validateResource(collection, body[field], scope)) return reject(res, 404, 'RESOURCE_NOT_FOUND', 'ارجاع درخواست خارج از فضای کاری یا نامعتبر است.');
        }
        if (!['GET','HEAD'].includes(req.method) && !personalReadState) {
          const departmentIds = scoped.departmentIdsOf('input', body);
          if (departmentIds.some(departmentId => !departmentAction(scoped, req.user, scope.workspaceId, departmentId, req.method === 'POST' ? 'create' : req.method === 'DELETE' ? 'delete' : 'update'))) return reject(res, 403, 'DEPARTMENT_FORBIDDEN', 'مجوز این عملیات در دپارتمان را ندارید.');
        }
        if (body.teamLead && (scoped.raw.users.some((user: any) => user.id === body.teamLead) || /^usr_/.test(body.teamLead)) && !validateResource('users', body.teamLead, scope)) return reject(res, 404, 'RESOURCE_NOT_FOUND', 'مسئول خارج از فضای کاری یا نامعتبر است.');
        for (const [field, collection] of Object.entries(arrays)) if (body[field] !== undefined) {
          if (!Array.isArray(body[field]) || body[field].some((id: any) => !validateResource(collection, id, scope))) return reject(res, 422, 'INVALID_REFERENCE', 'عضو، تیم یا وابستگی نامعتبر است.');
        }
        if (body.replyToMessageId) {
          const reply = validateResource('messages', body.replyToMessageId, scope);
          const conversation = /^\/api\/chat\/conversations\/([^/]+)/.exec(req.path)?.[1];
          if (!reply || reply.conversationId !== conversation) return reject(res, 422, 'INVALID_REPLY', 'پیام پاسخ متعلق به همین گفتگو نیست.');
        }
        if (body.messageId && req.path.endsWith('/pin')) {
          const message = validateResource('messages', body.messageId, scope);
          const conversation = /^\/api\/chat\/conversations\/([^/]+)/.exec(req.path)?.[1];
          if (!message || message.conversationId !== conversation) return reject(res, 422, 'INVALID_PIN', 'پیام متعلق به همین گفتگو نیست.');
        }
        if (/^\/api\/comments\/|^\/api\/chat\/messages\//.test(req.path) && !['GET','HEAD'].includes(req.method) && !req.path.endsWith('/react')) {
          const collection = req.path.startsWith('/api/comments/') ? 'comments' : 'messages';
          const id = req.path.split('/').pop(); const record = validateResource(collection, id, scope);
          if (record && (record.userId || record.senderId) !== req.user.id && !manager(grant)) return reject(res, 403, 'FORBIDDEN', 'فقط نویسنده یا مدیر فضای کاری مجاز است.');
        }
      }
      const originalJson = res.json;
      res.json = function (value: any) { return originalJson.call(this, sanitize(value, scope, scoped)); } as any;
      scoped.run(scope, next);
    });
  };
  const authorizeRoles = (..._legacyRoles: string[]) => (req: any, res: Response, next: NextFunction) => {
    const scope = scoped.current();
    if (scope?.kind === 'system') return req.user?.systemRole === 'ADMIN' ? next() : reject(res, 403, 'FORBIDDEN', 'مجوز مدیریت سیستم لازم است.');
    if (manager(req.workspaceMembership)) return next();
    return reject(res, 403, 'FORBIDDEN', 'مجوز مدیریت فضای کاری لازم است.');
  };
  return { middleware, authorizeRoles, validateResource };
}
export function sanitize(value: any, scope: Scope, scoped: ScopedState): any {
  if (Array.isArray(value)) return value.map(item => sanitize(item, scope, scoped));
  if (!value || typeof value !== 'object') return value;
  const ownProfile = value.id === scope.user.id || value.userId === scope.user.id;
  const canManage = manager(membership(scoped.raw, scope.user, scope.workspaceId));
  const conversationCapabilities=scope.path.startsWith('/api/chat/')&&Array.isArray(value.participants)&&value.permissions&&typeof value.permissions==='object'&&!Array.isArray(value.permissions)
    &&Object.keys(value.permissions).every(key=>['send','manage'].includes(key)&&typeof value.permissions[key]==='boolean')
    &&scoped.raw.conversations.some((row:any)=>row.id===value.id&&scoped.visible('conversations',row,scope));
  return Object.fromEntries(Object.entries(value).filter(([key]) => {
    if (['storageKey','blobKey','stagingPath','absolutePath','storagePath'].includes(key)) return false;
    if (!canManage && ((value.isBudgetConfidential || value.isConfidential) && ['budget','amount','currency','cost','revenue','expense'].includes(key) || key === 'budgetSum')) return false;
    if (key === 'apiKey' && canManage && /^\/api\/sites\/[^/]+\/key$/.test(scope.path)) return true;
    if (/password|passwd|secret|tokenIdHash|recovery|verification|credentials|api.?key|authorization|cookie/i.test(key)) return false;
    if (/token/i.test(key)) return (['portalToken','clientPortalToken'].includes(key) || (key === 'token' && scope.path.endsWith('/portal-token'))) && canManage && scope.path.startsWith('/api/projects');
    if (key === 'inviteCode' || key === 'pendingInvites') return canManage && scope.path.startsWith('/api/workspaces');
    if (key==='permissions'&&conversationCapabilities) return true;
    if (['email','phone','memberships','permissions','customPermissions','ipAddress','userAgent'].includes(key) && scope.kind !== 'system' && !ownProfile) return false;
    return true;
  }).map(([key, item]) => [key, sanitize(item, scope, scoped)]));
}
