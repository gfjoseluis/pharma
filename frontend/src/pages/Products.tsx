import React, { useCallback, useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import { Card, Table, Button, Modal, Field, Input, Select, SearchBox, Spinner, Alert, fmtMoney, Badge } from '../components/ui';

interface Category { id: number; name: string; }
interface Lab { id: number; name: string; }
interface Unit { id: number; name: string; shortName: string | null; }
interface Supplier { id: number; name: string; ruc: string | null; }
interface StockRow { branchId: number; quantity: number; lot: string; expiryDate: string | null; branch: { name: string }; }

interface Product {
  id: number;
  sku: string;
  name: string;
  barcode: string | null;
  presentation: string;
  price: string;
  costPrice: string;
  minStock: number;
  active: boolean;
  category: Category | null;
  laboratory: Lab | null;
  unitMeasure: Unit | null;
  suppliers: Array<{ supplier: { id: number; name: string } }>;
  stocks: StockRow[];
}

const emptyForm = {
  sku: '', autoSku: false, name: '', barcode: '', categoryId: '', laboratoryId: '',
  unitMeasureId: '', presentation: 'unidad', price: '', costPrice: '', minStock: '0', supplierIds: [] as number[],
};

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadRefs = () => {
    api.get('/inventory/categories').then((r) => setCategories(r.data)).catch(() => {});
    api.get('/inventory/laboratories').then((r) => setLabs(r.data)).catch(() => {});
    api.get('/inventory/units').then((r) => setUnits(r.data)).catch(() => {});
    api.get('/inventory/suppliers').then((r) => setSuppliers(r.data)).catch(() => {});
  };

  const load = useCallback(() => {
    setLoading(true);
    api
      .get(`/inventory/products?q=${encodeURIComponent(q)}`)
      .then((r) => setProducts(r.data))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => {
    loadRefs();
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      sku: p.sku, autoSku: false, name: p.name, barcode: p.barcode || '',
      categoryId: p.category ? String(p.category.id) : '', laboratoryId: p.laboratory ? String(p.laboratory.id) : '',
      unitMeasureId: p.unitMeasure ? String(p.unitMeasure.id) : '', presentation: p.presentation,
      price: p.price, costPrice: p.costPrice, minStock: String(p.minStock),
      supplierIds: p.suppliers.map((s) => s.supplier.id),
    });
    setError('');
    setModal(true);
  };

  const save = async () => {
    setError('');
    try {
      const body = {
        ...form,
        categoryId: form.categoryId ? parseInt(form.categoryId, 10) : null,
        laboratoryId: form.laboratoryId ? parseInt(form.laboratoryId, 10) : null,
        unitMeasureId: form.unitMeasureId ? parseInt(form.unitMeasureId, 10) : null,
        supplierIds: form.supplierIds,
      };
      if (editing) {
        await api.put(`/inventory/products/${editing.id}`, body);
      } else {
        await api.post('/inventory/products', body);
      }
      setModal(false);
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const deactivate = async (p: Product) => {
    if (!window.confirm(`¿Desactivar "${p.name}"?`)) return;
    try {
      await api.delete(`/inventory/products/${p.id}`);
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const toggleSupplier = (id: number) => {
    setForm((f) => ({
      ...f,
      supplierIds: f.supplierIds.includes(id) ? f.supplierIds.filter((x) => x !== id) : [...f.supplierIds, id],
    }));
  };

  const totalStock = (p: Product) => p.stocks.reduce((a, s) => a + s.quantity, 0);

  if (loading && !products.length) return <Spinner />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Productos</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <SearchBox value={q} onChange={setQ} placeholder="Buscar por nombre o SKU..." />
          <Button onClick={openNew}>+ Nuevo producto</Button>
        </div>
      </div>
      <Alert type="error">{error}</Alert>
      <Card>
        <Table head={['SKU', 'Nombre', 'Categoria', 'Lab', 'Presentacion', 'Precio', 'Costo', 'Stock total', 'Min', 'Proveedores', 'Acciones']}>
          {products.map((p) => (
            <tr key={p.id}>
              <td><Badge color="blue">{p.sku}</Badge></td>
              <td><b>{p.name}</b></td>
              <td>{p.category?.name || '-'}</td>
              <td>{p.laboratory?.name || '-'}</td>
              <td>{p.presentation}</td>
              <td>{fmtMoney(p.price)}</td>
              <td>{fmtMoney(p.costPrice)}</td>
              <td>{totalStock(p)}</td>
              <td>{p.minStock}</td>
              <td>{p.suppliers.length ? p.suppliers.map((s) => s.supplier.name).join(', ') : '-'}</td>
              <td>
                <Button variant="secondary" className="btn-sm" onClick={() => openEdit(p)}>Editar</Button>{' '}
                {p.active && <Button variant="danger" className="btn-sm" onClick={() => deactivate(p)}>Desactivar</Button>}
              </td>
            </tr>
          ))}
        </Table>
        {!products.length && <div className="empty">Sin productos. El SKU es obligatorio y unico.</div>}
      </Card>

      <Modal
        title={editing ? `Editar: ${editing.name}` : 'Nuevo producto'}
        open={modal}
        onClose={() => setModal(false)}
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
          <Button onClick={save}>Guardar</Button>
        </>}
      >
        <div className="form-row">
          <Field label="SKU (obligatorio, unico)">
            <Input
              value={form.sku}
              disabled={form.autoSku || !!editing}
              placeholder="Ej: PARA-500"
              onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
            />
          </Field>
          <Field label="Generar SKU automatico">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.autoSku} disabled={!!editing} onChange={(e) => setForm({ ...form, autoSku: e.target.checked })} />
              Auto
            </label>
          </Field>
        </div>
        <div className="alert alert-info">El SKU se corrige automaticamente: mayusculas, sin espacios, ceros iniciales eliminados.</div>
        <Field label="Nombre (obligatorio)"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="form-row">
          <Field label="Codigo de barras"><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></Field>
          <Field label="Presentacion">
            <Select value={form.presentation} onChange={(e) => setForm({ ...form, presentation: e.target.value })}>
              {['unidad', 'frasco', 'jarabe', 'caja', 'blister', 'ampolla', 'tubo', 'sobre'].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="form-row">
          <Field label="Categoria">
            <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Laboratorio">
            <Select value={form.laboratoryId} onChange={(e) => setForm({ ...form, laboratoryId: e.target.value })}>
              <option value="">—</option>
              {labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </Field>
          <Field label="Unidad de medida de compra">
            <Select value={form.unitMeasureId} onChange={(e) => setForm({ ...form, unitMeasureId: e.target.value })}>
              <option value="">—</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="form-row">
          <Field label="Precio de venta"><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
          <Field label="Costo"><Input type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} /></Field>
          <Field label="Stock minimo"><Input type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} /></Field>
        </div>
        <Field label="Proveedores que lo venden (un proveedor puede vender muchos productos)">
          <div className="checkbox-grid">
            {suppliers.map((s) => (
              <label className="checkbox-row" key={s.id}>
                <input type="checkbox" checked={form.supplierIds.includes(s.id)} onChange={() => toggleSupplier(s.id)} />
                {s.name}
              </label>
            ))}
          </div>
        </Field>
      </Modal>
    </div>
  );
}
