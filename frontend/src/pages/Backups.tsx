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
  const [lastDrive, setLastDrive] = useState<BackupRow | null>(null);
  const [task, setTask] = useState<TaskStatus | null>(null);
  const [driveReady, setDriveReady] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/backups/status').then((r) => {
      setLastLocal(r.data.lastLocal);
      setLastDrive(r.data.lastDrive);
      setTask(r.data.task);
      setDriveReady(r.data.driveReady);
    }).catch((e) => setError(errMsg(e))).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const run = async (type: 'LOCAL' | 'DRIVE') => {
    setBusy(type);
    setError('');
    try {
      await api.post('/backups/force', { type });
      load();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(''); }
  };

  const fmtSize = (bytes: string | null) => {
    if (!bytes) return '-';
    const n = Number(bytes);
    if (n > 1048576) return (n / 1048576).toFixed(2) + ' MB';
    if (n > 1024) return (n / 1024).toFixed(2) + ' KB';
    return n + ' B';
  };

  const installTask = () => {
    setError('');
    try {
      window.alert(
        'Para programar el backup diario (02:00), ejecute en PowerShell como administrador:\n\n' +
        'powershell -ExecutionPolicy Bypass -File .\\scripts\\backup-task.ps1 -Install\n\n' +
        'La tarea comprime la base y la sube a Google Drive si hay credenciales configuradas.'
      );
    } catch { /* noop */ }
  };

  if (loading) return <Spinner />;

  const BackupCard = ({ title, row }: { title: string; row: BackupRow | null }) => (
    <Card title={title}>
      {row ? (
        <>
          <p><b>Archivo:</b> {row.filename || '-'}</p>
          <p><b>Fecha:</b> {fmtDate(row.createdAt)}</p>
          <p><b>Tamaño:</b> {fmtSize(row.sizeBytes)}</p>
          <p><b>Estado:</b>{' '}
            {row.status === 'SUCCESS' ? <Badge color="green">Exitoso</Badge> : row.status === 'RUNNING' ? <Badge color="yellow">En curso</Badge> : <Badge color="red">Fallido</Badge>}
          </p>
          {row.error && <div className="alert alert-error">{row.error}</div>}
        </>
      ) : (
        <div className="empty">Sin backups</div>
      )}
    </Card>
  );

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Backups automaticos</h2>
      <Alert type="error">{error}</Alert>

      <div className="grid grid-3">
        <BackupCard title="Ultimo backup local" row={lastLocal} />
        <BackupCard title="Ultimo backup en Google Drive" row={lastDrive} />
        <Card title="Tarea programada (Windows Task Scheduler)">
          {task ? (
            <>
              <p><b>Nombre:</b> {task.name}</p>
              <p><b>Estado:</b>{' '}
                {task.status === 'Ready' ? <Badge color="green">Lista</Badge> : task.status === 'NO_FOUND' ? <Badge color="red">No instalada</Badge> : <Badge color="yellow">{task.status}</Badge>}
              </p>
              <p><b>Ultima ejecucion:</b> {task.lastRun || '-'}</p>
              <p><b>Proxima:</b> {task.nextRun || 'diaria 02:00'}</p>
            </>
          ) : (
            <div className="empty">Sin informacion de tarea</div>
          )}
          <Button variant="secondary" onClick={installTask}>Instalar / ver instrucciones</Button>
        </Card>
      </div>

      <Card title="Acciones">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="primary" disabled={!!busy} onClick={() => run('LOCAL')}>
            {busy === 'LOCAL' ? 'Generando backup local...' : 'Generar backup local'}
          </Button>
          <Button variant="success" disabled={!!busy} onClick={() => run('DRIVE')}>
            {busy === 'DRIVE' ? 'Subiendo a Drive...' : 'Subir a Drive'}
          </Button>
        </div>
        <div style={{ marginTop: 12 }}>
          <Badge color={driveReady ? 'green' : 'red'}>
            {driveReady ? 'Credenciales de Google Drive configuradas' : 'Google Drive NO configurado (backend/.env: GOOGLE_APPLICATION_CREDENTIALS)'}
          </Badge>
        </div>
        <div className="alert alert-info" style={{ marginTop: 12 }}>
          Los backups se guardan en <code>backend/backups/</code> como .sql.gz. Los logs de ejecucion de la tarea quedan en <code>backend/logs/backup-task-*.log</code>.
        </div>
      </Card>
    </div>
  );
}
