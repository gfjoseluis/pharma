import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import { Card, Table, Button, Modal, Field, Input, Select, Spinner, Alert, fmtMoney, fmtDate, Badge } from '../components/ui';

interface Branch { id: number; name: string; }
interface Supplier { id: number; name: string; }
interface ProductHit { id: number; name: string; sku: string; unit: string | null; }

interface ItemRow {
  productId: number;
  quantity: string;
  unitCost: string;
  lot: string;
  expiryDate: string;
}

interface Purchase {
  id: number;
  invoiceNumber: string | null;
  date: string;
  total: string;
  status: string;
  supplier: Supplier | null;
  branch: Branch;
  items: Array<{ id: number; quantity: number; unitCost: string; lot: string | null; expiryDate: string | null; product: { id: number; name: string; sku: string } }>;
}

export default function Purchases() {
  const [rows, setRows] = useState<Purchase[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProductHit[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ supplierId: '', branchId: '', invoiceNumber: '', date: '', items: [] as ItemRow[] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/purchases').then((r) => setRows(r.data)).catch((e) => setError(errMsg(e))).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get('/branches').then((r) => setBranches(r.data)).catch(() => {});
    api.get('/inventory/suppliers').then((r) => setSuppliers(r.data)).catch(() => {});
    api.get('/inventory/products?limit=500').then((r) => setProducts(r.data.map((p: { id: number; name: string; sku: string; unitMeasure: { shortName: string | null } | null }) => ({ id: p.id, name: p.name, sku: p.sku, unit: p.unitMeasure?.shortName || null })))).catch(() => {});
  }, []);

  const openNew = () => {
    setForm({ supplierId: '', branchId: branches[0] ? String(branches[0].id) : '', invoiceNumber: '', date: new Date().toISOString().slice(0, 10), items: [{ productId: 0, quantity: '1', unitCost: '', lot: '', expiryDate: '' }] });
    setError('');
    setModal(true);
  };

  const updateItem = (idx: number, key: keyof ItemRow, value: string) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it)),
    }));
  };

  const addItem = () => {
    setForm((f) => ({ ...f, items: [...f.items, { productId: 0, quantity: '1', unitCost: '', lot: '', expiryDate: '' }] }));
  };

  const save = async () => {
    setError('');
    try {
      await api.post('/purchases', {
        supplierId: form.supplierId ? parseInt(form.supplierId, 10) : null,
        branchId: parseInt(form.branchId, 10),
        invoiceNumber: form.invoiceNumber || null,
        date: form.date || undefined,
        items: form.items.map((it) => ({
          productId: it.productId,
          quantity: parseInt(it.quantity, 10),
          unitCost: parseFloat(it.unitCost),
          lot: it.lot,
          expiryDate: it.expiryDate || undefined,
        })),
      });
      setModal(false);
      load();
    } catch (e) { setError(errMsg(e)); }
  };

  const discharge = async (p: Purchase) => {
    try { await api.post(`/purchases/${p.id}/descargo`); load(); }
    catch (e) { setError(errMsg(e)); }
  };

  const remove = async (p: Purchase) => {
    if (!window.confirm(`¿Eliminar la compra #${p.id}? Se revierte el stock.`)) return;
    try { await api.delete(`/purchases/${p.id}`); load(); }
    catch (e) { setError(errMsg(e)); }
  };

  if (loading && !rows.length) return <Spinner />;

  const subtotal = form.items.reduce((a, it) => a + (parseInt(it.quantity, 10) || 0) * (parseFloat(it.unitCost) || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Compras (registro centralizado)</h2>
        <Button onClick={openNew}>+ Nueva compra</Button>
      </div>
      <Alert type="error">{error}</Alert>
      <Card>
        <Table head={['#', 'Fecha', 'Proveedor', 'Factura', 'Sucursal destino', 'Items', 'Total', 'Estado', 'Acciones']}>
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
                <Badge color={p.status === 'RECIBIDA' ? 'blue' : 'green'}>
                  {p.status === 'RECIBIDA' ? 'Recibida' : 'Descargada SIN'}
                </Badge>
              </td>
              <td>
                {p.status !== 'SIN_DESCARGADO' && p.invoiceNumber && (
                  <Button variant="success" className="btn-sm" onClick={() => discharge(p)}>Descargo SIN</Button>
                )}{' '}
                <Button variant="danger" className="btn-sm" onClick={() => remove(p)}>Eliminar</Button>
              </td>
            </tr>
          ))}
        </Table>
        {!rows.length && <div className="empty">Sin compras registradas</div>}
      </Card>

      <Modal title="Nueva compra" open={modal} onClose={() => setModal(false)} footer={<>
        <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
        <Button onClick={save} disabled={!form.branchId || !form.items.some((it) => it.productId)}>Registrar compra</Button>
      </>}>
        <div className="form-row">
          <Field label="Proveedor">
            <Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">—</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Sucursal destino (bodega)">
            <Select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Nro. factura (para descargo SIN)">
            <Input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
          </Field>
          <Field label="Fecha"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        </div>

        <h4 style={{ margin: '10px 0' }}>Items (lote y vencimiento opcionales)</h4>
        {form.items.map((it, idx) => (
          <div className="form-row" key={idx} style={{ marginBottom: 8 }}>
            <Field label="Producto">
              <Select value={it.productId} onChange={(e) => updateItem(idx, 'productId', e.target.value)}>
                <option value={0}>— seleccionar —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </Select>
            </Field>
            <Field label="Cantidad"><Input type="number" min="1" value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} /></Field>
            <Field label="Costo unit."><Input type="number" step="0.01" value={it.unitCost} onChange={(e) => updateItem(idx, 'unitCost', e.target.value)} /></Field>
            <Field label="Lote"><Input value={it.lot} onChange={(e) => updateItem(idx, 'lot', e.target.value)} /></Field>
            <Field label="Vence"><Input type="date" value={it.expiryDate} onChange={(e) => updateItem(idx, 'expiryDate', e.target.value)} /></Field>
            <Button variant="danger" className="btn-sm" style={{ alignSelf: 'flex-end', marginBottom: 12 }} onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}>×</Button>
          </div>
        ))}
        <Button variant="secondary" onClick={addItem}>+ Agregar item</Button>
        <div className="total-line"><span>Total compra</span><span>{fmtMoney(subtotal)}</span></div>
      </Modal>
    </div>
  );
}
