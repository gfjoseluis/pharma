import React, { ReactNode } from 'react';

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="card">
      {(title || actions) && (
        <div className="card-head">
          <h3>{title}</h3>
          <div className="card-actions">{actions}</div>
        </div>
      )}
      <div className="card-body">{children}</div>
    </div>
  );
}

export function Button({
  children, onClick, variant = 'primary', type = 'button', disabled, className, style,
}: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'; type?: 'button' | 'submit'; disabled?: boolean;
  className?: string; style?: React.CSSProperties;
}) {
  return (
    <button type={type} className={`btn btn-${variant}${className ? ' ' + className : ''}`} onClick={onClick} disabled={disabled} style={style}>
      {children}
    </button>
  );
}

export function Modal({ title, open, onClose, children, footer }: { title: string; open: boolean; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input" {...props} />;
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Badge({ color, children }: { color: 'green' | 'red' | 'yellow' | 'gray' | 'blue'; children: ReactNode }) {
  return <span className={`badge badge-${color}`}>{children}</span>;
}

export function Alert({ type, children }: { type: 'error' | 'success' | 'info'; children: ReactNode }) {
  if (!children) return null;
  return <div className={`alert alert-${type}`}>{children}</div>;
}

export function Spinner() {
  return <div className="center-loading">Cargando...</div>;
}

export function Empty({ text = 'Sin registros' }: { text?: string }) {
  return <div className="empty">{text}</div>;
}

export function SearchBox({ value, onChange, placeholder = 'Buscar...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input className="input search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function fmtMoney(n: number | string): string {
  return Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Bs';
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '-';
  return new Date(d).toLocaleString('es-BO');
}
