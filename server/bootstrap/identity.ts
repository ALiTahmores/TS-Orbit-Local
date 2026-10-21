import type { DbService } from '../../src/data/dbService.ts';

/** Upgrade trusted historical system ownership exactly once. Workspace roles
 * never take part in this migration or become system-administrator grants. */
export function migrateIdentity(db: DbService): boolean {
  const database = db.getStore().database;
  if (database.prepare("SELECT value FROM metadata WHERE key='identity_stage3_v1'").get()) return false;
  const denied = ['BLOCKED', 'REJECTED', 'SUSPENDED', 'INACTIVE', 'PENDING', 'PENDING_APPROVAL', 'INVITED', 'DISABLED', 'DEACTIVATED', 'DELETED'];
  db.beginTransaction();
  try {
    const state = db.getState();
    for (const user of state.users) {
      user.systemRole = user.role === 'OWNER' ? 'ADMIN' : 'USER';
      const oldStatus = String(user.accountStatus || user.status || '').toUpperCase();
      user.accountStatus = user.isActive === false || user.active === false ? 'INACTIVE' : denied.includes(oldStatus) ? oldStatus : 'ACTIVE';
    }
    const at = new Date().toISOString();
    for (const session of state.userSessions) {
      if (session.status !== 'active' || (typeof session.tokenIdHash === 'string' && session.expiresAt)) continue;
      session.status = 'revoked'; session.revokedAt = at; session.revokeReason = 'legacy_session_upgrade';
      for (const history of state.loginHistory.filter(item => item.sessionId === session.id)) history.logoutTime = at;
    }
    database.prepare("INSERT INTO metadata(key,value) VALUES ('identity_stage3_v1',?)").run(JSON.stringify({ version: 1, completedAt: at }));
    db.commitTransaction();
    return true;
  } catch (error) { db.rollbackTransaction(); throw error; }
}
