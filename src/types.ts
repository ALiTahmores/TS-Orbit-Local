export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'IN_PROGRESS' | 'in_progress' | 'CONNECTED_TO_WORDPRESS' | 'COMPLETED' | 'active' | 'pending' | 'completed' | 'delayed';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type TaskStatus = 'pending' | 'inprogress' | 'review' | 'completed' | 'blocked' | 'cancelled';

export type DepartmentKey = 'ui_ux' | 'wp_dev' | 'content' | 'seo' | 'qa' | 'client_approval';

export interface ClientFeedback {
  id: string;
  projectId: string;
  senderName: string;
  senderRole: 'client' | 'admin';
  category: 'design' | 'content' | 'technical' | 'general';
  message: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'approved' | 'rejected';
  history?:any[];
  replies?:any[];
  createdAt: string; // Persian date
  attachments?: string[];
}

export interface StatusLog {
  previousStatus: string;
  newStatus: string;
  reason: string;
  timestamp: string;
  username?: string;
}

export interface Project {
  id: string;
  title: string;
  name?: string;
  description: string;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  status: ProjectStatus;
  startDate: string;
  deadline: string;
  dueDate?: string;
  budget: string;
  clientName: string;
  websiteUrl?: string;
  teamLead?: string;
  teamLeadId?: string;
  leadId?: string;
  creatorId?: string;
  assignedMemberIds?: string[];
  assignedMembers?: any[];
  assignedTeamIds?: string[];
  createdById?: string;
  workspaceId?: string;
  department?: string;
  category?: string;
  priority?: string;
  selectedTeams?: string[];
  members?: any[];
  isConfidential?: boolean;
  isBudgetConfidential?: boolean;
  clientPortalEnabled?: boolean;
  isPortalActive?: boolean;
  clientPortalToken?: string;
  portalToken?: string;
  clientFeedbacks?: ClientFeedback[];
  statusHistory?: StatusLog[];
  statusReason?: string;
  createdAt?: string;
  loggedHours?: number;
}

export interface SubTask {
  id: string;
  title: string;
  note?: string;
  completed: boolean;
}

export interface TaskAttachment {
  id: string;
  name: string;
  size: string;
  type: 'word' | 'figma' | 'pdf' | 'image';
  url: string;
}

export interface TaskItem {
  id: string;
  workspaceId: string;
  projectId?: string;
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'COMPLETED';
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  dueDate: string; // e.g. "Feb 02, 2027" or "1405/03/15"
  assignees: { id: string; name: string; avatar?: string; color?: string }[];
  tags: string[];
  progress: number;
  subtasks: SubTask[];
  attachments: TaskAttachment[];
  commentsCount: number;
  linksCount: number;
  creatorId: string;
}

export interface Task {
  id: string;
  projectId: string;
  workspaceId?: string;
  title: string;
  description: string;
  assignedTo?: string; // Team member name
  assigneeId?: string;
  assignedMemberIds?: string[];
  teamId?: string;
  departmentId?: string;
  initialComments?: string[];
  links?: string[];
  timeEntries?: any[];
  assignees?: { id: string; name: string; avatar?: string; color?: string }[];
  creatorId?: string;
  priority: TaskPriority | 'Urgent' | 'High' | 'Medium' | 'Low' | string;
  status: TaskStatus | 'TODO' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'COMPLETED' | string;
  department?: DepartmentKey | string;
  startDate?: string;
  deadline?: string;
  deadlineCanonical?: string;
  dueDateCanonical?: string;
  dueDate?: string;
  tags?: string[];
  attachments?: any[];
  dependencies?: string[]; // Task names/ids
  estimatedHours?: number;
  loggedHours?: number;
  progress?: number;
  subtasks?: SubTask[];
  commentsCount?: number;
  linksCount?: number;
  comments?: any[];
  notes?: string;
  category?: string;
  createdAt?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  department: DepartmentKey | 'management';
  avatar: string;
  taskCount: number;
  completedCount: number;
  status: 'online' | 'offline' | 'away';
  rating?: number | string;
  email?: string;
  phone?: string;
  hourlyRate?: string;
  skills?: string[];
}

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  activeProjects: string[];
  feedback: { id: string; content: string; date: string; approved: boolean }[];
  invoices: { id: string; amount: string; status: 'paid' | 'pending'; date: string }[];
  meetingNotes: { id: string; title: string; date: string; summary: string }[];
}

export interface WordPressChecklistItem {
  id: string;
  category: 'hosting' | 'domain' | 'dns' | 'cloudflare' | 'wp_install' | 'security' | 'performance' | 'development' | 'testing';
  name: string;
  status: 'pending' | 'inprogress' | 'completed' | 'blocked';
  owner: string;
  dueDate: string;
  notes: string;
  progress: number; // 0 to 100
}

export interface SeoChecklistItem {
  id: string;
  category: 'technical' | 'on_page' | 'schema' | 'internal_links' | 'search_console' | 'analytics' | 'keywords' | 'audit';
  name: string;
  priority: TaskPriority;
  assignedTo: string;
  status: 'pending' | 'inprogress' | 'completed';
  progress: number; // 0 to 100
  dueDate: string;
  metrics?: { label: string; value: string; trend: 'up' | 'down' | 'neutral' };
}

export interface ContentItem {
  id: string;
  pageName: string;
  status: 'received' | 'writing' | 'review' | 'approved' | 'published';
  writer: string;
  reviewer: string;
  approvalStatus: 'none' | 'pending' | 'approved' | 'rejected';
  deadline: string;
  attachments: string[];
  contentBody?: string;
}

export interface QaBug {
  id: string;
  title: string;
  category: 'responsive' | 'forms' | 'checkout' | 'performance' | 'browser' | 'security' | 'accessibility';
  priority: TaskPriority;
  assignedTo: string;
  status: 'pending' | 'inprogress' | 'fixed' | 'verified';
  fixVersion: string;
  dateLogged: string;
}

export interface ProjectFile {
  id: string;
  projectId: string; // Linked to active project
  name: string;
  sizeInBytes: number;
  formattedSize: string; // e.g., "2.4 MB", "520 KB"
  extension: 'pdf' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'txt' | 'fig' | 'zip' | 'png' | 'jpg';
  category: 'client_brief' | 'contract' | 'design' | 'technical' | 'general';
  uploadedBy: {
    name: string;
    avatar?: string;
  };
  createdAt: string; // Persian date timestamp
  fileUrl: string; // Download / Blob URL
}

export interface FileAsset {
  id: string;
  name: string;
  category: 'brand' | 'logo' | 'images' | 'documents' | 'contracts' | 'content' | 'seo' | 'dev';
  size: string;
  uploadDate: string;
  version: number;
  versionHistory: { version: number; date: string; changedBy: string; note: string }[];
  tag: string;
}

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  type: 'task_assigned' | 'task_completed' | 'deadline_warning' | 'approval_needed' | 'file_uploaded' | 'project_updated';
  recipientUserId?: string;
  recipientRole?: string;
}

export interface ApiLog {
  id: string;
  timestamp: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  status: number;
  payload?: any;
  response: any;
}

export interface WordPressSyncData {
  projectId: string;
  siteUrl: string;
  siteName: string;
  wpVersion: string;
  phpVersion: string;
  themeName: string;
  themeVersion: string;
  serverType: string;
  sslStatus: string;
  dnsStatus: string;
  installedThemes: string[];
  installedPlugins: { name: string; version: string; active: boolean }[];
  pagesCount: number;
  postsCount: number;
  productsCount: number;
  mediaCount: number;
  rankMathStatus: string;
  yoastStatus: string;
  sitemapStatus: string;
  robotsTxtStatus: string;
  cacheStatus: string;
  optimizationStatus: string;
  securityPluginStatus: string;
  backupStatus: string;
  lastSynced: string;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  apiKey: string;
  performanceMetrics?: {
    responseTimeMs: number;
    cpuLoadPercent: number;
    memoryUsagePercent: number;
  };
}

// Automation Engine Types
export type TriggerType = 
  | 'page_published'
  | 'plugin_installed'
  | 'product_count_gt'
  | 'seo_activated'
  | 'ssl_activated'
  | 'all_pages_published'
  | 'client_approved'
  | 'dev_tasks_completed'
  | 'qa_approved'
  | 'new_project';

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'contains' | 'is_true';
  value: string | number | boolean;
}

export interface AutomationAction {
  type: 
    | 'complete_task'
    | 'mark_store_setup_complete'
    | 'increase_progress'
    | 'complete_seo_task'
    | 'complete_security_checklist'
    | 'mark_content_phase_complete'
    | 'start_development_phase'
    | 'create_qa_tasks'
    | 'create_launch_checklist'
    | 'notify_client'
    | 'create_project_tasks';
  targetId?: string; // task or checklist or client ID
  message?: string;  // Notification body or parameters
  value?: any;       // Parameter value
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: TriggerType;
  condition?: AutomationCondition;
  thenAction: AutomationAction;
  elseAction?: AutomationAction;
  isActive: boolean;
  isSystem: boolean;
  lastRun?: string;
  runCount: number;
}

export interface AutomationLog {
  id: string;
  ruleId: string;
  ruleName: string;
  timestamp: string;
  triggerEvent: string;
  status: 'success' | 'warning' | 'error';
  details: string;
  actionTaken: string;
}

export interface ActivityLog {
  id: string;
  userId?: string;
  actorId?: string;
  userEmail?: string;
  user?: string;
  action: string;
  target?: string;
  category?: 'task' | 'comment' | 'system' | 'all';
  timestamp: string;
  type?: string;
  avatar?: string;
}

export interface ActivityIntelMetrics {
  teamProductivity: number; // 0-100
  taskVelocity: number;     // tasks completed per week
  completionRate: number;   // % of completed tasks
  delayRate: number;        // % of delayed tasks
  approvalSpeed: string;    // speed in hours/days (e.g. "4.2 ساعت")
  readinessScore: number;   // 0-100
}

export interface ReadinessScoreCategory {
  content: number;
  seo: number;
  performance: number;
  security: number;
  development: number;
  qa: number;
  launch: number;
}

export interface DynamicModule {
  id: string;
  name: string;
  icon: string;
  order: number;
  enabled: boolean;
  accessRoles: string[];
  isCustom?: boolean;
  customContent?: string; // for custom modules to display something elegant
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
}

export interface Department {
  id: string;
  organizationId: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  leaderId?: string;
  order: number;
}

export interface DepartmentMember {
  id: string;
  departmentId: string;
  userId: string;
  role: string;
  customFields?: Record<string, any>;
}

export interface DepartmentPermission {
  id: string;
  departmentId: string;
  role: string;
  action: string;
  isAllowed: boolean;
}

export interface DepartmentModule {
  id: string;
  departmentId: string;
  moduleId: string;
}

export interface DepartmentReport {
  id: string;
  workspaceId?: string;
  creatorId?: string;
  departmentId: string;
  scope?: 'agency' | 'department';
  title: string;
  content: string;
  generatedAt: string;
  createdBy: string;
  metrics?: Record<string, any>;
  projectSummary?: {
    totalProjects: number;
    completedProjects: number;
    avgProgress: number;
  };
  taskSummary?: {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
  };
  departmentBreakdown?: Array<{
    departmentId: string;
    departmentName: string;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    completionRate: number;
  }>;
  clientProjectsMatrix?: Array<{
    id: string;
    name: string;
    departmentName: string;
    progress: number;
    status: 'on_track' | 'at_risk' | 'delayed';
    statusLabel: string;
    manager: string;
  }>;
  memberBottlenecks?: Array<{
    memberName: string;
    departmentName: string;
    overdueCount: number;
    pendingCount: number;
    statusText: string;
  }>;
  bottlenecks?: string[];
  keyTakeaways?: string[];
}

export type AgencyReport = DepartmentReport;

export interface DepartmentSetting {
  id: string;
  departmentId: string;
  key: string;
  value: string;
}

export interface DepartmentChat {
  id: string;
  departmentId: string;
  name: string;
  type: string; // 'private_team' | 'team_channel' | 'notification' | 'leader_channel'
  channelId: string;
}

export interface DepartmentChannel {
  id: string;
  departmentId: string;
  name: string;
  type: string;
  isPrivate: boolean;
}

export interface DepartmentRole {
  id: string;
  departmentId: string;
  roleName: string;
  permissions: string[];
}

export interface DepartmentTemplate {
  id: string;
  name: string;
  description: string;
  structure: any; // departments, modules, teams definition JSON
  createdBy: string;
}

export interface NavigationGroup {
  id: string;
  name: { fa: string; en: string };
  order: number;
  icon: string;
}

export interface NavigationItem {
  id: string;
  groupId: string;
  name: { fa: string; en: string };
  icon: string;
  path: string;
  moduleId?: string;
  order: number;
}

export interface ModuleDefinition {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  structure: any;
  isActive: boolean;
}

export interface ModuleInstance {
  id: string;
  definitionId: string;
  organizationId: string;
  name: string;
  config: any;
}

export interface ModulePermission {
  id: string;
  instanceId: string;
  role: string;
  actions: string[];
}

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER' | 'SPECIALIST' | 'CLIENT' | string;

export interface WorkspaceMembership {
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
  permissions: string[];
  joinedAt: string;
}

export interface WorkspaceMember {
  userId: string;
  role: string;
  permissions: string[];
  joinedAt?: string;
  name?: string;
  username?: string;
  email?: string;
  phone?: string;
  avatar?: string;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string; // Random unique 8-char slug
  members: WorkspaceMember[];
  createdAt?: string;
  description?: string;
  icon?: string;
}

export interface User {
  id: string;
  name: string;
  username: string; // Unique handle (e.g. "sara")
  email: string;
  phone: string; // +98...
  avatar?: string;
  status: 'ACTIVE' | 'SUSPENDED';
  personalWorkspaceId: string;
  memberships: WorkspaceMembership[];
  role?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
}

export type Report = DepartmentReport;
export type NotificationItem = AppNotification;

export interface ToastAction {
  title: string;
  description: string;
  targetView?: string;
  targetSubView?: string;
  actionText?: string;
  type: 'success' | 'info' | 'error';
}
