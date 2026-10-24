import fs from 'node:fs';
import path from 'node:path';
import express, { type RequestHandler } from 'express';

const immutable = 'public, max-age=31536000, immutable';

/** Browser hardening for every response. The CSP is applied to the production bundle
 * only: the Vite dev server injects inline scripts for hot reload. */
export function securityHeaders(options: { production: boolean; appOrigin: string; secureOrigin: boolean }): RequestHandler {
  const origin = new URL(options.appOrigin);
  const socketOrigin = (origin.protocol === 'https:' ? 'wss://' : 'ws://') + origin.host;
  const contentSecurityPolicy = [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:", "media-src 'self' blob:", "font-src 'self' data:",
    `connect-src 'self' ${socketOrigin}`, "worker-src 'self' blob:", "frame-src 'self' blob:",
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
  ].join('; ');
  return (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    // Client-portal links carry their access token in the URL; never send it to other sites.
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    // Voice messages record from the microphone; nothing else needs device access.
    res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), payment=(), usb=(), microphone=(self)');
    if (options.production) res.setHeader('Content-Security-Policy', contentSecurityPolicy);
    if (options.secureOrigin) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    next();
  };
}

/** Serves the built client. Hashed /assets are immutable and sent precompressed when the
 * build produced .br/.gz siblings; the HTML shell is revalidated on every load so a new
 * release is picked up at once. A missing asset is a 404, never the HTML shell, so a tab
 * still running an older release fails its chunk load cleanly and reloads. */
export function clientApp(clientDir: string): RequestHandler[] {
  const encodings: [string, RegExp, string][] = [['br', /\bbr\b/, '.br'], ['gzip', /\bgzip\b/, '.gz']];
  const precompressed: RequestHandler = (req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || !/^\/assets\/[\w.-]+\.(?:js|css|svg)$/.test(req.path)) return next();
    const accepted = String(req.headers['accept-encoding'] || '');
    for (const [encoding, pattern, extension] of encodings) {
      const file = path.join(clientDir, req.path + extension);
      if (!pattern.test(accepted) || !fs.existsSync(file)) continue;
      res.setHeader('Content-Encoding', encoding);
      res.setHeader('Vary', 'Accept-Encoding');
      res.type(path.extname(req.path));
      return res.sendFile(file, { maxAge: '1y', immutable: true });
    }
    next();
  };
  const files = express.static(clientDir, { index: false, setHeaders(res, file) {
    const relative = path.relative(clientDir, file).replace(/\\/g, '/');
    res.setHeader('Cache-Control', relative.startsWith('assets/') ? immutable : relative.startsWith('fonts/') ? 'public, max-age=2592000' : 'no-cache');
  } });
  const missingAsset: RequestHandler = (req, res, next) => /^\/assets\//.test(req.path) ? void res.status(404).type('text/plain').send('Not found') : next();
  const shell: RequestHandler = (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.sendFile(path.join(clientDir, 'index.html'), { cacheControl: false, headers: { 'Cache-Control': 'no-cache' } });
  };
  return [precompressed, files, missingAsset, shell];
}
