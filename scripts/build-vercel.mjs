import {build} from 'vite';
import {rm} from 'node:fs/promises';
import path from 'node:path';
import {projectRoot} from './paths.mjs';

// Build assets directly into the platform CDN directory. The server entry is
// compiled by Vercel; building the client never opens a database or needs secrets.
process.chdir(projectRoot);
// Vercel packages the generated client files into the serverless function. Build
// them as one atomic release: remove only prior generated output so tracked fonts
// and avatars remain available, then produce a fresh HTML shell and asset set.
await Promise.all([
  rm(path.join(projectRoot,'public','assets'),{recursive:true,force:true}),
  rm(path.join(projectRoot,'public','index.html'),{force:true}),
]);
await build({mode:'vercel',publicDir:false,build:{outDir:'public',emptyOutDir:false}});
