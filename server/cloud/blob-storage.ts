import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DomainError } from '../domain/repository.ts';
import { fileName, mimeType, textual, verifySignature } from '../files/validation.ts';

const keyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const prefix = 'orbit-assets/v1/';
type ByteSource = AsyncIterable<Uint8Array> | ReadableStream<Uint8Array> | Uint8Array;

/** The SDK is injected in tests; only this boundary ever knows the store token. */
export interface PrivateBlobSdk {
  put(pathname: string, body: any, options: any): Promise<{ pathname: string }>;
  get(pathname: string, options: any): Promise<null | { statusCode: number; stream: ByteSource | null; blob: { pathname: string; contentType?: string; size?: number } }>;
  del(pathname: string, options?: any): Promise<unknown>;
}
export interface CloudUploadIntent {
  id: string;
  key: string;
  name: string;
  byteSize: number;
  mimeType: string;
  expiresAt: number;
}
export interface CloudAssetMetadata {
  managed: true;
  storageFormat: 'orbit-assets-v1';
  storageBackend: 'vercel-blob';
  storageKey: string;
  byteSize: number;
  mimeType: string;
  sha256: string;
}
export interface VerifiedTemporaryBlob {
  /** Ephemeral verified read cache, never the authoritative copy. */
  filePath: string;
  byteSize: number;
  mimeType: string;
  sha256: string;
  dispose(): Promise<void>;
}

const failure = (status: number, code: string, message: string): never => { throw new DomainError(status, code, message); };

async function* chunks(body: ByteSource): AsyncGenerator<Buffer> {
  if (body instanceof Uint8Array) { yield Buffer.from(body); return; }
  if (body && typeof (body as any)[Symbol.asyncIterator] === 'function') {
    for await (const chunk of body as AsyncIterable<Uint8Array>) yield Buffer.from(chunk);
    return;
  }
  if (body && typeof (body as ReadableStream<Uint8Array>).getReader === 'function') {
    const reader = (body as ReadableStream<Uint8Array>).getReader();
    let complete = false;
    try {
      while (true) { const next = await reader.read(); if (next.done) { complete = true; break; } yield Buffer.from(next.value); }
    } finally { if (!complete) await reader.cancel().catch(() => {}); reader.releaseLock(); }
    return;
  }
  return failure(503, 'INVALID_BLOB_RESPONSE', 'پاسخ ذخیره‌ساز فایل معتبر نیست.');
}

/** Private, immutable cloud objects. Database authorization stays in FileService.
 * Only server-minted UUIDs become object paths; URLs from clients are never fetched.
 * Downloads verify into an ephemeral stage before returning the first byte. */
export class VercelBlobStorage {
  readonly maxBytes: number;
  private provider?: Promise<PrivateBlobSdk>;
  constructor(private options: { sdk?: PrivateBlobSdk; token?: string; maxBytes?: number; tempRoot?: string; now?: () => number } = {}) {
    this.maxBytes = options.maxBytes ?? 25 * 1024 * 1024;
    if (!Number.isSafeInteger(this.maxBytes) || this.maxBytes < 1 || this.maxBytes > 1024 * 1024 * 1024) throw new Error('Invalid cloud file size limit.');
  }
  private sdk(): Promise<PrivateBlobSdk> {
    if (this.options.sdk) return Promise.resolve(this.options.sdk);
    return this.provider ??= import('@vercel/blob') as unknown as Promise<PrivateBlobSdk>;
  }
  private credentials(): { token?: string } { return this.options.token ? { token: this.options.token } : {}; }
  private async cancel(body: ByteSource | null | undefined): Promise<void> {
    if (!body || body instanceof Uint8Array) return;
    try {
      if (typeof (body as any).cancel === 'function') await (body as ReadableStream<Uint8Array>).cancel();
      else if (typeof (body as any).destroy === 'function') (body as any).destroy();
      else if (typeof (body as any).return === 'function') await (body as any).return();
    } catch { /* Preserve the storage validation error. */ }
  }
  validKey(key: unknown): key is string { return typeof key === 'string' && keyPattern.test(key); }
  pathname(key: string): string {
    if (!this.validKey(key)) return failure(503, 'INVALID_STORAGE_KEY', 'شناسهٔ ذخیره‌سازی فایل معتبر نیست.');
    return prefix + key;
  }
  /** This is a metadata predicate, not an untrusted URL probe. A missing remote
   * object is reported truthfully by readVerified rather than falling back. */
  available(row: any): boolean {
    return row?.managed === true && row.storageFormat === 'orbit-assets-v1' && row.storageBackend === 'vercel-blob' && this.validKey(row.storageKey) &&
      Number.isSafeInteger(row.byteSize) && row.byteSize >= 0 && row.byteSize <= this.maxBytes && /^[a-f0-9]{64}$/.test(row.sha256 || '');
  }
  private validateIntent(intent: CloudUploadIntent): void {
    if (!intent || !this.validKey(intent.id) || !this.validKey(intent.key)) failure(422, 'INVALID_UPLOAD_INTENT', 'درخواست بارگذاری معتبر نیست.');
    fileName(intent.name);
    if (!Number.isSafeInteger(intent.byteSize) || intent.byteSize < 0 || intent.byteSize > this.maxBytes) failure(413, 'FILE_TOO_LARGE', 'اندازهٔ فایل از حد مجاز بیشتر است.');
    if (!Number.isSafeInteger(intent.expiresAt) || intent.expiresAt <= (this.options.now?.() ?? Date.now())) failure(410, 'UPLOAD_INTENT_EXPIRED', 'مهلت بارگذاری پایان یافته است.');
    mimeType(intent.name, intent.mimeType);
  }
  /** Pass only a persisted, server-authorized intent here. `handleUpload` from
   * @vercel/blob/client verifies provider callbacks; this method never grants
   * business permission from the client's self-asserted metadata. */
  directTokenOptions(intent: CloudUploadIntent, requestedPath: unknown, clientPayload: unknown) {
    this.validateIntent(intent);
    if (requestedPath !== this.pathname(intent.key) || typeof clientPayload !== 'string' || clientPayload.length > 500) failure(403, 'UPLOAD_INTENT_MISMATCH', 'مسیر بارگذاری با درخواست مجاز مطابقت ندارد.');
    let parsed: any;
    try { parsed = JSON.parse(clientPayload as string); } catch { failure(422, 'INVALID_UPLOAD_INTENT', 'درخواست بارگذاری معتبر نیست.'); }
    if (!parsed || Object.keys(parsed).length !== 1 || parsed.uploadId !== intent.id) failure(403, 'UPLOAD_INTENT_MISMATCH', 'درخواست بارگذاری قابل تغییر نیست.');
    return {
      allowedContentTypes: [mimeType(intent.name, intent.mimeType)], maximumSizeInBytes: intent.byteSize,
      validUntil: intent.expiresAt, addRandomSuffix: false, allowOverwrite: false,
      tokenPayload: JSON.stringify({ uploadId: intent.id, storageKey: intent.key }),
    };
  }
  private async stage(body: ByteSource, expected: { name: string; mimeType: string; byteSize?: number; sha256?: string }): Promise<VerifiedTemporaryBlob> {
    const name = fileName(expected.name), mime = mimeType(name, expected.mimeType);
    if (expected.byteSize !== undefined && (!Number.isSafeInteger(expected.byteSize) || expected.byteSize < 0 || expected.byteSize > this.maxBytes)) failure(413, 'FILE_TOO_LARGE', 'اندازهٔ فایل از حد مجاز بیشتر است.');
    const tempRoot = path.resolve(this.options.tempRoot ?? os.tmpdir());
    const directory = await fs.promises.mkdtemp(path.join(tempRoot, 'orbit-cloud-read-'));
    const filename = path.join(directory, 'verified.bin');
    let handle: Awaited<ReturnType<typeof fs.promises.open>>;
    try { handle = await fs.promises.open(filename, 'wx', 0o600); }
    catch (error) { await fs.promises.rmdir(directory); throw error; }
    let disposed = false, closed = false;
    const dispose = async () => {
      if (disposed) return;
      disposed = true;
      if (!closed) { await handle.close().catch(() => {}); closed = true; }
      // The exact mkdtemp path is owned by this request, never a caller path.
      if (!path.resolve(directory).startsWith(tempRoot + path.sep) || !path.basename(directory).startsWith('orbit-cloud-read-')) throw new Error('Temporary cleanup escaped its root.');
      await fs.promises.rm(directory, { recursive: true, force: true });
    };
    try {
      const digest = createHash('sha256'), decoder = textual(name) ? new TextDecoder('utf-8', { fatal: true }) : null;
      let size = 0, signature = Buffer.alloc(0);
      for await (const chunk of chunks(body)) {
        size += chunk.length;
        if (size > this.maxBytes || expected.byteSize !== undefined && size > expected.byteSize) failure(413, 'FILE_TOO_LARGE', 'اندازهٔ فایل از حد مجاز بیشتر است.');
        if (decoder) {
          try { if (decoder.decode(chunk, { stream: true }).includes('\0')) failure(415, 'INVALID_TEXT_CONTENT', 'محتوای فایل متنی معتبر نیست.'); }
          catch (error) { if (error instanceof DomainError) throw error; failure(415, 'INVALID_TEXT_CONTENT', 'متن فایل باید UTF-8 معتبر باشد.'); }
        }
        if (signature.length < 4096) signature = Buffer.concat([signature, chunk.subarray(0, 4096 - signature.length)]);
        digest.update(chunk);
        let offset = 0;
        while (offset < chunk.length) { const written = await handle.write(chunk, offset, chunk.length - offset); if (!written.bytesWritten) throw new Error('Temporary file write did not progress.'); offset += written.bytesWritten; }
      }
      if (decoder) { try { decoder.decode(); } catch { failure(415, 'INVALID_TEXT_CONTENT', 'متن فایل باید UTF-8 معتبر باشد.'); } }
      if (expected.byteSize !== undefined && size !== expected.byteSize) failure(409, 'FILE_CONTENT_CORRUPT', 'اندازهٔ فایل با اطلاعات ذخیره‌شده همخوانی ندارد.');
      verifySignature(name, signature, size);
      const sha256 = digest.digest('hex');
      if (expected.sha256 && expected.sha256 !== sha256) failure(409, 'FILE_CONTENT_CORRUPT', 'صحت محتوای فایل تأیید نشد.');
      await handle.sync(); await handle.close(); closed = true;
      return { filePath: filename, byteSize: size, mimeType: mime, sha256, dispose };
    } catch (error) { await dispose(); throw error; }
  }
  async putVerified(key: string, body: ByteSource, metadata: { name: string; mimeType: string; byteSize?: number; sha256?: string }): Promise<CloudAssetMetadata> {
    const pathname = this.pathname(key), stage = await this.stage(body, metadata);
    try {
      const result = await (await this.sdk()).put(pathname, fs.createReadStream(stage.filePath), {
        ...this.credentials(), access: 'private', addRandomSuffix: false, allowOverwrite: false,
        contentType: stage.mimeType, cacheControlMaxAge: 31536000, abortSignal: AbortSignal.timeout(90000),
      });
      if (result.pathname !== pathname) failure(503, 'INVALID_BLOB_RESPONSE', 'مسیر ذخیره‌شده با فایل مورد انتظار همخوانی ندارد.');
      return this.metadata(key, stage);
    } finally { await stage.dispose(); }
  }
  private metadata(key: string, value: { byteSize: number; mimeType: string; sha256: string }): CloudAssetMetadata {
    return { managed: true, storageFormat: 'orbit-assets-v1', storageBackend: 'vercel-blob', storageKey: key, byteSize: value.byteSize, mimeType: value.mimeType, sha256: value.sha256 };
  }
  private async fetchStage(key: string, expected: { name: string; mimeType: string; byteSize: number; sha256?: string }): Promise<VerifiedTemporaryBlob> {
    const pathname = this.pathname(key);
    const result = await (await this.sdk()).get(pathname, { ...this.credentials(), access: 'private', useCache: false, abortSignal: AbortSignal.timeout(90000) });
    try {
      if (!result || result.statusCode === 404) failure(404, 'FILE_CONTENT_UNAVAILABLE', 'محتوای این فایل در ذخیره‌ساز موجود نیست.');
      if (result.statusCode !== 200 || !result.stream || result.blob?.pathname !== pathname) failure(503, 'INVALID_BLOB_RESPONSE', 'پاسخ ذخیره‌ساز فایل معتبر نیست.');
      // SDK maps absent Content-Length on chunked private reads to zero. Actual streamed size below remains authoritative.
      if (result.blob.size !== undefined && result.blob.size !== 0 && result.blob.size !== expected.byteSize) failure(409, 'FILE_CONTENT_CORRUPT', 'اندازهٔ فایل با اطلاعات ذخیره‌شده همخوانی ندارد.');
      if (result.blob.contentType && mimeType(expected.name, result.blob.contentType) !== mimeType(expected.name, expected.mimeType)) failure(409, 'FILE_CONTENT_CORRUPT', 'نوع فایل با اطلاعات ذخیره‌شده همخوانی ندارد.');
    } catch (error) { await this.cancel(result?.stream); throw error; }
    return this.stage(result.stream, expected);
  }
  async readVerified(row: any): Promise<VerifiedTemporaryBlob> {
    if (!this.available(row)) failure(404, 'FILE_CONTENT_UNAVAILABLE', 'محتوای این فایل در ذخیره‌ساز موجود نیست.');
    return this.fetchStage(row.storageKey, { name: row.name, mimeType: row.mimeType, byteSize: row.byteSize, sha256: row.sha256 });
  }
  /** Finalize against the server's persisted intent. The returned digest and
   * byte count come from the actual private object, never a client claim. */
  async verifyUploaded(intent: CloudUploadIntent): Promise<CloudAssetMetadata> {
    this.validateIntent(intent);
    const stage = await this.fetchStage(intent.key, { name: intent.name, mimeType: intent.mimeType, byteSize: intent.byteSize });
    try { return this.metadata(intent.key, stage); } finally { await stage.dispose(); }
  }
  async remove(key: string): Promise<void> {
    try { await (await this.sdk()).del(this.pathname(key), this.credentials()); }
    catch (error: any) { if (error?.status !== 404 && error?.statusCode !== 404) throw error; }
  }
}
