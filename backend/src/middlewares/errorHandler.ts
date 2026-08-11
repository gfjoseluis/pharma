import { Request, Response, NextFunction } from 'express';
import { logAction } from '../utils/logger';

export function notFound(req: Request, res: Response): void {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const message = err instanceof Error ? err.message : 'Error desconocido';
  logAction('error', 'Error no controlado', { message, url: req.originalUrl, method: req.method });
  res.status(500).json({ error: message });
}
