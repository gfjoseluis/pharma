import React, { useCallback, useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import SelectSearch, { AsyncSelect } from '../components/SelectSearch';
import { Card, Table, Button, Modal, Field, Input, SearchBox, Spinner, Alert, fmtMoney, Badge, Pagination } from '../components/ui';
import { isValidMoney, moneyToNumber } from '../money';
import { useAuth } from '../context/AuthContext';

interface Category { id: number; name: string; }
interface Lab { id: number; name: string; }
interface Unit { id: number; name: string; shortName: string | null; }
interface Form { id: number; name: string; }
interface StockRow { branchId: number; quantity: number; lot: string; expiryDate: string | null; branch: { name: string }; }

interface Product {
  id: number;
  sku: string;
  name: string;
  concentration: string | null;
  therapeuticAction: string | null;
  ingredients: Array<{ ingredient: string; concentration: string | null }>;
  form: Form | null;
  restrictedUse: boolean;
  barcode: string | null;
  price: string;
  costPrice: string;
  minStock: number;
  active: boolean;
  category: Category | null;
  laboratory: Lab | null;
  unitMeasure: Unit | null;
  stocks: StockRow[];
}

interface IngredientRow { ingredient: string; amount: string; unit: string; }

const DOSE_UNITS = ['mg', 'g', 'ml', 'mcg', 'UI', '%'];

/** Separa "500 mg" (o "200 mg/5 ml" como legado, sin partir) en cantidad + unidad. */
const parseDose = (c: string | null): { amount: string; unit: string } => {
  if (!c) return { amount: '', unit: '' };
  const m = c.trim().match(/^([\d.,]+)\s*([a-zA-Z][a-zA-Z0-9/%.]*)?$/);
  if (!m) return { amount: c.trim(), unit: '' };
  return { amount: m[1], unit: m[2] || '' };
};

const serializeDose = (amount: string, unit: string): string => {
  const a = amount.trim();
  const u = unit.trim();
  if (!a) return u;
  return u ? `${a} ${u}` : a;
};

const emptyForm = {
  sku: '', autoSku: false, name: '', barcode: '', categoryId: '', laboratoryId: '',
  unitMeasureId: '', formId: '', concentration: '', therapeuticAction: '', restrictedUse: false,
  ingredients: [] as IngredientRow[],
  price: '', costPrice: '', minStock: '0',
};

export default function Products() {
  const { hasPerm } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [refLabels, setRefLabels] = useState({ category: '', laboratory: '', unit: '', form: '' });
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showInactive, setShowInactive] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const searchRefs = (endpoint: string) => async (q: string) => {
    const r = await api.get(endpoint, { params: { q, pageSize: 20 } });
    return r.data.data.map((x: { id: number; name: string }) => ({ value: String(x.id), label: x.name }));
  };
  const searchCategories = searchRefs('/inventory/categories');
  const searchLabs = searchRefs('/inventory/laboratories');
  const searchUnits = searchRefs('/inventory/units');
  const searchForms = searchRefs('/inventory/forms');

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ q, page: String(page), pageSize: '20' });
    if (showInactive) params.set('active', 'false');
    api
      .get(`/inventory/products?${params.toString()}`)
      .then((r) => {
        setProducts(r.data.data);
        setTotal(r.data.total);
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [q, page, showInactive]);

  useEffect(() => {
    setPage(1);
  }, [q, showInactive]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const ingredientsText = (list: Array<{ ingredient: string; concentration: string | null }>) =>
    list.map((i) => `${i.ingredient}${i.concentration ? ` ${i.concentration}` : ''}`).join(' + ');

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setRefLabels({ category: '', laboratory: '', unit: '', form: '' });
    setError('');
    setModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setRefLabels({
      category: p.category?.name || '',
      laboratory: p.laboratory?.name || '',
      unit: p.unitMeasure?.name || '',
      form: p.form?.name || '',
    });
    setForm({
      sku: p.sku, autoSku: false, name: p.name, barcode: p.barcode || '',
      categoryId: p.category ? String(p.category.id) : '', laboratoryId: p.laboratory ? String(p.laboratory.id) : '',
      unitMeasureId: p.unitMeasure ? String(p.unitMeasure.id) : '',
      formId: p.form ? String(p.form.id) : '',
      concentration: p.concentration || '',
      therapeuticAction: p.therapeuticAction || '',
      restrictedUse: p.restrictedUse,
      ingredients: p.ingredients.map((i) => {
        const d = parseDose(i.concentration);
        return { ingredient: i.ingredient, amount: d.amount, unit: d.unit };
      }),
      price: p.price, costPrice: p.costPrice, minStock: String(p.minStock),
    });
    setError('');
    setModal(true);
  };

  const save = async () => {
    setError('');
    if (form.price && !isValidMoney(form.price)) {
      setError('Precio de venta invalido. Use numeros con punto o coma decimal (ej: 12.50)');
      return;
    }
    if (form.costPrice && !isValidMoney(form.costPrice)) {
      setError('Costo invalido. Use numeros con punto o coma decimal (ej: 8.75)');
      return;
    }
    try {
      const body = {
        ...form,
        categoryId: form.categoryId ? parseInt(form.categoryId, 10) : null,
        laboratoryId: form.laboratoryId ? parseInt(form.laboratoryId, 10) : null,
        unitMeasureId: form.unitMeasureId ? parseInt(form.unitMeasureId, 10) : null,
        formId: form.formId ? parseInt(form.formId, 10) : null,
        price: form.price ? moneyToNumber(form.price) : 0,
        costPrice: form.costPrice ? moneyToNumber(form.costPrice) : 0,
        ingredients: form.ingredients.map((r) => ({ ingredient: r.ingredient, concentration: serializeDose(r.amount, r.unit) })),
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

  const activate = async (p: Product) => {
    try {
      await api.put(`/inventory/products/${p.id}`, { active: true });
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const setIngredient = (idx: number, key: keyof IngredientRow, val: string) => {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.map((row, i) => (i === idx ? { ...row, [key]: val } : row)),
    }));
  };

  const totalStock = (p: Product) => p.stocks.reduce((a, s) => a + s.quantity, 0);

  if (loading && !products.length) return <Spinner />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2>Productos</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchBox value={q} onChange={setQ} placeholder="Buscar por nombre, principio activo o forma..." />
          <label className="checkbox-row" style={{ whiteSpace: 'nowrap' }} title="Los productos importados nacen desactivados: actívelos al fijar precio y stock">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Incluir desactivados
          </label>
          {hasPerm('products.create') && <Button onClick={openNew}>+ Nuevo producto</Button>}
        </div>
      </div>
      <Alert type="error">{error}</Alert>
      <Card>
        <Table head={['SKU', 'Nombre', 'Principios activos', 'Forma', 'Lab', 'Uso restringido', 'Precio', 'Stock total', 'Min', 'Estado', 'Acciones']}>
          {products.map((p) => (
            <tr key={p.id}>
              <td><Badge color="blue">{p.sku}</Badge></td>
              <td>
                <b>{p.name}</b>
                {p.barcode && <div className="p-meta">Cod.barra: {p.barcode}</div>}
                {p.therapeuticAction && <div className="p-meta">{p.therapeuticAction}</div>}
              </td>
              <td>
                {p.ingredients.length ? ingredientsText(p.ingredients) : (p.concentration || '-')}
              </td>
              <td>{p.form ? <Badge color="green">{p.form.name}</Badge> : '-'}</td>
              <td>{p.laboratory?.name || '-'}</td>
              <td>{p.restrictedUse ? <Badge color="red">Restringido</Badge> : '-'}</td>
              <td>{fmtMoney(p.price)}</td>
              <td>{totalStock(p)}</td>
              <td>{p.minStock}</td>
              <td>{p.active ? <Badge color="green">Activo</Badge> : <Badge color="gray">Inactivo</Badge>}</td>
              <td>
                {hasPerm('products.edit') && <Button variant="secondary" className="btn-sm" onClick={() => openEdit(p)}>Editar</Button>}{' '}
                {p.active && hasPerm('products.delete') && <Button variant="danger" className="btn-sm" onClick={() => deactivate(p)}>Desactivar</Button>}
                {!p.active && hasPerm('products.edit') && <Button variant="success" className="btn-sm" onClick={() => activate(p)}>Activar</Button>}
              </td>
            </tr>
          ))}
        </Table>
        {!products.length && <div className="empty">Sin productos. El SKU es obligatorio y unico.</div>}
        <Pagination page={page} total={total} pageSize={20} onChange={setPage} />
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
        <Field label="Acción terapéutica (ej: Analgésico, Antibiótico)"><Input value={form.therapeuticAction} onChange={(e) => setForm({ ...form, therapeuticAction: e.target.value })} /></Field>

        <div className="form-row">
          <Field label="Codigo de barras"><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></Field>
          <Field label="Forma farmaceutica">
            <AsyncSelect
              value={form.formId}
              selectedLabel={refLabels.form}
              onChange={(v, o) => { setForm({ ...form, formId: v }); setRefLabels((r) => ({ ...r, form: o?.label || '' })); }}
              onSearch={searchForms}
              placeholder="Buscar forma (3+ letras)..."
            />
          </Field>
        </div>

        <div className="alert alert-info" style={{ marginTop: 8 }}>
          Principios activos: uno o varios. Ej: 'paracetamol' con dosis 500 mg, o 'amoxicilina' + 'clavulanato'.
          La dosis se compone de una cantidad numerica y su unidad de medida (mg, g, ml, etc.).
          Dejar la dosis vacia si el principio activo no la lleva.
        </div>
        <Field label="Principios activos (ingredientes)">
          {form.ingredients.map((row, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <Input
                placeholder="Principio activo, ej: paracetamol"
                value={row.ingredient}
                onChange={(e) => setIngredient(idx, 'ingredient', e.target.value)}
                style={{ flex: 2 }}
              />
              <Input
                type="number"
                step="any"
                min="0"
                placeholder="Dosis numerica"
                value={row.amount}
                onChange={(e) => setIngredient(idx, 'amount', e.target.value)}
                style={{ flex: 1 }}
              />
              <SelectSearch
                value={row.unit}
                onChange={(v) => setIngredient(idx, 'unit', v)}
                options={DOSE_UNITS.map((u) => ({ value: u, label: u }))}
                placeholder="Unidad..."
              />
              <Button variant="danger" className="btn-sm" onClick={() => setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }))}>×</Button>
            </div>
          ))}
          <Button variant="secondary" onClick={() => setForm((f) => ({ ...f, ingredients: [...f.ingredients, { ingredient: '', amount: '', unit: '' }] }))}>
            + Agregar principio activo
          </Button>
        </Field>

        <div className="form-row">
          <Field label="Concentracion global (ej: 500 mg, 125 mg/ml)">
            <Input placeholder="Opcional si ya definio dosis por principio activo" value={form.concentration} onChange={(e) => setForm({ ...form, concentration: e.target.value })} />
          </Field>
          <Field label="Uso restringido (venta con receta retenida)">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.restrictedUse} onChange={(e) => setForm({ ...form, restrictedUse: e.target.checked })} />
              Exigir identificacion al vender
            </label>
          </Field>
        </div>

        <div className="form-row">
          <Field label="Categoria">
            <AsyncSelect
              value={form.categoryId}
              selectedLabel={refLabels.category}
              onChange={(v, o) => { setForm({ ...form, categoryId: v }); setRefLabels((r) => ({ ...r, category: o?.label || '' })); }}
              onSearch={searchCategories}
              placeholder="Buscar categoría (3+ letras)..."
            />
          </Field>
          <Field label="Laboratorio">
            <AsyncSelect
              value={form.laboratoryId}
              selectedLabel={refLabels.laboratory}
              onChange={(v, o) => { setForm({ ...form, laboratoryId: v }); setRefLabels((r) => ({ ...r, laboratory: o?.label || '' })); }}
              onSearch={searchLabs}
              placeholder="Buscar laboratorio (3+ letras)..."
            />
          </Field>
          <Field label="Unidad de medida de compra">
            <AsyncSelect
              value={form.unitMeasureId}
              selectedLabel={refLabels.unit}
              onChange={(v, o) => { setForm({ ...form, unitMeasureId: v }); setRefLabels((r) => ({ ...r, unit: o?.label || '' })); }}
              onSearch={searchUnits}
              placeholder="Buscar unidad (3+ letras)..."
            />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Precio de venta (coma o punto decimal, ej: 12,50)">
            <Input inputMode="decimal" placeholder="0.00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
          <Field label="Costo (coma o punto decimal, ej: 8,75)">
            <Input inputMode="decimal" placeholder="0.00" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
          </Field>
          <Field label="Stock minimo"><Input type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}