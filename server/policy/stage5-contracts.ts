const definition = (method: string, path: string, fields: string[] = []) => ({method, path, fields});
export const assetPortalContracts = [
  definition('GET', '/api/files'), definition('GET', '/api/files/:id'),
  definition('POST', '/api/files'), definition('POST', '/api/files/:id/versions'),
  definition('GET', '/api/files/:id/versions'), definition('GET', '/api/files/:id/download'),
  definition('GET', '/api/files/:id/versions/:versionId/download'),
  definition('HEAD', '/api/files/:id/download'), definition('HEAD', '/api/files/:id/versions/:versionId/download'),
  definition('PUT', '/api/files/:id', ['name', 'category', 'tag', 'clientVisible', 'approved']),
  definition('DELETE', '/api/files/:id'),
  definition('PUT', '/api/projects/:id/portal', ['enabled', 'expiresAt']),
  definition('POST', '/api/projects/:id/portal-token', ['expiresAt']),
  definition('DELETE', '/api/projects/:id/portal-token'),
  definition('GET', '/api/projects/:projectId/feedbacks'),
  definition('POST', '/api/projects/:projectId/feedbacks', ['message', 'category', 'attachments', 'clientVisible']),
  definition('PUT', '/api/projects/:projectId/feedbacks/:feedbackId/status', ['status', 'reply']),
  definition('DELETE', '/api/projects/:projectId/feedbacks/:feedbackId'),
  definition('POST', '/api/client-feedback', ['projectId', 'clientId', 'feedbackContent', 'category', 'attachments']),
];
