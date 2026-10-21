import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Exercise the actual client against controlled HTTP outcomes and delayed responses.
const source = fs.readFileSync(new URL('../../src/lib/api.ts', import.meta.url), 'utf8');
const moduleText = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
class MemoryStorage {
  getItem(key) { return Object.hasOwn(this, key) ? this[key] : null; }
  setItem(key, value) { this[key] = String(value); }
  removeItem(key) { delete this[key]; }
}
const storage = new MemoryStorage();
globalThis.localStorage = storage;
globalThis.window = new EventTarget();
window.location = { origin: 'http://127.0.0.1:3000' };
storage.setItem('agency_projects', JSON.stringify([{ title: 'Other account secret' }]));
storage.setItem('wp_manager_theme', 'dark');
const api = await import(`data:text/javascript;base64,${Buffer.from(moduleText).toString('base64')}`);
const realFetch = globalThis.fetch;
test.after(() => { globalThis.fetch = realFetch; delete globalThis.window; delete globalThis.localStorage; });
const authorize = (user = 'user-a', workspace = 'workspace-a') => {
  storage.setItem('token', `session-${user}`);
  api.setApiIdentity(user, workspace);
};

test('legacy business records never become a new session; appearance preference survives', () => {
  assert.equal(storage.getItem('agency_projects'), null);
  assert.equal(storage.getItem('wp_manager_theme'), 'dark');
  assert.deepEqual(api.getLocalData('agency_projects', []), []);
});
test('all protected requests use current credentials and workspace, overriding stale caller headers', async () => {
  authorize();
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.get('authorization'), 'Bearer session-user-a');
    assert.equal(options.headers.get('x-workspace-id'), 'workspace-a');
    return Response.json({ saved: true });
  };
  const response = await api.apiFetch('/api/projects', { method: 'POST', headers: { Authorization: 'Bearer other-user', 'x-workspace-id': 'other-space' }, body: '{}' });
  assert.deepEqual(await response.json(), { saved: true });
});
test('forbidden writes never return local fallback or success, and retain a valid session', async () => {
  authorize();
  storage.setItem('agency_projects', '[{"id":"forged"}]');
  globalThis.fetch = async () => Response.json({ code: 'FORBIDDEN' }, { status: 403 });
  await assert.rejects(api.safeApiRequest('/api/projects', { method: 'POST' }, 'agency_projects', { saved: true }), error => error instanceof api.ApiError && error.status === 403);
  assert.equal(storage.getItem('token'), 'session-user-a');
});
test('network failure never returns a local write or cached read', async () => {
  authorize();
  globalThis.fetch = async () => { throw new TypeError('Connection refused'); };
  await assert.rejects(api.safeApiRequest('/api/tasks', { method: 'POST' }, 'tasks', { id: 'fake' }), error => error.code === 'NETWORK_ERROR' && error.message.includes('وضعیت ذخیره‌سازی مشخص نیست') && !error.message.includes('هیچ تغییری ذخیره نشده'));
  await assert.rejects(api.safeApiRequest('/api/projects', {}, 'agency_projects', [{ id: 'fake' }]), error => error.code === 'NETWORK_ERROR');
});
test('server string workspace denial reaches the state-clearing handler without ending the account session', async () => {
  authorize();
  let dispatched;
  const listener = event => { dispatched = event.detail; };
  window.addEventListener('orbit:api-error', listener);
  globalThis.fetch = async () => Response.json({ error: 'WORKSPACE_FORBIDDEN', message: 'Workspace membership revoked.' }, { status: 403 });
  await assert.rejects(api.apiFetch('/api/projects'), error => error.status === 403 && error.code === 'WORKSPACE_FORBIDDEN');
  window.removeEventListener('orbit:api-error', listener);
  assert.equal(dispatched.code, 'WORKSPACE_FORBIDDEN');
  assert.equal(storage.getItem('token'), 'session-user-a');
});
test('401 clears rejected credentials and business caches while preserving appearance', async () => {
  authorize();
  let ended = false;
  window.addEventListener('orbit:session-ended', () => { ended = true; }, { once: true });
  globalThis.fetch = async () => Response.json({ code: 'SESSION_REVOKED' }, { status: 401 });
  await assert.rejects(api.apiFetch('/api/auth/me'), error => error.status === 401);
  assert.equal(storage.getItem('token'), null);
  assert.equal(storage.getItem('agency_projects'), null);
  assert.equal(storage.getItem('wp_manager_theme'), 'dark');
  assert.equal(ended, true);
});
test('workspace switch discards an in-flight response from the old workspace', async () => {
  authorize();
  let finish;
  globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
  const request = api.apiFetch('/api/projects');
  api.setApiIdentity('user-a', 'workspace-b');
  finish(Response.json([{ title: 'Old workspace confidential' }]));
  await assert.rejects(request, error => error.code === 'STALE_REQUEST');
});
test('an already received response cannot populate state after an account switch', async () => {
  authorize();
  globalThis.fetch = async () => Response.json([{ title: 'Previous account data' }]);
  const response = await api.apiFetch('/api/projects');
  authorize('user-b', 'workspace-b');
  await assert.rejects(response.json(), error => error.code === 'STALE_REQUEST');
});
test('public token portal carries no private credentials and works across rejected session cleanup', async () => {
  authorize();
  let finish;
  globalThis.fetch = (_url, options) => {
    assert.equal(options.headers.get('authorization'), null);
    assert.equal(options.headers.get('x-workspace-id'), null);
    return new Promise(resolve => { finish = resolve; });
  };
  const request = api.apiFetch('/api/public/portal/exact-token');
  api.clearCredential();
  finish(Response.json({ project: { title: 'Explicitly shared' } }));
  assert.equal((await (await request).json()).project.title, 'Explicitly shared');
});
test('invalid successful JSON cannot activate a legacy local write fallback', async () => {
  authorize();
  globalThis.fetch = async () => new Response('broken JSON', { status: 200 });
  const response = await api.apiFetch('/api/tasks', { method: 'POST', body: '{}' });
  await assert.rejects(response.json(), error => error.code === 'INVALID_RESPONSE');
});
test('an external URL can never receive this application credential', async () => {
  authorize();
  let sent = false;
  globalThis.fetch = async () => { sent = true; return Response.json({}); };
  await assert.rejects(api.apiFetch('https://example.invalid/api/projects'), error => error.code === 'INVALID_API_URL');
  assert.equal(sent, false);
});
test('a delayed 401 body from an old session cannot clear a newly signed-in account', async () => {
  authorize();
  let finish;
  globalThis.fetch=async()=>({ok:false,status:401,clone:()=>({json:()=>new Promise(resolve=>{finish=resolve;})})});
  const request=api.apiFetch('/api/projects');
  await new Promise(resolve=>setImmediate(resolve));
  authorize('user-c','workspace-c');
  finish({code:'SESSION_REVOKED'});
  await assert.rejects(request,error=>error.code==='STALE_REQUEST');
  assert.equal(storage.getItem('token'),'session-user-c');
});
test('diagnostic payloads redact nested passwords and credentials',()=>{
  assert.deepEqual(api.redactClientLog({name:'Visible',items:[{password:'Hidden',nested:{token:'Hidden',count:1}}]}),{name:'Visible',items:[{password:'[REDACTED]',nested:{token:'[REDACTED]',count:1}}]});
});
