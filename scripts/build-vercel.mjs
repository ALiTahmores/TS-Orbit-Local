import {build} from 'vite';
import {build as buildServer} from 'esbuild';
import {rm} from 'node:fs/promises';
import path from 'node:path';
import {projectRoot} from './paths.mjs';

// Build assets directly into the platform CDN directory and the server into one
// module for server.js. Building never opens a database or needs secrets.
process.chdir(projectRoot);
// Vercel packages the generated client files into the serverless function. Build
// them as one atomic release: remove only prior generated output so tracked fonts
// and avatars remain available, then produce a fresh HTML shell and asset set.
await Promise.all([
  rm(path.join(projectRoot,'public','assets'),{recursive:true,force:true}),
  rm(path.join(projectRoot,'public','index.html'),{force:true}),
  rm(path.join(projectRoot,'build','vercel'),{recursive:true,force:true}),
]);
await build({mode:'vercel',publicDir:false,build:{outDir:'public',emptyOutDir:false}});
// Packages stay external so Vercel traces them from node_modules; only the
// application's own TypeScript is compiled here, once, instead of on cold start.
await buildServer({
  entryPoints:[path.join(projectRoot,'application.ts')],
  outfile:path.join(projectRoot,'build','vercel','application.mjs'),
  bundle:true,
  platform:'node',
  target:'node24',
  format:'esm',
  packages:'external',
  sourcemap:'linked',
  banner:{js:"import {createRequire as __orbitCreateRequire} from 'node:module'; const require = __orbitCreateRequire(import.meta.url);"},
  logLevel:'info',
});
