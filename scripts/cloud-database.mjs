import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { projectRoot, distRoot } from './paths.mjs';
process.chdir(projectRoot);
const require = createRequire(import.meta.url);
const compiled = path.join(distRoot, 'server', 'cloud-database.cjs');
let args;
if (fs.existsSync(compiled)) args = [compiled, ...process.argv.slice(2)];
else {
  try { require.resolve('tsx'); }
  catch { console.error('Run npm ci and npm run build before cloud database maintenance.'); process.exit(1); }
  args = ['--import', 'tsx', path.join(projectRoot, 'scripts', 'cloud-database.ts'), ...process.argv.slice(2)];
}
const result = spawnSync(process.execPath, args, { cwd: projectRoot, stdio: 'inherit', windowsHide: true });
if (result.error) { console.error('Cloud maintenance could not start.'); process.exit(1); }
process.exit(result.status ?? 1);
