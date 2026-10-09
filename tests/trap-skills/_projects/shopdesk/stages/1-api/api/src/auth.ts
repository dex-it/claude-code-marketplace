import { randomUUID } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import type { Role, User } from './domain/user.js';
import { HttpError } from './errors.js';

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

const sessions = new Map<string, SessionUser>();

export function createSession(user: User): string {
  const token = randomUUID();
  sessions.set(token, { id: user.id, email: user.email, role: user.role });
  return token;
}

function tokenFrom(req: Request): string | undefined {
  const header = req.get('authorization');
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

function authenticate(req: Request): SessionUser {
  if (req.user) return req.user;
  const token = tokenFrom(req);
  const user = token ? sessions.get(token) : undefined;
  if (!user) throw new HttpError(401, 'unauthorized', 'Authentication required');
  req.user = user;
  return user;
}

export function currentUser(req: Request): SessionUser {
  if (!req.user) throw new HttpError(401, 'unauthorized', 'Authentication required');
  return req.user;
}

export const requireUser: RequestHandler = (req, _res, next) => {
  authenticate(req);
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (authenticate(req).role !== 'admin') throw new HttpError(403, 'forbidden', 'Admin role required');
  next();
};
