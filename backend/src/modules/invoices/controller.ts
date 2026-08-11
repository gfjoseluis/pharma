import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { issueInvoiceForSale, annulInvoice, printInvoiceHtml, getNextInternalNumber } from './service';
import { logAction } from '../../utils/logger';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const invoices = await prisma.invoice.findMany({
      where: {
        ...(from || to ? { issuedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        client: { select: { id: true, name: true, ciNit: true } },
        branch: { select: { id: true, name: true } },
        sale: { select: { id: true, number: true } },
      },
      orderBy: { issuedAt: 'desc' },
      take: 200,
    });
    res.json(invoices);
  } catch (err) { next(err); }
}

/** Emite factura manualmente para una venta pagada (POST /api/invoices { saleId, clientId }). */
export async function issue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { saleId, clientId } = req.body || {};
    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) { res.status(404).json({ error: 'Venta no encontrada' }); return; }
    if (sale.paymentStatus !== 'PAID') {
      res.status(400).json({ error: 'La venta debe estar pagada para emitir factura' });
      return;
    }
    const cid = clientId || sale.clientId;
    if (!cid) { res.status(400).json({ error: 'La venta no tiene cliente' }); return; }
    const invoice = await issueInvoiceForSale(saleId, cid);
    logAction('info', `Factura ${invoice.number} emitida para venta ${sale.number}`, {}, { module: 'invoices', userId: req.user!.id });
    res.status(201).json(invoice);
  } catch (err) {
    if (err instanceof Error) { res.status(400).json({ error: err.message }); return; }
    next(err);
  }
}

export async function annul(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const reason = String(req.body?.reason || 'Anulacion solicitada por el usuario').slice(0, 200);
    await annulInvoice(id, reason);
    logAction('warn', `Factura ${id} anulada`, { reason }, { module: 'invoices', userId: req.user!.id });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof Error) { res.status(400).json({ error: err.message }); return; }
    next(err);
  }
}

export async function print(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const html = await printInvoiceHtml(id);
    res.type('html').send(html);
  } catch (err) {
    if (err instanceof Error) { res.status(400).json({ error: err.message }); return; }
    next(err);
  }
}

/** Descargo mensual al SIN: resumen de facturas emitidas/anuladas del periodo. */
export async function descargo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const year = parseInt(String(req.query.year || new Date().getFullYear()), 10);
    const month = parseInt(String(req.query.month || new Date().getMonth() + 1), 10);
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);
    const invoices = await prisma.invoice.findMany({
      where: { issuedAt: { gte: from, lt: to } },
      include: { client: { select: { name: true, ciNit: true } }, sale: { select: { number: true } } },
    });
    const issued = invoices.filter((i) => i.status === 'ISSUED');
    const annulled = invoices.filter((i) => i.status === 'ANNULLED');
    const rejected = invoices.filter((i) => i.status === 'REJECTED');
    const resumen = {
      period: `${year}-${String(month).padStart(2, '0')}`,
      emitted: issued.length,
      annulled: annulled.length,
      rejected: rejected.length,
      totalEmitted: issued.reduce((a, i) => a + Number(i.total), 0),
      totalAnnulled: annulled.reduce((a, i) => a + Number(i.total), 0),
      detail: invoices.map((i) => ({
        number: i.number,
        sinNumber: i.sinNumber,
        cuf: i.cuf,
        client: i.client?.name,
        ciNit: i.client?.ciNit,
        total: Number(i.total),
        status: i.status,
        date: i.issuedAt,
      })),
    };
    res.json(resumen);
  } catch (err) { next(err); }
}

export async function report(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const invoices = await prisma.invoice.findMany({
      where: { ...(from || to ? { issuedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
      orderBy: { issuedAt: 'desc' },
      take: 500,
    });
    const byStatus = (s: string) => invoices.filter((i) => i.status === s);
    res.json({
      emitted: byStatus('ISSUED').length,
      annulled: byStatus('ANNULLED').length,
      rejected: byStatus('REJECTED').length,
      totalEmitted: byStatus('ISSUED').reduce((a, i) => a + Number(i.total), 0),
    });
  } catch (err) { next(err); }
}
