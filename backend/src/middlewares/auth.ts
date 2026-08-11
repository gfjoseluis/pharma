import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { hasAction } from '../config/actions';

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: string;
  branchId: number | null;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  const options: jwt.SignOptions = {
    expiresIn: env.jwtExpires as unknown as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(user, env.jwtSecret, options);
}

export function authRequired(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : typeof req.query.token === 'string'
      ? req.query.token
      : null;
  if (!token) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }
  try {
    req.user = jwt.verify(token, env.jwtSecret) as AuthUser;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

/** Exige que el usuario tenga habilitada la accion (o el modulo heredado equivalente). */
export function requirePermission(action: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const u = req.user;
    if (!u) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (u.role === 'admin') {
      next();
      return;
    }
    if (hasAction(u.permissions, action)) {
      next();
      return;
    }
    res.status(403).json({ error: `Sin permiso para acceder a: ${action}` });
  };
}

/** Exige que el usuario tenga habilitada al menos una de las acciones indicadas. */
export function requireAnyPermission(...actions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const u = req.user;
    if (!u) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (u.role === 'admin') {
      next();
      return;
    }
    if (actions.some((a) => hasAction(u.permissions, a))) {
      next();
      return;
    }
    res.status(403).json({ error: `Sin permiso para acceder a: ${actions.join(', ')}` });
  };
}

export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Acceso restringido' });
      return;
    }
    next();
  };
}
