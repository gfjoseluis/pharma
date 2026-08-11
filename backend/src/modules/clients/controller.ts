import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { logAction } from '../../utils/logger';

const CI_NIT_REGEX = /^[A-Z0-9-]{4,20}$/i;

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = String(req.query.q || '').trim();
    const clients = await prisma.client.findMany({
      where: q
        ? { OR: [{ name: { contains: q } }, { ciNit: { contains: q } }] }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(clients);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, ciNit, address, phone, email } = req.body || {};
    if (!name || !ciNit) {
      res.status(400).json({ error: 'name y ciNit son obligatorios para solicitar factura' });
      return;
    }
    const ci = String(ciNit).trim().toUpperCase();
    if (!CI_NIT_REGEX.test(ci)) {
      res.status(400).json({ error: 'CI/NIT invalido (solo letras, numeros y guiones)' });
      return;
    }
    const exists = await prisma.client.findUnique({ where: { ciNit: ci } });
    if (exists) {
      res.status(409).json({ error: 'El CI/NIT ya esta registrado', existing: exists });
      return;
    }
    const client = await prisma.client.create({
      data: {
        name: String(name).trim(),
        ciNit: ci,
        address: address || null,
        phone: phone || null,
        email: email || null,
      },
    });
    logAction('info', `Cliente creado: ${client.name} (${client.ciNit})`, {}, { userId: req.user!.id });
    res.status(201).json(client);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, ciNit, address, phone, email } = req.body || {};
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Cliente no encontrado' });
      return;
    }
    if (ciNit) {
      const ci = String(ciNit).trim().toUpperCase();
      const dup = await prisma.client.findUnique({ where: { ciNit: ci } });
      if (dup && dup.id !== id) {
        res.status(409).json({ error: 'El CI/NIT ya esta registrado' });
        return;
      }
    }
    const client = await prisma.client.update({
      where: { id },
      data: {
        name: name !== undefined ? String(name).trim() : undefined,
        ciNit: ciNit !== undefined ? String(ciNit).trim().toUpperCase() : undefined,
        address: address !== undefined ? address : undefined,
        phone: phone !== undefined ? phone : undefined,
        email: email !== undefined ? email : undefined,
      },
    });
    res.json(client);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    await prisma.client.delete({ where: { id } });
    logAction('info', `Cliente eliminado: id ${id}`, {}, { userId: req.user!.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
