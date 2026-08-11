import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { logAction } from '../../utils/logger';

// ==================== CRUD sucursales ====================
export async function list(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { users: true, stocks: true, sales: true } },
      },
    });
    res.json(branches);
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, address, phone, type } = req.body || {};
    if (!name) { res.status(400).json({ error: 'name es obligatorio' }); return; }
    const branch = await prisma.branch.create({
      data: {
        name: String(name).trim(),
        address: address || null,
        phone: phone || null,
        type: type || 'pequena',
      },
    });
    logAction('info', `Sucursal creada: ${branch.name}`, {}, { userId: req.user!.id });
    res.status(201).json(branch);
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, address, phone, type, active } = req.body || {};
    const branch = await prisma.branch.update({
      where: { id },
      data: {
        name: name !== undefined ? String(name).trim() : undefined,
        address: address !== undefined ? address : undefined,
        phone: phone !== undefined ? phone : undefined,
        type: type !== undefined ? type : undefined,
        active: active !== undefined ? Boolean(active) : undefined,
      },
    });
    res.json(branch);
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    await prisma.branch.update({ where: { id }, data: { active: false } });
    logAction('info', `Sucursal desactivada: id ${id}`, {}, { userId: req.user!.id });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ==================== Stock por sucursal ====================
export async function stock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const branchId = req.query.branchId ? parseInt(req.query.branchId as string, 10) : undefined;
    const q = String(req.query.q || '').trim();
    const rows = await prisma.stock.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(q ? { product: { OR: [{ name: { contains: q } }, { sku: { contains: q } }] } } : {}),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            form: { select: { name: true } },
            minStock: true,
            unitMeasure: { select: { shortName: true } },
          },
        },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { product: { name: 'asc' } },
      take: 500,
    });
    res.json(rows);
  } catch (err) { next(err); }
}

/** Reporte de inventario por sucursal: agregado por producto con lotes. */
export async function stockReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const branchId = req.query.branchId ? parseInt(req.query.branchId as string, 10) : undefined;
    const rows = await prisma.stock.findMany({
      where: { ...(branchId ? { branchId } : {}), quantity: { gt: 0 } },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            costPrice: true,
            minStock: true,
            form: { select: { name: true } },
            unitMeasure: { select: { shortName: true } },
          },
        },
        branch: { select: { id: true, name: true } },
      },
    });
    const map = new Map<string, { product: unknown; branch: unknown; lots: Array<{ lot: string; expiryDate: Date | null; quantity: number }>; quantity: number; value: number }>();
    for (const r of rows) {
      const key = `${r.branchId}-${r.productId}`;
      const lotKey = r.lot || 'S/LOTE';
      const entry = map.get(key) || {
        product: r.product,
        branch: r.branch,
        lots: [],
        quantity: 0,
        value: 0,
      };
      entry.quantity += r.quantity;
      entry.value += Number(r.quantity) * Number(r.product.costPrice);
      entry.lots.push({ lot: lotKey, expiryDate: r.expiryDate, quantity: r.quantity });
      map.set(key, entry);
    }
    res.json(Array.from(map.values()));
  } catch (err) { next(err); }
}

export async function movements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const branchId = req.query.branchId ? parseInt(req.query.branchId as string, 10) : undefined;
    const movements = await prisma.stockMovement.findMany({
      where: branchId ? { OR: [{ branchId }, { targetBranchId: branchId }] } : undefined,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(movements);
  } catch (err) { next(err); }
}

// ==================== Distribucion de stock a sucursales ====================
export async function distribute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { fromBranchId, toBranchId, items } = req.body || {};
    // fromBranchId es opcional: sin el, se toma el stock central (primera sucursal)
    const originId = fromBranchId || (await prisma.branch.findFirst({ where: { active: true }, orderBy: { id: 'asc' } }))?.id;
    if (!originId || !toBranchId) { res.status(400).json({ error: 'fromBranchId o toBranchId invalidos' }); return; }
    if (!Array.isArray(items) || !items.length) { res.status(400).json({ error: 'items requeridos' }); return; }

    await prisma.$transaction(async (tx) => {
      for (const it of items) {
        const productId = parseInt(it.productId, 10);
        const { quantity } = it;
        const lot = it.lot || 'S/LOTE';
        const qty = parseInt(quantity, 10);
        if (!qty || qty <= 0) throw new Error('Cantidad invalida');
        if (!productId) throw new Error('Producto invalido');
        const origin = await tx.stock.findUnique({
          where: { branchId_productId_lot: { branchId: originId, productId, lot } },
        });
        if (!origin || origin.quantity < qty) {
          throw new Error(`Stock insuficiente en origen para ${lot}`);
        }
        await tx.stock.update({ where: { id: origin.id }, data: { quantity: origin.quantity - qty } });
        const target = await tx.stock.findUnique({
          where: { branchId_productId_lot: { branchId: toBranchId, productId, lot } },
        });
        if (target) {
          await tx.stock.update({ where: { id: target.id }, data: { quantity: target.quantity + qty } });
        } else {
          await tx.stock.create({
            data: { branchId: toBranchId, productId, lot, quantity: qty, expiryDate: origin.expiryDate },
          });
        }
        await tx.stockMovement.create({
          data: {
            type: 'DISTRIBUTION',
            productId,
            branchId: originId,
            targetBranchId: toBranchId,
            quantity: qty,
            lot,
            userId: req.user!.id,
            note: 'Distribucion de stock',
          },
        });
      }
    });
    logAction('info', `Distribucion de stock a sucursal ${toBranchId}`, { items: items.length }, { userId: req.user!.id });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ==================== Transferencias entre sucursales ====================
export async function transfer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { fromBranchId, toBranchId, items } = req.body || {};
    if (!fromBranchId || !toBranchId || fromBranchId === toBranchId) {
      res.status(400).json({ error: 'Se requieren dos sucursales distintas (fromBranchId, toBranchId)' });
      return;
    }
    if (!Array.isArray(items) || !items.length) { res.status(400).json({ error: 'items requeridos' }); return; }

    await prisma.$transaction(async (tx) => {
      for (const it of items) {
        const productId = parseInt(it.productId, 10);
        const { quantity } = it;
        const lot = it.lot || 'S/LOTE';
        const qty = parseInt(quantity, 10);
        if (!qty || qty <= 0) throw new Error('Cantidad invalida');
        if (!productId) throw new Error('Producto invalido');
        const origin = await tx.stock.findUnique({
          where: { branchId_productId_lot: { branchId: fromBranchId, productId, lot } },
        });
        if (!origin || origin.quantity < qty) {
          throw new Error(`Stock insuficiente en sucursal origen (producto ${productId}, lote ${lot})`);
        }
        await tx.stock.update({ where: { id: origin.id }, data: { quantity: origin.quantity - qty } });
        const target = await tx.stock.findUnique({
          where: { branchId_productId_lot: { branchId: toBranchId, productId, lot } },
        });
        if (target) {
          await tx.stock.update({ where: { id: target.id }, data: { quantity: target.quantity + qty } });
        } else {
          await tx.stock.create({
            data: { branchId: toBranchId, productId, lot, quantity: qty, expiryDate: origin.expiryDate },
          });
        }
        await tx.stockMovement.create({
          data: {
            type: 'TRANSFER_OUT',
            productId,
            branchId: fromBranchId,
            targetBranchId: toBranchId,
            quantity: qty,
            lot,
            userId: req.user!.id,
            note: 'Transferencia entre sucursales',
          },
        });
      }
    });
    logAction('info', `Transferencia de sucursal ${fromBranchId} a ${toBranchId}`, {}, { userId: req.user!.id });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
