import React, { useCallback, useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import { Card, Table, Button, Modal, Field, Input, SearchBox, fmtDate, Spinner, Alert, Badge } from '../components/ui';

interface Client {
  id: number;
  name: string;
  ciNit: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
}

const emptyForm = { name: '', ciNit: '', address: '', phone: '', email: '' };

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get(`/clients?q=${encodeURIComponent(q)}`)
      .then((r) => setClients(r.data))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModal(true);
  };

  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({ name: c.name, ciNit: c.ciNit, address: c.address || '', phone: c.phone || '', email: c.email || '' });
    setError('');
    setModal(true);
  };

  const save = async () => {
    setError('');
    try {
      if (editing) {
        await api.put(`/clients/${editing.id}`, form);
      } else {
        await api.post('/clients', form);
      }
      setModal(false);
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const remove = async (c: Client) => {
    if (!window.confirm(`¿Eliminar al cliente ${c.name}?`)) return;
    try {
      await api.delete(`/clients/${c.id}`);
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  if (loading && !clients.length) return <Spinner />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Clientes</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <SearchBox value={q} onChange={setQ} placeholder="Buscar por nombre o NIT/CI..." />
          <Button onClick={openNew}>+ Nuevo cliente</Button>
        </div>
      </div>
      <Alert type="error">{error}</Alert>
      <Card>
        <Table head={['Nombre', 'NIT/CI', 'Direccion', 'Telefono', 'Email', 'Registrado', 'Acciones']}>
          {clients.map((c) => (
            <tr key={c.id}>
              <td><b>{c.name}</b></td>
              <td><Badge color="blue">{c.ciNit}</Badge></td>
              <td>{c.address || '-'}</td>
              <td>{c.phone || '-'}</td>
              <td>{c.email || '-'}</td>
              <td>{fmtDate(c.createdAt)}</td>
              <td>
                <Button variant="secondary" className="btn-sm" onClick={() => openEdit(c)}>Editar</Button>{' '}
                <Button variant="danger" className="btn-sm" onClick={() => remove(c)}>Eliminar</Button>
              </td>
            </tr>
          ))}
        </Table>
        {!clients.length && <div className="empty">Sin clientes. Registre uno con NIT/CI unico.</div>}
      </Card>

      <Modal title={editing ? 'Editar cliente' : 'Nuevo cliente'} open={modal} onClose={() => setModal(false)} footer={<>
        <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
        <Button onClick={save}>Guardar</Button>
      </>}>
        <Field label="Nombre (obligatorio)"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="NIT/CI (obligatorio, unico)"><Input value={form.ciNit} onChange={(e) => setForm({ ...form, ciNit: e.target.value })} /></Field>
        <Field label="Direccion (opcional)"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <Field label="Telefono (opcional)"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Email (opcional)"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
      </Modal>
    </div>
  );
}
