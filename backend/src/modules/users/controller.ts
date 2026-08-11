import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma';
import { logAction } from '../../utils/logger';

export const PERMISSIONS = [
  'dashboard',
  'inventory',
  'purchases',
  'branches',
  'pos',
  'pos_qr',
  'invoices',
  'reports',
  'clients',
  'users',
  'licenses',
  'backups',
  'logs',
] as const;

function parsePermissions(p: unknown): string[] {
  if (Array.isArray(p)) return p.map(String).filter((x) => (PERMISSIONS as readonly string[]).includes(x));
  return [];
}

export async function list(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        branchId: true,
        active: true,
        createdAt: true,
        permissions: true,
        branch: { select: { id: true, name: true } },
      },
      orderBy: { id: 'asc' },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { username, password, fullName, role, branchId, permissions } = req.body || {};
    if (!username || !password || !fullName || !role) {
      res.status(400).json({ error: 'username, password, fullName y role son obligatorios' });
      return;
    }
    const exists = await prisma.user.findUnique({ where: { username: String(username).trim() } });
    if (exists) {
      res.status(409).json({ error: 'El nombre de usuario ya existe' });
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username: String(username).trim(),
        password: hash,
        fullName: String(fullName).trim(),
        role: String(role),
        branchId: branchId || null,
        permissions: parsePermissions(permissions),
      },
    });
    logAction('info', `Usuario creado: ${user.username} (${user.role})`, { userIdCreated: user.id }, { userId: req.user!.id });
    res.status(201).json({ id: user.id, username: user.username, role: user.role });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const { username, password, fullName, role, branchId, permissions, active } = req.body || {};
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }
    const data: Record<string, unknown> = {};
    if (username !== undefined) data.username = String(username).trim();
    if (fullName !== undefined) data.fullName = String(fullName).trim();
    if (role !== undefined) data.role = String(role);
    if (branchId !== undefined) data.branchId = branchId || null;
    if (permissions !== undefined) data.permissions = parsePermissions(permissions);
    if (active !== undefined) data.active = Boolean(active);
    if (password) data.password = await bcrypt.hash(password, 10);

    const updated = await prisma.user.update({ where: { id }, data });
    logAction('info', `Usuario actualizado: ${updated.username}`, { userIdUpdated: id }, { userId: req.user!.id });
    res.json({ id: updated.id, username: updated.username, role: updated.role });
  } catch (err) {
    next(err);
  }
}

/** Desactivar (soft delete). */
export async function deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (id === req.user!.id) {
      res.status(400).json({ error: 'No puede desactivarse a si mismo' });
      return;
    }
    const updated = await prisma.user.update({ where: { id }, data: { active: false } });
    logAction('info', `Usuario desactivado: ${updated.username}`, { userIdUpdated: id }, { userId: req.user!.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/** Eliminacion fisica (solo admin). */
export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (id === req.user!.id) {
      res.status(400).json({ error: 'No puede eliminarse a si mismo' });
      return;
    }
    await prisma.user.delete({ where: { id } });
    logAction('warn', `Usuario eliminado fisicamente: id ${id}`, {}, { userId: req.user!.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
