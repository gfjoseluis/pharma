import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { fmtDate, Badge } from './ui';
import { useAuth } from '../context/AuthContext';

interface ExpiryItem {
  id: number;
  lot: string | null;
  quantity: number;
  expiryDate: string | null;
  expired: boolean;
  product: { id: number; name: string; sku: string };
  branch: { id: number; name: string };
}

export default function ExpiryBell() {
  const { hasPerm } = useAuth();
  const [items, setItems] = useState<ExpiryItem[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const visible =
    hasPerm('products.view') || hasPerm('pos.view') || hasPerm('branches.view') || hasPerm('purchases.view');

  useEffect(() => {
    if (!visible) return;
    const load = () => {
      api
        .get('/inventory/expiring?days=30')
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
        <span>⚠️ Por vencer</span>
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
          <div className="p-name" style={{ padding: '4px 8px' }}>Lotes por vencer (30 dias)</div>
          {items.length === 0 && <div className="empty">Sin avisos. Todo en fecha.</div>}
          {items.map((it) => (
            <div key={it.id} className="product-row" style={{ borderRadius: 8 }}>
              <div>
                <div className="p-name" style={{ fontSize: 13 }}>
                  {it.product.name}
                  {it.expired ? <Badge color="red">VENCIDO</Badge> : <Badge color="yellow">Por vencer</Badge>}
                </div>
                <div className="p-meta">
                  Lote {it.lot || 'S/LOTE'} · vence {it.expiryDate ? fmtDate(it.expiryDate) : '-'} · {it.quantity} und · {it.branch.name}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}