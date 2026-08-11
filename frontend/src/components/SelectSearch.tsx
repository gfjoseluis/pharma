import React, { useRef, useState, useEffect } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Select con buscador: muestra el valor seleccionado como texto; al hacer click
 * abre un dropdown con campo de filtro. El filtro busca en la etiqueta (nombre, RUC, etc).
 */
export default function SelectSearch({ options, value, onChange, placeholder, searchPlaceholder, disabled, required }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = options.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className={`input ${required && !value ? 'input-error' : ''}`}
        style={{ textAlign: 'left', width: '100%', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); setFilter(''); }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder || '— seleccionar —'}
        </span>
        <span style={{ marginLeft: 8, opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div className="picker-dropdown" style={{ minWidth: '100%' }}>
          <input
            className="input"
            autoFocus
            placeholder={searchPlaceholder || 'Buscar...'}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 4 }}>
            {filtered.length === 0 && <div className="p-meta" style={{ padding: 8 }}>Sin resultados</div>}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                className="picker-item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
