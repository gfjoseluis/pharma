import crypto from 'crypto';
import { prisma } from '../../config/prisma';

/** Numero interno secuencial por prefijo (SALE- / FAC-). */
export async function getNextInternalNumber(prefix: 'SALE' | 'FAC'): Promise<string> {
  if (prefix === 'SALE') {
    const last = await prisma.sale.findFirst({ orderBy: { id: 'desc' }, select: { number: true } });
    const n = last ? parseInt(last.number.split('-')[1], 10) || 0 : 0;
    return `V-${String(n + 1).padStart(6, '0')}`;
  }
  const last = await prisma.invoice.findFirst({ orderBy: { id: 'desc' }, select: { number: true } });
  const n = last ? parseInt(last.number.split('-')[1], 10) || 0 : 0;
  return `FAC-${String(n + 1).padStart(6, '0')}`;
}

/** Numero autorizado SIN (simulado): 8 digitos. */
export function generateSinNumber(): string {
  return String(Math.floor(10000000 + Math.random() * 89999999));
}

/** CUF (Codigo Unico de Facturacion) simulado: 44 caracteres alfanumericos. */
export function generateCuf(saleId: number, sinNumber: string): string {
  const base = `${process.env.NODE_ENV || 'dev'}${saleId}${sinNumber}${Date.now()}`;
  return crypto.createHash('sha256').update(base).digest('hex').toUpperCase().slice(0, 44);
}

/** Codigo de control simulado: 13 digitos. */
export function generateControlCode(cuf: string, total: number): string {
  const hash = crypto.createHash('sha1').update(`${cuf}-${total}`).digest('hex').toUpperCase();
  return hash.slice(0, 13);
}

export interface IssuedInvoice {
  id: number;
  number: string;
  sinNumber: string;
  cuf: string;
  controlCode: string;
  total: number;
}

/** Emite una factura SIN para una venta pagada. */
export async function issueInvoiceForSale(saleId: number, clientId: number): Promise<IssuedInvoice> {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { items: true, invoice: true },
  });
  if (!sale) throw new Error('Venta no encontrada');
  if (sale.invoice) return sale.invoice as unknown as IssuedInvoice;
  if (sale.paymentStatus !== 'PAID') throw new Error('La venta debe estar pagada para facturar');
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error('Cliente no encontrado');

  const number = await getNextInternalNumber('FAC');
  const sinNumber = generateSinNumber();
  const cuf = generateCuf(sale.id, sinNumber);
  const controlCode = generateControlCode(cuf, Number(sale.total));

  const invoice = await prisma.invoice.create({
    data: {
      number,
      sinNumber,
      cuf,
      controlCode,
      saleId: sale.id,
      clientId: client.id,
      branchId: sale.branchId,
      total: sale.total,
      status: 'ISSUED',
    },
  });
  return { id: invoice.id, number, sinNumber, cuf, controlCode, total: Number(invoice.total) };
}

export async function annulInvoice(invoiceId: number, reason: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error('Factura no encontrada');
  if (invoice.status === 'ANNULLED') return;
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'ANNULLED', annulledAt: new Date(), reason },
  });
}

/** HTML imprimible de la factura (formato A4 / ticket). */
export async function printInvoiceHtml(invoiceId: number): Promise<string> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      client: true,
      branch: true,
      sale: { include: { items: { include: { product: { select: { name: true, sku: true, presentation: true } } } }, user: { select: { fullName: true } } } },
    },
  });
  if (!invoice) throw new Error('Factura no encontrada');
  const sale = invoice.sale!;
  const rows = sale.items
    .map(
      (it) => `
      <tr>
        <td>${it.product.sku}</td>
        <td>${it.product.name}</td>
        <td>${it.quantity}</td>
        <td>${Number(it.price).toFixed(2)}</td>
        <td>${Number(it.subtotal).toFixed(2)}</td>
      </tr>`
    )
    .join('');
  const statusLabel = invoice.status === 'ISSUED' ? 'EMITIDA' : invoice.status === 'ANNULLED' ? 'ANULADA' : 'RECHAZADA';
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Factura ${invoice.number}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .head { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 12px; }
  .sin { font-size: 12px; color: #444; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
  th { background: #eee; }
  .tot { margin-top: 16px; text-align: right; font-size: 15px; }
  .annulled { color: #c00; font-weight: bold; font-size: 26px; text-align: center; border: 3px solid #c00; padding: 6px; margin: 18px 0; }
  @media print { .no-print { display: none; } }
</style></head>
<body>
  <button class="no-print" onclick="window.print()">Imprimir</button>
  ${invoice.status === 'ANNULLED' ? '<div class="annulled">FACTURA ANULADA</div>' : ''}
  <div class="head">
    <div>
      <h1>${invoice.branch.name}</h1>
      <div class="sin">FACTURA ${invoice.number} — ${invoice.sinNumber}</div>
      <div class="sin">CUF: ${invoice.cuf}</div>
      <div class="sin">Codigo de control: ${invoice.controlCode}</div>
      <div class="sin">Estado: ${statusLabel}</div>
    </div>
    <div style="text-align:right">
      <div>Fecha: ${invoice.issuedAt.toLocaleString()}</div>
      <div>Punto de emision: ${invoice.branch.name}</div>
      <div>NIT: 000000000000</div>
    </div>
  </div>
  <div style="margin-top:12px">
    <div><b>Cliente:</b> ${invoice.client?.name || 'MOSTRADOR'}</div>
    <div><b>CI/NIT:</b> ${invoice.client?.ciNit || '-'}</div>
  </div>
  <table>
    <thead><tr><th>SKU</th><th>Producto</th><th>Cant.</th><th>P.Unit</th><th>Subtotal</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="tot"><b>TOTAL Bs: ${Number(invoice.total).toFixed(2)}</b></div>
  <div class="sin" style="margin-top:16px">Este documento fue generado por FarmaciaPOS. Venta: ${sale.number} — Cajero: ${sale.user.fullName}</div>
</body></html>`;
}
