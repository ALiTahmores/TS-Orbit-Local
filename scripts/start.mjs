import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectRoot, distRoot } from './paths.mjs';

process.chdir(projectRoot);
process.env.NODE_ENV = 'production';
const entry = path.join(distRoot, 'server', 'server.cjs');
if (!fs.existsSync(entry)) {
  console.error('Production build is missing. Run npm run build first.');
  process.exit(1);
}
await import(pathToFileURL(entry).href);
