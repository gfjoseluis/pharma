import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errMsg } from '../api/client';
import { Card, Button, Field, Input, Alert, fmtMoney } from '../components/ui';
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

const emptyItem = (): ItemRow => ({ product: null, quantity: '1', unitCost: '', lot: '', expiryDate: '' });

export default function PurchasesNew() {
  const navigate = useNavigate();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState({ supplierId: '', branchId: '', invoiceNumber: '', date: new Date().toISOString().slice(0, 10), items: [emptyItem()] as ItemRow[] });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/branches').then((r) => {
      setBranches(r.data);
      setForm((f) => ({ ...f, branchId: f.branchId || (r.data[0] ? String(r.data[0].id) : '') }));
    }).catch(() => {});
    api.get('/inventory/suppliers').then((r) => setSuppliers(r.data)).catch(() => {});
  }, []);

  const setItemProduct = (idx: number, p: PickedProduct | null) => {
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, product: p } : it)) }));
  };

  const updateItem = (idx: number, key: 'quantity' | 'unitCost' | 'lot' | 'expiryDate', value: string) => {
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it)) }));
  };

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));

  const removeItem = (idx: number) => {
    setForm((f) => {
      const items = f.items.filter((_, i) => i !== idx);
      return { ...f, items: items.length ? items : [emptyItem()] };
    });
  };

  const subtotal = form.items.reduce((a, it) => a + (parseInt(it.quantity, 10) || 0) * moneyToNumber(it.unitCost), 0);
  const itemsValid = form.items.length > 0 && form.items.every((it) => it.product && parseInt(it.quantity, 10) > 0 && isValidMoney(it.unitCost));

  const save = async () => {
    setError('');
    if (!form.branchId) { setError('Seleccione la sucursal destino.'); return; }
    if (!itemsValid) {
      setError('Complete todos los items: producto, cantidad valida y precio unitario (punto o coma decimal). La fecha de vencimiento es opcional (gasa, panales, etc.).');
      return;
    }
    setBusy(true);
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
      navigate('/purchases');
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Nueva compra</h2>
        <Button variant="secondary" onClick={() => navigate('/purchases')}>← Volver a compras</Button>
      </div>
      <Alert type="error">{error}</Alert>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <Card title="Proveedor">
          <Field label="Proveedor (buscar por nombre o RUC)">
            <SelectSearch
              options={suppliers.map((s) => ({ value: String(s.id), label: `${s.name}${s.ruc ? ` - ${s.ruc}` : ''}` }))}
              value={form.supplierId}
              onChange={(v) => setForm({ ...form, supplierId: v })}
              placeholder="— seleccionar proveedor —"
              searchPlaceholder="Buscar proveedor por nombre o RUC..."
            />
          </Field>
        </Card>
        <Card title="Datos de la compra">
          <div className="form-row">
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
        </Card>
      </div>

      <Card title={`Items (${form.items.length})`} actions={<Button variant="secondary" onClick={addItem}>+ Agregar item</Button>}>
        {form.items.map((it, idx) => (
          <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 12, background: '#f8fafc' }}>
            <Field label={`Producto ${idx + 1} (buscar por nombre comercial, principio activo o presentacion)`}>
              <ProductPicker value={it.product} onSelect={(p) => setItemProduct(idx, p)} />
            </Field>
            {it.product && (
              <div className="grid grid-4">
                <Field label="Cantidad">
                  <Input type="number" min="1" value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
                </Field>
                <Field label="Precio unitario (punto o coma)">
                  <Input inputMode="decimal" placeholder="0.00" value={it.unitCost} onChange={(e) => updateItem(idx, 'unitCost', e.target.value)} />
                </Field>
                <Field label="Lote (opcional)">
                  <Input value={it.lot} onChange={(e) => updateItem(idx, 'lot', e.target.value)} />
                </Field>
                <Field label="Vencimiento (opcional)">
                  <Input type="date" value={it.expiryDate} onChange={(e) => updateItem(idx, 'expiryDate', e.target.value)} />
                </Field>
              </div>
            )}
            <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button variant="danger" className="btn-sm" onClick={() => removeItem(idx)}>🗑 Quitar item</Button>
              {it.product && (
                <span className="p-meta">
                  {it.product.name} · {it.product.lab?.name || 'sin lab'} · subtotal: {fmtMoney((parseInt(it.quantity, 10) || 0) * (parseFloat(it.unitCost) || 0))}
                </span>
              )}
            </div>
          </div>
        ))}
        <Button variant="secondary" onClick={addItem}>+ Agregar item</Button>
      </Card>

      <Card title="Resumen">
        <div className="total-line"><span>Total compra</span><span>{fmtMoney(subtotal)}</span></div>
        <p className="p-meta" style={{ marginTop: 6 }}>La fecha de vencimiento queda vacía para productos sin caducidad (gasa, pañales, etc.).</p>
        <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
          <Button variant="secondary" onClick={() => navigate('/purchases')}>Cancelar</Button>
          <Button variant="success" disabled={busy || !form.branchId || !itemsValid} onClick={save}>
            {busy ? 'Registrando...' : 'Registrar compra'}
          </Button>
        </div>
      </Card>
    </div>
  );
}