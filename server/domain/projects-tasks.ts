import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { Repository, DomainError, identifier, now, recordActivity, type DomainContext } from './repository.ts';
import { dto, text, numeric, strings, boolean, invalid, dateFields, taskStatus, projectStatus, priority } from './models.ts';
import { manager, membership, activeMember } from '../policy/scope.ts';
import { FeedbackService } from '../portal/service.ts';
const projectFields = ['title', 'name', 'description', 'budget', 'amount', 'currency', 'clientName', 'deadline', 'dueDate', 'startDate', 'websiteUrl', 'teamLead', 'teamLeadId', 'leadId', 'assignedMemberIds', 'assignedTeamIds', 'selectedTeams', 'department', 'departmentId', 'teamId', 'organizationId', 'category', 'priority', 'status', 'statusReason', 'isConfidential', 'isBudgetConfidential'];
const taskFields = ['projectId', 'title', 'description', 'status', 'priority', 'assignedTo', 'assigneeId', 'assignedMemberIds', 'assignees', 'department', 'departmentId', 'teamId', 'clientVisible', 'deadline', 'dueDate', 'startDate', 'tags', 'dependencies', 'estimatedHours', 'loggedHours', 'subtasks', 'notes', 'category', 'attachments', 'initialComments', 'links'];
const identityCollections = new Set(['users', 'workspaces', 'userProfiles', 'userSettings', 'userSessions', 'loginHistory', 'userDevices', 'securityEvents', 'profileImages', 'userPreferences', 'userActivities', 'approvalRequests', 'approvalHistory', 'notificationQueue', 'emailQueue']);
export class ProjectTaskService {
    constructor(readonly context: DomainContext) { }
    assignmentIds(task:any):string[]{return [...new Set<string>(Array.isArray(task.assignedMemberIds)?task.assignedMemberIds:task.assigneeId?[task.assigneeId]:(task.assignees||[]).map((row:any)=>row.id))];}
    notifyAssignments(task:any,previous:string[]=[]):void{
        const recipients=this.assignmentIds(task).filter(id=>id!==this.actor().id&&!previous.includes(id));
        if(recipients.length)this.context.notify?.({workspaceId:this.scope().workspaceId,recipientIds:recipients,title:'وظیفه به شما واگذار شد',description:task.title||'وظیفه',type:'task.assigned',link:'personal_tasks',taskId:task.id,...(task.projectId?{projectId:task.projectId}:{}),actorId:this.actor().id});
    }
    repo(collection: string): Repository { return new Repository(this.context.scoped, collection); }
    scope() { const scope = this.context.scoped.current(); if (!scope || scope.kind !== 'workspace')
        throw new DomainError(403, 'WORKSPACE_FORBIDDEN', 'فضای کاری لازم است.'); return scope; }
    createInput(body: any) {
        if (body?.workspaceId !== undefined && body.workspaceId !== this.scope().workspaceId)
            throw new DomainError(422, 'WORKSPACE_CONFLICT', 'فضای کاری درخواست با دامنهٔ تأییدشده مطابقت ندارد.');
        const { workspaceId: _verifiedWorkspaceId, ...input } = body || {};
        return input;
    }
    actor() { return this.scope().user; }
    manage() { const scope = this.scope(); if (!manager(membership(this.context.scoped.raw, scope.user, scope.workspaceId)))
        throw new DomainError(403, 'FORBIDDEN', 'مجوز مدیریت لازم است.'); }
    own(row: any) { if (row.userId !== this.actor().id && !manager(membership(this.context.scoped.raw, this.actor(), this.scope().workspaceId)))
        throw new DomainError(403, 'FORBIDDEN', 'فقط نویسنده یا مدیر می‌تواند این رکورد را تغییر دهد.'); }
    member(id: string) { const user = this.repo('users').require(id); if (!activeMember(user) || !membership(this.context.scoped.raw, user, this.scope().workspaceId))
        invalid('عضو فعال این فضای کاری لازم است.'); return user; }
    history(row: any, status: string, reason = '') { if (row.status === status)
        return; row.statusHistory = [...(row.statusHistory || []), { previousStatus: row.status, newStatus: status, reason, timestamp: now(), userId: this.actor().id, username: this.actor().name }]; row.status = status; }
    emit(event: string, value: any) { this.context.broadcast(event === 'tasks_updated' ? 'app_tasks_updated' : event === 'projects_updated' ? 'app_projects_updated' : event, value); }
    change(action: string, row: any) { row.updatedAt = now(); recordActivity(this.context, action, row.id); }
    projectChanges(body: any, create = false) {
        dto(body, projectFields);
        const changes: any = {};
        if (create && body.title === undefined)
            invalid('عنوان پروژه لازم است.');
        for (const key of ['title', 'name', 'description', 'clientName', 'department', 'category'])
            if (key in body)
                changes[key] = text(body[key], key, key === 'title', key === 'description' ? 20000 : 500);
        if ('title' in body && !('name' in body))
            changes.name = changes.title;
        if ('statusReason' in body)
            text(body.statusReason, 'علت تغییر وضعیت', false, 2000);
        if ('currency' in body) {
            const currency = text(body.currency, 'واحد پول', true, 3).toUpperCase();
            if (!/^[A-Z]{3}$/.test(currency))
                invalid('کد سه‌حرفی واحد پول لازم است.');
            changes.currency = currency;
        }
        if ('budget' in body) {
            if (typeof body.budget === 'number')
                changes.budget = numeric(body.budget, 'بودجه', 1e12).toString();
            else
                changes.budget = text(body.budget, 'بودجه', false, 100);
        }
        if ('amount' in body)
            changes.amount = numeric(body.amount, 'مبلغ', 1e12);
        if ('websiteUrl' in body) {
            changes.websiteUrl = text(body.websiteUrl, 'نشانی', false, 2000);
            if (changes.websiteUrl) {
                let url: URL;
                try {
                    url = new URL(changes.websiteUrl);
                }
                catch {
                    invalid('نشانی سایت معتبر نیست.');
                }
                if (!['http:', 'https:'].includes(url!.protocol) || url!.username || url!.password)
                    invalid('نشانی سایت معتبر نیست.');
            }
        }
        for (const key of ['startDate', 'deadline', 'dueDate'])
            if (key in body)
                Object.assign(changes, dateFields(body[key], key));
        if ('dueDate' in body && !('deadline' in body))
            Object.assign(changes, dateFields(body.dueDate, 'deadline'));
        if ('deadline' in body && !('dueDate' in body))
            Object.assign(changes, dateFields(body.deadline, 'dueDate'));
        for (const key of ['isBudgetConfidential', 'isConfidential'])
            if (key in body)
                changes[key] = boolean(body[key]);
        for (const [key, collection] of Object.entries({ departmentId: 'departments', teamId: 'teams', organizationId: 'organizations' }))
            if (key in body)
                changes[key] = body[key] ? this.repo(collection).require(text(body[key], key, true, 200)).id : null;
        if ('priority' in body)
            changes.priority = priority(body.priority);
        if ('status' in body)
            changes.status = projectStatus(body.status);
        for (const key of ['assignedMemberIds', 'assignedTeamIds', 'selectedTeams'])
            if (key in body) {
                changes[key] = strings(body[key], key);
                changes[key].forEach((id: string) => key === 'assignedMemberIds' ? this.member(id) : this.repo('teams').require(id));
            }
        let leadId = body.teamLeadId ?? body.leadId;
        if (leadId === undefined && 'teamLead' in body) {
            const label = text(body.teamLead, 'سرپرست', false, 500);
            const local = this.repo('users').find(label);
            if (local) leadId = local.id;
            else if (this.context.scoped.raw.users.some((user: any) => user.id === label))
                throw new DomainError(404, 'RESOURCE_NOT_FOUND', 'عضو در این فضای کاری یافت نشد.');
            else {
                // A legacy display label is text, never an identity or grant.
                changes.teamLead = label;
                changes.teamLeadId = '';
                changes.leadId = '';
            }
        }
        if (leadId !== undefined) {
            const lead = leadId ? this.member(text(leadId, 'شناسه', true, 200)) : null;
            changes.teamLeadId = lead?.id || '';
            changes.leadId = changes.teamLeadId;
            changes.teamLead = lead?.name || '';
        }
        return changes;
    }
    createProject(body: any) { this.manage(); body = this.createInput(body); const changes = this.projectChanges(body, true); const token = randomBytes(32).toString('hex'); const project = this.repo('projects').insert({ id: identifier('proj'), workspaceId: this.scope().workspaceId, createdById: this.actor().id, createdAt: now(), description: '', name: changes.title, deadline: '', budget: '', clientName: '', status: 'ACTIVE', assignedMemberIds: [], assignedTeamIds: [], totalTasks: 0, completedTasks: 0, progress: 0, loggedHours: 0, clientPortalEnabled: true, isPortalActive: true, clientPortalToken: token, portalToken: token, portalExpiresAt: new Date(Date.now() + 30 * 86400_000).toISOString(), portalRevokedAt: null, ...changes }); this.change('PROJECT_CREATED', project); this.emit('projects_updated', this.projects()); return project; }
    updateProject(id: string, body: any) { this.manage(); const row = this.repo('projects').require(id), changes = this.projectChanges(body); const status = changes.status; delete changes.status; Object.assign(row, changes); if (status)
        this.history(row, status, body.statusReason || ''); this.change('PROJECT_UPDATED', row); this.emit('projects_updated', this.projects()); return row; }
    activateProject(id: string) { this.manage(); const row = this.repo('projects').require(id); this.history(row, 'ACTIVE'); if (!row.startDate)
        Object.assign(row, dateFields(now(), 'startDate')); this.change('PROJECT_ACTIVATED', row); return row; }
    tasks(projectId?: string) { if (projectId)
        this.repo('projects').require(projectId); return this.repo('tasks').all().filter(task => !projectId || task.projectId === projectId).map(task => this.taskView(task)); }
    projects() { const feedback = new FeedbackService(this.context.scoped.raw, this.context.scoped); return this.repo('projects').all().map(project => { const tasks = this.repo('tasks').all().filter(task => task.projectId === project.id); return { ...project, clientFeedbacks: feedback.privateList(project), totalTasks: tasks.length, completedTasks: tasks.filter(task => this.complete(task.status)).length, progress: tasks.length ? Math.round(tasks.reduce((sum, task) => sum + this.taskProgress(task), 0) / tasks.length) : 0, loggedHours: tasks.reduce((sum, task) => sum + this.hours(task.id), 0) }; }); }
    complete(status: string) { return ['completed', 'COMPLETED'].includes(status); }
    hours(taskId: string) { const entries = this.repo('timeEntries').all().filter(entry => entry.taskId === taskId); const legacy = Number(this.repo('tasks').find(taskId)?.loggedHours) || 0; return Math.round((entries.length ? entries.reduce((sum, entry) => sum + entry.hours, 0) : legacy) * 1000000) / 1000000; }
    preserveLegacyHours(taskId: string) { const entries = this.timeEntries(taskId); if (!entries.length) {
        const legacy = Number(this.repo('tasks').require(taskId).loggedHours) || 0;
        if (legacy > 0)
            this.repo('timeEntries').insert({ id: identifier('time'), taskId, projectId: this.repo('tasks').require(taskId).projectId, createdById: this.actor().id, hours: legacy, note: 'مجموع زمان موجود پیش از ثبت جزئیات', kind: 'legacy_baseline', createdAt: now() });
    } }
    taskProgress(task: any) { const subs = this.repo('subtasks').all().filter(sub => sub.taskId === task.id); return subs.length ? Math.round(100 * subs.filter(sub => sub.completed).length / subs.length) : this.complete(task.status) ? 100 : Math.max(0, Math.min(100, Number(task.progress) || 0)); }
    taskView(task: any) {
        const comments = this.repo('comments').all().filter(comment => comment.taskId === task.id);
        const ids: string[] = Array.isArray(task.assignedMemberIds) ? task.assignedMemberIds : task.assigneeId ? [task.assigneeId] : (Array.isArray(task.assignees) ? task.assignees : []).map((user: any) => user.id);
        const assignees = [...new Set(ids)].map(id => this.repo('users').find(id)).filter(user => user && activeMember(user) && membership(this.context.scoped.raw, user, this.scope().workspaceId)).map(user => ({id: user.id, name: user.name, avatar: user.avatar || ''}));
        return {
            ...task,
            assignees,
            subtasks: this.repo('subtasks').all().filter(sub => sub.taskId === task.id),
            comments,
            commentsCount: comments.length,
            timeEntries: this.timeEntries(task.id),
            linksCount: Array.isArray(task.links) ? task.links.length : 0,
            loggedHours: this.hours(task.id),
            progress: this.taskProgress(task),
        };
    }
    counters(projectId: string) {
        const {raw} = this.context.scoped, workspaceId = this.scope().workspaceId;
        const project = raw.projects.find((row: any) => row.id === projectId && this.context.scoped.scopeOf('projects', row) === workspaceId);
        if (!project) throw new DomainError(404, 'RESOURCE_NOT_FOUND', 'پروژه در این فضای کاری یافت نشد.');
        // Canonical counters must include every valid child in the workspace.
        // A caller's narrower department read grant only affects response views.
        const tasks = raw.tasks.filter((task: any) => task.projectId === projectId && this.context.scoped.scopeOf('tasks', task) === workspaceId);
        const taskValues = tasks.map((task: any) => {
            const subs = raw.subtasks.filter((sub: any) => sub.taskId === task.id && this.context.scoped.scopeOf('subtasks', sub) === workspaceId);
            const entries = raw.timeEntries.filter((entry: any) => entry.taskId === task.id && this.context.scoped.scopeOf('timeEntries', entry) === workspaceId);
            const progress = subs.length ? Math.round(100 * subs.filter((sub: any) => sub.completed).length / subs.length) : this.complete(task.status) ? 100 : Math.max(0, Math.min(100, Number(task.progress) || 0));
            const hours = entries.length ? entries.reduce((sum: number, entry: any) => sum + (Number(entry.hours) || 0), 0) : Number(task.loggedHours) || 0;
            return {progress, hours};
        });
        Object.assign(project, {
            totalTasks: tasks.length,
            completedTasks: tasks.filter((task: any) => this.complete(task.status)).length,
            progress: tasks.length ? Math.round(taskValues.reduce((sum: number, value: any) => sum + value.progress, 0) / tasks.length) : 0,
            loggedHours: Math.round(taskValues.reduce((sum: number, value: any) => sum + value.hours, 0) * 1000000) / 1000000,
        });
    }
    taskChanges(body: any, taskId?: string) {
        dto(body, taskFields);
        const changes: any = {};
        if (!taskId && (body.title === undefined || body.projectId === undefined))
            invalid('عنوان و پروژه لازم است.');
        for (const key of ['title', 'description', 'department', 'notes', 'category'])
            if (key in body)
                changes[key] = text(body[key], key, key === 'title', ['description', 'notes'].includes(key) ? 20000 : 500);
        if ('projectId' in body)
            changes.projectId = this.repo('projects').require(text(body.projectId, 'شناسه پروژه', true, 200)).id;
        if ('clientVisible' in body)
            changes.clientVisible = boolean(body.clientVisible);
        for (const [key, collection] of Object.entries({ departmentId: 'departments', teamId: 'teams' }))
            if (key in body)
                changes[key] = body[key] ? this.repo(collection).require(text(body[key], key, true, 200)).id : null;
        if ('status' in body)
            changes.status = taskStatus(body.status);
        if ('priority' in body)
            changes.priority = priority(body.priority);
        for (const key of ['startDate', 'deadline', 'dueDate'])
            if (key in body)
                Object.assign(changes, dateFields(body[key], key));
        if ('deadline' in body && !('dueDate' in body))
            Object.assign(changes, dateFields(body.deadline, 'dueDate'));
        if ('dueDate' in body && !('deadline' in body))
            Object.assign(changes, dateFields(body.dueDate, 'deadline'));
        if ('estimatedHours' in body)
            changes.estimatedHours = numeric(body.estimatedHours, 'زمان برآورد', 100000);
        if ('loggedHours' in body)
            numeric(body.loggedHours, 'زمان کار', 100000);
        if ('tags' in body)
            changes.tags = strings(body.tags, 'برچسب‌ها', 50);
        if ('initialComments' in body) {
            if (taskId)
                invalid('نظرهای اولیه فقط هنگام ایجاد وظیفه مجازند.');
            if (!Array.isArray(body.initialComments) || body.initialComments.length > 100)
                invalid('نظرها معتبر نیستند.');
            body.initialComments.forEach((content: any) => text(content, 'نظر', true, 20000));
        }
        if ('links' in body) {
            changes.links = strings(body.links, 'پیوندها', 100);
            for (const value of changes.links) {
                let url: URL;
                try {
                    url = new URL(value);
                }
                catch {
                    invalid('نشانی پیوند معتبر نیست.');
                }
                if (!['http:', 'https:'].includes(url!.protocol) || url!.username || url!.password)
                    invalid('نشانی پیوند معتبر نیست.');
            }
            changes.linksCount = changes.links.length;
        }
        if ('dependencies' in body) {
            changes.dependencies = strings(body.dependencies, 'وابستگی‌ها');
            const graph = new Map(this.repo('tasks').all().map(task => [task.id, task.dependencies || []]));
            const identity = taskId || '__new__';
            graph.set(identity, changes.dependencies);
            changes.dependencies.forEach((id: string) => this.repo('tasks').require(id));
            const done = new Set<string>();
            const visit = (id: string, path = new Set<string>()) => { if (path.has(id))
                invalid('وابستگی دوری مجاز نیست.'); if (done.has(id))
                return; const next = new Set(path); next.add(id); for (const dependency of graph.get(id) || [])
                visit(dependency, next); done.add(id); };
            visit(identity);
        }
        let memberIds: string[] | undefined;
        if ('assignedMemberIds' in body)
            memberIds = strings(body.assignedMemberIds, 'مسئولان');
        else if ('assignees' in body) {
            if (!Array.isArray(body.assignees) || body.assignees.length > 100)
                invalid('مسئولان معتبر نیستند.');
            memberIds = strings(body.assignees.map((item: any) => typeof item === 'string' ? item : item?.id), 'مسئولان');
        }
        else if ('assigneeId' in body)
            memberIds = body.assigneeId ? [text(body.assigneeId, 'مسئول', true, 200)] : [];
        else if ('assignedTo' in body) {
            const value = text(body.assignedTo, 'مسئول', false, 500);
            const matching = this.repo('users').all().filter(user => user.id === value || user.name === value);
            if (value && matching.length !== 1)
                invalid('مسئول باید یک عضو مشخص باشد.');
            memberIds = matching.map(user => user.id);
        }
        if (memberIds) {
            const users = memberIds.map(id => this.member(id));
            changes.assignedMemberIds = memberIds;
            changes.assigneeId = users[0]?.id || '';
            changes.assignedTo = users.map(user => user.name).join('، ');
            changes.assignees = users.map(user => ({ id: user.id, name: user.name, avatar: user.avatar || '' }));
        }
        if ('attachments' in body) {
            if (!Array.isArray(body.attachments) || body.attachments.length > 50)
                invalid('فایل‌ها معتبر نیستند.');
            changes.attachments = body.attachments.map((item: any) => { const id = typeof item === 'string' ? item : item?.id; const file = this.repo('files').require(text(id, 'شناسه فایل', true, 200)); const projectId = changes.projectId || this.repo('tasks').find(taskId || '')?.projectId; if (file.projectId && file.projectId !== projectId)
                invalid('فایل متعلق به پروژهٔ دیگری است.'); return { id: file.id, name: file.name || file.title || '', size: file.size || '', type: file.type || '', url: file.url || '' }; });
        }
        if ('subtasks' in body)
            this.validateSubtasks(body.subtasks, taskId);
        return changes;
    }
    validateSubtasks(value: any, taskId?: string) { if (!Array.isArray(value) || value.length > 200)
        invalid('زیرکارها معتبر نیستند.'); const ids = new Set(); for (const item of value) {
        dto(item, ['id', 'title', 'note', 'completed']);
        text(item.title, 'عنوان زیرکار', true, 500);
        if (item.note !== undefined)
            text(item.note, 'یادداشت', false, 10000);
        if (item.completed !== undefined)
            boolean(item.completed);
        if (item.id) {
            text(item.id, 'شناسه', true, 200);
            if (ids.has(item.id))
                invalid('شناسه زیرکار تکراری است.');
            ids.add(item.id);
            const existing = this.repo('subtasks').find(item.id);
            if (existing && existing.taskId !== taskId)
                invalid('زیرکار متعلق به وظیفهٔ دیگری است.');
            if (!existing && taskId && this.context.scoped.raw.subtasks.some((row: any) => row.id === item.id))
                invalid('شناسه زیرکار مجاز نیست.');
        }
    } }
    replaceSubtasks(taskId: string, input: any[]) { const originals = this.repo('subtasks').all().filter(sub => sub.taskId === taskId); const retained = new Set<string>(); for (const draft of input) {
        const original = originals.find(sub => sub.id === draft.id);
        if (original) {
            Object.assign(original, { title: text(draft.title, 'عنوان', true, 500), note: draft.note || '', completed: draft.completed || false, updatedAt: now() });
            retained.add(original.id);
        }
        else {
            const row = this.repo('subtasks').insert({ id: identifier('sub'), taskId, title: draft.title.trim(), note: draft.note || '', completed: draft.completed || false, createdById: this.actor().id, createdAt: now() });
            retained.add(row.id);
        }
    } this.repo('subtasks').removeWhere(sub => sub.taskId === taskId && !retained.has(sub.id)); }
    adjustHours(taskId: string, total: number) { const difference = total - this.hours(taskId); if (Math.abs(difference) < 1e-8)
        return; if (this.timeEntries(taskId).some(entry => entry.userId && entry.userId !== this.actor().id))
        this.manage(); this.preserveLegacyHours(taskId); this.repo('timeEntries').insert({ id: identifier('time'), taskId, projectId: this.repo('tasks').require(taskId).projectId, userId: this.actor().id, hours: difference, note: 'اصلاح مجموع زمان ثبت‌شده', kind: 'adjustment', createdAt: now() }); }
    assertCompletion(task: any, subtasks?: any[]) { if (!this.complete(task.status))
        return; if ((task.dependencies || []).some((dependency: string) => !this.complete(this.repo('tasks').require(dependency).status)))
        throw new DomainError(409, 'DEPENDENCY_INCOMPLETE', 'ابتدا وظایف وابسته را تکمیل کنید.'); const subs = subtasks ?? this.repo('subtasks').all().filter(sub => sub.taskId === task.id); if (subs.some(sub => !sub.completed))
        throw new DomainError(409, 'SUBTASK_INCOMPLETE', 'زیرکار باز باقی مانده است.'); }
    createTask(body: any) { body = this.createInput(body); const changes = this.taskChanges(body); this.assertCompletion({ ...changes }, body.subtasks || []); const task = this.repo('tasks').insert({ id: identifier('task'), createdById: this.actor().id, creatorId: this.actor().id, createdAt: now(), description: '', priority: 'medium', status: 'pending', deadline: '', tags: [], attachments: [], dependencies: [], assignedMemberIds: [], assignees: [], estimatedHours: 0, progress: 0, ...changes }); if (body.subtasks)
        this.replaceSubtasks(task.id, body.subtasks); if (body.loggedHours !== undefined)
        this.adjustHours(task.id, body.loggedHours); this.refreshTask(task, !!body.subtasks); for (const content of body.initialComments || [])
        this.comment(task.id, undefined, { content }); this.change('TASK_CREATED', task); this.notifyAssignments(task); this.emit('tasks_updated', this.tasks()); this.emit('projects_updated', this.projects()); return this.taskView(task); }
    updateTask(id: string, body: any) { const task = this.repo('tasks').require(id), oldAssigned=this.assignmentIds(task), oldProject = task.projectId, changes = this.taskChanges(body, id); this.assertCompletion({ ...task, ...changes }, body.subtasks); const status = changes.status; delete changes.status; Object.assign(task, changes); if (status) {
        this.history(task, status);
        if (!this.subtasks(id).length)
            task.progress = status === 'completed' ? 100 : 0;
    } if (body.subtasks)
        this.replaceSubtasks(id, body.subtasks); if (body.loggedHours !== undefined)
        this.adjustHours(id, body.loggedHours); if (oldProject !== task.projectId) {
        for (const collection of Object.keys(this.context.scoped.raw))
            if (Array.isArray(this.context.scoped.raw[collection]))
                for (const child of this.repo(collection).all())
                    if (child.taskId === id && child.projectId)
                        child.projectId = task.projectId;
        this.counters(oldProject);
    } this.refreshTask(task, body.subtasks !== undefined); this.change('TASK_UPDATED', task); this.notifyAssignments(task,oldAssigned); this.emit('tasks_updated', this.tasks()); this.emit('projects_updated', this.projects()); return this.taskView(task); }
    refreshTask(task: any, subtaskChanged = true) { const subs = this.repo('subtasks').all().filter(sub => sub.taskId === task.id); if (subtaskChanged && subs.length) {
        const all = subs.every(sub => sub.completed);
        if (all && !this.complete(task.status) && (task.dependencies || []).every((id: string) => this.complete(this.repo('tasks').require(id).status)))
            this.history(task, 'completed', 'همهٔ زیرکارها انجام شدند.');
        else if (!all && this.complete(task.status))
            this.history(task, 'inprogress', 'زیرکار باز شد.');
    } task.progress = this.taskProgress(task); task.loggedHours = this.hours(task.id); task.commentsCount = this.repo('comments').all().filter(comment => comment.taskId === task.id).length; this.counters(task.projectId); }
    setStatus(id: string, body: any) { dto(body, ['status', 'reason']); const task = this.repo('tasks').require(id); const status = taskStatus(body.status); const reason = body.reason === undefined ? '' : text(body.reason, 'علت', false, 2000); if (status === 'completed' && (task.dependencies || []).some((dependency: string) => !this.complete(this.repo('tasks').require(dependency).status)))
        throw new DomainError(409, 'DEPENDENCY_INCOMPLETE', 'ابتدا وظایف وابسته را تکمیل کنید.'); if (status === 'completed' && this.repo('subtasks').all().some(sub => sub.taskId === id && !sub.completed))
        throw new DomainError(409, 'SUBTASK_INCOMPLETE', 'زیرکار باز باقی مانده است.'); this.history(task, status, reason); if (!this.repo('subtasks').all().some(sub => sub.taskId === id))
        task.progress = status === 'completed' ? 100 : 0; this.refreshTask(task, false); this.change('TASK_STATUS_CHANGED', task); this.emit('tasks_updated', this.tasks()); this.emit('projects_updated', this.projects()); return this.taskView(task); }
    cascade(kind: 'task' | 'project', id: string) {
        const removed = new Map<string, Set<string>>();
        const include = (collection: string, row: any) => { const set = removed.get(collection) || new Set(); set.add(row.id); removed.set(collection, set); };
        include(kind === 'task' ? 'tasks' : 'projects', this.repo(kind === 'task' ? 'tasks' : 'projects').require(id));
        const targets: Record<string, string> = { projectId: 'projects', taskId: 'tasks', parentTaskId: 'tasks', conversationId: 'conversations', messageId: 'messages', moduleInstanceId: 'moduleInstances', sessionId: 'userSessions', fileId: 'files', siteId: 'wpSites', jobId: 'jobs' };
        let again = true;
        while (again) {
            again = false;
            for (const [collection, rows] of Object.entries(this.context.scoped.raw))
                if (Array.isArray(rows))
                    for (const row of rows) {
                        if (removed.get(collection)?.has(row.id))
                            continue;
                        if (Object.entries(targets).some(([field, target]) => row[field] && removed.get(target)?.has(row[field]))) {
                            if (identityCollections.has(collection))
                                throw new DomainError(409, 'UNSAFE_LEGACY_RELATION', 'رابطهٔ قدیمی به اطلاعات هویتی مانع حذف است؛ حذف پروژه نباید حساب یا نشست را حذف کند.');
                            if (this.context.scoped.scopeOf(collection, row) !== this.scope().workspaceId)
                                throw new DomainError(409, 'UNSAFE_LEGACY_RELATION', 'رابطهٔ خارج از دامنه مانع حذف است؛ ابتدا دادهٔ قدیمی را اصلاح کنید.');
                            include(collection, row);
                            again = true;
                        }
                    }
        }
        const removedTaskIds = removed.get('tasks') || new Set();
        for (const task of this.context.scoped.raw.tasks)
            if (!removedTaskIds.has(task.id) && Array.isArray(task.dependencies) && task.dependencies.some((dependency: string) => removedTaskIds.has(dependency)) && !this.context.scoped.visible('tasks', task))
                throw new DomainError(409, 'UNSAFE_LEGACY_RELATION', 'وابستگی خارج از دامنه مانع حذف است.');
        for (const task of this.repo('tasks').all())
            if (!removedTaskIds.has(task.id) && Array.isArray(task.dependencies))
                task.dependencies = task.dependencies.filter((dependency: string) => !removedTaskIds.has(dependency));
        const removedFileIds = removed.get('files') || new Set();
        for(const message of this.context.scoped.raw.messages)if(!removed.get('messages')?.has(message.id)&&Array.isArray(message.attachments)&&message.attachments.some((file:any)=>removedFileIds.has(typeof file==='string'?file:file.id)))
            throw new DomainError(409,'ASSET_USED_IN_CHAT','فایل این پروژه در گفتگوی دیگری استفاده شده است؛ ابتدا ارتباط آن را بررسی کنید.');
        for (const task of this.repo('tasks').all())
            if (!removedTaskIds.has(task.id) && Array.isArray(task.attachments))
                task.attachments = task.attachments.filter((file: any) => !removedFileIds.has(typeof file === 'string' ? file : file.id));
        const affectedProjects = new Set<string>(this.context.scoped.raw.tasks.filter((task: any) => removedTaskIds.has(task.id) && this.context.scoped.scopeOf('tasks', task) === this.scope().workspaceId).map((task: any) => task.projectId));
        // Internal cascade owns these validated business children, including another
        // recipient's notification. They are never exposed to the deleting actor.
        for (const [collection, ids] of removed)
            this.context.scoped.raw[collection] = this.context.scoped.raw[collection].filter((row: any) => !ids.has(row.id));
        for (const projectId of affectedProjects)
            if (this.context.scoped.raw.projects.some((project: any) => project.id === projectId && this.context.scoped.scopeOf('projects', project) === this.scope().workspaceId))
                this.counters(projectId);
    }
    deleteTask(id: string) { const task = this.repo('tasks').require(id); const projectId = task.projectId; this.cascade('task', id); this.counters(projectId); recordActivity(this.context, 'TASK_DELETED', id); this.emit('tasks_updated', this.tasks()); this.emit('projects_updated', this.projects()); return { success: true, deletedId: id }; }
    deleteProject(id: string) { this.manage(); this.cascade('project', id); recordActivity(this.context, 'PROJECT_DELETED', id); this.emit('projects_updated', this.projects()); this.emit('tasks_updated', this.tasks()); return { success: true, deletedId: id }; }
    milestones(projectId: string) { this.repo('projects').require(projectId); return this.repo('milestones').all().filter(row => row.projectId === projectId); }
    milestone(projectId: string | undefined, id: string | undefined, body: any) {
        this.manage();
        dto(body, ['title', 'description', 'deadline', 'dueDate', 'status', 'completed']);
        let row = id ? this.repo('milestones').require(id) : null;
        const changes: any = {};
        if (!row && body.title === undefined) invalid('عنوان لازم است.');
        for (const key of ['title', 'description']) if (key in body)
            changes[key] = text(body[key], key, key === 'title', key === 'description' ? 20000 : 500);
        if ('deadline' in body || 'dueDate' in body) {
            if ('deadline' in body && 'dueDate' in body && body.deadline !== body.dueDate) invalid('موعدهای مایلستون باید یکسان باشند.');
            const date = body.deadline ?? body.dueDate;
            Object.assign(changes, dateFields(date, 'deadline'), dateFields(date, 'dueDate'));
        }
        if ('status' in body) {
            const status = String(body.status).toLowerCase();
            if (!['pending', 'inprogress', 'completed', 'cancelled'].includes(status)) invalid('وضعیت مایلستون معتبر نیست.');
            changes.status = status;
            changes.completed = status === 'completed';
        }
        if ('completed' in body) {
            const completed = boolean(body.completed);
            if ('status' in body && completed !== changes.completed) invalid('وضعیت مایلستون با تکمیل آن همخوانی ندارد.');
            changes.completed = completed;
            if (!('status' in body)) changes.status = completed ? 'completed' : 'pending';
        }
        if (!row) {
            this.repo('projects').require(projectId!);
            row = this.repo('milestones').insert({ id: identifier('ms'), projectId, createdById: this.actor().id, createdAt: now(), status: 'pending', completed: false, description: '', deadline: '', dueDate: '', ...changes });
        } else Object.assign(row, changes);
        this.change(id ? 'MILESTONE_UPDATED' : 'MILESTONE_CREATED', row);
        return row;
    }
    subtasks(taskId: string) { this.repo('tasks').require(taskId); return this.repo('subtasks').all().filter(row => row.taskId === taskId); }
    subtask(taskId: string | undefined, id: string | undefined, body: any) { dto(body, ['title', 'note', 'completed']); let row = id ? this.repo('subtasks').require(id) : null; if (!row && body.title === undefined)
        invalid('عنوان لازم است.'); const changes: any = {}; if ('title' in body)
        changes.title = text(body.title, 'عنوان', true, 500); if ('note' in body)
        changes.note = text(body.note, 'یادداشت', false, 10000); if ('completed' in body)
        changes.completed = boolean(body.completed); if (!row) {
        this.repo('tasks').require(taskId!);
        row = this.repo('subtasks').insert({ id: identifier('sub'), taskId, createdById: this.actor().id, createdAt: now(), completed: false, ...changes });
    }
    else
        Object.assign(row, changes); this.refreshTask(this.repo('tasks').require(row.taskId)); this.change(id ? 'SUBTASK_UPDATED' : 'SUBTASK_CREATED', row); this.emit('tasks_updated', this.tasks()); this.emit('projects_updated', this.projects()); return row; }
    deleteSubtask(id: string) { const row = this.repo('subtasks').require(id), task = this.repo('tasks').require(row.taskId); this.repo('subtasks').remove(id); if (!this.subtasks(task.id).length && !this.complete(task.status))
        task.progress = 0; this.refreshTask(task); this.change('SUBTASK_DELETED', task); this.emit('tasks_updated', this.tasks()); this.emit('projects_updated', this.projects()); return { success: true, deletedId: id }; }
    comments(taskId: string) { this.repo('tasks').require(taskId); return this.repo('comments').all().filter(row => row.taskId === taskId); }
    comment(taskId: string | undefined, id: string | undefined, body: any) { dto(body, ['content']); const content = text(body.content, 'نظر', true, 20000); let row = id ? this.repo('comments').require(id) : null; if (row) {
        this.own(row);
        row.content = content;
        row.updatedAt = now();
    }
    else {
        this.repo('tasks').require(taskId!);
        row = this.repo('comments').insert({ id: identifier('comm'), taskId, userId: this.actor().id, userName: this.actor().name, content, timestamp: now(), createdAt: now() });
    } this.refreshTask(this.repo('tasks').require(row.taskId), false); this.change(id ? 'COMMENT_UPDATED' : 'COMMENT_CREATED', row); return row; }
    deleteComment(id: string) { const row = this.repo('comments').require(id); this.own(row); this.repo('comments').remove(id); this.refreshTask(this.repo('tasks').require(row.taskId), false); recordActivity(this.context, 'COMMENT_DELETED', id); return { success: true, deletedId: id }; }
    timeEntries(taskId: string) { this.repo('tasks').require(taskId); return this.repo('timeEntries').all().filter(row => row.taskId === taskId); }
    timeEntry(taskId: string | undefined, id: string | undefined, body: any) {
        dto(body, ['hours', 'note', 'startedAt', 'endedAt']);
        let row = id ? this.repo('timeEntries').require(id) : null;
        if (row) {
            this.own(row);
            if (row.kind !== 'work')
                throw new DomainError(409, 'ADJUSTMENT_IMMUTABLE', 'اصلاح زمان را از مجموع زمان وظیفه انجام دهید.');
        }
        if (!row && body.hours === undefined)
            invalid('زمان لازم است.');
        const changes: any = {};
        if ('hours' in body) {
            changes.hours = numeric(body.hours, 'ساعت', 10000);
            if (!changes.hours)
                invalid('زمان باید مثبت باشد.');
        }
        if ('note' in body)
            changes.note = text(body.note, 'یادداشت', false, 10000);
        for (const key of ['startedAt', 'endedAt'])
            if (key in body) {
                const normalized = dateFields(body[key], key);
                if (!normalized[`${key}Canonical`] || !normalized[`${key}Canonical`].includes('T'))
                    invalid('زمان شروع و پایان باید ISO همراه منطقهٔ زمانی باشد.');
                Object.assign(changes, normalized);
            }
        const start = changes.startedAtCanonical ?? row?.startedAtCanonical, end = changes.endedAtCanonical ?? row?.endedAtCanonical;
        if (start && end && new Date(start).getTime() >= new Date(end).getTime())
            invalid('زمان پایان باید پس از شروع باشد.');
        if (row && changes.hours !== undefined && this.hours(row.taskId) - row.hours + changes.hours < 0)
            throw new DomainError(409, 'NEGATIVE_TOTAL_HOURS', 'ابتدا اصلاح مجموع زمان را بازبینی کنید.');
        if (!row) {
            const task = this.repo('tasks').require(taskId!);
            this.preserveLegacyHours(task.id);
            row = this.repo('timeEntries').insert({ id: identifier('time'), taskId, projectId: task.projectId, userId: this.actor().id, kind: 'work', createdAt: now(), note: '', ...changes });
        }
        else
            Object.assign(row, changes);
        this.change(id ? 'TIME_ENTRY_UPDATED' : 'TIME_ENTRY_CREATED', row);
        this.refreshTask(this.repo('tasks').require(row.taskId), false);
        this.emit('tasks_updated', this.tasks());
        this.emit('projects_updated', this.projects());
        return row;
    }
    deleteTimeEntry(id: string) { const row = this.repo('timeEntries').require(id); this.own(row); if (row.kind !== 'work')
        throw new DomainError(409, 'ADJUSTMENT_IMMUTABLE', 'اصلاح زمان را از مجموع زمان وظیفه انجام دهید.'); if (this.hours(row.taskId) - row.hours < 0)
        throw new DomainError(409, 'NEGATIVE_TOTAL_HOURS', 'ابتدا اصلاح مجموع زمان را بازبینی کنید.'); this.repo('timeEntries').remove(id); const task = this.repo('tasks').require(row.taskId); if (!this.timeEntries(task.id).length)
        task.loggedHours = 0; this.refreshTask(task, false); recordActivity(this.context, 'TIME_ENTRY_DELETED', id); this.emit('tasks_updated', this.tasks()); this.emit('projects_updated', this.projects()); return { success: true, deletedId: id }; }
}
export function createProjectTaskRouter(context: DomainContext) {
    const router = Router(), service = new ProjectTaskService(context);
    const endpoint = (fn: (req: any) => any, status = 200) => (req: any, res: any, next: any) => { try {
        res.status(status).json(fn(req));
    }
    catch (error) {
        next(error);
    } };
    router.get('/projects', endpoint(() => service.projects()));
    router.get('/projects/:id', endpoint(req => { service.repo('projects').require(req.params.id); return service.projects().find(row => row.id === req.params.id); }));
    router.post('/projects', endpoint(req => service.createProject(req.body), 201));
    router.put('/projects/:id', endpoint(req => ({ success: true, project: service.updateProject(req.params.id, req.body) })));
    router.delete('/projects/:id', endpoint(req => service.deleteProject(req.params.id)));
    router.put('/projects/:id/activate', endpoint(req => ({ success: true, project: service.activateProject(req.params.id) })));
    router.get('/projects/:projectId/milestones', endpoint(req => service.milestones(req.params.projectId)));
    router.post('/projects/:projectId/milestones', endpoint(req => service.milestone(req.params.projectId, undefined, req.body), 201));
    router.put('/milestones/:id', endpoint(req => service.milestone(undefined, req.params.id, req.body)));
    router.delete('/milestones/:id', endpoint(req => { service.manage(); service.repo('milestones').remove(req.params.id); recordActivity(context, 'MILESTONE_DELETED', req.params.id); return { success: true, deletedId: req.params.id }; }));
    router.get('/tasks', endpoint(req => service.tasks(req.query.projectId)));
    router.get('/tasks/:id', endpoint(req => service.taskView(service.repo('tasks').require(req.params.id))));
    router.post('/tasks', endpoint(req => service.createTask(req.body), 201));
    router.put('/tasks/:id', endpoint(req => service.updateTask(req.params.id, req.body)));
    router.put('/tasks/:id/status', endpoint(req => service.setStatus(req.params.id, req.body)));
    router.delete('/tasks/:id', endpoint(req => service.deleteTask(req.params.id)));
    router.get('/tasks/:taskId/subtasks', endpoint(req => service.subtasks(req.params.taskId)));
    router.post('/tasks/:taskId/subtasks', endpoint(req => service.subtask(req.params.taskId, undefined, req.body), 201));
    router.put('/subtasks/:id', endpoint(req => service.subtask(undefined, req.params.id, req.body)));
    router.delete('/subtasks/:id', endpoint(req => service.deleteSubtask(req.params.id)));
    router.get('/tasks/:taskId/comments', endpoint(req => service.comments(req.params.taskId)));
    router.post('/tasks/:taskId/comments', endpoint(req => service.comment(req.params.taskId, undefined, req.body), 201));
    router.put('/comments/:id', endpoint(req => service.comment(undefined, req.params.id, req.body)));
    router.delete('/comments/:id', endpoint(req => service.deleteComment(req.params.id)));
    router.get('/tasks/:taskId/time-entries', endpoint(req => service.timeEntries(req.params.taskId)));
    router.post('/tasks/:taskId/time-entries', endpoint(req => { const entry = service.timeEntry(req.params.taskId, undefined, req.body); return { entry, task: service.taskView(service.repo('tasks').require(entry.taskId)) }; }, 201));
    router.put('/time-entries/:id', endpoint(req => { const entry = service.timeEntry(undefined, req.params.id, req.body); return { entry, task: service.taskView(service.repo('tasks').require(entry.taskId)) }; }));
    router.delete('/time-entries/:id', endpoint(req => service.deleteTimeEntry(req.params.id)));
    return router;
}
