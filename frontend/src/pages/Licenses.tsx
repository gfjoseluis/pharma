import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import { Card, Table, Button, Modal, Field, Input, Spinner, Alert, Badge } from '../components/ui';

interface License {
  id: string;
  module: string;
  status: string;
  license_key: string | null;
  activatedAt: string | null;
}

const MODULE_INFO: Record<string, string> = {
  POS: 'Punto de venta',
  QR: 'Pagos con QR y tarjeta',
  FACTURACION: 'Facturacion SIN',
  REPORTES: 'Reportes avanzados',
  BACKUPS: 'Backups automaticos',
  INVENTARIO: 'Inventario y compras',
};

export default function Licenses() {
  const [rows, setRows] = useState<License[]>([]);
  const [modal, setModal] = useState(false);
  const [target, setTarget] = useState<License | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/licenses').then((r) => setRows(r.data)).catch((e) => setError(errMsg(e))).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const activate = async () => {
    if (!target) return;
    setError('');
    try {
      await api.post('/licenses/activate', { module: target.module, code });
      setModal(false);
      load();
    } catch (e) { setError(errMsg(e)); }
  };

  const deactivate = async (l: License) => {
    if (!window.confirm(`¿Desactivar el modulo ${l.module}?`)) return;
    try { await api.post('/licenses/deactivate', { module: l.module }); load(); } catch (e) { setError(errMsg(e)); }
  };

  if (loading && !rows.length) return <Spinner />;

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Licencias de modulos</h2>
      <Alert type="info">Los codigos de licencia son eternos (sin expiracion). Ingrese el codigo unico para activar cada modulo.</Alert>
      <Alert type="error">{error}</Alert>
      <Card>
        <Table head={['Modulo', 'Funcion', 'Estado', 'Codigo', 'Activada', 'Acciones']}>
          {rows.map((l) => (
            <tr key={l.id}>
              <td><b>{l.module}</b></td>
              <td>{MODULE_INFO[l.module] || l.module}</td>
              <td>
                {l.status === 'ACTIVE' ? (
                  <Badge color="green">Licencia valida</Badge>
                ) : (
                  <Badge color="gray">No licenciado</Badge>
                )}
              </td>
              <td>{l.license_key ? <code>{l.license_key}</code> : '-'}</td>
              <td>{l.activatedAt ? new Date(l.activatedAt).toLocaleDateString() : '-'}</td>
              <td>
                {l.status === 'ACTIVE' ? (
                  <>
                    <span className="badge badge-green">✓ Activo</span>{' '}
                    <Button variant="danger" className="btn-sm" onClick={() => deactivate(l)}>Desactivar</Button>
                  </>
                ) : (
                  <Button className="btn-sm" onClick={() => { setTarget(l); setCode(''); setError(''); setModal(true); }}>Ingresar codigo</Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
        {!rows.length && <div className="empty">Sin modulos de licencia</div>}
      </Card>

      <Modal title={`Activar modulo ${target?.module || ''}`} open={modal} onClose={() => setModal(false)} footer={<>
        <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
        <Button onClick={activate}>Activar</Button>
      </>}>
        <Field label="Codigo de licencia">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={`Ej: ${target?.module}-XXXX-XXXX`} />
        </Field>
        {target && (
          <div className="alert alert-info">
            Formato esperado: <b>{target.module}-XXXX-XXXX</b> (ej: POS-1234-ABCD). La licencia no expira.
          </div>
        )}
      </Modal>
    </div>
  );
}
