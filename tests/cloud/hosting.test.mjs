import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import express from 'express';

const root = fileURLToPath(new URL('../..', import.meta.url));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-hosting-test-'));
const output = path.join(temp, 'hosting.cjs');
await build({ entryPoints: [path.join(root, 'server/http/hosting.ts')], outfile: output, bundle: true, platform: 'node', format: 'cjs', target: 'node24', logLevel: 'silent' });
const { clientApp } = createRequire(import.meta.url)(output);
fs.mkdirSync(path.join(temp, 'assets')); fs.writeFileSync(path.join(temp, 'index.html'), 'synthetic shell');
for (const [suffix, value] of [['', 'identity-body'], ['.br', 'brotli-body'], ['.gz', 'gzip-body']]) fs.writeFileSync(path.join(temp, 'assets', 'bundle.js' + suffix), value);
const app = express(); app.use(...clientApp(temp)); const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
test.after(async () => { await new Promise(resolve => server.close(resolve)); fs.rmSync(temp, { recursive: true, force: true }); });
function request(encoding, pathname = '/assets/bundle.js', extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port: server.address().port, path: pathname, headers: { ...(encoding === undefined ? {} : { 'Accept-Encoding': encoding }), ...extraHeaders } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    }); req.on('error', reject);
  });
}
test('explicit q=0 Brotli refusal selects acceptable gzip instead', async () => {
  const response = await request('br;q=0, gzip;q=1'); assert.equal(response.status, 200); assert.equal(response.headers['content-encoding'], 'gzip'); assert.equal(response.body, 'gzip-body'); assert.match(response.headers.vary, /Accept-Encoding/i);
});
test('quality preference selects Brotli and immutable cache policy', async () => {
  const response = await request('gzip;q=0.5, br;q=1'); assert.equal(response.headers['content-encoding'], 'br'); assert.equal(response.body, 'brotli-body'); assert.match(response.headers['cache-control'], /immutable/);
});
test('identity fallback retains Vary when every compression is refused', async () => {
  const response = await request('br;q=0,gzip;q=0,identity;q=1'); assert.equal(response.status, 200); assert.equal(response.headers['content-encoding'], undefined); assert.equal(response.body, 'identity-body'); assert.match(response.headers.vary, /Accept-Encoding/i);
});
test('refusal of all available representations produces 406 without asset bytes', async () => {
  const response = await request('br;q=0,gzip;q=0,identity;q=0'); assert.equal(response.status, 406); assert.equal(response.body, '');
});
test('missing asset returns 404 rather than SPA HTML, while navigation returns fresh shell', async () => {
  const missing = await request(undefined, '/assets/missing.js'); assert.equal(missing.status, 404); assert.equal(missing.body, 'Not found');
  const shell = await request(undefined, '/projects/synthetic'); assert.equal(shell.status, 200); assert.equal(shell.body, 'synthetic shell'); assert.equal(shell.headers['cache-control'], 'no-cache');
});
test('a new release of the same size and file time is not answered 304 for the old shell', async () => {
  const shellPath = path.join(temp, 'index.html'), stamp = new Date('2018-11-30T00:00:00Z');
  fs.utimesSync(shellPath, stamp, stamp);
  const first = await request(undefined, '/');
  assert.equal((await request(undefined, '/', { 'If-None-Match': first.headers.etag })).status, 304);
  fs.writeFileSync(shellPath, 'synthetic shelL'); fs.utimesSync(shellPath, stamp, stamp);
  const next = await request(undefined, '/', { 'If-None-Match': first.headers.etag });
  assert.equal(next.status, 200); assert.equal(next.body, 'synthetic shelL'); assert.notEqual(next.headers.etag, first.headers.etag);
  fs.writeFileSync(shellPath, 'synthetic shell');
});
