import React, { useEffect, useRef, useState } from 'react';
import { api, errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Modal, Field, Input, Alert, fmtMoney, Badge } from '../components/ui';

interface ProductHit {
  id: number;
  sku: string;
  name: string;
  barcode: string | null;
  presentation: string;
  price: number;
  category: string | null;
  unit: string | null;
  stockOwn: number;
  stockOther: number;
  lots: Array<{ lot: string; expiryDate: string | null; quantity: number; branch: string }>;
}

interface CartItem {
  productId: number;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  stockOwn: number;
}

interface ClientOption {
  id: number;
  name: string;
  ciNit: string;
}

interface SaleResult {
  sale: {
    id: number;
    number: string;
    total: number;
    paymentStatus: string;
    type: string;
  };
  invoice: { id: number; number: string } | null;
  qrCode: string | null;
  paymentPending: boolean;
}

export default function POS() {
  const { user, hasPerm } = useAuth();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientQ, setClientQ] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [clientModal, setClientModal] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', ciNit: '', address: '', phone: '' });
  const [payType, setPayType] = useState<'SIMPLE' | 'QR' | 'CARD'>('SIMPLE');
  const [withInvoice, setWithInvoice] = useState(false);
  const [qrResult, setQrResult] = useState<SaleResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const canQR = hasPerm('pos_qr') && (user?.branch?.type === 'mediana' || user?.branch?.type === 'grande');

  useEffect(() => {
    api.get('/clients?q=').then((r) => setClients(r.data)).catch(() => {});
    searchRef.current?.focus();
  }, []);

  const doSearch = async (text: string) => {
    setQ(text);
    if (text.trim().length < 2) {
      setHits([]);
      return;
    }
    try {
      const r = await api.get(`/inventory/products/search?q=${encodeURIComponent(text)}&branchId=${user?.branchId}`);
      setHits(r.data);
    } catch {
      setHits([]);
    }
  };

  const addToCart = (p: ProductHit) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === p.id);
      if (existing) {
        if (existing.quantity >= p.stockOwn) return prev;
        return prev.map((c) => (c.productId === p.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      if (p.stockOwn < 1) return prev;
      return [...prev, { productId: p.id, name: p.name, sku: p.sku, price: Number(p.price), quantity: 1, stockOwn: p.stockOwn }];
    });
    setQ('');
    setHits([]);
    searchRef.current?.focus();
  };

  const changeQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.productId !== productId) return c;
          const nq = c.quantity + delta;
          if (nq < 1 || nq > c.stockOwn) return c;
          return { ...c, quantity: nq };
        })
        .filter((c) => c.quantity > 0)
    );
  };

  const total = cart.reduce((a, c) => a + c.price * c.quantity, 0);

  const openClientModal = () => {
    setNewClient({ name: '', ciNit: '', address: '', phone: '' });
    setClientModal(true);
  };

  const saveClient = async () => {
    try {
      const r = await api.post('/clients', newClient);
      const c: ClientOption = { id: r.data.id, name: r.data.name, ciNit: r.data.ciNit };
      setClients((prev) => [...prev, c]);
      setSelectedClient(c);
      setClientModal(false);
      setError('');
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const doSale = async () => {
    if (!cart.length) return;
    setError('');
    setBusy(true);
    try {
      let clientId: number | undefined = selectedClient?.id;
      if (!clientId && clientQ.trim()) {
        const match = clients.find(
          (c) => c.name.toLowerCase() === clientQ.trim().toLowerCase() || c.ciNit === clientQ.trim()
        );
        if (match) clientId = match.id;
      }
      const body: Record<string, unknown> = {
        type: payType,
        items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity })),
        withInvoice,
      };
      if (clientId) body.clientId = clientId;
      const r = await api.post('/sales', body);
      const result: SaleResult = r.data;
      setCart([]);
      setSelectedClient(null);
      setWithInvoice(false);
      setPayType('SIMPLE');
      if (result.paymentPending) {
        setQrResult(result);
      } else {
        if (result.invoice) printInvoice(result.invoice.id);
        setQrResult(result);
        setTimeout(() => setQrResult(null), 4000);
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmQRPayment = async () => {
    if (!qrResult) return;
    setBusy(true);
    try {
      const r = await api.post('/payments/qr/confirm', { saleId: qrResult.sale.id });
      const invoice = r.data.invoice || qrResult.invoice;
      setQrResult({ ...qrResult, paymentPending: false, invoice, sale: { ...qrResult.sale, paymentStatus: 'PAID' } });
      if (invoice) printInvoice(invoice.id);
      setError('');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmCardPayment = async () => {
    if (!qrResult) return;
    setBusy(true);
    try {
      const r = await api.post('/payments/card/confirm', { saleId: qrResult.sale.id });
      const invoice = r.data.invoice || qrResult.invoice;
      setQrResult({ ...qrResult, paymentPending: false, invoice, sale: { ...qrResult.sale, paymentStatus: 'PAID' } });
      if (invoice) printInvoice(invoice.id);
      setError('');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const printInvoice = (invoiceId: number) => {
    window.open(`/api/invoices/print/${invoiceId}?token=${localStorage.getItem('token')}`, '_blank');
  };

  const filteredClients = clientQ.trim()
    ? clients.filter((c) => c.name.toLowerCase().includes(clientQ.toLowerCase()) || c.ciNit.includes(clientQ))
    : clients;

  const needsClient = (payType === 'QR' || payType === 'CARD' || withInvoice);

  const hasClient = () => {
    if (selectedClient) return true;
    return !!clientQ.trim() && clients.some(
      (c) => c.name.toLowerCase() === clientQ.trim().toLowerCase() || c.ciNit === clientQ.trim()
    );
  };

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Punto de Venta — {user?.branch?.name || 'Sin sucursal'}</h2>
      <Alert type="error">{error}</Alert>
      <div className="pos-layout">
        <Card title="Buscar producto (se muestra stock de otras sucursales, se vende solo el propio)">
          <div className="pos-search">
            <input
              ref={searchRef}
              className="input"
              placeholder="Codigo de barras, SKU o nombre..."
              value={q}
              onChange={(e) => doSearch(e.target.value)}
            />
          </div>
          {hits.length > 0 && (
            <div className="product-results">
              {hits.map((p) => (
                <div key={p.id} className="product-row" onClick={() => addToCart(p)}>
                  <div>
                    <div className="p-name">{p.name} <span className="p-meta">({p.presentation})</span></div>
                    <div className="p-meta">SKU {p.sku} · {fmtMoney(p.price)} · stock propio: {p.stockOwn} · otras sucursales: {p.stockOther}</div>
                  </div>
                  <Button variant="success" onClick={() => addToCart(p)}>+</Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title={`Carrito (${cart.length} items)`}>
          {cart.length === 0 && <div className="empty">Agregue productos buscando arriba</div>}
          {cart.map((c) => (
            <div key={c.productId} className="product-row">
              <div>
                <div className="p-name">{c.name}</div>
                <div className="p-meta">{fmtMoney(c.price)} x {c.quantity} = {fmtMoney(c.price * c.quantity)}</div>
              </div>
              <div className="qty-control">
                <button onClick={() => changeQty(c.productId, -1)}>−</button>
                <span>{c.quantity}</span>
                <button onClick={() => changeQty(c.productId, 1)}>+</button>
              </div>
            </div>
          ))}
          <div className="total-line">
            <span>TOTAL</span>
            <span>{fmtMoney(total)}</span>
          </div>
        </Card>
      </div>

      <Card title="Finalizar venta">
        <div className="form-row">
          <div className="field" style={{ minWidth: 280 }}>
            <span>Cliente (buscar por nombre o NIT/CI)</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                list="client-options"
                placeholder="Buscar cliente..."
                value={selectedClient ? `${selectedClient.name} (${selectedClient.ciNit})` : clientQ}
                onChange={(e) => {
                  setSelectedClient(null);
                  setClientQ(e.target.value);
                }}
              />
              <datalist id="client-options">
                {filteredClients.map((c) => (
                  <option key={c.id} value={`${c.name} (${c.ciNit})`} data-id={c.id} />
                ))}
              </datalist>
              <Button variant="secondary" onClick={openClientModal}>+ Nuevo</Button>
            </div>
            {filteredClients.length > 0 && !selectedClient && (
              <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {filteredClients.slice(0, 5).map((c) => (
                  <button key={c.id} className="btn btn-sm btn-secondary" onClick={() => setSelectedClient(c)}>
                    {c.name} · {c.ciNit}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="field">
            <span>Tipo de pago</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant={payType === 'SIMPLE' ? 'primary' : 'secondary'} onClick={() => setPayType('SIMPLE')}>✓ Efectivo</Button>
              {canQR && <Button variant={payType === 'QR' ? 'primary' : 'secondary'} onClick={() => setPayType('QR')}>QR</Button>}
              {canQR && <Button variant={payType === 'CARD' ? 'primary' : 'secondary'} onClick={() => setPayType('CARD')}>Tarjeta</Button>}
            </div>
          </div>

          <div className="field">
            <span>Factura</span>
            <label className="checkbox-row">
              <input type="checkbox" checked={withInvoice} onChange={(e) => setWithInvoice(e.target.checked)} />
              Emitir factura (requiere cliente con NIT/CI)
            </label>
          </div>
        </div>

        {needsClient && !hasClient() && (
          <Alert type="info">Para este tipo de venta seleccione un cliente (con CI/NIT) o cree uno nuevo.</Alert>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <Button
            variant="success"
            disabled={busy || !cart.length || (needsClient && !hasClient())}
            onClick={doSale}
          >
            {busy ? 'Procesando...' : 'Cobrar venta'}
          </Button>
        </div>
      </Card>

      {/* Modal: cliente nuevo */}
      <Modal title="Registrar nuevo cliente" open={clientModal} onClose={() => setClientModal(false)} footer={<>
        <Button variant="secondary" onClick={() => setClientModal(false)}>Cancelar</Button>
        <Button variant="primary" onClick={saveClient}>Guardar</Button>
      </>}>
        <Field label="Nombre (obligatorio)"><Input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} /></Field>
        <Field label="NIT/CI (obligatorio, unico)"><Input value={newClient.ciNit} onChange={(e) => setNewClient({ ...newClient, ciNit: e.target.value })} /></Field>
        <Field label="Direccion (opcional)"><Input value={newClient.address} onChange={(e) => setNewClient({ ...newClient, address: e.target.value })} /></Field>
        <Field label="Telefono (opcional)"><Input value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} /></Field>
      </Modal>

      {/* Modal: pago QR / tarjeta */}
      <Modal
        title={`Pago ${qrResult?.sale.type === 'CARD' ? 'con tarjeta' : 'con QR'}`}
        open={!!qrResult}
        onClose={() => setQrResult(null)}
        footer={
          qrResult?.paymentPending ? (
            <>
              {qrResult.sale.type === 'QR' ? (
                <Button variant="success" onClick={confirmQRPayment} disabled={busy}>Confirmar pago bancario (simulado)</Button>
              ) : (
                <Button variant="success" onClick={confirmCardPayment} disabled={busy}>Confirmar pago con tarjeta</Button>
              )}
            </>
          ) : (
            <Button variant="primary" onClick={() => setQrResult(null)}>Cerrar</Button>
          )
        }
      >
        {qrResult && (
          <div className="qr-box">
            {qrResult.sale.type === 'QR' && qrResult.qrCode && (
              <img src={qrResult.qrCode} alt="QR de pago" />
            )}
            <div><b>Venta:</b> {qrResult.sale.number}</div>
            <div><b>Total:</b> {fmtMoney(qrResult.sale.total)}</div>
            {qrResult.paymentPending ? (
              <Badge color="yellow">Esperando confirmacion bancaria</Badge>
            ) : (
              <>
                <Badge color="green">PAGADO</Badge>
                {qrResult.invoice && (
                  <div className="alert alert-success">Factura {qrResult.invoice.number} emitida e impresa</div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
