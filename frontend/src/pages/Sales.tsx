import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import { Card, Table, Button, Badge, fmtMoney, fmtDate, Spinner, Alert, Modal, Field, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';

interface SaleRow {
  id: number;
  number: string;
  type: string;
  paymentStatus: string;
  paymentMethod: string;
  status: string;
  total: number;
  createdAt: string;
  client: { id: number; name: string; ciNit: string } | null;
  user: { fullName: string };
  branch: { name: string };
  items: Array<{
    product: {
      id: number;
      name: string;
      sku: string;
      concentration: string | null;
      form: { id: number; name: string } | null;
      ingredients: Array<{ ingredient: string; concentration: string | null }>;
      laboratory: { id: number; name: string } | null;
    };
    quantity: number;
    price: number;
  }>;
}

const METHOD_LABEL: Record<string, string> = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', QR: 'QR' };

type Period = 'day' | 'week' | 'month';

function periodFrom(p: Period): Date {
  const now = new Date();
  if (p === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (p === 'week') return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export default function Sales() {
  const { hasPerm } = useAuth();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('day');
  const [annulSale, setAnnulSale] = useState<SaleRow | null>(null);
  const [annulReason, setAnnulReason] = useState('');
  const [detail, setDetail] = useState<SaleRow | null>(null);

  const load = (p: Period = period) => {
    setPeriod(p);
    setLoading(true);
    const from = periodFrom(p);
    const to = new Date(Date.now() + 86400000);
    api
      .get('/sales', { params: { from: from.toISOString(), to: to.toISOString() } })
      .then((r) => setSales(r.data))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load('day'); }, []);

  const activeSales = sales.filter((s) => s.status === 'ACTIVE');
  const periodTotal = activeSales.reduce((a, s) => a + Number(s.total), 0);

  const doAnnul = async () => {
    if (!annulSale) return;
    try {
      await api.post(`/sales/${annulSale.id}/anular`, { reason: annulReason });
      setAnnulSale(null);
      setAnnulReason('');
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const ingredientsText = (list: Array<{ ingredient: string; concentration: string | null }>) =>
    list.map((i) => `${i.ingredient}${i.concentration ? ` ${i.concentration}` : ''}`).join(' + ');

  if (loading) return <Spinner />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2>Ventas</h2>
        <Button variant="secondary" onClick={() => load()}>Actualizar</Button>
      </div>
      <Alert type="error">{error}</Alert>

      <div className="tabs">
        {([['day', 'Hoy'], ['week', '7 dias'], ['month', 'Este mes']] as [Period, string][]).map(([p, label]) => (
          <button key={p} className={`tab ${period === p ? 'active' : ''}`} onClick={() => load(p)}>{label}</button>
        ))}
      </div>

      <div className="kpi-row" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="k-label">Total ventas del periodo ({period === 'day' ? 'hoy' : period === 'week' ? 'ultimos 7 dias' : 'este mes'})</div>
          <div className="k-value">{fmtMoney(periodTotal)}</div>
        </div>
        <div className="kpi">
          <div className="k-label">Ventas activas</div>
          <div className="k-value">{activeSales.length}</div>
        </div>
        <div className="kpi">
          <div className="k-label">Ticket promedio</div>
          <div className="k-value">{activeSales.length ? fmtMoney(periodTotal / activeSales.length) : fmtMoney(0)}</div>
        </div>
      </div>

      <Card>
        <Table head={['#', 'Fecha', 'Cliente', 'Metodo', 'Pago', 'Estado', 'Cajero', 'Total', 'Acciones']}>
          {sales.map((s) => (
            <tr key={s.id}>
              <td>{s.number}</td>
              <td>{fmtDate(s.createdAt)}</td>
              <td>{s.client ? `${s.client.name} (${s.client.ciNit})` : 'MOSTRADOR'}</td>
              <td><Badge color="blue">{METHOD_LABEL[s.paymentMethod] || s.paymentMethod}</Badge></td>
              <td>
                <Badge color={s.paymentStatus === 'PAID' ? 'green' : s.paymentStatus === 'PENDING' ? 'yellow' : 'red'}>
                  {s.paymentStatus}
                </Badge>
              </td>
              <td>
                <Badge color={s.status === 'ACTIVE' ? 'green' : s.status === 'ANNULLED' ? 'red' : 'gray'}>
                  {s.status === 'ANNULLED' ? 'ANULADA' : s.status}
                </Badge>
              </td>
              <td>{s.user.fullName}</td>
              <td><b>{fmtMoney(s.total)}</b></td>
              <td>
                <Button variant="secondary" className="btn-sm" onClick={() => setDetail(s)}>Detalle</Button>{' '}
                {s.status === 'ACTIVE' && (
                  <>
                    {hasPerm('sales.annul') && <Button variant="secondary" className="btn-sm" onClick={() => { setAnnulSale(s); setAnnulReason(''); }}>Anular</Button>}{' '}
                    {hasPerm('sales.delete') && <Button variant="danger" className="btn-sm" onClick={() => api.delete(`/sales/${s.id}`).then(() => load()).catch((e) => setError(errMsg(e)))}>Desactivar</Button>}
                  </>
                )}
              </td>
            </tr>
          ))}
        </Table>
        {!sales.length && <div className="empty">Sin ventas registradas</div>}
      </Card>

      <Modal title={`Anular venta ${annulSale?.number || ''}`} open={!!annulSale} onClose={() => setAnnulSale(null)} footer={<>
        <Button variant="secondary" onClick={() => setAnnulSale(null)}>Cancelar</Button>
        <Button variant="danger" onClick={doAnnul}>Anular (devuelve stock)</Button>
      </>}>
        <p style={{ marginBottom: 10 }}>La venta sera anulada y el stock se devuelve a la sucursal.</p>
        <Field label="Motivo (opcional)"><Input value={annulReason} onChange={(e) => setAnnulReason(e.target.value)} /></Field>
      </Modal>

      <Modal title={`Detalle de venta ${detail?.number || ''}`} open={!!detail} onClose={() => setDetail(null)} footer={<Button onClick={() => setDetail(null)}>Cerrar</Button>}>
        {detail && (
          <>
            <div className="grid grid-2">
              <div className="kpi"><div className="k-label">Cliente</div><div className="k-value" style={{ fontSize: 15 }}>{detail.client ? `${detail.client.name} (${detail.client.ciNit})` : 'MOSTRADOR'}</div></div>
              <div className="kpi"><div className="k-label">Fecha</div><div className="k-value" style={{ fontSize: 15 }}>{fmtDate(detail.createdAt)}</div></div>
              <div className="kpi"><div className="k-label">Cajero</div><div className="k-value" style={{ fontSize: 15 }}>{detail.user.fullName}</div></div>
              <div className="kpi"><div className="k-label">Total</div><div className="k-value" style={{ fontSize: 15 }}>{fmtMoney(detail.total)}</div></div>
              <div className="kpi"><div className="k-label">Metodo de pago</div><div className="k-value" style={{ fontSize: 15 }}><Badge color="blue">{METHOD_LABEL[detail.paymentMethod] || detail.paymentMethod}</Badge></div></div>
            </div>
            <Table head={['Producto', 'Principios activos', 'Forma', 'Laboratorio', 'Cant.', 'P. unit.', 'Subtotal']}>
              {detail.items.map((it, i) => (
                <tr key={i}>
                  <td>
                    <b>{it.product.name}</b>
                    <div className="p-meta">SKU {it.product.sku}</div>
                  </td>
                  <td>{it.product.ingredients.length ? ingredientsText(it.product.ingredients) : it.product.concentration || '-'}</td>
                  <td>{it.product.form?.name || '-'}</td>
                  <td>{it.product.laboratory?.name ? <Badge color="blue">{it.product.laboratory.name}</Badge> : '-'}</td>
                  <td>{it.quantity}</td>
                  <td>{fmtMoney(it.price)}</td>
                  <td>{fmtMoney(Number(it.quantity) * Number(it.price))}</td>
                </tr>
              ))}
            </Table>
          </>
        )}
      </Modal>
    </div>
  );
}