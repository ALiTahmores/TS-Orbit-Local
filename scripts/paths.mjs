import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const distRoot = path.join(projectRoot, 'dist');

export function assertBuildPath(candidate) {
  const resolved = path.resolve(candidate);
  if (resolved !== distRoot && !resolved.startsWith(distRoot + path.sep)) {
    throw new Error('Build operation must remain inside the project dist directory.');
  }
  return resolved;
}
