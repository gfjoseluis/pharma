import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import { Card, Table, Button, Modal, Field, Input, Alert, Spinner, SearchBox, Pagination } from '../components/ui';
import { useAuth } from '../context/AuthContext';

interface Row { id: number; name: string; active: boolean; }

/** Pagina CRUD simple reutilizable (categorias, laboratorios, unidades). */
export default function SimpleCrudPage({ title, endpoint, showShort, managePerm }: { title: string; endpoint: string; showShort?: boolean; managePerm?: string }) {
  const { hasPerm } = useAuth();
  const canManage = !managePerm || hasPerm(managePerm);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get(endpoint, { params: { q, page, pageSize: 20 } })
      .then((r) => {
        setRows(r.data.data);
        setTotal(r.data.total);
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setPage(1);
  }, [q, endpoint]);

  useEffect(load, [endpoint, q, page]);

  const save = async () => {
    setError('');
    try {
      const body = { name, ...(showShort ? { shortName } : {}) };
      if (editing) await api.put(`${endpoint}/${editing.id}`, body);
      else await api.post(endpoint, body);
      setModal(false);
      load();
    } catch (e) { setError(errMsg(e)); }
  };

  const deactivate = async (r: Row) => {
    if (!window.confirm(`¿Desactivar "${r.name}"?`)) return;
    try { await api.delete(`${endpoint}/${r.id}`); load(); } catch (e) { setError(errMsg(e)); }
  };

  if (loading && !rows.length) return <Spinner />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2>{title}</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <SearchBox value={q} onChange={setQ} placeholder="Buscar..." />
          {canManage && <Button onClick={() => { setEditing(null); setName(''); setShortName(''); setError(''); setModal(true); }}>+ Nuevo</Button>}
        </div>
      </div>
      <Alert type="error">{error}</Alert>
      {!canManage && <div className="alert alert-info">Vista de solo lectura: necesita permiso de gestion para crear o modificar registros.</div>}
      <Card>
        <Table head={['Nombre', ...(showShort ? ['Abreviatura'] : []), 'Estado', 'Acciones']}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><b>{r.name}</b></td>
              {showShort && <td>{(r as Row & { shortName?: string }).shortName || '-'}</td>}
              <td>{r.active ? <span className="badge badge-green">Activo</span> : <span className="badge badge-gray">Inactivo</span>}</td>
              <td>
                {canManage && <>
                  <Button variant="secondary" className="btn-sm" onClick={() => { setEditing(r); setName(r.name); setShortName((r as Row & { shortName?: string }).shortName || ''); setError(''); setModal(true); }}>Editar</Button>{' '}
                  {r.active && <Button variant="danger" className="btn-sm" onClick={() => deactivate(r)}>Desactivar</Button>}
                </>}
              </td>
            </tr>
          ))}
        </Table>
        {!rows.length && <div className="empty">Sin registros</div>}
        <Pagination page={page} total={total} pageSize={20} onChange={setPage} />
      </Card>

      <Modal title={editing ? `Editar: ${editing.name}` : `Nuevo ${title.toLowerCase().replace(/s$/, '')}`} open={modal} onClose={() => setModal(false)} footer={<>
        <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
        <Button onClick={save}>Guardar</Button>
      </>}>
        <Field label="Nombre"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        {showShort && <Field label="Abreviatura"><Input value={shortName} onChange={(e) => setShortName(e.target.value)} /></Field>}
      </Modal>
    </div>
  );
}
