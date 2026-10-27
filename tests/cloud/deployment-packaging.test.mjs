import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('deployment exclusions cannot remove nested application source directories', () => {
  const lines = fs.readFileSync(new URL('../../.vercelignore', import.meta.url), 'utf8').split(/\r?\n/).filter(line => line && !line.startsWith('#'));
  for (const name of ['node_modules','npm-cache','data','backups','tests','dist','Reports','.git']) {
    assert.ok(lines.some(line => line === '/' + name || line === '/' + name + '/'), `${name} must be a root-only exclusion`);
    assert.ok(!lines.includes(name) && !lines.includes(name + '/'), `${name} must not match nested source directories`);
  }
  for (const file of ['src/data/mockData.ts','src/components/reports/ReportingView.tsx','src/components/reports/ReportDetailModal.tsx']) {
    assert.ok(fs.existsSync(new URL('../../' + file, import.meta.url)), `${file} must remain available to the build`);
  }
});

test('the Vercel function loads one prebuilt server bundle and includes it with the client', () => {
  const config = JSON.parse(fs.readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  const includeFiles = config.functions?.['server.js']?.includeFiles;

  assert.equal(includeFiles, '{build/vercel/**,public/**}');
  const buildScript = fs.readFileSync(new URL('../../scripts/build-vercel.mjs', import.meta.url), 'utf8');
  assert.match(buildScript, /entryPoints:\[path\.join\(projectRoot,'application\.ts'\)\]/);
  assert.match(buildScript, /outfile:path\.join\(projectRoot,'build','vercel','application\.mjs'\)/);
  assert.match(buildScript, /packages:'external'/);

  const entry = fs.readFileSync(new URL('../../server.js', import.meta.url), 'utf8');
  assert.match(entry, /import\('\.\/build\/vercel\/application\.mjs'\)/);
  assert.doesNotMatch(entry, /tsx/, 'cold starts must not transpile TypeScript at runtime');
});

test('the Vercel client is a clean atomic release without lazy runtime chunks', () => {
  const buildScript = fs.readFileSync(new URL('../../scripts/build-vercel.mjs', import.meta.url), 'utf8');
  const viteConfig = fs.readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8');

  assert.match(buildScript, /mode:\s*['"]vercel['"]/);
  assert.match(buildScript, /public['"],['"]assets/);
  assert.match(buildScript, /emptyOutDir:\s*false/);
  assert.match(viteConfig, /mode\s*===\s*['"]vercel['"]/);
  assert.match(viteConfig, /inlineDynamicImports:\s*true/);
});
