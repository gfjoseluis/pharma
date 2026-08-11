import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { logAction } from '../../utils/logger';

type ModelName = 'category' | 'laboratory' | 'unitMeasure' | 'form';

/* eslint-disable @typescript-eslint/no-explicit-any */
const modelMap: Record<ModelName, any> = {
  category: prisma.category,
  laboratory: prisma.laboratory,
  unitMeasure: prisma.unitMeasure,
  form: prisma.form,
};

export function simpleCrud(modelName: ModelName) {
  const model = modelMap[modelName];
  const label = modelName;
  return {
    list: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const rows = await model.findMany({ orderBy: { name: 'asc' } });
        res.json(rows);
      } catch (err) { next(err); }
    },
    create: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { name, shortName, description } = req.body || {};
        if (!name) { res.status(400).json({ error: 'name es obligatorio' }); return; }
        const row = await model.create({
          data: {
            name: String(name).trim(),
            ...(shortName !== undefined ? { shortName: String(shortName).trim() } : {}),
            ...(description !== undefined ? { description: String(description).trim() || null } : {}),
          },
        });
        logAction('info', `${label} creado: ${row.name}`, {}, { userId: req.user!.id });
        res.status(201).json(row);
      } catch (err) {
        if (err instanceof Error && err.message.includes('Unique')) {
          res.status(409).json({ error: 'Ya existe un registro con ese nombre' });
          return;
        }
        next(err);
      }
    },
    update: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = parseInt(req.params.id, 10);
        const { name, shortName, description, active } = req.body || {};
        const data: Record<string, unknown> = {};
        if (name !== undefined) data.name = String(name).trim();
        if (shortName !== undefined) data.shortName = String(shortName).trim();
        if (description !== undefined) data.description = String(description).trim() || null;
        if (active !== undefined) data.active = Boolean(active);
        const row = await model.update({ where: { id }, data });
        res.json(row);
      } catch (err) { next(err); }
    },
    deactivate: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = parseInt(req.params.id, 10);
        const row = await model.update({ where: { id }, data: { active: false } });
        logAction('info', `${label} desactivado: ${row.name}`, {}, { userId: req.user!.id });
        res.json({ ok: true });
      } catch (err) { next(err); }
    },
  };
}
