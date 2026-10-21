export const SCHEMA_VERSION = 1;
export const APPLICATION_ID = 0x54534f52;
export const collectionNames = [
  'users','workspaces','organizations','teams','teamMembers','projects','projectMembers','tasks','subtasks',
  'wordpressChecklist','seoChecklist','contentCenter','qaBugs','files','notifications','externalApis','apiLogs',
  'wpSites','wpLogs','wpWebhooks','comments','milestones','auditLogs','conversations','conversationMembers',
  'messages','conversationRequests','conversationPermissions','pinnedMessages','messageReactions','readReceipts',
  'departments','departmentMembers','departmentPermissions','departmentModules','departmentReports',
  'departmentSettings','departmentChats','departmentChannels','departmentRoles','departmentTemplates',
  'navigationGroups','navigationItems','moduleDefinitions','moduleInstances','modulePermissions',
  'approvalRequests','approvalHistory','notificationQueue','emailQueue','userProfiles','userSettings',
  'userSessions','loginHistory','userDevices','securityEvents','profileImages','userPreferences','userActivities',
  'fileVersions','timeEntries','feedback','jobs','jobHistory'
] as const;

// Stable columns support identity and scope queries. The full record stays in
// its own collection table, preserving fields added by older/newer clients.
export const migrations = [{ version: 1, sql: `
CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
CREATE TABLE entity_registry(collection TEXT NOT NULL, entity_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL, PRIMARY KEY(collection,entity_id), UNIQUE(collection,ordinal)) STRICT;
CREATE TABLE relation_registry(source_collection TEXT NOT NULL, source_id TEXT NOT NULL,
  field TEXT NOT NULL, target_collection TEXT NOT NULL, target_id TEXT NOT NULL,
  PRIMARY KEY(source_collection,source_id,field,target_collection,target_id),
  FOREIGN KEY(source_collection,source_id) REFERENCES entity_registry(collection,entity_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY(target_collection,target_id) REFERENCES entity_registry(collection,entity_id) DEFERRABLE INITIALLY DEFERRED) STRICT;
CREATE INDEX relation_target ON relation_registry(target_collection,target_id);
CREATE TABLE quarantine(signature TEXT PRIMARY KEY, collection TEXT NOT NULL, ordinal INTEGER NOT NULL,
  reason TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload))) STRICT;
CREATE TABLE legacy_allowlist(signature TEXT PRIMARY KEY, occurrence_count INTEGER NOT NULL CHECK(occurrence_count>0)) STRICT;
CREATE TABLE import_sources(source_hash TEXT PRIMARY KEY, source_bytes INTEGER NOT NULL,
  imported_at TEXT NOT NULL, raw BLOB NOT NULL, report TEXT NOT NULL CHECK(json_valid(report))) STRICT;
CREATE TABLE state_properties(key TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload))) STRICT;
${collectionNames.map(name => `CREATE TABLE "${name}"(ordinal INTEGER PRIMARY KEY,
  entity_id TEXT, user_id TEXT, workspace_id TEXT, project_id TEXT, department_id TEXT,
  timestamp_utc TEXT, amount REAL, currency TEXT,
  payload TEXT NOT NULL CHECK(json_valid(payload))) STRICT;
CREATE INDEX "${name}_id" ON "${name}"(entity_id);
CREATE INDEX "${name}_scope" ON "${name}"(workspace_id,project_id);
CREATE INDEX "${name}_user" ON "${name}"(user_id);`).join('\n')}
` }];
