import { Router } from 'express';
import { now, recordActivity } from './repository.ts';
import { dto, text, strings, invalid } from './models.ts';
import { membership, writer } from '../policy/scope.ts';
import type { ProjectTaskService } from './projects-tasks.ts';
import type { SprintService } from './sprints.ts';

/**
 * Epics are tasks of type "epic" that group a project's stories, tasks and bugs
 * (each linked by `epicId`). Their progress always comes from that work, never
 * from the epic's own status.
 */
const closed = (status: any) => ['completed', 'COMPLETED', 'cancelled'].includes(String(status));
const points = (task: any) => typeof task?.storyPoints === 'number' && Number.isFinite(task.storyPoints) ? task.storyPoints : 0;
const round = (value: number) => Math.round(value * 100) / 100;
const dateOf = (task: any, ...keys: string[]) => { for (const key of keys) { const value = task[`${key}Canonical`] || task[key]; if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10); } return ''; };

export function progress(list: any[]) {
  const estimated = list.filter(task => typeof task.storyPoints === 'number');
  const total = round(list.reduce((sum, task) => sum + points(task), 0));
  const donePoints = round(list.filter(task => closed(task.status)).reduce((sum, task) => sum + points(task), 0));
  const done = list.filter(task => closed(task.status)).length;
  return {
    tasks: list.length, done, inProgress: list.filter(task => ['inprogress', 'review'].includes(task.status)).length,
    todo: list.filter(task => ['pending', 'blocked'].includes(task.status)).length, blocked: list.filter(task => task.status === 'blocked').length,
    points: total, donePoints, estimated: estimated.length,
    percent: total > 0 ? Math.round(100 * donePoints / total) : list.length ? Math.round(100 * done / list.length) : 0,
  };
}

export class EpicService {
  constructor(readonly tasks: ProjectTaskService, readonly sprints: SprintService) {}
  get context() { return this.tasks.context; }

  overview(query: any) {
    return this.context.scoped.read(() => {
      const scope = this.tasks.scope();
      const projectId = query?.projectId ? this.tasks.repo('projects').require(text(query.projectId, 'پروژه', true, 200)).id : null;
      const projects = new Map(this.tasks.repo('projects').all().map(project => [project.id, project]));
      const all = this.tasks.repo('tasks').all().filter(task => (!projectId || task.projectId === projectId) && projects.has(task.projectId));
      const work = all.filter(task => task.type !== 'epic');
      const epics = all.filter(task => task.type === 'epic').sort((a, b) =>
        (dateOf(a, 'startDate') || '9999').localeCompare(dateOf(b, 'startDate') || '9999') || (Number(a.number) || 0) - (Number(b.number) || 0));
      const users = this.tasks.repo('users');
      const loose = work.filter(task => !task.epicId || !epics.some(epic => epic.id === task.epicId));
      return {
        projectId, canWrite: writer(membership(this.context.scoped.raw, scope.user, scope.workspaceId)),
        epics: epics.map(epic => {
          const children = work.filter(task => task.epicId === epic.id);
          const owner = (Array.isArray(epic.assignedMemberIds) ? epic.assignedMemberIds : []).map((id: string) => users.find(id)).find(Boolean);
          return {
            id: epic.id, key: this.tasks.keyOf(epic), title: epic.title || '', description: String(epic.description || '').slice(0, 2000), status: epic.status,
            color: epic.epicColor || 'violet', projectId: epic.projectId, projectTitle: projects.get(epic.projectId)?.title || '',
            startDate: dateOf(epic, 'startDate'), dueDate: dateOf(epic, 'deadline', 'dueDate'),
            owner: owner ? { id: owner.id, name: owner.name || '', avatar: owner.avatar || '' } : null,
            progress: progress(children),
            types: { story: children.filter(task => task.type === 'story').length, task: children.filter(task => (task.type || 'task') === 'task').length, bug: children.filter(task => task.type === 'bug').length },
            children: this.sprints.ordered(children).map(task => this.sprints.row(task, projects.get(task.projectId))),
          };
        }),
        unassigned: { tasks: loose.filter(task => !closed(task.status)).length, points: round(loose.filter(task => !closed(task.status)).reduce((sum, task) => sum + points(task), 0)) },
        candidates: this.sprints.ordered(loose.filter(task => !closed(task.status))).slice(0, 300).map(task => this.sprints.row(task, projects.get(task.projectId))),
      };
    });
  }

  /** Links tasks to an epic of their project, or unlinks them (epicId null). */
  link(body: any) {
    dto(body, ['projectId', 'epicId', 'taskIds']);
    const project = this.tasks.repo('projects').require(text(body.projectId, 'پروژه', true, 200));
    const ids = strings(body.taskIds, 'وظایف', 100);
    if (!ids.length) invalid('دست‌کم یک وظیفه لازم است.');
    const repo = this.tasks.repo('tasks');
    let epic: any = null;
    if (body.epicId !== undefined && body.epicId !== null) {
      epic = repo.require(text(body.epicId, 'اپیک', true, 200));
      if (epic.type !== 'epic' || epic.projectId !== project.id) invalid('اپیک انتخاب‌شده معتبر نیست.');
    }
    const rows = ids.map(id => repo.require(id));
    if (rows.some(task => task.projectId !== project.id)) invalid('همهٔ وظایف باید از همین پروژه باشند.');
    if (rows.some(task => task.type === 'epic')) invalid('اپیک نمی‌تواند زیرمجموعهٔ اپیک دیگری باشد.');
    for (const task of rows) { if (epic) task.epicId = epic.id; else delete task.epicId; task.updatedAt = now(); }
    recordActivity(this.context, epic ? 'EPIC_LINKED' : 'EPIC_UNLINKED', epic?.id || project.id);
    this.tasks.emit('tasks_updated', () => this.tasks.tasks());
    return this.overview({ projectId: project.id });
  }
}

export function createEpicRouter(service: EpicService) {
  const router = Router();
  const endpoint = (fn: (req: any) => any) => (req: any, res: any, next: any) => { try { res.json(fn(req)); } catch (error) { next(error); } };
  router.get('/epics', endpoint(req => service.overview(req.query)));
  router.put('/epics/link', endpoint(req => service.link(req.body)));
  return router;
}
