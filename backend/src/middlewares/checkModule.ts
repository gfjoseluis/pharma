import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { logAction } from '../utils/logger';

const MODULE_PREFIX: Record<string, string> = {
  POS: 'POS',
  QR: 'QR',
  FACTURACION: 'FAC',
  REPORTES: 'REP',
  BACKUPS: 'BAK',
  INVENTARIO: 'INV',
};

const LICENSE_CACHE = new Map<string, { status: string; key: string | null }>();

export function invalidateLicenseCache(module: string): void {
  LICENSE_CACHE.delete(module);
}

/** Valida el formato del codigo de licencia: PREFIJO-XXXX-XXXX */
export function isValidLicenseKey(module: string, key: string): boolean {
  const prefix = MODULE_PREFIX[module];
  if (!prefix || !key) return false;
  const parts = key.split('-');
  if (parts.length < 2) return false;
  if (parts[0].toUpperCase() !== prefix) return false;
  const rest = parts.slice(1).join('');
  return /^[A-Z0-9]{4,12}$/.test(rest);
}

async function getLicense(module: string): Promise<{ status: string; key: string | null }> {
  const cached = LICENSE_CACHE.get(module);
  if (cached) return cached;
  const row = await prisma.license.findUnique({ where: { module } });
  const result = {
    status: row?.status || 'INACTIVE',
    key: row?.license_key || null,
  };
  LICENSE_CACHE.set(module, result);
  return result;
}

/**
 * Middleware CheckModule: valida que el modulo este ACTIVO y con codigo de licencia valido.
 * Uso: router.post('/sales', authRequired, requirePermission('sales'), CheckModule('POS'), handler)
 */
export function CheckModule(module: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const lic = await getLicense(module);
      if (lic.status !== 'ACTIVE' || !lic.key || !isValidLicenseKey(module, lic.key)) {
        logAction('warn', `Modulo ${module} no licenciado`, { action: 'check_module' }, { userId: req.user?.id });
        res.status(403).json({
          error: `Modulo ${module} no esta activo. Ingrese un codigo de licencia valido en Configuracion > Licencias.`,
        });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export async function listLicenses(): Promise<{ module: string; status: string; license_key: string | null }[]> {
  const rows = await prisma.license.findMany({ orderBy: { module: 'asc' } });
  return rows.map((r) => ({ module: r.module, status: r.status, license_key: r.license_key }));
}
