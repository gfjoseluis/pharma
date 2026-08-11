import React, { useEffect, useRef, useState } from 'react';
import { api, errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Modal, Field, Input, Alert, fmtMoney, Badge } from '../components/ui';

interface ProductHit {
  id: number;
  sku: string;
  name: string;
  ingredients: Array<{ ingredient: string; concentration: string | null }>;
  form: { id: number; name: string } | null;
  concentration: string | null;
  restrictedUse: boolean;
  barcode: string | null;
  price: number;
  category: string | null;
  lab: { id: number; name: string } | null;
  unit: string | null;
  stockOwn: number;
  stockOther: number;
  branches: Array<{ id: number; name: string; quantity: number }>;
}

interface CartItem {
  productId: number;
  name: string;
  sku: string;
  lab: string | null;
  form: string | null;
  ingredients: string;
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
    paymentMethod: string;
    type: string;
  };
  paymentPending: boolean;
}

const METHOD_LABEL: Record<string, string> = { EFECTIVO: 'efectivo', TARJETA: 'tarjeta', QR: 'QR / transferencia' };
const METHOD_BTN: Record<string, string> = { EFECTIVO: '💵 Efectivo', TARJETA: '💳 Tarjeta', QR: '📱 QR' };

const ingredientsText = (list: Array<{ ingredient: string; concentration: string | null }>) =>
  list.map((i) => `${i.ingredient}${i.concentration ? ` ${i.concentration}` : ''}`).join(' + ');

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
  const [payMethod, setPayMethod] = useState<'EFECTIVO' | 'TARJETA' | 'QR'>('EFECTIVO');
  const [saleResult, setSaleResult] = useState<SaleResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const canSale = hasPerm('pos.sale');

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
    if (p.stockOwn < 1) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === p.id);
      if (existing) {
        if (existing.quantity >= p.stockOwn) return prev;
        return prev.map((c) => (c.productId === p.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        lab: p.lab?.name || null,
        form: p.form?.name || null,
        ingredients: ingredientsText(p.ingredients),
        price: Number(p.price),
        quantity: 1,
        stockOwn: p.stockOwn,
      }];
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

  const setQty = (productId: number, raw: string) => {
    const n = parseInt(raw, 10);
    if (isNaN(n)) return;
    setCart((prev) =>
      prev.map((c) => (c.productId === productId ? { ...c, quantity: Math.min(Math.max(n, 1), c.stockOwn) } : c))
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
        type: 'SIMPLE',
        paymentMethod: payMethod,
        items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity })),
      };
      if (clientId) body.clientId = clientId;
      const r = await api.post('/sales', body);
      const result: SaleResult = r.data;
      setCart([]);
      setSelectedClient(null);
      setClientQ('');
      setSaleResult(result);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const filteredClients = clientQ.trim()
    ? clients.filter((c) => c.name.toLowerCase().includes(clientQ.toLowerCase()) || c.ciNit.includes(clientQ))
    : clients;

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Punto de Venta — {user?.branch?.name || 'Sin sucursal'}</h2>
      <Alert type="error">{error}</Alert>
      <div className="pos-layout">
        <Card title="Buscar producto (nombre, principio activo, forma o presentacion)">
          <div className="pos-search">
            <input
              ref={searchRef}
              className="input"
              placeholder="Ej: paracetamol, capsula, jarabe, ibuprofeno..."
              value={q}
              onChange={(e) => doSearch(e.target.value)}
            />
          </div>
          {hits.length > 0 && (
            <div className="product-results">
              {hits.map((p) => (
                <div key={p.id} className="product-row" onClick={() => p.stockOwn > 0 && addToCart(p)}>
                  <div>
                    <div className="p-name">
                      {p.name}
                      {p.form && <span className="badge badge-gray">{p.form.name}</span>}
                      {p.lab && <span className="badge badge-blue">{p.lab.name}</span>}
                      {p.restrictedUse && <span className="badge badge-red">Uso restringido</span>}
                    </div>
                    <div className="p-meta">
                      {p.ingredients.length > 0 ? `Principios activos: ${ingredientsText(p.ingredients)} · ` : ''}
                      SKU {p.sku} · {fmtMoney(p.price)}
                      {p.stockOwn > 0 ? ` · stock en su sucursal: ${p.stockOwn}` : ''}
                    </div>
                    {p.stockOwn <= 0 && p.branches.length > 0 && (
                      <div className="p-meta" style={{ marginTop: 4 }}>
                        Disponible en otras sucursales:
                        {p.branches.map((b) => (
                          <span key={b.id} className="badge badge-yellow" style={{ marginLeft: 6 }}>
                            {b.name}: {b.quantity}
                          </span>
                        ))}
                      </div>
                    )}
                    {p.stockOwn <= 0 && p.branches.length === 0 && (
                      <div className="p-meta" style={{ marginTop: 4 }}><span className="badge badge-red">Sin stock en ninguna sucursal</span></div>
                    )}
                  </div>
                  {p.stockOwn > 0 ? (
                    <Button variant="success" onClick={() => addToCart(p)}>+</Button>
                  ) : (
                    <span className="badge badge-gray">Sin stock aqui</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {q.length >= 2 && !hits.length && <div className="empty">Sin resultados para "{q}"</div>}
        </Card>

        <Card title={`Carrito (${cart.length} items)`}>
          {cart.length === 0 && <div className="empty">Agregue productos buscando arriba</div>}
          {cart.map((c) => (
            <div key={c.productId} className="product-row">
              <div>
                <div className="p-name">{c.name}</div>
                <div className="p-meta">
                  {c.form}{c.form ? ' · ' : ''}{c.lab ? `${c.lab} · ` : ''}{fmtMoney(c.price)} x {c.quantity} = {fmtMoney(c.price * c.quantity)}
                  {c.ingredients ? <span> · {c.ingredients}</span> : ''}
                </div>
              </div>
              <div className="qty-control">
                <button onClick={() => changeQty(c.productId, -1)}>−</button>
                <input
                  type="number"
                  min={1}
                  max={c.stockOwn}
                  className="qty-input"
                  value={c.quantity}
                  onChange={(e) => setQty(c.productId, e.target.value)}
                />
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
            <span>Cliente (opcional, buscar por nombre o NIT/CI)</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                list="client-options"
                placeholder="Buscar cliente... (MOSTRADOR si se deja vacio)"
                value={selectedClient ? `${selectedClient.name} (${selectedClient.ciNit})` : clientQ}
                onChange={(e) => {
                  setSelectedClient(null);
                  setClientQ(e.target.value);
                }}
              />
              <datalist id="client-options">
                {filteredClients.map((c) => (
                  <option key={c.id} value={`${c.name} (${c.ciNit})`} />
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
        </div>

        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="field">
            <span>Metodo de pago</span>
            <div className="seg-buttons">
              {(['EFECTIVO', 'TARJETA', 'QR'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`seg-button ${payMethod === m ? 'active' : ''}`}
                  onClick={() => setPayMethod(m)}
                >
                  {payMethod === m ? '✓ ' : ''}{METHOD_BTN[m]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <Button
            variant="success"
            disabled={busy || !cart.length || !canSale}
            onClick={doSale}
          >
            {busy ? 'Procesando...' : `Cobrar (${payMethod === 'EFECTIVO' ? 'efectivo' : payMethod === 'TARJETA' ? 'tarjeta' : 'QR'})`}
          </Button>
          {!canSale && <span className="p-meta" style={{ alignSelf: 'center' }}>Sin permiso para cobrar: contacte al administrador.</span>}
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

      {/* Modal: venta registrada */}
      <Modal
        title="Venta registrada"
        open={!!saleResult}
        onClose={() => setSaleResult(null)}
        footer={<Button variant="primary" onClick={() => setSaleResult(null)}>Nueva venta</Button>}
      >
        {saleResult && (
          <div style={{ textAlign: 'center', padding: 8 }}>
            <div style={{ fontSize: 40 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, margin: '6px 0' }}>{saleResult.sale.number}</div>
            <div>Total cobrado: <b>{fmtMoney(saleResult.sale.total)}</b></div>
            <Badge color="green">PAGADO EN {METHOD_LABEL[saleResult.sale.paymentMethod] || saleResult.sale.paymentMethod}</Badge>
          </div>
        )}
      </Modal>
    </div>
  );
}