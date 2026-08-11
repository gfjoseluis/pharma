import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import { Card, Table, Button, Spinner, Alert, fmtDate } from '../components/ui';

interface LogFile { filename: string; size: number; modifiedAt: string; }

export default function Logs() {
  const [files, setFiles] = useState<LogFile[]>([]);
  const [selected, setSelected] = useState<LogFile | null>(null);
  const [content, setContent] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/logs').then((r) => setFiles(r.data)).catch((e) => setError(errMsg(e))).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const open = async (f: LogFile) => {
    setSelected(f);
    setLoading(true);
    try {
      const r = await api.get(`/logs/${f.filename}`);
      setContent(r.data.content || []);
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  };

  if (loading && !files.length) return <Spinner />;

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Logs del sistema (rotacion diaria)</h2>
      <Alert type="error">{error}</Alert>
      <Alert type="info">Acceso restringido a administradores y tecnicos. Cada accion queda registrada en backend/logs/app-YYYY-MM-DD.log</Alert>
      <div className="grid grid-2">
        <Card title="Archivos de log">
          <Table head={['Archivo', 'Tamaño', 'Modificado']}>
            {files.map((f) => (
              <tr key={f.filename}>
                <td><button className="btn btn-ghost" onClick={() => open(f)}>{f.filename}</button></td>
                <td>{(f.size / 1024).toFixed(1)} KB</td>
                <td>{fmtDate(f.modifiedAt)}</td>
              </tr>
            ))}
          </Table>
          {!files.length && <div className="empty">Sin archivos de log todavia</div>}
        </Card>
        <Card title={selected ? `Contenido: ${selected.filename}` : 'Seleccione un archivo'} actions={selected && <Button variant="secondary" onClick={() => setSelected(null)}>Cerrar</Button>}>
          {selected && (
            <pre style={{ background: '#0f172a', color: '#a5f3fc', padding: 14, borderRadius: 8, maxHeight: 480, overflow: 'auto', fontSize: 12 }}>
              {content.slice().reverse().join('\n')}
            </pre>
          )}
          {!selected && <div className="empty">Elija un archivo a la izquierda para ver sus registros</div>}
        </Card>
      </div>
    </div>
  );
}
