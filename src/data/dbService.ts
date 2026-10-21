import fs from 'fs';
import path from 'path';
import bcryptjs from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { acquireDataLock, config } from '../../server/local-config.ts';
import { localAvatar } from '../lib/localAssets.ts';
import { canUserAccessProject, canUserAccessNotification } from '../utils/helpers';
import { SqliteStore, importLegacyFile } from '../../server/db/store.ts';

// Persistent application data lives outside the build output.
const DB_PATH = config.sqlitePath;

// Interface representing the entire relational database state
export interface DatabaseSchema {
  users: any[];
  workspaces: any[];
  organizations: any[];
  teams: any[];
  teamMembers: any[];
  projects: any[];
  projectMembers: any[];
  tasks: any[];
  subtasks: any[];
  wordpressChecklist: any[];
  seoChecklist: any[];
  contentCenter: any[];
  qaBugs: any[];
  files: any[];
  notifications: any[];
  externalApis: any[];
  apiLogs: any[];
  wpSites: any[];
  wpLogs: any[];
  wpWebhooks: any[];
  comments: any[];
  milestones: any[];
  settings: any;
  auditLogs: any[];
  conversations: any[];
  conversationMembers: any[];
  messages: any[];
  conversationRequests: any[];
  conversationPermissions: any[];
  pinnedMessages: any[];
  messageReactions: any[];
  readReceipts: any[];
  
  // Dynamic Org & Module Builder Tables
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

  // System Owner Approval Tables
  approvalRequests: any[];
  approvalHistory: any[];
  notificationQueue: any[];
  emailQueue: any[];

  // Identity Management Tables
  userProfiles: any[];
  userSettings: any[];
  userSessions: any[];
  loginHistory: any[];
  userDevices: any[];
  securityEvents: any[];
  profileImages: any[];
  userPreferences: any[];
  userActivities: any[];
}

// Compatibility exports; a new installation has no fabricated identity.
export const INITIAL_USERS: any[] = [];
export const INITIAL_WORKSPACES: any[] = [];
export const isOwnerEmail = (email: string): boolean => {
  const user = DbService.getInstance().getUsers().find(u => u.email?.toLowerCase().trim() === email?.toLowerCase().trim());
  return user?.role === 'OWNER';
};

const emptyDatabase = (): DatabaseSchema => ({
  users: [],
  workspaces: [],
  organizations: [],
  teams: [],
  teamMembers: [],
  projects: [],
  projectMembers: [],
  tasks: [],
  subtasks: [],
  wordpressChecklist: [],
  seoChecklist: [],
  contentCenter: [],
  qaBugs: [],
  files: [],
  notifications: [],
  externalApis: [],
  apiLogs: [],
  wpSites: [],
  wpLogs: [],
  wpWebhooks: [],
  comments: [],
  milestones: [],
  auditLogs: [],
  conversations: [],
  conversationMembers: [],
  messages: [],
  conversationRequests: [],
  conversationPermissions: [],
  pinnedMessages: [],
  messageReactions: [],
  readReceipts: [],
  departments: [],
  departmentMembers: [],
  departmentPermissions: [],
  departmentModules: [],
  departmentReports: [],
  departmentSettings: [],
  departmentChats: [],
  departmentChannels: [],
  departmentRoles: [],
  departmentTemplates: [],
  navigationGroups: [],
  navigationItems: [],
  moduleDefinitions: [],
  moduleInstances: [],
  modulePermissions: [],
  approvalRequests: [],
  approvalHistory: [],
  notificationQueue: [],
  emailQueue: [],
  userProfiles: [],
  userSettings: [],
  userSessions: [],
  loginHistory: [],
  userDevices: [],
  securityEvents: [],
  profileImages: [],
  userPreferences: [],
  userActivities: [],
  settings: { theme: 'dark', require2FA: false }
});

// Global DB helper class
export class DbService {
  private static instance: DbService | null = null;
  private state: DatabaseSchema | null = null;
  private store!: SqliteStore;
  private transactionSnapshot: DatabaseSchema | null = null;

  private constructor() {
    acquireDataLock();
    this.init();
  }

  public static getInstance(): DbService {
    if (!DbService.instance) {
      DbService.instance = new DbService();
    }
    return DbService.instance;
  }

  private init() {
    const legacyPath = fs.existsSync(config.legacyDbPath)
      ? config.legacyDbPath
      : process.env.LEGACY_DB_IMPORT ? path.resolve(config.rootDir, process.env.LEGACY_DB_IMPORT) : null;
    if (!fs.existsSync(DB_PATH) && legacyPath) {
      const report = importLegacyFile(legacyPath, DB_PATH);
      console.log(`Legacy data migrated to SQLite: ${report.issueCount} anomalies archived; original JSON retained.`);
    }
    this.store = new SqliteStore(DB_PATH);
    this.state = this.store.loadState() as DatabaseSchema;
    // A fresh schema has no root properties; existing settings/extension fields
    // remain intact regardless of whether the collections happen to be empty.
    if (Number((this.store.database.prepare('SELECT count(*) AS n FROM state_properties').get() as any).n) === 0) {
      this.store.saveState(this.state);
    }
    let changed = false;
    for (const user of this.state.users) {
      if (!user || typeof user !== 'object') continue;
      if (user.recoveryCode !== undefined) { delete user.recoveryCode; changed = true; }
      if (typeof user.passwordHash === 'string' && ['123456', 'invited123'].some(password => bcryptjs.compareSync(password, user.passwordHash))) {
        user.passwordHash = bcryptjs.hashSync(randomBytes(48).toString('hex'), 10);
        user.localPasswordRequired = true;
        changed = true;
      }
      if (typeof user.avatar === 'string' && /^https?:/.test(user.avatar)) { user.avatar = localAvatar(user.id || user.name); changed = true; }
    }
    if (changed) this.save();
    console.log('SQLite database loaded from ' + DB_PATH);
  }

  private restoreState(snapshot: DatabaseSchema) {
    const state = this.state! as any;
    for (const key of Object.keys(state)) delete state[key];
    for (const [key, value] of Object.entries(snapshot)) Object.defineProperty(state, key, { value, writable: true, enumerable: true, configurable: true });
  }

  public beginTransaction() {
    if (this.transactionSnapshot) throw new Error('Database request transaction already active.');
    this.store.begin();
    this.transactionSnapshot = structuredClone(this.getState());
  }

  public commitTransaction() {
    if (!this.transactionSnapshot) throw new Error('No database request transaction active.');
    this.store.saveState(this.getState());
    this.store.commit();
    this.transactionSnapshot = null;
  }

  public rollbackTransaction() {
    this.store.rollback();
    if (this.transactionSnapshot) this.restoreState(this.transactionSnapshot);
    this.transactionSnapshot = null;
  }

  public save() {
    if (!this.state || this.transactionSnapshot) return;
    try { this.store.saveState(this.state); }
    catch (error) { this.restoreState(this.store.loadState() as DatabaseSchema); throw error; }
  }

  public persist() { this.save(); }
  public getStore() { return this.store; }
  public close() { this.rollbackTransaction(); this.store.close(); }

  // --- GENERIC STATE GETTERS ---
  public getState(): DatabaseSchema {
    if (!this.state) {
      this.init();
    }
    return this.state!;
  }

  // --- AUTH / USER METHODS ---
  public getUsers() {
    return this.getState().users;
  }

  public findUserById(id: string) {
    return this.getUsers().find(u => u.id === id);
  }

  public findUserByEmail(email: string) {
    if (!email) return undefined;
    return this.getUsers().find(u => u.email.toLowerCase().trim() === email.toLowerCase().trim());
  }

  public createUser(userData: any) {
    const db = this.getState();
    const existing = this.findUserByEmail(userData.email);
    if (existing) {
      throw new Error("EMAIL_TAKEN");
    }

    const assignedRole = userData.role || "USER";

    const newUser = {
      id: userData.id || `usr_${Date.now()}`,
      email: userData.email,
      passwordHash: userData.password ? bcryptjs.hashSync(userData.password, 10) : userData.passwordHash,
      name: userData.name,
      phone: userData.phone || "",
      role: assignedRole,
      avatar: userData.name ? userData.name.substring(0, 1) : "ک",
      status: "offline",
      createdAt: new Date().toLocaleDateString('fa-IR'),
      workspace: null
    };

    db.users.push(newUser);
    this.save();
    return newUser;
  }

  public updateUserRole(userId: string, role: string) {
    const user = this.findUserById(userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    user.role = role;
    this.save();
    return user;
  }

  public updateUserWorkspace(userId: string, workspace: any) {
    const user = this.findUserById(userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    user.workspace = workspace;
    this.save();
    return user;
  }

  // --- PROJECTS ---
  public getProjects() {
    return this.getState().projects;
  }

  public getProjectsForUser(user: any) {
    const all = this.getProjects();
    if (!user) return all;
    return all.filter(p => canUserAccessProject(user, p));
  }

  public findProjectById(id: string) {
    return this.getProjects().find(p => p.id === id);
  }

  public createProject(projectData: any) {
    const db = this.getState();
    const teamLead = projectData.teamLead || projectData.teamLeadId || "";
    const teamLeadId = projectData.teamLeadId || projectData.teamLead || "";
    const assignedMemberIds = Array.isArray(projectData.assignedMemberIds)
      ? projectData.assignedMemberIds
      : Array.isArray(projectData.assignedMembers)
      ? projectData.assignedMembers
      : (teamLeadId ? [teamLeadId] : []);
    const assignedTeamIds = Array.isArray(projectData.assignedTeamIds) ? projectData.assignedTeamIds : [];
    const createdById = projectData.createdById || "admin";

    const newProj = {
      id: `proj_${Date.now()}`,
      title: projectData.title,
      description: projectData.description || "",
      progress: 0,
      totalTasks: 0,
      completedTasks: 0,
      status: projectData.status || "ACTIVE",
      startDate: projectData.startDate && projectData.startDate !== "—" ? projectData.startDate : new Date().toLocaleDateString('fa-IR'),
      deadline: projectData.deadline || "1405/06/01",
      budget: projectData.budget || "ناشخص",
      clientName: projectData.clientName || "بدون کارفرما",
      websiteUrl: projectData.websiteUrl || "",
      teamLead,
      teamLeadId,
      assignedMemberIds,
      assignedTeamIds,
      createdById,
      isBudgetConfidential: !!projectData.isBudgetConfidential,
      clientPortalEnabled: true,
      isPortalActive: true
    };
    db.projects.push(newProj);
    this.save();
    return newProj;
  }

  public updateProject(id: string, updates: any) {
    const proj = this.findProjectById(id);
    if (!proj) throw new Error("PROJECT_NOT_FOUND");
    if (updates.teamLead && !updates.teamLeadId) {
      updates.teamLeadId = updates.teamLead;
    }
    if (updates.teamLeadId && !updates.teamLead) {
      updates.teamLead = updates.teamLeadId;
    }
    Object.assign(proj, updates);
    this.save();
    return proj;
  }

  // --- TASKS ---
  public getTasks() {
    return this.getState().tasks;
  }

  public findTaskById(id: string) {
    return this.getTasks().find(t => t.id === id);
  }

  public createTask(taskData: any) {
    const db = this.getState();
    const newTask = {
      id: `task_${Date.now()}`,
      projectId: taskData.projectId,
      title: taskData.title,
      description: taskData.description || "",
      assignedTo: taskData.assignedTo || "امید رضایی",
      priority: taskData.priority || "medium",
      status: taskData.status || "pending",
      department: taskData.department || "wp_dev",
      startDate: taskData.startDate || new Date().toLocaleDateString('fa-IR'),
      deadline: taskData.deadline || "1405/04/01",
      tags: taskData.tags || [],
      attachments: taskData.attachments || [],
      dependencies: taskData.dependencies || []
    };
    db.tasks.push(newTask);
    this.recalculateProjectStats(taskData.projectId);
    this.save();
    return newTask;
  }

  public updateTask(id: string, updates: any) {
    const task = this.findTaskById(id);
    if (!task) throw new Error("TASK_NOT_FOUND");
    Object.assign(task, updates);
    this.recalculateProjectStats(task.projectId);
    this.save();
    return task;
  }

  public deleteTask(id: string) {
    const db = this.getState();
    const idx = db.tasks.findIndex(t => t.id === id);
    if (idx < 0) throw new Error("TASK_NOT_FOUND");
    const deleted = db.tasks.splice(idx, 1)[0];
    this.recalculateProjectStats(deleted.projectId);
    this.save();
    return deleted;
  }

  private recalculateProjectStats(projectId: string) {
    const db = this.getState();
    const proj = db.projects.find(p => p.id === projectId);
    if (!proj) return;

    const projTasks = db.tasks.filter(t => t.projectId === projectId);
    proj.totalTasks = projTasks.length;
    proj.completedTasks = projTasks.filter(t => t.status === 'completed').length;
    proj.progress = projTasks.length > 0 ? Math.round((proj.completedTasks / proj.totalTasks) * 100) : 0;
  }

  // --- WORDPRESS CHECKLIST ---
  public getWordPressChecklist() {
    return this.getState().wordpressChecklist;
  }

  public findWordPressChecklistItemById(id: string) {
    return this.getWordPressChecklist().find(w => w.id === id);
  }

  public updateWordPressChecklistItem(id: string, updates: any) {
    const item = this.findWordPressChecklistItemById(id);
    if (!item) throw new Error("CHECKLIST_ITEM_NOT_FOUND");
    Object.assign(item, updates);
    this.save();
    return item;
  }

  // --- SEO CHECKLIST ---
  public getSeoChecklist() {
    return this.getState().seoChecklist;
  }

  public findSeoChecklistItemById(id: string) {
    return this.getSeoChecklist().find(s => s.id === id);
  }

  public updateSeoChecklistItem(id: string, updates: any) {
    const item = this.findSeoChecklistItemById(id);
    if (!item) throw new Error("CHECKLIST_ITEM_NOT_FOUND");
    Object.assign(item, updates);
    this.save();
    return item;
  }

  // --- CONTENT CENTER ---
  public getContentCenter() {
    return this.getState().contentCenter;
  }

  public findContentItemById(id: string) {
    return this.getContentCenter().find(c => c.id === id);
  }

  public createContentItem(itemData: any) {
    const db = this.getState();
    const newItem = {
      id: `cont_${Date.now()}`,
      pageName: itemData.pageName || "صفحه بدون عنوان",
      status: itemData.status || "writing",
      writer: itemData.writer || "مریم فرخی",
      reviewer: itemData.reviewer || "علی طهمورث",
      approvalStatus: itemData.approvalStatus || "pending",
      deadline: itemData.deadline || "1405/03/30",
      attachments: itemData.attachments || [],
      contentBody: itemData.contentBody || ""
    };
    db.contentCenter.push(newItem);
    this.save();
    return newItem;
  }

  public updateContentItem(id: string, updates: any) {
    const item = this.findContentItemById(id);
    if (!item) throw new Error("CONTENT_NOT_FOUND");
    Object.assign(item, updates);
    this.save();
    return item;
  }

  // --- QA BUGS ---
  public getQaBugs() {
    return this.getState().qaBugs;
  }

  public findQaBugById(id: string) {
    return this.getQaBugs().find(q => q.id === id);
  }

  public createQaBug(bugData: any) {
    const db = this.getState();
    const newBug = {
      id: `bug_${Date.now()}`,
      title: bugData.title || "باگ بدون نام",
      category: bugData.category || "responsive",
      priority: bugData.priority || "high",
      assignedTo: bugData.assignedTo || "امید رضایی",
      status: bugData.status || "pending",
      fixVersion: bugData.fixVersion || "v1.0.0",
      dateLogged: new Date().toLocaleDateString('fa-IR')
    };
    db.qaBugs.push(newBug);
    this.save();
    return newBug;
  }

  public updateQaBug(id: string, updates: any) {
    const bug = this.findQaBugById(id);
    if (!bug) throw new Error("BUG_NOT_FOUND");
    Object.assign(bug, updates);
    this.save();
    return bug;
  }

  // --- NOTIFICATIONS ---
  public getNotifications() {
    return this.getState().notifications;
  }

  public createNotification(title: string, description: string, type = "project_updated") {
    const db = this.getState();
    const newNotif = {
      id: `notif_${Date.now()}`,
      title,
      description,
      timestamp: "هم‌اکنون",
      read: false,
      type
    };
    db.notifications.unshift(newNotif);
    if (db.notifications.length > 50) db.notifications.pop();
    this.save();
    return newNotif;
  }

  public clearNotifications() {
    const db = this.getState();
    db.notifications = [];
    this.save();
  }

  // --- FILES ---
  public getFiles() {
    return this.getState().files;
  }

  public findFileById(id: string) {
    return this.getFiles().find(f => f.id === id);
  }

  public saveFileAsset(fileData: any) {
    const db = this.getState();
    const newFile = {
      id: `file_${Date.now()}`,
      name: fileData.name,
      category: fileData.category || "documents",
      size: fileData.size || "100 KB",
      uploadDate: new Date().toLocaleDateString('fa-IR'),
      version: 1,
      tag: fileData.tag || "",
      uploadedById: fileData.uploadedById || "usr_owner",
      projectId: fileData.projectId || ""
    };
    db.files.push(newFile);
    this.save();
    return newFile;
  }

  public deleteFileAsset(id: string) {
    const db = this.getState();
    const idx = db.files.findIndex(f => f.id === id);
    if (idx < 0) throw new Error("FILE_NOT_FOUND");
    const deleted = db.files.splice(idx, 1)[0];
    this.save();
    return deleted;
  }

  // --- WORDPRESS METRICS & HUBS ---
  public getWpSites() {
    return this.getState().wpSites;
  }

  public findWpSiteByProjectId(projectId: string) {
    return this.getWpSites().find(s => s.projectId === projectId);
  }

  public findWpSiteByUrl(url: string) {
    return this.getWpSites().find(s => s.siteUrl.includes(url));
  }

  public registerWpSite(siteData: any) {
    const db = this.getState();
    const existingIdx = db.wpSites.findIndex(s => s.projectId === siteData.projectId || s.siteUrl === siteData.siteUrl);
    
    const newSite = {
      projectId: siteData.projectId,
      siteUrl: siteData.siteUrl,
      siteName: siteData.siteName || "پورتال وردپرس نوپا",
      wpVersion: siteData.wpVersion || "6.5.3",
      phpVersion: siteData.phpVersion || "8.1.0",
      themeName: siteData.themeName || "Astra Theme",
      themeVersion: siteData.themeVersion || "4.1.0",
      serverType: siteData.serverType || "Apache/LiteSpeed",
      sslStatus: siteData.sslStatus || "فعال (Let's Encrypt)",
      dnsStatus: "مستقر روی کلودفلر CDN",
      installedThemes: siteData.installedThemes || [siteData.themeName || "Astra Theme", "Twenty Twenty-Four"],
      installedPlugins: siteData.installedPlugins || [
        { name: "Elementor Pro", version: "3.21.0", active: true },
        { name: "WooCommerce", version: "8.9.0", active: true }
      ],
      pagesCount: siteData.pagesCount || 5,
      postsCount: siteData.postsCount || 1,
      productsCount: siteData.productsCount || 0,
      mediaCount: siteData.mediaCount || 12,
      rankMathStatus: siteData.rankMathStatus || "فعال",
      yoastStatus: siteData.yoastStatus || "غیرفعال",
      sitemapStatus: "فعال",
      robotsTxtStatus: "فعال",
      cacheStatus: "فعال",
      optimizationStatus: "بهینه‌سازی کامل",
      securityPluginStatus: "فعال (Wordfence)",
      backupStatus: "فعال (UpdraftPlus)",
      lastSynced: "هم‌اکنون",
      connectionStatus: "connected",
      apiKey: siteData.apiKey || `wpsync_${Math.random().toString(36).substring(2, 8)}`,
      performanceMetrics: siteData.performanceMetrics || {
        responseTimeMs: 140,
        cpuLoadPercent: 6,
        memoryUsagePercent: 28
      }
    };

    if (existingIdx >= 0) {
      db.wpSites[existingIdx] = { ...db.wpSites[existingIdx], ...newSite, connectionStatus: 'connected' };
    } else {
      db.wpSites.unshift(newSite);
    }
    this.save();
    return newSite;
  }

  public disconnectWpSite(projectId: string) {
    const db = this.getState();
    const site = db.wpSites.find(s => s.projectId === projectId);
    if (!site) throw new Error("NOT_FOUND");
    site.connectionStatus = 'disconnected';
    site.lastSynced = "قطع اتصال شده";
    this.save();
    return site;
  }

  public syncWpSite(projectId: string, payload: any) {
    const db = this.getState();
    const site = db.wpSites.find(s => s.projectId === projectId);
    if (!site) throw new Error("NOT_FOUND");
    Object.assign(site, payload, {
      lastSynced: "هم‌اکنون",
      connectionStatus: 'connected'
    });
    this.save();
    return site;
  }

  // --- LOGS AND WEBHOOKS ---
  public getWpLogs() {
    return this.getState().wpLogs;
  }

  public saveWpLog(logData: any) {
    const db = this.getState();
    const newLog = {
      id: `log_wp_${Date.now()}`,
      timestamp: new Date().toLocaleDateString('fa-IR') + ' ' + new Date().toLocaleTimeString('fa-IR'),
      siteName: logData.siteName,
      siteUrl: logData.siteUrl,
      type: logData.type,
      status: logData.status || "success",
      detail: logData.detail
    };
    db.wpLogs.unshift(newLog);
    if (db.wpLogs.length > 100) db.wpLogs.pop();
    this.save();
    return newLog;
  }

  public getWpWebhooks() {
    return this.getState().wpWebhooks;
  }

  public saveWpWebhook(whData: any) {
    const db = this.getState();
    const newWh = {
      id: `wh_${Date.now()}`,
      timestamp: new Date().toLocaleDateString('fa-IR') + ' ' + new Date().toLocaleTimeString('fa-IR'),
      siteUrl: whData.siteUrl,
      event: whData.event,
      payload: whData.payload || {}
    };
    db.wpWebhooks.unshift(newWh);
    if (db.wpWebhooks.length > 100) db.wpWebhooks.pop();
    this.save();
    return newWh;
  }

  // --- EXTERNAL APIS ---
  public getExternalConnections() {
    return this.getState().externalApis;
  }

  public saveExternalConnection(connData: any) {
    const db = this.getState();
    const newConn = {
      id: `api_conn_${Date.now()}`,
      name: connData.name,
      endpointUrl: connData.endpointUrl,
      apiType: connData.apiType || "REST",
      authType: connData.authType || "ApiKey",
      credentials: connData.credentials || "masked_secret_key_xxxxxx",
      status: "active",
      healthState: "healthy",
      lastPing: "کمتر از ۱ دقیقه"
    };
    db.externalApis.push(newConn);
    this.save();
    return newConn;
  }

  public toggleExternalConnection(id: string) {
    const db = this.getState();
    const conn = db.externalApis.find(c => c.id === id);
    if (!conn) throw new Error("NOT_FOUND");
    conn.status = conn.status === "active" ? "disabled" : "active";
    conn.healthState = conn.status === "active" ? "healthy" : "offline";
    this.save();
    return conn;
  }

  // --- API LOGS ---
  public getApiLogs() {
    return this.getState().apiLogs;
  }

  public saveApiLog(logData: any) {
    const db = this.getState();
    const newLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('fa-IR'),
      method: logData.method,
      endpoint: logData.endpoint,
      status: logData.status,
      payload: logData.payload,
      response: logData.response || {}
    };
    db.apiLogs.unshift(newLog);
    if (db.apiLogs.length > 50) db.apiLogs.pop();
    this.save();
    return newLog;
  }

  public clearApiLogs() {
    const db = this.getState();
    db.apiLogs = [];
    this.save();
  }
}
