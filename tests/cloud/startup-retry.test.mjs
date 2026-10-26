import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

async function loadModule() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'orbit-startup-'));
  const outfile = path.join(directory, 'startup.mjs');
  await build({entryPoints:[fileURLToPath(new URL('../../server/cloud/startup.ts', import.meta.url))], outfile, bundle:true, platform:'node', format:'esm'});
  return {module: await import(pathToFileURL(outfile).href), directory};
}

test('cloud startup retries a bounded failed cold start and then succeeds', async () => {
  const {module, directory} = await loadModule();
  try {
    let calls = 0;
    const warnings = [];
    const result = await module.retryCloudStartup('database', async () => {
      calls += 1;
      if (calls < 3) throw Object.assign(new Error('contains sensitive provider detail'), {code:'ECONNRESET'});
      return 'ready';
    }, {attempts:4, sleep:async () => undefined, warn:message => warnings.push(message)});
    assert.equal(result, 'ready');
    assert.equal(calls, 3);
    assert.equal(warnings.length, 2);
    assert.ok(warnings.every(message => message.includes('ECONNRESET')));
    assert.ok(warnings.every(message => !message.includes('sensitive provider detail')));
  } finally { await rm(directory, {recursive:true, force:true}); }
});

test('cloud startup stops at its configured bound and preserves the final error', async () => {
  const {module, directory} = await loadModule();
  try {
    let calls = 0;
    const expected = new TypeError('provider detail');
    await assert.rejects(module.retryCloudStartup('identity', async () => {
      calls += 1;
      throw expected;
    }, {attempts:3, sleep:async () => undefined, warn:() => undefined}), error => error === expected);
    assert.equal(calls, 3);
    assert.equal(module.cloudFailureLabel(expected), 'TypeError');
  } finally { await rm(directory, {recursive:true, force:true}); }
});

