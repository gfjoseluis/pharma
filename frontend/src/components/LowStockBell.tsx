import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { fmtMoney, Badge } from './ui';
import { useAuth } from '../context/AuthContext';

interface LowStockItem {
  id: number;
  name: string;
  sku: string;
  minStock: number;
  price: number;
  total: number;
  branches: Array<{ id: number; name: string; quantity: number }>;
}

export default function LowStockBell() {
  const { hasPerm } = useAuth();
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const visible =
    hasPerm('products.view') || hasPerm('branches.view') || hasPerm('purchases.view') || hasPerm('reports.view');

  useEffect(() => {
    if (!visible) return;
    const load = () => {
      api
        .get('/inventory/low-stock')
        .then((r) => setItems(r.data || []))
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [visible]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!visible) return null;

  const count = items.length;

  return (
    <div ref={boxRef} style={{ position: 'relative', margin: '10px 0' }}>
      <button
        type="button"
        className={`seg-button ${open ? 'active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>📦 Reponer stock</span>
        <span className={`badge ${count > 0 ? 'badge-red' : 'badge-gray'}`}>{count}</span>
      </button>
      {open && (
        <div
          style={{
            position: 'fixed',
            top: 64,
            right: 12,
            width: 340,
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: 'min(420px, calc(100vh - 80px))',
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,.22)',
            zIndex: 90,
            padding: 8,
          }}
        >
          <div className="p-name" style={{ padding: '4px 8px' }}>Productos con stock bajo (reponer / comprar)</div>
          {items.length === 0 && <div className="empty">Todo el stock esta por encima del minimo.</div>}
          {items.map((it) => (
            <div key={it.id} className="product-row" style={{ borderRadius: 8 }}>
              <div>
                <div className="p-name" style={{ fontSize: 13 }}>
                  {it.name}
                  {' '}<Badge color="red">Stock {it.total} / min {it.minStock}</Badge>
                </div>
                <div className="p-meta">
                  {it.sku} · {fmtMoney(it.price)}
                  {it.branches.length > 0 && (
                    <span> · {it.branches.map((b) => `${b.name}: ${b.quantity}`).join(', ')}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div className="p-meta" style={{ padding: '6px 8px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
            💡 Registre compras en <b>/purchases</b> para reponer el stock.
          </div>
        </div>
      )}
    </div>
  );
}