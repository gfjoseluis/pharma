import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { logAction } from '../../utils/logger';

const PURCHASE_INCLUDE = {
  supplier: { select: { id: true, name: true, ruc: true } },
  branch: { select: { id: true, name: true } },
  items: {
    include: {
      laboratory: { select: { id: true, name: true } },
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          form: { select: { id: true, name: true } },
          concentration: true,
          ingredients: { select: { ingredient: true, concentration: true } },
          laboratory: { select: { id: true, name: true } },
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

/** Total de compras en un rango de fechas (por defecto el mes en curso). */
export async function totals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const now = new Date();
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const agg = await prisma.purchase.aggregate({
      where: { date: { gte: from, lt: to } },
      _count: true,
      _sum: { total: true },
    });
    res.json({ from, to, count: agg._count, total: Number(agg._sum.total || 0) });
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
  productId: any;
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
      const c = parseFloat(String(it.unitCost).replace(',', '.'));
      if (!q || q <= 0 || isNaN(c) || c < 0) throw new Error('Cantidad o costo invalido en un item');
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
            create: await Promise.all(
              items.map(async (it: PurchaseItemInput) => {
                const product = await tx.product.findUnique({ where: { id: parseInt(it.productId, 10) } });
                if (!product) throw new Error(`Producto invalido: ${it.productId}`);
                return {
                  productId: product.id,
                  laboratoryId: product.laboratoryId, // snapshot del laboratorio
                  quantity: parseInt(it.quantity, 10),
                  unitCost: parseFloat(String(it.unitCost).replace(',', '.')),
                  lot: it.lot || null,
                  expiryDate: it.expiryDate ? new Date(it.expiryDate) : null,
                };
              })
            ),
          },
        },
        include: { items: true },
      });

      for (const it of p.items) {
        const lot = it.lot || 'S/LOTE';
        const existing = await tx.stock.findUnique({
          where: { branchId_productId_lot: { branchId, productId: it.productId, lot } },
        });        if (existing) {
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
      // Revertir stock
      for (const it of purchase.items) {
        const lot = it.lot || 'S/LOTE';
        const stock = await tx.stock.findUnique({
          where: { branchId_productId_lot: { branchId: purchase.branchId, productId: it.productId, lot } },
        });
        if (stock) {
          await tx.stock.update({ where: { id: stock.id }, data: { quantity: stock.quantity - it.quantity } });
        }
      }
      await tx.purchase.delete({ where: { id } });
    });
    logAction('warn', `Compra eliminada #${id}`, {}, { userId: req.user!.id });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
