import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import { Card, Table, Button, Modal, Field, Input, Spinner, Alert, fmtMoney, fmtDate, Badge } from '../components/ui';
import ProductPicker, { PickedProduct } from '../components/ProductPicker';
import SelectSearch from '../components/SelectSearch';
import { isValidMoney, moneyToNumber } from '../money';

interface Branch { id: number; name: string; }
interface Supplier { id: number; name: string; ruc: string | null; }

interface ItemRow {
  product: PickedProduct | null;
  quantity: string;
  unitCost: string;
  lot: string;
  expiryDate: string;
}

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

const emptyItem = (): ItemRow => ({ product: null, quantity: '1', unitCost: '', lot: '', expiryDate: '' });

export default function Purchases() {
  const [rows, setRows] = useState<Purchase[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState<Purchase | null>(null);
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
  }, []);

  const openNew = () => {
    setForm({ supplierId: '', branchId: branches[0] ? String(branches[0].id) : '', invoiceNumber: '', date: new Date().toISOString().slice(0, 10), items: [emptyItem()] });
    setError('');
    setModal(true);
  };

  const setItemProduct = (idx: number, p: PickedProduct | null) => {
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, product: p } : it)) }));
  };

  const updateItem = (idx: number, key: 'quantity' | 'unitCost' | 'lot' | 'expiryDate', value: string) => {
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it)) }));
  };

  const addItem = () => {
    setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  };

  const removeItem = (idx: number) => {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const save = async () => {
    setError('');
    const bad = form.items.find((it) => !it.product || !it.quantity || !isValidMoney(it.unitCost) || !it.expiryDate);
    if (bad) {
      setError('Complete todos los items: producto, cantidad, precio unitario (punto o coma decimal) y fecha de vencimiento (obligatoria).');
      return;
    }
    try {
      await api.post('/purchases', {
        supplierId: form.supplierId ? parseInt(form.supplierId, 10) : null,
        branchId: parseInt(form.branchId, 10),
        invoiceNumber: form.invoiceNumber || null,
        date: form.date || undefined,
        items: form.items.map((it) => ({
          productId: it.product?.id,
          quantity: parseInt(it.quantity, 10),
          unitCost: moneyToNumber(it.unitCost),
          lot: it.lot,
          expiryDate: it.expiryDate || undefined,
        })),
      });
      setModal(false);
      load();
    } catch (e) { setError(errMsg(e)); }
  };

  const remove = async (p: Purchase) => {
    if (!window.confirm(`¿Eliminar la compra #${p.id}? Se revierte el stock.`)) return;
    try { await api.delete(`/purchases/${p.id}`); load(); }
    catch (e) { setError(errMsg(e)); }
  };

  if (loading && !rows.length) return <Spinner />;

  const subtotal = form.items.reduce((a, it) => a + (parseInt(it.quantity, 10) || 0) * moneyToNumber(it.unitCost), 0);
  const itemsValid = form.items.length > 0 && form.items.every((it) => it.product && it.quantity && isValidMoney(it.unitCost) && it.expiryDate);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Compras (registro centralizado)</h2>
        <Button onClick={openNew}>+ Nueva compra</Button>
      </div>
      <Alert type="error">{error}</Alert>
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
                <Button variant="danger" className="btn-sm" onClick={() => remove(p)}>Eliminar</Button>
              </td>
            </tr>
          ))}
        </Table>
        {!rows.length && <div className="empty">Sin compras registradas</div>}
      </Card>

      <Modal title="Nueva compra" open={modal} onClose={() => setModal(false)} footer={<>
        <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
        <Button onClick={save} disabled={!form.branchId || !itemsValid}>Registrar compra</Button>
      </>}>
        <div className="form-row">
          <Field label="Proveedor (buscar por nombre o RUC)">
            <SelectSearch
              options={suppliers.map((s) => ({ value: String(s.id), label: `${s.name}${s.ruc ? ` - ${s.ruc}` : ''}` }))}
              value={form.supplierId}
              onChange={(v) => setForm({ ...form, supplierId: v })}
              placeholder="— seleccionar proveedor —"
              searchPlaceholder="Buscar proveedor por nombre o RUC..."
            />
          </Field>
          <Field label="Sucursal destino (bodega)">
            <SelectSearch
              options={branches.map((b) => ({ value: String(b.id), label: b.name }))}
              value={form.branchId}
              onChange={(v) => setForm({ ...form, branchId: v })}
              placeholder="— seleccionar sucursal —"
              searchPlaceholder="Buscar sucursal..."
              required
            />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Nro. factura (referencia)">
            <Input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
          </Field>
          <Field label="Fecha"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        </div>

        <h4 style={{ margin: '10px 0' }}>Items</h4>
        {form.items.map((it, idx) => (
          <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
            <Field label={`Producto ${idx + 1} (buscar por nombre comercial, principio activo o presentacion; se muestra nombre - presentacion - laboratorio)`}>
              <ProductPicker value={it.product} onSelect={(p) => setItemProduct(idx, p)} />
            </Field>
            {it.product && (
              <div className="form-row">
                <Field label="Cantidad"><Input type="number" min="1" value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} /></Field>
                <Field label="Precio unitario (coma o punto decimal)">
                  <Input inputMode="decimal" placeholder="0.00" value={it.unitCost} onChange={(e) => updateItem(idx, 'unitCost', e.target.value)} />
                </Field>
                <Field label="Lote"><Input value={it.lot} onChange={(e) => updateItem(idx, 'lot', e.target.value)} /></Field>
                <Field label="Fecha vencimiento (obligatoria)">
                  <Input type="date" className={!it.expiryDate ? 'input-error' : ''} value={it.expiryDate} onChange={(e) => updateItem(idx, 'expiryDate', e.target.value)} />
                </Field>
              </div>
            )}
            <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button variant="danger" className="btn-sm" onClick={() => removeItem(idx)}>Quitar item</Button>
              {it.product && (
                <span className="p-meta">
                  {it.product.name} · {it.product.lab?.name || 'sin lab'} · subtotal: {fmtMoney((parseInt(it.quantity, 10) || 0) * (parseFloat(it.unitCost) || 0))}
                </span>
              )}
            </div>
          </div>
        ))}
        <Button variant="secondary" onClick={addItem}>+ Agregar item</Button>
        <div className="total-line"><span>Total compra</span><span>{fmtMoney(subtotal)}</span></div>
      </Modal>

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
                  <td>{fmtDate(it.expiryDate)}</td>
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
