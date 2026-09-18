import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import SelectSearch from '../components/SelectSearch';
import { Card, Table, Button, Modal, Field, Input, Spinner, Alert, Badge, Pagination } from '../components/ui';
import { ACTION_GROUPS, ACTION_LABELS, ALL_ACTIONS } from '../perms';

interface Branch { id: number; name: string; }

interface UserRow {
  id: number;
  username: string;
  fullName: string;
  role: string;
  active: boolean;
  branchId: number | null;
  permissions: string[];
  branch: { id: number; name: string } | null;
  createdAt: string;
}

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', cajero: 'Cajero', tecnico: 'Tecnico' };

export default function Users() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ username: '', password: '', fullName: '', role: 'cajero', branchId: '', permissions: [] as string[] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = (pg: number = page) => {
    setLoading(true);
    api.get('/users', { params: { page: pg, pageSize: 20 } })
      .then((r) => {
        setRows(r.data.data);
        setTotal(r.data.total);
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1);
    api.get('/branches', { params: { pageSize: 100 } }).then((r) => setBranches(r.data.data)).catch(() => {});
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ username: '', password: '', fullName: '', role: 'cajero', branchId: '', permissions: ['dashboard.view', 'pos.view', 'pos.sale', 'sales.view', 'clients.view', 'clients.create', 'products.view'] });
    setError('');
    setModal(true);
  };

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setForm({ username: u.username, password: '', fullName: u.fullName, role: u.role, branchId: u.branchId ? String(u.branchId) : '', permissions: u.permissions || [] });
    setError('');
    setModal(true);
  };

  const togglePerm = (key: string) => {
    setForm((f) => ({ ...f, permissions: f.permissions.includes(key) ? f.permissions.filter((p) => p !== key) : [...f.permissions, key] }));
  };

  const setAll = (checked: boolean) => {
    setForm((f) => ({ ...f, permissions: checked ? [...ALL_ACTIONS] : [] }));
  };

  const save = async () => {
    setError('');
    try {
      const body = {
        username: form.username,
        fullName: form.fullName,
        role: form.role,
        branchId: form.branchId ? parseInt(form.branchId, 10) : null,
        permissions: form.permissions,
      };
      if (form.password) (body as Record<string, unknown>).password = form.password;
      if (editing) await api.put(`/users/${editing.id}`, body);
      else await api.post('/users', body);
      setModal(false);
      load();
    } catch (e) { setError(errMsg(e)); }
  };

  const deactivate = async (u: UserRow) => {
    if (!window.confirm(`¿Desactivar a ${u.fullName}?`)) return;
    try { await api.delete(`/users/${u.id}`); load(); } catch (e) { setError(errMsg(e)); }
  };

  if (loading && !rows.length) return <Spinner />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Usuarios y permisos</h2>
        <Button onClick={openNew}>+ Nuevo usuario</Button>
      </div>
      <Alert type="error">{error}</Alert>
      <Card>
        <Table head={['Usuario', 'Nombre', 'Rol', 'Sucursal', 'Acciones habilitadas', 'Estado', 'Acciones']}>
          {rows.map((u) => (
            <tr key={u.id}>
              <td><b>{u.username}</b></td>
              <td>{u.fullName}</td>
              <td><Badge color={u.role === 'admin' ? 'red' : u.role === 'tecnico' ? 'blue' : 'yellow'}>{ROLE_LABEL[u.role] || u.role}</Badge></td>
              <td>{u.branch?.name || '-'}</td>
              <td>{(u.permissions || []).length} de {ALL_ACTIONS.length}</td>
              <td>{u.active ? <Badge color="green">Activo</Badge> : <Badge color="gray">Inactivo</Badge>}</td>
              <td>
                <Button variant="secondary" className="btn-sm" onClick={() => openEdit(u)}>Editar</Button>{' '}
                {u.active && <Button variant="danger" className="btn-sm" onClick={() => deactivate(u)}>Desactivar</Button>}
              </td>
            </tr>
          ))}
        </Table>
        <Pagination page={page} total={total} pageSize={20} onChange={(p) => { setPage(p); load(p); }} />
      </Card>

      <Modal title={editing ? `Editar usuario: ${editing.fullName}` : 'Nuevo usuario'} open={modal} onClose={() => setModal(false)} footer={<>
        <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
        <Button onClick={save}>Guardar</Button>
      </>}>
        <div className="form-row">
          <Field label="Usuario"><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
          <Field label={editing ? 'Nueva contraseña (dejar vacio para mantener)' : 'Contraseña'}>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Nombre completo"><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
          <Field label="Rol">
            <SelectSearch
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v })}
              options={[
                { value: 'admin', label: 'Admin' },
                { value: 'cajero', label: 'Cajero' },
                { value: 'tecnico', label: 'Tecnico' },
              ]}
            />
          </Field>
          <Field label="Sucursal asignada">
            <SelectSearch
              value={form.branchId}
              onChange={(v) => setForm({ ...form, branchId: v })}
              options={[
                { value: '', label: 'Sin sucursal' },
                ...branches.map((b) => ({ value: String(b.id), label: b.name })),
              ]}
              placeholder="Sin sucursal"
            />
          </Field>
        </div>
        {form.role !== 'admin' && (
          <>
            <div className="alert alert-info" style={{ marginTop: 8 }}>
              La cuenta admin siempre tiene todos los permisos. Para el resto, marque las acciones puntuales.
            </div>
            <div className="alert" style={{ background: '#fef3c7', color: '#92400e', marginTop: 8 }}>
              ⚠️ Importante: los permisos se aplican en el <b>próximo inicio de sesión</b> del usuario. Si el usuario
              ya estaba conectado, debe cerrar sesión y volver a entrar (su token actual conserva los permisos
              antiguos por hasta 12 horas).
            </div>
            <h4 style={{ margin: '12px 0 6px' }}>Permisos por accion</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>{form.permissions.length} de {ALL_ACTIONS.length} habilitados</span>
              <div>
                <Button variant="ghost" className="btn-sm" onClick={() => setAll(true)}>Habilitar todos</Button>
                <Button variant="ghost" className="btn-sm" onClick={() => setAll(false)}>Deshabilitar todos</Button>
              </div>
            </div>
            {Object.entries(ACTION_GROUPS).map(([group, actions]) => (
              <div key={group} style={{ marginBottom: 10 }}>
                <b style={{ fontSize: 13 }}>{group}</b>
                <div className="checkbox-grid" style={{ marginTop: 4 }}>
                  {actions.map((a) => (
                    <label className="checkbox-row" key={a}>
                      <input type="checkbox" checked={form.permissions.includes(a)} onChange={() => togglePerm(a)} />
                      {ACTION_LABELS[a] || a}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </Modal>
    </div>
  );
}