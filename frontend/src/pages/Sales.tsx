import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import { Card, Table, Button, Badge, fmtMoney, fmtDate, Spinner, Alert, Modal, Field, Input } from '../components/ui';

interface SaleRow {
  id: number;
  number: string;
  type: string;
  paymentStatus: string;
  status: string;
  total: number;
  createdAt: string;
  client: { id: number; name: string; ciNit: string } | null;
  user: { fullName: string };
  branch: { name: string };
  invoice: { id: number; number: string; status: string } | null;
  items: Array<{ product: { name: string; sku: string }; quantity: number; price: number }>;
}

export default function Sales() {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [annulSale, setAnnulSale] = useState<SaleRow | null>(null);
  const [annulReason, setAnnulReason] = useState('');

  const load = () => {
    setLoading(true);
    api
      .get('/sales/recent?limit=60')
      .then((r) => setSales(r.data))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const printInvoice = (id: number) => {
    window.open(`/api/invoices/print/${id}?token=${localStorage.getItem('token')}`, '_blank');
  };

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

  const annulInvoice = async (invoiceId: number) => {
    if (!window.confirm('¿Anular esta factura? No se puede modificar, solo anular.')) return;
    try {
      await api.post(`/invoices/${invoiceId}/anular`, { reason: 'Anulacion desde listado de ventas' });
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Ventas recientes (facturacion)</h2>
        <Button variant="secondary" onClick={load}>Actualizar</Button>
      </div>
      <Alert type="error">{error}</Alert>
      <Card>
        <Table head={['#', 'Fecha', 'Cliente', 'Tipo', 'Pago', 'Estado', 'Factura', 'Cajero', 'Total', 'Acciones']}>
          {sales.map((s) => (
            <tr key={s.id}>
              <td>{s.number}</td>
              <td>{fmtDate(s.createdAt)}</td>
              <td>{s.client ? `${s.client.name} (${s.client.ciNit})` : 'MOSTRADOR'}</td>
              <td><Badge color={s.type === 'SIMPLE' ? 'gray' : s.type === 'QR' ? 'blue' : 'yellow'}>{s.type}</Badge></td>
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
              <td>
                {s.invoice ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span>{s.invoice.number}</span>
                    <Badge color={s.invoice.status === 'ISSUED' ? 'green' : s.invoice.status === 'ANNULLED' ? 'red' : 'yellow'}>
                      {s.invoice.status}
                    </Badge>
                    {s.invoice.status === 'ISSUED' && (
                      <Button variant="ghost" className="btn-sm" onClick={() => printInvoice(s.invoice!.id)}>🖨 Imprimir</Button>
                    )}
                    {s.invoice.status === 'ISSUED' && (
                      <Button variant="danger" className="btn-sm" onClick={() => annulInvoice(s.invoice!.id)}>Anular</Button>
                    )}
                  </div>
                ) : (
                  <span className="badge badge-gray">—</span>
                )}
              </td>
              <td>{s.user.fullName}</td>
              <td><b>{fmtMoney(s.total)}</b></td>
              <td>
                {s.status === 'ACTIVE' && (
                  <>
                    <Button variant="secondary" className="btn-sm" onClick={() => { setAnnulSale(s); setAnnulReason(''); }}>Anular</Button>{' '}
                    <Button variant="danger" className="btn-sm" onClick={() => api.delete(`/sales/${s.id}`).then(load).catch((e) => setError(errMsg(e)))}>Desactivar</Button>
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
        <p style={{ marginBottom: 10 }}>La venta y su factura (si existe) seran anuladas. El stock se devuelve a la sucursal.</p>
        <Field label="Motivo (opcional)"><Input value={annulReason} onChange={(e) => setAnnulReason(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}
