import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import express from 'express';

const root = fileURLToPath(new URL('../../', import.meta.url));
test('workspace services enforce actual membership and invitation authority', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-workspaces-test-'));
  const generated = path.join(directory, 'workspaces.cjs');
  await build({ entryPoints: [path.join(root, 'server/workspaces/router.ts')], outfile: generated, bundle: true, platform: 'node', target: 'node24', format: 'cjs', logLevel: 'silent' });
  const { createWorkspaceRouter } = createRequire(import.meta.url)(generated);
  const account = (id, role = 'USER', systemRole = 'USER') => ({ id, email: id + '@example.test', name: id, username: id, avatar: '/avatars/avatar-1.svg', phone: '09123450000', role, systemRole, accountStatus: 'ACTIVE', isActive: true, memberships: [] });
  const a = account('owner_a'), b = account('owner_b', 'OWNER', 'ADMIN'), c = account('member_c');
  const state = { users: [a, b, c], auditLogs: [], workspaces: [
    { id: 'workspace_a', name: 'Workspace A', ownerId: a.id, inviteCode: 'a'.repeat(64), members: [{ userId: a.id, role: 'OWNER', permissions: ['*'] }, { userId: c.id, role: 'MEMBER', permissions: ['read', 'write'] }] },
    { id: 'workspace_b', name: 'Workspace B', ownerId: b.id, inviteCode: 'b'.repeat(64), members: [{ userId: b.id, role: 'OWNER', permissions: ['*'] }] }
  ] };
  b.memberships.push({ workspaceId: 'workspace_a', role: 'OWNER' });
  const app = express(); app.use(express.json());
  const authenticateToken = (req, res, next) => { req.user = state.users.find(user => req.headers.authorization === 'Bearer ' + user.id); if (!req.user || req.user.isActive === false) return res.status(401).json({ error: 'UNAUTHORIZED' }); next(); };
  app.use('/api/workspaces', createWorkspaceRouter({ state, authenticateToken }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/workspaces`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(directory, { recursive: true, force: true }); });
  const call = async (user, route = '', body, method = body === undefined ? 'GET' : 'POST') => {
    const response = await fetch(base + route, { method, headers: { authorization: 'Bearer ' + user.id, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };

  await t.test('GET respects real user IDs, has no creation effects and hides invitation secrets', async () => {
    const count = state.workspaces.length;
    const list = await call(b); assert.deepEqual(list.body.workspaces.map(workspace => workspace.id), ['workspace_b']);
    assert.equal(state.workspaces.length, count); assert.ok(!state.workspaces.some(workspace => workspace.id === 'ws_undefined'));
    const memberList = await call(c);
    assert.equal(memberList.body.workspaces[0].inviteCode, undefined);
    assert.equal(memberList.body.workspaces[0].pendingInvites, undefined);
    assert.equal(memberList.body.workspaces[0].members.find(member => member.userId === a.id).email, undefined);
    assert.equal((await call(b, '/workspace_a', { name: 'Hijacked' }, 'PUT')).status, 404);
    assert.equal((await call(c, '/workspace_a', { name: 'Hijacked' }, 'PUT')).status, 403);
    assert.equal(state.workspaces[0].name, 'Workspace A');
  });
  await t.test('workspace creation establishes only local ownership and rejects mass assignment', async () => {
    assert.equal((await call(c, '', { name: 'Attacker', ownerId: a.id, systemRole: 'ADMIN' })).status, 400);
    const created = await call(c, '', { name: 'Personal second workspace' });
    assert.equal(created.status, 201); assert.equal(created.body.ownerId, c.id);
    assert.match(created.body.inviteCode, /^[a-f0-9]{64}$/);
    assert.equal(c.role, 'USER'); assert.equal(c.systemRole, 'USER');
    assert.equal(c.memberships.find(member => member.workspaceId === created.body.id).role, 'OWNER');
  });
  await t.test('general invitation never accepts a requested owner or admin role', async () => {
    const code = state.workspaces[0].inviteCode;
    assert.equal((await call(b, '/join', { inviteCode: code, role: 'ADMIN' })).status, 400);
    const joined = await call(b, '/join', { inviteCode: code });
    assert.equal(joined.status, 200); assert.equal(state.workspaces[0].members.find(member => member.userId === b.id).role, 'MEMBER');
    assert.equal((await call(b, '/members', { workspaceId: 'workspace_a', targetUserId: c.id, role: 'ADMIN' })).status, 403);
    assert.equal((await call(b, '/regenerate-invite', { workspaceId: 'workspace_a' })).status, 403);
    assert.equal((await call(b, '/invite', { workspaceId: 'workspace_a', email: 'future@example.test', role: 'ADMIN' })).status, 403);
    assert.equal(joined.body.workspace.inviteCode, undefined);
  });
  await t.test('member management mirrors identities without changing global authority', async () => {
    const assigned = await call(a, '/members', { workspaceId: 'workspace_a', targetUserId: b.id, role: 'ADMIN' });
    assert.equal(assigned.status, 200); assert.equal(b.role, 'OWNER'); assert.equal(b.systemRole, 'ADMIN');
    assert.equal(b.memberships.find(member => member.workspaceId === 'workspace_a').role, 'ADMIN');
    assert.equal((await call(b, '/members', { workspaceId: 'workspace_a', targetUserId: c.id, role: 'ADMIN' })).status, 403);
    assert.equal((await call(a, '/members', { workspaceId: 'workspace_a', targetUserId: c.id, role: 'OWNER' })).status, 400);
    assert.equal((await call(a, '/members', { workspaceId: 'workspace_a', targetUserId: a.id, role: 'MEMBER' })).status, 403);
    assert.equal(state.workspaces[0].ownerId, a.id);
    assert.equal((await call(a, '/workspace_a', { name: 'Renamed' }, 'PUT')).status, 200);
    assert.equal(b.memberships.find(member => member.workspaceId === 'workspace_a').workspaceName, 'Renamed');
  });
  await t.test('targeted invites are separate from members and bind nonce to the invited email', async () => {
    const beforeMembers = state.workspaces[0].members.length;
    const invitation = await call(a, '/invite', { workspaceId: 'workspace_a', email: 'future@example.test', role: 'ADMIN' });
    assert.equal(invitation.status, 201); assert.equal(state.workspaces[0].members.length, beforeMembers);
    assert.match(invitation.body.inviteCode, /^[a-f0-9]{64}$/);
    assert.equal((await call(b, '/join', { inviteCode: invitation.body.inviteCode })).status, 404);
    const future = account('future'); future.email = 'future@example.test'; state.users.push(future);
    const joined = await call(future, '/join', { inviteCode: invitation.body.inviteCode });
    assert.equal(joined.status, 200); assert.equal(future.systemRole, 'USER');
    assert.equal(state.workspaces[0].members.find(member => member.userId === future.id).role, 'ADMIN');
    assert.equal((await call(future, '/join', { inviteCode: invitation.body.inviteCode })).status, 404);
    assert.ok(state.workspaces[0].pendingInvites[0].usedAt);
  });
  await t.test('inactive membership cannot be restored using the general invitation code', async () => {
    const member = state.workspaces[0].members.find(member => member.userId === c.id);
    member.status = 'INVITED';
    assert.ok(!(await call(c)).body.workspaces.some(workspace => workspace.id === 'workspace_a'));
    assert.equal((await call(c, '/join', { inviteCode: state.workspaces[0].inviteCode })).status, 403);
    member.status = 'ACTIVE'; member.isActive = false;
    assert.equal((await call(c, '/join', { inviteCode: state.workspaces[0].inviteCode })).status, 403);
    member.isActive = true;
    const previous = state.workspaces[0].inviteCode;
    const rotated = await call(a, '/regenerate-invite', { workspaceId: 'workspace_a' });
    assert.equal(rotated.status, 200); assert.notEqual(rotated.body.inviteCode, previous);
    assert.equal((await call(c, '/join', { inviteCode: previous })).status, 404);
  });
  await t.test('explicit authorized membership reassignment coherently restores member-only lifecycle', async () => {
    const member = state.workspaces[0].members.find(member => member.userId === c.id);
    Object.assign(member, { accountStatus: 'BLOCKED', approvalStatus: 'pending', active: false, isActive: false, deletedAt: new Date().toISOString(), revokedAt: new Date().toISOString() });
    assert.ok(!(await call(c)).body.workspaces.some(workspace => workspace.id === 'workspace_a'));
    const restored = await call(a, '/members', { workspaceId: 'workspace_a', targetUserId: c.id, role: 'MEMBER' });
    assert.equal(restored.status, 200);
    assert.equal(member.accountStatus, 'ACTIVE'); assert.equal(member.approvalStatus, 'approved'); assert.equal(member.active, true);
    assert.equal(member.deletedAt, undefined); assert.equal(member.revokedAt, undefined);
    assert.ok((await call(c)).body.workspaces.some(workspace => workspace.id === 'workspace_a'));
    assert.equal(c.accountStatus, 'ACTIVE'); assert.equal(c.systemRole, 'USER');
  });
  await t.test('member removal is limited to managers and never touches the owner or the account', async () => {
    assert.equal((await call(c, '/members/' + b.id + '?workspaceId=workspace_a', undefined, 'DELETE')).status, 403);
    assert.equal((await call(b, '/members/' + a.id + '?workspaceId=workspace_a', undefined, 'DELETE')).status, 403);
    assert.equal((await call(b, '/members/' + b.id + '?workspaceId=workspace_a', undefined, 'DELETE')).status, 403);
    const removed = await call(b, '/members/' + c.id + '?workspaceId=workspace_a', undefined, 'DELETE');
    assert.equal(removed.status, 200);
    assert.ok(!removed.body.workspace.members.some(member => member.userId === c.id && member.isActive !== false));
    assert.ok(!(await call(c)).body.workspaces.some(workspace => workspace.id === 'workspace_a'));
    assert.equal(c.accountStatus, 'ACTIVE');
    assert.equal((await call(b, '/members/' + c.id + '?workspaceId=workspace_a', undefined, 'DELETE')).status, 404);
    assert.equal(state.auditLogs[0].action, 'WORKSPACE_MEMBER_REMOVED');
  });
});
