import React, { useCallback, useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import { Card, Table, Button, Modal, Field, Input, SearchBox, Spinner, Alert } from '../components/ui';
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
  const [products, setProducts] = useState<ProductBrief[]>([]);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/inventory/suppliers')
      .then((r) => setRows(r.data.filter((s: Supplier) => s.name.toLowerCase().includes(q.toLowerCase()))))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => {
    api.get('/inventory/products?limit=500').then((r) => setProducts(r.data.map((p: { id: number; name: string; sku: string }) => ({ id: p.id, name: p.name, sku: p.sku })))).catch(() => {});
    load();
  }, [load]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setError(''); setModal(true); };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      name: s.name, ruc: s.ruc || '', phone: s.phone || '', email: s.email || '', address: s.address || '',
      productIds: s.products.map((p) => p.product.id),
    });
    setError('');
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
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
            {products.map((p) => (
              <label className="checkbox-row" key={p.id}>
                <input type="checkbox" checked={form.productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} />
                {p.name} <span className="badge badge-blue">{p.sku}</span>
              </label>
            ))}
          </div>
        </Field>
      </Modal>
    </div>
  );
}
