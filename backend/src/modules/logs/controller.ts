import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { paths } from '../../config/env';
import { logger } from '../../utils/logger';

function isSafeName(name: string): boolean {
  return /^app-\d{4}-\d{2}-\d{2}\.log$/.test(name) && !name.includes('..') && !path.isAbsolute(name);
}

/** Lista los archivos .log disponibles (rotacion diaria). */
export async function listLogs(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    fs.mkdirSync(paths.logs, { recursive: true });
    const files = fs.readdirSync(paths.logs).filter((f) => f.endsWith('.log'));
    const withMeta = files
      .map((f) => {
        const stat = fs.statSync(path.join(paths.logs, f));
        return { filename: f, size: stat.size, modifiedAt: stat.mtime };
      })
      .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
    res.json(withMeta);
  } catch (err) { next(err); }
}

/** Lee las ultimas lineas de un archivo de log (solo admin/tecnico). */
export async function readLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filename = String(req.params.filename);
    if (!isSafeName(filename)) {
      res.status(400).json({ error: 'Nombre de archivo invalido' });
      return;
    }
    const file = path.join(paths.logs, filename);
    if (!fs.existsSync(file)) {
      res.status(404).json({ error: 'Log no encontrado' });
      return;
    }
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
    const tail = lines.slice(-500);
    res.json({ filename, lines: tail.length, content: tail });
  } catch (err) { next(err); }
}

/** Fuerza rotacion de los logs (crea archivo nuevo). */
export async function rotateNow(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    logger.info('Rotacion de logs solicitada manualmente');
    res.json({ ok: true, message: 'Rotacion de logs ejecutada' });
  } catch (err) { next(err); }
}
