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

interface AsyncProps {
  value: string;
  selectedLabel?: string;
  onChange: (value: string, option?: SelectOption) => void;
  onSearch: (q: string) => Promise<SelectOption[]>;
  placeholder?: string;
  minLength?: number;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Select con buscador en servidor: los resultados aparecen al escribir
 * al menos minLength letras (por defecto 3). Para listas largas
 * (laboratorios, formas, categorias con cientos de registros).
 */
export function AsyncSelect({ value, selectedLabel, onChange, onSearch, placeholder, minLength = 3, disabled, required }: AsyncProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [results, setResults] = useState<SelectOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [cache, setCache] = useState<Record<string, string>>({});
  const boxRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const doSearch = (text: string) => {
    setFilter(text);
    clearTimeout(timerRef.current);
    if (text.trim().length < minLength) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timerRef.current = setTimeout(() => {
      onSearch(text.trim())
        .then((r) => {
          setResults(r);
          setCache((prev) => {
            const next = { ...prev };
            r.forEach((o) => { next[o.value] = o.label; });
            return next;
          });
        })
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
  };

  const label = selectedLabel || cache[value] || (value ? `Seleccionado #${value}` : '');

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className={`input ${required && !value ? 'input-error' : ''}`}
        style={{ textAlign: 'left', width: '100%', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); setFilter(''); setResults([]); }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label || placeholder || '— seleccionar —'}
        </span>
        <span style={{ marginLeft: 8, opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div className="picker-dropdown" style={{ minWidth: '100%' }}>
          <input
            className="input"
            autoFocus
            placeholder={`Escriba al menos ${minLength} letras para buscar...`}
            value={filter}
            onChange={(e) => doSearch(e.target.value)}
          />
          <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 4 }}>
            {filter.trim().length < minLength && (
              <div className="p-meta" style={{ padding: 8 }}>Escriba al menos {minLength} letras para buscar</div>
            )}
            {filter.trim().length >= minLength && searching && <div className="p-meta" style={{ padding: 8 }}>Buscando...</div>}
            {filter.trim().length >= minLength && !searching && results.length === 0 && (
              <div className="p-meta" style={{ padding: 8 }}>Sin resultados</div>
            )}
            {results.map((o) => (
              <button
                key={o.value}
                type="button"
                className="picker-item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(o.value, o);
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
