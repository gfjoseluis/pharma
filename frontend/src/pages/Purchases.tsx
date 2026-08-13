import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errMsg } from '../api/client';
import { Card, Table, Button, Modal, Spinner, Alert, fmtMoney, fmtDate, Badge } from '../components/ui';
import { useAuth } from '../context/AuthContext';

interface Branch { id: number; name: string; }
interface Supplier { id: number; name: string; ruc: string | null; }

interface PurchaseItem {
  id: number;
  quantity: number;
  unitCost: string;
  lot: string | null;
  expiryDate: string | null;
  laboratory: { id: number; name: string } | null;
  product: {
    id: number;
    name: string;
    sku: string;
    form: { id: number; name: string } | null;
    concentration: string | null;
    ingredients: Array<{ ingredient: string; concentration: string | null }>;
    laboratory: { id: number; name: string } | null;
    unitMeasure: { name: string; shortName: string | null } | null;
  };
}

interface Purchase {
  id: number;
  invoiceNumber: string | null;
  date: string;
  total: string;
  supplier: Supplier | null;
  branch: Branch;
  items: PurchaseItem[];
}

export default function Purchases() {
  const { hasPerm } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Purchase[]>([]);
  const [detail, setDetail] = useState<Purchase | null>(null);
  const [monthTotal, setMonthTotal] = useState<{ count: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/purchases').then((r) => setRows(r.data)).catch((e) => setError(errMsg(e))).finally(() => setLoading(false));
    api.get('/purchases/totals').then((r) => setMonthTotal(r.data)).catch(() => {});
  };

  useEffect(load, []);

  const remove = async (p: Purchase) => {
    if (!window.confirm(`¿Eliminar la compra #${p.id}? Se revierte el stock.`)) return;
    try { await api.delete(`/purchases/${p.id}`); load(); }
    catch (e) { setError(errMsg(e)); }
  };

  if (loading && !rows.length) return <Spinner />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2>Compras (registro centralizado)</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={load}>Actualizar</Button>
          {hasPerm('purchases.create') && <Button onClick={() => navigate('/purchases/new')}>+ Nueva compra (vista completa)</Button>}
        </div>
      </div>
      <Alert type="error">{error}</Alert>

      <div className="kpi-row" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="k-label">Compras del mes (total invertido)</div>
          <div className="k-value">{fmtMoney(monthTotal?.total || 0)}</div>
        </div>
        <div className="kpi">
          <div className="k-label">Compras este mes</div>
          <div className="k-value">{monthTotal?.count ?? 0}</div>
        </div>
        <div className="kpi">
          <div className="k-label">Compras registradas (lista)</div>
          <div className="k-value">{rows.length}</div>
        </div>
      </div>

      <Card>
        <Table head={['#', 'Fecha', 'Proveedor', 'Factura', 'Sucursal destino', 'Items', 'Total', 'Acciones']}>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>#{p.id}</td>
              <td>{fmtDate(p.date)}</td>
              <td>{p.supplier?.name || '-'}</td>
              <td>{p.invoiceNumber || '-'}</td>
              <td>{p.branch.name}</td>
              <td>{p.items.length}</td>
              <td><b>{fmtMoney(p.total)}</b></td>
              <td>
                <Button variant="secondary" className="btn-sm" onClick={() => setDetail(p)}>Detalle</Button>{' '}
                {hasPerm('purchases.delete') && <Button variant="danger" className="btn-sm" onClick={() => remove(p)}>Eliminar</Button>}
              </td>
            </tr>
          ))}
        </Table>
        {!rows.length && <div className="empty">Sin compras registradas</div>}
      </Card>

      {/* Detalle de compra */}
      <Modal title={`Detalle de compra #${detail?.id || ''}`} open={!!detail} onClose={() => setDetail(null)} footer={<Button onClick={() => setDetail(null)}>Cerrar</Button>}>
        {detail && (
          <>
            <div className="grid grid-2">
              <div className="kpi"><div className="k-label">Proveedor</div><div className="k-value" style={{ fontSize: 15 }}>{detail.supplier?.name || '-'}</div></div>
              <div className="kpi"><div className="k-label">Factura / Fecha</div><div className="k-value" style={{ fontSize: 15 }}>{detail.invoiceNumber || '-'} · {fmtDate(detail.date)}</div></div>
              <div className="kpi"><div className="k-label">Sucursal</div><div className="k-value" style={{ fontSize: 15 }}>{detail.branch.name}</div></div>
              <div className="kpi"><div className="k-label">Total</div><div className="k-value" style={{ fontSize: 15 }}>{fmtMoney(detail.total)}</div></div>
            </div>
            <Table head={['Producto', 'Laboratorio', 'Lote', 'Vence', 'Cant.', 'Costo unit.', 'Subtotal']}>
              {detail.items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <b>{it.product.name}</b>
                    <div className="p-meta">
                      {it.product.form?.name || ''}{it.product.form ? ' · ' : ''}
                      {it.product.ingredients.length
                        ? it.product.ingredients.map((i) => `${i.ingredient}${i.concentration ? ` ${i.concentration}` : ''}`).join(' + ')
                        : it.product.concentration || ''}
                    </div>
                  </td>
                  <td><Badge color="blue">{it.laboratory?.name || it.product.laboratory?.name || '-'}</Badge></td>
                  <td>{it.lot || '-'}</td>
                  <td>{it.expiryDate ? fmtDate(it.expiryDate) : <span className="badge badge-gray">Sin vencimiento</span>}</td>
                  <td>{it.quantity}</td>
                  <td>{fmtMoney(it.unitCost)}</td>
                  <td>{fmtMoney(Number(it.quantity) * Number(it.unitCost))}</td>
                </tr>
              ))}
            </Table>
          </>
        )}
      </Modal>
    </div>
  );
}