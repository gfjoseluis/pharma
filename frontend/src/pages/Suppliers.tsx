import React, { useCallback, useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import { Card, Table, Button, Modal, Field, Input, SearchBox, Spinner, Alert, Pagination } from '../components/ui';
import { useAuth } from '../context/AuthContext';

interface ProductBrief { id: number; name: string; sku: string; }

interface Supplier {
  id: number;
  name: string;
  ruc: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  active: boolean;
  products: Array<{ product: ProductBrief }>;
}

const emptyForm = { name: '', ruc: '', phone: '', email: '', address: '', productIds: [] as number[] };

export default function Suppliers() {
  const { hasPerm } = useAuth();
  const canManage = hasPerm('inventory.refs.manage');
  const [rows, setRows] = useState<Supplier[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [prodQ, setProdQ] = useState('');
  const [prodHits, setProdHits] = useState<ProductBrief[]>([]);
  const [prodMap, setProdMap] = useState<Record<number, ProductBrief>>({});

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/inventory/suppliers', { params: { q, page, pageSize: 20 } })
      .then((r) => {
        setRows(r.data.data);
        setTotal(r.data.total);
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [q, page]);

  useEffect(() => {
    setPage(1);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const searchProducts = (text: string) => {
    setProdQ(text);
    if (text.trim().length < 2) { setProdHits([]); return; }
    api
      .get(`/inventory/products/search?q=${encodeURIComponent(text)}`)
      .then((r) => {
        const hits = r.data.map((p: { id: number; name: string; sku: string }) => ({ id: p.id, name: p.name, sku: p.sku }));
        setProdHits(hits);
        setProdMap((prev) => {
          const next = { ...prev };
          hits.forEach((h: ProductBrief) => { next[h.id] = h; });
          return next;
        });
      })
      .catch(() => setProdHits([]));
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setError(''); setProdQ(''); setProdHits([]); setModal(true); };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      name: s.name, ruc: s.ruc || '', phone: s.phone || '', email: s.email || '', address: s.address || '',
      productIds: s.products.map((p) => p.product.id),
    });
    const m: Record<number, ProductBrief> = {};
    s.products.forEach((p) => { m[p.product.id] = p.product; });
    setProdMap((prev) => ({ ...prev, ...m }));
    setError('');
    setProdQ('');
    setProdHits([]);
    setModal(true);
  };

  const save = async () => {
    setError('');
    try {
      if (editing) await api.put(`/inventory/suppliers/${editing.id}`, form);
      else await api.post('/inventory/suppliers', form);
      setModal(false);
      load();
    } catch (e) { setError(errMsg(e)); }
  };

  const toggleProduct = (id: number) => {
    setForm((f) => ({ ...f, productIds: f.productIds.includes(id) ? f.productIds.filter((x) => x !== id) : [...f.productIds, id] }));
  };

  if (loading && !rows.length) return <Spinner />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Proveedores</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <SearchBox value={q} onChange={setQ} placeholder="Buscar proveedor..." />
          {canManage && <Button onClick={openNew}>+ Nuevo proveedor</Button>}
        </div>
      </div>
      <Alert type="error">{error}</Alert>
      <Card>
        <Table head={['Nombre', 'RUC', 'Telefono', 'Email', 'Direccion', 'Productos que vende', 'Acciones']}>
          {rows.map((s) => (
            <tr key={s.id}>
              <td><b>{s.name}</b></td>
              <td>{s.ruc || '-'}</td>
              <td>{s.phone || '-'}</td>
              <td>{s.email || '-'}</td>
              <td>{s.address || '-'}</td>
              <td>{s.products.length ? s.products.map((p) => p.product.name).slice(0, 4).join(', ') + (s.products.length > 4 ? '...' : '') : '-'}</td>
              <td>
                {canManage && <>
                <Button variant="secondary" className="btn-sm" onClick={() => openEdit(s)}>Editar</Button>{' '}
                {s.active && <Button variant="danger" className="btn-sm" onClick={async () => { if (window.confirm('¿Desactivar proveedor?')) { await api.delete(`/inventory/suppliers/${s.id}`); load(); } }}>Desactivar</Button>}
              </>}
              </td>
            </tr>
          ))}
        </Table>
        {!rows.length && <div className="empty">Sin proveedores</div>}
        <Pagination page={page} total={total} pageSize={20} onChange={setPage} />
      </Card>

      <Modal title={editing ? `Editar: ${editing.name}` : 'Nuevo proveedor'} open={modal} onClose={() => setModal(false)} footer={<>
        <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
        <Button onClick={save}>Guardar</Button>
      </>}>
        <div className="form-row">
          <Field label="Nombre (obligatorio)"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="RUC (unico)"><Input value={form.ruc} onChange={(e) => setForm({ ...form, ruc: e.target.value })} /></Field>
        </div>
        <div className="form-row">
          <Field label="Telefono"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        </div>
        <Field label="Direccion"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <Field label={`Productos que vende este proveedor (${form.productIds.length} seleccionados)`}>
          <Input value={prodQ} onChange={(e) => searchProducts(e.target.value)} placeholder="Buscar producto por nombre o SKU (mín. 2 letras)..." />
          {prodHits.length > 0 && (
            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginTop: 8 }}>
              {prodHits.filter((p) => !form.productIds.includes(p.id)).map((p) => (
                <div key={p.id} className="checkbox-row" style={{ justifyContent: 'space-between' }}>
                  <span>{p.name} <span className="badge badge-blue">{p.sku}</span></span>
                  <Button variant="secondary" className="btn-sm" onClick={() => toggleProduct(p.id)}>Agregar</Button>
                </div>
              ))}
            </div>
          )}
          {form.productIds.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {form.productIds.map((id) => (
                <span key={id} className="badge badge-green" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  {prodMap[id]?.name || `Producto #${id}`}
                  <button type="button" onClick={() => toggleProduct(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }} title="Quitar">×</button>
                </span>
              ))}
            </div>
          )}
        </Field>
      </Modal>
    </div>
  );
}
