import {build} from 'vite';
import {projectRoot} from './paths.mjs';

// Build assets directly into the platform CDN directory. The server entry is
// compiled by Vercel; building the client never opens a database or needs secrets.
process.chdir(projectRoot);
await build({publicDir:false,build:{outDir:'public',emptyOutDir:false}});
