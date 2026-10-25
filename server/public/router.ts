import { Router } from 'express';
import type { ScopedState } from '../policy/scope.ts';
import { FeedbackService, publicProject, resolvePortalProject, type PortalOptions } from '../portal/service.ts';

export function createPublicRouter(state: any, scoped: ScopedState, options: PortalOptions = {}) {
  const router = Router({ caseSensitive: true });
  const feedback = new FeedbackService(state, scoped, options);
  const failures = new Map<string, { until: number; count: number }>();
  router.use((req, res, next) => {
    const key = req.ip || 'local', at = Date.now();
    if (failures.size > 1000) for (const [ip, item] of failures) if (item.until < at) failures.delete(ip);
    let entry = failures.get(key);
    if (!entry || entry.until < at) { entry = { until: at + 60_000, count: 0 }; failures.set(key, entry); }
    if (++entry.count > 100) return res.status(429).json({ error: 'RATE_LIMITED', message: 'کمی بعد دوباره تلاش کنید.' });
    res.setHeader('Cache-Control', 'no-store'); next();
  });
  const authorize = (req: any, res: any, next: any) => {
    const project = resolvePortalProject(state, scoped, req.params.token);
    if (!project) return res.status(404).json({ error: 'PORTAL_NOT_FOUND', message: 'لینک معتبر نیست یا پورتال غیرفعال است.' });
    req.portalProject = project; next();
  };
  router.get('/portal/:token', authorize, (req: any, res) => {
    const project = req.portalProject;
    const tasks = state.tasks.filter((task: any) => task.projectId === project.id && task.clientVisible === true && !task.deletedAt && scoped.scopeOf('tasks', task) === scoped.scopeOf('projects', project)).map((task: any) => Object.fromEntries(['id', 'projectId', 'title', 'status', 'progress', 'deadline'].filter(field => task[field] !== undefined).map(field => [field, task[field]])));
    const files = options.files ? options.files.listPublic(project) : state.files.filter((file: any) => file.projectId === project.id && file.clientVisible === true && file.approved === true && !file.deletedAt && scoped.scopeOf('files', file) === scoped.scopeOf('projects', project)).map((file: any) => ({ id: file.id, name: file.name, size: file.size, category: file.category }));
    res.json({ project: publicProject(project), tasks, files, feedback: feedback.publicList(project) });
  });
  router.post('/portal/:token/feedback', authorize, (req: any, res, next) => {
    try { const row = feedback.createPublic(req.portalProject, req.body); res.status(201).json({ id: row.id, createdAt: row.createdAt, saved: true, feedback: feedback.projectDTO(req.portalProject, row, true) }); } catch (error) { next(error); }
  });
  const files = (method: 'uploadPublic' | 'sendPublic') => (req: any, res: any, next: any) => {
    if (!options.files) return res.status(503).json({ error: 'FILE_SERVICE_UNAVAILABLE', message: 'سرویس فایل در دسترس نیست.' });
    try { const result = method === 'uploadPublic' ? options.files.uploadPublic(req, res, next, req.portalProject) : options.files.sendPublic(req, res, next, req.portalProject, req.params.fileId, req.params.versionId); Promise.resolve(result).catch(next); } catch (error) { next(error); }
  };
  for(const [suffix,method] of [['direct-intents','createDirectIntent'],['direct-token','directToken'],['direct-intents/:uploadId/finalize','finalizeDirect']] as const) router.post('/portal/:token/files/'+suffix,authorize,(req:any,res,next)=>{if(!options.files)return res.status(503).json({error:'FILE_SERVICE_UNAVAILABLE'});try{Promise.resolve((options.files as any)[method](req,res,req.portalProject)).catch(next);}catch(error){next(error);}});
  router.post('/portal/:token/files', authorize, files('uploadPublic'));
  router.get('/portal/:token/files/:fileId/download', authorize, files('sendPublic'));
  router.get('/portal/:token/files/:fileId/versions/:versionId/download', authorize, files('sendPublic'));
  return router;
}
