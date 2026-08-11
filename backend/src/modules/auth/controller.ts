import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma';
import { signToken, AuthUser } from '../../middlewares/auth';
import { logAction } from '../../utils/logger';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { username: String(username).trim() } });
    if (!user || !user.active) {
      res.status(401).json({ error: 'Credenciales invalidas' });
      return;
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      logAction('warn', 'Intento de login fallido', { username }, { userId: user.id });
      res.status(401).json({ error: 'Credenciales invalidas' });
      return;
    }
    const permissions: string[] = Array.isArray(user.permissions)
      ? user.permissions.filter((p): p is string => typeof p === 'string')
      : [];
    const payload: AuthUser = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      branchId: user.branchId,
      permissions,
    };
    const token = signToken(payload);
    const branch = user.branchId ? await prisma.branch.findUnique({ where: { id: user.branchId } }) : null;
    logAction('info', 'Login exitoso', { username }, { module: 'auth', userId: user.id });
    res.json({ token, user: { ...payload, branch: branch ? { id: branch.id, name: branch.name, type: branch.type } : null } });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { branch: { select: { id: true, name: true, type: true } } },
    });
    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }
    res.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        branchId: user.branchId,
        permissions: user.permissions,
        branch: user.branch,
      },
    });
  } catch (err) {
    next(err);
  }
}
