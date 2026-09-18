import { Request } from 'express';

/** Paginacion estandar: ?page=1&pageSize=20 (pageSize max 100). */
export function getPagination(req: Request, def = 20, max = 100): { page: number; pageSize: number; skip: number } {
  const rawPage = parseInt(String(req.query.page ?? '1'), 10);
  const rawSize = parseInt(String(req.query.pageSize ?? String(def)), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = Number.isFinite(rawSize) && rawSize > 0 ? Math.min(rawSize, max) : def;
  return { page, pageSize, skip: (page - 1) * pageSize };
}

/** Respuesta estandar de listado: { data, total, page, pageSize }. */
export function paged<T>(data: T[], total: number, page: number, pageSize: number): { data: T[]; total: number; page: number; pageSize: number } {
  return { data, total, page, pageSize };
}
