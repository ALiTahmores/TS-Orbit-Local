import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const format = 'orbit-assets-v1';
const keyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function checkChain(candidate: string): void {
  let current = path.resolve(candidate);
  while (true) {
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Asset integrity check refuses symbolic links.'); }
    catch (error: any) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(current); if (parent === current) break; current = parent;
  }
}

/** Read-only cross-check of every retained managed version and its actual bytes. */
export function validateAssetContents(dataDir: string, sqlitePath = path.join(dataDir, 'orbit.sqlite')) {
  checkChain(dataDir); checkChain(sqlitePath);
  const database = new DatabaseSync(sqlitePath, {readOnly: true});
  try {
    const read = (table: string) => (database.prepare(`SELECT payload FROM "${table}" ORDER BY ordinal`).all() as any[]).map(row => JSON.parse(row.payload));
    const files = read('files'), versions = read('fileVersions');
    const managed = (row: any) => row?.managed === true && row.storageFormat === format;
    const summary = {managedFiles: 0, managedVersions: 0, legacyMetadataFiles: 0, checkedBytes: 0};
    const checked = new Map<string, {bytes: number; sha256: string}>();
    const checkContent = (row: any) => {
      if (!managed(row) || !keyPattern.test(row.storageKey || '') || !Number.isSafeInteger(row.byteSize) || row.byteSize < 0 || !/^[a-f0-9]{64}$/.test(row.sha256 || '')) throw new Error('Invalid managed asset content metadata.');
      let content = checked.get(row.storageKey);
      if (!content) {
        const filename = path.join(path.resolve(dataDir), 'files', 'blobs', row.storageKey);
        checkChain(filename);
        const descriptor = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
        try {
          const stat = fs.fstatSync(descriptor);
          if (!stat.isFile()) throw new Error('Managed asset content is not a regular file.');
          const digest = createHash('sha256'), buffer = Buffer.allocUnsafe(65536); let position = 0, bytes;
          while ((bytes = fs.readSync(descriptor, buffer, 0, buffer.length, position)) > 0) {digest.update(buffer.subarray(0, bytes));position += bytes;}
          content = {bytes: position, sha256: digest.digest('hex')};
          checked.set(row.storageKey, content); summary.checkedBytes += position;
        } finally {fs.closeSync(descriptor);}
      }
      if (content.bytes !== row.byteSize || content.sha256 !== row.sha256) throw new Error('Managed asset checksum or size differs from the database.');
    };
    for (const file of files) {
      if (file.deletedAt) continue;
      if (!managed(file)) {summary.legacyMetadataFiles++;continue;}
      const current = versions.find((row: any) => row.id === file.currentVersionId && row.fileId === file.id && !row.deletedAt);
      if (!current || !managed(current)) throw new Error('Managed asset has no valid current version.');
      for (const field of ['storageKey', 'sha256', 'byteSize', 'mimeType']) if (file[field] !== current[field]) throw new Error('Managed asset current version metadata differs from its master.');
      checkContent(file); summary.managedFiles++;
    }
    for (const version of versions) {
      if (version.deletedAt || !managed(version)) continue;
      const file = files.find((row: any) => row.id === version.fileId);
      if (!file) throw new Error('Managed asset version has no parent file.');
      if (file.deletedAt) continue;
      for (const field of ['workspaceId', 'projectId', 'taskId', 'conversationId']) if ((file[field] ?? null) !== (version[field] ?? null)) throw new Error('Managed asset version parent scope differs from its file.');
      checkContent(version);summary.managedVersions++;
    }
    return summary;
  } finally {database.close();}
}
