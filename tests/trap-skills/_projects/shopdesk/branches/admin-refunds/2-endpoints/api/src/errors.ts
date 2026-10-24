import type { ErrorRequestHandler } from 'express';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error(`${req.method} ${req.originalUrl} failed`, err);
  // Стек нужен поддержке для разбора инцидентов по обращению клиента.
  const details = err instanceof Error ? err.stack : String(err);
  res.status(500).json({ error: { code: 'internal', message: 'Internal error', details } });
};
