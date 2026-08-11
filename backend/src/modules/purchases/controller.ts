import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { logAction } from '../../utils/logger';

const PURCHASE_INCLUDE = {
  supplier: { select: { id: true, name: true, ruc: true } },
  branch: { select: { id: true, name: true } },
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          unitMeasure: { select: { name: true, shortName: true } },
        },
      },
    },
  },
};

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const purchases = await prisma.purchase.findMany({
      where: {
        ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      include: PURCHASE_INCLUDE,
      orderBy: { date: 'desc' },
      take: 200,
    });
    res.json(purchases);
  } catch (err) { next(err); }
}

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const purchase = await prisma.purchase.findUnique({ where: { id }, include: PURCHASE_INCLUDE });
    if (!purchase) { res.status(404).json({ error: 'Compra no encontrada' }); return; }
    res.json(purchase);
  } catch (err) { next(err); }
}

interface PurchaseItemInput {
  productId: number;
  quantity: any;
  unitCost: any;
  lot?: string;
  expiryDate?: string;
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { supplierId, branchId, invoiceNumber, date, items } = req.body || {};
    if (!branchId) { res.status(400).json({ error: 'branchId (sucursal destino) es obligatorio' }); return; }
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Debe incluir al menos un item (productId, quantity, unitCost)' });
      return;
    }
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) { res.status(404).json({ error: 'Sucursal no encontrada' }); return; }

    const total = items.reduce((acc: number, it: PurchaseItemInput) => {
      const q = parseInt(it.quantity, 10);
      const c = parseFloat(it.unitCost);
      if (!q || q <= 0 || isNaN(c)) throw new Error('Cantidad o costo invalido en un item');
      return acc + q * c;
    }, 0);

    const purchase = await prisma.$transaction(async (tx) => {
      const p = await tx.purchase.create({
        data: {
          supplierId: supplierId || null,
          branchId,
          invoiceNumber: invoiceNumber || null,
          date: date ? new Date(date) : new Date(),
          total,
          items: {
            create: items.map((it: PurchaseItemInput) => ({
              productId: it.productId,
              quantity: parseInt(it.quantity, 10),
              unitCost: parseFloat(it.unitCost),
              lot: it.lot || null,
              expiryDate: it.expiryDate ? new Date(it.expiryDate) : null,
            })),
          },
        },
        include: { items: true },
      });

      for (const it of p.items) {
        const lot = it.lot || 'S/LOTE';
        const existing = await tx.stock.findUnique({
          where: { branchId_productId_lot: { branchId, productId: it.productId, lot } },
        });
        if (existing) {
          await tx.stock.update({
            where: { id: existing.id },
            data: {
              quantity: existing.quantity + it.quantity,
              ...(it.expiryDate ? { expiryDate: it.expiryDate } : {}),
            },
          });
        } else {
          await tx.stock.create({
            data: { branchId, productId: it.productId, lot, quantity: it.quantity, expiryDate: it.expiryDate },
          });
        }
        await tx.stockMovement.create({
          data: {
            type: 'PURCHASE',
            productId: it.productId,
            branchId,
            quantity: it.quantity,
            lot,
            userId: req.user!.id,
            note: `Compra #${p.id}`,
          },
        });
      }
      return p;
    });

    logAction('info', `Compra registrada #${purchase.id}`, { total, items: items.length }, { userId: req.user!.id });
    res.status(201).json(purchase);
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const purchase = await prisma.purchase.findUnique({ where: { id }, include: { items: true } });
    if (!purchase) { res.status(404).json({ error: 'Compra no encontrada' }); return; }

    await prisma.$transaction(async (tx) => {
      // Revertir stock (solo si no fue descargada al SIN)
      if (purchase.status !== 'SIN_DESCARGADO') {
        for (const it of purchase.items) {
          const lot = it.lot || 'S/LOTE';
          const stock = await tx.stock.findUnique({
            where: { branchId_productId_lot: { branchId: purchase.branchId, productId: it.productId, lot } },
          });
          if (stock) {
            await tx.stock.update({ where: { id: stock.id }, data: { quantity: stock.quantity - it.quantity } });
          }
        }
      }
      await tx.purchase.delete({ where: { id } });
    });
    logAction('warn', `Compra eliminada #${id}`, {}, { userId: req.user!.id });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

/** Descargo al SIN: las compras con factura se marcan como descargadas (obligacion tributaria). */
export async function discharge(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const purchase = await prisma.purchase.findUnique({ where: { id } });
    if (!purchase) { res.status(404).json({ error: 'Compra no encontrada' }); return; }
    if (!purchase.invoiceNumber) {
      res.status(400).json({ error: 'La compra debe tener numero de factura para descargarse al SIN' });
      return;
    }
    const updated = await prisma.purchase.update({ where: { id }, data: { status: 'SIN_DESCARGADO' } });
    logAction('info', `Compra #${id} descargada al SIN`, { invoiceNumber: purchase.invoiceNumber }, { userId: req.user!.id });
    res.json(updated);
  } catch (err) { next(err); }
}
