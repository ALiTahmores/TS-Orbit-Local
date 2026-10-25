import fs from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import bcryptjs from 'bcryptjs';
import { config, getJwtSecret, validatePassword } from '../server/local-config.ts';
import { DbService } from '../src/data/dbService.ts';
import { localAvatar } from '../src/lib/localAssets.ts';

function flag(name: string): string {
  const index = process.argv.indexOf('--' + name);
  return index < 0 ? '' : (process.argv[index + 1] || '');
}

async function hiddenPassword(label: string): Promise<string> {
  if (!process.stdin.isTTY) throw new Error('Use an interactive terminal or explicitly supply --password-stdin.');
  process.stdout.write(label);
  const input = process.stdin;
  input.setRawMode(true);
  input.resume();
  input.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === '\u0003') { finish(); reject(new Error('Cancelled.')); return; }
        if (character === '\r' || character === '\n') { finish(); resolve(value); return; }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character >= ' ') value += character;
      }
    };
    const finish = () => { input.off('data', onData); input.setRawMode(false); input.pause(); process.stdout.write('\n'); };
    input.on('data', onData);
  });
}

let openedDatabase: DbService | undefined;
async function main() {
  const command = process.argv[2];
  if (!['bootstrap', 'set-password'].includes(command) || process.argv.includes('--password')) {
    throw new Error('Usage: npm run local:account -- bootstrap --email EMAIL --name NAME --phone PHONE | set-password --email EMAIL. Passwords are prompted, never passed as command arguments.');
  }
  const email = flag('email').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Provide a valid --email.');
  let password: string;
  if (process.argv.includes('--password-stdin')) {
    // Explicit opt-in for trusted piping or isolated tests; never echo input.
    const lines = fs.readFileSync(0, 'utf8').trimEnd().split(/\r?\n/);
    if (lines.length !== 2 || lines[0] !== lines[1]) throw new Error('stdin must contain the new password twice, on separate lines.');
    password = lines[0];
  } else {
    password = await hiddenPassword('New password (12+ characters, input hidden): ');
    if (password !== await hiddenPassword('Confirm password: ')) throw new Error('Passwords do not match.');
  }
  if (!validatePassword(password)) throw new Error('Password must contain at least 12 characters and at most 72 UTF-8 bytes.');
  const db = DbService.getInstance();
  openedDatabase = db;
  await db.initializeCloud();
  getJwtSecret();
  await db.beginTransaction();
  const state = db.getState();
  if (command === 'bootstrap') {
    if (state.users.some(user => user.systemRole === 'ADMIN' || (user.systemRole === undefined && user.role === 'OWNER'))) throw new Error('A system administrator already exists. Use set-password to recover the existing account.');
    if (state.users.some(user => user.email?.trim().toLowerCase() === email)) throw new Error('Account already exists; use set-password to preserve its identity.');
    const name = flag('name').trim(), phone = flag('phone').trim();
    if (!name || !phone) throw new Error('bootstrap requires --name and --phone.');
    const id = 'usr_' + randomUUID(), workspaceId = 'ws_' + randomUUID();
    const joinedAt = new Date().toISOString();
    const username = email.split('@')[0].replace(/[^a-z0-9_]/g, '_') + '_' + randomBytes(3).toString('hex');
    const user = { id, name, fullName: name, email, username, phone, role: 'OWNER', systemRole: 'ADMIN', status: 'ACTIVE', accountStatus: 'ACTIVE',
      approvalStatus: 'approved', approvedRole: 'OWNER', isActive: true, localPasswordRequired: false,
      passwordHash: bcryptjs.hashSync(password, 12), avatar: localAvatar(name), emailVerified: false,
      personalWorkspaceId: workspaceId, workspace: workspaceId,
      memberships: [{ workspaceId, workspaceName: `فضای کاری ${name}`, role: 'OWNER', permissions: ['*'], joinedAt }] };
    state.users.push(user);
    state.workspaces.push({ id: workspaceId, name: `فضای کاری ${name}`, ownerId: id,
      inviteCode: randomBytes(12).toString('hex'), createdAt: joinedAt,
      members: [{ userId: id, name, email, username, phone, avatar: user.avatar, role: 'OWNER', permissions: ['*'], joinedAt }] });
  } else {
    const user = state.users.find(user => user.email?.trim().toLowerCase() === email);
    if (!user) throw new Error('Account not found. No identity or membership has been changed.');
    user.passwordHash = bcryptjs.hashSync(password, 12);
    user.localPasswordRequired = false;
    delete user.recoveryCode;
    for (const session of state.userSessions) if (session.userId === user.id) {
      session.status = 'revoked';
      session.revokedAt = new Date().toISOString();
    }
  }
  // Password, sessions and the canonical signing secret change in one SQLite
  // transaction. A crash cannot leave the new password with the old token key.
  let replacementSecret: string | undefined;
  if (command === 'set-password') {
    replacementSecret = randomBytes(48).toString('hex');
    if (db.cloudStore) await db.cloudStore.setMetadata('jwt_secret', replacementSecret);
    else db.getStore().database.prepare("INSERT INTO metadata(key,value) VALUES ('jwt_secret',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(replacementSecret);
  }
  await db.commitTransaction();
  if (replacementSecret && !db.isCloud) {
    try { fs.writeFileSync(config.dataDir + '/jwt-secret', replacementSecret, { mode: 0o600 }); }
    catch { console.error('Signing secret is safely updated in SQLite; the legacy secret-file mirror could not be updated.'); }
  }
  await db.close();
  console.log(command === 'bootstrap' ? 'Local owner and workspace created. Start TS-Orbit and sign in.' : 'Local password updated; identity and memberships preserved. Start TS-Orbit and sign in again.');
}

main().catch(async error => {
  try { await openedDatabase?.rollbackTransaction(); await openedDatabase?.close(); } catch { /* Startup may have failed before the store opened. */ }
  console.error(error.message); process.exitCode = 1;
});
