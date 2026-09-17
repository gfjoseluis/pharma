import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { dumpDatabase, gzipFile, taskSchedulerStatus } from '../../utils/backup';
import { logAction } from '../../utils/logger';

async function runBackup(userId: number): Promise<{ backupId: number; filename: string; error: string | null }> {
  let record = await prisma.backup.create({ data: { type: 'LOCAL', status: 'RUNNING' } });
  try {
    const { file, size } = await dumpDatabase();
    const filename = await gzipFile(file);
    record = await prisma.backup.update({
      where: { id: record.id },
      data: { status: 'SUCCESS', filename, path: filename, sizeBytes: BigInt(size) },
    });
    logAction('info', 'Backup LOCAL exitoso', { filename }, { module: 'backups', userId });
    return { backupId: record.id, filename: record.filename || filename, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    record = await prisma.backup.update({ where: { id: record.id }, data: { status: 'FAILED', error: message } });
    logAction('error', 'Backup LOCAL fallido', { error: message }, { module: 'backups', userId });
    return { backupId: record.id, filename: '', error: message };
  }
}

/** POST /api/backups/force - genera un backup local .sql.gz */
export async function force(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await runBackup(req.user!.id);
    if (result.error) {
      res.status(500).json({ ok: false, ...result });
      return;
    }
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
}

/** GET /api/backups/status - ultimo backup local y estado de la tarea programada. */
export async function status(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [lastLocal, task] = await Promise.all([
      prisma.backup.findFirst({ where: { type: 'LOCAL' }, orderBy: { id: 'desc' } }),
      taskSchedulerStatus(),
    ]);
    res.json({ lastLocal, task });
  } catch (err) { next(err); }
}

export async function logs(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ logDirectory: 'backend/logs (rotacion diaria, acceso restringido)' });
  } catch (err) { next(err); }
}
