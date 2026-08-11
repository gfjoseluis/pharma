import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';

/** Reporte de ventas y ganancias diario/semanal/mensual. */
export async function salesReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const range = String(req.query.range || 'weekly'); // daily | weekly | monthly | custom
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const branchId = req.query.branchId ? parseInt(req.query.branchId as string, 10) : undefined;

    const now = new Date();
    let start: Date;
    switch (range) {
      case 'daily': start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
      case 'weekly': start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6); break;
      case 'monthly': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'custom': start = from || new Date(now.getFullYear(), now.getMonth(), 1); break;
      default: start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    }
    const end = to || new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const sales = await prisma.sale.findMany({
      where: {
        status: 'ACTIVE',
        createdAt: { gte: start, lt: end },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        items: { include: { product: { select: { costPrice: true } } } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Agregado por dia (para graficos)
    const byDay = new Map<string, { date: string; total: number; count: number; profit: number }>();
    let totalSales = 0;
    let totalProfit = 0;
    let totalCount = 0;
    for (const s of sales) {
      const dayKey = s.createdAt.toISOString().slice(0, 10);
      const cost = s.items.reduce((a, i) => a + Number(i.quantity) * Number(i.product.costPrice || 0), 0);
      const profit = Number(s.total) - cost;
      const entry = byDay.get(dayKey) || { date: dayKey, total: 0, count: 0, profit: 0 };
      entry.total += Number(s.total);
      entry.count += 1;
      entry.profit += profit;
      byDay.set(dayKey, entry);
      totalSales += Number(s.total);
      totalProfit += profit;
      totalCount += 1;
    }

    const byBranch = new Map<string, { name: string; total: number; count: number }>();
    for (const s of sales) {
      const key = String(s.branchId);
      const entry = byBranch.get(key) || { name: s.branch.name, total: 0, count: 0 };
      entry.total += Number(s.total);
      entry.count += 1;
      byBranch.set(key, entry);
    }

    res.json({
      range,
      from: start,
      to: end,
      totals: { totalSales, totalProfit, totalCount },
      byDay: Array.from(byDay.values()),
      byBranch: Array.from(byBranch.values()),
    });
  } catch (err) { next(err); }
}

/** Reporte de inventario: mas vendidos, stock bajo, lotes por vencer. */
export async function inventoryReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const days = Math.min(parseInt(String(req.query.days || '90'), 10), 365);
    const from = new Date(Date.now() - days * 86400000);

    // Mas vendidos
    const topItems = await prisma.saleItem.findMany({
      where: { sale: { status: 'ACTIVE', createdAt: { gte: from } } },
      include: { product: { select: { id: true, name: true, sku: true, price: true } } },
    });
    interface BestSellerEntry {
      product: { id: number; name: string; sku: string; price: number };
      qty: number;
      total: number;
    }
    const topMap = new Map<number, BestSellerEntry>();
    for (const it of topItems) {
      const key = it.productId;
      const entry = topMap.get(key) || {
        product: { id: it.product.id, name: it.product.name, sku: it.product.sku, price: Number(it.product.price) },
        qty: 0,
        total: 0,
      };
      entry.qty += it.quantity;
      entry.total += Number(it.subtotal);
      topMap.set(key, entry);
    }
    const bestSellers = Array.from(topMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 20);

    // Stock bajo
    const stocks = await prisma.stock.findMany({
      where: { quantity: { gt: 0 } },
      include: {
        product: { select: { id: true, name: true, sku: true, minStock: true, form: { select: { name: true } }, unitMeasure: { select: { shortName: true } } } },
        branch: { select: { id: true, name: true } },
      },
    });
    const stockMap = new Map<number, { product: { id: number; name: string; sku: string; minStock: number; form: string | null; unit: string | null }; total: number; branches: string[] }>();
    for (const s of stocks) {
      const key = s.productId;
      const entry = stockMap.get(key) || {
        product: {
          id: s.product.id,
          name: s.product.name,
          sku: s.product.sku,
          minStock: s.product.minStock,
          form: s.product.form?.name || null,
          unit: s.product.unitMeasure?.shortName || null,
        },
        total: 0,
        branches: [],
      };
      entry.total += s.quantity;
      if (!entry.branches.includes(s.branch.name)) entry.branches.push(s.branch.name);
      stockMap.set(key, entry);
    }
    const lowStock = Array.from(stockMap.values())
      .filter((e) => e.total <= e.product.minStock)
      .sort((a, b) => a.total - b.total);

    // Lotes por vencer (60 dias) o vencidos
    const expiringSoon = await prisma.stock.findMany({
      where: { quantity: { gt: 0 }, expiryDate: { lte: new Date(Date.now() + 60 * 86400000) } },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { expiryDate: 'asc' },
      take: 100,
    });

    res.json({
      bestSellers,
      lowStock: lowStock.slice(0, 50),
      expiring: expiringSoon.map((s) => ({
        product: s.product,
        branch: s.branch,
        lot: s.lot,
        quantity: s.quantity,
        expiryDate: s.expiryDate,
        expired: s.expiryDate && s.expiryDate < new Date(),
      })),
    });
  } catch (err) { next(err); }
}

export async function sinReport(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // El modulo de facturacion electronica (SIN) fue eliminado por requerimiento.
    res.json({
      module: 'SIN',
      enabled: false,
      note: 'Modulo de facturacion electronica eliminado del sistema',
    });
  } catch (err) { next(err); }
}

/** Exporta CSV (base para PDF/Excel desde el frontend). */
export async function exportCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const type = String(req.query.type || 'sales'); // sales | inventory
    if (type === 'inventory') {
      const rows = await prisma.stock.findMany({
        where: { quantity: { gt: 0 } },
        include: { product: { select: { sku: true, name: true } }, branch: { select: { name: true } } },
      });
      const csv = [
        ['Sucursal', 'SKU', 'Producto', 'Lote', 'Vencimiento', 'Cantidad'].join(','),
        ...rows.map((r) => [r.branch.name, r.product.sku, `"${r.product.name}"`, r.lot || 'S/LOTE', r.expiryDate ? r.expiryDate.toISOString().slice(0, 10) : '', r.quantity].join(',')),
      ].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="inventario.csv"');
      res.send('\uFEFF' + csv);
      return;
    }
    const sales = await prisma.sale.findMany({
      where: { status: 'ACTIVE' },
      include: { client: { select: { name: true, ciNit: true } }, branch: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    const csv = [
      ['Fecha', 'Sucursal', 'Numero', 'Cliente', 'CI/NIT', 'Tipo', 'Estado', 'Total'].join(','),
      ...sales.map((s) => [s.createdAt.toISOString(), s.branch.name, s.number, `"${s.client?.name || 'MOSTRADOR'}"`, s.client?.ciNit || '', s.type, s.status, Number(s.total)].join(',')),
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ventas.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) { next(err); }
}
