import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { isValidLicenseKey, invalidateLicenseCache, listLicenses } from '../../middlewares/checkModule';
import { logAction } from '../../utils/logger';

const DEFAULT_MODULES = ['POS', 'QR', 'FACTURACION', 'REPORTES', 'BACKUPS', 'INVENTARIO'];

/** Crea los modulos de licencia por defecto si no existen. */
export async function seedDefault(): Promise<void> {
  for (const module of DEFAULT_MODULES) {
    await prisma.license.upsert({
      where: { module },
      create: { module, status: 'INACTIVE' },
      update: {},
    });
  }
}

export async function list(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await seedDefault();
    res.json(await listLicenses());
  } catch (err) { next(err); }
}

/** POST /api/licenses/activate { module, code } - valida y activa la licencia (eterna, sin expiracion). */
export async function activate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { module, code } = req.body || {};
    if (!module || !code) {
      res.status(400).json({ error: 'module y code son obligatorios' });
      return;
    }
    const key = String(code).trim().toUpperCase();
    if (!isValidLicenseKey(module, key)) {
      res.status(400).json({
        error: `Codigo invalido para el modulo ${module}. Formato esperado: ${module}-XXXX-XXXX`,
      });
      return;
    }
    await seedDefault();
    const lic = await prisma.license.findUnique({ where: { module } });
    if (!lic) {
      res.status(404).json({ error: `Modulo ${module} desconocido` });
      return;
    }
    const updated = await prisma.license.update({
      where: { module },
      data: { status: 'ACTIVE', license_key: key, activatedAt: new Date() },
    });
    invalidateLicenseCache(module);
    logAction('info', `Licencia activada para modulo ${module}`, { key }, { module: 'licenses', userId: req.user!.id });
    res.json({ ok: true, license: updated });
  } catch (err) { next(err); }
}

export async function deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { module } = req.body || {};
    const updated = await prisma.license.update({
      where: { module: String(module) },
      data: { status: 'INACTIVE', license_key: null, activatedAt: null },
    });
    invalidateLicenseCache(module);
    logAction('info', `Licencia desactivada para modulo ${module}`, {}, { module: 'licenses', userId: req.user!.id });
    res.json({ ok: true, license: updated });
  } catch (err) { next(err); }
}
