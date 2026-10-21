import { Router } from 'express';
import type { NotificationService } from './service.ts';

export function createNotificationRouter(service: NotificationService): Router {
  const router = Router();
  const endpoint = (operation: (request: any) => any) => (request: any, response: any, next: any) => {
    try { response.json(operation(request)); } catch (error) { next(error); }
  };
  router.get('/notifications', endpoint(() => service.list()));
  router.put('/notifications/read-all', endpoint(() => service.markAllRead()));
  router.put('/notifications/:id/read', endpoint(request => service.markRead(request.params.id)));
  router.post('/notifications/clear', endpoint(() => service.clear()));
  router.get('/activity-logs', endpoint(() => service.activity()));
  return router;
}
