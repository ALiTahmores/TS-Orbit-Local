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
test('durable personal notifications and permission-filtered activity', async t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-stage6-notifications-'));
  const compiled = path.join(temporary, 'notifications.cjs');
  await build({ stdin: { contents: "export {createNotificationService,createNotificationRouter} from './server/notifications/index.ts'; export {ScopedState,membership} from './server/policy/scope.ts'; export {PersistenceCoordinator} from './server/persistence.ts'; export {SqliteStore,emptyState} from './server/db/store.ts';", resolveDir: root }, outfile: compiled, bundle: true, platform: 'node', target: 'node24', format: 'cjs', logLevel: 'silent' });
  const { createNotificationService, createNotificationRouter, ScopedState, membership, PersistenceCoordinator, SqliteStore, emptyState } = createRequire(import.meta.url)(compiled);
  t.after(() => {
    assert.equal(path.dirname(path.resolve(temporary)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(temporary).startsWith('orbit-stage6-notifications-'));
    fs.rmSync(temporary, { recursive: true, force: true });
  });
  const fixture = async name => {
    const directory = path.join(temporary, name); fs.mkdirSync(directory);
    const state = emptyState();
    state.users = ['owner', 'writer', 'viewer', 'outside', 'inactive'].map(id => ({ id, name: id + ' name', username: id, email: id + '@example.invalid', accountStatus: id === 'inactive' ? 'INACTIVE' : 'ACTIVE', role: 'USER' }));
    state.workspaces = [{ id: 'wa', ownerId: 'owner', members: [{ userId: 'writer', role: 'MEMBER', permissions: ['write'] }, { userId: 'viewer', role: 'VIEWER' }, { userId: 'inactive', role: 'MEMBER' }] }, { id: 'wb', ownerId: 'outside', members: [{ userId: 'viewer', role: 'VIEWER' }] }];
    state.departments = [{ id: 'restricted', workspaceId: 'wa', name: 'Private department' }, { id: 'open', workspaceId: 'wa', name: 'Open department' }];
    state.departmentPermissions = [{ id: 'deny', workspaceId: 'wa', departmentId: 'restricted', role: 'VIEWER', action: 'read', isAllowed: false }];
    state.projects = [{ id: 'project', workspaceId: 'wa', title: 'Public to workspace' }, { id: 'secret', workspaceId: 'wa', departmentId: 'restricted', title: 'Restricted project' }, { id: 'foreign', workspaceId: 'wb', title: 'Other workspace' }];
    state.tasks = [{ id: 'task', workspaceId: 'wa', projectId: 'project', title: 'Real task' }, { id: 'secret-task', workspaceId: 'wa', projectId: 'secret', title: 'Restricted task' }];
    state.conversations = [{ id: 'conversation', workspaceId: 'wa', title: 'Participants only' }];
    state.conversationMembers = [{ id: 'member-owner', workspaceId: 'wa', conversationId: 'conversation', userId: 'owner' }, { id: 'member-viewer', workspaceId: 'wa', conversationId: 'conversation', userId: 'viewer' }];
    state.messages = [{ id: 'message', workspaceId: 'wa', conversationId: 'conversation', senderId: 'owner', content: 'Actual participant message', createdAt: '2026-01-01T00:00:00.000Z' }];
    state.notifications = [
      { id: 'legacy-unread', workspaceId: 'wa', recipientUserId: 'viewer', title: 'Old unread', read: false, timestamp: 'تاریخ قدیمی', secret: 'never expose' },
      { id: 'legacy-read', workspaceId: 'wa', recipientId: 'viewer', title: 'Old read', read: true, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'writer-own', workspaceId: 'wa', userId: 'writer', title: 'Other recipient', read: false },
      { id: 'viewer-foreign', workspaceId: 'wb', userId: 'viewer', title: 'Other workspace', read: false },
      { id: 'viewer-secret', workspaceId: 'wa', userId: 'viewer', projectId: 'secret', title: 'Restricted content', read: false },
      { id: 'writer-hidden-chat', workspaceId: 'wa', userId: 'writer', conversationId: 'conversation', title: 'Private chat', read: false },
      { id: 'ambiguous-recipient', workspaceId: 'wa', userId: 'viewer', recipientId: 'writer', title: 'Conflicting legacy recipients', read: false },
    ];
    const scoped = new ScopedState(state), filename = path.join(directory, 'orbit.sqlite');
    let store = new SqliteStore(filename); store.saveState(state); let snapshot;
    const db = { getState: () => state, beginTransaction() { store.begin(); snapshot = structuredClone(state); }, commitTransaction() { store.saveState(state); store.commit(); snapshot = undefined; }, rollbackTransaction() { store.rollback(); if (snapshot) { for (const key of Object.keys(state)) delete state[key]; Object.assign(state, snapshot); } snapshot = undefined; } };
    const persistence = new PersistenceCoordinator(db), events = [];
    const broadcast = (event, payload) => persistence.afterCommit(() => events.push({ event, payload, durableIds: store.loadState().notifications.map(row => row.id) }));
    const broadcastWorkspace = (workspaceId, event, payload) => persistence.afterCommit(() => events.push({ workspaceId, event, payload }));
    const service = createNotificationService({ scoped, broadcast, broadcastWorkspace });
    const app = express(); app.use(express.json()); app.use(persistence.middleware);
    app.use((req, res, next) => {
      const user = state.users.find(row => row.id === (req.headers['x-test-user'] || 'viewer'));
      const workspaceId = String(req.headers['x-workspace-id'] || 'wa');
      if (!membership(state, user, workspaceId)) return res.status(403).json({ error: 'FORBIDDEN' });
      scoped.run({ kind: 'workspace', user, workspaceId, method: req.method, path: req.path }, next);
    });
    app.post('/api/test/notify', (req, res, next) => { try { const rows = service.notify(req.body); res.status(201).json(rows); } catch (error) { next(error); } });
    app.post('/api/test/activity', (req, res, next) => { try { res.status(201).json(service.recordActivity(req.body)); } catch (error) { next(error); } });
    app.use('/api', createNotificationRouter(service));
    app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.code || error.message }));
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}/api`;
    const call = async (route, method = 'GET', body, user = 'viewer', workspace = 'wa') => {
      const response = await fetch(origin + route, { method, headers: { 'Content-Type': 'application/json', 'x-test-user': user, 'x-workspace-id': workspace }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() };
    };
    const stop = async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await persistence.stop(); store.close(); };
    return { state, store, scoped, service, persistence, events, call, filename, stop };
  };
  const ok = (result, status = 200) => { assert.equal(result.status, status, JSON.stringify(result.body)); return result.body; };

  await t.test('GET preserves legacy IDs/read flags and filters recipient, workspace, department and chat scope', async () => {
    const f = await fixture('projection');
    try {
      const before = structuredClone(f.state), rows = ok(await f.call('/notifications'));
      assert.deepEqual(rows.map(row => row.id), ['legacy-unread', 'legacy-read']);
      assert.equal(rows[0].read, false); assert.equal(rows[1].read, true); assert.equal(rows[0].secret, undefined);
      assert.equal(rows[0].timestamp, 'تاریخ قدیمی'); assert.deepEqual(f.state, before); assert.deepEqual(f.events, []);
      assert.deepEqual(ok(await f.call('/notifications', 'GET', undefined, 'writer')).map(row => row.id), ['writer-own']);
      assert.deepEqual(ok(await f.call('/notifications', 'GET', undefined, 'viewer', 'wb')).map(row => row.id), ['viewer-foreign']);
    } finally { await f.stop(); }
  });
  await t.test('viewer read and read-all persist only their own visible records and return committed DTOs', async () => {
    const f = await fixture('read');
    try {
      assert.equal((await f.call('/notifications/writer-own/read', 'PUT', {})).status, 404);
      const row = ok(await f.call('/notifications/legacy-unread/read', 'PUT', {})); assert.equal(row.id, 'legacy-unread'); assert.equal(row.read, true); assert.ok(row.readAt);
      assert.equal(f.store.loadState().notifications.find(row => row.id === 'legacy-unread').read, true);
      const firstReadAt = row.readAt; ok(await f.call('/notifications/legacy-unread/read', 'PUT', {}));
      assert.equal(f.state.notifications.find(row => row.id === 'legacy-unread').readAt, firstReadAt);
      assert.deepEqual(ok(await f.call('/notifications/read-all', 'PUT', {})), { success: true, changed: 0 });
      for (const id of ['writer-own', 'viewer-foreign', 'viewer-secret', 'ambiguous-recipient']) assert.equal(f.state.notifications.find(row => row.id === id).read, false, id);
      assert.deepEqual(f.events.map(({ event, payload }) => ({ event, payload })), [{ event: 'app_notifications_updated', payload: { type: 'data_changed' } }]);
      assert.ok(f.events[0].durableIds.includes('legacy-unread'));
    } finally { await f.stop(); }
  });
  await t.test('clear is durable personal dismissal and retains historic IDs and other recipients', async () => {
    const f = await fixture('clear');
    try {
      const before = structuredClone(f.state.notifications);
      assert.deepEqual(ok(await f.call('/notifications/clear', 'POST', {})), { success: true, changed: 2 });
      assert.deepEqual(ok(await f.call('/notifications')), []); assert.equal(f.state.notifications.length, before.length);
      for (const row of f.state.notifications) {
        const original = before.find(item => item.id === row.id);
        if (['legacy-unread', 'legacy-read'].includes(row.id)) { assert.ok(row.dismissedAt); const { dismissedAt, ...rest } = row; assert.deepEqual(rest, original); }
        else assert.deepEqual(row, original);
      }
      assert.deepEqual(ok(await f.call('/notifications/clear', 'POST', {})), { success: true, changed: 0 });
      assert.equal((await f.call('/notifications/legacy-unread/read', 'PUT', {})).status, 404);
      const reopened = new SqliteStore(f.filename); try { assert.ok(reopened.loadState().notifications.find(row => row.id === 'legacy-unread').dismissedAt); } finally { reopened.close(); }
    } finally { await f.stop(); }
  });
  await t.test('server event recipients are active permitted participants and retries cannot duplicate dismissed events', async () => {
    const f = await fixture('producer');
    try {
      const input = { workspaceId: 'wa', actorId: 'owner', recipientIds: ['owner', 'viewer', 'writer', 'outside', 'inactive', 'viewer'], title: 'New message', description: 'Actual content', type: 'chat.message', conversationId: 'conversation', messageId: 'message', link: 'chat', eventKey: 'message-created:message' };
      const rows = ok(await f.call('/test/notify', 'POST', input, 'owner'), 201); assert.equal(rows.length, 1); assert.equal(rows[0].userId, 'viewer');
      assert.equal(rows[0].eventKey, undefined); assert.equal(rows[0].actorId, undefined);
      assert.deepEqual(ok(await f.call('/test/notify', 'POST', input, 'owner'), 201), []);
      ok(await f.call('/notifications/clear', 'POST', {}));
      assert.deepEqual(ok(await f.call('/test/notify', 'POST', input, 'owner'), 201), []);
      assert.equal(f.store.loadState().notifications.filter(row => row.eventKey === input.eventKey).length, 1);
      const restricted = { ...input, conversationId: undefined, messageId: undefined, projectId: 'secret', eventKey: 'secret-created' };
      assert.deepEqual(ok(await f.call('/test/notify', 'POST', restricted, 'owner'), 201).map(row => row.userId), ['writer']);
    } finally { await f.stop(); }
  });
  await t.test('an event cannot forge an actor, cross workspace or inject an external notification link', async () => {
    const f = await fixture('forgery');
    try {
      const input = { workspaceId: 'wa', actorId: 'owner', recipientIds: ['viewer'], title: 'Event', description: '', type: 'system' };
      assert.equal((await f.call('/test/notify', 'POST', input, 'writer')).status, 403);
      assert.equal((await f.call('/test/notify', 'POST', { ...input, workspaceId: 'wb' }, 'owner')).status, 403);
      assert.equal((await f.call('/test/notify', 'POST', { ...input, projectId: 'foreign' }, 'owner')).status, 422);
      assert.equal((await f.call('/test/notify', 'POST', { ...input, link: 'javascript:alert(1)' }, 'owner')).status, 422);
      assert.equal((await f.call('/test/activity', 'POST', { workspaceId: 'wa', actorId: 'owner', action: 'TASK_UPDATED', targetId: 'task' }, 'writer')).status, 403);
    } finally { await f.stop(); }
  });
  await t.test('SQL failure rolls back notification and activity rows and suppresses invalidations', async () => {
    const f = await fixture('rollback');
    try {
      const before = structuredClone(f.state.notifications);
      f.store.database.exec("CREATE TRIGGER reject_notification BEFORE INSERT ON notifications WHEN json_extract(NEW.payload,'$.title')='REJECT' BEGIN SELECT RAISE(ABORT,'fixture storage failure'); END");
      const response = await f.call('/test/notify', 'POST', { workspaceId: 'wa', actorId: 'owner', recipientIds: ['viewer'], title: 'REJECT', description: '', type: 'system' }, 'owner');
      assert.equal(response.status, 503); assert.deepEqual(f.state.notifications, before); assert.deepEqual(f.store.loadState().notifications, before); assert.deepEqual(f.events, []);
      f.store.database.exec("CREATE TRIGGER reject_audit BEFORE INSERT ON auditLogs BEGIN SELECT RAISE(ABORT,'fixture audit failure'); END");
      assert.equal((await f.call('/test/activity', 'POST', { workspaceId: 'wa', actorId: 'owner', action: 'TASK_UPDATED', targetId: 'task', targetCollection: 'tasks' }, 'owner')).status, 503);
      assert.deepEqual(f.state.auditLogs, []); assert.deepEqual(f.store.loadState().auditLogs, []); assert.deepEqual(f.events, []);
    } finally { await f.stop(); }
  });
  await t.test('activity feed rechecks current target visibility and never serializes security audit payloads', async () => {
    const f = await fixture('activity');
    try {
      f.state.auditLogs.push(
        { id: 'public-audit', workspaceId: 'wa', userId: 'owner', action: 'TASK_UPDATED', targetId: 'task', details: 'Visible change', payload: { password: 'secret' }, ipAddress: 'private', timestamp: '2026-01-01T00:00:00.000Z' },
        { id: 'secret-audit', workspaceId: 'wa', userId: 'owner', action: 'TASK_UPDATED', targetId: 'secret-task', details: 'Hidden content' },
        { id: 'foreign-audit', workspaceId: 'wb', userId: 'outside', action: 'PROJECT_UPDATED', targetId: 'foreign', details: 'Foreign' },
        { id: 'legacy-deleted', workspaceId: 'wa', userId: 'owner', action: 'TASK_DELETED', targetId: 'missing', details: 'Unresolved historic' },
        { id: 'own-legacy-deleted', workspaceId: 'wa', userId: 'viewer', action: 'TASK_DELETED', targetId: 'own-missing', details: 'Own history' },
        { id: 'private-chat', workspaceId: 'wa', userId: 'owner', action: 'chat.message.created', targetId: 'message' },
      ); f.store.saveState(f.state);
      const before = structuredClone(f.state), rows = ok(await f.call('/activity-logs'));
      assert.deepEqual(rows.map(row => row.id), ['public-audit', 'own-legacy-deleted', 'private-chat']);
      assert.equal(rows[0].payload, undefined); assert.equal(rows[0].ipAddress, undefined); assert.equal(rows[0].user, 'owner name'); assert.deepEqual(f.state, before);
      assert.deepEqual(ok(await f.call('/activity-logs', 'GET', undefined, 'writer')).map(row => row.id), ['public-audit', 'secret-audit']);
      assert.ok(ok(await f.call('/activity-logs', 'GET', undefined, 'owner')).some(row => row.id === 'legacy-deleted'));
    } finally { await f.stop(); }
  });
  await t.test('permission snapshots retain deleted target history and remain subject to later department revocation', async () => {
    const f = await fixture('snapshot');
    try {
      const input = { workspaceId: 'wa', actorId: 'owner', action: 'TASK_UPDATED', targetId: 'secret-task', targetCollection: 'tasks', eventKey: 'event-one' };
      const first = ok(await f.call('/test/activity', 'POST', input, 'owner'), 201);
      assert.equal(ok(await f.call('/test/activity', 'POST', input, 'owner'), 201).id, first.id);
      const raw = f.state.auditLogs.find(row => row.id === first.id); assert.deepEqual(raw.accessSnapshot, { departmentIds: ['restricted'] }); assert.equal(raw.taskId, undefined);
      assert.deepEqual(ok(await f.call('/activity-logs')), []);
      f.state.tasks = f.state.tasks.filter(row => row.id !== 'secret-task'); f.store.saveState(f.state);
      assert.deepEqual(ok(await f.call('/activity-logs')), []);
      assert.equal(ok(await f.call('/activity-logs', 'GET', undefined, 'writer'))[0].id, first.id);
      f.state.departmentPermissions.push({ id: 'deny-writer', workspaceId: 'wa', departmentId: 'restricted', role: 'MEMBER', action: 'read', isAllowed: false }); f.store.saveState(f.state);
      assert.deepEqual(ok(await f.call('/activity-logs', 'GET', undefined, 'writer')), []);
      assert.equal(f.store.loadState().auditLogs.filter(row => row.eventKey === 'event-one').length, 1);
    } finally { await f.stop(); }
  });
  await t.test('deleting a retained chat message can record durable history without exposing it outside participants', async () => {
    const f = await fixture('tombstone');
    try {
      f.state.messages[0].deletedAt = '2026-02-01T00:00:00.000Z'; f.store.saveState(f.state);
      const row = ok(await f.call('/test/activity', 'POST', { workspaceId: 'wa', actorId: 'owner', action: 'chat.message.deleted', targetId: 'message', conversationId: 'conversation', messageId: 'message' }, 'owner'), 201);
      assert.deepEqual(ok(await f.call('/activity-logs')).map(item => item.id), [row.id]);
      assert.deepEqual(ok(await f.call('/activity-logs', 'GET', undefined, 'writer')), []);
      assert.equal(f.store.loadState().auditLogs[0].targetId, 'message');
    } finally { await f.stop(); }
  });
  await t.test('retained deleted file history uses the permission snapshot while downloads and inbox content remain hidden', async () => {
    const f = await fixture('file-tombstone');
    try {
      f.state.files.push({ id: 'removed-file', workspaceId: 'wa', projectId: 'project', name: 'Removed file', deletedAt: '2026-02-01T00:00:00.000Z' }); f.store.saveState(f.state);
      const row = ok(await f.call('/test/activity', 'POST', { workspaceId: 'wa', actorId: 'owner', action: 'FILE_DELETED', targetId: 'removed-file', targetCollection: 'files', fileId: 'removed-file' }, 'owner'), 201);
      assert.deepEqual(ok(await f.call('/activity-logs')).map(item => item.id), [row.id]);
      assert.equal(f.scoped.visible('files', f.state.files[0], { kind: 'workspace', user: f.state.users.find(user => user.id === 'viewer'), workspaceId: 'wa', path: '/api/files', method: 'GET' }), false);
      assert.equal((await f.call('/test/notify', 'POST', { workspaceId: 'wa', actorId: 'owner', recipientIds: ['viewer'], title: 'File', description: 'Removed', type: 'file', fileId: 'removed-file' }, 'owner')).status, 422);
    } finally { await f.stop(); }
  });
});
