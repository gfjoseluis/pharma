import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { dumpDatabase, gzipFile, createDriveService, taskSchedulerStatus } from '../../utils/backup';
import { logAction } from '../../utils/logger';

async function runBackup(type: 'LOCAL' | 'DRIVE', userId: number): Promise<{ backupId: number; filename: string; error: string | null }> {
  let record = await prisma.backup.create({ data: { type, status: 'RUNNING' } });
  try {
    const { file, size } = await dumpDatabase();
    const filename = await gzipFile(file);
    let driveResult: { driveFileId: string; driveFileName: string } | null = null;
    if (type === 'DRIVE') {
      const drive = createDriveService();
      if (!drive.ready) throw new Error('Credenciales de Google Drive no configuradas en backend/.env');
      driveResult = await drive.upload(filename);
    }
    record = await prisma.backup.update({
      where: { id: record.id },
      data: { status: 'SUCCESS', filename: driveResult ? driveResult.driveFileName : filename, path: filename, sizeBytes: BigInt(size) },
    });
    logAction('info', `Backup ${type} exitoso`, { filename }, { module: 'backups', userId });
    return { backupId: record.id, filename: record.filename || filename, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    record = await prisma.backup.update({ where: { id: record.id }, data: { status: 'FAILED', error: message } });
    logAction('error', `Backup ${type} fallido`, { error: message }, { module: 'backups', userId });
    return { backupId: record.id, filename: '', error: message };
  }
}

/** POST /api/backups/force { type: LOCAL | DRIVE } */
export async function force(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const type = String(req.body?.type || 'DRIVE').toUpperCase();
    if (!['LOCAL', 'DRIVE'].includes(type)) {
      res.status(400).json({ error: 'type debe ser LOCAL o DRIVE' });
      return;
    }
    const result = await runBackup(type as 'LOCAL' | 'DRIVE', req.user!.id);
    if (result.error) {
      res.status(500).json({ ok: false, ...result });
      return;
    }
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
}

/** GET /api/backups/status - ultimo backup local, en Drive y estado de la tarea programada. */
export async function status(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [lastLocal, lastDrive, task] = await Promise.all([
      prisma.backup.findFirst({ where: { type: 'LOCAL' }, orderBy: { id: 'desc' } }),
      prisma.backup.findFirst({ where: { type: 'DRIVE' }, orderBy: { id: 'desc' } }),
      taskSchedulerStatus(),
    ]);
    const driveReady = createDriveService().ready;
    res.json({ lastLocal, lastDrive, task, driveReady });
  } catch (err) { next(err); }
}

export async function logs(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ logDirectory: 'backend/logs (rotacion diaria, acceso restringido)' });
  } catch (err) { next(err); }
}
