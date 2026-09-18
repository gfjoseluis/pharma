import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import SelectSearch from '../components/SelectSearch';
import { Card, Table, Button, Modal, Field, Input, Spinner, Alert, fmtMoney, fmtDate, Badge, SearchBox, Pagination } from '../components/ui';
import ProductPicker, { PickedProduct } from '../components/ProductPicker';
import { useAuth } from '../context/AuthContext';

interface Branch { id: number; name: string; address: string | null; phone: string | null; type: string; active: boolean; }

interface StockRow {
  id: number;
  lot: string;
  quantity: number;
  expiryDate: string | null;
  product: { id: number; name: string; sku: string; minStock: number; unitMeasure: { shortName: string | null } | null };
  branch: { id: number; name: string };
}

interface Movement {
  id: number;
  type: string;
  quantity: number;
  lot: string | null;
  note: string | null;
  createdAt: string;
  product: { name: string; sku: string };
  branch: { name: string };
  user: { fullName: string } | null;
}

type Tab = 'sucursales' | 'stock' | 'distribuir' | 'transferir' | 'movimientos';

export default function Branches() {
  const { hasPerm } = useAuth();
  const canEdit = hasPerm('branches.edit');
  const [tab, setTab] = useState<Tab>('sucursales');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [bPage, setBPage] = useState(1);
  const [bTotal, setBTotal] = useState(0);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [sPage, setSPage] = useState(1);
  const [sTotal, setSTotal] = useState(0);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [mPage, setMPage] = useState(1);
  const [mTotal, setMTotal] = useState(0);
  const [branchFilter, setBranchFilter] = useState('');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '', type: 'pequena' });
  const [distForm, setDistForm] = useState({ toBranchId: '', items: [{ product: null as PickedProduct | null, quantity: '1', lot: '' }] });
  const [transferForm, setTransferForm] = useState({ fromBranchId: '', toBranchId: '', items: [{ product: null as PickedProduct | null, quantity: '1', lot: '' }] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadBranches = (pg: number = bPage) => {
    api.get('/branches', { params: { page: pg, pageSize: 20 } })
      .then((r) => {
        setBranches(r.data.data);
        setBTotal(r.data.total);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadBranches(1);
  }, []);

  useEffect(() => {
    setSPage(1);
    setMPage(1);
  }, [tab, branchFilter, q]);

  useEffect(() => {
    setLoading(true);
    const p1 = tab === 'stock'
      ? api.get(`/branches/stock?branchId=${branchFilter || ''}&q=${encodeURIComponent(q)}&page=${sPage}&pageSize=20`).then((r) => {
          setStock(r.data.data);
          setSTotal(r.data.total);
        })
      : Promise.resolve();
    const p2 = tab === 'movimientos'
      ? api.get('/branches/movements', { params: { page: mPage, pageSize: 20 } }).then((r) => {
          setMovements(r.data.data);
          setMTotal(r.data.total);
        })
      : Promise.resolve();
    Promise.all([p1, p2]).catch((e) => setError(errMsg(e))).finally(() => setLoading(false));
  }, [tab, branchFilter, q, sPage, mPage]);

  const openNew = () => { setEditing(null); setForm({ name: '', address: '', phone: '', type: 'pequena' }); setError(''); setModal(true); };
  const openEdit = (b: Branch) => { setEditing(b); setForm({ name: b.name, address: b.address || '', phone: b.phone || '', type: b.type }); setError(''); setModal(true); };

  const saveBranch = async () => {
    setError('');
    try {
      if (editing) await api.put(`/branches/${editing.id}`, form);
      else await api.post('/branches', form);
      setModal(false);
      loadBranches();
    } catch (e) { setError(errMsg(e)); }
  };

  const deactivateBranch = async (b: Branch) => {
    if (!window.confirm(`¿Desactivar sucursal "${b.name}"?`)) return;
    try { await api.delete(`/branches/${b.id}`); loadBranches(); } catch (e) { setError(errMsg(e)); }
  };

  const doDistribute = async () => {
    setError('');
    try {
      await api.post('/branches/distribute', {
        fromBranchId: undefined,
        toBranchId: parseInt(distForm.toBranchId, 10),
        items: distForm.items.filter((i) => i.product).map((i) => ({ productId: i.product!.id, quantity: parseInt(i.quantity, 10), lot: i.lot || 'S/LOTE' })),
      });
      setDistForm({ toBranchId: '', items: [{ product: null, quantity: '1', lot: '' }] });
      setTab('stock');
    } catch (e) { setError(errMsg(e)); }
  };

  const doTransfer = async () => {
    setError('');
    try {
      await api.post('/branches/transfer', {
        fromBranchId: parseInt(transferForm.fromBranchId, 10),
        toBranchId: parseInt(transferForm.toBranchId, 10),
        items: transferForm.items.filter((i) => i.product).map((i) => ({ productId: i.product!.id, quantity: parseInt(i.quantity, 10), lot: i.lot || 'S/LOTE' })),
      });
      setTransferForm({ fromBranchId: '', toBranchId: '', items: [{ product: null, quantity: '1', lot: '' }] });
      setTab('stock');
    } catch (e) { setError(errMsg(e)); }
  };

  const updateDist = (idx: number, key: string, v: string) => setDistForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, [key]: v } : it)) }));
  const updateTrans = (idx: number, key: string, v: string) => setTransferForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, [key]: v } : it)) }));
  const setDistProduct = (idx: number, p: PickedProduct | null) => setDistForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, product: p } : it)) }));
  const setTransProduct = (idx: number, p: PickedProduct | null) => setTransferForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, product: p } : it)) }));

  if (loading && tab === 'stock' && !stock.length) return <Spinner />;

  const branchOptions = branches.map((b) => ({ value: String(b.id), label: b.name }));
  const typeLabel: Record<string, string> = { pequena: 'Pequena', mediana: 'Mediana', grande: 'Grande' };
  const moveLabel: Record<string, string> = {
    PURCHASE: 'Compra', DISTRIBUTION: 'Distribucion', TRANSFER_OUT: 'Transferencia salida',
    TRANSFER_IN: 'Transferencia entrada', SALE: 'Venta', ADJUSTMENT: 'Ajuste',
  };

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Sucursales e Inventario</h2>
      <div className="tabs">
        <button className={`tab ${tab === 'sucursales' ? 'active' : ''}`} onClick={() => setTab('sucursales')}>Sucursales</button>
        <button className={`tab ${tab === 'stock' ? 'active' : ''}`} onClick={() => setTab('stock')}>Stock por sucursal</button>
        <button className={`tab ${tab === 'distribuir' ? 'active' : ''}`} onClick={() => setTab('distribuir')}>Distribuir stock</button>
        <button className={`tab ${tab === 'transferir' ? 'active' : ''}`} onClick={() => setTab('transferir')}>Transferir</button>
        <button className={`tab ${tab === 'movimientos' ? 'active' : ''}`} onClick={() => setTab('movimientos')}>Movimientos</button>
      </div>
      <Alert type="error">{error}</Alert>

      {tab === 'sucursales' && (
        <Card title="Sucursales" actions={canEdit ? <Button onClick={openNew}>+ Nueva sucursal</Button> : undefined}>
          <Table head={['Nombre', 'Tipo', 'Direccion', 'Telefono', 'Estado', 'Acciones']}>
            {branches.map((b) => (
              <tr key={b.id}>
                <td><b>{b.name}</b></td>
                <td><Badge color={b.type === 'grande' ? 'blue' : b.type === 'mediana' ? 'yellow' : 'gray'}>{typeLabel[b.type]}</Badge></td>
                <td>{b.address || '-'}</td>
                <td>{b.phone || '-'}</td>
                <td>{b.active ? <Badge color="green">Activa</Badge> : <Badge color="gray">Inactiva</Badge>}</td>
                <td>
                  {canEdit && <>
                  <Button variant="secondary" className="btn-sm" onClick={() => openEdit(b)}>Editar</Button>{' '}
                  {b.active && <Button variant="danger" className="btn-sm" onClick={() => deactivateBranch(b)}>Desactivar</Button>}
                </>}
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={bPage} total={bTotal} pageSize={20} onChange={(p) => { setBPage(p); loadBranches(p); }} />
        </Card>
      )}

      {tab === 'stock' && (
        <Card title="Stock por sucursal" actions={<>
          <SearchBox value={q} onChange={setQ} placeholder="Buscar producto..." />
          <SelectSearch
            value={branchFilter}
            onChange={setBranchFilter}
            options={[{ value: '', label: 'Todas las sucursales' }, ...branchOptions]}
            placeholder="Todas las sucursales"
          />
        </>}>
          <Table head={['Sucursal', 'Producto', 'SKU', 'Lote', 'Vencimiento', 'Cantidad', 'Estado']}>
            {stock.map((s) => (
              <tr key={s.id}>
                <td>{s.branch.name}</td>
                <td><b>{s.product.name}</b></td>
                <td><Badge color="blue">{s.product.sku}</Badge></td>
                <td>{s.lot}</td>
                <td>{fmtDate(s.expiryDate)}</td>
                <td>{s.quantity}</td>
                <td>
                  {s.expiryDate && new Date(s.expiryDate) < new Date() ? (
                    <Badge color="red">VENCIDO</Badge>
                  ) : s.quantity <= s.product.minStock ? (
                    <Badge color="yellow">Stock bajo</Badge>
                  ) : (
                    <Badge color="green">OK</Badge>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          {!stock.length && <div className="empty">Sin stock</div>}
          <Pagination page={sPage} total={sTotal} pageSize={20} onChange={setSPage} />
        </Card>
      )}

      {tab === 'distribuir' && (
        <Card title="Distribuir stock (desde bodega central a sucursales)">
          <div className="form-row">
            <Field label="Sucursal destino">
              <SelectSearch
                value={distForm.toBranchId}
                onChange={(v) => setDistForm({ ...distForm, toBranchId: v })}
                options={branchOptions}
                placeholder="Seleccionar sucursal..."
              />
            </Field>
          </div>
          {distForm.items.map((it, idx) => (
            <div className="form-row" key={idx}>
              <Field label="Producto">
                <ProductPicker value={it.product} onSelect={(p) => setDistProduct(idx, p)} />
              </Field>
              <Field label="Cantidad"><Input type="number" min="1" value={it.quantity} onChange={(e) => updateDist(idx, 'quantity', e.target.value)} /></Field>
              <Field label="Lote (dejar S/LOTE si no aplica)"><Input value={it.lot} onChange={(e) => updateDist(idx, 'lot', e.target.value)} /></Field>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" onClick={() => setDistForm((f) => ({ ...f, items: [...f.items, { product: null, quantity: '1', lot: '' }] }))}>+ Item</Button>
            <Button variant="primary" onClick={doDistribute} disabled={!distForm.toBranchId}>Distribuir</Button>
          </div>
        </Card>
      )}

      {tab === 'transferir' && (
        <Card title="Transferencia entre sucursales">
          <div className="form-row">
            <Field label="Origen">
              <SelectSearch
                value={transferForm.fromBranchId}
                onChange={(v) => setTransferForm({ ...transferForm, fromBranchId: v })}
                options={branchOptions}
                placeholder="Seleccionar sucursal..."
              />
            </Field>
            <Field label="Destino">
              <SelectSearch
                value={transferForm.toBranchId}
                onChange={(v) => setTransferForm({ ...transferForm, toBranchId: v })}
                options={branchOptions}
                placeholder="Seleccionar sucursal..."
              />
            </Field>
          </div>
          {transferForm.items.map((it, idx) => (
            <div className="form-row" key={idx}>
              <Field label="Producto">
                <ProductPicker value={it.product} onSelect={(p) => setTransProduct(idx, p)} />
              </Field>
              <Field label="Cantidad"><Input type="number" min="1" value={it.quantity} onChange={(e) => updateTrans(idx, 'quantity', e.target.value)} /></Field>
              <Field label="Lote"><Input value={it.lot} onChange={(e) => updateTrans(idx, 'lot', e.target.value)} /></Field>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" onClick={() => setTransferForm((f) => ({ ...f, items: [...f.items, { product: null, quantity: '1', lot: '' }] }))}>+ Item</Button>
            <Button variant="primary" onClick={doTransfer} disabled={!transferForm.fromBranchId || !transferForm.toBranchId || transferForm.fromBranchId === transferForm.toBranchId}>Transferir</Button>
          </div>
        </Card>
      )}

      {tab === 'movimientos' && (
        <Card title="Movimientos de stock">
          <Table head={['Fecha', 'Tipo', 'Producto', 'SKU', 'Sucursal', 'Cantidad', 'Lote', 'Usuario', 'Nota']}>
            {movements.map((m) => (
              <tr key={m.id}>
                <td>{fmtDate(m.createdAt)}</td>
                <td><Badge color={m.quantity < 0 ? 'red' : 'green'}>{moveLabel[m.type] || m.type}</Badge></td>
                <td>{m.product.name}</td>
                <td>{m.product.sku}</td>
                <td>{m.branch.name}</td>
                <td>{m.quantity}</td>
                <td>{m.lot || '-'}</td>
                <td>{m.user?.fullName || '-'}</td>
                <td>{m.note || '-'}</td>
              </tr>
            ))}
          </Table>
          {!movements.length && <div className="empty">Sin movimientos</div>}
          <Pagination page={mPage} total={mTotal} pageSize={20} onChange={setMPage} />
        </Card>
      )}

      <Modal title={editing ? 'Editar sucursal' : 'Nueva sucursal'} open={modal} onClose={() => setModal(false)} footer={<>
        <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
        <Button onClick={saveBranch}>Guardar</Button>
      </>}>
        <Field label="Nombre"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="form-row">
          <Field label="Tipo">
            <SelectSearch
              value={form.type}
              onChange={(v) => setForm({ ...form, type: v })}
              options={[
                { value: 'pequena', label: 'Pequena (solo venta simple)' },
                { value: 'mediana', label: 'Mediana' },
                { value: 'grande', label: 'Grande' },
              ]}
            />
          </Field>
          <Field label="Telefono"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        </div>
        <Field label="Direccion"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
      </Modal>
    </div>
  );
}
