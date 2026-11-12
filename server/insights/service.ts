import { Router } from 'express';
import { ScopedState, activeMember, manager, membership, type Scope } from '../policy/scope.ts';
import { DomainError } from '../domain/repository.ts';

/*
 * Workspace figures for the dashboard, the risk review and the team page. Every
 * figure is derived from rows the requesting member may see (department and
 * chat restrictions included), so a summary never reveals a hidden record.
 */

interface InsightOptions {
  scoped: ScopedState;
  presence?: (userId: string, workspaceId: string) => boolean;
}

const DAY = 86_400_000;
const STALE_REVIEW_DAYS = 2;
const CAPACITY_HOURS = 40;
const status = (task: any) => String(task?.status || 'pending').toLowerCase();
const isOpen = (task: any) => !['completed', 'cancelled'].includes(status(task));
const stamp = (value: any): number | undefined => {
  if (typeof value !== 'string' || !value) return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : undefined;
};
const isoDay = (value: any): string | undefined => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : undefined;
const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const priorityRank: Record<string, number> = { critical: 0, urgent: 0, high: 1, medium: 2, low: 3 };

/** When the task last entered its current status, from its status history. */
function enteredStatusAt(task: any): number | undefined {
  const entry = [...(Array.isArray(task.statusHistory) ? task.statusHistory : [])].reverse().find((item: any) => String(item?.newStatus).toLowerCase() === status(task));
  return stamp(entry?.timestamp) ?? stamp(task.updatedAt) ?? stamp(task.createdAt);
}
function completedAt(task: any): number | undefined {
  return status(task) === 'completed' ? enteredStatusAt(task) : undefined;
}
/** The task's due day as YYYY-MM-DD, from the canonical fields the server writes. */
function dueDay(task: any): string | undefined {
  return isoDay(task.deadlineCanonical) || isoDay(task.dueDateCanonical) || isoDay(task.deadline) || isoDay(task.dueDate);
}
function assigneeIds(task: any): string[] {
  if (Array.isArray(task.assignedMemberIds)) return task.assignedMemberIds.filter((id: any) => typeof id === 'string');
  if (typeof task.assigneeId === 'string' && task.assigneeId) return [task.assigneeId];
  return (Array.isArray(task.assignees) ? task.assignees : []).map((row: any) => row?.id || row?.userId).filter((id: any) => typeof id === 'string');
}

export class InsightService {
  constructor(readonly options: InsightOptions) {}
  get scoped(): ScopedState { return this.options.scoped; }

  private scope(): Scope {
    const scope = this.scoped.current();
    if (!scope || scope.kind !== 'workspace' || !membership(this.scoped.raw, scope.user, scope.workspaceId)) throw new DomainError(403, 'WORKSPACE_FORBIDDEN', 'فضای کاری معتبر لازم است.');
    return scope;
  }

  /** The client's calendar day; the server's clock may sit in another time zone. */
  private today(value: any): string {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`))) return value;
    return new Date().toISOString().slice(0, 10);
  }
  private range(value: any): number { const days = Number(value); return [7, 14, 30, 90].includes(days) ? days : 7; }

  /** Visible tasks, projects, members and time entries for one read pass. */
  private data() {
    const scope = this.scope();
    return this.scoped.read(() => {
      const projects = this.scoped.rows('projects').filter((row: any) => !row.deletedAt);
      // Epics only group work, so they are not counted as work themselves.
      const tasks = this.scoped.rows('tasks').filter((row: any) => !row.deletedAt && row.type !== 'epic');
      const entries = this.scoped.rows('timeEntries');
      const workspace = this.scoped.raw.workspaces.find((row: any) => row.id === scope.workspaceId);
      const roles = new Map<string, string>((workspace?.members || []).map((row: any) => [row?.userId, String(row?.role || 'MEMBER')]));
      if (workspace?.ownerId) roles.set(workspace.ownerId, 'OWNER');
      const members = this.scoped.rows('users').filter((user: any) => activeMember(user) && membership(this.scoped.raw, user, scope.workspaceId));
      return { scope, projects, tasks, entries, members, roles, canManage: manager(membership(this.scoped.raw, scope.user, scope.workspaceId)) };
    });
  }

  private taskRef(task: any, projects: Map<string, any>, names: Map<string, string>, today: string) {
    const due = dueDay(task), entered = enteredStatusAt(task);
    return {
      id: task.id, title: task.title || '', projectId: task.projectId || '', projectTitle: projects.get(task.projectId)?.title || '',
      status: status(task), priority: String(task.priority || 'medium').toLowerCase(), dueDate: due || null,
      daysOverdue: due && isOpen(task) && due < today ? dayDiff(due, today) : 0,
      daysInStatus: entered ? Math.max(0, Math.floor((Date.now() - entered) / DAY)) : 0,
      progress: Number(task.progress) || 0,
      assignees: assigneeIds(task).map(id => ({ id, name: names.get(id) || '' })).filter(row => row.name),
    };
  }

  private projectRows(projects: any[], tasks: any[], names: Map<string, string>, today: string) {
    return projects.map(project => {
      const own = tasks.filter(task => task.projectId === project.id);
      const open = own.filter(isOpen);
      const overdue = open.filter(task => { const due = dueDay(task); return !!due && due < today; }).length;
      const blocked = open.filter(task => status(task) === 'blocked').length;
      const done = own.filter(task => status(task) === 'completed').length;
      const progress = own.length ? Math.round(own.reduce((sum, task) => sum + (status(task) === 'completed' ? 100 : Math.max(0, Math.min(100, Number(task.progress) || 0))), 0) / own.length) : Math.max(0, Math.min(100, Number(project.progress) || 0));
      const due = dueDay(project);
      const daysLeft = due ? dayDiff(today, due) : null;
      const finished = String(project.status).toUpperCase() === 'COMPLETED' || (own.length > 0 && open.length === 0);
      const health = finished ? 'done'
        // Three late or blocked tasks, or a missed deadline, put a project off track.
        : overdue + blocked >= 3 || (daysLeft !== null && daysLeft < 0) ? 'off_track'
        : overdue > 0 || blocked > 0 || (daysLeft !== null && daysLeft <= 7 && progress < 70) ? 'at_risk' : 'on_track';
      const leadId = project.teamLeadId || project.leadId || '';
      return {
        id: project.id, title: project.title || project.name || '', status: String(project.status || 'ACTIVE'), progress, health,
        totalTasks: own.length, openTasks: open.length, completedTasks: done, overdueTasks: overdue, blockedTasks: blocked,
        dueDate: due || null, daysLeft, lead: leadId && names.get(leadId) ? { id: leadId, name: names.get(leadId)! } : null,
        memberIds: [...new Set([...(Array.isArray(project.assignedMemberIds) ? project.assignedMemberIds : []), ...open.flatMap(assigneeIds)])].filter(id => names.has(id)).slice(0, 8),
      };
    });
  }

  overview(query: any) {
    const today = this.today(query?.today), range = this.range(query?.range);
    const { scope, projects, tasks, entries, members, canManage } = this.data();
    const names = new Map<string, string>(members.map((user: any) => [user.id, user.name || '']));
    const byId = new Map<string, any>(projects.map((project: any) => [project.id, project]));
    const now = Date.now(), start = now - range * DAY, previous = start - range * DAY;
    const open = tasks.filter(isOpen);
    const completed = tasks.map(task => ({ task, at: completedAt(task) })).filter(row => row.at !== undefined);
    const inRange = completed.filter(row => row.at! >= start), inPrevious = completed.filter(row => row.at! >= previous && row.at! < start);
    const judged = inRange.map(({ task, at }) => { const due = dueDay(task); return due ? new Date(at!).toISOString().slice(0, 10) <= due : undefined; }).filter((value): value is boolean => value !== undefined);
    const hours = (from: number, to: number) => Math.round(entries.filter((row: any) => { const at = stamp(row.startedAt) ?? stamp(row.createdAt); return at !== undefined && at >= from && at < to; })
      .reduce((sum: number, row: any) => sum + (Number(row.hours) || 0), 0) * 10) / 10;
    const created = (from: number, to: number) => tasks.filter(task => { const at = stamp(task.createdAt); return at !== undefined && at >= from && at < to; }).length;
    const overdue = open.filter(task => { const due = dueDay(task); return !!due && due < today; });
    const weekEnd = addDays(today, 7);
    const projectRows = this.projectRows(projects, tasks, names, today);
    const activeProjects = projectRows.filter(row => row.health !== 'done' && !['ARCHIVED', 'CANCELLED', 'CANCELED'].includes(row.status.toUpperCase()));

    // The member's own work: what is late, due today, coming up, and what waits on them.
    const mine = open.filter(task => assigneeIds(task).includes(scope.user.id));
    const ref = (task: any) => this.taskRef(task, byId, names, today);
    const sortByUrgency = (a: any, b: any) => (dueDay(a) || '9999').localeCompare(dueDay(b) || '9999') || (priorityRank[String(a.priority).toLowerCase()] ?? 2) - (priorityRank[String(b.priority).toLowerCase()] ?? 2);
    const myWork = {
      overdue: mine.filter(task => { const due = dueDay(task); return !!due && due < today; }).sort(sortByUrgency).slice(0, 8).map(ref),
      today: mine.filter(task => dueDay(task) === today).sort(sortByUrgency).slice(0, 8).map(ref),
      upcoming: mine.filter(task => { const due = dueDay(task); return !!due && due > today && due <= weekEnd; }).sort(sortByUrgency).slice(0, 8).map(ref),
      unscheduled: mine.filter(task => !dueDay(task)).length,
      // Managers approve work in review; members see their own work waiting for review.
      review: open.filter(task => status(task) === 'review' && (canManage || assigneeIds(task).includes(scope.user.id))).sort((a, b) => (enteredStatusAt(a) || 0) - (enteredStatusAt(b) || 0)).slice(0, 8).map(ref),
    };

    const statusCounts: Record<string, number> = { pending: 0, inprogress: 0, review: 0, blocked: 0, completed: 0 };
    for (const task of tasks) if (status(task) in statusCounts) statusCounts[status(task)]++;

    return {
      today, range, generatedAt: new Date(now).toISOString(), canManage,
      kpis: {
        activeProjects: activeProjects.length, totalProjects: projects.length,
        openTasks: open.length, createdInRange: created(start, now), createdPrevRange: created(previous, start),
        overdueTasks: overdue.length, dueThisWeek: open.filter(task => { const due = dueDay(task); return !!due && due >= today && due <= weekEnd; }).length,
        completedInRange: inRange.length, completedPrevRange: inPrevious.length,
        onTimeRate: judged.length ? Math.round(judged.filter(Boolean).length / judged.length * 100) : null,
        hoursInRange: hours(start, now), hoursPrevRange: hours(previous, start),
      },
      statusCounts,
      myWork,
      projects: projectRows.filter(row => row.health !== 'done').sort((a, b) => ['off_track', 'at_risk', 'on_track'].indexOf(a.health) - ['off_track', 'at_risk', 'on_track'].indexOf(b.health) || (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999)).slice(0, 8),
    };
  }

  risks(query: any) {
    const today = this.today(query?.today);
    const { projects, tasks, members, canManage } = this.data();
    const names = new Map<string, string>(members.map((user: any) => [user.id, user.name || '']));
    const byId = new Map<string, any>(projects.map((project: any) => [project.id, project]));
    const open = tasks.filter(isOpen);
    const items: any[] = [];
    for (const task of open) {
      const ref = this.taskRef(task, byId, names, today);
      const reasons: string[] = [];
      if (ref.status === 'blocked') reasons.push('blocked');
      if (ref.status === 'review' && ref.daysInStatus >= STALE_REVIEW_DAYS) reasons.push('stale_review');
      if (ref.daysOverdue > 0) reasons.push('overdue');
      if (!ref.assignees.length && ['critical', 'urgent', 'high'].includes(ref.priority)) reasons.push('unassigned');
      if (reasons.length) items.push({ ...ref, reasons, severity: reasons.includes('blocked') || ref.daysOverdue > 7 ? 'high' : reasons.includes('overdue') || reasons.includes('stale_review') ? 'medium' : 'low' });
    }
    const severityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    items.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.daysOverdue - a.daysOverdue || b.daysInStatus - a.daysInStatus);
    const age = (item: any) => Math.max(item.daysOverdue, item.reasons.includes('overdue') ? 0 : item.daysInStatus);
    const aging = { fresh: 0, week: 0, fortnight: 0, older: 0 };
    for (const item of items) { const days = age(item); if (days <= 2) aging.fresh++; else if (days <= 7) aging.week++; else if (days <= 14) aging.fortnight++; else aging.older++; }
    const people = new Map<string, { userId: string; name: string; overdue: number; blocked: number; review: number }>();
    for (const item of items) for (const assignee of item.assignees) {
      const row = people.get(assignee.id) || { userId: assignee.id, name: assignee.name, overdue: 0, blocked: 0, review: 0 };
      if (item.reasons.includes('overdue')) row.overdue++;
      if (item.reasons.includes('blocked')) row.blocked++;
      if (item.reasons.includes('stale_review')) row.review++;
      people.set(assignee.id, row);
    }
    const projectRows = this.projectRows(projects, tasks, names, today).filter(row => row.health === 'off_track' || row.health === 'at_risk')
      .sort((a, b) => (b.overdueTasks + b.blockedTasks) - (a.overdueTasks + a.blockedTasks));
    return {
      today, canManage,
      summary: {
        total: items.length,
        blocked: items.filter(item => item.reasons.includes('blocked')).length,
        staleReview: items.filter(item => item.reasons.includes('stale_review')).length,
        overdue: items.filter(item => item.reasons.includes('overdue')).length,
        unassigned: items.filter(item => item.reasons.includes('unassigned')).length,
        projectsAtRisk: projectRows.length,
      },
      aging, items: items.slice(0, 200), projects: projectRows.slice(0, 20),
      people: [...people.values()].sort((a, b) => (b.overdue + b.blocked + b.review) - (a.overdue + a.blocked + a.review)).slice(0, 10),
    };
  }

  team(query: any) {
    const today = this.today(query?.today), range = this.range(query?.range);
    const { scope, projects, tasks, entries, members, roles } = this.data();
    const now = Date.now(), start = now - range * DAY, previous = start - range * DAY;
    const lastActivity = new Map<string, string>();
    for (const row of this.scoped.raw.auditLogs || []) {
      if (row?.workspaceId !== scope.workspaceId || typeof row.userId !== 'string' || typeof row.timestamp !== 'string') continue;
      if (!lastActivity.has(row.userId) || row.timestamp > lastActivity.get(row.userId)!) lastActivity.set(row.userId, row.timestamp);
    }
    const taskOwners = new Map<string, string[]>(tasks.map((task: any) => [task.id, assigneeIds(task)]));
    const rows = members.map((user: any) => {
      const own = tasks.filter((task: any) => taskOwners.get(task.id)!.includes(user.id));
      const open = own.filter(isOpen);
      const done = own.map(task => completedAt(task)).filter((at): at is number => at !== undefined);
      const judged = own.filter(task => { const at = completedAt(task); return at !== undefined && at >= start && !!dueDay(task); })
        .map(task => new Date(completedAt(task)!).toISOString().slice(0, 10) <= dueDay(task)!);
      const hours = entries.filter((row: any) => (row.userId || row.createdById) === user.id && (stamp(row.startedAt) ?? stamp(row.createdAt) ?? 0) >= start)
        .reduce((sum: number, row: any) => sum + (Number(row.hours) || 0), 0);
      const estimated = open.reduce((sum: number, task: any) => sum + (Number(task.estimatedHours) || 0), 0);
      const overdue = open.filter(task => { const due = dueDay(task); return !!due && due < today; }).length;
      const load = open.length >= 12 || overdue >= 3 ? 'heavy' : open.length >= 5 ? 'balanced' : 'light';
      return {
        id: user.id, name: user.name || '', role: roles.get(user.id) || 'MEMBER', jobTitle: user.jobTitle || '',
        online: this.options.presence ? this.options.presence(user.id, scope.workspaceId) : false,
        open: open.length, inProgress: open.filter(task => status(task) === 'inprogress').length, review: open.filter(task => status(task) === 'review').length,
        blocked: open.filter(task => status(task) === 'blocked').length, overdue,
        completedInRange: done.filter(at => at >= start).length, completedPrevRange: done.filter(at => at >= previous && at < start).length,
        onTimeRate: judged.length ? Math.round(judged.filter(Boolean).length / judged.length * 100) : null,
        hoursInRange: Math.round(hours * 10) / 10, estimatedOpenHours: Math.round(estimated * 10) / 10,
        utilization: Math.round(Math.min(hours / (CAPACITY_HOURS * range / 7), 2) * 100),
        projects: new Set(open.map(task => task.projectId).filter(Boolean)).size,
        lastActiveAt: lastActivity.get(user.id) || null, load,
      };
    }).sort((a: any, b: any) => b.open - a.open || a.name.localeCompare(b.name, 'fa'));
    return {
      today, range, capacityHours: CAPACITY_HOURS,
      totals: {
        members: rows.length, online: rows.filter(row => row.online).length,
        open: rows.reduce((sum, row) => sum + row.open, 0), overdue: rows.reduce((sum, row) => sum + row.overdue, 0),
        completedInRange: rows.reduce((sum, row) => sum + row.completedInRange, 0), hoursInRange: Math.round(rows.reduce((sum, row) => sum + row.hoursInRange, 0) * 10) / 10,
        unassignedOpen: tasks.filter(task => isOpen(task) && !assigneeIds(task).length).length,
        heavy: rows.filter(row => row.load === 'heavy').length,
      },
      members: rows,
      projectCount: projects.length,
    };
  }
}

export function createInsightRouter(options: InsightOptions): Router {
  const router = Router(), service = new InsightService(options);
  const endpoint = (operation: (request: any) => any) => (request: any, response: any, next: any) => {
    try { response.json(operation(request)); } catch (error) { next(error); }
  };
  router.get('/insights/overview', endpoint(request => service.overview(request.query)));
  router.get('/insights/risks', endpoint(request => service.risks(request.query)));
  router.get('/insights/team', endpoint(request => service.team(request.query)));
  return router;
}
