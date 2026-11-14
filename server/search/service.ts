import { Router } from 'express';
import { DomainError, identifier, now } from '../domain/repository.ts';
import { dto, text, strings, boolean, invalid } from '../domain/models.ts';
import { departmentAction, manager, membership, writer } from '../policy/scope.ts';
import { OqlError, PRIORITY_RANK, enumValues, normalize, parse, resolveDate, type Node, type Query, type Value } from '../../src/lib/oql.ts';
import type { ProjectTaskService } from '../domain/projects-tasks.ts';

/**
 * Advanced search: OQL queries over the tasks the caller can see, saved filters
 * (personal ones in the member's preferences, shared ones on the workspace) and
 * bulk changes that go through the normal task rules.
 */
const STATUS_ORDER: Record<string, number> = { pending: 1, inprogress: 2, review: 3, blocked: 4, completed: 5, cancelled: 6 };
const TYPE_ORDER: Record<string, number> = { epic: 1, story: 2, task: 3, bug: 4 };
const MAX_PERSONAL = 50, MAX_SHARED = 100;

interface Record_ {
  task: any; id: string; key: string; number: number; title: string; description: string; type: string; status: string; priority: string; rank: number;
  projectId: string; projectTitle: string; assigneeIds: string[]; assigneeNames: string[]; creatorId: string;
  epicId: string | null; epicKey: string; epicTitle: string; epicColor: string; sprintId: string | null; sprintName: string; sprintState: string;
  labels: string[]; points: number | null; due: string | null; created: string; updated: string; createdAt: string; updatedAt: string;
}
type Context = { userId: string; today: string; users: any[]; projects: any[]; epics: Record_[]; sprints: Array<{ id: string; name: string; state: string }> };

const fail = (message: string, value?: { start: number; end: number }): never => { throw new OqlError(message, value?.start ?? 0, value?.end ?? 0); };
const same = (a: string, b: string) => normalize(a) === normalize(b);

export class SearchService {
  constructor(readonly tasks: ProjectTaskService) {}
  get scoped() { return this.tasks.context.scoped; }

  // ------------------------------------------------------------------ records

  private context(today: string, offset: number) {
    const scope = this.tasks.scope();
    const dayOf = (iso: any) => typeof iso === 'string' && iso ? new Date(Date.parse(iso) - offset * 60_000).toISOString().slice(0, 10) : '';
    const users = this.tasks.repo('users').all();
    const projects = this.tasks.repo('projects').all();
    const projectMap = new Map(projects.map(project => [project.id, project]));
    const sprints = projects.flatMap(project => (Array.isArray(project.sprints) ? project.sprints : []).map((sprint: any) => ({ id: sprint.id, name: sprint.name || '', state: sprint.state, projectId: project.id })));
    const sprintMap = new Map(sprints.map(sprint => [sprint.id, sprint]));
    const userMap = new Map(users.map(user => [user.id, user]));
    const rows = this.tasks.repo('tasks').all().filter(task => projectMap.has(task.projectId));
    const taskMap = new Map(rows.map(task => [task.id, task]));
    const records: Record_[] = rows.map(task => {
      const ids: string[] = [...new Set<string>(Array.isArray(task.assignedMemberIds) ? task.assignedMemberIds : task.assigneeId ? [task.assigneeId] : [])].filter(id => userMap.has(id));
      const epic = task.epicId ? taskMap.get(task.epicId) : null;
      const sprint = task.sprintId ? sprintMap.get(task.sprintId) : null;
      const due = task.deadlineCanonical || task.dueDateCanonical || (/^\d{4}-\d{2}-\d{2}/.test(task.deadline || '') ? task.deadline.slice(0, 10) : null);
      return {
        task, id: task.id, key: this.tasks.keyOf(task) || '', number: Number(task.number) || 0, title: task.title || '', description: String(task.description || ''),
        type: task.type || 'task', status: task.status, priority: task.priority || 'medium', rank: PRIORITY_RANK[task.priority] || 2,
        projectId: task.projectId, projectTitle: projectMap.get(task.projectId)?.title || '',
        assigneeIds: ids, assigneeNames: ids.map(id => userMap.get(id)?.name || ''), creatorId: task.createdById || task.creatorId || '',
        epicId: epic?.type === 'epic' ? epic.id : null, epicKey: epic?.type === 'epic' ? this.tasks.keyOf(epic) || '' : '', epicTitle: epic?.type === 'epic' ? epic.title || '' : '', epicColor: epic?.epicColor || 'violet',
        sprintId: sprint ? sprint.id : null, sprintName: sprint?.name || '', sprintState: sprint?.state || '',
        labels: Array.isArray(task.tags) ? task.tags.map(String) : [], points: typeof task.storyPoints === 'number' ? task.storyPoints : null,
        due: due || null, created: dayOf(task.createdAt), updated: dayOf(task.updatedAt || task.createdAt), createdAt: task.createdAt || '', updatedAt: task.updatedAt || task.createdAt || '',
      };
    });
    const context: Context = { userId: scope.user.id, today, users, projects, epics: records.filter(record => record.type === 'epic'), sprints };
    return { records, context };
  }

  // ------------------------------------------------------------------ evaluation

  private compile(node: Node, ctx: Context): (record: Record_) => boolean {
    if (node.type === 'and') { const left = this.compile(node.left, ctx), right = this.compile(node.right, ctx); return record => left(record) && right(record); }
    if (node.type === 'or') { const left = this.compile(node.left, ctx), right = this.compile(node.right, ctx); return record => left(record) || right(record); }
    if (node.type === 'not') { const inner = this.compile(node.node, ctx); return record => !inner(record); }
    const { field, op, values } = node as Extract<Node, { type: 'clause' }>;
    const empty = op === 'is empty', notEmpty = op === 'is not empty';
    const negative = op === '!=' || op === 'not in' || op === '!~';
    const pick = <T,>(test: (record: Record_) => boolean, isEmpty?: (record: Record_) => boolean) => (record: Record_) =>
      empty ? !!isEmpty?.(record) : notEmpty ? !isEmpty?.(record) : test(record);
    const text = (value: Value) => value.kind === 'text' ? value.value : '';

    if (field === 'type' || field === 'status') {
      const allowed = new Set(values.flatMap(value => enumValues(field, text(value)) || []));
      return record => negative !== allowed.has(field === 'type' ? record.type : record.status);
    }
    if (field === 'priority') {
      const ranks = values.flatMap(value => (enumValues('priority', text(value)) || []).map(name => PRIORITY_RANK[name]));
      const target = ranks[0];
      if (op === '>') return record => record.rank > target;
      if (op === '>=') return record => record.rank >= target;
      if (op === '<') return record => record.rank < target;
      if (op === '<=') return record => record.rank <= target;
      const set = new Set(ranks);
      return record => negative !== set.has(record.rank);
    }
    if (field === 'assignee' || field === 'creator') {
      const ids = new Set(values.flatMap(value => {
        if (value.kind === 'func') return [ctx.userId];
        const matches = ctx.users.filter(user => user.id === value.value || same(user.name || '', value.value) || same(user.username || '', value.value));
        if (!matches.length) fail(`عضوی با نام «${value.value}» در این فضای کاری نیست.`, value);
        return matches.map(user => user.id);
      }));
      const of = (record: Record_) => field === 'assignee' ? record.assigneeIds : record.creatorId ? [record.creatorId] : [];
      return pick(record => { const list = of(record); return negative ? list.length > 0 && !list.some(id => ids.has(id)) : list.some(id => ids.has(id)); }, record => of(record).length === 0);
    }
    if (field === 'project') {
      if (op === '~') { const part = normalize(text(values[0])); return record => normalize(record.projectTitle).includes(part); }
      const ids = new Set(values.flatMap(value => {
        const matches = ctx.projects.filter(project => project.id === text(value) || same(project.title || project.name || '', text(value)));
        if (!matches.length) fail(`پروژه‌ای با نام «${text(value)}» نیست.`, value);
        return matches.map(project => project.id);
      }));
      return record => negative !== ids.has(record.projectId);
    }
    if (field === 'epic') {
      if (op === '~') { const part = normalize(text(values[0])); return record => !!record.epicId && normalize(record.epicTitle).includes(part); }
      const ids = new Set(values.flatMap(value => {
        const matches = ctx.epics.filter(epic => epic.id === text(value) || epic.key.toUpperCase() === text(value).toUpperCase() || same(epic.title, text(value)));
        if (!matches.length) fail(`اپیکی با نام یا کلید «${text(value)}» نیست.`, value);
        return matches.map(epic => epic.id);
      }));
      return pick(record => negative ? !!record.epicId && !ids.has(record.epicId) : !!record.epicId && ids.has(record.epicId), record => !record.epicId);
    }
    if (field === 'sprint') {
      if (op === '~') { const part = normalize(text(values[0])); return record => !!record.sprintId && normalize(record.sprintName).includes(part); }
      const ids = new Set(values.flatMap(value => {
        if (value.kind === 'func') return ctx.sprints.filter(sprint => value.name === 'activesprint' ? sprint.state === 'active' : sprint.state === 'active' || sprint.state === 'future').map(sprint => sprint.id);
        const matches = ctx.sprints.filter(sprint => sprint.id === value.value || same(sprint.name, value.value));
        if (!matches.length) fail(`اسپرینتی با نام «${value.value}» نیست.`, value);
        return matches.map(sprint => sprint.id);
      }));
      return pick(record => negative ? !!record.sprintId && !ids.has(record.sprintId) : !!record.sprintId && ids.has(record.sprintId), record => !record.sprintId);
    }
    if (field === 'labels') {
      const wanted = values.map(value => normalize(text(value)));
      const labels = (record: Record_) => record.labels.map(normalize);
      if (op === '~') return record => labels(record).some(label => label.includes(wanted[0]));
      return pick(record => { const has = labels(record).some(label => wanted.includes(label)); return negative ? !has : has; }, record => record.labels.length === 0);
    }
    if (field === 'points') {
      const numbers = values.map(value => Number(normalize(text(value))));
      const target = numbers[0];
      const compare: Record<string, (a: number) => boolean> = { '=': a => a === target, '!=': a => a !== target, '>': a => a > target, '>=': a => a >= target, '<': a => a < target, '<=': a => a <= target, in: a => numbers.includes(a), 'not in': a => !numbers.includes(a) };
      return pick(record => record.points !== null && compare[op](record.points), record => record.points === null);
    }
    if (field === 'due' || field === 'created' || field === 'updated') {
      const day = values[0] ? (values[0].kind === 'func' ? ctx.today : resolveDate(values[0].value, ctx.today)) : null;
      if (values[0] && !day) fail('تاریخ معتبر نیست.', values[0]);
      const of = (record: Record_) => record[field];
      const compare: Record<string, (a: string) => boolean> = { '=': a => a === day, '!=': a => a !== day, '>': a => a > day!, '>=': a => a >= day!, '<': a => a < day!, '<=': a => a <= day! };
      return pick(record => !!of(record) && compare[op](of(record)!), record => !of(record));
    }
    if (field === 'key') {
      const keys = values.map(value => text(value).toUpperCase());
      const matches = (record: Record_) => keys.some(key => key === record.key.toUpperCase() || (/^\d+$/.test(normalize(key)) && Number(normalize(key)) === record.number));
      return record => negative !== matches(record);
    }
    if (field === 'title' || field === 'text') {
      const part = normalize(text(values[0]));
      return record => negative !== normalize(field === 'title' ? record.title : `${record.title} ${record.description}`).includes(part);
    }
    return () => false;
  }

  private sorter(order: Query['order']) {
    const keys: Record<string, (record: Record_) => string | number | null> = {
      project: record => record.projectTitle || null, type: record => TYPE_ORDER[record.type] || 9, status: record => STATUS_ORDER[record.status] || 9,
      priority: record => record.rank, assignee: record => record.assigneeNames[0] || null, epic: record => record.epicTitle || null, sprint: record => record.sprintName || null,
      points: record => record.points, due: record => record.due, created: record => record.createdAt || null, updated: record => record.updatedAt || null,
      key: record => record.number, title: record => record.title || null,
    };
    const rules = order.length ? order : [{ field: 'updated', dir: 'desc' as const }];
    return (a: Record_, b: Record_) => {
      for (const rule of rules) {
        const x = keys[rule.field](a), y = keys[rule.field](b);
        if (x === y) continue;
        if (x === null) return 1; if (y === null) return -1; // empty values always last
        const result = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fa');
        if (result) return rule.dir === 'desc' ? -result : result;
      }
      return b.number - a.number;
    };
  }

  private view(record: Record_) {
    const users = this.tasks.repo('users');
    return {
      id: record.id, key: record.key, title: record.title, type: record.type, status: record.status, priority: record.priority, storyPoints: record.points,
      projectId: record.projectId, projectTitle: record.projectTitle, labels: record.labels,
      assignees: record.assigneeIds.map(id => users.find(id)).filter(Boolean).map((user: any) => ({ id: user.id, name: user.name || '', avatar: user.avatar || '' })),
      epic: record.epicId ? { id: record.epicId, key: record.epicKey, title: record.epicTitle, color: record.epicColor } : null,
      sprint: record.sprintId ? { id: record.sprintId, name: record.sprintName, state: record.sprintState } : null,
      dueDate: record.due, createdAt: record.createdAt, updatedAt: record.updatedAt,
    };
  }

  /** Runs a query. A bad query is not an error response: its message and position come back for the editor. */
  search(query: any) {
    return this.scoped.read(() => {
      const q = typeof query?.q === 'string' ? query.q : '';
      const page = Math.max(1, Math.min(1000, Number.parseInt(query?.page, 10) || 1));
      const pageSize = Math.max(1, Math.min(200, Number.parseInt(query?.pageSize, 10) || 50));
      const today = typeof query?.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.today) ? query.today : new Date().toISOString().slice(0, 10);
      const offset = Number.isInteger(Number(query?.offset)) && Math.abs(Number(query.offset)) <= 840 ? Number(query.offset) : 0;
      try {
        const parsed = parse(q);
        const { records, context } = this.context(today, offset);
        const test = parsed.where ? this.compile(parsed.where, context) : () => true;
        const matched = records.filter(test).sort(this.sorter(parsed.order));
        return { query: q, total: matched.length, page, pageSize, rows: matched.slice((page - 1) * pageSize, page * pageSize).map(record => this.view(record)), error: null };
      } catch (error) {
        if (error instanceof OqlError) return { query: q, total: 0, page, pageSize, rows: [], error: { message: error.message, start: error.start, end: error.end } };
        throw error;
      }
    });
  }

  // ------------------------------------------------------------------ saved filters

  private workspace() { const scope = this.tasks.scope(); return this.scoped.raw.workspaces.find((row: any) => row.id === scope.workspaceId); }
  private preferences(create = false) {
    const scope = this.tasks.scope();
    let row = this.scoped.state.userPreferences.find((item: any) => item.userId === scope.user.id);
    if (!row && create) { row = { id: identifier('pref'), userId: scope.user.id, createdAt: now() }; this.scoped.state.userPreferences.push(row); }
    return row;
  }
  private canManage() { const scope = this.tasks.scope(); return manager(membership(this.scoped.raw, scope.user, scope.workspaceId)); }
  private canWrite() { const scope = this.tasks.scope(); return writer(membership(this.scoped.raw, scope.user, scope.workspaceId)); }
  private filterView(row: any, shared: boolean) {
    const scope = this.tasks.scope();
    const mine = row.ownerId === scope.user.id;
    return { id: row.id, name: row.name, query: row.query, description: row.description || '', shared, ownerId: row.ownerId, ownerName: row.ownerName || '',
      createdAt: row.createdAt, updatedAt: row.updatedAt || row.createdAt, canEdit: mine || (shared && this.canManage()) };
  }
  filters() {
    const scope = this.tasks.scope();
    const personal = (this.preferences()?.searchFilters || []).filter((row: any) => row.workspaceId === scope.workspaceId);
    const shared = Array.isArray(this.workspace()?.sharedFilters) ? this.workspace().sharedFilters : [];
    const known = new Set([...personal, ...shared].map((row: any) => row.id));
    return { personal: personal.map((row: any) => this.filterView(row, false)), shared: shared.map((row: any) => this.filterView(row, true)),
      starred: (this.preferences()?.starredFilters || []).filter((id: string) => known.has(id)), canShare: this.canWrite() };
  }
  private checked(body: any) {
    const out: any = {};
    if ('name' in body) out.name = text(body.name, 'نام فیلتر', true, 120);
    if ('description' in body) out.description = text(body.description, 'توضیح فیلتر', false, 500);
    if ('query' in body) {
      out.query = text(body.query, 'جستجو', false, 2000);
      try { parse(out.query); } catch (error) { if (error instanceof OqlError) invalid(`جستجوی فیلتر معتبر نیست: ${error.message}`); throw error; }
    }
    if ('shared' in body) out.shared = boolean(body.shared);
    return out;
  }
  private locate(id: string) {
    const scope = this.tasks.scope();
    const personal = (this.preferences()?.searchFilters || []).find((row: any) => row.id === id && row.workspaceId === scope.workspaceId);
    if (personal) return { row: personal, shared: false };
    const shared = (this.workspace()?.sharedFilters || []).find((row: any) => row.id === id);
    if (shared) return { row: shared, shared: true };
    throw new DomainError(404, 'RESOURCE_NOT_FOUND', 'فیلتر یافت نشد.');
  }
  createFilter(body: any) {
    dto(body, ['name', 'query', 'shared', 'description']);
    if (body.name === undefined || body.query === undefined) invalid('نام و جستجوی فیلتر لازم است.');
    const input = this.checked(body), scope = this.tasks.scope();
    const row = { id: identifier('filter'), name: input.name, query: input.query, description: input.description || '', ownerId: scope.user.id, ownerName: scope.user.name || '', createdAt: now(), updatedAt: now() };
    if (input.shared) {
      if (!this.canWrite()) throw new DomainError(403, 'FORBIDDEN', 'اشتراک فیلتر با اعضایی است که اجازهٔ ویرایش دارند.');
      const workspace = this.workspace(), list = Array.isArray(workspace.sharedFilters) ? workspace.sharedFilters : [];
      if (list.length >= MAX_SHARED) throw new DomainError(409, 'FILTER_LIMIT', 'سقف فیلترهای مشترک این فضای کاری پر شده است.');
      workspace.sharedFilters = [...list, row];
    } else {
      const preferences = this.preferences(true), list = Array.isArray(preferences.searchFilters) ? preferences.searchFilters : [];
      if (list.filter((item: any) => item.workspaceId === scope.workspaceId).length >= MAX_PERSONAL) throw new DomainError(409, 'FILTER_LIMIT', 'سقف فیلترهای شخصی شما پر شده است.');
      preferences.searchFilters = [...list, { ...row, workspaceId: scope.workspaceId }];
    }
    return this.filterView(row, !!input.shared);
  }
  updateFilter(id: string, body: any) {
    dto(body, ['name', 'query', 'shared', 'starred', 'description']);
    const { row, shared } = this.locate(id), scope = this.tasks.scope();
    if ('starred' in body) {
      const starred = boolean(body.starred), preferences = this.preferences(true), list: string[] = Array.isArray(preferences.starredFilters) ? preferences.starredFilters : [];
      preferences.starredFilters = starred ? [...new Set([...list, id])] : list.filter(item => item !== id);
    }
    const input = this.checked(body);
    const edits = Object.keys(input).filter(key => key !== 'shared');
    const mine = row.ownerId === scope.user.id;
    if (edits.length && !(mine || (shared && this.canManage()))) throw new DomainError(403, 'FORBIDDEN', 'فقط سازندهٔ فیلتر یا مدیر می‌تواند آن را تغییر دهد.');
    for (const key of edits) row[key] = input[key];
    if (edits.length) row.updatedAt = now();
    if ('shared' in input && input.shared !== shared) {
      if (!mine) throw new DomainError(403, 'FORBIDDEN', 'فقط سازندهٔ فیلتر می‌تواند اشتراک آن را تغییر دهد.');
      if (input.shared && !this.canWrite()) throw new DomainError(403, 'FORBIDDEN', 'اشتراک فیلتر با اعضایی است که اجازهٔ ویرایش دارند.');
      this.removeFilter(id, row, shared);
      const { workspaceId: _workspace, ...plain } = row;
      if (input.shared) { const workspace = this.workspace(); workspace.sharedFilters = [...(workspace.sharedFilters || []), plain]; }
      else { const preferences = this.preferences(true); preferences.searchFilters = [...(preferences.searchFilters || []), { ...plain, workspaceId: scope.workspaceId }]; }
      return this.filterView(row, input.shared);
    }
    return this.filterView(row, shared);
  }
  private removeFilter(id: string, row: any, shared: boolean) {
    if (shared) { const workspace = this.workspace(); workspace.sharedFilters = (workspace.sharedFilters || []).filter((item: any) => item.id !== id); }
    else { const preferences = this.preferences(true); preferences.searchFilters = (preferences.searchFilters || []).filter((item: any) => item.id !== id); }
  }
  deleteFilter(id: string) {
    const { row, shared } = this.locate(id), scope = this.tasks.scope();
    if (!(row.ownerId === scope.user.id || (shared && this.canManage()))) throw new DomainError(403, 'FORBIDDEN', 'فقط سازندهٔ فیلتر یا مدیر می‌تواند آن را حذف کند.');
    this.removeFilter(id, row, shared);
    return { success: true, deletedId: id };
  }

  // ------------------------------------------------------------------ bulk change

  /** Applies one change to many tasks; each task keeps its own rules and reports its own failure. */
  bulk(body: any) {
    dto(body, ['taskIds', 'changes']);
    const ids = strings(body.taskIds, 'وظایف', 100);
    if (!ids.length) invalid('دست‌کم یک وظیفه لازم است.');
    const changes = dto(body.changes, ['status', 'priority', 'assigneeId', 'epicId', 'type']);
    if (!Object.keys(changes).length) invalid('دست‌کم یک تغییر لازم است.');
    const scope = this.tasks.scope();
    const { status, ...rest } = changes;
    let updated = 0;
    const failed: Array<{ id: string; key: string; message: string }> = [];
    this.tasks.batch(() => {
      for (const id of ids) {
        const task = this.tasks.repo('tasks').find(id);
        if (!task) { failed.push({ id, key: '', message: 'وظیفه یافت نشد.' }); continue; }
        if (this.scoped.departmentIdsOf('tasks', task).some((departmentId: string) => !departmentAction(this.scoped, scope.user, scope.workspaceId, departmentId, 'update'))) {
          failed.push({ id, key: this.tasks.keyOf(task) || '', message: 'مجوز ویرایش در دپارتمان این وظیفه را ندارید.' }); continue;
        }
        try {
          if (Object.keys(rest).length) this.tasks.updateTask(id, rest);
          if (status !== undefined) this.tasks.setStatus(id, { status });
          updated++;
        } catch (error) {
          failed.push({ id, key: this.tasks.keyOf(task) || '', message: error instanceof Error ? error.message : 'تغییر انجام نشد.' });
        }
      }
    });
    return { updated, failed };
  }
}

export function createSearchRouter(service: SearchService) {
  const router = Router();
  const endpoint = (fn: (req: any) => any, status = 200) => (req: any, res: any, next: any) => { try { res.status(status).json(fn(req)); } catch (error) { next(error); } };
  router.get('/search', endpoint(req => service.search(req.query)));
  router.put('/search/bulk', endpoint(req => service.bulk(req.body)));
  router.get('/filters', endpoint(() => service.filters()));
  router.post('/filters', endpoint(req => service.createFilter(req.body), 201));
  router.put('/filters/:id', endpoint(req => service.updateFilter(req.params.id, req.body)));
  router.delete('/filters/:id', endpoint(req => service.deleteFilter(req.params.id)));
  return router;
}
