import path from 'node:path';
import { build as buildClient } from 'vite';
import { build as buildServer } from 'esbuild';
import { projectRoot, assertBuildPath, distRoot } from './paths.mjs';
import './clean.mjs';

process.chdir(projectRoot);
await buildClient();
await buildServer({
  entryPoints: {
    server: path.join(projectRoot, 'server.ts'),
    'local-account': path.join(projectRoot, 'scripts', 'local-account.ts'),
    database: path.join(projectRoot, 'scripts', 'database.ts')
  },
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  packages: 'external',
  sourcemap: true,
  outdir: assertBuildPath(path.join(distRoot, 'server')),
  outExtension: { '.js': '.cjs' },
  logLevel: 'info'
});
