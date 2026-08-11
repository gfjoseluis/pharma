import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import { Card, Table, Button, Modal, Field, Input, Select, Spinner, Alert, Badge } from '../components/ui';

const MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'inventory', label: 'Inventario' },
  { key: 'purchases', label: 'Compras' },
  { key: 'branches', label: 'Sucursales/Stock' },
  { key: 'pos', label: 'Punto de Venta' },
  { key: 'pos_qr', label: 'Venta QR/Tarjeta' },
  { key: 'invoices', label: 'Facturacion SIN' },
  { key: 'reports', label: 'Reportes' },
  { key: 'clients', label: 'Clientes' },
  { key: 'users', label: 'Usuarios' },
  { key: 'licenses', label: 'Licencias' },
  { key: 'backups', label: 'Backups' },
  { key: 'logs', label: 'Logs' },
];

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
  const [branches, setBranches] = useState<Branch[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ username: '', password: '', fullName: '', role: 'cajero', branchId: '', permissions: [] as string[] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/users').then((r) => setRows(r.data)).catch((e) => setError(errMsg(e))).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get('/branches').then((r) => setBranches(r.data)).catch(() => {});
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ username: '', password: '', fullName: '', role: 'cajero', branchId: '', permissions: ['dashboard', 'pos'] });
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
    setForm((f) => ({ ...f, permissions: checked ? MODULES.map((m) => m.key) : [] }));
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
        <Table head={['Usuario', 'Nombre', 'Rol', 'Sucursal', 'Modulos habilitados', 'Estado', 'Acciones']}>
          {rows.map((u) => (
            <tr key={u.id}>
              <td><b>{u.username}</b></td>
              <td>{u.fullName}</td>
              <td><Badge color={u.role === 'admin' ? 'red' : u.role === 'tecnico' ? 'blue' : 'yellow'}>{ROLE_LABEL[u.role] || u.role}</Badge></td>
              <td>{u.branch?.name || '-'}</td>
              <td>{(u.permissions || []).length} de {MODULES.length}</td>
              <td>{u.active ? <Badge color="green">Activo</Badge> : <Badge color="gray">Inactivo</Badge>}</td>
              <td>
                <Button variant="secondary" className="btn-sm" onClick={() => openEdit(u)}>Editar</Button>{' '}
                {u.active && <Button variant="danger" className="btn-sm" onClick={() => deactivate(u)}>Desactivar</Button>}
              </td>
            </tr>
          ))}
        </Table>
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
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="admin">Admin</option>
              <option value="cajero">Cajero</option>
              <option value="tecnico">Tecnico</option>
            </Select>
          </Field>
          <Field label="Sucursal asignada">
            <Select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Sin sucursal</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
        </div>
        <h4 style={{ margin: '12px 0 6px' }}>Permisos por modulo (checkbox)</h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>{form.permissions.length} de {MODULES.length} habilitados</span>
          <div>
            <Button variant="ghost" className="btn-sm" onClick={() => setAll(true)}>Habilitar todos</Button>
            <Button variant="ghost" className="btn-sm" onClick={() => setAll(false)}>Deshabilitar todos</Button>
          </div>
        </div>
        <div className="checkbox-grid">
          {MODULES.map((m) => (
            <label className="checkbox-row" key={m.key}>
              <input type="checkbox" checked={form.permissions.includes(m.key)} onChange={() => togglePerm(m.key)} />
              {m.label}
            </label>
          ))}
        </div>
      </Modal>
    </div>
  );
}
