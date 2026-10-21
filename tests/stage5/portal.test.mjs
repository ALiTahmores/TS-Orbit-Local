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
test('durable portal capabilities, safe projections and feedback lifecycle', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-stage5-portal-'));
  const generated = path.join(directory, 'portal.cjs');
  await build({ stdin: { contents: "export { createPortalRouter } from './server/portal/router.ts'; export { createPublicRouter } from './server/public/router.ts'; export { resolvePortalProject } from './server/portal/service.ts'; export { ScopedState, membership } from './server/policy/scope.ts'; export { PersistenceCoordinator } from './server/persistence.ts'; export { SqliteStore, emptyState } from './server/db/store.ts';", resolveDir: root }, outfile: generated, bundle: true, platform: 'node', target: 'node24', format: 'cjs', logLevel: 'silent' });
  const { createPortalRouter, createPublicRouter, resolvePortalProject, ScopedState, membership, PersistenceCoordinator, SqliteStore, emptyState } = createRequire(import.meta.url)(generated);
  const state = emptyState();
  state.users = ['owner', 'writer', 'viewer', 'outside'].map(id => ({ id, name: id + ' name', email: id + '@test.invalid', username: id, accountStatus: 'ACTIVE', role: id === 'outside' ? 'ADMIN' : 'USER', systemRole: id === 'outside' ? 'ADMIN' : 'USER' }));
  state.workspaces = [{ id: 'wa', ownerId: 'owner', members: [{ userId: 'writer', role: 'MEMBER', permissions: ['write'] }, { userId: 'viewer', role: 'VIEWER', permissions: ['read'] }] }, { id: 'wb', ownerId: 'outside', members: [] }];
  const tokenA = 'legacy_capability_a_1234567890', tokenB = 'legacy_capability_b_1234567890';
  state.projects = [{ id: 'project_a', workspaceId: 'wa', title: 'A', clientPortalEnabled: true, portalToken: tokenA, budget: 100, isBudgetConfidential: true, adminPassword: 'secret', apiKey: 'hidden' }, { id: 'project_b', workspaceId: 'wb', title: 'B', clientPortalEnabled: true, portalToken: tokenB, budget: 200 }];
  state.tasks = [{ id: 'visible_a', projectId: 'project_a', workspaceId: 'wa', title: 'Visible', clientVisible: true, adminPassword: 'task secret' }, { id: 'private_a', projectId: 'project_a', workspaceId: 'wa', title: 'Private' }, { id: 'visible_b', projectId: 'project_b', workspaceId: 'wb', title: 'Foreign', clientVisible: true }];
  state.files = [{ id: 'public_a', projectId: 'project_a', workspaceId: 'wa', name: 'Approved.txt', approved: true, clientVisible: true, managed: true }, { id: 'upload_a', projectId: 'project_a', workspaceId: 'wa', name: 'Guest.txt', approved: false, clientVisible: false, managed: true, publicUpload: true }, { id: 'private_a', projectId: 'project_a', workspaceId: 'wa', name: 'Internal.txt', managed: true }, { id: 'public_b', projectId: 'project_b', workspaceId: 'wb', name: 'Foreign.txt', approved: true, clientVisible: true, managed: true }, { id: 'legacy_a', projectId: 'project_a', workspaceId: 'wa', name: 'Metadata only', approved: true, clientVisible: true }];
  const scoped = new ScopedState(state);
  const dbFile = path.join(directory, 'portal.sqlite'); let store = new SqliteStore(dbFile); store.saveState(state);
  let snapshot;
  const db = { beginTransaction() { snapshot = structuredClone(state); store.begin(); }, commitTransaction() { store.saveState(state); store.commit(); snapshot = undefined; }, rollbackTransaction() { store.rollback(); if (snapshot) { for (const key of Object.keys(state)) delete state[key]; Object.assign(state, snapshot); snapshot = undefined; } }, getState() { return state; } };
  const persistence = new PersistenceCoordinator(db);
  const events = [], fileCalls = [];
  const broadcast = (event, payload) => persistence.afterCommit(() => events.push({ event, payload }));
  const broadcastWorkspace = (workspaceId, event, payload) => persistence.afterCommit(() => events.push({ workspaceId, event, payload }));
  const files = {
    validatePublicAttachment(project, id) { return state.files.some(file => file.id === id && file.projectId === project.id && file.managed === true && !file.deletedAt && (file.publicUpload === true || file.approved === true && file.clientVisible === true)); },
    listPublic(project) { return state.files.filter(file => file.projectId === project.id && file.managed === true && file.approved === true && file.clientVisible === true && !file.deletedAt).map(file => ({ id: file.id, name: file.name, contentAvailable: true })); },
    sendPublic(req, res, _next, project, id, versionId) { fileCalls.push({ projectId: project.id, id, versionId }); const file = files.listPublic(project).find(file => file.id === id); if (!file || versionId && versionId !== 'version_a') return res.status(404).json({ error: 'FILE_NOT_FOUND' }); res.json({ id, versionId, content: 'actual test bytes' }); },
    uploadPublic(req, res, _next, project) { fileCalls.push({ projectId: project.id, upload: true }); res.status(201).json({ projectId: project.id, approved: false, clientVisible: false }); },
  };
  const app = express(); app.use(persistence.middleware); app.use(express.json());
  app.use('/api/public', createPublicRouter(state, scoped, { files, broadcast, broadcastWorkspace }));
  app.use((req, res, next) => { const user = state.users.find(row => row.id === req.headers['x-test-user']); const workspaceId = String(req.headers['x-workspace-id'] || 'wa'); if (!membership(state, user, workspaceId)) return res.status(403).json({ error: 'FORBIDDEN' }); scoped.run({ kind: 'workspace', user, workspaceId, method: req.method, path: req.path }, next); });
  app.use('/api', createPortalRouter({ scoped, files, broadcast, broadcastWorkspace }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.code || error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  const call = async (route, body, method = body === undefined ? 'GET' : 'POST', user = 'owner', workspace = 'wa') => { const response = await fetch(base + route, { method, headers: { 'content-type': 'application/json', 'x-test-user': user, 'x-workspace-id': workspace }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); return { status: response.status, body: await response.json() }; };
  const ok = (response, status = 200) => { assert.equal(response.status, status, JSON.stringify(response.body)); return response.body; };
  const publicPath = token => '/public/portal/' + token;
  let currentToken = tokenA, feedbackId;

  await t.test('historical exact tokens work without seeding; projections hide secrets and other projects', async () => {
    const before = structuredClone(state);
    const data = ok(await call(publicPath(tokenA)));
    assert.deepEqual(state, before);
    assert.deepEqual(data.tasks.map(row => row.id), ['visible_a']);
    assert.deepEqual(data.files.map(row => row.id), ['public_a']);
    assert.equal(data.project.budget, undefined); assert.equal(data.project.portalToken, undefined); assert.equal(data.project.adminPassword, undefined); assert.equal(data.tasks[0].adminPassword, undefined);
    assert.equal(ok(await call(publicPath(tokenB))).project.budget, 200);
    for (const token of ['project_a', tokenA.slice(0, -1), tokenA + 'x', 'LEGACY_CAPABILITY_A_1234567890']) assert.equal((await call(publicPath(token))).status, 404);
    const project = state.projects[0]; project.portalExpiresAt = 'not a date'; assert.equal(resolvePortalProject(state, scoped, tokenA), undefined); delete project.portalExpiresAt;
    state.workspaces[0].isActive = false; assert.equal(resolvePortalProject(state, scoped, tokenA), undefined); delete state.workspaces[0].isActive;
    project.departmentId = 'missing'; assert.equal(resolvePortalProject(state, scoped, tokenA), undefined); delete project.departmentId;
    const previous = state.projects[1].portalToken; state.projects[1].portalToken = tokenA; assert.equal(resolvePortalProject(state, scoped, tokenA), undefined); state.projects[1].portalToken = previous;
  });
  await t.test('portal controls require actual managers; expiry, rotation, disable and revoke invalidate immediately', async () => {
    assert.equal((await call('/projects/project_a/portal', { enabled: false }, 'PUT', 'writer')).status, 403);
    assert.equal((await call('/projects/project_a/portal-token', {}, 'POST', 'outside', 'wb')).status, 404);
    assert.equal((await call('/projects/project_a/portal-token', { expiresAt: '2026-02-31T00:00:00Z' })).status, 422);
    assert.equal((await call('/projects/project_a/portal-token', { expiresAt: 'tomorrow' })).status, 422);
    const rotated = ok(await call('/projects/project_a/portal-token', {})); currentToken = rotated.token;
    assert.match(currentToken, /^[a-f0-9]{64}$/); assert.notEqual(currentToken, tokenA); assert.equal((await call(publicPath(tokenA))).status, 404);
    assert.ok(Date.parse(rotated.project.portalExpiresAt) > Date.now() + 29 * 86400_000);
    ok(await call(publicPath(currentToken)));
    ok(await call('/projects/project_a/portal', { enabled: false }, 'PUT')); assert.equal((await call(publicPath(currentToken))).status, 404);
    ok(await call('/projects/project_a/portal', { enabled: true, expiresAt: '2020-01-01T00:00:00Z' }, 'PUT')); assert.equal((await call(publicPath(currentToken))).status, 404);
    ok(await call('/projects/project_a/portal', { enabled: true, expiresAt: null }, 'PUT')); ok(await call(publicPath(currentToken)));
    ok(await call('/projects/project_a/portal-token', {}, 'DELETE')); assert.equal((await call(publicPath(currentToken))).status, 404);
    const old = currentToken; const enabled = ok(await call('/projects/project_a/portal', { enabled: true }, 'PUT')); currentToken = enabled.project.portalToken;
    assert.notEqual(currentToken, old); assert.equal((await call(publicPath(old))).status, 404); ok(await call(publicPath(currentToken)));
  });
  await t.test('file routes delegate exact authorized project and version; revoked links never reach storage', async () => {
    ok(await call(publicPath(currentToken) + '/files/public_a/download'));
    const version = ok(await call(publicPath(currentToken) + '/files/public_a/versions/version_a/download')); assert.equal(version.versionId, 'version_a');
    assert.equal((await call(publicPath(currentToken) + '/files/public_b/download')).status, 404);
    assert.equal((await call(publicPath(currentToken) + '/files/private_a/download')).status, 404);
    assert.equal((await call(publicPath(currentToken) + '/files/public_a/versions/foreign/download')).status, 404);
    assert.equal(ok(await call(publicPath(currentToken) + '/files', {}), 201).projectId, 'project_a');
    const count = fileCalls.length; assert.equal((await call(publicPath('invalid_capability_1234567890') + '/files/public_a/download')).status, 404); assert.equal(fileCalls.length, count);
    assert.ok(fileCalls.every(row => row.projectId === 'project_a'));
  });
  await t.test('public feedback validates attachments and server owns identity, status, history and scope', async () => {
    const route = publicPath(currentToken) + '/feedback';
    for (const extra of [{ id: 'fake' }, { projectId: 'project_b' }, { status: 'approved' }, { history: [] }, { senderRole: 'admin' }]) assert.equal((await call(route, { senderName: 'Client', content: 'Message', ...extra })).status, 422);
    for (const attachments of [['public_b'], ['private_a'], ['legacy_a'], ['missing']]) assert.equal((await call(route, { senderName: 'Client', content: 'Message', attachments })).status, 422);
    const submitted = ok(await call(route, { senderName: 'Client', content: 'Please change this', category: 'design', attachments: ['public_a', 'upload_a'] }), 201);
    feedbackId = submitted.id; assert.match(feedbackId, /^fb_/); assert.equal(submitted.feedback.status, 'pending');
    const row = state.feedback.find(row => row.id === feedbackId); assert.equal(row.workspaceId, 'wa'); assert.equal(row.creatorId, undefined); assert.equal(row.history[0].actorId, null);
    assert.equal(state.notifications.length, 1); assert.equal(state.notifications[0].userId, 'owner'); assert.equal(state.notifications[0].workspaceId, 'wa'); assert.equal(state.notifications[0].feedbackId, feedbackId);
    assert.ok(events.some(row => row.workspaceId === 'wa' && row.event === 'app_feedback_updated'));
    assert.equal(JSON.stringify(submitted).includes('owner name'), false);
  });
  await t.test('feedback status, replies, approval and deletion require actual workspace management', async () => {
    const route = '/projects/project_a/feedbacks/' + feedbackId;
    assert.equal((await call(route + '/status', { status: 'approved' }, 'PUT', 'writer')).status, 403);
    assert.equal((await call('/projects/project_b/feedbacks/' + feedbackId + '/status', { status: 'approved' }, 'PUT', 'outside', 'wb')).status, 404);
    assert.equal((await call(route + '/status', { status: 'invented' }, 'PUT')).status, 422);
    const approved = ok(await call(route + '/status', { status: 'approved', reply: 'Approved and addressed' }, 'PUT'));
    assert.equal(approved.approved, true); assert.equal(approved.replies.length, 1); assert.equal(approved.replies[0].actorId, 'owner');
    assert.equal(state.feedback.find(row => row.id === feedbackId).approvedById, 'owner');
    const reopened = ok(await call(route + '/status', { status: 'in_progress' }, 'PUT')); assert.equal(reopened.status, 'in_progress'); assert.equal(reopened.history.length, 4); assert.equal(reopened.approved, false); assert.equal(state.feedback.find(row => row.id === feedbackId).approvedById, null);
    const visible = ok(await call(publicPath(currentToken))).feedback.find(row => row.id === feedbackId);
    assert.equal(visible.history[1].actorId, undefined); assert.equal(visible.replies[0].actorId, undefined); assert.equal(visible.replies[0].senderName, 'مدیریت پروژه');
    assert.equal((await call(route, {}, 'DELETE', 'writer')).status, 403);
  });
  await t.test('internal feedback stays private and legacy adapter resolves real scoped projects only', async () => {
    const internal = ok(await call('/projects/project_a/feedbacks', { message: 'Private internal note', category: 'technical' }, 'POST', 'writer'), 201);
    assert.equal(internal.senderName, 'writer name'); assert.equal(internal.source, 'internal'); assert.equal(internal.clientVisible, false);
    assert.equal(ok(await call(publicPath(currentToken))).feedback.some(row => row.id === internal.id), false);
    assert.equal((await call('/projects/project_a/feedbacks', { message: 'Escalation', clientVisible: true }, 'POST', 'writer')).status, 403);
    const published = ok(await call('/projects/project_a/feedbacks', { message: 'Public management note', clientVisible: true }), 201);
    assert.equal(ok(await call(publicPath(currentToken))).feedback.find(row => row.id === published.id).senderName, 'مدیریت پروژه');
    assert.equal((await call('/client-feedback', { clientId: 'invented-client', feedbackContent: 'No fake success' })).status, 404);
    assert.equal((await call('/client-feedback', { clientId: 'project_b', feedbackContent: 'Cross scope' })).status, 404);
    const adapted = ok(await call('/client-feedback', { clientId: 'project_a', feedbackContent: 'Real feedback' }, 'POST', 'writer'), 201); assert.equal(adapted.feedback.projectId, 'project_a');
    assert.equal((await call('/projects/project_a/feedbacks', { message: 'Forbidden' }, 'POST', 'viewer')).status, 403);
    assert.ok(ok(await call('/projects/project_a/feedbacks', undefined, 'GET', 'viewer')).some(row => row.id === feedbackId));
  });
  await t.test('failed durable writes roll back feedback, notifications and queued events together', async () => {
    const before = structuredClone(state); const eventCount = events.length;
    store.database.exec("CREATE TRIGGER portal_feedback_failure BEFORE INSERT ON feedback BEGIN SELECT RAISE(ABORT, 'simulated disk failure'); END;");
    assert.equal((await call(publicPath(currentToken) + '/feedback', { senderName: 'Client', content: 'Must roll back' })).status, 503);
    assert.deepEqual(state, before); assert.equal(events.length, eventCount);
    assert.deepEqual(store.loadState().feedback, before.feedback); assert.deepEqual(store.loadState().notifications, before.notifications);
    store.database.exec('DROP TRIGGER portal_feedback_failure');
  });
  await t.test('nested historical feedback is preserved without GET mutation and materializes safely on change', async () => {
    state.projects[0].clientFeedbacks = [{ id: 'historical_nested', senderName: 'Historical client', senderRole: 'client', message: 'Historical feedback', category: 'general', status: 'pending', source: 'client_portal', createdAt: '2025-01-01T00:00:00Z' }, { id: 'conflicting_nested', projectId: 'project_b', senderName: 'Wrong scope', message: 'Hidden' }];
    store.saveState(state, { allowLegacy: true });
    const before = structuredClone(state);
    assert.ok(ok(await call('/projects/project_a/feedbacks')).some(row => row.id === 'historical_nested'));
    assert.equal(ok(await call(publicPath(currentToken))).feedback.some(row => row.id === 'conflicting_nested'), false);
    assert.deepEqual(state, before);
    const updated = ok(await call('/projects/project_a/feedbacks/historical_nested/status', { status: 'resolved', reply: 'Historical reply' }, 'PUT'));
    assert.equal(updated.status, 'resolved'); assert.equal(updated.replies.length, 1);
    assert.equal(state.feedback.find(row => row.id === 'historical_nested').workspaceId, 'wa');
    assert.equal(state.projects[0].clientFeedbacks.some(row => row.id === 'historical_nested'), false);
  });
  await t.test('feedback history, notifications, expiry and revocation survive a fresh SQLite connection', async () => {
    store.close(); store = new SqliteStore(dbFile); const loaded = store.loadState();
    assert.deepEqual(loaded.feedback, state.feedback); assert.deepEqual(loaded.notifications, state.notifications);
    assert.equal(resolvePortalProject(loaded, new ScopedState(loaded), currentToken).id, 'project_a');
    const route = '/projects/project_a/feedbacks/' + feedbackId;
    ok(await call(route, {}, 'DELETE')); assert.ok(state.feedback.find(row => row.id === feedbackId).history.some(row => row.action === 'deleted'));
    assert.equal(ok(await call(publicPath(currentToken))).feedback.some(row => row.id === feedbackId), false);
    ok(await call('/projects/project_a/portal-token', {}, 'DELETE'));
    store.close(); store = new SqliteStore(dbFile); const revoked = store.loadState();
    assert.equal(resolvePortalProject(revoked, new ScopedState(revoked), currentToken), undefined);
    assert.equal(revoked.feedback.find(row => row.id === feedbackId).deletedById, 'owner');
  });
});
