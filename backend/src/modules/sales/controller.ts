import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { issueInvoiceForSale, annulInvoice, getNextInternalNumber } from '../invoices/service';
import { logAction } from '../../utils/logger';

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { type, clientId, items, withInvoice, note } = req.body || {};
    const user = req.user!;
    if (!user.branchId) {
      res.status(400).json({ error: 'El usuario no tiene sucursal asignada' });
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'La venta debe incluir al menos un producto' });
      return;
    }
    const saleType = String(type || 'SIMPLE').toUpperCase();
    if (!['SIMPLE', 'QR', 'CARD'].includes(saleType)) {
      res.status(400).json({ error: 'Tipo de venta invalido (SIMPLE | QR | CARD)' });
      return;
    }
    const branch = await prisma.branch.findUnique({ where: { id: user.branchId } });
    if (!branch) {
      res.status(400).json({ error: 'Sucursal no encontrada' });
      return;
    }
    // Venta con QR/tarjeta solo en sucursales medianas o grandes
    if ((saleType === 'QR' || saleType === 'CARD') && branch.type === 'pequena') {
      res.status(400).json({ error: 'Las ventas con QR/tarjeta solo estan habilitadas en sucursales medianas o grandes' });
      return;
    }

    let client = null;
    if (clientId) {
      client = await prisma.client.findUnique({ where: { id: clientId } });
    }
    if (!client && (withInvoice || saleType !== 'SIMPLE')) {
      res.status(400).json({ error: 'Seleccione un cliente (con CI/NIT) o registrelo para facturar' });
      return;
    }
    if (withInvoice && !client) {
      res.status(400).json({ error: 'Seleccione un cliente para emitir factura' });
      return;
    }

    const number = await getNextInternalNumber('SALE');
    const sale = await prisma.$transaction(async (tx) => {
      const itemsWithPrices: Array<{ productId: number; quantity: number; price: number; subtotal: number; name: string; sku: string }> = [];
      for (const it of items) {
        const product = await tx.product.findUnique({ where: { id: it.productId } });
        if (!product || !product.active) throw new Error(`Producto invalido: ${it.productId}`);
        const qty = parseInt(it.quantity, 10);
        if (!qty || qty <= 0) throw new Error(`Cantidad invalida para ${product.name}`);
        const price = it.price !== undefined ? parseFloat(it.price) : Number(product.price);
        // Solo se vende stock de la sucursal propia
        const ownStocks = await tx.stock.findMany({
          where: { branchId: user.branchId!, productId: product.id, quantity: { gt: 0 } },
          orderBy: [{ expiryDate: 'asc' }, { lot: 'asc' }],
        });
        const available = ownStocks.reduce((a, s) => a + s.quantity, 0);
        if (available < qty) {
          throw new Error(`Stock insuficiente de ${product.name} en su sucursal (disponible: ${available})`);
        }
        let remaining = qty;
        for (const st of ownStocks) {
          if (remaining <= 0) break;
          const take = Math.min(st.quantity, remaining);
          await tx.stock.update({ where: { id: st.id }, data: { quantity: st.quantity - take } });
          await tx.stockMovement.create({
            data: {
              type: 'SALE',
              productId: product.id,
              branchId: user.branchId!,
              quantity: -take,
              lot: st.lot,
              userId: user.id,
              note: `Venta ${number}`,
            },
          });
          remaining -= take;
        }
        itemsWithPrices.push({ productId: product.id, quantity: qty, price, subtotal: qty * price, name: product.name, sku: product.sku });
      }
      const total = itemsWithPrices.reduce((a, i) => a + i.subtotal, 0);
      const created = await tx.sale.create({
        data: {
          number,
          branchId: user.branchId!,
          userId: user.id,
          clientId: client ? client.id : null,
          type: saleType,
          paymentStatus: saleType === 'SIMPLE' ? 'PAID' : 'PENDING',
          total,
          note: note || null,
          items: { create: itemsWithPrices.map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.price, subtotal: i.subtotal })) },
        },
        include: { items: { include: { product: { select: { name: true, sku: true } } } } },
      });
      return { created, itemsWithPrices };
    });

    let invoice = null;
    let qrDataUrl: string | null = null;
    if (saleType === 'QR') {
      const QRCode = await import('qrcode');
      const payload = JSON.stringify({
        m: 'PAGO-QR',
        s: sale.created.number,
        t: Number(sale.created.total),
        b: 'FARMACIA-PAGO',
        r: `QR-${sale.created.number}`,
      });
      qrDataUrl = await QRCode.toDataURL(payload, { width: 220, margin: 1 });
    }
    if (sale.created.paymentStatus === 'PAID' && withInvoice && client) {
      invoice = await issueInvoiceForSale(sale.created.id, client.id);
    }

    logAction('info', `Venta ${sale.created.number} registrada`, {
      total: Number(sale.created.total), type: saleType, client: client ? client.ciNit : 'mostrador',
    }, { module: 'sales', userId: user.id });
    res.status(201).json({ sale: sale.created, invoice, qrCode: qrDataUrl, paymentPending: sale.created.paymentStatus === 'PENDING' });
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
}

export async function recent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
    const sales = await prisma.sale.findMany({
      include: {
        client: { select: { id: true, name: true, ciNit: true } },
        user: { select: { id: true, fullName: true } },
        branch: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        invoice: { select: { id: true, number: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json(sales);
  } catch (err) { next(err); }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const sales = await prisma.sale.findMany({
      where: {
        ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      include: {
        client: { select: { id: true, name: true, ciNit: true } },
        user: { select: { fullName: true } },
        branch: { select: { name: true } },
        items: { include: { product: { select: { name: true, sku: true } } } },
        invoice: { select: { id: true, number: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    res.json(sales);
  } catch (err) { next(err); }
}

/** Editar venta (solo registros no criticos: sin factura y del dia, no pagadas vía banco). */
export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const { note, items } = req.body || {};
    const sale = await prisma.sale.findUnique({ where: { id }, include: { invoice: true } });
    if (!sale) { res.status(404).json({ error: 'Venta no encontrada' }); return; }
    if (sale.invoice) {
      res.status(400).json({ error: 'No se puede editar una venta facturada; solo anular' });
      return;
    }
    if (sale.type !== 'SIMPLE' && sale.paymentStatus !== 'PENDING') {
      res.status(400).json({ error: 'Solo se pueden editar ventas en estado pendiente o simples' });
      return;
    }

    const updated = await prisma.sale.update({
      where: { id },
      data: { note: note !== undefined ? note : undefined },
    });
    logAction('info', `Venta ${sale.number} editada`, {}, { module: 'sales', userId: req.user!.id });
    res.json(updated);
  } catch (err) { next(err); }
}

/** Desactivar (soft delete). */
export async function deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    await prisma.sale.update({ where: { id }, data: { status: 'DELETED' } });
    logAction('warn', `Venta ${id} desactivada (soft delete)`, {}, { module: 'sales', userId: req.user!.id });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

/** Anular venta (con factura asociada). */
export async function annul(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const sale = await prisma.sale.findUnique({ where: { id }, include: { items: true, invoice: true } });
    if (!sale) { res.status(404).json({ error: 'Venta no encontrada' }); return; }
    if (sale.status !== 'ACTIVE') { res.status(400).json({ error: 'La venta ya no esta activa' }); return; }

    const result = await prisma.$transaction(async (tx) => {
      // Devolver stock
      for (const it of sale.items) {
        const lots = await tx.stock.findMany({
          where: { branchId: sale.branchId, productId: it.productId },
          orderBy: { lot: 'asc' },
        });
        let remaining = it.quantity;
        for (const st of lots) {
          if (remaining <= 0) break;
          await tx.stock.update({ where: { id: st.id }, data: { quantity: st.quantity + remaining } });
          remaining = 0;
        }
        await tx.stockMovement.create({
          data: {
            type: 'ADJUSTMENT',
            productId: it.productId,
            branchId: sale.branchId,
            quantity: it.quantity,
            userId: req.user!.id,
            note: `Anulacion de venta ${sale.number}`,
          },
        });
      }
      await tx.sale.update({ where: { id }, data: { status: 'ANNULLED' } });
      if (sale.invoice) {
        await annulInvoice(sale.invoice.id, 'Venta anulada');
      }
      return sale;
    });
    logAction('warn', `Venta ${sale.number} anulada`, {}, { module: 'sales', userId: req.user!.id });
    res.json({ ok: true, sale: result });
  } catch (err) {
    if (err instanceof Error) { res.status(400).json({ error: err.message }); return; }
    next(err);
  }
}
