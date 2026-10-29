const definition = (method: string, path: string, fields: string[] = []) => ({ method, path, fields });
const project = ['title','name','description','budget','amount','currency','clientName','deadline','dueDate','startDate','websiteUrl','teamLead','teamLeadId','leadId','assignedMemberIds','assignedTeamIds','selectedTeams','department','departmentId','teamId','organizationId','category','priority','status','statusReason','isBudgetConfidential','isConfidential'];
const task = ['projectId','title','description','status','priority','assignedTo','assigneeId','assignedMemberIds','assignees','department','departmentId','teamId','deadline','dueDate','startDate','tags','dependencies','estimatedHours','estimate','loggedHours','subtasks','notes','category','attachments','links','clientVisible'];
const organization = ['name','plan','billingCycle','slug'];
const team = ['name','description','departmentId','organizationId','leaderId','memberIds','color','avatar','customFields','roadmap'];
const department = ['name','icon','color','description','leaderId','order','organizationId'];
const module = ['name','icon','color','description','structure','isActive'];
const instance = ['definitionId','departmentId','organizationId','name','config'];
const checklist = ['projectId','name','category','ownerId','assigneeId','owner','assignedTo','dueDate','notes','priority','status','progress'];
const content = ['projectId','pageName','writerId','reviewerId','writer','reviewer','deadline','status','approvalStatus','contentBody','attachments'];
const qa = ['projectId','title','description','category','priority','severity','assigneeId','assignedTo','status','fixVersion'];
const nav = ['name','order','icon','path','groupId','moduleId'];
export const domainContracts = [
  definition('GET','/api/projects'), definition('GET','/api/projects/:id'), definition('POST','/api/projects',[...project,'workspaceId']),definition('PUT','/api/projects/:id',project),definition('DELETE','/api/projects/:id'),definition('PUT','/api/projects/:id/activate'),
  definition('GET','/api/tasks'),definition('GET','/api/tasks/:id'),definition('POST','/api/tasks',[...task,'workspaceId','initialComments']),definition('PUT','/api/tasks/:id',task),definition('PUT','/api/tasks/:id/status',['status','reason']),definition('DELETE','/api/tasks/:id'),
  definition('GET','/api/tasks/:taskId/time-entries'),definition('POST','/api/tasks/:taskId/time-entries',['hours','note','startedAt','endedAt']),definition('PUT','/api/time-entries/:id',['hours','note','startedAt','endedAt']),definition('DELETE','/api/time-entries/:id'),
  definition('GET','/api/tasks/:taskId/subtasks'),definition('POST','/api/tasks/:taskId/subtasks',['title','note','completed']),definition('PUT','/api/subtasks/:id',['title','note','completed']),definition('DELETE','/api/subtasks/:id'),
  definition('GET','/api/tasks/:taskId/comments'),definition('POST','/api/tasks/:taskId/comments',['content']),definition('PUT','/api/comments/:id',['content']),definition('DELETE','/api/comments/:id'),
  definition('GET','/api/projects/:projectId/milestones'),definition('POST','/api/projects/:projectId/milestones',['title','description','deadline','dueDate','status','completed']),definition('PUT','/api/milestones/:id',['title','description','deadline','dueDate','status','completed']),definition('DELETE','/api/milestones/:id'),
  ...['organizations','teams'].flatMap(collection => [definition('GET','/api/'+collection),definition('POST','/api/'+collection,collection==='teams'?team:organization),definition('PUT','/api/'+collection+'/:id',collection==='teams'?team:organization),definition('DELETE','/api/'+collection+'/:id')]),
  definition('POST','/api/teams/defaults'),
  definition('POST','/api/projects/:id/checklists',['teamId']),definition('DELETE','/api/projects/:id/checklists/:checklistId'),definition('PUT','/api/projects/:id/checklists/:checklistId/steps/:stepId',['completed']),
  definition('POST','/api/org/teams',team),definition('PUT','/api/org/teams/:id',team),definition('DELETE','/api/org/teams/:id'),definition('PUT','/api/org/teams/:id/members',['memberIds','leaderId']),
  definition('POST','/api/org/departments',department),definition('PUT','/api/org/departments/:id',department),definition('DELETE','/api/org/departments/:id'),definition('PUT','/api/org/departments/:id/members',['memberIds']),
  definition('POST','/api/org/modules',module),definition('PUT','/api/org/modules/:id',module),definition('DELETE','/api/org/modules/:id'),
  definition('POST','/api/org/module-instances',instance),definition('PUT','/api/org/module-instances/:id',instance),definition('DELETE','/api/org/module-instances/:id'),
  definition('POST','/api/org/module-instances/:id/records',['data']),definition('PUT','/api/org/module-instances/:id/records/:recordId',['data']),definition('DELETE','/api/org/module-instances/:id/records/:recordId'),
  ...['navigation-groups','navigation-items'].flatMap(collection=>[definition('GET','/api/org/'+collection),definition('POST','/api/org/'+collection,nav),definition('PUT','/api/org/'+collection+'/:id',nav),definition('DELETE','/api/org/'+collection+'/:id')]),
  ...['wordpress-checklist','seo-checklist','content-center','qa-bugs'].flatMap(collection=> { const fields=collection==='content-center'?content:collection==='qa-bugs'?qa:checklist;return[definition('GET','/api/'+collection),definition('POST','/api/'+collection,fields),definition('PUT','/api/'+collection+'/:id',fields),definition('DELETE','/api/'+collection+'/:id')]; }),
];
