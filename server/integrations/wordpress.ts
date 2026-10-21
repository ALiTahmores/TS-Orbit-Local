import { Router } from 'express';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { activeMember, type ScopedState } from '../policy/scope.ts';

// A connector key grants writes to one registered site only, never a user login.
export function createWordPressReceiver(state: any, scoped: ScopedState) {
  const router = Router({ caseSensitive: true });
  const text = z.string().max(500);
  const schema = z.object({ projectId: z.string().min(1).max(200), siteUrl: z.string().url().max(2000), siteName: text.optional(), event: text.optional(), payload: z.record(z.string(), z.unknown()).optional(),
    apiKey: text.optional(), wpVersion: text.optional(), phpVersion: text.optional(), themeName: text.optional(), themeVersion: text.optional(), serverType: text.optional(), sslStatus: text.optional(), dnsStatus: text.optional(),
    installedThemes: z.array(z.unknown()).max(200).optional(), installedPlugins: z.array(z.unknown()).max(200).optional(),
    pagesCount: z.number().int().nonnegative().optional(), postsCount: z.number().int().nonnegative().optional(), productsCount: z.number().int().nonnegative().optional(), mediaCount: z.number().int().nonnegative().optional(),
    rankMathStatus: text.optional(), yoastStatus: text.optional(), sitemapStatus: text.optional(), robotsTxtStatus: text.optional(), cacheStatus: text.optional(), optimizationStatus: text.optional(), securityPluginStatus: text.optional(), backupStatus: text.optional(), connectionStatus: text.optional(), performanceMetrics: z.record(z.string(), z.unknown()).optional()
  }).strict();
  router.post(['/sync', '/webhook'], (req: any, res, next) => {
    if (!req.headers['x-wp-sync-api-key'] && !req.headers['x-wp-sync-signature']) return next();
    const key = req.headers['x-wp-sync-api-key'], signature = req.headers['x-wp-sync-signature'];
    if (typeof key !== 'string' || typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) return res.status(401).json({ error: 'INVALID_CONNECTOR_CREDENTIALS' });
    const site = state.wpSites.find((row: any) => row.projectId === req.body?.projectId);
    const workspaceId = site && scoped.scopeOf('wpSites', site);
    const workspace = state.workspaces.find((row: any) => row.id === workspaceId);
    if (!site || !workspaceId || !activeMember(workspace) || typeof site.apiKey !== 'string' || key.length < 32 || Buffer.byteLength(key) !== Buffer.byteLength(site.apiKey) || !timingSafeEqual(Buffer.from(key), Buffer.from(site.apiKey))) return res.status(401).json({ error: 'INVALID_CONNECTOR_CREDENTIALS' });
    const digest = createHmac('sha256', key).update(req.rawBody || '').digest();
    if (!timingSafeEqual(digest, Buffer.from(signature, 'hex'))) return res.status(401).json({ error: 'INVALID_CONNECTOR_SIGNATURE' });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success || parsed.data.siteUrl.replace(/\/$/, '') !== site.siteUrl.replace(/\/$/, '') || (parsed.data.apiKey && parsed.data.apiKey !== key)) return res.status(422).json({ error: 'INVALID_CONNECTOR_PAYLOAD' });
    const { projectId, apiKey, siteUrl, event, payload, ...metadata } = parsed.data;
    const at = new Date().toISOString();
    if (req.path === '/sync') Object.assign(site, metadata, { lastSyncAt: at });
    else {
      if (!event || !event.trim()) return res.status(422).json({ error: 'EVENT_REQUIRED' });
      state.wpWebhooks.unshift({ id: 'wh_' + randomUUID(), projectId, workspaceId, siteUrl, event, payload: payload || {}, timestamp: at });
    }
    state.wpLogs.unshift({ id: 'wp_log_' + randomUUID(), projectId, workspaceId, timestamp: at, event: req.path === '/sync' ? 'site_synchronized' : 'webhook_received', message: 'داده از اتصال احرازشده دریافت شد.' });
    res.json({ saved: true, projectId, timestamp: at });
  });
  return router;
}
