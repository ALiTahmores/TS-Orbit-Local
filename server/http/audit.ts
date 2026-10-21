import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { redactSensitive } from '../local-config.ts';

export function requestAudit(state: any): RequestHandler {
  return (req, _res, next) => {
    if (/^\/api\//i.test(req.path) && req.path !== '/api/stats') {
      const log = { id: 'log_' + randomUUID(), timestamp: new Date().toISOString(), method: req.method,
        endpoint: req.path.replace(/(\/api\/public\/portal\/)[^/]+/i, '$1[REDACTED]'), status: 200,
        payload: redactSensitive(req.body), response: {} };
      (req as any).storageLog = log;
      state.apiLogs.unshift(log);
      if (state.apiLogs.length > 50) state.apiLogs.pop();
    }
    next();
  };
}
