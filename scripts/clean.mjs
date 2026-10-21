import fs from 'node:fs/promises';
import { assertBuildPath, distRoot } from './paths.mjs';

await fs.rm(assertBuildPath(distRoot), { recursive: true, force: true });
