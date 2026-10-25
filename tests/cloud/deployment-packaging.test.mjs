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

test('the Vercel function explicitly includes its TypeScript runtime modules', () => {
  const config = JSON.parse(fs.readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  const includeFiles = config.functions?.['server.ts']?.includeFiles;

  assert.equal(includeFiles, '{server/**,src/data/**,src/lib/**}');
  for (const file of [
    'server/domain/projects-tasks.ts',
    'server/local-config.ts',
    'src/data/dbService.ts',
    'src/lib/localAssets.ts',
  ]) {
    assert.ok(fs.existsSync(new URL('../../' + file, import.meta.url)), `${file} must be present in the function bundle inputs`);
  }
});
