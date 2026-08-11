import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

export interface PickedProduct {
  id: number;
  sku: string;
  name: string;
  ingredients: Array<{ ingredient: string; concentration: string | null }>;
  form: { id: number; name: string } | null;
  concentration: string | null;
  restrictedUse: boolean;
  lab: { id: number; name: string } | null;
  unit: string | null;
  price: number;
  stockOwn: number;
  stockOther: number;
  branches: Array<{ id: number; name: string; quantity: number }>;
}

interface Props {
  value: PickedProduct | null;
  onSelect: (p: PickedProduct) => void;
  placeholder?: string;
  showStock?: boolean;
  branchId?: number | null;
  disabled?: boolean;
}

/**
 * Buscador de productos: busca por nombre comercial, principio activo,
 * forma, presentacion, SKU o codigo de barras.
 * Muestra "nombre - forma - principios activos - laboratorio".
 */
export default function ProductPicker({ value, onSelect, placeholder, showStock, branchId, disabled }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PickedProduct[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const ingredientsText = (list: Array<{ ingredient: string; concentration: string | null }>) =>
    list.map((i) => `${i.ingredient}${i.concentration ? ` ${i.concentration}` : ''}`).join(' + ');

  const doSearch = (text: string) => {
    setQ(text);
    setOpen(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSearching(true);
      api
        .get(`/inventory/products/search?q=${encodeURIComponent(text)}${branchId ? `&branchId=${branchId}` : ''}`)
        .then((r) => setResults(r.data))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
  };

  const label = (p: PickedProduct) =>
    [p.name, p.form?.name, p.ingredients.length ? ingredientsText(p.ingredients) : p.concentration, p.lab?.name]
      .filter(Boolean)
      .join(' -> ');

  const sublabel = (p: PickedProduct) =>
    `${p.sku}${p.unit ? ` (${p.unit})` : ''}${p.restrictedUse ? ' · USO RESTRINGIDO' : ''}${showStock ? ` · stock: ${p.stockOwn}` : ''}`;

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      {value ? (
        <div className="picker-selected">
          <div>
            <b>{label(value)}</b>
            <div className="p-meta">{sublabel(value)}</div>
          </div>
          {!disabled && (
            <button className="btn btn-danger btn-sm" type="button" onClick={() => onSelect(null as unknown as PickedProduct)}>×</button>
          )}
        </div>
      ) : (
        <input
          ref={inputRef}
          className="input"
          placeholder={placeholder || 'Buscar por nombre, principio activo o forma...'}
          value={q}
          disabled={disabled}
          onFocus={() => { setOpen(true); if (!results.length) doSearch(''); }}
          onChange={(e) => doSearch(e.target.value)}
        />
      )}
      {open && !value && (
        <div className="picker-dropdown">
          {searching && <div className="p-meta" style={{ padding: 8 }}>Buscando...</div>}
          {!searching && results.length === 0 && <div className="p-meta" style={{ padding: 8 }}>Sin resultados</div>}
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="picker-item"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(p);
                setOpen(false);
                setQ('');
              }}
            >
              <div>
                <div className="p-name">{label(p)}</div>
                <div className="p-meta">{sublabel(p)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}