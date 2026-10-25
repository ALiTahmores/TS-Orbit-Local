import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '../..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let Storage;
const compilation = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-cloud-blob-test-'));
await build({ entryPoints: [path.join(root, 'server/cloud/blob-storage.ts')], outfile: path.join(compilation, 'storage.cjs'),
  bundle: true, platform: 'node', target: 'node24', format: 'cjs', external: ['@vercel/blob'], logLevel: 'silent' });
Storage = createRequire(import.meta.url)(path.join(compilation, 'storage.cjs')).VercelBlobStorage;
process.once('exit', () => fs.rmSync(compilation, { recursive: true, force: true }));

function harness() {
  const objects = new Map(), calls = [], tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-private-blob-'));
  const sdk = {
    async put(name, body, options) {
      calls.push({ operation: 'put', name, options });
      if (objects.has(name)) throw Object.assign(new Error('Immutable collision'), { status: 409 });
      const parts = []; for await (const part of body) parts.push(Buffer.from(part));
      objects.set(name, { bytes: Buffer.concat(parts), contentType: options.contentType });
      return { pathname: name };
    },
    async get(name, options) {
      calls.push({ operation: 'get', name, options });
      const object = objects.get(name); if (!object) return null;
      return { statusCode: 200, blob: { pathname: name, contentType: object.contentType, size: object.bytes.length },
        stream: new ReadableStream({ start(controller) { controller.enqueue(object.bytes.subarray(0, 1000)); controller.enqueue(object.bytes.subarray(1000)); controller.close(); } }) };
    },
    async del(name, options) { calls.push({ operation: 'del', name, options }); objects.delete(name); },
  };
  const storage = new Storage({ sdk, tempRoot, token: 'fixture-not-a-provider-token', now: () => 1000 });
  return { storage, objects, calls, tempRoot, sdk, close() { fs.rmSync(tempRoot, { recursive: true, force: true }); } };
}
const intent = (overrides = {}) => ({ id: randomUUID(), key: randomUUID(), name: 'record.txt', mimeType: 'text/plain', byteSize: 11, expiresAt: 120000, ...overrides });
const metadata = (key, bytes, overrides = {}) => ({ managed: true, storageFormat: 'orbit-assets-v1', storageBackend: 'vercel-blob', storageKey: key,
  byteSize: bytes.length, sha256: hash(bytes), mimeType: 'text/plain', name: 'record.txt', ...overrides });
const code = expected => error => error?.code === expected;

test('private uploads publish verified immutable UUID paths and never expose provider URLs or tokens', async () => {
  const h = harness(); try {
    const key = randomUUID(), bytes = Buffer.from('hello world');
    const result = await h.storage.putVerified(key, bytes, { name: 'record.txt', mimeType: 'text/plain', byteSize: 11 });
    assert.equal(result.sha256, hash(bytes)); assert.equal(result.storageBackend, 'vercel-blob');
    assert.equal(h.calls[0].name, 'orbit-assets/v1/' + key);
    assert.equal(h.calls[0].options.access, 'private'); assert.equal(h.calls[0].options.allowOverwrite, false); assert.equal(h.calls[0].options.addRandomSuffix, false);
    assert.ok(!JSON.stringify(result).includes('fixture-not-a-provider-token')); assert.ok(!('url' in result));
    assert.deepEqual(fs.readdirSync(h.tempRoot), []);
  } finally { h.close(); }
});

test('an existing cloud key cannot be overwritten and original content survives collision', async () => {
  const h = harness(); try {
    const key = randomUUID(); await h.storage.putVerified(key, Buffer.from('first'), { name: 'record.txt', mimeType: 'text/plain' });
    await assert.rejects(h.storage.putVerified(key, Buffer.from('second'), { name: 'record.txt', mimeType: 'text/plain' }));
    assert.equal(h.objects.get(h.storage.pathname(key)).bytes.toString(), 'first'); assert.deepEqual(fs.readdirSync(h.tempRoot), []);
  } finally { h.close(); }
});

test('downloads return a verified ephemeral file and cleanup is idempotent', async () => {
  const h = harness(); try {
    const key = randomUUID(), bytes = Buffer.from('streamed real content'); h.objects.set(h.storage.pathname(key), { bytes, contentType: 'text/plain' });
    const read = await h.storage.readVerified(metadata(key, bytes));
    assert.equal(fs.readFileSync(read.filePath).toString(), bytes.toString()); assert.equal(read.sha256, hash(bytes));
    assert.equal(h.calls[0].options.access, 'private'); assert.equal(h.calls[0].options.useCache, false);
    await read.dispose(); await read.dispose(); assert.equal(fs.existsSync(read.filePath), false); assert.deepEqual(fs.readdirSync(h.tempRoot), []);
  } finally { h.close(); }
});

test('same-size corrupt bytes never become a readable download and temporary bytes are removed', async () => {
  const h = harness(); try {
    const key = randomUUID(), original = Buffer.from('correct'); h.objects.set(h.storage.pathname(key), { bytes: Buffer.from('corrupt'), contentType: 'text/plain' });
    await assert.rejects(h.storage.readVerified(metadata(key, original)), code('FILE_CONTENT_CORRUPT'));
    assert.deepEqual(fs.readdirSync(h.tempRoot), []);
  } finally { h.close(); }
});

test('missing cloud objects give truthful unavailable responses without a local fallback', async () => {
  const h = harness(); try {
    await assert.rejects(h.storage.readVerified(metadata(randomUUID(), Buffer.from('file'))), code('FILE_CONTENT_UNAVAILABLE'));
    assert.deepEqual(fs.readdirSync(h.tempRoot), []);
  } finally { h.close(); }
});

test('client-controlled URLs, traversals and legacy local metadata cannot be fetched', async () => {
  const h = harness(); try {
    for (const value of ['../secret', 'https://evil.example/file', randomUUID() + '/other']) await assert.rejects(h.storage.remove(value), code('INVALID_STORAGE_KEY'));
    await assert.rejects(h.storage.readVerified(metadata(randomUUID(), Buffer.from('f'), { storageBackend: undefined })), code('FILE_CONTENT_UNAVAILABLE'));
    assert.equal(h.calls.length, 0);
  } finally { h.close(); }
});

test('executables, misleading signatures, binary text and invalid UTF-8 never reach the provider', async () => {
  const h = harness(); try {
    for (const [name, mimeType, bytes] of [['record.pdf', 'application/pdf', Buffer.from('not pdf')], ['record.txt', 'text/plain', Buffer.from('<script>bad</script>')],
      ['record.txt', 'text/plain', Buffer.from([0xff, 0xfe])], ['record.txt', 'text/plain', Buffer.from('a\0b')]]) {
      await assert.rejects(h.storage.putVerified(randomUUID(), bytes, { name, mimeType }));
    }
    assert.equal(h.calls.length, 0); assert.deepEqual(fs.readdirSync(h.tempRoot), []);
  } finally { h.close(); }
});

test('an overlong remote stream is bounded and cancelled before any response file is returned', async () => {
  const h = harness(); try {
    let cancelled = false; const key = randomUUID();
    h.sdk.get = async pathname => ({ statusCode: 200, blob: { pathname }, stream: (async function* () { try { yield Buffer.alloc(100); yield Buffer.alloc(100); } finally { cancelled = true; } })() });
    await assert.rejects(h.storage.readVerified(metadata(key, Buffer.alloc(50))), code('FILE_TOO_LARGE'));
    assert.equal(cancelled, true); assert.deepEqual(fs.readdirSync(h.tempRoot), []);
  } finally { h.close(); }
});

test('direct-upload tokens are bound to the persisted intent path, ID, size and expiry without overwrite', () => {
  const h = harness(); try {
    const record = intent(); const result = h.storage.directTokenOptions(record, h.storage.pathname(record.key), JSON.stringify({ uploadId: record.id }));
    assert.deepEqual(result.allowedContentTypes, ['text/plain']); assert.equal(result.maximumSizeInBytes, 11); assert.equal(result.validUntil, record.expiresAt);
    assert.equal(result.allowOverwrite, false); assert.equal(result.addRandomSuffix, false);
    assert.deepEqual(JSON.parse(result.tokenPayload), { uploadId: record.id, storageKey: record.key });
    assert.ok(!JSON.stringify(result).includes('fixture-not-a-provider-token'));
  } finally { h.close(); }
});

test('direct-upload token authorization rejects path/intent substitutions, extra claims and expired tickets', () => {
  const h = harness(); try {
    const record = intent();
    for (const [pathname, payload] of [[h.storage.pathname(randomUUID()), { uploadId: record.id }], [h.storage.pathname(record.key), { uploadId: randomUUID() }],
      [h.storage.pathname(record.key), { uploadId: record.id, actorId: 'other-user' }]]) assert.throws(() => h.storage.directTokenOptions(record, pathname, JSON.stringify(payload)), code('UPLOAD_INTENT_MISMATCH'));
    assert.throws(() => h.storage.directTokenOptions({ ...record, expiresAt: 999 }, h.storage.pathname(record.key), JSON.stringify({ uploadId: record.id })), code('UPLOAD_INTENT_EXPIRED'));
    assert.equal(h.calls.length, 0);
  } finally { h.close(); }
});

test('direct-upload finalization computes its own byte count and digest from private content', async () => {
  const h = harness(); try {
    const record = intent(); const bytes = Buffer.from('hello world'); h.objects.set(h.storage.pathname(record.key), { bytes, contentType: 'text/plain' });
    const result = await h.storage.verifyUploaded(record); assert.equal(result.sha256, hash(bytes)); assert.equal(result.byteSize, 11);
    assert.deepEqual(fs.readdirSync(h.tempRoot), []);
  } finally { h.close(); }
});

test('direct uploads can verify files beyond the Vercel Function request-body limit', async () => {
  const h = harness(); try {
    const bytes = Buffer.alloc(6 * 1024 * 1024, 97), record = intent({ byteSize: bytes.length });
    h.objects.set(h.storage.pathname(record.key), { bytes, contentType: 'text/plain' });
    const result = await h.storage.verifyUploaded(record); assert.equal(result.byteSize, bytes.length); assert.equal(result.sha256, hash(bytes));
    assert.deepEqual(fs.readdirSync(h.tempRoot), []);
  } finally { h.close(); }
});

test('provider and interrupted stream failures remove temporary staging bytes', async () => {
  const h = harness(); try {
    h.sdk.put = async () => { throw new Error('provider offline'); };
    await assert.rejects(h.storage.putVerified(randomUUID(), Buffer.from('hello'), { name: 'record.txt', mimeType: 'text/plain' }));
    const key = randomUUID(); h.sdk.get = async pathname => ({ statusCode: 200, blob: { pathname }, stream: (async function* () { yield Buffer.from('short'); throw new Error('connection closed'); })() });
    await assert.rejects(h.storage.readVerified(metadata(key, Buffer.from('short'))));
    assert.deepEqual(fs.readdirSync(h.tempRoot), []);
  } finally { h.close(); }
});

test('remote streams are cancelled when provider metadata fails before staging', async () => {
  const h = harness(); try {
    let cancelled = false;
    h.sdk.get = async pathname => ({ statusCode: 200, blob: { pathname, size: 999 }, stream: new ReadableStream({ cancel() { cancelled = true; } }) });
    await assert.rejects(h.storage.readVerified(metadata(randomUUID(), Buffer.from('short'))), code('FILE_CONTENT_CORRUPT'));
    assert.equal(cancelled, true); assert.deepEqual(fs.readdirSync(h.tempRoot), []);
  } finally { h.close(); }
});

test('deletion uses only internal object paths and tolerates already absent content', async () => {
  const h = harness(); try {
    const key = randomUUID(); await h.storage.remove(key); assert.equal(h.calls[0].name, h.storage.pathname(key));
    h.sdk.del = async () => { throw Object.assign(new Error('missing'), { statusCode: 404 }); }; await h.storage.remove(key);
  } finally { h.close(); }
});

test('chunked private SDK reads may report zero metadata size while verified stream length remains authoritative',async()=>{const h=harness();try{const bytes=Buffer.from('private chunked bytes'),key=randomUUID(),original=h.sdk.get;h.objects.set(h.storage.pathname(key),{bytes,contentType:'text/plain'});h.sdk.get=async(...args)=>{const result=await original(...args);result.blob.size=0;return result;};const read=await h.storage.readVerified(metadata(key,bytes));try{assert.deepEqual(fs.readFileSync(read.filePath),bytes);}finally{await read.dispose();}h.objects.set(h.storage.pathname(key),{bytes:Buffer.from('short'),contentType:'text/plain'});await assert.rejects(h.storage.readVerified(metadata(key,bytes)));}finally{h.close();}});
