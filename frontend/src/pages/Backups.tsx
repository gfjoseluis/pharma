import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import { Card, Button, Spinner, Alert, fmtDate, Badge } from '../components/ui';

interface BackupRow {
  id: number;
  type: string;
  status: string;
  filename: string | null;
  sizeBytes: string | null;
  error: string | null;
  createdAt: string;
}

interface TaskStatus { name: string; status: string; lastRun: string | null; nextRun: string | null; }

export default function Backups() {
  const [lastLocal, setLastLocal] = useState<BackupRow | null>(null);
  const [task, setTask] = useState<TaskStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/backups/status').then((r) => {
      setLastLocal(r.data.lastLocal);
      setTask(r.data.task);
    }).catch((e) => setError(errMsg(e))).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/backups/force', {});
      load();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  const fmtSize = (bytes: string | null) => {
    if (!bytes) return '-';
    const n = Number(bytes);
    if (n > 1048576) return (n / 1048576).toFixed(2) + ' MB';
    if (n > 1024) return (n / 1024).toFixed(2) + ' KB';
    return n + ' B';
  };

  const installTask = () => {
    window.alert(
      'Para programar el respaldo diario, ejecute en PowerShell como administrador:\n\n' +
      'powershell -ExecutionPolicy Bypass -File .\\scripts\\backup-task.ps1 -Install\n\n' +
      'La tarea genera un .sql.gz en backend\\backups todos los días.'
    );
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Respaldos automáticos</h2>
      <Alert type="error">{error}</Alert>

      <div className="grid grid-2">
        <Card title="Último respaldo local">
          {lastLocal ? (
            <>
              <p><b>Archivo:</b> {lastLocal.filename || '-'}</p>
              <p><b>Fecha:</b> {fmtDate(lastLocal.createdAt)}</p>
              <p><b>Tamaño:</b> {fmtSize(lastLocal.sizeBytes)}</p>
              <p><b>Estado:</b>{' '}
                {lastLocal.status === 'SUCCESS' ? <Badge color="green">Exitoso</Badge> : lastLocal.status === 'RUNNING' ? <Badge color="yellow">En curso</Badge> : <Badge color="red">Fallido</Badge>}
              </p>
              {lastLocal.error && <div className="alert alert-error">{lastLocal.error}</div>}
            </>
          ) : (
            <div className="empty">Sin respaldos. Genere el primero con el botón de abajo.</div>
          )}
        </Card>
        <Card title="Tarea programada (Windows Task Scheduler)">
          {task ? (
            <>
              <p><b>Nombre:</b> {task.name}</p>
              <p><b>Estado:</b>{' '}
                {task.status === 'Ready' ? <Badge color="green">Lista</Badge> : task.status === 'NO_FOUND' ? <Badge color="red">No instalada</Badge> : <Badge color="yellow">{task.status}</Badge>}
              </p>
              <p><b>Última ejecución:</b> {task.lastRun || '-'}</p>
              <p><b>Próxima:</b> {task.nextRun || 'diaria 02:00'}</p>
            </>
          ) : (
            <div className="empty">Sin información de tarea</div>
          )}
          <Button variant="secondary" onClick={installTask}>Instalar / ver instrucciones</Button>
        </Card>
      </div>

      <Card title="Acciones">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="primary" disabled={busy} onClick={run}>
            {busy ? 'Generando respaldo...' : 'Generar respaldo ahora'}
          </Button>
        </div>
        <div className="alert alert-info" style={{ marginTop: 12 }}>
          Los respaldos se guardan en <code>backend/backups/</code> como .sql.gz. Conserve copias en un disco externo con regularidad.
        </div>
      </Card>
    </div>
  );
}
