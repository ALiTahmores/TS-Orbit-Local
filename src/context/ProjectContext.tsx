import {useCollaboration} from '../hooks/useCollaboration';
import { uploadAsset } from '../lib/assets';
import {commitPortalChange} from '../lib/portal';
import { taskTransport, taskStatus, assignedIds } from '../lib/domain';
import { apiFetch,getApiIdentity } from '../lib/api';
import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { getSocket, disconnectSocket } from '../lib/socket';
import { notifyStandaloneMode, ApiError, reportApiError, setApiIdentity, clearCredential, clearBusinessCaches, redactClientLog, getAuthHeaders as sharedAuthHeaders } from '../lib/api';
import { 
  Project, 
  Task, 
  TeamMember, 
  Client, 
  ClientFeedback,
  WordPressChecklistItem, 
  SeoChecklistItem, 
  ContentItem, 
  QaBug, 
  FileAsset, 
  AppNotification,
  ApiLog,
  TaskStatus,
  TaskPriority,
  DepartmentKey,
  WordPressSyncData,
  TriggerType,
  AutomationCondition,
  AutomationAction,
  AutomationRule,
  AutomationLog,
  ActivityLog,
  ActivityIntelMetrics,
  ReadinessScoreCategory,
  DynamicModule,
  User,
  Workspace,
  DepartmentReport,
  Report,
  NotificationItem,
  ToastAction
} from '../types';
import { canUserAccessProject, canUserAccessNotification } from '../utils/helpers';
import { 
  INITIAL_PROJECTS, 
  INITIAL_TEAM_MEMBERS, 
  INITIAL_TASKS, 
  INITIAL_CLIENTS, 
  INITIAL_WP_CHECKLIST, 
  INITIAL_SEO_CHECKLIST, 
  INITIAL_CONTENT_CENTER, 
  INITIAL_QA_BUGS, 
  INITIAL_FILES, 
  INITIAL_WP_SITES,
  INITIAL_AUTOMATION_RULES,
  INITIAL_AUTOMATION_LOGS
} from '../data/mockData';
import { INITIAL_USERS, INITIAL_WORKSPACES } from '../services/db';
import { Locale, getTranslation } from '../lib/i18n';
import { getLocale, setActiveLocale } from '../lib/locale';
import { startDomTranslation, stopDomTranslation } from '../lib/domTranslation';
import { roleLabel } from '../lib/roles';
import { localAvatar } from '../lib/localAssets';
export { INITIAL_USERS, INITIAL_WORKSPACES } from '../services/db';

export function getStorageItem<T>(key: string, fallback: T): T {
  // Business data must come from a validated server response, never an unscoped browser cache.
  if (/^(orbit_|TS_ORBIT_|agency_)/.test(key)) return (Array.isArray(fallback) ? [] : typeof fallback === 'string' ? '' : fallback) as T;
  try { const value=localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

export function setStorageItem<T>(key: string, value: T): void {
  if (/^(orbit_|TS_ORBIT_|agency_)/.test(key)) return;
  try { localStorage.setItem(key,JSON.stringify(value)); } catch {}
}

interface ProjectContextType {
  projects: Project[];
  tasks: Task[];
  teamMembers: TeamMember[];
  clients: Client[];
  wpChecklist: WordPressChecklistItem[];
  seoChecklist: SeoChecklistItem[];
  contentCenter: ContentItem[];
  qaBugs: QaBug[];
  files: FileAsset[];
  notifications: AppNotification[];
  apiLogs: ApiLog[];
  activityLogs: ActivityLog[];
  wpSites: WordPressSyncData[];
  
  // Active states
  selectedProject: Project;
  setSelectedProject: (project: Project) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeSubTab: string;
  setActiveSubTab: (subTab: string) => void;
  
  // Global Create Project Modal State
  isNewProjectModalOpen: boolean;
  setIsNewProjectModalOpen: (open: boolean) => void;
  openNewProjectModal: () => void;
  
  // Loading & Operations state
  isLoaded: boolean;
  isLoading: boolean;
  operationStatus: 'idle' | 'success' | 'error' | 'loading';
  setOperationStatus: (status: 'idle' | 'success' | 'error' | 'loading') => void;
  
  // Global search
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;

  // Real "API-Ready" Mutations
  deleteProject: (projectId: string) => Promise<void>;
  resetDatabaseToZero: () => void;
  createProject: (title: string, description: string, budget?: string, deadline?: string, clientName?: string, websiteUrl?: string, teamLead?: string, isBudgetConfidential?: boolean, extraData?: { teamLeadId?: string; assignedMemberIds?: string[]; assignedTeamIds?: string[]; createdById?: string }) => Promise<void>;
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
  createTask: (task: Omit<Task, 'id'>) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<Task>;
  addTaskComment: (taskId: string, content: string) => Promise<void>;
  addTaskTimeEntry: (taskId: string, hours: number, note: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  addTeamMember: (memberData: Omit<TeamMember, 'id'> & { id?: string }) => Promise<TeamMember>;
  
  // WordPress checklist actions
  updateWpChecklistItem: (itemId: string, updates: Partial<WordPressChecklistItem>) => Promise<void>;
  
  // SEO checklist actions
  updateSeoChecklistItem: (itemId: string, updates: Partial<SeoChecklistItem>) => Promise<void>;
  
  // Content actions
  updateContentStatus: (contentId: string, status: ContentItem['status'], approval?: ContentItem['approvalStatus']) => Promise<void>;
  createContentItem: (item: Omit<ContentItem, 'id'>) => Promise<void>;
  
  // QA actions
  createQaBug: (bug: Omit<QaBug, 'id' | 'dateLogged'>) => Promise<void>;
  updateQaBugStatus: (bugId: string, status: QaBug['status']) => Promise<void>;
  
  // File upload simulation
  uploadFile: (input: {file:File;name?:string;projectId?:string;category?:string;tag?:string}) => Promise<void>;
  deleteFileAsset: (fileId: string) => Promise<void>;
  
  // Client portal functions
  submitClientFeedback: (clientId: string, feedbackContent: string) => Promise<void>;
  approveClientFeedback: (clientId: string, feedbackId: string) => Promise<void>;
  toggleClientPortal: (projectId: string, enabled: boolean) => Promise<void>;
  regenerateClientToken: (projectId: string) => Promise<string>;
  saveProjectPortal: (projectId:string,method:'PUT'|'POST'|'DELETE',path:'/portal'|'/portal-token',body?:unknown)=>Promise<Project>;
  addClientFeedback: (projectId: string, feedback: Omit<ClientFeedback, 'id' | 'createdAt'>) => Promise<void>;
  updateFeedbackStatus: (projectId: string, feedbackId: string, status: ClientFeedback['status']) => Promise<void>;
  deleteFeedback: (projectId: string, feedbackId: string) => Promise<void>;
  
  // WordPress Site Actions
  activateProject: (projectId: string) => Promise<boolean>;
  syncWordPressSite: (projectId: string) => Promise<void>;
  registerWordPressSite: (siteData: any) => Promise<void>;
  disconnectWordPressSite: (projectId: string) => Promise<void>;
  triggerWebhookMock: (siteUrl: string, event: string, payload: any) => Promise<void>;
  wpLogs: any[];
  wpWebhooks: any[];

  // Automation Engine State & Controls
  automationRules: AutomationRule[];
  automationLogs: AutomationLog[];
  createAutomationRule: (rule: Omit<AutomationRule, 'id' | 'runCount' | 'isSystem'>) => void;
  toggleAutomationRule: (ruleId: string) => void;
  deleteAutomationRule: (ruleId: string) => void;
  runAutomationEngine: (trigger: TriggerType, contextData?: any) => Promise<void>;
  autoGenerateProjectTasks: (projectId: string) => Promise<void>;
  generateClientNotificationSim: (type: 'milestone' | 'approval' | 'connect' | 'launch' | 'delay', message: string) => void;
  generateReportSim: (reportingPeriod: 'weekly' | 'monthly' | 'project' | 'performance') => any;

  // Enterprise Collaboration / Chat System State & Operations
  hasEarlierMessages:boolean;
  loadEarlierMessages:()=>Promise<void>;
  chatConversations: any[];
  chatMessages: any[];
  chatUsers: any[];
  chatRequests: any[];
  activeConversation: any;
  setActiveConversation: (conv: any) => void;
  chatTypingUsers: Record<string, string[]>;
  fetchConversations: () => Promise<void>;
  fetchMessages: (convId: string) => Promise<void>;
  fetchChatUsers: () => Promise<void>;
  fetchTeamMembers: () => Promise<void>;
  fetchChatRequests: () => Promise<void>;
  sendChatMessage: (convId: string, content: string, attachments?: any[], replyToId?: string,extra?:Record<string,unknown>) => Promise<any>;
  createConversation: (recipientId?: string, title?: string, isGroup?: boolean, teamId?: string,memberIds?:string[]) => Promise<any>;
  sendChatRequest: (targetTeamId: string, text: string) => Promise<void>;
  respondToChatRequest: (requestId: string, status: 'approved' | 'rejected' | 'blocked') => Promise<void>;
  deleteChatMessage: (messageId: string) => Promise<void>;
  reactToChatMessage: (messageId: string, emoji: string) => Promise<void>;
  pinChatMessage: (convId: string, messageId: string, pin: boolean) => Promise<void>;
  closeConversation: (convId: string,closed?:boolean) => Promise<any>;
  editChatMessage: (id:string,content:string,codeSnippet?:any)=>Promise<any>;
  updateConversation: (id:string,updates:any)=>Promise<any>;
  updateConversationMembers: (id:string,userIds:string[])=>Promise<any>;
  removeConversationMember: (id:string,userId:string)=>Promise<any>;
  muteConversation: (id:string,muted:boolean)=>Promise<any>;
  clearNotifications: ()=>Promise<void>;
  refreshCollaboration: ()=>Promise<any>;
  collaborationError: string;
  realtimeStatus:'connected'|'reconnecting'|'offline';
  markConversationRead: (convId: string) => Promise<void>;
  typingInConversation: (convId: string, isTyping: boolean) => void;

  // Activity Intelligence & Metrics
  activityIntel: ActivityIntelMetrics;
  readinessScoreCategory: ReadinessScoreCategory;

  // Clear API logs or trigger manual test requests
  clearLogs: () => void;
  triggerManualMockRequest: (method: 'GET' | 'POST' | 'PUT' | 'DELETE', endpoint: string, payload?: any) => Promise<any>;

  // Notification Operations
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;

  // Authentication & Role Management State
  currentUser: any;
  userRole: string;
  setUserRole: (role: string) => void;
  isAuthenticated: boolean;
  /** 'checking' while a stored sign-in is being confirmed, 'offline' when the server could not be reached. */
  sessionStatus: 'checking' | 'offline' | 'ready';
  retrySession: () => void;
  login: (identifier: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string, phone: string, role?: string, username?: string) => Promise<any>;
  logout: () => Promise<void>;
  isSystemAdmin: boolean;
  updateProfile: (name: string, phone: string, avatar?: string, bio?: string, email?: string, jobTitle?: string, currentPassword?: string) => Promise<boolean>;
  updateUserRole: (targetUserId: string, newRole: string) => Promise<{ success: boolean; message?: string }>;
  getRoleLabel: (role: string) => string;

  // Dynamic tabs/modules settings
  activeModules: DynamicModule[];
  setActiveModules: React.Dispatch<React.SetStateAction<DynamicModule[]>>;
  addCustomModule: (name: string, icon: string, accessRoles: string[], customContent?: string) => void;
  removeModule: (id: string) => void;
  updateModule: (id: string, updates: Partial<DynamicModule>) => void;

  // Theme & Language (i18n) Support
  locale: Locale;
  setLocale: (locale: Locale) => void;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  t: (key: string) => string;
  refreshAllData: () => Promise<void>;

  // Phase 6 - Dynamic Org & Modules State & Operations
  departments: any[];
  departmentMembers: any[];
  departmentPermissions: any[];
  departmentModules: any[];
  departmentReports: any[];
  departmentSettings: any[];
  departmentChats: any[];
  departmentChannels: any[];
  departmentRoles: any[];
  departmentTemplates: any[];
  navigationGroups: any[];
  navigationItems: any[];
  moduleDefinitions: any[];
  moduleInstances: any[];
  modulePermissions: any[];
  teams: any[];
  fetchOrgData: () => Promise<void>;
  createDepartment: (deptData: any) => Promise<any>;
  updateDepartment: (deptId: string, deptData: any) => Promise<any>;
  deleteDepartment: (deptId: string) => Promise<boolean>;
  createModule: (moduleData: any) => Promise<any>;
  deleteModule: (moduleId: string) => Promise<boolean>;
  instantiateModule: (instanceData: any) => Promise<any>;
  createOrgTeam: (teamData: any) => Promise<any>;
  updateOrgTeam: (teamId:string,teamData:any) => Promise<any>;
  deleteOrgTeam: (teamId:string) => Promise<void>;
  updateModuleDefinition: (moduleId:string,moduleData:any) => Promise<any>;
  generateDepartmentReport: (deptId: string) => Promise<any>;
  generateExecutiveReport: () => Promise<any>;
  saveReport: (reportData: any) => Promise<any>;
  deleteReport: (id: string) => Promise<boolean>;
  deleteReportsBulk: (range: string, ids?: string[]) => Promise<boolean>;
  saveModuleTemplate: (templateData: any) => Promise<any>;
  fetchTemplates: () => Promise<any[]>;
  updatePermission: (deptId: string, role: string, action: string, isAllowed: boolean) => Promise<any>;

  // Multi-tenant, Enterprise Persistence & Toast Sync Exposes
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  workspaces: Workspace[];
  setWorkspaces: React.Dispatch<React.SetStateAction<Workspace[]>>;
  activeWorkspaceId: string;
  setActiveWorkspaceId: (id: string) => void;
  reports: DepartmentReport[];
  setReports: React.Dispatch<React.SetStateAction<DepartmentReport[]>>;
  hasPendingSync: boolean;
  setHasPendingSync: (pending: boolean) => void;
  performSilentSync: () => Promise<void>;
  activeToast: ToastAction | null;
  setActiveToast: (toast: ToastAction | null) => void;
  showToast: (toast: ToastAction) => void;
  activeView: string;
  setActiveView: (view: string) => void;
  toastMessage: { title: string; type: 'success' | 'info' | 'error'; description?: string } | null;
  setToastMessage: (msg: { title: string; type: 'success' | 'info' | 'error'; description?: string } | null) => void;
  triggerSuccessEvent: (title: string, desc?: string) => void;
  addProject: (newProject: Project) => Promise<void>;
  addTask: (newTask: Task) => void;
}

export const NULL_PROJECT: Project = {
  id: "no_project",
  title: "هیچ پروژه‌ای ثبت نشده است",
  description: "جهت مانیتورینگ وضعیت، ابتدا یک پروژه جدید برای کارگاه ثبت فرمایید.",
  progress: 0,
  totalTasks: 0,
  completedTasks: 0,
  status: "pending",
  startDate: "—",
  deadline: "—",
  budget: "۰ تومان",
  clientName: "—"
};

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const DEFAULT_SEED_PROJECTS: Project[] = [];
/** The page this tab was showing, restored after a reload. */
const VIEW_KEY = 'orbit_current_view';

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const socketRef = useRef<any>(null);
  const projectFetchSequence=useRef(0);
  const teamMembersFetchSequence=useRef(0);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState<boolean>(false);
  const openNewProjectModal = () => setIsNewProjectModalOpen(true);

  // 1. Core Models with Guaranteed Lazy Storage Initializers
  const [projects, setProjects] = useState<Project[]>(() => {
    const raw = getStorageItem<Project[]>('orbit_projects_db', getStorageItem<Project[]>('TS_ORBIT_PROJECTS', getStorageItem<Project[]>('agency_projects', INITIAL_PROJECTS)));
    const list = Array.isArray(raw) ? raw : [];
    return list.map(p => ({
      ...p,
      isPortalActive: p.isPortalActive !== undefined ? p.isPortalActive : p.clientPortalEnabled === true,
      clientPortalEnabled: p.clientPortalEnabled === true,
      clientPortalToken: p.clientPortalToken || p.portalToken || '',
      portalToken: p.portalToken || p.clientPortalToken || ''
    }));
  });

  useEffect(() => {
    setStorageItem('orbit_projects_db', projects);
    setStorageItem('TS_ORBIT_PROJECTS', projects);
    setStorageItem('agency_projects', projects);
  }, [projects]);

  const [tasks, setTasks] = useState<Task[]>(() => {
    const raw = getStorageItem<Task[]>('orbit_tasks_db', getStorageItem<Task[]>('TS_ORBIT_TASKS', getStorageItem<Task[]>('agency_tasks', INITIAL_TASKS)));
    return Array.isArray(raw) ? raw : [];
  });

  useEffect(() => {
    setStorageItem('orbit_tasks_db', tasks);
    setStorageItem('TS_ORBIT_TASKS', tasks);
    setStorageItem('agency_tasks', tasks);
  }, [tasks]);

  const [departmentReports, setDepartmentReports] = useState<DepartmentReport[]>(() => {
    const raw = getStorageItem<DepartmentReport[]>('orbit_reports_db', getStorageItem<DepartmentReport[]>('TS_ORBIT_REPORTS', []));
    return Array.isArray(raw) ? raw : [];
  });

  useEffect(() => {
    setStorageItem('orbit_reports_db', departmentReports);
    setStorageItem('TS_ORBIT_REPORTS', departmentReports);
  }, [departmentReports]);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => {
    const raw = getStorageItem<TeamMember[]>('orbit_team_members', getStorageItem<TeamMember[]>('TS_ORBIT_TEAM_MEMBERS', INITIAL_TEAM_MEMBERS));
    return Array.isArray(raw) ? raw : [];
  });

  useEffect(() => {
    setStorageItem('orbit_team_members', teamMembers);
    setStorageItem('TS_ORBIT_TEAM_MEMBERS', teamMembers);
  }, [teamMembers]);

  const [users, setUsers] = useState<User[]>(() => {
    const raw = getStorageItem<User[]>('orbit_users_db', getStorageItem<User[]>('TS_ORBIT_USERS', INITIAL_USERS));
    return Array.isArray(raw) ? raw : [];
  });

  useEffect(() => {
    setStorageItem('orbit_users_db', users);
    setStorageItem('TS_ORBIT_USERS', users);
  }, [users]);

  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => {
    const raw = getStorageItem<Workspace[]>('orbit_workspaces_db', getStorageItem<Workspace[]>('TS_ORBIT_WORKSPACES', INITIAL_WORKSPACES));
    return Array.isArray(raw) ? raw : [];
  });

  useEffect(() => {
    setStorageItem('orbit_workspaces_db', workspaces);
    setStorageItem('TS_ORBIT_WORKSPACES', workspaces);
  }, [workspaces]);

  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string>(() => {
    return '';
  });

  const setActiveWorkspaceId = (id: string) => {
    if (!currentUser || !workspaces.some(w => w.id === id) || id === activeWorkspaceId) return;
    clearPrivateState();
    setApiIdentity(currentUser.id,id);
    setActiveWorkspaceIdState(id);
    const membership=currentUser.memberships?.find((m:any)=>m.workspaceId===id);
    const role=membership?.role || 'MEMBER';
    setUserRoleState(role);
    setCurrentUser((u:any)=>u ? {...u,role,workspaceRole:role} : u);
  };

  const addTeamMember = async (memberData: Omit<TeamMember, 'id'> & { id?: string }): Promise<TeamMember> => {
    const newMember: TeamMember = {
      id: memberData.id || `tm_${Date.now()}`,
      name: memberData.name,
      role: memberData.role || 'عضو تیم',
      department: memberData.department || 'wp_dev',
      avatar: memberData.avatar || '/avatars/avatar-7.svg',
      taskCount: memberData.taskCount || 0,
      completedCount: memberData.completedCount || 0,
      status: memberData.status || 'online',
      rating: memberData.rating || 9.5,
      email: memberData.email,
      phone: memberData.phone,
      hourlyRate: memberData.hourlyRate,
      skills: memberData.skills
    };

    setTeamMembers(prev => {
      const updated = [newMember, ...prev];
      return updated;
    });

    return newMember;
  };

  // Phase 6 - Dynamic Org & Module Builder States with Lazy Initializers
  const [departments, setDepartments] = useState<any[]>(() => {
    return getStorageItem<any[]>('orbit_departments_db', getStorageItem<any[]>('TS_ORBIT_DEPARTMENTS', []));
  });
  useEffect(() => {
    setStorageItem('orbit_departments_db', departments);
    setStorageItem('TS_ORBIT_DEPARTMENTS', departments);
  }, [departments]);

  const [departmentMembers, setDepartmentMembers] = useState<any[]>(() => {
    return getStorageItem<any[]>('orbit_dept_members_db', getStorageItem<any[]>('TS_ORBIT_DEPT_MEMBERS', []));
  });
  useEffect(() => {
    setStorageItem('orbit_dept_members_db', departmentMembers);
    setStorageItem('TS_ORBIT_DEPT_MEMBERS', departmentMembers);
  }, [departmentMembers]);

  const [departmentPermissions, setDepartmentPermissions] = useState<any[]>(() => {
    return getStorageItem<any[]>('orbit_dept_permissions_db', getStorageItem<any[]>('TS_ORBIT_DEPT_PERMISSIONS', []));
  });
  useEffect(() => {
    setStorageItem('orbit_dept_permissions_db', departmentPermissions);
    setStorageItem('TS_ORBIT_DEPT_PERMISSIONS', departmentPermissions);
  }, [departmentPermissions]);

  const [departmentModules, setDepartmentModules] = useState<any[]>(() => {
    return getStorageItem<any[]>('orbit_dept_modules_db', getStorageItem<any[]>('TS_ORBIT_DEPT_MODULES', []));
  });
  useEffect(() => {
    setStorageItem('orbit_dept_modules_db', departmentModules);
    setStorageItem('TS_ORBIT_DEPT_MODULES', departmentModules);
  }, [departmentModules]);

  const [departmentSettings, setDepartmentSettings] = useState<any[]>([]);
  const [departmentChats, setDepartmentChats] = useState<any[]>([]);
  const [departmentChannels, setDepartmentChannels] = useState<any[]>([]);
  const [departmentRoles, setDepartmentRoles] = useState<any[]>([]);
  const [departmentTemplates, setDepartmentTemplates] = useState<any[]>([]);
  const [navigationGroups, setNavigationGroups] = useState<any[]>([]);
  const [navigationItems, setNavigationItems] = useState<any[]>([]);

  const [moduleDefinitions, setModuleDefinitions] = useState<any[]>(() => {
    return getStorageItem<any[]>('orbit_module_defs_db', getStorageItem<any[]>('TS_ORBIT_MODULE_DEFS', []));
  });
  useEffect(() => {
    setStorageItem('orbit_module_defs_db', moduleDefinitions);
    setStorageItem('TS_ORBIT_MODULE_DEFS', moduleDefinitions);
  }, [moduleDefinitions]);

  const [moduleInstances, setModuleInstances] = useState<any[]>(() => {
    return getStorageItem<any[]>('orbit_module_instances_db', getStorageItem<any[]>('TS_ORBIT_MODULE_INSTANCES', []));
  });
  useEffect(() => {
    setStorageItem('orbit_module_instances_db', moduleInstances);
    setStorageItem('TS_ORBIT_MODULE_INSTANCES', moduleInstances);
  }, [moduleInstances]);

  const [modulePermissions, setModulePermissions] = useState<any[]>(() => {
    return getStorageItem<any[]>('orbit_module_perms_db', getStorageItem<any[]>('TS_ORBIT_MODULE_PERMS', []));
  });
  useEffect(() => {
    setStorageItem('orbit_module_perms_db', modulePermissions);
    setStorageItem('TS_ORBIT_MODULE_PERMS', modulePermissions);
  }, [modulePermissions]);

  const [teams, setTeams] = useState<any[]>(() => {
    return getStorageItem<any[]>('orbit_teams_db', getStorageItem<any[]>('TS_ORBIT_TEAMS', []));
  });
  useEffect(() => {
    setStorageItem('orbit_teams_db', teams);
    setStorageItem('TS_ORBIT_TEAMS', teams);
  }, [teams]);

  const [clients, setClients] = useState<Client[]>(() => {
    const raw = getStorageItem<Client[]>('orbit_clients_db', getStorageItem<Client[]>('TS_ORBIT_CLIENTS', INITIAL_CLIENTS));
    return Array.isArray(raw) ? raw : [];
  });
  useEffect(() => {
    setStorageItem('orbit_clients_db', clients);
    setStorageItem('TS_ORBIT_CLIENTS', clients);
  }, [clients]);

  const [wpChecklist, setWpChecklist] = useState<WordPressChecklistItem[]>([]);
  const [seoChecklist, setSeoChecklist] = useState<SeoChecklistItem[]>([]);
  const [contentCenter, setContentCenter] = useState<ContentItem[]>([]);
  const [qaBugs, setQaBugs] = useState<QaBug[]>([]);
  const [files, setFiles] = useState<FileAsset[]>([]);
  
  // Toast & Silent Sync Engine with Real Intelligent Data-Diff
  const [activeToast, setActiveToast] = useState<ToastAction | null>(null);
  const [toastMessage, setToastMessage] = useState<{ title: string; type: 'success' | 'info' | 'error'; description?: string } | null>(null);
  const [hasPendingSync, setHasPendingSync] = useState<boolean>(false);
  const toastTimeoutRef = useRef<any>(null);

  const [activeView, setActiveViewState] = useState<string>('dashboard');

  const setActiveView = (view: string) => {
    setActiveViewState(view);
    if (view === 'projects' || view === 'all_projects') {
      setActiveTab('projects');
      setActiveSubTab('overview');
    } else if (view === 'tasks' || view === 'technical_tasks' || view === 'my_tasks') {
      if (view === 'my_tasks') {
        setActiveTab('personal_tasks');
        setActiveSubTab('my_tasks');
      } else {
        setActiveTab('tasks');
        setActiveSubTab('kanban_board');
      }
    } else if (view === 'dashboard') {
      setActiveTab('dashboard');
      setActiveSubTab('overview');
    } else if (view === 'my_projects') {
      setActiveTab('personal_tasks');
      setActiveSubTab('my_projects');
    } else {
      setActiveTab(view);
    }
  };

  const showToast = (toast: ToastAction) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setActiveToast(toast);
    setToastMessage({
      title: toast.title,
      description: toast.description,
      type: toast.type
    });

    toastTimeoutRef.current = setTimeout(() => {
      setActiveToast(null);
      setToastMessage(null);
    }, 5000);
  };

  const triggerSuccessEvent = (title: string, desc?: string) => {
    showToast({
      title,
      description: desc || 'تغییرات با موفقیت ذخیره و در سامانه پایدار شد.',
      type: 'success'
    });


  };

  // Post-Reload State Diff Flash Notification Engine
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const flashRaw = sessionStorage.getItem('orbit_sync_flash');
    if (!flashRaw) return;
    sessionStorage.removeItem('orbit_sync_flash');

    try {
      const { projectCount, taskCount } = JSON.parse(flashRaw);
      const freshProjects = getStorageItem<Project[]>('orbit_projects_db', getStorageItem<Project[]>('TS_ORBIT_PROJECTS', getStorageItem<Project[]>('agency_projects', INITIAL_PROJECTS))) || [];
      const freshTasks = getStorageItem<Task[]>('orbit_tasks_db', getStorageItem<Task[]>('TS_ORBIT_TASKS', getStorageItem<Task[]>('agency_tasks', INITIAL_TASKS))) || [];

      const projectDiff = (freshProjects.length || 0) - (projectCount || 0);
      const taskDiff = (freshTasks.length || 0) - (taskCount || 0);

      if (projectDiff > 0 && taskDiff === 0) {
        showToast({
          title: 'پروژه جدید به سامانه افزوده شد',
          description: `تعداد ${projectDiff} پروژه جدید دریافت و بارگذاری شد.`,
          targetView: 'projects',
          actionText: 'مشاهده پروژه‌ها ←',
          type: 'success'
        });
      } else if (taskDiff > 0 && projectDiff === 0) {
        showToast({
          title: 'وظایف جدید ثبت گردید',
          description: `تعداد ${taskDiff} وظیفهٔ جدید بارگذاری شد.`,
          targetView: 'technical_tasks',
          actionText: 'مشاهده وظایف ←',
          type: 'success'
        });
      } else if (projectDiff > 0 && taskDiff > 0) {
        showToast({
          title: 'به‌روزرسانی داده‌های فضای کاری',
          description: `${projectDiff} پروژه و ${taskDiff} وظیفه جدید دریافت شد.`,
          targetView: 'dashboard',
          actionText: 'مشاهده داشبورد ←',
          type: 'success'
        });
      } else {
        showToast({
          title: 'پایگاه داده کاملاً همگام است',
          description: 'داده‌های فضای کاری بررسی و ریلود شدند؛ تغییر جدیدی نسبت به نسخه جاری یافت نشد.',
          type: 'info'
        });
      }
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error('Failed to parse orbit_sync_flash:', err);
    }
  }, []);

  // AUTHENTIC HARD PAGE RELOAD & DIFF SYNC ENGINE
  const performSilentSync = async () => {
    if (typeof window !== 'undefined') {
      try {
        const currentSnapshot = {
          projectCount: (projects || []).length,
          taskCount: (tasks || []).length,
          triggeredAt: Date.now()
        };
        sessionStorage.setItem('orbit_sync_flash', JSON.stringify(currentSnapshot));
      } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

        console.error('Error saving sync snapshot:', err);
      }
      window.location.reload();
    }
  };

  // Cross-Tab Storage Event Listener for real-time multi-tab awareness
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (['orbit_projects_db', 'orbit_tasks_db', 'orbit_messages_db', 'orbit_workspaces_db', 'TS_ORBIT_PROJECTS', 'TS_ORBIT_TASKS'].includes(e.key || '')) {
        setHasPendingSync(true);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // No timer-based "new data" prompt: server changes arrive as socket
  // invalidations and are refetched automatically, so a periodic flag only
  // announced updates that did not exist.

  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);

  
  const [selectedProject, setSelectedProjectState] = useState<Project>(NULL_PROJECT);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeSubTab, setActiveSubTab] = useState<string>('overview');
  const [wpSites, setWpSites] = useState<WordPressSyncData[]>([]);
  const [wpLogs, setWpLogs] = useState<any[]>([]);
  const [wpWebhooks, setWpWebhooks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [operationStatus, setOperationStatus] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [automationLogs, setAutomationLogs] = useState<AutomationLog[]>([]);

  // Auth & Roles implementation
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const collaboration = useCollaboration(currentUser?.id || '',activeWorkspaceId,isAuthenticated);
  const {chatConversations,chatMessages,chatUsers,chatRequests,activeConversation,setActiveConversation,chatTypingUsers,
    notifications,activityLogs,clearCollaboration,fetchConversations,fetchMessages,fetchChatUsers,fetchChatRequests,fetchNotifications,
    sendChatMessage,createConversation,sendChatRequest,respondToChatRequest,deleteChatMessage,reactToChatMessage,pinChatMessage,
    closeConversation,markConversationRead,typingInConversation,markNotificationAsRead,markAllNotificationsAsRead}=collaboration;


  useEffect(() => {
    if (currentUser) {
      try {
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        setStorageItem('TS_ORBIT_USER_PROFILE', JSON.stringify(currentUser));
      } catch (e) {
      if (e instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw e; }
}
    } else {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('TS_ORBIT_USER_PROFILE');
    }
  }, [currentUser]);
  const [userRole, setUserRoleState] = useState<string>('');

  const clearPrivateState = () => {
    setProjects([]); setTasks([]); setTeamMembers([]); setUsers([]); setClients([]);
    setWpChecklist([]); setSeoChecklist([]); setContentCenter([]); setQaBugs([]); setFiles([]);
    setDepartmentReports([]); setDepartments([]); setDepartmentMembers([]); setDepartmentPermissions([]);
    setDepartmentModules([]); setDepartmentSettings([]); setDepartmentChats([]); setDepartmentChannels([]);
    setDepartmentRoles([]); setDepartmentTemplates([]); setNavigationGroups([]); setNavigationItems([]);
    setModuleDefinitions([]); setModuleInstances([]); setModulePermissions([]); setTeams([]);
    setApiLogs([]); setWpSites([]); setWpLogs([]); setWpWebhooks([]);
    setAutomationRules([]); setAutomationLogs([]); setActiveModules(prev=>prev.filter(m=>!m.isCustom)); clearCollaboration();
    setSelectedProjectState(NULL_PROJECT); setActiveTab('dashboard'); setActiveSubTab('overview'); setActiveView('dashboard');
    setActiveToast(null); setToastMessage(null); setHasPendingSync(false); disconnectSocket();
  };
  const acceptSession = (serverUser:any, preferredWorkspace?:string) => {
    clearPrivateState();
    const memberships=Array.isArray(serverUser.memberships) ? serverUser.memberships : [];
    const member=memberships.find((m:any)=>m.workspaceId===preferredWorkspace) || memberships[0];
    const workspaceId=member?.workspaceId || '';
    const role=member?.role || 'MEMBER';
    setApiIdentity(serverUser.id,workspaceId);
    setCurrentUser({...serverUser,role,workspaceRole:role});
    setUserRoleState(role); setIsAuthenticated(true); setActiveWorkspaceIdState(workspaceId);
  };
  useEffect(() => {
    const endSession=()=>{clearPrivateState();setCurrentUser(null);setUserRoleState('');setIsAuthenticated(false);setWorkspaces([]);setActiveWorkspaceIdState('');};
    const failure=(event:Event)=>{const error=(event as CustomEvent<ApiError>).detail;if(error.status===403 && error.code==='WORKSPACE_FORBIDDEN'){clearPrivateState();setApiIdentity(currentUser?.id || '','');setActiveWorkspaceIdState('');void fetchWorkspaces();}setOperationStatus('error');setIsLoading(false);setToastMessage({title:error.message,type:'error'});};
    const crossTab=(event:StorageEvent)=>{if(event.key==='token' && event.oldValue!==event.newValue){setApiIdentity('','',false);clearBusinessCaches();endSession();}};
    window.addEventListener('orbit:session-ended',endSession);window.addEventListener('orbit:api-error',failure);window.addEventListener('storage',crossTab);
    return()=>{window.removeEventListener('orbit:session-ended',endSession);window.removeEventListener('orbit:api-error',failure);window.removeEventListener('storage',crossTab);};
  }, [currentUser?.id,activeWorkspaceId]);


  // i18n and Theme support implementation
  const [locale, setLocaleState] = useState<Locale>(getLocale);
  // Formatting helpers and the translation layer read the module-level locale
  // while this render's children render, so it is updated before them.
  if (getLocale() !== locale) setActiveLocale(locale);
  useLayoutEffect(() => {
    if (locale === 'en') startDomTranslation(); else stopDomTranslation();
  }, [locale]);

  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('wp_manager_theme');
    return (saved === 'light' || saved === 'dark' || saved === 'system') ? saved : 'light';
  });

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    if (currentUser && currentUser.id) {
      try {
        const userSetKey = `userSettings_${currentUser.id}`;
        const currentSettings = JSON.parse(localStorage.getItem(userSetKey) || '{}');
        currentSettings.locale = newLocale;
        localStorage.setItem(userSetKey, JSON.stringify(currentSettings));
      } catch (e) {
      if (e instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw e; }

        console.error(e);
      }
    }
  };

  const setTheme = (newTheme: 'light' | 'dark' | 'system') => {
    setThemeState(newTheme);
    localStorage.setItem('wp_manager_theme', newTheme);
    if (currentUser && currentUser.id) {
      try {
        const userSetKey = `userSettings_${currentUser.id}`;
        const currentSettings = JSON.parse(localStorage.getItem(userSetKey) || '{}');
        currentSettings.theme = newTheme;
        localStorage.setItem(userSetKey, JSON.stringify(currentSettings));
      } catch (e) {
      if (e instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw e; }

        console.error(e);
      }
    }
  };

  const t = (key: string): string => {
    return getTranslation(locale, key);
  };

  // Direction and language follow the chosen locale on every screen. The theme
  // applies to the workspace; the sign-in page and the client portal style
  // themselves, so the document carries no theme class while signed out.
  useEffect(() => {
    const applyThemeAndLocale = () => {
      const root = document.documentElement;
      let actualTheme = theme;
      if (theme === 'system') {
        actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      root.classList.toggle('dark', isAuthenticated && actualTheme === 'dark');

      const dir = locale === 'fa' ? 'rtl' : 'ltr';
      root.setAttribute('dir', dir);
      root.setAttribute('lang', locale);
      document.body.style.direction = dir;
      document.body.style.textAlign = locale === 'fa' ? 'right' : 'left';
    };

    applyThemeAndLocale();

    if (theme === 'system' && isAuthenticated) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyThemeAndLocale();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme, locale, isAuthenticated]);

  // Load user settings on user changes
  useEffect(() => {
    if (currentUser && currentUser.id) {
      try {
        const userSetKey = `userSettings_${currentUser.id}`;
        const savedSettingsStr = localStorage.getItem(userSetKey);
        if (savedSettingsStr) {
          const savedSettings = JSON.parse(savedSettingsStr);
          if (savedSettings.locale) setLocaleState(savedSettings.locale);
          if (savedSettings.theme) setThemeState(savedSettings.theme);
        }
      } catch (e) {
      if (e instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw e; }

        console.error(e);
      }
    }
  }, [currentUser]);

  const [activeModules, setActiveModules] = useState<DynamicModule[]>(() => {
    const list = [
      { id: 'dashboard', name: 'داشبورد', icon: 'LayoutGrid', order: 1, enabled: true, accessRoles: [] },
      { id: 'projects', name: 'پروژه‌ها', icon: 'FolderGit', order: 2, enabled: true, accessRoles: [] },
      { id: 'tasks', name: 'وظایف', icon: 'CheckSquare', order: 3, enabled: true, accessRoles: [] },
      { id: 'uiux_module', name: 'طراحی UI/UX', icon: 'Palette', order: 4, enabled: true, accessRoles: [] },
      { id: 'wordpress_module', name: 'توسعه وردپرس', icon: 'Code', order: 5, enabled: true, accessRoles: [] },
      { id: 'content_module', name: 'محتوا', icon: 'FileText', order: 6, enabled: true, accessRoles: [] },
      { id: 'seo_module', name: 'سئو', icon: 'Compass', order: 7, enabled: true, accessRoles: [] },
      { id: 'qa_module', name: 'تست و کنترل کیفیت', icon: 'ShieldCheck', order: 8, enabled: true, accessRoles: [] },
      { id: 'files', name: 'فایل‌ها', icon: 'FileText', order: 9, enabled: true, accessRoles: [] },
      { id: 'reports', name: 'گزارش‌ها', icon: 'LineChart', order: 10, enabled: true, accessRoles: [] },
      { id: 'team_module', name: 'اعضای تیم', icon: 'Users', order: 11, enabled: true, accessRoles: [] },
      { id: 'clients_module', name: 'کارفرماها', icon: 'UserCheck2', order: 12, enabled: true, accessRoles: [] },
      { id: 'settings', name: 'تنظیمات سیستم', icon: 'Settings', order: 15, enabled: true, accessRoles: [] }
    ];
    return list;
  });

  useEffect(() => {
    // Module state is not restored from a global browser cache.
  }, [activeModules]);

  const addCustomModule = (name: string, icon: string, accessRoles: string[], customContent?: string) => {
    setActiveModules(prev => {
      const nextOrder = prev.length > 0 ? Math.max(...prev.map(m => m.order)) + 1 : 1;
      const newModule: DynamicModule = {
        id: `custom_${Date.now()}`,
        name,
        icon: icon || 'Sparkles',
        order: nextOrder,
        enabled: true,
        accessRoles: accessRoles || [],
        isCustom: true,
        customContent: customContent || 'محتوای دلخواه شما در این بخش قابل نمایش است.'
      };
      return [...prev, newModule].sort((a, b) => a.order - b.order);
    });
  };

  const removeModule = (id: string) => {
    setActiveModules(prev => prev.filter(m => m.id !== id));
  };

  const updateModule = (id: string, updates: Partial<DynamicModule>) => {
    setActiveModules(prev => {
      return prev.map(m => m.id === id ? { ...m, ...updates } : m).sort((a, b) => a.order - b.order);
    });
  };

  const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours (7,200,000 ms)

  const updateLastActive = () => {
    try {
      if (localStorage.getItem('isAuthenticated') === 'true') {
        localStorage.setItem('session_last_active', Date.now().toString());
      }
    } catch (apiFailure) {
      if (apiFailure instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw apiFailure; }
}
  };

  const checkSessionExpiry = (): boolean => {
    try {
      const isAuth = localStorage.getItem('isAuthenticated') === 'true';
      if (!isAuth) return false;

      const lastActive = localStorage.getItem('session_last_active');
      const now = Date.now();
      if (!lastActive || (now - Number(lastActive) > SESSION_TIMEOUT_MS)) {
        console.warn("Session expired due to 2 hours of inactivity.");
        clearCredential();
        setCurrentUser(null);
        setUserRoleState('');
        setIsAuthenticated(false);
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('TS_ORBIT_USER_PROFILE');
        localStorage.removeItem('userRole');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('session_last_active');
        return true;
      }
    } catch (e) {
      if (e instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw e; }

      console.error('Error checking session expiry:', e);
    }
    return false;
  };

  // Inactivity & Tab Visibility event listeners
  useEffect(() => {
    if (checkSessionExpiry()) {
      return;
    }

    let lastUpdate = 0;
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastUpdate > 10000) { // throttle to 10s
        lastUpdate = now;
        if (!checkSessionExpiry()) {
          updateLastActive();
        }
      }
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        if (!checkSessionExpiry()) {
          updateLastActive();
        }
      }
    };

    window.addEventListener('click', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);
    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    const intervalId = setInterval(() => {
      checkSessionExpiry();
    }, 60000);

    return () => {
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      clearInterval(intervalId);
    };
  }, []);

  // Session persistence on app boot. Only the server rejecting the sign-in (401)
  // ends it: a cold start, a 5xx or a dropped connection is retried, so reloading
  // the page never signs the user out.
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'offline' | 'ready'>(() => {
    try { return localStorage.getItem('token') ? 'checking' : 'ready'; } catch { return 'ready'; }
  });
  const [sessionAttempt, setSessionAttempt] = useState(0);
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;
    try { sessionStorage.setItem(VIEW_KEY, JSON.stringify({ userId: currentUser.id, tab: activeTab, subTab: activeSubTab })); } catch { /* storage unavailable */ }
  }, [isAuthenticated, currentUser?.id, activeTab, activeSubTab]);
  const retrySession = () => { setSessionStatus('checking'); setSessionAttempt(value => value + 1); };
  useEffect(() => {
    const query=new URLSearchParams(window.location.search);
    const portal=query.get('view')==='client'||query.has('portalToken')||query.has('token')||window.location.pathname.includes('/portal');
    if (portal || !localStorage.getItem('token')) { setSessionStatus('ready'); return; }
    const rememberedWorkspace=localStorage.getItem('activeWorkspaceId') || '';
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async (attempt: number) => {
      try {
        const data = await (await apiFetch('/api/auth/me')).json() as any;
        if (cancelled) return;
        if (!data?.user?.id) throw new ApiError(401, 'INVALID_SESSION', 'Invalid session response');
        acceptSession(data.user,rememberedWorkspace || data.user.personalWorkspaceId);
        // A reload returns to the page the user was on in this tab.
        try {
          const view = JSON.parse(sessionStorage.getItem(VIEW_KEY) || 'null');
          if (view?.userId === data.user.id && typeof view.tab === 'string') { setActiveTab(view.tab); setActiveSubTab(typeof view.subTab === 'string' ? view.subTab : ''); }
        } catch { /* no saved view */ }
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        setStorageItem('TS_ORBIT_USER_PROFILE', JSON.stringify(data.user));
        localStorage.setItem('userRole', data.user.role);
        localStorage.setItem('isAuthenticated', 'true');
        updateLastActive();
        setSessionStatus('ready');
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          clearCredential();
          setCurrentUser(null); setUserRoleState(''); setIsAuthenticated(false);
          setSessionStatus('ready');
          return;
        }
        if (attempt < 4) { timer = setTimeout(() => void check(attempt + 1), 1000 * 2 ** attempt); return; }
        setSessionStatus('offline');
      }
    };
    void check(0);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [sessionAttempt]);

  // Tehran Timezone Jalali Date Formatting Helper
  const getTehranJalaliFormattedDateTime = () => {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        timeZone: 'Asia/Tehran',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(now);
      let year = '', month = '', day = '', hour = '', minute = '';
      for (const p of parts) {
        if (p.type === 'year') year = p.value;
        if (p.type === 'month') month = p.value;
        if (p.type === 'day') day = p.value;
        if (p.type === 'hour') hour = p.value;
        if (p.type === 'minute') minute = p.value;
      }
      const dateStr = `${year}/${month}/${day}`;
      const timeStr = `${hour}:${minute}`;
      return { dateStr, timeStr };
    } catch (e) {
      if (e instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw e; }

      const now = new Date();
      return {
        dateStr: `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`,
        timeStr: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      };
    }
  };

  // Setup Socket.IO Real-time Connection
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id || !activeWorkspaceId) return;
    const socket = getSocket();
    if (!socket) return;
    socketRef.current = socket;

    const onTaskDomain = () => { void refreshTaskDomain().catch(reportApiError); };
    const onOrgDomain = () => { void fetchOrgData(); };
    const onPresence = () => { void fetchTeamMembers(); };
    const onWpSites = (updatedSites: WordPressSyncData[]) => {
      setWpSites(updatedSites);
    };

    const onWpLogs = (updatedLogs: any[]) => {
      setWpLogs(updatedLogs);
    };

    const onWpWebhooks = (updatedWebhooks: any[]) => {
      setWpWebhooks(updatedWebhooks);
    };

    socket.on('app_tasks_updated',onTaskDomain); socket.on('app_projects_updated',onTaskDomain); socket.on('org_data_updated',onOrgDomain); socket.on('org_updated',onOrgDomain); socket.on('app_org_updated',onOrgDomain);
    socket.on('wp_sites_updated', onWpSites);
    socket.on('wp_logs_updated', onWpLogs);
    socket.on('wp_webhooks_updated', onWpWebhooks);
    socket.on('online_status',onPresence);socket.on('connect',onPresence);socket.on('connect',onTaskDomain);socket.on('connect',onOrgDomain);

    return () => {
      socket.off('app_tasks_updated',onTaskDomain); socket.off('app_projects_updated',onTaskDomain); socket.off('org_data_updated',onOrgDomain); socket.off('org_updated',onOrgDomain); socket.off('app_org_updated',onOrgDomain);
      socket.off('wp_sites_updated', onWpSites);
      socket.off('wp_logs_updated', onWpLogs);
      socket.off('wp_webhooks_updated', onWpWebhooks);
      socket.off('online_status',onPresence);socket.off('connect',onPresence);socket.off('connect',onTaskDomain);socket.off('connect',onOrgDomain);
    };
  }, [isAuthenticated,currentUser?.id,activeWorkspaceId]);

  // Sync WordPress gateway initially on mount
  useEffect(() => {
    const fetchWpHub = async () => {
      try {
        const res = await apiFetch('/api/sites/status');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.sites) && data.sites.length > 0) setWpSites(data.sites);
          if (data && Array.isArray(data.logs)) setWpLogs(data.logs);
          if (data && Array.isArray(data.webhooks)) setWpWebhooks(data.webhooks);
        }
      } catch {
        // Retain initial data silently on network failure
      }
    };
    if (isAuthenticated && activeWorkspaceId) fetchWpHub();
  }, [isAuthenticated,activeWorkspaceId]);

  const getRoleLabel = (r: string) => roleLabel(r, locale === 'en' ? 'en' : 'fa');

  const setUserRole = (_role: string) => {
    reportApiError(new ApiError(403,'ROLE_SWITCH_DISABLED','نقش کاربری تنها توسط سرور و عضویت فضای کاری تعیین می‌شود.'));
  };

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      if (!res.ok) {
        throw new Error("UNAUTHORIZED");
      }
      const data = await res.json();
      const userObj = data.user;
      if (!userObj?.id || !data.token) throw new Error('Invalid authentication response');
      setCurrentUser(userObj);
      setUserRoleState(userObj.role || 'USER');
      setIsAuthenticated(true);
      localStorage.setItem('currentUser', JSON.stringify(userObj));
      setStorageItem('TS_ORBIT_USER_PROFILE', JSON.stringify(userObj));
      localStorage.setItem('userRole', userObj.role || 'USER');
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('session_last_active', Date.now().toString());
      if (data.token) localStorage.setItem('token', data.token);
      acceptSession(data.user,data.workspace?.id || data.user.personalWorkspaceId);

      logApiAction('POST', '/api/auth/login', 200, { success: true, userId: userObj.id }, { identifier });
      setIsLoading(false);
      return true;
    } catch {
      setIsLoading(false);
      logApiAction('POST', '/api/auth/login', 401, { error: "INVALID_CREDENTIALS", message: "شناسه کاربری، ایمیل یا رمز عبور اشتباه است" });
      return false;
    }
  };

  const register = async (email: string, password: string, name: string, phone: string, requestedRole: string = 'OWNER', username?: string) => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, phone, ...(username ? {username} : {}) })
      });
      if (!res.ok) {
        throw new Error("REGISTRATION_FAILED");
      }
      const data = await res.json();
      
      if (data.pendingApproval) {
        setIsLoading(false);
        logApiAction('POST', '/api/auth/register', 201, { success: true }, { email, name, phone, username, role: requestedRole });
        return { success: true, pendingApproval: true, message: data.message };
      }

      const userObj = data.user;
      if (!userObj?.id || !data.token) throw new Error('Invalid authentication response');
      setCurrentUser(userObj);
      setUserRoleState(userObj.role || 'USER');
      setIsAuthenticated(true);
      localStorage.setItem('currentUser', JSON.stringify(userObj));
      setStorageItem('TS_ORBIT_USER_PROFILE', JSON.stringify(userObj));
      localStorage.setItem('userRole', userObj.role || 'USER');
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('session_last_active', Date.now().toString());
      if (data.token) localStorage.setItem('token', data.token);
      // Same as sign-in: select the new personal workspace and its owner role, so
      // the first project can be created without reloading the page.
      acceptSession(data.user, data.workspace?.id || data.user.personalWorkspaceId);

      logApiAction('POST', '/api/auth/register', 201, { success: true }, { email, name, phone, username, role: requestedRole });
      setIsLoading(false);
      return { success: true, pendingApproval: false, user: userObj };
    } catch {
      setIsLoading(false);
      return { success: false };
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      // Ending the server session is best effort; this device signs out and shows
      // the sign-in page even when the server cannot be reached.
      await apiFetch('/api/auth/logout',{method:'POST',body:'{}'}).catch(() => undefined);
    } finally { clearCredential(); setIsLoading(false); }
  };

  const updateProfile = async (name: string, phone: string, avatar?: string, bio?: string, email?: string, jobTitle?: string, currentPassword?: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await apiFetch('/api/auth/profile/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ name, phone, avatar, bio, email, jobTitle, ...(currentPassword ? {currentPassword} : {}) })
      });
      if (!res.ok) throw new Error('Profile update failed');
      const data = await res.json();
      if(data.requiresLogin){sessionStorage.setItem('orbit_auth_notice','شناسه ورود تغییر کرد؛ برای ادامه دوباره وارد شوید.');clearCredential();return true;}
      const updatedUser = data.user;
      setCurrentUser({...updatedUser,role:userRole,workspaceRole:userRole});
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      addNotification("بروزرسانی حساب", "مشخصات کاربری شما با موفقیت بروزرسانی شد.", "project_updated");
      return true;
    } catch (err) {
      console.error(err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserRole = async (targetUserId: string, newRole: string) => {
    setIsLoading(true);
    setOperationStatus('loading');
    try {
      const token = localStorage.getItem('token');
      const res = await apiFetch(`/api/users/${targetUserId}/role`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update role");
      }
      const data = await res.json();
      
      // Update team list locally
      setTeamMembers(prev => prev.map(m => m.id === targetUserId ? { 
        ...m, 
        role: newRole,
        department: (newRole === 'OWNER' || newRole === 'ADMIN' || newRole === 'PROJECT_MANAGER') ? 'management' : 
                    newRole === 'DEVELOPER' ? 'wp_dev' : 
                    newRole === 'CLIENT' ? 'client_approval' : 'user'
      } : m));

      setOperationStatus('success');
      addNotification(
        "بروزرسانی نقش کاربر",
        `نقش سازمانی کاربر با موفقیت به ${getRoleLabel(newRole)} تغییر یافت.`,
        "project_updated"
      );
      return { success: true };
    } catch (err: any) {
      console.error(err);
      setOperationStatus('error');
      addNotification(
        "خطا در تغییر نقش",
        err.message || "امکان تغییر نقش برای این کاربر وجود ندارد.",
        "deadline_warning"
      );
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  const logApiAction = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', endpoint: string, status: number, response: any, payload?: any) => {
    const newLog: ApiLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toLocaleTimeString('fa-IR'),
      method,
      endpoint,
      status,
      payload: redactClientLog(payload),
      response: redactClientLog(response)
    };
    setApiLogs(prev => [newLog, ...prev].slice(0, 50)); // keep last 50 logs
  };

  // Helper to sync overall project stats based on sub-components tasks
  const syncProjectProgress = (currentTasks: Task[]) => {
    setProjects(prevProjects => {
      const updated = prevProjects.map(p => {
        const projTasks = currentTasks.filter(t => t.projectId === p.id);
        const totalCount = projTasks.length;
        const completedCount = projTasks.filter(t => t.status === 'completed').length;
        const computedPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        return {
          ...p,
          totalTasks: totalCount,
          completedTasks: completedCount,
          progress: computedPercentage
        };
      });
      
      // Update selected project as well to reflect progress live
      setSelectedProjectState(prevSel => {
        if (!prevSel || prevSel.id === 'no_project') return prevSel;
        const fresh = updated.find(p => p.id === prevSel.id);
        return fresh || prevSel;
      });
      return updated;
    });
  };

  const setSelectedProject = (project: Project) => {
    if (!project || project.id === 'no_project') {
      setSelectedProjectState(NULL_PROJECT);
      try { localStorage.removeItem('agency_selected_project_id'); } catch (apiFailure) {
      if (apiFailure instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw apiFailure; }
}
      return;
    }
    setSelectedProjectState(project);
    try { setStorageItem('agency_selected_project_id', project.id); } catch (apiFailure) {
      if (apiFailure instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw apiFailure; }
}
    logApiAction('GET', `/api/projects/${project.id}`, 200, project);
  };

  const deleteProject = async (projectId: string) => {
    setIsLoading(true);
    setOperationStatus('loading');
    try {
      const token = localStorage.getItem('token');
      try {
        await apiFetch(`/api/projects/${projectId}`, {
          method: 'DELETE',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
      } catch (e) {
      if (e instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw e; }

        console.error("API delete project error:", e);
      }

      setProjects(prev => {
        const next = prev.filter(p => p.id !== projectId);
        try { setStorageItem('agency_projects', JSON.stringify(next)); } catch (apiFailure) {
      if (apiFailure instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw apiFailure; }
}

        if (selectedProject?.id === projectId) {
          if (next.length > 0) {
            setSelectedProjectState(next[0]);
            try { setStorageItem('agency_selected_project_id', next[0].id); } catch (apiFailure) {
      if (apiFailure instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw apiFailure; }
}
          } else {
            setSelectedProjectState(NULL_PROJECT);
            try { localStorage.removeItem('agency_selected_project_id'); } catch (apiFailure) {
      if (apiFailure instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw apiFailure; }
}
          }
        }
        return next;
      });

      setTasks(prev => {
        const next = prev.filter(t => t.projectId !== projectId);
        try { setStorageItem('agency_tasks', JSON.stringify(next)); } catch (apiFailure) {
      if (apiFailure instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw apiFailure; }
}
        return next;
      });

      setFiles(prev => {
        const next = prev.filter(f => f.projectId !== projectId);
        try { setStorageItem('agency_files', JSON.stringify(next)); } catch (apiFailure) {
      if (apiFailure instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw apiFailure; }
}
        return next;
      });

      setOperationStatus('success');
      addNotification(
        "حذف پروژه",
        "پروژه با موفقیت از سیستم حذف گردید.",
        "project_updated"
      );
      logApiAction('DELETE', `/api/projects/${projectId}`, 200, { success: true, id: projectId });
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      setOperationStatus('error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetDatabaseToZero = () => {
    clearBusinessCaches();clearPrivateState();
    void refreshAllData();
  };
  const simulateDelay = async (ms = 400) => {
    setIsLoading(true);
    setOperationStatus('loading');
    await new Promise(resolve => setTimeout(resolve, ms));
    setIsLoading(false);
  };

  // Server responses are the source of truth for task, comment and progress totals.
  const refreshTaskDomain = async () => {
    const projectSequence=++projectFetchSequence.current;
    const [taskRes, projectRes] = await Promise.all([apiFetch('/api/tasks'),apiFetch('/api/projects')]);
    const [savedTasks,savedProjects] = await Promise.all([taskRes.json(),projectRes.json()]);
    setTasks(savedTasks);
    if(projectSequence===projectFetchSequence.current){setProjects(savedProjects);setSelectedProjectState(previous => savedProjects.find((project:Project) => project.id===previous?.id) || previous);}
  };
  const taskMutation = async (path:string,method:string,body?:any) => {
    setIsLoading(true); setOperationStatus('loading');
    try {
      const response=await apiFetch(path,{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
      const saved=await response.json();
      await refreshTaskDomain(); setOperationStatus('success'); return saved;
    } catch(error) { setOperationStatus('error'); throw error; }
    finally { setIsLoading(false); }
  };
  const createTask = async (input:Omit<Task,'id'>) => {
    await taskMutation('/api/tasks','POST',taskTransport(input));
    triggerSuccessEvent('وظیفه جدید ذخیره شد',input.title);
  };
  const addTask = async (input:Task) => { await createTask(input); };
  const updateTaskStatus = async (id:string,status:TaskStatus) => { await taskMutation('/api/tasks/'+id+'/status','PUT',{status:taskStatus(status)}); };
  const updateTask = async (id:string,updates:Partial<Task>) => taskMutation('/api/tasks/'+id,'PUT',taskTransport(updates));
  const deleteTask = async (id:string) => { await taskMutation('/api/tasks/'+id,'DELETE'); };
  const addTaskComment = async (id:string,content:string) => { await taskMutation('/api/tasks/'+id+'/comments','POST',{content}); };
  const addTaskTimeEntry = async (id:string,hours:number,note:string) => { await taskMutation('/api/tasks/'+id+'/time-entries','POST',{hours,note}); };

  // 2. WordPress Checklist Mutations
  const updateWpChecklistItem = async (itemId: string, updates: Partial<WordPressChecklistItem>) => {
    setIsLoading(true);
    setOperationStatus('loading');
    try {
      const token = localStorage.getItem('token');
      const res = await apiFetch(`/api/wordpress-checklist/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed to update WordPress checklist');
      const updatedItem = await res.json();

      setWpChecklist(prev => {
        const idx = prev.findIndex(item => item.id === itemId);
        if (idx < 0) return prev;
        const list = [...prev];
        list[idx] = updatedItem;
        return list;
      });
      logApiAction('PUT', `/api/wordpress-checklist/${itemId}`, 200, updatedItem, updates);
      setOperationStatus('success');
    } catch (err: any) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      setOperationStatus('error');
      logApiAction('PUT', `/api/wordpress-checklist/${itemId}`, 500, { error: err.message }, updates);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // 3. SEO Checklist Mutations
  const updateSeoChecklistItem = async (itemId: string, updates: Partial<SeoChecklistItem>) => {
    setIsLoading(true);
    setOperationStatus('loading');
    try {
      const token = localStorage.getItem('token');
      const res = await apiFetch(`/api/seo-checklist/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed to update SEO checklist');
      const updatedItem = await res.json();

      setSeoChecklist(prev => {
        const idx = prev.findIndex(item => item.id === itemId);
        if (idx < 0) return prev;
        const list = [...prev];
        list[idx] = updatedItem;
        return list;
      });
      logApiAction('PUT', `/api/seo-checklist/${itemId}`, 200, updatedItem, updates);
      setOperationStatus('success');
    } catch (err: any) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      setOperationStatus('error');
      logApiAction('PUT', `/api/seo-checklist/${itemId}`, 500, { error: err.message }, updates);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Content Center Mutations
  const updateContentStatus = async (contentId: string, status: ContentItem['status'], approval?: ContentItem['approvalStatus']) => {
    setIsLoading(true);
    setOperationStatus('loading');
    try {
      const res = await apiFetch(`/api/content-center/${contentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, approvalStatus: approval })
      });
      if (!res.ok) throw new Error('Failed to update content status');
      const updatedItem = await res.json();

      setContentCenter(prev => {
        const idx = prev.findIndex(c => c.id === contentId);
        if (idx < 0) return prev;
        
        const list = [...prev];
        list[idx] = updatedItem;
        return list;
      });
      logApiAction('PUT', `/api/content-center/${contentId}`, 200, updatedItem, { status, approval });
      setOperationStatus('success');
    } catch (err: any) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      setOperationStatus('error');
      logApiAction('PUT', `/api/content-center/${contentId}`, 500, { error: err.message }, { status, approval });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const createContentItem = async (itemInput: Omit<ContentItem, 'id'>) => {
    setIsLoading(true);
    setOperationStatus('loading');
    try {
      const res = await apiFetch('/api/content-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemInput)
      });
      if (!res.ok) throw new Error('Failed to create content item');
      const newItem = await res.json();

      setContentCenter(prev => [...prev, newItem]);
      logApiAction('POST', '/api/content-center', 201, newItem, itemInput);
      setOperationStatus('success');
    } catch (err: any) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      setOperationStatus('error');
      logApiAction('POST', '/api/content-center', 500, { error: err.message }, itemInput);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // 5. QA Mutations
  const createQaBug = async (bugInput: Omit<QaBug, 'id' | 'dateLogged'>) => {
    setIsLoading(true);
    setOperationStatus('loading');
    try {
      const res = await apiFetch('/api/qa-bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bugInput)
      });
      if (!res.ok) throw new Error('Failed to create bug');
      const newBug = await res.json();

      setQaBugs(prev => [...prev, newBug]);
      logApiAction('POST', '/api/qa-bugs', 201, newBug, bugInput);
      setOperationStatus('success');
    } catch (err: any) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      setOperationStatus('error');
      logApiAction('POST', '/api/qa-bugs', 500, { error: err.message }, bugInput);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateQaBugStatus = async (bugId: string, status: QaBug['status']) => {
    setIsLoading(true);
    setOperationStatus('loading');
    try {
      const res = await apiFetch(`/api/qa-bugs/${bugId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Failed to update bug status');
      const updatedBug = await res.json();

      setQaBugs(prev => {
        const idx = prev.findIndex(b => b.id === bugId);
        if (idx < 0) return prev;
        const list = [...prev];
        list[idx] = updatedBug;
        return list;
      });
      logApiAction('PUT', `/api/qa-bugs/${bugId}`, 200, updatedBug, { status });
      setOperationStatus('success');
    } catch (err: any) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      setOperationStatus('error');
      logApiAction('PUT', `/api/qa-bugs/${bugId}`, 500, { error: err.message }, { status });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Persisted assets and feedback are shared by every view.
  const fileFetchSequence=useRef(0);
  const assetIdentity=()=>JSON.stringify(getApiIdentity());
  const requireAssetIdentity=(identity:string)=>{if(identity!==assetIdentity())throw new ApiError(0,'STALE_REQUEST','نشست یا فضای کاری تغییر کرده است.');};
  const fetchFiles = async()=>{const identity=assetIdentity(),sequence=++fileFetchSequence.current;const response=await apiFetch('/api/files');const files=await response.json();requireAssetIdentity(identity);if(sequence===fileFetchSequence.current)setFiles(files);};
  useEffect(()=>{fileFetchSequence.current++;if(!isAuthenticated||!activeWorkspaceId)return;void fetchFiles().catch(()=>{});const refresh=()=>{void fetchFiles().catch(()=>{});};window.addEventListener('orbit:assets-updated',refresh);const socket=getSocket();socket?.on('app_files_updated',refresh);socket?.on('connect',refresh);return()=>{fileFetchSequence.current++;window.removeEventListener('orbit:assets-updated',refresh);socket?.off('app_files_updated',refresh);socket?.off('connect',refresh);};},[isAuthenticated,currentUser?.id,activeWorkspaceId]);
  const uploadFile = async(input:any)=>{if(!(input.file instanceof Blob))throw new Error('یک فایل انتخاب کنید.');const identity=assetIdentity();await uploadAsset(input.file,{name:input.name,projectId:input.projectId || (selectedProject?.id!=='no_project'?selectedProject?.id:undefined),category:input.category,tag:input.tag});requireAssetIdentity(identity);await fetchFiles();};
  const deleteFileAsset = async(id:string)=>{const identity=assetIdentity();await apiFetch('/api/files/'+encodeURIComponent(id),{method:'DELETE'});requireAssetIdentity(identity);await fetchFiles();requireAssetIdentity(identity);window.dispatchEvent(new Event('orbit:assets-updated'));};
  const refreshFeedback = async(projectId:string)=>{const identity=assetIdentity();const response=await apiFetch('/api/projects/'+encodeURIComponent(projectId)+'/feedbacks');const feedback=await response.json();requireAssetIdentity(identity);setProjects(previous=>previous.map(project=>project.id===projectId?{...project,clientFeedbacks:feedback}:project));setSelectedProjectState(previous=>previous.id===projectId?{...previous,clientFeedbacks:feedback}:previous);return feedback;};
  const submitClientFeedback = async(clientId:string,feedbackContent:string)=>{const identity=assetIdentity();await apiFetch('/api/client-feedback',{method:'POST',body:JSON.stringify({clientId,feedbackContent})});requireAssetIdentity(identity);await fetchProjects();};
  const approveClientFeedback = async(projectId:string,feedbackId:string)=>{const identity=assetIdentity();await apiFetch('/api/projects/'+encodeURIComponent(projectId)+'/feedbacks/'+encodeURIComponent(feedbackId)+'/status',{method:'PUT',body:JSON.stringify({status:'approved'})});requireAssetIdentity(identity);await refreshFeedback(projectId);};
  const saveProjectPortal=async(projectId:string,method:'PUT'|'POST'|'DELETE',path:'/portal'|'/portal-token',body?:unknown):Promise<Project>=>commitPortalChange(projectId,method,path,body,saved=>{
    projectFetchSequence.current++;
    setProjects(previous=>previous.map(project=>project.id===projectId?{...project,...saved}:project));
    setSelectedProjectState(previous=>previous.id===projectId?{...previous,...saved}:previous);
  });
  const toggleClientPortal = async(projectId:string,enabled:boolean)=>{await saveProjectPortal(projectId,'PUT','/portal',{enabled});await fetchProjects();};
  const regenerateClientToken = async(projectId:string)=>{const identity=assetIdentity();const saved=await saveProjectPortal(projectId,'POST','/portal-token',{});await fetchProjects();requireAssetIdentity(identity);return saved.portalToken||saved.clientPortalToken;};
  const addClientFeedback = async(projectId:string,input:any)=>{const identity=assetIdentity();await apiFetch('/api/projects/'+encodeURIComponent(projectId)+'/feedbacks',{method:'POST',body:JSON.stringify({message:input.message,category:input.category,attachments:input.attachments || []})});requireAssetIdentity(identity);await refreshFeedback(projectId);};
  const updateFeedbackStatus = async(projectId:string,feedbackId:string,status:ClientFeedback['status'])=>{const identity=assetIdentity();await apiFetch('/api/projects/'+encodeURIComponent(projectId)+'/feedbacks/'+encodeURIComponent(feedbackId)+'/status',{method:'PUT',body:JSON.stringify({status})});requireAssetIdentity(identity);await refreshFeedback(projectId);};
  const deleteFeedback = async(projectId:string,feedbackId:string)=>{const identity=assetIdentity();await apiFetch('/api/projects/'+encodeURIComponent(projectId)+'/feedbacks/'+encodeURIComponent(feedbackId),{method:'DELETE'});requireAssetIdentity(identity);await refreshFeedback(projectId);};

  const projectTransport = (project: Partial<Project>) => {
    const fields=['title','name','description','budget','clientName','deadline','websiteUrl','teamLead','teamLeadId','assignedMemberIds','assignedTeamIds','isBudgetConfidential','isConfidential','selectedTeams','department','category','dueDate','priority','status','statusReason','startDate'];
    return Object.fromEntries(Object.entries(project).filter(([key])=>fields.includes(key)));
  };
  // 8. WordPress Site Actions
  const createProject = async (
    title: string, 
    description: string, 
    budget: string = "", 
    deadline: string = "", 
    clientName: string = "", 
    websiteUrl: string = "",
    teamLead: string = "",
    isBudgetConfidential: boolean = false,
    extraData?: {
      teamLeadId?: string;
      assignedMemberIds?: string[];
      assignedTeamIds?: string[];
      createdById?: string;
    }
  ) => {
    setIsLoading(true);
    setOperationStatus('loading');
    try {
      const effectiveTeamLeadId = extraData?.teamLeadId || teamLead;
      const effectiveAssignedMemberIds = extraData?.assignedMemberIds || (effectiveTeamLeadId ? [effectiveTeamLeadId] : []);
      const effectiveAssignedTeamIds = extraData?.assignedTeamIds || [];
      const effectiveCreatedById = extraData?.createdById || currentUser?.id || 'admin';

      const postPayload = {
        title,
        description,
        deadline,
        budget,
        clientName,
        websiteUrl,
        teamLead,
        teamLeadId: effectiveTeamLeadId,
        assignedMemberIds: effectiveAssignedMemberIds,
        assignedTeamIds: effectiveAssignedTeamIds,
        isBudgetConfidential
      };

      const response = await apiFetch('/api/projects', {
        method: 'POST', headers: { ...getAuthHeaders(), 'x-workspace-id': activeWorkspaceId },
        body: JSON.stringify(projectTransport(postPayload))
      });
      const saved = await response.json();
      if (!response.ok || !saved?.id) throw new Error(saved?.message || 'پروژه ذخیره نشد.');
      let newProj: Project = saved;
      const token = newProj.portalToken || newProj.clientPortalToken || '';
      newProj = {
        ...newProj,
        clientPortalEnabled: newProj.clientPortalEnabled === true,
        isPortalActive: newProj.isPortalActive === true,
        clientPortalToken: token,
        portalToken: token
      };

      setProjects(prev => {
        const updated = [newProj, ...prev];
        try { setStorageItem('agency_projects', JSON.stringify(updated)); } catch (apiFailure) {
      if (apiFailure instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw apiFailure; }
}
        return updated;
      });
      setSelectedProject(newProj);
      try { setStorageItem('agency_selected_project_id', newProj.id); } catch (apiFailure) {
      if (apiFailure instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw apiFailure; }
}
      setOperationStatus('success');
      
triggerSuccessEvent(
        "پروژه جدید با موفقیت ثبت شد",
        `پروژه «${title}» به کارگاه اضافه و پایدار گردید.`
      );
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error(err);
      setOperationStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const addProject = async (newProject: Project) => {
    const response = await apiFetch('/api/projects', {
      method: 'POST', headers: { ...getAuthHeaders(), 'x-workspace-id': activeWorkspaceId },
      body: JSON.stringify(projectTransport(newProject)),
    });
    const saved = await response.json();
    if (!response.ok || !saved?.id) throw new Error(saved?.message || 'پروژه ذخیره نشد؛ دوباره تلاش کنید.');
    setProjects(prev => [saved, ...prev.filter(project => project.id !== saved.id)]);
    setSelectedProject(saved);
    triggerSuccessEvent('پروژه با موفقیت ایجاد شد', `پروژه «${saved.title}» ذخیره شد.`);
  };

  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    setIsLoading(true);
    setOperationStatus('loading');
    try {
      const response = await apiFetch(`/api/projects/${projectId}`, {
        method: 'PUT', headers: { ...getAuthHeaders(), 'x-workspace-id': activeWorkspaceId },
        body: JSON.stringify(projectTransport(updates))
      });
      const result = await response.json();
      if (!response.ok || !result?.project?.id) throw new Error(result?.message || 'تغییرات پروژه ذخیره نشد.');
      const savedProject = result.project;

      setProjects(prev => {
        const updated = prev.map(p => p.id === projectId ? savedProject : p);
        return updated;
      });

      if (selectedProject?.id === projectId) {
        setSelectedProjectState(savedProject);
      }

      triggerSuccessEvent(
        "اطلاعات پروژه به‌روزرسانی شد",
        `پروژه با موفقیت ویرایش و پایدار گردید.`
      );
      setOperationStatus('success');
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error(err);
      setOperationStatus('error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const activateProject = async (projectId: string) => {
    setIsLoading(true);
    setOperationStatus('loading');
    try {
      const res = await apiFetch(`/api/projects/${projectId}/activate`, {
        method: 'PUT'
      });
      if (!res.ok) throw new Error("Failed to activate project");
      const data = await res.json();
      const updatedProj = data.project;

      setProjects(prev => prev.map(p => p.id === projectId ? updatedProj : p));
      setSelectedProject(updatedProj);
      setOperationStatus('success');
      addNotification(
        "پروژه با موفقیت فعال شد",
        `پروژه فعال گردید و پیشخوان آماده ردیابی است.`,
        "project_updated"
      );
      return true;
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error(err);
      setOperationStatus('error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const syncWordPressSite = async (projectId: string) => {
    setIsLoading(true);
    setOperationStatus('loading');
    try {
      const res = await apiFetch('/api/sites/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });
      if (!res.ok) throw new Error("Sync operation rejected");
      const data = await res.json();
      logApiAction('POST', '/api/sites/sync', 200, data, { projectId });
      setOperationStatus('success');

      // Trigger automatic sync rules simulation
      const siteName = data?.siteName || "آریا تجارت";
      const siteUrl = data?.siteUrl || "https://arya-commerce.ir";
      await runAutomationEngine('seo_activated', { status: "active", siteName, siteUrl });
      await runAutomationEngine('ssl_activated', { status: true, siteName, siteUrl });
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error(err);
      setOperationStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const registerWordPressSite = async (siteInput: any) => {
    setIsLoading(true);
    setOperationStatus('loading');
    try {
      const payload = {
        projectId: siteInput.projectId || selectedProject.id,
        siteUrl: siteInput.url || siteInput.siteUrl || "",
        siteName: siteInput.name || siteInput.siteName || "",
        wpVersion: siteInput.coreVersion || "6.5.3",
        themeName: siteInput.activeTheme || "Flatsome",
        themeVersion: "3.18.3",
        serverType: "Nginx",
        sslStatus: "فعال"
      };
      const res = await apiFetch('/api/sites/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Registration failed");
      const data = await res.json();
      logApiAction('POST', '/api/sites/connect', 201, data, payload);
      setOperationStatus('success');

      // Do not auto-generate mock tasks/checklists on connection. State remains empty for manual setup.
      const connectedProjId = payload.projectId;
      logApiAction('POST', '/api/sites/connect', 201, data, payload);
      setOperationStatus('success');
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error(err);
      setOperationStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWordPressSite = async (projectId: string) => {
    setIsLoading(true);
    setOperationStatus('loading');
    try {
      const res = await apiFetch('/api/sites/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });
      if (!res.ok) throw new Error("Disconnect request failed");
      const data = await res.json();
      logApiAction('POST', '/api/sites/disconnect', 200, data, { projectId });
      setOperationStatus('success');
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error(err);
      setOperationStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerWebhookMock = async (siteUrl: string, event: string, payload: any) => {
    setIsLoading(true);
    setOperationStatus('loading');
    try {
      const res = await apiFetch('/api/sites/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, event, payload })
      });
      if (!res.ok) throw new Error("Webhook trigger failed");
      const data = await res.json();
      logApiAction('POST', '/api/sites/webhook', 200, data, { siteUrl, event, payload });
      setOperationStatus('success');

      // Detect and run respective automation triggers
      let triggerType: TriggerType | null = null;
      if (event === 'page_published' || event === 'page_created') {
        triggerType = 'page_published';
      } else if (event === 'plugin_installed' || event === 'plugin_activated') {
        triggerType = 'plugin_installed';
      } else if (event === 'product_added' || event === 'product_created') {
        triggerType = 'product_count_gt';
      }

      if (triggerType) {
        await runAutomationEngine(triggerType, payload);
      }
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error(err);
      setOperationStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  // 9. Custom Mock Console endpoint triggers
  const triggerManualMockRequest = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', endpoint: string, payload?: any) => {
    if(!endpoint.startsWith('/api/')||endpoint.startsWith('//'))throw new ApiError(422,'INVALID_ENDPOINT','تنها مسیرهای API محلی مجاز هستند.');
    setIsLoading(true);setOperationStatus('loading');
    try{
      const response=await apiFetch(endpoint,{method,...(method==='GET'?{}:{body:JSON.stringify(payload || {})})});
      const data=await response.json();
      logApiAction(method,endpoint,response.status,data,payload);
      setOperationStatus('success');return data;
    } catch(error){setOperationStatus('error');throw error;}
    finally{setIsLoading(false);}
  };
  // --- AUTOMATION ENGINE AND SCORING GETTERS ---

  // Create automation rule
  const createAutomationRule = (ruleInput: Omit<AutomationRule, 'id' | 'runCount' | 'isSystem'>) => {
    const newRule: AutomationRule = {
      ...ruleInput,
      id: `rule_user_${Date.now()}`,
      runCount: 0,
      isSystem: false
    };
    setAutomationRules(prev => [newRule, ...prev]);
    logApiAction('POST', '/api/automations/rules', 201, newRule, ruleInput);
  };

  // Toggle automation rule active status
  const toggleAutomationRule = (ruleId: string) => {
    setAutomationRules(prev => prev.map(r => r.id === ruleId ? { ...r, isActive: !r.isActive } : r));
    logApiAction('PUT', `/api/automations/rules/${ruleId}/toggle`, 200, { ruleId });
  };

  // Delete automation rule
  const deleteAutomationRule = (ruleId: string) => {
    setAutomationRules(prev => prev.filter(r => r.id !== ruleId));
    logApiAction('DELETE', `/api/automations/rules/${ruleId}`, 200, { ruleId });
  };

  // Local operation feedback is a toast; only server events create durable notifications.
  const addNotification = (title: string, description: string, _type: AppNotification['type']) => {
    setToastMessage({title,description,type:'info'});
  };

  // Helper: autoGenerateProjectTasks disabled by system rules
  const autoGenerateProjectTasks = async (projectId: string) => {
    setIsLoading(true);
    await timerDelay(300);
    setIsLoading(false);
    addNotification(
      "خطای خودکارسازی وظایف",
      "سیستم خودکار تولید وظیفه غیرفعال شده است. کلیه وظایف باید به طور دستی توسط صاحب سیستم یا مدیر پروژه تعریف گردند.",
      "deadline_warning"
    );
  };

  const timerDelay = (ms: number) => new Promise(res => setTimeout(res, ms));

  // Client automated notification alerts generator
  const generateClientNotificationSim = (type: 'milestone' | 'approval' | 'connect' | 'launch' | 'delay', message: string) => {
    const typeFarsi = {
      milestone: "تکمیل مایلستون نهایی",
      approval: "نیاز به بازخورد و تایید کارفرما",
      connect: "اتصال موفق هاب وردپرس",
      launch: "آماده راه‌اندازی و لانچ",
      delay: "هشدار تاخیر در سررسید پروژه"
    };
    
    addNotification(
      `اعلان کارفرما: ${typeFarsi[type]}`,
      `درخواست محلی: "${message}"؛ ارسال ایمیل در این مرحله فعال نیست.`,
      "approval_needed"
    );

    // External delivery is implemented in the integrations stage.
  };

  // Reporting automation simulator
  const generateReportSim = (reportingPeriod: 'weekly' | 'monthly' | 'project' | 'performance') => {
    const reportId = `rep_${reportingPeriod}_${Date.now()}`;
    const reportData = {
      id: reportId,
      timestamp: new Date().toLocaleDateString('fa-IR') + ' ' + new Date().toLocaleTimeString('fa-IR'),
      period: reportingPeriod,
      title: reportingPeriod === 'weekly' ? "گزارش هفتگی بهره‌وری کارگاه" :
             reportingPeriod === 'monthly' ? "گزارش ماهانه عملکرد سئو و آژانس" :
             reportingPeriod === 'project' ? "گزارش جامع وضعیت پیشرفت پروژه فعال" : "گزارش تفصیلی سرعت و عملکرد وردپرس"
    };
    
    addNotification(
      "گزارش خودکار تولید شد",
      `سند تعاملی "${reportData.title}" با موفقیت گردآوری شد.`,
      "file_uploaded"
    );

    logApiAction('POST', `/api/automations/reports/generate`, 201, reportData, { reportingPeriod });
    return reportData;
  };

  // Dynamic Website Readiness Score calculation from: Content, SEO, Performance, Security, Development, QA, Launch
  const readinessScoreCategory = React.useMemo(() => {
    const safeContentCenter = contentCenter || [];
    const safeSeoChecklist = seoChecklist || [];
    const safeTasks = tasks || [];
    const safeWpChecklist = wpChecklist || [];
    const safeQaBugs = qaBugs || [];

    const totalCont = safeContentCenter.length || 1;
    const pubCont = safeContentCenter.filter(c => c && c.status === 'published').length;
    const contentScore = Math.min(100, Math.round((pubCont / totalCont) * 100));

    const totalSeo = safeSeoChecklist.length || 1;
    const compSeo = safeSeoChecklist.filter(s => s && s.status === 'completed').length;
    const seoScore = Math.min(100, Math.round((compSeo / totalSeo) * 100));

    const aryaSite = (wpSites || []).find(s => s && s.projectId === 'proj_1');
    const responseMs = aryaSite?.performanceMetrics?.responseTimeMs || 140;
    const perfScore = Math.max(20, Math.min(100, 100 - Math.round((responseMs - 80) / 2)));

    const backActive = aryaSite?.backupStatus && aryaSite.backupStatus !== 'غیرفعال';
    const secActive = aryaSite?.securityPluginStatus && aryaSite.securityPluginStatus !== 'غیرفعال';
    const sslActive = aryaSite?.sslStatus && aryaSite.sslStatus.includes('فعال');
    let secScore = 20;
    if (sslActive) secScore += 30;
    if (secActive) secScore += 25;
    if (backActive) secScore += 25;

    const totalDevTasks = safeTasks.filter(t => t && t.department === 'wp_dev' && t.projectId === 'proj_1').length || 1;
    const compDevTasks = safeTasks.filter(t => t && t.department === 'wp_dev' && t.status === 'completed' && t.projectId === 'proj_1').length;
    const wpChecklistCount = safeWpChecklist.length || 1;
    const wpChecklistComp = safeWpChecklist.filter(w => w && w.status === 'completed').length;
    const devScore = Math.min(100, Math.round(((compDevTasks / totalDevTasks) * 60) + ((wpChecklistComp / wpChecklistCount) * 40)));

    const totalBugs = safeQaBugs.length || 1;
    const solvedBugs = safeQaBugs.filter(b => b && (b.status === 'verified' || b.status === 'resolved')).length;
    const qaScore = Math.min(100, Math.round((solvedBugs / totalBugs) * 100));

    const readyTasks = safeTasks.filter(t => t && t.projectId === 'proj_1').length || 1;
    const compTasks = safeTasks.filter(t => t && t.projectId === 'proj_1' && t.status === 'completed').length;
    const launchScore = Math.min(100, Math.round((compTasks / readyTasks) * 100));

    return {
      content: contentScore,
      seo: seoScore,
      performance: perfScore,
      security: secScore,
      development: devScore,
      qa: qaScore,
      launch: launchScore
    };
  }, [contentCenter, seoChecklist, wpSites, tasks, wpChecklist, qaBugs]);

  const websiteReadinessScore = React.useMemo(() => {
    const vals = Object.values(readinessScoreCategory);
    const sum = (vals as number[]).reduce((a: number, b: number) => a + b, 0);
    return Math.round(sum / vals.length);
  }, [readinessScoreCategory]);

  const activityIntel = React.useMemo(() => {
    const safeTasks = tasks || [];
    const completedTasks = safeTasks.filter(t => t && t.status === 'completed').length;
    const totalTasksCount = safeTasks.length || 1;
    const completionRate = Math.round((completedTasks / totalTasksCount) * 100);
    const teamProductivity = Math.min(100, Math.max(30, completionRate + 15));
    const taskVelocity = Math.max(1, Math.round(completedTasks / 2)) + 0.5;
    const delayRate = Math.round((safeTasks.filter(t => t && t.projectId === 'proj_4').length / totalTasksCount) * 15);

    return {
      teamProductivity,
      taskVelocity,
      completionRate,
      delayRate,
      approvalSpeed: "۴.۲ ساعت",
      readinessScore: websiteReadinessScore
    };
  }, [tasks, websiteReadinessScore]);

  // COMPREHENSIVE RUN AUTOMATION ENGINE
  const runAutomationEngine = async (trigger: TriggerType, contextData?: any) => {
    console.log(`[Automation Engine] Triggering: ${trigger}`, contextData);
    
    // Find active rules matching trigger
    const activeRules = (automationRules || []).filter(r => r && r.isActive && r.trigger === trigger);
    if (activeRules.length === 0) return;

    await timerDelay(300);

    activeRules.forEach(rule => {
      // Evaluate optional condition
      let conditionPassed = true;
      if (rule.condition) {
        const { field, operator, value } = rule.condition;
        const actualValue = contextData ? contextData[field] : undefined;

        if (operator === 'equals') {
          conditionPassed = String(actualValue) === String(value);
        } else if (operator === 'greater_than') {
          conditionPassed = Number(actualValue) > Number(value);
        } else if (operator === 'contains') {
          conditionPassed = actualValue && String(actualValue).toLowerCase().includes(String(value).toLowerCase());
        } else if (operator === 'is_true') {
          conditionPassed = !!actualValue;
        }
      }

      if (conditionPassed) {
        executeAutomationAction(rule, rule.thenAction, true, contextData);
      } else if (rule.elseAction) {
        executeAutomationAction(rule, rule.elseAction, false, contextData);
      }
    });
  };

  const executeAutomationAction = (rule: AutomationRule, action: AutomationAction, isThen: boolean, contextData: any) => {
    let outcomeText = "";
    
    // Increment run count
    setAutomationRules(prev => prev.map(r => r.id === rule.id ? { 
      ...r, 
      runCount: r.runCount + 1,
      lastRun: new Date().toLocaleDateString('fa-IR') + ' ' + new Date().toLocaleTimeString('fa-IR')
    } : r));

    switch (action.type) {
      case 'complete_task': {
        setTasks(prev => {
          const updated = prev.map(t => {
            const isMatch = t.id === action.targetId || 
                            (t.projectId === 'proj_1' && t.title.includes("طراحی") && rule.id === 'rule_1') ||
                            (t.projectId === 'proj_1' && t.id === 'task_1' && rule.id === 'rule_1');
            if (isMatch) {
              return { ...t, status: 'completed' as const };
            }
            return t;
          });
          syncProjectProgress(updated);
          return updated;
        });
        outcomeText = `وضعیت وظیفه «طراحی موکاپ نسخه دسکتاپ» به تکمیل شده تغییر یافت.`;
        break;
      }
      case 'mark_store_setup_complete': {
        setWpChecklist(prev => prev.map(w => {
          if (w.category === 'performance' || w.name.includes("Litespeed") || w.name.includes("Rocket")) {
            return { ...w, status: 'completed' as const, progress: 100 };
          }
          return w;
        }));
        outcomeText = "امور چک‌لیست مربوط به سرعت و بارگذاری هاست اختصاصی فروشگاه تکمیل اعلام شد.";
        break;
      }
      case 'increase_progress': {
        setContentCenter(prev => prev.map(c => {
          if (c.status === 'writing') {
            return { ...c, status: 'published' as const };
          }
          return c;
        }));
        outcomeText = `پیشرفت بخش توزیع محتوای متنی پیشرفته به ۱۰۰٪ ارتقا یافت.`;
        break;
      }
      case 'complete_seo_task': {
        setSeoChecklist(prev => prev.map(s => {
          if (s.category === 'technical') {
            return { ...s, status: 'completed' as const, progress: 100 };
          }
          return s;
        }));
        outcomeText = "وظیفه تنظیمات سئو Robots.txt و نقشه سایت XML تکمیل شد.";
        break;
      }
      case 'complete_security_checklist': {
        setWpChecklist(prev => prev.map(w => {
          if (w.category === 'hosting' || w.category === 'cloudflare') {
            return { ...w, status: 'completed' as const, progress: 100 };
          }
          return w;
        }));
        outcomeText = "وضعیت امنیتی SSL به تکمیل شده ارتقا یافت.";
        break;
      }
      case 'mark_content_phase_complete': {
        setContentCenter(prev => prev.map(c => ({ ...c, status: 'published' as const, approvalStatus: 'approved' as const })));
        outcomeText = "کلیه اوراق اصلی تحویل کارفرما تعهد و به حالت منتشر تغییر یافت.";
        break;
      }
      case 'start_development_phase': {
        setTasks(prev => {
          const updated = prev.map(t => {
            if (t.department === 'wp_dev' && t.status === 'pending') {
              return { ...t, status: 'inprogress' as const };
            }
            return t;
          });
          syncProjectProgress(updated);
          return updated;
        });
        outcomeText = "فاز توسعه وردپرس آغاز گردید و وظایف این دپارتمان فعال شدند.";
        break;
      }
      case 'create_qa_tasks': {
        setQaBugs(prev => [
          {
            id: `bug_created_auto_${Date.now()}`,
            title: "تست سرعت بارگذاری بهینه‌ساز قالب Flashtome",
            category: "responsive",
            priority: "critical",
            assignedTo: "امید رضایی",
            status: "pending",
            fixVersion: "v1.0.3",
            dateLogged: new Date().toLocaleDateString('fa-IR')
          },
          ...prev
        ]);
        outcomeText = "باگ کنترل تست با عنوان تست واکنش‌گرایی جدید صادر شد.";
        break;
      }
      case 'create_launch_checklist': {
        addNotification("صدور چک‌لیست واگذاری", "سند تحویل کارفرما صادر شد.", "deadline_warning");
        outcomeText = "چک‌لیست واگذاری و استقرار دامین نهایی لانچ شد.";
        break;
      }
      case 'notify_client': {
        generateClientNotificationSim('milestone', `وضعیت پیشرفت مایلستون به مطلع کارفرما ارسال شد.`);
        outcomeText = "نوتیفیکیشن ایمیلی به کارفرمای محترم با موفقیت رجیستر شد.";
        break;
      }
      default:
        break;
    }

    // Capture Log
    const newLog: AutomationLog = {
      id: `alog_run_${Date.now()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      timestamp: new Date().toLocaleDateString('fa-IR') + ' ' + new Date().toLocaleTimeString('fa-IR'),
      triggerEvent: `${rule.trigger} (بر پایه ${isThen ? 'تطبیق شرط اصلی' : 'شرط Else'})`,
      status: "success",
      details: rule.description,
      actionTaken: outcomeText || "شرایط قانون بررسی شد."
    };

    setAutomationLogs(prev => [newLog, ...prev]);

    // Live Socket sync logs dispatch simulation
    setWpLogs(prev => [
      {
        id: `log_wp_auto_${Date.now()}`,
        timestamp: newLog.timestamp,
        siteName: contextData?.siteName || "پورتال نوپای وردپرسی",
        siteUrl: contextData?.siteUrl || "https://arya-commerce.ir",
        type: "sync",
        status: "success",
        detail: `[موتور اتوماسیون]: ${newLog.ruleName} -> ${newLog.actionTaken}`
      },
      ...prev
    ]);

    addNotification(
      `اتوماسیون اجرا شد: ${rule.name}`,
      outcomeText || `شرط اتوماسیون با موفقیت پاس شد.`,
      "project_updated"
    );
  };

  const clearLogs = () => {
    setApiLogs([]);
  };

  const getAuthHeaders = sharedAuthHeaders;

  const fetchWorkspaces = async () => {
    try {
      const res=await apiFetch('/api/workspaces');
      const data=await res.json();
      const list=Array.isArray(data.workspaces)?data.workspaces:[];
      setWorkspaces(list);
      if(!list.some((w:any)=>w.id===activeWorkspaceId)) {
        clearPrivateState();
        const next=list[0]?.id || '';
        setApiIdentity(currentUser?.id || '',next);
        setActiveWorkspaceIdState(next);
        const membership=currentUser?.memberships?.find((m:any)=>m.workspaceId===next);
        const role=membership?.role || 'MEMBER';
        setUserRoleState(role);
        setCurrentUser((u:any)=>u ? {...u,role,workspaceRole:role} : u);
      }
    } catch(error) { if(!(error instanceof ApiError))reportApiError(error); }
  };

  const fetchProjects = async () => {
    const sequence=++projectFetchSequence.current;
    try {
      const res = await apiFetch('/api/projects', { headers: getAuthHeaders() });
      
      if (res.ok) {
        const list: Project[] = await res.json();
        if (Array.isArray(list)&&sequence===projectFetchSequence.current) {
          const formatted = list.map(p => ({
            ...p,
            isPortalActive: p.isPortalActive !== undefined ? p.isPortalActive : p.clientPortalEnabled === true,
            clientPortalEnabled: p.clientPortalEnabled === true,
            clientPortalToken: p.clientPortalToken || p.portalToken || '',
            portalToken: p.portalToken || p.clientPortalToken || ''
          }));
          setProjects(formatted);
          if (formatted.length === 0) {
            setSelectedProjectState(NULL_PROJECT);
          } else {
            setSelectedProjectState(prevSel => {
              if (!prevSel || prevSel.id === 'no_project') return formatted[0];
              const exists = formatted.find(p => p.id === prevSel.id);
              return exists || formatted[0];
            });
          }
        }
      }
    } catch { /* Request failures are reported centrally. Stale responses cannot restore this view. */ } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    if(!isAuthenticated || !activeWorkspaceId) return;
    fetchProjects(); fetchTasks(); fetchWorkspaces(); fetchTeamMembers(); fetchNotifications(); fetchConversations(); fetchChatUsers(); fetchChatRequests(); fetchOrgData();
  }, [activeWorkspaceId,isAuthenticated]);

  const fetchTasks = async () => {
    try {
      const res = await apiFetch('/api/tasks', { headers: getAuthHeaders() });
      
      if (res.ok) {
        const list: Task[] = await res.json();
        if (Array.isArray(list)) {
          setTasks(list);
        }
      }
    } catch { /* Request failures are reported centrally. Stale responses cannot restore this view. */ }
  };

  const fetchTeamMembers = async () => {
    const sequence=++teamMembersFetchSequence.current;
    try {
      const res = await apiFetch('/api/users');
      if (res.status === 403) {
        notifyStandaloneMode();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped: TeamMember[] = data.map((u: any) => ({
            id: u.id,
            name: u.name,
            role: u.role,
            department: u.role === 'SUPER_ADMIN' || u.role === 'OWNER' || u.role === 'ADMIN' ? 'management' : 'wp_dev',
            // The list endpoint carries no image; use the same local initials avatar everywhere.
            avatar: localAvatar(u.name || 'TS Orbit'),
            email: u.email,
            phone: u.phone,
            taskCount: 0,
            completedCount: 0,
            status: u.status || 'offline'
          }));
          if(sequence===teamMembersFetchSequence.current)setTeamMembers(mapped);
        }
      }
    } catch { /* Request failures are reported centrally. Stale responses cannot restore this view. */ }
  };

  const refreshAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.allSettled([
        fetchProjects(),
        fetchTasks(),
        fetchTeamMembers(),
        fetchOrgData(),
        fetchConversations()
      ]);
    } catch {
      // Silently handle
    } finally {
      setIsLoading(false);
    }
  };

  // Phase 6 Dynamic Org & Modules State Actions
  const fetchOrgData = async () => {
    try {
      const res = await apiFetch('/api/org/data', { headers: getAuthHeaders() });
      if (res.status === 403) {
        notifyStandaloneMode();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data) {
          if (Array.isArray(data.departments)) setDepartments(data.departments);
          if (Array.isArray(data.departmentMembers)) setDepartmentMembers(data.departmentMembers);
          if (Array.isArray(data.departmentPermissions)) setDepartmentPermissions(data.departmentPermissions);
          if (Array.isArray(data.departmentModules)) setDepartmentModules(data.departmentModules);
          if (Array.isArray(data.departmentReports)) setDepartmentReports(data.departmentReports);
          if (Array.isArray(data.departmentSettings)) setDepartmentSettings(data.departmentSettings);
          if (Array.isArray(data.departmentChats)) setDepartmentChats(data.departmentChats);
          if (Array.isArray(data.departmentChannels)) setDepartmentChannels(data.departmentChannels);
          if (Array.isArray(data.departmentRoles)) setDepartmentRoles(data.departmentRoles);
          if (Array.isArray(data.departmentTemplates)) setDepartmentTemplates(data.departmentTemplates);
          if (Array.isArray(data.navigationGroups)) setNavigationGroups(data.navigationGroups);
          if (Array.isArray(data.navigationItems)) setNavigationItems(data.navigationItems);
          if (Array.isArray(data.moduleDefinitions)) setModuleDefinitions(data.moduleDefinitions);
          if (Array.isArray(data.moduleInstances)) setModuleInstances(data.moduleInstances);
          if (Array.isArray(data.modulePermissions)) setModulePermissions(data.modulePermissions);
          if (Array.isArray(data.teams)) setTeams(data.teams);
        }
      }
    } catch { /* Request failures are reported centrally. Stale responses cannot restore this view. */ }
  };

  const createDepartment = async (deptData: any) => {
    try {
      const res = await apiFetch('/api/org/departments', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(deptData)
      });
      if (res.ok) {
        const data = await res.json();
        await fetchOrgData();
        return data;
      }
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error("Failed to create department:", err);
    }
  };

  const updateDepartment = async (deptId: string, deptData: any) => {
    try {
      const res = await apiFetch(`/api/org/departments/${deptId}`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(deptData)
      });
      if (res.ok) {
        const data = await res.json();
        await fetchOrgData();
        return data;
      }
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error("Failed to update department:", err);
    }
  };

  const deleteDepartment = async (deptId: string) => {
    try {
      const res = await apiFetch(`/api/org/departments/${deptId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        await fetchOrgData();
        return true;
      }
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error("Failed to delete department:", err);
    }
    return false;
  };

  const createModule = async (moduleData: any) => {
    try {
      const res = await apiFetch('/api/org/modules', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(moduleData)
      });
      if (res.ok) {
        const data = await res.json();
        await fetchOrgData();
        return data;
      }
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error("Failed to create module:", err);
    }
  };

  const deleteModule = async (moduleId: string) => {
    try {
      const res = await apiFetch(`/api/org/modules/${moduleId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        await fetchOrgData();
        return true;
      }
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error("Failed to delete module:", err);
    }
    return false;
  };

  const instantiateModule = async (instanceData: any) => {
    try {
      const res = await apiFetch('/api/org/module-instances', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(instanceData)
      });
      if (res.ok) {
        const data = await res.json();
        await fetchOrgData();
        return data;
      }
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error("Failed to instantiate module:", err);
    }
  };

  const createOrgTeam = async (teamData: any) => {
    try {
      const res = await apiFetch('/api/org/teams', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(teamData)
      });
      if (res.ok) {
        const data = await res.json();
        await fetchOrgData();
        await fetchConversations();
        return data;
      }
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error("Failed to create team with channels:", err);
    }
  };

  const updateOrgTeam = async(id:string,data:any) => {const response=await apiFetch('/api/org/teams/'+id,{method:'PUT',body:JSON.stringify(data)});const saved=await response.json();await fetchOrgData();await fetchConversations();return saved;};
  const deleteOrgTeam = async(id:string) => {await apiFetch('/api/org/teams/'+id,{method:'DELETE'});await fetchOrgData();await fetchConversations();};
  const updateModuleDefinition = async(id:string,data:any) => {const response=await apiFetch('/api/org/modules/'+id,{method:'PUT',body:JSON.stringify(data)});const saved=await response.json();await fetchOrgData();return saved;};

  const generateDepartmentReport = async (deptId: string) => {
    try {
      const res = await apiFetch(`/api/org/departments/${deptId}/reports`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setDepartmentReports(prev => [data, ...prev.filter((r: any) => r.id !== data.id)]);
        await fetchOrgData();
        return data;
      }
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error("Failed to generate department report:", err);
    }
  };

  const generateExecutiveReport = async () => {
    try {
      const res = await apiFetch('/api/org/reports/executive-summary', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setDepartmentReports(prev => [data, ...prev.filter((r: any) => r.id !== data.id)]);
        await fetchOrgData();
        return data;
      }
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error("Failed to generate executive report:", err);
    }
  };

  const saveReport = async (reportData: any) => {
    try {
      const res = await apiFetch('/api/org/reports', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData)
      });
      if (res.ok) {
        const data = await res.json();
        setDepartmentReports(prev => [data, ...prev.filter((r: any) => r.id !== data.id)]);
        return data;
      }
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error("Failed to save report:", err);
    }
    throw new Error('گزارش در سرور ذخیره نشد.');
  };

  const deleteReport = async (id: string) => {
    try {
      const res = await apiFetch(`/api/org/reports/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if(res.ok)setDepartmentReports(prev=>prev.filter((r:any)=>r.id!==id));
      return res.ok;
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error("Failed to delete report:", err);
      return false;
    }
  };

  const deleteReportsBulk = async (range: string, ids?: string[]) => {
    try {
      const res = await apiFetch(`/api/org/reports/bulk?range=${range}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: ids ? JSON.stringify({ ids }) : undefined
      });
      if (res.ok) {
        fetchOrgData(); // refresh
        return true;
      }
      return false;
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error("Failed to delete reports in bulk:", err);
      return false;
    }
  };

  const saveModuleTemplate = async (templateData: any) => {
    try {
      const res = await apiFetch('/api/org/templates', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      });
      if (res.ok) {
        const data = await res.json();
        await fetchOrgData();
        return data;
      }
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error("Failed to save template:", err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await apiFetch('/api/org/templates', { headers: getAuthHeaders() });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    }
    return [];
  };

  const updatePermission = async (departmentId: string, role: string, action: string, isAllowed: boolean) => {
    try {
      const res = await apiFetch('/api/org/permissions', {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId, role, action, isAllowed })
      });
      if (res.ok) {
        const data = await res.json();
        await fetchOrgData();
        return data;
      }
    } catch (err) {
      if (err instanceof ApiError) { setOperationStatus('error'); setIsLoading(false); throw err; }

      console.error("Failed to update permission:", err);
    }
  };

  // Load initial workspace domains. Collaboration also refreshes after reconnect.
  useEffect(() => {
    if (isAuthenticated && activeWorkspaceId) {
      fetchProjects();
      fetchTasks();
      fetchTeamMembers();
      fetchNotifications();
      fetchConversations();
      fetchChatUsers();
      fetchChatRequests();
      fetchOrgData();
    }
  }, [isAuthenticated, activeWorkspaceId]);

  // Load initial stats log
  useEffect(() => {
    logApiAction('GET', '/api/stats', 200, {
      totalProjects: 0,
      totalTasks: 0,
      activeTasks: 0,
      completedToday: 0
    });
  }, []);

  // Zero-Trust User Scoped Data Filtering
  const accessibleProjects = useMemo(() => {
    const safeProjects = projects || [];
    if (!currentUser || !isAuthenticated) return [];
    return safeProjects.filter(p => p && p.workspaceId === activeWorkspaceId);
  }, [projects, currentUser,isAuthenticated,activeWorkspaceId]);

  const accessibleProjectIds = useMemo(() => {
    return new Set((accessibleProjects || []).map(p => p.id));
  }, [accessibleProjects]);

  const userScopedTasks = useMemo(() => !currentUser || !isAuthenticated ? [] : tasks.filter(task => task.workspaceId===activeWorkspaceId),[tasks,currentUser,isAuthenticated,activeWorkspaceId]);

  const userScopedNotifications = useMemo(() => {
    const safeNotifications = notifications || [];
    if (!currentUser || !isAuthenticated) return [];
    return safeNotifications.filter(n => n && canUserAccessNotification(currentUser, n));
  }, [notifications, currentUser]);

  // Ensure selectedProject is accessible
  useEffect(() => {
    if (currentUser && accessibleProjects.length > 0) {
      if (selectedProject && selectedProject.id !== 'no_project') {
        const canAccess = accessibleProjects.some(project=>project.id===selectedProject.id);
        if (!canAccess) {
          setSelectedProjectState(accessibleProjects[0]);
        }
      } else if (!selectedProject || selectedProject.id === 'no_project') {
        setSelectedProjectState(accessibleProjects[0]);
      }
    } else if (currentUser && accessibleProjects.length === 0) {
      if (selectedProject && selectedProject.id !== 'no_project') {
        setSelectedProjectState(NULL_PROJECT);
      }
    }
  }, [currentUser, accessibleProjects, selectedProject]);

  return (
    <ProjectContext.Provider value={{
      projects: accessibleProjects,
      tasks: userScopedTasks,
      teamMembers,
      clients,
      wpChecklist,
      seoChecklist,
      contentCenter,
      qaBugs,
      files,
      notifications: userScopedNotifications,
      apiLogs,
      activityLogs,
      wpSites,
      wpLogs,
      wpWebhooks,
      
      selectedProject,
      setSelectedProject,
      activeTab,
      setActiveTab,
      activeSubTab,
      setActiveSubTab,
      
      isNewProjectModalOpen,
      setIsNewProjectModalOpen,
      openNewProjectModal,
      
      isLoading,
      isLoaded,
      operationStatus,
      setOperationStatus,
      
      globalSearchQuery,
      setGlobalSearchQuery,

      createProject,
      updateProject,
      deleteProject,
      resetDatabaseToZero,
      activateProject,
      createTask,
      updateTaskStatus,
      updateTask,
      addTaskComment,
      addTaskTimeEntry,
      deleteTask,
      addTeamMember,
      
      updateWpChecklistItem,
      updateSeoChecklistItem,
      
      updateContentStatus,
      createContentItem,
      
      createQaBug,
      updateQaBugStatus,
      
      uploadFile,
      deleteFileAsset,
      
      submitClientFeedback,
      approveClientFeedback,
      toggleClientPortal,
      regenerateClientToken,
      saveProjectPortal,
      addClientFeedback,
      updateFeedbackStatus,
      deleteFeedback,
      
      syncWordPressSite,
      registerWordPressSite,
      disconnectWordPressSite,
      triggerWebhookMock,

      automationRules,
      automationLogs,
      createAutomationRule,
      toggleAutomationRule,
      deleteAutomationRule,
      runAutomationEngine,
      autoGenerateProjectTasks,
      generateClientNotificationSim,
      generateReportSim,

      ...collaboration,
      // Chat fields
      chatConversations,
      chatMessages,
      chatUsers,
      chatRequests,
      activeConversation,
      setActiveConversation,
      chatTypingUsers,
      fetchConversations,
      fetchMessages,
      fetchChatUsers,
      fetchTeamMembers,
      fetchChatRequests,
      sendChatMessage,
      createConversation,
      sendChatRequest,
      respondToChatRequest,
      deleteChatMessage,
      reactToChatMessage,
      pinChatMessage,
      closeConversation,
      markConversationRead,
      typingInConversation,
      activityIntel,
      readinessScoreCategory,

      clearLogs,
      triggerManualMockRequest,

      markNotificationAsRead,
      markAllNotificationsAsRead,

      currentUser,
      userRole,
      setUserRole,
      isAuthenticated,
      sessionStatus,
      retrySession,
      login,
      register,
      logout,
      isSystemAdmin: currentUser?.systemRole === 'ADMIN',
      updateProfile,
      updateUserRole,
      getRoleLabel,

      activeModules,
      setActiveModules,
      addCustomModule,
      removeModule,
      updateModule,

      // Phase 6 Exposes
      departments,
      departmentMembers,
      departmentPermissions,
      departmentModules,
      departmentReports,
      departmentSettings,
      departmentChats,
      departmentChannels,
      departmentRoles,
      departmentTemplates,
      navigationGroups,
      navigationItems,
      moduleDefinitions,
      moduleInstances,
      modulePermissions,
      teams,
      fetchOrgData,
      createDepartment,
      updateDepartment,
      deleteDepartment,
      createModule,
      deleteModule,
      instantiateModule,
      createOrgTeam,
      updateOrgTeam,
      deleteOrgTeam,
      updateModuleDefinition,
      generateDepartmentReport,
      generateExecutiveReport,
      saveReport,
      deleteReport,
      deleteReportsBulk,
      saveModuleTemplate,
      fetchTemplates,
      updatePermission,

      users,
      setUsers,
      workspaces,
      setWorkspaces,
      activeWorkspaceId,
      setActiveWorkspaceId,
      reports: departmentReports,
      setReports: setDepartmentReports,
      hasPendingSync,
      setHasPendingSync,
      performSilentSync,
      activeToast,
      setActiveToast,
      showToast,
      activeView,
      setActiveView,
      toastMessage,
      setToastMessage,
      triggerSuccessEvent,
      addProject,
      addTask,

      locale,
      setLocale,
      theme,
      setTheme,
      t,
      refreshAllData
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

export const useProjectContext = useProject;



