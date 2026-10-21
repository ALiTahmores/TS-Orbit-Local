import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { DomainError } from '../domain/repository.ts';

const keyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export class FileStorage {
  readonly root: string;
  readonly blobs: string;
  readonly staging: string;
  constructor(dataDir: string) {
    this.root = path.join(path.resolve(dataDir), 'files');
    this.blobs = path.join(this.root, 'blobs');
    this.staging = path.join(this.root, 'staging');
    for (const directory of [this.root, this.blobs, this.staging]) {
      this.check(directory);
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      this.check(directory);
      if (!fs.lstatSync(directory).isDirectory()) throw new Error('Managed file directory must be a directory.');
    }
  }
  check(candidate: string): void {
    let current = path.resolve(candidate);
    while (true) {
      if (fs.existsSync(current) || this.lexists(current)) {
        const stat = fs.lstatSync(current);
        if (stat.isSymbolicLink()) throw new DomainError(503, 'UNSAFE_FILE_STORAGE', 'مسیر ذخیره‌سازی فایل امن نیست.');
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  private lexists(candidate: string): boolean {
    try { fs.lstatSync(candidate); return true; } catch (error: any) { if (error.code === 'ENOENT') return false; throw error; }
  }
  validKey(key: any): key is string { return typeof key === 'string' && keyPattern.test(key); }
  location(key: string): string {
    if (!this.validKey(key)) throw new DomainError(503, 'INVALID_STORAGE_KEY', 'شناسه ذخیره‌سازی فایل معتبر نیست.');
    const result = path.join(this.blobs, key);
    this.check(result);
    return result;
  }
  createStage(): { key: string; filename: string; descriptor: number } {
    this.check(this.staging);
    const key = randomUUID(), filename = path.join(this.staging, key + '.part');
    this.check(filename);
    const descriptor = fs.openSync(filename, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | (fs.constants.O_NOFOLLOW || 0), 0o600);
    return { key, filename, descriptor };
  }
  publish(stage: { key: string; filename: string }): void {
    const destination = this.location(stage.key);
    this.check(stage.filename);
    fs.linkSync(stage.filename, destination); // Atomic and refuses overwrite.
    fs.unlinkSync(stage.filename);
    this.syncDirectory(this.blobs);
  }
  syncDirectory(directory: string): void {
    let descriptor: number | undefined;
    try { descriptor = fs.openSync(directory, 'r'); fs.fsyncSync(descriptor); }
    catch (error: any) { if (process.platform !== 'win32' || !['EPERM','EACCES','EINVAL','EISDIR'].includes(error.code)) throw error; }
    finally { if (descriptor !== undefined) fs.closeSync(descriptor); }
  }
  remove(key: string): boolean {
    if (!this.validKey(key)) return false;
    const filename = this.location(key);
    try {
      const stat = fs.lstatSync(filename);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new DomainError(503, 'UNSAFE_FILE_STORAGE', 'فایل ذخیره‌شده امن نیست.');
      fs.unlinkSync(filename);
      return true;
    } catch (error: any) { if (error.code === 'ENOENT') return false; throw error; }
  }
  removeStage(filename: string): void {
    if (path.dirname(filename) !== this.staging || !keyPattern.test(path.basename(filename, '.part')) || !filename.endsWith('.part')) return;
    this.check(filename);
    try { if (fs.lstatSync(filename).isFile()) fs.unlinkSync(filename); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  }
  available(row: any): boolean {
    if (row?.storageFormat !== 'orbit-assets-v1' || !row?.managed || !this.validKey(row.storageKey) || !Number.isSafeInteger(row.byteSize) || row.byteSize < 0 || !/^[a-f0-9]{64}$/.test(row.sha256 || '')) return false;
    try { const stat = fs.lstatSync(this.location(row.storageKey)); return stat.isFile() && !stat.isSymbolicLink() && stat.size === row.byteSize; }
    catch (error: any) { if (error.code === 'ENOENT') return false; throw error; }
  }
  openVerified(row: any): number {
    if (!this.available(row)) throw new DomainError(404, 'FILE_CONTENT_UNAVAILABLE', 'محتوای این فایل روی سیستم موجود نیست.');
    const descriptor = fs.openSync(this.location(row.storageKey), fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
      const stat = fs.fstatSync(descriptor);
      if (!stat.isFile() || stat.size !== row.byteSize) throw new DomainError(409, 'FILE_CONTENT_CORRUPT', 'اندازه فایل با اطلاعات ذخیره‌شده همخوانی ندارد.');
      const hash = createHash('sha256'), buffer = Buffer.allocUnsafe(65536);
      let position = 0, read = 0;
      while ((read = fs.readSync(descriptor, buffer, 0, buffer.length, position)) > 0) { hash.update(buffer.subarray(0, read)); position += read; }
      if (hash.digest('hex') !== row.sha256) throw new DomainError(409, 'FILE_CONTENT_CORRUPT', 'صحت محتوای فایل تأیید نشد.');
      return descriptor;
    } catch (error) { fs.closeSync(descriptor); throw error; }
  }
  collect(referenced: Set<string>): { deletedBlobs: number; deletedStages: number } {
    this.check(this.blobs); this.check(this.staging);
    let deletedBlobs = 0, deletedStages = 0;
    for (const name of fs.readdirSync(this.blobs)) if (this.validKey(name)) {
      this.check(this.location(name));
      if (!referenced.has(name) && this.remove(name)) deletedBlobs++;
    }
    for (const name of fs.readdirSync(this.staging)) if (name.endsWith('.part') && this.validKey(name.slice(0, -5))) {
      this.removeStage(path.join(this.staging, name)); deletedStages++;
    }
    return { deletedBlobs, deletedStages };
  }
}
