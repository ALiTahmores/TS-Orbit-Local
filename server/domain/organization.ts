import { Router } from 'express';
import { activeMember, departmentAction, manager, membership, writer } from '../policy/scope.ts';
import { DomainError, identifier, now, recordActivity, Repository, type DomainContext } from './repository.ts';
import { boolean, dateFields, dto, invalid, numeric, priority, strings, text } from './models.ts';

const orgCollections = ['organizations', 'departments', 'departmentMembers', 'departmentPermissions', 'departmentModules', 'departmentReports', 'departmentSettings', 'departmentChats', 'departmentChannels', 'departmentRoles', 'departmentTemplates', 'navigationGroups', 'navigationItems', 'moduleDefinitions', 'moduleInstances', 'modulePermissions', 'teams', 'teamMembers'];
const fields = {
  organization: ['name', 'slug', 'plan', 'billingCycle'],
  department: ['organizationId', 'name', 'icon', 'color', 'description', 'leaderId', 'order'],
  team: ['name', 'departmentId', 'department', 'leaderId', 'memberIds', 'description', 'color', 'avatar', 'customFields'],
  module: ['name', 'icon', 'color', 'description', 'structure', 'isActive'],
  instance: ['name', 'definitionId', 'departmentId', 'organizationId', 'config'],
  checklist: ['projectId', 'name', 'category', 'ownerId', 'assigneeId', 'owner', 'assignedTo', 'dueDate', 'notes', 'priority', 'status', 'progress', 'metrics'],
  content: ['projectId', 'pageName', 'writerId', 'reviewerId', 'writer', 'reviewer', 'deadline', 'status', 'approvalStatus', 'contentBody', 'attachments'],
  qa: ['projectId', 'title', 'description', 'category', 'priority', 'severity', 'assigneeId', 'assignedTo', 'status', 'fixVersion'],
  report: ['title', 'content', 'departmentId', 'scope', 'metrics', 'projectSummary', 'taskSummary', 'bottlenecks', 'keyTakeaways', 'departmentBreakdown', 'clientProjectsMatrix', 'memberBottlenecks', 'custom'],
};

function enumeration(value: any, allowed: string[], label = 'مقدار'): string {
  if (typeof value !== 'string' || !allowed.includes(value)) invalid(`${label} معتبر نیست.`);
  return value;
}
function jsonValue(value: any, depth = 0): any {
  if (depth > 12) invalid('ساختار داده بیش از حد عمیق است.');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') { if (!Number.isFinite(value)) invalid('عدد نامعتبر است.'); return value; }
  if (typeof value === 'string') { if (value.length > 50000) invalid('متن بیش از حد طولانی است.'); return value; }
  if (Array.isArray(value)) { if (value.length > 1000) invalid('فهرست بیش از حد طولانی است.'); return value.map(item => jsonValue(item, depth + 1)); }
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) invalid('داده JSON معتبر لازم است.');
  if (Object.keys(value).length > 200) invalid('تعداد فیلدها بیش از حد است.');
  const result: any = {};
  for (const [key, item] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key) || key.length > 200) invalid('نام فیلد مجاز نیست.');
    result[key] = jsonValue(item, depth + 1);
  }
  return result;
}
function object(value: any): any { if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('شیء معتبر لازم است.'); return jsonValue(value); }
function shape(value: any): any {
  const parsed = object(value);
  if (parsed.fields !== undefined) {
    const names = strings(parsed.fields, 'فیلدهای ماژول', 100);
    if (names.length !== parsed.fields.length || names.some(name => name.length > 200 || ['__proto__', 'constructor', 'prototype'].includes(name))) invalid('فیلدهای ماژول باید یکتا و معتبر باشند.');
    parsed.fields = names;
  }
  return parsed;
}

/** Date-only deadlines last through the local server calendar day; instants retain their exact time. */
export function reportDeadlinePassed(value: unknown, at = new Date()): boolean {
  if (typeof value !== 'string') return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return false;
    const today = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
    return value < today;
  }
  if (!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  const stamp = Date.parse(value);
  return Number.isFinite(stamp) && stamp < at.getTime();
}

export function createOrganizationRouter(context: DomainContext) {
  const { scoped, broadcast } = context;
  const router = Router();
  const repo = (name: string) => new Repository(scoped, name);
  const current = () => { const scope = scoped.current(); if (!scope || scope.kind !== 'workspace') throw new DomainError(403, 'WORKSPACE_REQUIRED', 'فضای کاری معتبر لازم است.'); return scope; };
  const requireManager = () => { const scope = current(); if (!manager(membership(scoped.raw, scope.user, scope.workspaceId))) throw new DomainError(403, 'MANAGER_REQUIRED', 'اجازه مدیریت لازم است.'); };
  const requireWriter = () => { const scope = current(); if (!writer(membership(scoped.raw, scope.user, scope.workspaceId))) throw new DomainError(403, 'WRITE_REQUIRED', 'اجازه نوشتن لازم است.'); };
  const member = (id: any, optional = false): any => {
    if (optional && (id === '' || id === null || id === undefined)) return null;
    const key = text(id, 'شناسه کاربر', true, 300);
    const user = scoped.raw.users.find((row: any) => row.id === key);
    if (!user || !activeMember(user) || !membership(scoped.raw, user, current().workspaceId)) throw new DomainError(422, 'MEMBER_REQUIRED', 'کاربر باید عضو فعال همین فضای کاری باشد.');
    return user;
  };
  const reference = (collection: string, value: any, optional = true): string | null => {
    if (optional && (value === undefined || value === null || value === '')) return null;
    return repo(collection).require(text(value, 'شناسه', true, 300)).id;
  };
  const base = (prefix: string) => ({ id: identifier(prefix), workspaceId: current().workspaceId, creatorId: current().user.id, createdAt: now(), updatedAt: now() });
  const changed = (action: string, row: any, collection?: string) => {
    recordActivity(context, action, row.id);
    broadcast('org_data_updated', { type: action.toLowerCase(), id: row.id });
    if (collection) broadcast(collection + '_updated', repo(collection).all());
  };
  const endpoint = (method: string, path: string, fn: (req: any, res: any) => void, level: 'read' | 'write' | 'manage' = 'manage') => {
    (router as any)[method](path, (req: any, res: any, next: any) => {
      try { current(); if (level === 'manage') requireManager(); else if (level === 'write') requireWriter(); fn(req, res); } catch (error) { next(error); }
    });
  };
  const remove = (collection: string, id: string) => { repo(collection).remove(id); changed(collection + '_DELETED', { id }); };

  // Organization and department trees are workspace-owned. Parent references are
  // validated before mutating anything, so malformed requests are all-or-nothing.
  endpoint('get', '/organizations', (_req, res) => res.json(repo('organizations').all()), 'read');
  const organizationInput = (value: any, create = false) => {
    const input = dto(value, fields.organization); const parsed: any = {};
    if (create || input.name !== undefined) parsed.name = text(input.name, 'نام سازمان', true, 200);
    for (const key of ['slug', 'plan', 'billingCycle']) if (input[key] !== undefined) parsed[key] = text(input[key], key, false, 200);
    return parsed;
  };
  endpoint('post', '/organizations', (req, res) => { const row = repo('organizations').insert({ ...base('org'), ownerId: current().user.id, plan: 'Local', billingCycle: 'None', ...organizationInput(req.body, true) }); changed('ORGANIZATION_CREATED', row); res.status(201).json(row); });
  endpoint('put', '/organizations/:id', (req, res) => { const row = repo('organizations').update(req.params.id, { ...organizationInput(req.body), updatedAt: now() }); changed('ORGANIZATION_UPDATED', row); res.json(row); });

  endpoint('get', '/org/data', (_req, res) => res.json(Object.fromEntries(orgCollections.map(name => [name, repo(name).all()]))), 'read');
  const departmentInput = (value: any, create = false) => {
    const input = dto(value, fields.department); const parsed: any = {};
    if (create || input.name !== undefined) parsed.name = text(input.name, 'نام دپارتمان', true, 200);
    for (const key of ['icon', 'color', 'description']) if (input[key] !== undefined) parsed[key] = text(input[key], key, false, key === 'description' ? 10000 : 200);
    if (input.order !== undefined) parsed.order = numeric(input.order, 'ترتیب', 100000);
    if (input.organizationId !== undefined) parsed.organizationId = reference('organizations', input.organizationId);
    if (input.leaderId !== undefined) parsed.leaderId = member(input.leaderId, true)?.id || '';
    return parsed;
  };
  const departmentLeader = (department: any) => {
    const members = repo('departmentMembers');
    for (const row of members.all().filter(row => row.departmentId === department.id && row.role === 'Leader')) row.role = 'Member';
    if (department.leaderId) {
      let row = members.all().find(row => row.departmentId === department.id && row.userId === department.leaderId);
      if (!row) row = members.insert({ ...base('dep_member'), departmentId: department.id, userId: department.leaderId, role: 'Leader' });
      row.role = 'Leader';
    }
  };
  endpoint('post', '/org/departments', (req, res) => { const parsed = departmentInput(req.body, true); const row = repo('departments').insert({ ...base('dep'), organizationId: null, icon: 'Building2', color: '#3B82F6', description: '', leaderId: '', order: repo('departments').all().length + 1, ...parsed }); departmentLeader(row); changed('DEPARTMENT_CREATED', row); res.status(201).json(row); });
  endpoint('put', '/org/departments/:id', (req, res) => { const row = repo('departments').update(req.params.id, { ...departmentInput(req.body), updatedAt: now() }); departmentLeader(row); changed('DEPARTMENT_UPDATED', row); res.json(row); });
  endpoint('put', '/org/departments/:id/members', (req, res) => {
    const department = repo('departments').require(req.params.id); dto(req.body, ['memberIds']);
    const ids = strings(req.body.memberIds).map(id => member(id).id);
    if (department.leaderId && !ids.includes(department.leaderId)) ids.push(department.leaderId);
    repo('departmentMembers').removeWhere(row => row.departmentId === department.id);
    for (const id of ids) repo('departmentMembers').insert({ ...base('dep_member'), departmentId: department.id, userId: id, role: id === department.leaderId ? 'Leader' : 'Member' });
    changed('DEPARTMENT_MEMBERS_UPDATED', department); res.json(repo('departmentMembers').all().filter(row => row.departmentId === department.id));
  });
  endpoint('put', '/org/permissions', (req, res) => {
    const input = dto(req.body, ['departmentId', 'role', 'action', 'isAllowed']); const departmentId = reference('departments', input.departmentId, false);
    const role = text(input.role, 'نقش', true, 200), action = enumeration(input.action, ['create', 'read', 'update', 'delete', 'assign', 'approve', 'report', 'export', 'chat', 'notifications']);
    const isAllowed = boolean(input.isAllowed);
    let row = repo('departmentPermissions').all().find(row => row.departmentId === departmentId && row.role === role && row.action === action);
    if (row) row.isAllowed = isAllowed; else row = repo('departmentPermissions').insert({ ...base('permission'), departmentId, role, action, isAllowed });
    changed('PERMISSION_UPDATED', row); res.json(row);
  });

  const teamInput = (value: any, create = false) => {
    const input = dto(value, fields.team); const parsed: any = {};
    if (create || input.name !== undefined) parsed.name = text(input.name, 'نام تیم', true, 200);
    const department = input.departmentId ?? input.department;
    if (input.departmentId !== undefined || input.department !== undefined) { parsed.departmentId = reference('departments', department); parsed.department = parsed.departmentId || ''; }
    for (const key of ['description', 'color', 'avatar']) if (input[key] !== undefined) parsed[key] = text(input[key], key, false, key === 'description' ? 10000 : 1000);
    if (input.customFields !== undefined) parsed.customFields = object(input.customFields);
    if (input.leaderId !== undefined) parsed.leaderId = member(input.leaderId, true)?.id || '';
    if (input.memberIds !== undefined) parsed.memberIds = strings(input.memberIds).map(id => member(id).id);
    return parsed;
  };
  // Channel administration operates on the verified team's workspace, including
  // its private leader channel that the requesting manager may not participate in.
  // It never exposes those raw rows in a response.
  const teamChannels = (team: any) => scoped.raw.conversations.filter((row: any) => row.teamId === team.id && scoped.scopeOf('conversations', row) === current().workspaceId);
  const syncTeam = (team: any, ids?: string[]) => {
    const existingIds = repo('teamMembers').all().filter(row => row.teamId === team.id).map(row => row.userId);
    const memberIds = [...new Set([...(ids ?? existingIds), ...(team.leaderId ? [team.leaderId] : [])])];
    for (const id of memberIds) member(id);
    repo('teamMembers').removeWhere(row => row.teamId === team.id);
    for (const id of memberIds) repo('teamMembers').insert({ ...base('team_member'), teamId: team.id, userId: id, isLeader: id === team.leaderId });
    team.memberIds = memberIds; team.membersCount = memberIds.length;
    const managers = scoped.raw.users.filter((user: any) => activeMember(user) && manager(membership(scoped.raw, user, current().workspaceId))).map((user: any) => user.id);
    const allIds = [...new Set([...memberIds, ...managers])];
    let channels = teamChannels(team);
    for (const type of ['private_chat', 'public_channel', 'notification', 'leader_channel']) {
      if (!channels.some((row: any) => row.channelType === type)) {
        const channel = { ...base('conversation'), teamId: team.id, title: `${type === 'leader_channel' ? 'مدیران' : type === 'notification' ? 'اعلانات' : type === 'public_channel' ? 'کانال' : 'گپ تیمی'}: ${team.name}`, channelType: type, isGroup: true, lastMessageAt: null };
        scoped.raw.conversations.push(channel); channels = [...channels, channel];
        if (type === 'private_chat') {
          const timestamp = now();
          scoped.raw.messages.push({ ...base('message'), conversationId: channel.id, senderId: current().user.id,
            senderName: current().user.name || current().user.username || '', kind: 'system', system: true,
            content: `فضای گفت‌وگوی تیم «${team.name}» ایجاد شد.`, timestamp, attachments: [], mentions: [], edited: false });
          channel.lastMessageAt = timestamp;
        }
      }
    }
    for (const channel of channels) {
      const allowed = channel.channelType === 'leader_channel' ? [...new Set([...managers, ...(team.leaderId ? [team.leaderId] : [])])] : allIds;
      const channelMembers = scoped.raw.conversationMembers.filter((row: any) => row.conversationId === channel.id);
      scoped.raw.conversationMembers = scoped.raw.conversationMembers.filter((row: any) => row.conversationId !== channel.id || allowed.includes(row.userId));
      for (const userId of allowed) if (!channelMembers.some((row: any) => row.userId === userId && activeMember(row))) scoped.raw.conversationMembers.push({ ...base('conversation_member'), conversationId: channel.id, userId });
    }
  };
  endpoint('get', '/teams', (_req, res) => res.json(repo('teams').all()), 'read');
  const createTeam = (req: any, res: any) => { const parsed = teamInput(req.body, true); const ids = parsed.memberIds || []; delete parsed.memberIds; const team = repo('teams').insert({ ...base('team'), departmentId: null, leaderId: '', description: '', color: '#3B82F6', avatar: parsed.name[0], customFields: {}, ...parsed }); syncTeam(team, ids); changed('TEAM_CREATED_WITH_CHANNELS', team); broadcast('chat_rooms_updated', { teamId: team.id }); res.status(201).json(team); };
  const updateTeam = (req: any, res: any) => { const parsed = teamInput(req.body); const ids = parsed.memberIds; delete parsed.memberIds; const row = repo('teams').update(req.params.id, { ...parsed, updatedAt: now() }); syncTeam(row, ids); changed('TEAM_UPDATED', row); broadcast('chat_rooms_updated', { teamId: row.id }); res.json(row); };
  endpoint('post', '/teams', createTeam); endpoint('post', '/org/teams', createTeam);
  endpoint('put', '/teams/:id', updateTeam); endpoint('put', '/org/teams/:id', updateTeam);
  endpoint('put', '/org/teams/:id/members', (req, res) => { dto(req.body, ['memberIds', 'leaderId']); const team = repo('teams').require(req.params.id); const ids = strings(req.body.memberIds).map(id => member(id).id); const leaderId = req.body.leaderId === undefined ? team.leaderId : member(req.body.leaderId, true)?.id || ''; team.leaderId = leaderId; syncTeam(team, ids); changed('TEAM_MEMBERS_UPDATED', team); broadcast('chat_rooms_updated', { teamId: team.id }); res.json(team); });

  const moduleInput = (value: any, create = false) => {
    const input = dto(value, fields.module); const parsed: any = {};
    if (create || input.name !== undefined) parsed.name = text(input.name, 'نام ماژول', true, 200);
    for (const key of ['icon', 'color', 'description']) if (input[key] !== undefined) parsed[key] = text(input[key], key, false, key === 'description' ? 10000 : 200);
    if (input.isActive !== undefined) parsed.isActive = boolean(input.isActive);
    if (input.structure !== undefined) parsed.structure = shape(input.structure);
    return parsed;
  };
  endpoint('post', '/org/modules', (req, res) => { const row = repo('moduleDefinitions').insert({ ...base('module'), icon: 'Box', color: '#10B981', description: '', structure: { fields: [] }, isActive: true, ...moduleInput(req.body, true) }); changed('MODULE_DEFINITION_CREATED', row); res.status(201).json(row); });
  const recordData = (definition: any, data: any) => {
    const parsed = object(data); const names = definition.structure?.fields;
    if (Array.isArray(names) && names.length) {
      if (Object.keys(parsed).some(key => !names.includes(key))) invalid('فیلد سطر در تعریف ماژول وجود ندارد.');
      for (const [key, value] of Object.entries(parsed)) parsed[key] = text(value, key, false, 10000);
    }
    return parsed;
  };
  const recordsConfig = (definition: any, value: any, previous: any[] = []) => {
    const parsed = object(value);
    if (parsed.records !== undefined) {
      if (!Array.isArray(parsed.records) || parsed.records.length > 1000) invalid('فهرست سطرها معتبر نیست.');
      const seen = new Set<string>();
      parsed.records = parsed.records.map((item: any) => {
        dto(item, ['id', 'createdAt', 'updatedAt', 'creatorId', 'updatedById', 'data']);
        const old = previous.find(row => row.id === item.id);
        const id = old?.id || identifier('record');
        if (seen.has(id)) invalid('شناسه تکراری سطر مجاز نیست.'); seen.add(id);
        return { ...(old || { id, createdAt: now(), creatorId: current().user.id }), data: recordData(definition, item.data), updatedAt: now(), updatedById: current().user.id };
      });
    }
    return parsed;
  };
  endpoint('put', '/org/modules/:id', (req, res) => {
    const row = repo('moduleDefinitions').require(req.params.id); const parsed = moduleInput(req.body);
    if (parsed.structure !== undefined) for (const instance of repo('moduleInstances').all().filter(item => item.definitionId === row.id)) for (const record of instance.config?.records || []) recordData({ ...row, ...parsed }, record.data);
    Object.assign(row, parsed, { updatedAt: now() }); changed('MODULE_DEFINITION_UPDATED', row); res.json(row);
  });
  endpoint('post', '/org/module-instances', (req, res) => {
    const input = dto(req.body, fields.instance); const definition = repo('moduleDefinitions').require(reference('moduleDefinitions', input.definitionId, false)!);
    if (definition.isActive === false) throw new DomainError(409, 'MODULE_INACTIVE', 'تعریف ماژول غیرفعال است.');
    const department = repo('departments').require(reference('departments', input.departmentId, false)!);
    const organizationId = input.organizationId === undefined ? department.organizationId || null : reference('organizations', input.organizationId);
    if (organizationId !== (department.organizationId || null)) invalid('سازمان ماژول و دپارتمان باید یکسان باشد.');
    const config = recordsConfig(definition, input.config ?? {});
    const row = repo('moduleInstances').insert({ ...base('module_instance'), definitionId: definition.id, moduleDefinitionId: definition.id, departmentId: department.id, organizationId, name: input.name ? text(input.name, 'نام', true, 200) : definition.name, config });
    repo('departmentModules').insert({ ...base('department_module'), departmentId: department.id, moduleId: row.id, moduleInstanceId: row.id }); changed('MODULE_INSTANCE_CREATED', row); res.status(201).json(row);
  });
  endpoint('put', '/org/module-instances/:id', (req, res) => {
    const input = dto(req.body, ['name', 'config']); const row = repo('moduleInstances').require(req.params.id); const definition = repo('moduleDefinitions').require(row.definitionId);
    const parsed: any = {};
    if (input.name !== undefined) parsed.name = text(input.name, 'نام', true, 200);
    if (input.config !== undefined) {
      const config = object(input.config);
      if (config.records !== undefined) throw new DomainError(409, 'USE_RECORD_ENDPOINT', 'برای تغییر سطرها از مسیر اختصاصی سطر استفاده کنید.');
      parsed.config = { ...config, records: row.config?.records || [] };
    }
    Object.assign(row, parsed, { updatedAt: now() }); changed('MODULE_INSTANCE_UPDATED', row); res.json(row);
  }, 'write');
  const mutateRecord = (req: any, res: any, operation: string) => {
    const instance = repo('moduleInstances').require(req.params.id); const definition = repo('moduleDefinitions').require(instance.definitionId);
    if (definition.isActive === false) throw new DomainError(409, 'MODULE_INACTIVE', 'تعریف ماژول غیرفعال است.');
    if (operation !== 'delete') dto(req.body, ['data']);
    const data = operation === 'delete' ? null : recordData(definition, req.body.data);
    const records = instance.config?.records || []; let record: any;
    if (operation === 'create') { if (records.length >= 1000) invalid('ظرفیت سطرهای ماژول تکمیل است.'); record = { id: identifier('record'), data, creatorId: current().user.id, createdAt: now(), updatedAt: now() }; records.push(record); }
    else { const index = records.findIndex((row: any) => row.id === req.params.recordId); if (index < 0) throw new DomainError(404, 'RECORD_NOT_FOUND', 'سطر یافت نشد.'); record = records[index]; if (operation === 'delete') records.splice(index, 1); else Object.assign(record, { data, updatedById: current().user.id, updatedAt: now() }); }
    instance.config = { ...(instance.config || {}), records }; instance.updatedAt = now(); changed('MODULE_RECORD_' + operation.toUpperCase(), instance); res.status(operation === 'create' ? 201 : 200).json({ record, instance });
  };
  endpoint('post', '/org/module-instances/:id/records', (req, res) => mutateRecord(req, res, 'create'), 'write');
  endpoint('put', '/org/module-instances/:id/records/:recordId', (req, res) => mutateRecord(req, res, 'update'), 'write');
  endpoint('delete', '/org/module-instances/:id/records/:recordId', (req, res) => mutateRecord(req, res, 'delete'), 'write');

  // Deletion checks raw references first. Unscoped or contradictory legacy rows
  // are never guessed into this workspace or silently changed by a cascade.
  const hasReference = (row: any, id: string) => ['organizationId', 'departmentId', 'department', 'assignedToDept', 'teamId', 'targetTeamId', 'definitionId', 'moduleDefinitionId', 'moduleId', 'moduleInstanceId', 'groupId', 'navigationGroupId', 'conversationId', 'messageId', 'fileId', 'currentVersionId', 'replyToMessageId', 'lastReadMessageId'].some(key => row[key] === id) || row.voiceNote?.fileId === id || ['assignedTeamIds', 'assignedToTeams'].some(key => Array.isArray(row[key]) && row[key].includes(id)) || Array.isArray(row.attachments) && row.attachments.some((file: any) => (typeof file === 'string' ? file : file?.id || file?.fileId) === id || file?.versionId === id);
  const protectReferences = (ids: Set<string>) => {
    for (const [collection, rows] of Object.entries(scoped.raw)) if (Array.isArray(rows)) for (const row of rows) {
      if ([...ids].some(id => hasReference(row, id)) && scoped.scopeOf(collection, row) !== current().workspaceId) throw new DomainError(409, 'AMBIGUOUS_DEPENDENCY', 'وابستگی قدیمی یا متعلق به فضای دیگری مانع حذف است.');
    }
  };
  const removeRaw = (collection: string, predicate: (row: any) => boolean) => { scoped.raw[collection] = scoped.raw[collection].filter((row: any) => !(scoped.scopeOf(collection, row) === current().workspaceId && predicate(row))); };
  // History is retained independently of a resource's lifetime. Capture the
  // currently authorized audience before removing its parents, then detach
  // only hard references owned by this cascade. A deleted private room must
  // never turn its history into a workspace-wide activity entry.
  const historyParents: Record<string, string> = { organizationId: 'organizations', departmentId: 'departments', teamId: 'teams', targetTeamId: 'teams', conversationId: 'conversations', messageId: 'messages', fileId: 'files', currentVersionId: 'fileVersions', moduleInstanceId: 'moduleInstances', moduleId: 'moduleInstances' };
  const detachHistory = (removed: Map<string, Set<string>>) => {
    const isRemoved = (collection: string, id: any) => typeof id === 'string' && removed.get(collection)?.has(id);
    for (const collection of ['notifications', 'auditLogs']) for (const row of scoped.raw[collection]) {
      const targets = typeof row.targetId === 'string' ? Object.entries(scoped.raw).flatMap(([name, records]) => Array.isArray(records) && (!row.targetCollection || row.targetCollection === name) ? records.filter((target: any) => target.id === row.targetId && isRemoved(name, target.id)).map((target: any) => ({ collection: name, row: target })) : []) : [];
      if (!targets.length && !Object.entries(historyParents).some(([field, parent]) => isRemoved(parent, row[field])) && !isRemoved('conversations', row.accessSnapshot?.conversationId) && !(row.accessSnapshot?.departmentIds || []).some((id: string) => isRemoved('departments', id))) continue;
      if (scoped.scopeOf(collection, row) !== current().workspaceId) throw new DomainError(409, 'AMBIGUOUS_DEPENDENCY', 'تاریخچهٔ خارج از دامنه مانع حذف است.');
      const departmentIds = [...new Set<string>([...scoped.departmentIdsOf(collection, row), ...(row.accessSnapshot?.departmentIds || []), ...targets.flatMap(target => scoped.departmentIdsOf(target.collection, target.row))])];
      const conversationIds = new Set<string>([row.conversationId, row.accessSnapshot?.conversationId].filter(Boolean));
      const resources = [...Object.entries(historyParents).flatMap(([field, parent]) => scoped.raw[parent]?.filter((item: any) => item.id === row[field]).map((item: any) => ({ collection: parent, row: item })) || []), ...targets];
      for (const resource of resources) {
        const id = resource.collection === 'conversations' ? resource.row.id : resource.row.conversationId;
        if (id) conversationIds.add(id);
      }
      const participantIds = scoped.raw.users.filter((user: any) => {
        if (!activeMember(user) || !membership(scoped.raw, user, current().workspaceId) || departmentIds.some(id => !departmentAction(scoped, user, current().workspaceId, id, 'read'))) return false;
        if (row.accessSnapshot?.participantIds && !row.accessSnapshot.participantIds.includes(user.id)) return false;
        if ([...conversationIds].some(id => !scoped.participant(user.id, id, current().workspaceId))) return false;
        const candidate = { ...current(), user, method: 'GET' };
        return resources.every(resource => resource.row.deletedAt || scoped.visible(resource.collection, resource.row, candidate));
      }).map((user: any) => user.id);
      const liveConversation = [...conversationIds].find(id => !isRemoved('conversations', id));
      row.accessSnapshot = { departmentIds: departmentIds.filter(id => !isRemoved('departments', id)), participantIds, ...(liveConversation ? { conversationId: liveConversation } : {}) };
      for (const [field, parent] of Object.entries(historyParents)) if (isRemoved(parent, row[field])) delete row[field];
    }
  };
  const detach = (ids: Set<string>, keys: string[], arrays: string[] = []) => {
    for (const collection of ['projects', 'tasks']) for (const row of repo(collection).all()) {
      for (const key of keys) if (ids.has(row[key])) row[key] = null;
      for (const key of arrays) if (Array.isArray(row[key])) row[key] = row[key].filter((id: string) => !ids.has(id));
    }
  };
  const deleteInstances = (ids: Set<string>) => {
    for (const collection of ['departmentModules', 'modulePermissions', 'navigationItems']) removeRaw(collection, row => ids.has(row.moduleId) || ids.has(row.moduleInstanceId) || ids.has(row.instanceId));
    removeRaw('moduleInstances', row => ids.has(row.id));
  };
  const deleteTeam = (id: string) => {
    const team = repo('teams').require(id); const channels = teamChannels(team); const conversationIds = new Set<string>(channels.map((row: any) => row.id));
    const messageIds = new Set<string>(scoped.raw.messages.filter((row: any) => conversationIds.has(row.conversationId) && scoped.scopeOf('messages', row) === current().workspaceId).map((row: any) => row.id));
    const files = scoped.raw.files.filter((row: any) => conversationIds.has(row.conversationId));
    if (files.some((row: any) => row.projectId || row.taskId || scoped.scopeOf('files', row) !== current().workspaceId)) throw new DomainError(409, 'ASSET_USED_OUTSIDE_CHAT', 'فایل مشترک یا خارج از دامنه مانع حذف تیم است.');
    const fileIds = new Set<string>(files.map((row: any) => row.id));
    const versions = scoped.raw.fileVersions.filter((row: any) => fileIds.has(row.fileId));
    if (versions.some((row: any) => row.projectId || row.taskId || row.conversationId && !conversationIds.has(row.conversationId) || scoped.scopeOf('fileVersions', row) !== current().workspaceId)) throw new DomainError(409, 'ASSET_USED_OUTSIDE_CHAT', 'نسخهٔ فایل مشترک یا خارج از دامنه مانع حذف تیم است.');
    const versionIds = new Set<string>(versions.map((row: any) => row.id));
    protectReferences(new Set([id, ...conversationIds, ...messageIds, ...fileIds, ...versionIds]));
    for (const row of scoped.raw.messages) if (!messageIds.has(row.id) && (messageIds.has(row.replyToMessageId) || row.voiceNote?.fileId && fileIds.has(row.voiceNote.fileId) || Array.isArray(row.attachments) && row.attachments.some((file: any) => fileIds.has(typeof file === 'string' ? file : file?.id || file?.fileId) || versionIds.has(file?.versionId)))) throw new DomainError(409, 'CHAT_USED_OUTSIDE_TEAM', 'ارجاع پیام یا پیوست در گفتگوی دیگری مانع حذف است.');
    for (const row of scoped.raw.readReceipts) if (!conversationIds.has(row.conversationId) && messageIds.has(row.lastReadMessageId)) throw new DomainError(409, 'CHAT_USED_OUTSIDE_TEAM', 'رسید پیام در گفتگوی دیگری مانع حذف است.');
    const requestIds = new Set<string>(scoped.raw.conversationRequests.filter((row: any) => row.targetTeamId === id && scoped.scopeOf('conversationRequests', row) === current().workspaceId).map((row: any) => row.id));
    detachHistory(new Map([['teams', new Set([id])], ['conversations', conversationIds], ['messages', messageIds], ['files', fileIds], ['fileVersions', versionIds], ['conversationRequests', requestIds]]));
    detach(new Set([id]), ['teamId'], ['assignedTeamIds', 'assignedToTeams']);
    removeRaw('fileVersions', row => versionIds.has(row.id));
    removeRaw('files', row => fileIds.has(row.id));
    for (const collection of ['pinnedMessages', 'messageReactions', 'readReceipts']) removeRaw(collection, row => conversationIds.has(row.conversationId) || messageIds.has(row.messageId));
    for (const collection of ['messages', 'conversationMembers', 'departmentChats', 'departmentChannels']) removeRaw(collection, row => conversationIds.has(row.conversationId) || conversationIds.has(row.channelId));
    removeRaw('conversations', row => conversationIds.has(row.id));
    for (const collection of ['teamMembers', 'conversationPermissions', 'conversationRequests']) removeRaw(collection, row => row.teamId === id || row.targetTeamId === id);
    removeRaw('departmentPermissions', row => row.role === id); repo('teams').remove(id); changed('TEAM_DELETED', team); broadcast('chat_rooms_updated', { teamId: id });
  };
  endpoint('delete', '/teams/:id', (req, res) => { deleteTeam(req.params.id); res.json({ success: true, deletedId: req.params.id }); });
  endpoint('delete', '/org/teams/:id', (req, res) => { deleteTeam(req.params.id); res.json({ success: true, deletedId: req.params.id }); });
  const deleteDepartment = (id: string) => {
    const department = repo('departments').require(id); const teams = repo('teams').all().filter(row => row.departmentId === id || row.department === id); const instances = repo('moduleInstances').all().filter(row => row.departmentId === id || repo('departmentModules').all().some(link => link.departmentId === id && (link.moduleId === row.id || link.moduleInstanceId === row.id)));
    protectReferences(new Set([id, ...teams.map(row => row.id), ...instances.map(row => row.id)]));
    for (const team of teams) deleteTeam(team.id);
    detachHistory(new Map([['departments', new Set([id])]]));
    deleteInstances(new Set(instances.map(row => row.id)));
    detach(new Set([id]), ['departmentId', 'department', 'assignedToDept']);
    for (const collection of ['departmentMembers', 'departmentPermissions', 'departmentModules', 'departmentReports', 'departmentSettings', 'departmentChats', 'departmentChannels', 'departmentRoles']) removeRaw(collection, row => row.departmentId === id);
    repo('departments').remove(id); changed('DEPARTMENT_DELETED', department);
  };
  endpoint('delete', '/org/departments/:id', (req, res) => { deleteDepartment(req.params.id); res.json({ success: true, deletedId: req.params.id }); });
  endpoint('delete', '/organizations/:id', (req, res) => {
    const organization = repo('organizations').require(req.params.id); const departments = repo('departments').all().filter(row => row.organizationId === organization.id);
    protectReferences(new Set([organization.id, ...departments.map(row => row.id)]));
    detachHistory(new Map([['organizations', new Set([organization.id])]]));
    for (const department of departments) deleteDepartment(department.id);
    deleteInstances(new Set(repo('moduleInstances').all().filter(row => row.organizationId === organization.id).map(row => row.id)));
    detach(new Set([organization.id]), ['organizationId']); repo('organizations').remove(organization.id); changed('ORGANIZATION_DELETED', organization); res.json({ success: true, deletedId: organization.id });
  });
  endpoint('delete', '/org/module-instances/:id', (req, res) => { repo('moduleInstances').require(req.params.id); protectReferences(new Set([req.params.id])); deleteInstances(new Set([req.params.id])); changed('MODULE_INSTANCE_DELETED', { id: req.params.id }); res.json({ success: true, deletedId: req.params.id }); });
  endpoint('delete', '/org/modules/:id', (req, res) => {
    const row = repo('moduleDefinitions').require(req.params.id); const instances = repo('moduleInstances').all().filter(item => item.definitionId === row.id || item.moduleDefinitionId === row.id); const ids = new Set<string>([row.id, ...instances.map(item => item.id)]); protectReferences(ids); deleteInstances(new Set(instances.map(item => item.id))); repo('moduleDefinitions').remove(row.id); changed('MODULE_DEFINITION_DELETED', row); res.json({ success: true, deletedId: row.id });
  });

  // Checklist progress and lifecycle are server-derived rather than arbitrary
  // independent fields that could show completed work at zero percent.
  const checklistCategories: Record<string, string[]> = { wordpressChecklist: ['hosting', 'domain', 'dns', 'cloudflare', 'wp_install', 'security', 'performance', 'development', 'testing'], seoChecklist: ['technical', 'on_page', 'schema', 'internal_links', 'search_console', 'analytics', 'keywords', 'audit'] };
  const checklistInput = (collection: string, input: any, old?: any) => {
    dto(input, fields.checklist); const parsed: any = {};
    if (!old || input.name !== undefined) parsed.name = text(input.name, 'نام مورد', true, 500);
    if (input.projectId !== undefined) parsed.projectId = reference('projects', input.projectId);
    if (input.category !== undefined) parsed.category = enumeration(input.category, checklistCategories[collection], 'دسته');
    for (const key of ['owner', 'assignedTo', 'notes']) if (input[key] !== undefined) parsed[key] = text(input[key], key, false, key === 'notes' ? 10000 : 300);
    for (const [key, label] of [['ownerId', 'owner'], ['assigneeId', 'assignedTo']]) if (input[key] !== undefined) { const user = member(input[key], true); parsed[key] = user?.id || null; if (user) parsed[label] = user.name || user.username; else parsed[label] = ''; }
    if (input.dueDate !== undefined) Object.assign(parsed, dateFields(input.dueDate, 'dueDate'));
    if (input.priority !== undefined) parsed.priority = priority(input.priority);
    if (input.metrics !== undefined) { const metric = dto(input.metrics, ['label', 'value', 'trend']); parsed.metrics = { label: text(metric.label, 'عنوان', true, 300), value: text(metric.value, 'مقدار', true, 300), trend: enumeration(metric.trend, ['up', 'down', 'neutral']) }; }
    if (input.status !== undefined) parsed.status = enumeration(input.status, collection === 'wordpressChecklist' ? ['pending', 'inprogress', 'completed', 'blocked'] : ['pending', 'inprogress', 'completed']);
    if (input.progress !== undefined) parsed.progress = numeric(input.progress, 'پیشرفت', 100);
    const status = parsed.status ?? old?.status ?? 'pending';
    if (status === 'completed') parsed.progress = 100;
    else if (status === 'pending') { if (input.status === undefined && parsed.progress > 0) parsed.status = parsed.progress === 100 ? 'completed' : 'inprogress'; else parsed.progress = 0; }
    else if (parsed.progress === 100) parsed.status = 'completed';
    else if (parsed.status && old?.status === 'completed' && parsed.progress === undefined) parsed.progress = 0;
    return parsed;
  };
  for (const [path, collection] of [['wordpress-checklist', 'wordpressChecklist'], ['seo-checklist', 'seoChecklist']]) {
    endpoint('get', '/' + path, (_req, res) => res.json(repo(collection).all()), 'read');
    endpoint('post', '/' + path, (req, res) => { const parsed = checklistInput(collection, req.body); const row = repo(collection).insert({ ...base('check'), projectId: null, category: checklistCategories[collection][0], priority: 'medium', owner: '', assignedTo: '', dueDate: '', notes: '', progress: 0, status: 'pending', ...parsed }); changed('CHECKLIST_CREATED', row, collection); res.status(201).json(row); }, 'write');
    endpoint('put', '/' + path + '/:id', (req, res) => { const row = repo(collection).require(req.params.id); const parsed = checklistInput(collection, req.body, row); Object.assign(row, parsed, { updatedAt: now() }); changed('CHECKLIST_UPDATED', row, collection); res.json(row); }, 'write');
    endpoint('delete', '/' + path + '/:id', (req, res) => { remove(collection, req.params.id); res.json({ success: true, deletedId: req.params.id }); }, 'write');
  }

  const history = (row: any, kind: string, before: string, after: string) => { row.history = [...(row.history || []), { id: identifier('history'), kind, before, after, actorId: current().user.id, timestamp: now() }]; };
  const contentInput = (input: any, old?: any) => {
    dto(input, fields.content); const parsed: any = {};
    if (!old || input.pageName !== undefined) parsed.pageName = text(input.pageName, 'نام صفحه', true, 500);
    if (input.projectId !== undefined) parsed.projectId = reference('projects', input.projectId);
    for (const key of ['writer', 'reviewer', 'contentBody']) if (input[key] !== undefined) parsed[key] = text(input[key], key, false, key === 'contentBody' ? 100000 : 300);
    for (const [key, label] of [['writerId', 'writer'], ['reviewerId', 'reviewer']]) if (input[key] !== undefined) { const user = member(input[key], true); parsed[key] = user?.id || null; parsed[label] = user?.name || user?.username || ''; }
    if (input.deadline !== undefined) Object.assign(parsed, dateFields(input.deadline, 'deadline'));
    if (input.attachments !== undefined) { parsed.attachments = strings(input.attachments, 'پیوست‌ها', 100); for (const id of parsed.attachments) reference('files', id, false); }
    if (input.status !== undefined) parsed.status = enumeration(input.status, ['received', 'writing', 'review', 'approved', 'published']);
    if (input.approvalStatus !== undefined) parsed.approvalStatus = enumeration(input.approvalStatus, ['none', 'pending', 'approved', 'rejected']);
    const status = parsed.status ?? old?.status ?? 'received';
    if (!old && (parsed.reviewerId || ['approved', 'published'].includes(status) || ['approved', 'rejected'].includes(parsed.approvalStatus))) requireManager();
    const approving = ['approved', 'published'].includes(parsed.status) || parsed.approvalStatus === 'approved' || parsed.approvalStatus === 'rejected';
    if (approving && !manager(membership(scoped.raw, current().user, current().workspaceId)) && (parsed.reviewerId ?? old?.reviewerId) !== current().user.id) throw new DomainError(403, 'REVIEWER_REQUIRED', 'تأیید محتوا به بازبین یا مدیر نیاز دارد.');
    // A writer cannot appoint themself reviewer and approve in the same update.
    if (old && parsed.reviewerId !== undefined && parsed.reviewerId !== old.reviewerId) requireManager();
    if (status === 'published' && (old?.approvalStatus !== 'approved' && parsed.approvalStatus !== 'approved')) throw new DomainError(409, 'CONTENT_NOT_APPROVED', 'انتشار به تأیید محتوا نیاز دارد.');
    if (status === 'approved') parsed.approvalStatus = 'approved';
    else if (status === 'review') parsed.approvalStatus = 'pending';
    if (parsed.approvalStatus === 'rejected') parsed.status = 'writing';
    if (old && input.contentBody !== undefined && input.contentBody !== old.contentBody && ['approved', 'published'].includes(old.status)) { parsed.status = 'writing'; parsed.approvalStatus = 'pending'; }
    return parsed;
  };
  endpoint('get', '/content-center', (_req, res) => res.json(repo('contentCenter').all()), 'read');
  endpoint('post', '/content-center', (req, res) => { const parsed = contentInput(req.body); if (parsed.reviewerId && parsed.reviewerId !== current().user.id) requireManager(); const row = repo('contentCenter').insert({ ...base('content'), projectId: null, status: 'received', writerId: current().user.id, writer: current().user.name || '', reviewer: '', reviewerId: null, approvalStatus: 'none', deadline: '', attachments: [], contentBody: '', history: [], ...parsed }); history(row, 'created', '', row.status); changed('CONTENT_CREATED', row, 'contentCenter'); res.status(201).json(row); }, 'write');
  endpoint('put', '/content-center/:id', (req, res) => {
    const row = repo('contentCenter').require(req.params.id); const parsed = contentInput(req.body, row); const before = row.status; const previousApproval = row.approvalStatus; Object.assign(row, parsed, { updatedAt: now() }); if (row.status !== before) history(row, 'status', before, row.status); if (row.approvalStatus !== previousApproval) { history(row, 'approval', previousApproval, row.approvalStatus); if (row.approvalStatus === 'approved') { row.approvedById = current().user.id; row.approvedAt = now(); } else { row.approvedById = null; row.approvedAt = null; } } changed('CONTENT_UPDATED', row, 'contentCenter'); res.json(row);
  }, 'write');
  endpoint('delete', '/content-center/:id', (req, res) => { remove('contentCenter', req.params.id); res.json({ success: true, deletedId: req.params.id }); }, 'write');

  const qaInput = (input: any, old?: any) => {
    dto(input, fields.qa); const parsed: any = {};
    if (!old || input.title !== undefined) parsed.title = text(input.title, 'عنوان باگ', true, 500);
    if (input.projectId !== undefined) parsed.projectId = reference('projects', input.projectId);
    for (const key of ['description', 'assignedTo', 'fixVersion']) if (input[key] !== undefined) parsed[key] = text(input[key], key, false, key === 'description' ? 20000 : 300);
    if (input.assigneeId !== undefined) { const user = member(input.assigneeId, true); parsed.assigneeId = user?.id || null; parsed.assignedTo = user?.name || ''; }
    if (input.category !== undefined) parsed.category = enumeration(input.category, ['responsive', 'forms', 'checkout', 'performance', 'browser', 'security', 'accessibility']);
    if (input.priority !== undefined) parsed.priority = priority(input.priority);
    if (input.severity !== undefined) parsed.severity = enumeration(input.severity, ['minor', 'major', 'critical', 'blocker']);
    if (input.status !== undefined) parsed.status = enumeration(input.status, ['pending', 'inprogress', 'fixed', 'verified', 'reopened']);
    if (parsed.status === 'verified' && old?.status !== 'fixed' && old?.status !== 'verified') throw new DomainError(409, 'BUG_NOT_FIXED', 'تأیید باگ پس از رفع آن ممکن است.');
    if (parsed.status === 'reopened' && !['fixed', 'verified'].includes(old?.status)) throw new DomainError(409, 'BUG_NOT_CLOSED', 'بازگشایی برای باگ رفع‌شده است.');
    return parsed;
  };
  endpoint('get', '/qa-bugs', (_req, res) => res.json(repo('qaBugs').all()), 'read');
  endpoint('post', '/qa-bugs', (req, res) => { const parsed = qaInput(req.body); const row = repo('qaBugs').insert({ ...base('bug'), projectId: null, description: '', category: 'responsive', priority: 'medium', severity: 'major', assignedTo: '', assigneeId: null, status: 'pending', fixVersion: '', dateLogged: now(), history: [], ...parsed }); history(row, 'created', '', row.status); changed('QA_BUG_CREATED', row, 'qaBugs'); res.status(201).json(row); }, 'write');
  endpoint('put', '/qa-bugs/:id', (req, res) => { const row = repo('qaBugs').require(req.params.id); const parsed = qaInput(req.body, row); const before = row.status; Object.assign(row, parsed, { updatedAt: now() }); if (row.status !== before) { history(row, 'status', before, row.status); if (row.status === 'fixed') { row.fixedAt = now(); row.fixedById = current().user.id; } if (row.status === 'verified') { row.verifiedAt = now(); row.verifiedById = current().user.id; } if (row.status === 'reopened') { row.reopenedAt = now(); row.reopenCount = (row.reopenCount || 0) + 1; row.verifiedAt = null; row.verifiedById = null; } } changed('QA_BUG_UPDATED', row, 'qaBugs'); res.json(row); }, 'write');
  endpoint('delete', '/qa-bugs/:id', (req, res) => { remove('qaBugs', req.params.id); res.json({ success: true, deletedId: req.params.id }); }, 'write');

  const reportInput = (value: any) => {
    const input = dto(value, fields.report); const parsed: any = { title: text(input.title, 'عنوان گزارش', true, 500), content: input.content === undefined ? '' : text(input.content, 'گزارش', false, 100000) };
    parsed.departmentId = input.departmentId === undefined || input.departmentId === 'AGENCY' ? 'AGENCY' : reference('departments', input.departmentId, false);
    parsed.scope = parsed.departmentId === 'AGENCY' ? 'agency' : 'department';
    if (input.scope !== undefined && input.scope !== parsed.scope) invalid('دامنه گزارش با دپارتمان همخوانی ندارد.');
    for (const key of ['metrics', 'projectSummary', 'taskSummary', 'custom']) if (input[key] !== undefined) parsed[key] = object(input[key]);
    for (const key of ['bottlenecks', 'keyTakeaways']) if (input[key] !== undefined) parsed[key] = strings(input[key], key, 200);
    for (const key of ['departmentBreakdown', 'clientProjectsMatrix', 'memberBottlenecks']) if (input[key] !== undefined) { if (!Array.isArray(input[key])) invalid('فهرست معتبر لازم است.'); parsed[key] = jsonValue(input[key]); }
    return parsed;
  };
  const saveReport = (parsed: any) => { const row = repo('departmentReports').insert({ ...base('report'), generatedAt: now(), createdBy: current().user.name || current().user.username, reportDepartmentIds: parsed.departmentId === 'AGENCY' ? repo('departments').all().map(row=>row.id) : [parsed.departmentId], ...parsed }); changed('REPORT_CREATED', row); return row; };
  const generateReport = (departmentId: string) => {
    const department = departmentId === 'AGENCY' ? null : repo('departments').require(departmentId);
    const tasks = repo('tasks').all().filter(row => !department || scoped.departmentIdsOf('tasks', row).includes(department.id));
    const completed = tasks.filter(row => String(row.status).toLowerCase() === 'completed').length;
    const cancelled = tasks.filter(row => ['cancelled', 'canceled'].includes(String(row.status).toLowerCase())).length;
    const pending = tasks.length - completed - cancelled;
    // Only canonical Gregorian values are used; ambiguous imported Jalali dates
    // remain preserved without being silently counted as overdue.
    const reportTime = new Date();
    const overdue = tasks.filter(row => !['completed', 'cancelled', 'canceled'].includes(String(row.status).toLowerCase()) && reportDeadlinePassed(row.deadlineCanonical || row.dueDateCanonical, reportTime)).length;
    const projectIds = new Set(tasks.map(row => row.projectId)); const projects = repo('projects').all().filter(row => !department || scoped.departmentIdsOf('projects', row).includes(department.id) || projectIds.has(row.id));
    const completionRate = tasks.length ? Math.round(completed * 100 / tasks.length) : 0;
    const visibleProjects = projects.map(project=>{
      const children=tasks.filter(task=>task.projectId===project.id);
      return {...project, progress:children.length ? Math.round(children.reduce((total,task)=>total+(String(task.status).toLowerCase()==='completed'?100:Number(task.progress||0)),0)/children.length):0};
    });
    const statusLabels: Record<string, string> = { DRAFT: 'پیش‌نویس', ACTIVE: 'فعال', IN_PROGRESS: 'در حال انجام', CONNECTED_TO_WORDPRESS: 'متصل به وردپرس', COMPLETED: 'تکمیل‌شده', delayed: 'متوقف', ARCHIVED: 'بایگانی', CANCELLED: 'لغوشده' };
    const departmentNames = (project: any) => scoped.departmentIdsOf('projects', project).map((id: string) => repo('departments').find(id)?.name).filter(Boolean).join('، ');
    const projectRows = visibleProjects.map(project => ({ id: project.id, name: project.title || project.name || '', departmentName: departmentNames(project), progress: project.progress, status: project.status, statusLabel: statusLabels[String(project.status)] || '' }));
    return saveReport({ departmentId, scope: department ? 'department' : 'agency', title: `گزارش عملکرد ${department?.name || 'فضای کاری'}`, content: `${tasks.length} وظیفه، ${completed} تکمیل‌شده، ${cancelled} لغوشده، ${overdue} معوقه.`, metrics: { totalTasks: tasks.length, completed, pending, cancelled, overdue, velocity: completionRate, efficiency: completionRate }, taskSummary: { total: tasks.length, completed, pending, cancelled, overdue }, projectSummary: { totalProjects: projects.length, completedProjects: visibleProjects.filter(row => String(row.status).toLowerCase() === 'completed').length, avgProgress: visibleProjects.length ? Math.round(visibleProjects.reduce((sum, row) => sum + Number(row.progress || 0), 0) / visibleProjects.length) : 0 }, clientProjectsMatrix: projectRows, bottlenecks: overdue ? [`${overdue} وظیفه از موعد گذشته است.`] : [], keyTakeaways: tasks.length ? [`${completionRate}٪ وظایف تکمیل شده است.`] : ['وظیفه‌ای برای محاسبه عملکرد ثبت نشده است.'] });
  };
  endpoint('get', '/org/reports', (_req, res) => res.json(repo('departmentReports').all()), 'read');
  endpoint('get', '/org/departments/:id/reports', (req, res) => { repo('departments').require(req.params.id); res.json(repo('departmentReports').all().filter(row => row.departmentId === req.params.id)); }, 'read');
  endpoint('post', '/org/reports', (req, res) => res.status(201).json(saveReport(reportInput(req.body))), 'write');
  endpoint('post', '/org/reports/executive-summary', (req, res) => { dto(req.body || {}, []); res.status(201).json(generateReport('AGENCY')); }, 'write');
  endpoint('post', '/org/departments/:id/reports', (req, res) => { dto(req.body || {}, []); res.status(201).json(generateReport(req.params.id)); }, 'write');
  endpoint('delete', '/org/reports/bulk', (req, res) => {
    dto(req.body || {}, ['ids']); const ids = req.body?.ids === undefined ? null : new Set(strings(req.body.ids));
    const range = req.query.range || 'all'; enumeration(range, ['all', 'today', 'week', 'month', 'older_week', 'older_month']);
    const selected = repo('departmentReports').all().filter(row => {
      if (ids) return ids.has(row.id); if (range === 'all') return true;
      const stamp = row.createdAt || row.generatedAt; if (typeof stamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(stamp)) return false;
      const age = Date.now() - Date.parse(stamp); if (!Number.isFinite(age) || age < 0) return false;
      const threshold = (range.includes('week') ? 7 : range.includes('month') ? 30 : 1) * 86400000; return range.startsWith('older_') ? age > threshold : age <= threshold;
    });
    const keys = new Set(selected.map(row => row.id)); repo('departmentReports').removeWhere(row => keys.has(row.id)); recordActivity(context, 'REPORTS_DELETED', current().workspaceId, String(keys.size)); res.json({ success: true, count: keys.size });
  });
  endpoint('delete', '/org/reports/:id', (req, res) => { remove('departmentReports', req.params.id); res.json({ success: true, deleted: true }); });
  endpoint('get', '/org/templates', (_req, res) => res.json(repo('departmentTemplates').all()), 'read');
  endpoint('post', '/org/templates', (req, res) => { const input = dto(req.body, ['name', 'description', 'structure']); const row = repo('departmentTemplates').insert({ ...base('template'), name: text(input.name, 'نام قالب', true, 200), description: input.description === undefined ? '' : text(input.description), structure: object(input.structure || {}), createdBy: current().user.name || current().user.username }); changed('TEMPLATE_CREATED', row); res.status(201).json(row); });

  for (const [path, collection, item] of [['navigation-groups', 'navigationGroups', false], ['navigation-items', 'navigationItems', true]] as const) {
    const parse = (body: any, creating = false) => {
      const input = dto(body, item ? ['name', 'icon', 'order', 'path', 'groupId', 'moduleId'] : ['name', 'icon', 'order']); const parsed: any = {};
      if (creating || input.name !== undefined) { const name = dto(input.name, ['fa', 'en']); parsed.name = { fa: text(name.fa, 'نام فارسی', true, 200), en: text(name.en, 'نام انگلیسی', false, 200) }; }
      if (input.icon !== undefined) parsed.icon = text(input.icon, 'آیکون', false, 200);
      if (input.order !== undefined) parsed.order = numeric(input.order, 'ترتیب', 100000);
      if (item) {
        if (creating || input.groupId !== undefined) { parsed.groupId = reference('navigationGroups', input.groupId, false); parsed.navigationGroupId = parsed.groupId; }
        if (input.moduleId !== undefined) { parsed.moduleId = reference('moduleInstances', input.moduleId); parsed.moduleInstanceId = parsed.moduleId; }
        if (creating || input.path !== undefined) { parsed.path = text(input.path, 'مسیر', true, 500); if (!parsed.path.startsWith('/') || parsed.path.startsWith('//') || parsed.path.includes('\\')) invalid('مسیر داخلی معتبر لازم است.'); }
      }
      return parsed;
    };
    endpoint('get', '/org/' + path, (_req, res) => res.json(repo(collection).all()), 'read');
    endpoint('post', '/org/' + path, (req, res) => { const row = repo(collection).insert({ ...base('navigation'), icon: 'Box', order: repo(collection).all().length + 1, ...parse(req.body, true) }); changed('NAVIGATION_CREATED', row); res.status(201).json(row); });
    endpoint('put', '/org/' + path + '/:id', (req, res) => { const row = repo(collection).update(req.params.id, { ...parse(req.body), updatedAt: now() }); changed('NAVIGATION_UPDATED', row); res.json(row); });
    endpoint('delete', '/org/' + path + '/:id', (req, res) => { repo(collection).require(req.params.id); protectReferences(new Set([req.params.id])); if (!item) repo('navigationItems').removeWhere(row => row.groupId === req.params.id || row.navigationGroupId === req.params.id); remove(collection, req.params.id); res.json({ success: true, deletedId: req.params.id }); });
  }
  return router;
}
