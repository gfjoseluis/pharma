import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { issueInvoiceForSale } from '../invoices/service';
import { logAction } from '../../utils/logger';

async function markPaid(saleId: number, method: string, userId: number): Promise<{ sale: unknown; invoice: unknown }> {
  const sale = await prisma.sale.findUnique({ where: { id: saleId }, include: { invoice: true } });
  if (!sale) throw new Error('Venta no encontrada');
  if (sale.status !== 'ACTIVE') throw new Error('La venta no esta activa');
  if (sale.paymentStatus === 'PAID') return { sale, invoice: sale.invoice };
  if (sale.paymentStatus !== 'PENDING') throw new Error('La venta no esta pendiente de pago');

  const updated = await prisma.sale.update({ where: { id: saleId }, data: { paymentStatus: 'PAID' } });
  let invoice = null;
  if (sale.clientId) {
    invoice = await issueInvoiceForSale(saleId, sale.clientId);
  }
  logAction('info', `Pago ${method} confirmado para venta ${updated.number}`, {}, { module: 'payments', userId });
  return { sale: updated, invoice };
}

/** Simula la confirmacion bancaria de un pago con QR y marca la venta como pagada. */
export async function qrConfirm(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { saleId, reference } = req.body || {};
    if (!saleId) { res.status(400).json({ error: 'saleId es obligatorio' }); return; }
    const result = await markPaid(saleId, 'QR', req.user!.id);
    res.json({ ok: true, reference: reference || `QR-${Date.now()}`, ...result });
  } catch (err) {
    if (err instanceof Error) { res.status(400).json({ error: err.message }); return; }
    next(err);
  }
}

/** Simula la confirmacion de pago con tarjeta. */
export async function cardConfirm(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { saleId, reference } = req.body || {};
    if (!saleId) { res.status(400).json({ error: 'saleId es obligatorio' }); return; }
    const result = await markPaid(saleId, 'CARD', req.user!.id);
    res.json({ ok: true, reference: reference || `CARD-${Date.now()}`, ...result });
  } catch (err) {
    if (err instanceof Error) { res.status(400).json({ error: err.message }); return; }
    next(err);
  }
}

export async function status(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const saleId = parseInt(req.params.saleId, 10);
    const sale = await prisma.sale.findUnique({ where: { id: saleId }, select: { id: true, number: true, paymentStatus: true, status: true, total: true } });
    if (!sale) { res.status(404).json({ error: 'Venta no encontrada' }); return; }
    res.json(sale);
  } catch (err) { next(err); }
}
