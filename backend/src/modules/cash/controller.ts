import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { logAction } from '../../utils/logger';

/** Caja abierta del usuario (o null). Solo una a la vez por cajero. */
export async function openSessionFor(userId: number) {
  return prisma.cashSession.findFirst({
    where: { userId, status: 'OPEN' },
    include: {
      branch: { select: { id: true, name: true } },
      user: { select: { id: true, fullName: true } },
    },
  });
}

interface SessionTotals {
  count: number;
  salesTotal: number;
  cashTotal: number;
  otherTotal: number;
  byMethod: Record<string, { count: number; total: number }>;
}

/** Ventas ACTIVE del cajero dentro de la sesion (por sucursal de la sesion). */
export async function sessionTotals(session: { userId: number; branchId: number; openedAt: Date; closedAt: Date | null }): Promise<SessionTotals> {
  const sales = await prisma.sale.findMany({
    where: {
      userId: session.userId,
      branchId: session.branchId,
      status: 'ACTIVE',
      createdAt: {
        gte: session.openedAt,
        ...(session.closedAt ? { lte: session.closedAt } : {}),
      },
    },
    select: { total: true, paymentMethod: true },
  });
  const byMethod: Record<string, { count: number; total: number }> = {};
  let salesTotal = 0;
  let cashTotal = 0;
  for (const s of sales) {
    const t = Number(s.total);
    salesTotal += t;
    const m = s.paymentMethod || 'EFECTIVO';
    const entry = byMethod[m] || { count: 0, total: 0 };
    entry.count += 1;
    entry.total += t;
    byMethod[m] = entry;
    if (m === 'EFECTIVO') cashTotal += t;
  }
  return { count: sales.length, salesTotal, cashTotal, otherTotal: salesTotal - cashTotal, byMethod };
}

/** GET /api/cash/status - caja abierta del usuario + totales en vivo. */
export async function status(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await openSessionFor(req.user!.id);
    if (!session) {
      res.json({ open: false, session: null });
      return;
    }
    const totals = await sessionTotals(session);
    res.json({
      open: true,
      session: {
        ...session,
        openingAmount: Number(session.openingAmount),
      },
      totals,
      expectedCash: Number(session.openingAmount) + totals.cashTotal,
    });
  } catch (err) { next(err); }
}

/** POST /api/cash/open { openingAmount, note? } */
export async function open(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    if (!user.branchId) {
      res.status(400).json({ error: 'El usuario no tiene sucursal asignada' });
      return;
    }
    const openingAmount = parseFloat(req.body?.openingAmount);
    if (isNaN(openingAmount) || openingAmount < 0) {
      res.status(400).json({ error: 'Monto inicial invalido (0 o mas)' });
      return;
    }
    const existing = await openSessionFor(user.id);
    if (existing) {
      res.status(400).json({ error: `Ya tiene una caja abierta desde ${existing.openedAt.toLocaleString('es-BO')}. Ciérrela antes de aperturar otra.` });
      return;
    }
    const session = await prisma.cashSession.create({
      data: {
        branchId: user.branchId,
        userId: user.id,
        openingAmount,
        note: req.body?.note || null,
      },
    });
    logAction('info', `Caja aperturada con Bs ${openingAmount.toFixed(2)}`, {}, { module: 'cash', userId: user.id });
    res.status(201).json(session);
  } catch (err) { next(err); }
}

/** POST /api/cash/close { countedCash, note? } */
export async function close(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const countedCash = parseFloat(req.body?.countedCash);
    if (isNaN(countedCash) || countedCash < 0) {
      res.status(400).json({ error: 'Efectivo contado invalido (0 o mas)' });
      return;
    }
    const session = await openSessionFor(user.id);
    if (!session) {
      res.status(400).json({ error: 'No tiene caja abierta' });
      return;
    }
    const closedAt = new Date();
    const totals = await sessionTotals({ ...session, closedAt });
    const expectedCash = Number(session.openingAmount) + totals.cashTotal;
    const difference = countedCash - expectedCash;
    const updated = await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        status: 'CLOSED',
        closedAt,
        countedCash,
        expectedCash,
        difference,
        note: req.body?.note ?? session.note,
      },
    });
    logAction('info', `Caja cerrada. Esperado Bs ${expectedCash.toFixed(2)}, contado Bs ${countedCash.toFixed(2)}, diferencia Bs ${difference.toFixed(2)}`, {}, { module: 'cash', userId: user.id });
    res.json({
      session: {
        ...updated,
        openingAmount: Number(updated.openingAmount),
        countedCash: Number(updated.countedCash),
        expectedCash: Number(updated.expectedCash),
        difference: Number(updated.difference),
      },
      totals,
    });
  } catch (err) { next(err); }
}

/** GET /api/cash/report?date=YYYY-MM-DD&branchId= - cuadre diario por cajero. */
export async function report(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const day = String(req.query.date || new Date().toISOString().slice(0, 10));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      res.status(400).json({ error: 'Fecha invalida (use YYYY-MM-DD)' });
      return;
    }
    const from = new Date(`${day}T00:00:00`);
    const to = new Date(`${day}T00:00:00`);
    to.setDate(to.getDate() + 1);
    const branchId = req.query.branchId ? parseInt(String(req.query.branchId), 10) : undefined;

    const sessions = await prisma.cashSession.findMany({
      where: {
        openedAt: { gte: from, lt: to },
        ...(branchId ? { branchId } : {}),
        ...(user.role === 'admin' ? {} : { userId: user.id }),
      },
      include: {
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, fullName: true } },
      },
      orderBy: { openedAt: 'asc' },
    });

    const rows = await Promise.all(
      sessions.map(async (s) => {
        const closed = s.status === 'CLOSED' && s.closedAt;
        const totals = await sessionTotals(closed ? { ...s, closedAt: s.closedAt } : s);
        const expectedCash = s.expectedCash !== null
          ? Number(s.expectedCash)
          : Number(s.openingAmount) + totals.cashTotal;
        return {
          sessionId: s.id,
          cashier: s.user.fullName,
          branch: s.branch.name,
          openedAt: s.openedAt,
          closedAt: s.closedAt,
          status: s.status,
          openingAmount: Number(s.openingAmount),
          salesCount: totals.count,
          salesTotal: totals.salesTotal,
          cashTotal: totals.cashTotal,
          cardTotal: (totals.byMethod.TARJETA?.total || 0),
          qrTotal: (totals.byMethod.QR?.total || 0),
          expectedCash,
          countedCash: s.countedCash !== null ? Number(s.countedCash) : null,
          difference: s.difference !== null ? Number(s.difference) : null,
        };
      })
    );

    const totals = rows.reduce(
      (a, r) => ({
        openingAmount: a.openingAmount + r.openingAmount,
        salesCount: a.salesCount + r.salesCount,
        salesTotal: a.salesTotal + r.salesTotal,
        cashTotal: a.cashTotal + r.cashTotal,
        cardTotal: a.cardTotal + r.cardTotal,
        qrTotal: a.qrTotal + r.qrTotal,
        expectedCash: a.expectedCash + r.expectedCash,
        countedCash: a.countedCash + (r.countedCash || 0),
        difference: a.difference + (r.difference || 0),
      }),
      { openingAmount: 0, salesCount: 0, salesTotal: 0, cashTotal: 0, cardTotal: 0, qrTotal: 0, expectedCash: 0, countedCash: 0, difference: 0 }
    );

    res.json({ date: day, rows, totals });
  } catch (err) { next(err); }
}
export async function history(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const qUserId = req.query.userId ? parseInt(String(req.query.userId), 10) : undefined;
    const sessions = await prisma.cashSession.findMany({
      where: {
        ...(user.role === 'admin' && qUserId ? { userId: qUserId } : user.role === 'admin' ? {} : { userId: user.id }),
        ...(from || to ? { openedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      include: {
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, fullName: true } },
      },
      orderBy: { openedAt: 'desc' },
      take: 100,
    });
    const rows = await Promise.all(
      sessions.map(async (s) => {
        const totals = s.status === 'OPEN'
          ? await sessionTotals(s)
          : await sessionTotals({ ...s, closedAt: s.closedAt });
        return {
          ...s,
          openingAmount: Number(s.openingAmount),
          countedCash: s.countedCash !== null ? Number(s.countedCash) : null,
          expectedCash: s.expectedCash !== null ? Number(s.expectedCash) : Number(s.openingAmount) + totals.cashTotal,
          difference: s.difference !== null ? Number(s.difference) : null,
          totals,
        };
      })
    );
    res.json(rows);
  } catch (err) { next(err); }
}
