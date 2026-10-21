import { Router } from 'express';
import { dto } from '../domain/models.ts';
import { recordActivity, now, DomainError, type DomainContext } from '../domain/repository.ts';
import { FeedbackService, portalExpiry, portalRevoked, portalToken, rotatePortal, setPortalExpiry, type PortalOptions } from './service.ts';

export function createPortalRouter(context: DomainContext & PortalOptions) {
  const router = Router();
  const feedback = new FeedbackService(context.scoped.raw, context.scoped, context);
  const handle = (callback: any) => (req: any, res: any, next: any) => { try { callback(req, res); } catch (error) { next(error); } };
  const event = (action: string, project: any) => { recordActivity(context, action, project.id); context.broadcast('app_projects_updated', { type: 'data_changed' }); };
  router.put('/projects/:id/portal', handle((req: any, res: any) => {
    feedback.actor(true); const project = feedback.project(req.params.id); const input = dto(req.body, ['enabled', 'expiresAt']);
    if (typeof input.enabled !== 'boolean') throw new DomainError(422, 'VALIDATION_FAILED', 'وضعیت فعال بودن لازم است.');
    const supplied = Object.hasOwn(input, 'expiresAt'); const expiry = supplied ? portalExpiry(input.expiresAt, true) : undefined;
    if (input.enabled && (portalRevoked(project) || !portalToken(project))) rotatePortal(project, supplied ? expiry! : portalExpiry(undefined, false));
    else if (supplied) setPortalExpiry(project, expiry!);
    project.clientPortalEnabled = input.enabled; project.isPortalActive = input.enabled; project.updatedAt = now();
    event('project.portal.updated', project); res.json({ success: true, project });
  }));
  router.post('/projects/:id/portal-token', handle((req: any, res: any) => {
    feedback.actor(true); const project = feedback.project(req.params.id); const input = dto(req.body, ['expiresAt']);
    const token = rotatePortal(project, portalExpiry(input.expiresAt, Object.hasOwn(input, 'expiresAt')));
    event('project.portal.rotated', project); res.json({ token, project });
  }));
  router.delete('/projects/:id/portal-token', handle((req: any, res: any) => {
    feedback.actor(true); const project = feedback.project(req.params.id); dto(req.body, []);
    project.clientPortalEnabled = false; project.isPortalActive = false; project.portalRevokedAt = now(); project.clientPortalRevokedAt = project.portalRevokedAt; project.portalRevoked = true; project.clientPortalRevoked = true; project.updatedAt = now();
    event('project.portal.revoked', project); res.json({ success: true, project });
  }));
  router.get('/projects/:id/feedbacks', handle((req: any, res: any) => { const project = feedback.project(req.params.id); res.json(feedback.privateList(project)); }));
  router.post('/projects/:id/feedbacks', handle((req: any, res: any) => { const project = feedback.project(req.params.id); const row = feedback.createPrivate(project, req.body); recordActivity(context, 'feedback.created', row.id); res.status(201).json(feedback.projectDTO(project, row)); }));
  router.put('/projects/:id/feedbacks/:feedbackId/status', handle((req: any, res: any) => { const project = feedback.project(req.params.id); const row = feedback.update(project, req.params.feedbackId, req.body); recordActivity(context, 'feedback.updated', row.id); res.json(feedback.projectDTO(project, row)); }));
  router.delete('/projects/:id/feedbacks/:feedbackId', handle((req: any, res: any) => { const project = feedback.project(req.params.id); feedback.remove(project, req.params.feedbackId); recordActivity(context, 'feedback.deleted', req.params.feedbackId); res.json({ success: true, id: req.params.feedbackId }); }));
  router.post('/client-feedback', handle((req: any, res: any) => {
    const input = dto(req.body, ['projectId', 'clientId', 'feedbackContent']);
    if (input.projectId && input.clientId && input.projectId !== input.clientId) throw new DomainError(422, 'VALIDATION_FAILED', 'شناسهٔ پروژه یکسان لازم است.');
    const project = feedback.project(input.projectId || input.clientId); const row = feedback.createPrivate(project, { message: input.feedbackContent });
    recordActivity(context, 'feedback.created', row.id); res.status(201).json({ success: true, feedback: feedback.projectDTO(project, row) });
  }));
  return router;
}
