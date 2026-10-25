import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { build as buildClient } from 'vite';
import { build as buildServer } from 'esbuild';
import { projectRoot, assertBuildPath, distRoot } from './paths.mjs';
import './clean.mjs';

process.chdir(projectRoot);
await buildClient();
// Compress hashed assets once at build time (maximum brotli/gzip levels); the server
// sends these siblings to browsers that accept them instead of compressing per request.
const assetsDir = assertBuildPath(path.join(distRoot, 'client', 'assets'));
for (const name of fs.readdirSync(assetsDir)) {
  if (!/\.(?:js|css|svg)$/.test(name)) continue;
  const file = path.join(assetsDir, name), source = fs.readFileSync(file);
  if (source.length < 1024) continue;
  fs.writeFileSync(file + '.br', zlib.brotliCompressSync(source, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: source.length } }));
  fs.writeFileSync(file + '.gz', zlib.gzipSync(source, { level: 9 }));
}
await buildServer({
  entryPoints: {
    server: path.join(projectRoot, 'application.ts'),
    'local-account': path.join(projectRoot, 'scripts', 'local-account.ts'),
    database: path.join(projectRoot, 'scripts', 'database.ts')
    ,'cloud-database': path.join(projectRoot, 'scripts', 'cloud-database.ts')
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
