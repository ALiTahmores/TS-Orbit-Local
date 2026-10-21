import type { ErrorRequestHandler } from 'express';

export const requestFailure: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error('Request failed:', error?.name || 'application error');
  if (res.headersSent) { res.destroy(); return; }
  const status = [400, 401, 403, 404, 408, 409, 410, 413, 415, 416, 422, 429, 503].includes(error?.status) ? error.status : 500;
  res.status(status).json({ error: status < 500 && typeof error?.code==='string' ? error.code : status < 500 ? 'INVALID_REQUEST' : 'REQUEST_FAILED',
    message: status < 500 && error?.name === 'Error' && typeof error?.code==='string' ? error.message : 'عملیات انجام نشد؛ داده‌های قبلی حفظ شده‌اند.' });
};
