import { Router } from 'express';
import { ChatService, type ChatOptions } from './service.ts';

export function createChatRouter(options: ChatOptions | ChatService) {
  const service = options instanceof ChatService ? options : new ChatService(options);
  const router = Router();
  const handle = (callback: any) => (req: any, res: any, next: any) => { try { callback(req, res); } catch (error) { next(error); } };
  router.get('/chat/users', handle((_req: any, res: any) => res.json(service.users())));
  router.get('/chat/conversations', handle((_req: any, res: any) => res.json(service.conversations())));
  router.post('/chat/conversations', handle((req: any, res: any) => { const result = service.create(req.body); res.status(result.created ? 201 : 200).json(result.conversation); }));
  router.put('/chat/conversations/:id', handle((req: any, res: any) => res.json(service.update(req.params.id, req.body))));
  router.post('/chat/conversations/:id/close', handle((req: any, res: any) => res.json(service.close(req.params.id, req.body))));
  router.post('/chat/conversations/:id/members', handle((req: any, res: any) => res.json(service.addMembers(req.params.id, req.body))));
  router.delete('/chat/conversations/:id/members/:userId', handle((req: any, res: any) => res.json(service.removeMember(req.params.id, req.params.userId))));
  router.put('/chat/conversations/:id/preferences', handle((req: any, res: any) => res.json(service.preferences(req.params.id, req.body))));
  router.get('/chat/conversations/:id/messages', handle((req: any, res: any) => res.json(service.messages(req.params.id, req.query))));
  router.post('/chat/conversations/:id/messages', handle((req: any, res: any) => res.status(201).json(service.send(req.params.id, req.body))));
  router.put('/chat/messages/:id', handle((req: any, res: any) => res.json(service.edit(req.params.id, req.body))));
  router.delete('/chat/messages/:id', handle((req: any, res: any) => res.json(service.remove(req.params.id))));
  router.post('/chat/messages/:id/react', handle((req: any, res: any) => res.json(service.react(req.params.id, req.body))));
  router.post('/chat/conversations/:id/pin', handle((req: any, res: any) => res.json(service.pin(req.params.id, req.body))));
  router.post('/chat/conversations/:id/read', handle((req: any, res: any) => res.json(service.read(req.params.id, req.body))));
  router.get('/chat/requests', handle((_req: any, res: any) => res.json(service.requests())));
  router.post('/chat/requests', handle((req: any, res: any) => res.status(201).json(service.request(req.body))));
  router.put('/chat/requests/:id/respond', handle((req: any, res: any) => res.json(service.respond(req.params.id, req.body))));
  router.delete('/chat/permissions/team/:teamId/user/:userId', handle((req: any, res: any) => res.json(service.revoke(req.params.teamId, req.params.userId))));
  return router;
}
