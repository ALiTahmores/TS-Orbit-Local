import { spawnSync } from 'node:child_process';
import { projectRoot } from './paths.mjs';
const result = spawnSync(process.execPath, ['--import', 'tsx', 'server.ts'], {
  cwd: projectRoot, env: { ...process.env, NODE_ENV: 'development' }, stdio: 'inherit', windowsHide: true,
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
