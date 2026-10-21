/** Explicit inventory of legacy business endpoints. Unknown private routes fail closed. */
export const contracts = [
  {
    "method": "GET",
    "path": "/api/users/lookup",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/owner/approvals",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/owner/approvals/:id/approve",
    "fields": [
      "role",
      "department",
      "team",
      "workspace",
      "permissions",
      "defaultProjectAccess",
      "defaultChatAccess",
      "defaultModules",
      "managerNotes"
    ]
  },
  {
    "method": "POST",
    "path": "/api/owner/approvals/:id/reject",
    "fields": [
      "reason"
    ]
  },
  {
    "method": "POST",
    "path": "/api/owner/approvals/:id/block",
    "fields": [
      "reason"
    ]
  },
  {
    "method": "GET",
    "path": "/api/owner/sessions",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/owner/sessions/:id/terminate",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/owner/login-history",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/owner/audit-logs",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/owner/approval-stats",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/users",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/users",
    "fields": [
      "name",
      "email",
      "phone",
      "role",
      "password"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/users/:id/role",
    "fields": [
      "role"
    ]
  },
  {
    "method": "GET",
    "path": "/api/organizations",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/organizations",
    "fields": [
      "name",
      "plan",
      "billingCycle"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/organizations/:id",
    "fields": [
      "name",
      "plan",
      "billingCycle"
    ]
  },
  {
    "method": "DELETE",
    "path": "/api/organizations/:id",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/teams",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/teams",
    "fields": [
      "name",
      "department",
      "leaderId"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/teams/:id",
    "fields": [
      "name",
      "department",
      "leaderId"
    ]
  },
  {
    "method": "DELETE",
    "path": "/api/teams/:id",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/users/invite",
    "fields": [
      "email",
      "name",
      "role",
      "phone"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/users/:id/status",
    "fields": [
      "status"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/users/:id/governance",
    "fields": [
      "role",
      "status",
      "permissions",
      "department",
      "team"
    ]
  },
  {
    "method": "DELETE",
    "path": "/api/users/:id",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/projects/:projectId/milestones",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/projects/:projectId/milestones",
    "fields": [
      "title",
      "description",
      "deadline"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/milestones/:id",
    "fields": [
      "title",
      "description",
      "deadline",
      "status"
    ]
  },
  {
    "method": "DELETE",
    "path": "/api/milestones/:id",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/tasks/:taskId/subtasks",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/tasks/:taskId/subtasks",
    "fields": [
      "title"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/subtasks/:id",
    "fields": [
      "title",
      "completed"
    ]
  },
  {
    "method": "DELETE",
    "path": "/api/subtasks/:id",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/tasks/:taskId/comments",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/tasks/:taskId/comments",
    "fields": [
      "content"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/comments/:id",
    "fields": [
      "content"
    ]
  },
  {
    "method": "DELETE",
    "path": "/api/comments/:id",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/activity-logs",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/projects",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/projects/:id",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/projects",
    "fields": [
      "title",
      "description",
      "budget",
      "clientName",
      "deadline",
      "websiteUrl",
      "teamLead",
      "teamLeadId",
      "assignedMemberIds",
      "assignedTeamIds",
      "createdById",
      "isBudgetConfidential",
      "workspaceId",
      "selectedTeams",
      "department",
      "category",
      "dueDate",
      "name",
      "priority"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/projects/:id",
    "fields": []
  },
  {
    "method": "DELETE",
    "path": "/api/projects/:id",
    "fields": []
  },
  {
    "method": "PUT",
    "path": "/api/projects/:id/activate",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/tasks",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/tasks",
    "fields": [
      "projectId",
      "title",
      "description",
      "assignedTo",
      "priority",
      "department",
      "deadline",
      "workspaceId"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/tasks/:id",
    "fields": [
      "title",
      "description",
      "status",
      "priority",
      "assignedTo",
      "department",
      "deadline",
      "projectId",
      "tags"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/tasks/:id/status",
    "fields": [
      "status"
    ]
  },
  {
    "method": "DELETE",
    "path": "/api/tasks/:id",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/content-center",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/content-center",
    "fields": [
      "pageName",
      "writer",
      "reviewer",
      "deadline",
      "contentBody"
    ]
  },
  {
    "method": "GET",
    "path": "/api/seo-checklist",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/qa-bugs",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/qa-bugs",
    "fields": [
      "title",
      "category",
      "priority"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/content-center/:id",
    "fields": [
      "status",
      "approvalStatus",
      "contentBody"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/qa-bugs/:id",
    "fields": [
      "status",
      "priority",
      "category"
    ]
  },
  {
    "method": "GET",
    "path": "/api/files",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/files",
    "fields": [
      "name",
      "category",
      "size",
      "tag"
    ]
  },
  {
    "method": "DELETE",
    "path": "/api/files/:id",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/client-feedback",
    "fields": [
      "clientId",
      "feedbackContent"
    ]
  },
  {
    "method": "GET",
    "path": "/api/stats",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/notifications",
    "fields": []
  },
  {
    "method": "PUT",
    "path": "/api/notifications/read-all",
    "fields": []
  },
  {
    "method": "PUT",
    "path": "/api/notifications/:id/read",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/notifications/clear",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/logs",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/sites/status",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/sites/sync",
    "fields": [
      "projectId"
    ]
  },
  {
    "method": "POST",
    "path": "/api/sites/connect",
    "fields": [
      "projectId",
      "siteUrl",
      "siteName",
      "wpVersion",
      "themeName",
      "themeVersion",
      "serverType",
      "sslStatus"
    ]
  },
  {
    "method": "POST",
    "path": "/api/sites/disconnect",
    "fields": [
      "projectId"
    ]
  },
  {
    "method": "POST",
    "path": "/api/sites/webhook",
    "fields": [
      "siteUrl",
      "event",
      "payload"
    ]
  },
  {
    "method": "GET",
    "path": "/api/chat/users",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/chat/conversations",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/chat/conversations",
    "fields": [
      "recipientId",
      "title",
      "isGroup",
      "teamId"
    ]
  },
  {
    "method": "POST",
    "path": "/api/chat/conversations/:id/close",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/chat/conversations/:id/messages",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/chat/conversations/:id/messages",
    "fields": [
      "content",
      "attachments",
      "replyToMessageId"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/chat/messages/:id",
    "fields": [
      "content"
    ]
  },
  {
    "method": "DELETE",
    "path": "/api/chat/messages/:id",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/chat/messages/:id/react",
    "fields": [
      "emoji"
    ]
  },
  {
    "method": "POST",
    "path": "/api/chat/conversations/:id/pin",
    "fields": [
      "messageId",
      "pin"
    ]
  },
  {
    "method": "POST",
    "path": "/api/chat/conversations/:id/read",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/chat/requests",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/chat/requests",
    "fields": [
      "targetTeamId",
      "requestText"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/chat/requests/:id/respond",
    "fields": [
      "status"
    ]
  },
  {
    "method": "DELETE",
    "path": "/api/chat/permissions/team/:teamId/user/:userId",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/wordpress-checklist",
    "fields": []
  },
  {
    "method": "PUT",
    "path": "/api/wordpress-checklist/:id",
    "fields": [
      "status",
      "progress",
      "notes"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/seo-checklist/:id",
    "fields": [
      "status",
      "progress",
      "notes"
    ]
  },
  {
    "method": "GET",
    "path": "/api/external-connections",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/external-connections",
    "fields": [
      "name",
      "endpointUrl",
      "apiType",
      "authType",
      "credentials"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/external-connections/:id/toggle",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/search",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/org/data",
    "fields": []
  },
  {
    "method": "PUT",
    "path": "/api/org/permissions",
    "fields": [
      "departmentId",
      "role",
      "action",
      "isAllowed"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/org/module-instances/:id",
    "fields": [
      "config"
    ]
  },
  {
    "method": "POST",
    "path": "/api/org/departments",
    "fields": [
      "name",
      "icon",
      "color",
      "description",
      "leaderId",
      "order"
    ]
  },
  {
    "method": "PUT",
    "path": "/api/org/departments/:id",
    "fields": [
      "name",
      "icon",
      "color",
      "description",
      "leaderId",
      "order"
    ]
  },
  {
    "method": "DELETE",
    "path": "/api/org/departments/:id",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/org/modules",
    "fields": [
      "name",
      "icon",
      "color",
      "description",
      "structure"
    ]
  },
  {
    "method": "DELETE",
    "path": "/api/org/modules/:id",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/org/module-instances",
    "fields": [
      "definitionId",
      "departmentId",
      "name",
      "config"
    ]
  },
  {
    "method": "POST",
    "path": "/api/org/teams",
    "fields": [
      "name",
      "departmentId",
      "leaderId",
      "memberIds",
      "description",
      "color",
      "avatar",
      "customFields"
    ]
  },
  {
    "method": "POST",
    "path": "/api/org/reports/executive-summary",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/org/departments/:id/reports",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/org/reports",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/org/reports",
    "fields": []
  },
  {
    "method": "DELETE",
    "path": "/api/org/reports/bulk",
    "fields": []
  },
  {
    "method": "DELETE",
    "path": "/api/org/reports/:id",
    "fields": []
  },
  {
    "method": "GET",
    "path": "/api/org/departments/:id/reports",
    "fields": []
  },
  {
    "method": "POST",
    "path": "/api/org/templates",
    "fields": [
      "name",
      "description",
      "structure"
    ]
  },
  {
    "method": "GET",
    "path": "/api/org/templates",
    "fields": []
  }
] as const;
