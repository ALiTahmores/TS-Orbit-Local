import { Router } from 'express';
import { DomainError, identifier, now, recordActivity } from './repository.ts';
import { dto, text, strings, invalid } from './models.ts';
import { manager, membership } from '../policy/scope.ts';
import type { ProjectTaskService } from './projects-tasks.ts';

/**
 * Scrum planning: sprints live on their project (like team checklists), tasks carry
 * `sprintId`, `storyPoints` and `backlogRank`. A running sprint keeps the scope it
 * started with and every later scope change, so its burndown can be replayed.
 */
type SprintState = 'future' | 'active' | 'closed';
const DAY = 86_400_000;
const MAX_OPEN_SPRINTS = 20;
const closed = (status: any) => ['completed', 'COMPLETED', 'cancelled'].includes(String(status));
const done = (status: any) => ['completed', 'COMPLETED'].includes(String(status));
const estimate = (task: any): number | null => typeof task?.storyPoints === 'number' && Number.isFinite(task.storyPoints) ? task.storyPoints : null;
const points = (task: any) => estimate(task) ?? 0;
const round = (value: number) => Math.round(value * 100) / 100;
const sum = (rows: any[], weight: (row: any) => number = points) => round(rows.reduce((total, row) => total + weight(row), 0));

function isoDate(value: any, label: string): string {
  const date = text(value, label, true, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) invalid(`${label} معتبر لازم است.`);
  return date;
}
/** The caller's calendar: its date and UTC offset (minutes, as Date#getTimezoneOffset). */
function clock(query: any): { today: string | null; offset: number } {
  const today = typeof query?.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.today) ? query.today : null;
  const offset = Number(query?.offset);
  return { today, offset: Number.isInteger(offset) && Math.abs(offset) <= 840 ? offset : 0 };
}

export class SprintService {
  constructor(readonly tasks: ProjectTaskService) {}
  get context() { return this.tasks.context; }
  canManage(): boolean { const scope = this.tasks.scope(); return manager(membership(this.context.scoped.raw, scope.user, scope.workspaceId)); }
  project(id: any) { return this.tasks.repo('projects').require(text(id, 'پروژه', true, 200)); }
  sprints(project: any): any[] { return Array.isArray(project?.sprints) ? project.sprints : []; }
  locate(id: string) {
    for (const project of this.tasks.repo('projects').all()) {
      const sprint = this.sprints(project).find(row => row.id === id);
      if (sprint) return { project, sprint };
    }
    throw new DomainError(404, 'RESOURCE_NOT_FOUND', 'اسپرینت یافت نشد.');
  }
  projectTasks(projectId: string): any[] { return this.tasks.repo('tasks').all().filter(task => task.projectId === projectId); }
  /** The open sprint a task is planned in, or null for the backlog. */
  lane(task: any, project: any): string | null {
    return task.sprintId && this.sprints(project).some(row => row.id === task.sprintId && row.state !== 'closed') ? task.sprintId : null;
  }
  ordered(tasks: any[]): any[] {
    const rank = (task: any) => typeof task.backlogRank === 'number' ? task.backlogRank : Number.MAX_SAFE_INTEGER;
    return [...tasks].sort((a, b) => rank(a) - rank(b) || (Number(a.number) || 0) - (Number(b.number) || 0) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  }
  row(task: any, project: any) {
    const users = this.tasks.repo('users');
    const ids: string[] = Array.isArray(task.assignedMemberIds) ? task.assignedMemberIds : task.assigneeId ? [task.assigneeId] : [];
    return {
      id: task.id, key: this.tasks.keyOf(task), title: task.title || '', status: task.status, priority: task.priority || 'medium', storyPoints: estimate(task),
      type: task.type || 'task', epicId: task.epicId || null,
      sprintId: this.lane(task, project), dueDate: task.deadlineCanonical || task.dueDateCanonical || task.deadline || task.dueDate || '',
      assignees: [...new Set(ids)].map(id => users.find(id)).filter(Boolean).map((user: any) => ({ id: user.id, name: user.name || '', avatar: user.avatar || '' })),
    };
  }
  stats(tasks: any[]) {
    return {
      tasks: tasks.length, estimated: tasks.filter(task => estimate(task) !== null).length, points: sum(tasks),
      todoPoints: sum(tasks.filter(task => ['pending', 'blocked'].includes(task.status))),
      progressPoints: sum(tasks.filter(task => ['inprogress', 'review'].includes(task.status))),
      donePoints: sum(tasks.filter(task => closed(task.status))), doneTasks: tasks.filter(task => closed(task.status)).length,
    };
  }
  view(sprint: any) {
    const { id, number, name, goal, state, startDate, endDate, createdAt, startedAt, completedAt } = sprint;
    return { id, number, name, goal: goal || '', state, startDate: startDate || '', endDate: endDate || '', createdAt, startedAt: startedAt || null, completedAt: completedAt || null,
      report: sprint.report ? { committedPoints: sprint.report.committedPoints, completedPoints: sprint.report.completedPoints, completedTasks: sprint.report.completedTasks, incompleteTasks: sprint.report.remainingTasks } : null };
  }
  touch(action: string, project: any, tasksChanged = false) {
    project.updatedAt = now();
    recordActivity(this.context, action, project.id);
    if (tasksChanged) this.tasks.emit('tasks_updated', this.tasks.tasks());
    this.tasks.emit('projects_updated', this.tasks.projects());
  }

  // ------------------------------------------------------------------ reads

  overview(query: any) {
    return this.context.scoped.read(() => {
      const project = this.project(query?.projectId);
      const all = this.sprints(project), tasks = this.projectTasks(project.id);
      const open = all.filter(row => row.state !== 'closed').sort((a, b) => (a.state === 'active' ? 0 : 1) - (b.state === 'active' ? 0 : 1) || (a.number || 0) - (b.number || 0));
      const history = all.filter(row => row.state === 'closed').sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')));
      const velocity = history.slice(0, 8).reverse().map(row => ({ id: row.id, name: row.name, committed: row.report?.committedPoints || 0, completed: row.report?.completedPoints || 0 }));
      const recent = velocity.slice(-3);
      return {
        projectId: project.id, canManage: this.canManage(),
        sprints: open.map(row => ({ ...this.view(row), stats: this.stats(tasks.filter(task => task.sprintId === row.id)) })),
        closed: history.slice(0, 20).map(row => this.view(row)),
        // Epics group work but are not planned in sprints themselves.
        tasks: this.ordered(tasks.filter(task => task.type !== 'epic')).map(task => this.row(task, project)).filter(row => row.sprintId || !closed(row.status)),
        epics: tasks.filter(task => task.type === 'epic').map(epic => ({ id: epic.id, key: this.tasks.keyOf(epic), title: epic.title || '', color: epic.epicColor || 'violet', status: epic.status })),
        velocity: { sprints: velocity, average: recent.length ? round(recent.reduce((total, row) => total + row.completed, 0) / recent.length) : 0 },
      };
    });
  }
  report(id: string, query: any) {
    return this.context.scoped.read(() => {
      const { project, sprint } = this.locate(id);
      if (sprint.state === 'future') throw new DomainError(409, 'SPRINT_NOT_STARTED', 'این اسپرینت هنوز شروع نشده است.');
      const { today, offset } = clock(query);
      const tasks = this.projectTasks(project.id);
      const summary = sprint.state === 'closed' && sprint.report ? sprint.report : this.summary(sprint, tasks);
      const burndown = sprint.state === 'closed' && sprint.report?.burndown ? sprint.report.burndown : this.burndown(sprint, tasks, today, offset);
      const { burndown: _snapshot, ...rest } = summary;
      return { sprint: this.view(sprint), summary: rest, burndown };
    });
  }
  /** What the sprint committed to, what changed and what got done. */
  summary(sprint: any, tasks: any[]) {
    const start: any[] = Array.isArray(sprint.startScope) ? sprint.startScope : [], events: any[] = Array.isArray(sprint.events) ? sprint.events : [];
    const startIds = new Set(start.map(row => row.taskId));
    const inSprint = this.ordered(tasks.filter(task => task.sprintId === sprint.id));
    const current = new Set(inSprint.map(task => task.id));
    const added = new Set(events.filter(row => row.kind === 'add' && !startIds.has(row.taskId)).map(row => row.taskId));
    const removed = [...new Set(events.filter(row => row.kind === 'remove' && !current.has(row.taskId)).map(row => row.taskId))];
    const item = (task: any) => ({ id: task.id, key: this.tasks.keyOf(task), title: task.title || '', status: task.status, storyPoints: estimate(task), added: added.has(task.id) });
    const finished = inSprint.filter(task => closed(task.status)), open = inSprint.filter(task => !closed(task.status));
    return {
      committedPoints: round(start.reduce((total, row) => total + (Number(row.points) || 0), 0)), committedTasks: start.length,
      addedPoints: sum(inSprint.filter(task => added.has(task.id))), addedTasks: inSprint.filter(task => added.has(task.id)).length, removedTasks: removed.length,
      completedPoints: sum(inSprint.filter(task => done(task.status))), completedTasks: finished.length,
      remainingPoints: sum(open), remainingTasks: open.length,
      completed: finished.map(item), incomplete: open.map(item),
    };
  }
  /**
   * Replays the sprint day by day: scope from its start and logged changes, work
   * left from each task's status history. Without estimates it counts tasks.
   */
  burndown(sprint: any, tasks: any[], today: string | null, offset: number) {
    if (!sprint.startDate || !sprint.endDate || !sprint.startedAt) return null;
    const dayOf = (iso: string) => new Date(Date.parse(iso) - offset * 60_000).toISOString().slice(0, 10);
    const byId = new Map(tasks.map(task => [task.id, task]));
    const start: any[] = Array.isArray(sprint.startScope) ? sprint.startScope : [];
    const events = [...(Array.isArray(sprint.events) ? sprint.events : [])].sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const everPoints = start.some(row => Number(row.points) > 0) || events.some(row => Number(row.points) > 0);
    const unit: 'points' | 'tasks' = everPoints ? 'points' : 'tasks';
    const weight = (value: any) => unit === 'tasks' ? 1 : Number(value) || 0;
    const closedOn = (task: any, day: string) => {
      const history = (Array.isArray(task.statusHistory) ? task.statusHistory : []).filter((row: any) => row?.timestamp);
      const before = history.filter((row: any) => dayOf(row.timestamp) <= day);
      if (before.length) return closed(before[before.length - 1].newStatus);
      return closed(history.length ? history[0].previousStatus : task.status);
    };
    const days: string[] = [];
    for (let time = Date.parse(sprint.startDate + 'T00:00:00Z'), end = Date.parse(sprint.endDate + 'T00:00:00Z'); time <= end && days.length < 120; time += DAY)
      days.push(new Date(time).toISOString().slice(0, 10));
    const last = sprint.state === 'closed' && sprint.completedAt ? dayOf(sprint.completedAt) : today || dayOf(now());
    const scope = new Map<string, number>(start.map(row => [row.taskId, Number(row.points) || 0]));
    let pointer = 0;
    const series = days.map(day => {
      if (day > last) return { day, remaining: null as number | null, scope: null as number | null };
      while (pointer < events.length && dayOf(events[pointer].at) <= day) {
        const event = events[pointer++];
        if (event.kind === 'remove') scope.delete(event.taskId); else scope.set(event.taskId, Number(event.points) || 0);
      }
      let remaining = 0, total = 0;
      for (const [id, value] of scope) {
        total += weight(value);
        const task = byId.get(id);
        if (!task || !closedOn(task, day)) remaining += weight(value);
      }
      return { day, remaining: round(remaining), scope: round(total) };
    });
    // Work already finished when the sprint started is not part of the commitment line.
    const committed = start.reduce((total, row) => total + (row.closed ? 0 : weight(row.points)), 0);
    const steps = Math.max(1, series.length - 1);
    return { unit, committed: round(committed), days: series.map((row, index) => ({ ...row, ideal: round(committed * (1 - index / steps)) })) };
  }

  // ------------------------------------------------------------------ writes

  create(body: any) {
    this.tasks.manage();
    dto(body, ['projectId', 'name', 'goal']);
    const project = this.project(body.projectId), all = this.sprints(project);
    if (all.filter(row => row.state !== 'closed').length >= MAX_OPEN_SPRINTS) throw new DomainError(409, 'SPRINT_LIMIT', 'تعداد اسپرینت‌های باز این پروژه به سقف رسیده است.');
    const number = all.reduce((max, row) => Math.max(max, Number(row.number) || 0), 0) + 1;
    const sprint = {
      id: identifier('sprint'), number, name: body.name === undefined ? `اسپرینت ${number}` : text(body.name, 'نام اسپرینت', true, 120),
      goal: body.goal === undefined ? '' : text(body.goal, 'هدف اسپرینت', false, 500), state: 'future' as SprintState, startDate: '', endDate: '',
      createdAt: now(), createdById: this.tasks.actor().id, startedAt: null, completedAt: null, startScope: [], events: [], report: null,
    };
    project.sprints = [...all, sprint];
    this.touch('SPRINT_CREATED', project);
    return this.view(sprint);
  }
  details(sprint: any, body: any, requireDates: boolean) {
    if ('name' in body) sprint.name = text(body.name, 'نام اسپرینت', true, 120);
    if ('goal' in body) sprint.goal = text(body.goal, 'هدف اسپرینت', false, 500);
    const startDate = 'startDate' in body ? (body.startDate === '' && !requireDates ? '' : isoDate(body.startDate, 'تاریخ شروع')) : sprint.startDate;
    const endDate = 'endDate' in body ? (body.endDate === '' && !requireDates ? '' : isoDate(body.endDate, 'تاریخ پایان')) : sprint.endDate;
    if (requireDates && (!startDate || !endDate)) invalid('تاریخ شروع و پایان اسپرینت لازم است.');
    if (startDate && endDate) {
      if (endDate < startDate) invalid('پایان اسپرینت باید پس از شروع آن باشد.');
      if ((Date.parse(endDate) - Date.parse(startDate)) / DAY > 90) invalid('اسپرینت حداکثر ۹۰ روز است.');
    }
    sprint.startDate = startDate || ''; sprint.endDate = endDate || '';
  }
  update(id: string, body: any) {
    this.tasks.manage();
    dto(body, ['name', 'goal', 'startDate', 'endDate']);
    const { project, sprint } = this.locate(id);
    if (sprint.state === 'closed') throw new DomainError(409, 'SPRINT_CLOSED', 'اسپرینت بسته‌شده تغییر نمی‌کند.');
    this.details(sprint, body, sprint.state === 'active');
    this.touch('SPRINT_UPDATED', project);
    return this.view(sprint);
  }
  start(id: string, body: any) {
    this.tasks.manage();
    dto(body, ['name', 'goal', 'startDate', 'endDate']);
    const { project, sprint } = this.locate(id);
    if (sprint.state !== 'future') throw new DomainError(409, 'SPRINT_STATE', 'فقط اسپرینت برنامه‌ریزی‌شده شروع می‌شود.');
    if (this.sprints(project).some(row => row.state === 'active')) throw new DomainError(409, 'SPRINT_ACTIVE', 'این پروژه اسپرینت فعال دارد؛ ابتدا آن را ببندید.');
    const scope = this.projectTasks(project.id).filter(task => task.sprintId === sprint.id);
    if (!scope.length) throw new DomainError(409, 'SPRINT_EMPTY', 'برای شروع، دست‌کم یک وظیفه به اسپرینت اضافه کنید.');
    this.details(sprint, body, true);
    Object.assign(sprint, { state: 'active', startedAt: now(), startedById: this.tasks.actor().id, events: [],
      startScope: scope.map(task => ({ taskId: task.id, points: points(task), closed: closed(task.status) })) });
    this.touch('SPRINT_STARTED', project);
    return this.view(sprint);
  }
  complete(id: string, body: any, query: any = {}) {
    this.tasks.manage();
    dto(body, ['moveTo']);
    const { project, sprint } = this.locate(id);
    if (sprint.state !== 'active') throw new DomainError(409, 'SPRINT_STATE', 'فقط اسپرینت فعال بسته می‌شود.');
    const moveTo = body.moveTo === undefined ? 'backlog' : text(body.moveTo, 'مقصد کارهای باز', true, 200);
    const tasks = this.projectTasks(project.id);
    const open = this.ordered(tasks.filter(task => task.sprintId === sprint.id && !closed(task.status)));
    let target: any = null;
    if (moveTo === 'new') {
      const before = this.sprints(project).length;
      this.create({ projectId: project.id });
      target = this.sprints(project)[before];
    } else if (moveTo !== 'backlog') {
      target = this.sprints(project).find(row => row.id === moveTo && row.state === 'future');
      if (!target) invalid('اسپرینت مقصد معتبر نیست.');
    }
    const { today, offset } = clock(query);
    const report = this.summary(sprint, tasks);
    const burndown = this.burndown({ ...sprint, state: 'closed', completedAt: now() }, tasks, today, offset);
    sprint.report = { ...report, burndown };
    Object.assign(sprint, { state: 'closed', completedAt: now(), completedById: this.tasks.actor().id });
    if (open.length) this.place(project, open, target?.id || null, null, true);
    this.touch('SPRINT_COMPLETED', project, true);
    return { sprint: this.view(sprint), moved: open.length, target: target ? this.view(target) : null };
  }
  remove(id: string) {
    this.tasks.manage();
    const { project, sprint } = this.locate(id);
    if (sprint.state !== 'future') throw new DomainError(409, 'SPRINT_STATE', 'فقط اسپرینت شروع‌نشده حذف می‌شود.');
    const planned = this.projectTasks(project.id).filter(task => task.sprintId === id);
    if (planned.length) this.place(project, this.ordered(planned), null, null, false);
    project.sprints = this.sprints(project).filter(row => row.id !== id);
    this.touch('SPRINT_DELETED', project, planned.length > 0);
    return { success: true, deletedId: id, moved: planned.length };
  }
  /** Moves tasks into a sprint or the backlog, before another task or at the end. */
  move(body: any) {
    dto(body, ['projectId', 'taskIds', 'sprintId', 'beforeTaskId']);
    const project = this.project(body.projectId);
    const ids = strings(body.taskIds, 'وظایف', 100);
    if (!ids.length) invalid('دست‌کم یک وظیفه لازم است.');
    const repo = this.tasks.repo('tasks');
    const moving = ids.map(taskId => repo.require(taskId));
    if (moving.some(task => task.projectId !== project.id)) invalid('همهٔ وظایف باید از همین پروژه باشند.');
    if (moving.some(task => task.type === 'epic')) invalid('اپیک‌ها در اسپرینت برنامه‌ریزی نمی‌شوند؛ کارهای آن را منتقل کنید.');
    let target: string | null = null;
    if (body.sprintId !== undefined && body.sprintId !== null) {
      const sprint = this.sprints(project).find(row => row.id === body.sprintId);
      if (!sprint || sprint.state === 'closed') invalid('اسپرینت مقصد معتبر نیست.');
      target = sprint!.id;
    }
    const before = body.beforeTaskId ? repo.require(text(body.beforeTaskId, 'وظیفهٔ مرجع', true, 200)) : null;
    if (before && (before.projectId !== project.id || ids.includes(before.id))) invalid('وظیفهٔ مرجع معتبر نیست.');
    this.place(project, moving, target, before?.id || null, false);
    project.updatedAt = now();
    recordActivity(this.context, 'BACKLOG_UPDATED', project.id);
    this.tasks.emit('tasks_updated', this.tasks.tasks());
    return this.overview({ projectId: project.id });
  }
  /** Re-ranks the target lane with `moving` placed before `beforeId` (or first/last). */
  place(project: any, moving: any[], target: string | null, beforeId: string | null, first: boolean) {
    const movingIds = new Set(moving.map(task => task.id));
    const sprints = this.sprints(project);
    const active = (id: string | null) => !!id && sprints.some(row => row.id === id && row.state === 'active');
    for (const task of moving) {
      const from = task.sprintId || null;
      const fromActive = active(from) && from !== target;
      if (fromActive) this.log(project, from!, 'remove', task);
      if (active(target) && from !== target) this.log(project, target!, 'add', task);
      if (target) task.sprintId = target; else delete task.sprintId;
      task.updatedAt = now();
    }
    const lane = this.ordered(this.projectTasks(project.id).filter(task => !movingIds.has(task.id) && this.lane(task, project) === target && (target || !closed(task.status))));
    const found = beforeId ? lane.findIndex(task => task.id === beforeId) : -1;
    const at = found >= 0 ? found : first ? 0 : lane.length;
    [...lane.slice(0, at), ...moving, ...lane.slice(at)].forEach((task, position) => { task.backlogRank = (position + 1) * 1000; });
  }
  log(project: any, sprintId: string, kind: 'add' | 'remove', task: any) {
    const sprint = this.sprints(project).find(row => row.id === sprintId);
    if (!sprint) return;
    sprint.events = [...(Array.isArray(sprint.events) ? sprint.events : []), { at: now(), kind, taskId: task.id, points: points(task) }].slice(-2000);
  }
}

export function createSprintRouter(service: SprintService) {
  const router = Router();
  const endpoint = (fn: (req: any) => any, status = 200) => (req: any, res: any, next: any) => { try { res.status(status).json(fn(req)); } catch (error) { next(error); } };
  router.get('/sprints', endpoint(req => service.overview(req.query)));
  router.post('/sprints', endpoint(req => service.create(req.body), 201));
  router.put('/backlog/move', endpoint(req => service.move(req.body)));
  router.get('/sprints/:id/report', endpoint(req => service.report(req.params.id, req.query)));
  router.put('/sprints/:id', endpoint(req => service.update(req.params.id, req.body)));
  router.post('/sprints/:id/start', endpoint(req => service.start(req.params.id, req.body)));
  router.post('/sprints/:id/complete', endpoint(req => service.complete(req.params.id, req.body, req.query)));
  router.delete('/sprints/:id', endpoint(req => service.remove(req.params.id)));
  return router;
}
