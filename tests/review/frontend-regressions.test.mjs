import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const read = name => fs.readFileSync(new URL('../../src/lib/' + name, import.meta.url), 'utf8');
const formUrl = url(compile(read('formValues.ts')));
const values = await import(formUrl);
const domainUrl = url(compile(read('domain.ts')));
const analytics = await import(url(compile(read('taskAnalytics.ts')).replace("'./domain'", JSON.stringify(domainUrl)).replace("'./formValues'", JSON.stringify(formUrl))));

test('an unrelated editor save leaves a timed or legacy deadline absent from the patch', () => {
  for (const stored of ['2026-10-24T01:00:00+03:30', '1405/08/02', 'تاریخ قدیمی نامشخص']) {
    const original = { title: 'Original', deadline: stored, dueDate: stored };
    const patch = { title: 'Updated title', ...values.deadlineEditPatch(values.calendarDay(stored) || '', false) };
    const persisted = { ...original, ...patch };
    assert.equal(persisted.deadline, stored);
    assert.equal(persisted.dueDate, stored);
    assert.equal(persisted.title, 'Updated title');
    assert.equal(Object.hasOwn(patch, 'deadline'), false);
  }
});

test('an explicit date choice or clear updates both date aliases', () => {
  assert.deepEqual(values.deadlineEditPatch('2026-11-01', true), { deadline: '2026-11-01', dueDate: '2026-11-01' });
  assert.deepEqual(values.deadlineEditPatch('', true), { deadline: '', dueDate: '' });
});

test('the calendar uses the local day of a stored instant without changing a date-only value', () => {
  const instant = new Date(2026, 9, 24, 0, 30).toISOString();
  assert.equal(values.calendarDay(instant), '2026-10-24');
  assert.equal(analytics.dueDate({ deadlineCanonical: instant }), '2026-10-24');
  assert.equal(values.calendarDay('2026-10-24'), '2026-10-24');
  assert.equal(values.calendarDay('invalid'), undefined);
});

test('overdue and on-time metrics respect a timed deadline within the same calendar day', () => {
  const task = { status: 'pending', deadlineCanonical: '2026-10-24T09:00:00Z' };
  assert.equal(analytics.isOverdue(task, '2026-10-24', new Date('2026-10-24T08:00:00Z')), false);
  assert.equal(analytics.isOverdue(task, '2026-10-24', new Date('2026-10-24T10:00:00Z')), true);
  const completed = timestamp => ({ ...task, status: 'completed', statusHistory: [{ newStatus: 'completed', timestamp }] });
  assert.equal(analytics.deliveredOnTime(completed('2026-10-24T08:00:00Z')), true);
  assert.equal(analytics.deliveredOnTime(completed('2026-10-24T10:00:00Z')), false);
  assert.equal(analytics.deliveredOnTime({ status: 'completed', deadlineCanonical: '2026-10-24', updatedAt: new Date(2026, 9, 24, 23).toISOString() }), true);
});

test('an existing project lead is retained by ID across old labels and language changes', () => {
  const members = [{ id: 'member-row', userId: 'lead-user', name: 'Fixture Owner', role: 'OWNER' }];
  const project = { teamLeadId: 'lead-user', teamLead: 'Fixture Owner (OWNER)' };
  const fa = values.projectLeadSelection(project, members, name => name + ' — مالک');
  const en = values.projectLeadSelection(project, members, name => name + ' — Owner');
  assert.equal(fa.id, 'lead-user');
  assert.equal(en.id, 'lead-user');
  assert.notEqual(fa.label, en.label);
  assert.equal(values.projectLeadSelection(project, [], name => name).id, 'lead-user');
});

test('legacy label-only leads resolve only when a single real member matches', () => {
  const members = [{ id: 'lead-user', name: 'Fixture Lead', role: 'DEVELOPER' }];
  assert.equal(values.projectLeadSelection({ teamLead: 'Fixture Lead (DEVELOPER)' }, members, name => name + ' — Developer').id, 'lead-user');
  assert.equal(values.projectLeadSelection({ teamLead: 'External consultant' }, members, name => name).id, '');
  assert.equal(values.projectLeadSelection({ teamLead: 'Fixture Lead' }, [...members, { id: 'another-user', name: 'Fixture Lead', role: 'DEVELOPER' }], name => name).id, '');
});

test('the weekly timesheet includes negative durable corrections and filters other weeks', () => {
  const now = new Date(2026, 9, 24, 12);
  const stamp = new Date(2026, 9, 24, 9).toISOString();
  const result = analytics.weeklyTimeTotals([{ timeEntries: [
    { hours: 8, createdAt: stamp },
    { hours: -4, kind: 'adjustment', createdAt: stamp },
    { hours: 100, createdAt: new Date(2026, 9, 23, 12).toISOString() },
    { hours: 100, createdAt: new Date(2026, 9, 31, 12).toISOString() },
    { hours: 100, createdAt: 'not-a-date' },
    { hours: 'not-a-number', createdAt: stamp },
  ] }], now);
  assert.equal(result.total, 4);
  assert.deepEqual(result.days, [4, 0, 0, 0, 0, 0, 0]);
  assert.equal(result.average, 4);
});

test('a negative net day remains represented and an empty week remains zero', () => {
  const now = new Date(2026, 9, 24, 12);
  const result = analytics.weeklyTimeTotals([{ timeEntries: [{ hours: -1.5, createdAt: now.toISOString() }] }], now);
  assert.equal(result.total, -1.5);
  assert.equal(result.max, 1.5);
  assert.deepEqual(analytics.weeklyTimeTotals([], now).days, [0, 0, 0, 0, 0, 0, 0]);
});

test('an unchanged generated SVG is omitted but explicit avatar edits are retained', () => {
  const avatar = 'data:image/svg+xml;charset=utf-8,%3Csvg%3Efixture%3C/svg%3E';
  const payload = JSON.parse(JSON.stringify({ name: 'Changed name', avatar: values.changedAvatar(avatar, avatar) }));
  assert.equal(Object.hasOwn(payload, 'avatar'), false);
  assert.equal(values.changedAvatar(avatar, ''), '');
  assert.equal(values.changedAvatar(avatar, '/avatars/avatar-2.svg'), '/avatars/avatar-2.svg');
  assert.equal(values.changedAvatar(avatar, 'data:image/webp;base64,ZmFrZQ=='), 'data:image/webp;base64,ZmFrZQ==');
});

class Storage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
const apiStubUrl = url('export const apiFetch = (...args) => globalThis.__inviteFetch(...args);');
const invite = await import(url(compile(read('pendingInvite.ts')).replace("'./api'", JSON.stringify(apiStubUrl))));
let reloads;
const setupInvite = () => {
  globalThis.localStorage = new Storage();
  globalThis.sessionStorage = new Storage();
  reloads = 0;
  globalThis.window = { location: { pathname: '/join/fixture-invite-code', origin: 'http://localhost:3000', reload() { reloads++; } }, history: { replaceState() { window.location.pathname = '/'; } } };
  return invite.captureInviteFromUrl();
};
test.after(() => { delete globalThis.__inviteFetch; delete globalThis.window; delete globalThis.localStorage; delete globalThis.sessionStorage; });

test('a network failure retains the invite after the URL is cleaned and succeeds on retry', async () => {
  const code = setupInvite();
  globalThis.__inviteFetch = async () => { throw new Error('offline fixture'); };
  await assert.rejects(invite.acceptPendingInvite(code), /offline fixture/);
  assert.equal(window.location.pathname, '/');
  assert.equal(invite.pendingInvite(), code);
  globalThis.__inviteFetch = async (path, options) => {
    assert.equal(path, '/api/workspaces/join');
    assert.deepEqual(JSON.parse(options.body), { inviteCode: code });
    return Response.json({ workspace: { id: 'joined-workspace' } });
  };
  await invite.acceptPendingInvite(invite.pendingInvite());
  assert.equal(invite.pendingInvite(), null);
  assert.equal(localStorage.getItem('activeWorkspaceId'), 'joined-workspace');
  assert.equal(reloads, 1);
});

test('a malformed successful response does not consume an invite', async () => {
  const code = setupInvite();
  globalThis.__inviteFetch = async () => Response.json({ success: true });
  await assert.rejects(invite.acceptPendingInvite(code));
  assert.equal(invite.pendingInvite(), code);
  assert.equal(reloads, 0);
});

test('finishing an old join does not erase a newer pending invite', async () => {
  const code = setupInvite();
  let resolve;
  globalThis.__inviteFetch = () => new Promise(complete => { resolve = complete; });
  const oldJoin = invite.acceptPendingInvite(code);
  sessionStorage.setItem('orbit_pending_invite', 'newer-fixture-invite');
  resolve(Response.json({ workspace: { id: 'old-joined-workspace' } }));
  await oldJoin;
  assert.equal(invite.pendingInvite(), 'newer-fixture-invite');
});
