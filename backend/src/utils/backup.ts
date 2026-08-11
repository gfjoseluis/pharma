import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { env, paths } from '../config/env';

const execFileP = promisify(execFile);

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 1024 * 1024 * 200 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

/** Dump de la base de datos MySQL comprimido en .sql.gz */
export async function dumpDatabase(): Promise<{ file: string; size: number }> {
  fs.mkdirSync(paths.backups, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const rawFile = path.join(paths.backups, `farmacia-${stamp}.sql`);
  const out = await run(env.mysqldumpPath, [
    `--host=${env.db.host}`,
    `--port=${String(env.db.port)}`,
    `--user=${env.db.user}`,
    `--password=${env.db.password}`,
    env.db.name,
  ]);
  fs.writeFileSync(rawFile, out, 'utf8');
  const stats = fs.statSync(rawFile);
  return { file: rawFile, size: stats.size };
}

export interface DriveService {
  ready: boolean;
  upload(file: string): Promise<{ driveFileId: string; driveFileName: string }>;
}

/** Servicio de Google Drive basado en service account. */
export function createDriveService(): DriveService {
  const credentialsPath = env.googleCredentials;
  if (!credentialsPath || !fs.existsSync(credentialsPath)) {
    return {
      ready: false,
      async upload() {
        throw new Error('Credenciales de Google Drive no configuradas (GOOGLE_APPLICATION_CREDENTIALS). Configurelas en backend/.env');
      },
    };
  }
  return {
    ready: true,
    async upload(file: string) {
      const { google } = await import('googleapis');
      const auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });
      const drive = google.drive({ version: 'v3', auth });
      const fileName = path.basename(file);
      const res = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: env.googleDriveFolderId ? [env.googleDriveFolderId] : undefined,
        },
        media: { body: fs.createReadStream(file) },
        fields: 'id,name',
      });
      return { driveFileId: String(res.data.id), driveFileName: String(res.data.name) };
    },
  };
}

/** Estado de la tarea programada en Windows (schtasks). */
export async function taskSchedulerStatus(): Promise<{ name: string; status: string; lastRun: string | null; nextRun: string | null }> {
  try {
    const { stdout } = await execFileP('schtasks', ['/query', '/tn', 'FarmaciaBackup', '/fo', 'csv', '/v']);
    const lines = stdout.split(/\r?\n/);
    if (lines.length < 2) return { name: 'FarmaciaBackup', status: 'NO_FOUND', lastRun: null, nextRun: null };
    const cols = lines[1].split(',').map((c) => c.replace(/^"|"$/g, ''));
    const status = cols[0] || 'UNKNOWN';
    const lastRun = cols.find((c) => c && c !== 'STATUS' && c !== 'TASKNAME') ? null : null;
    // Columnas tipicas: TaskName, Next Run Time, Status, Last Run Time, ...
    return {
      name: 'FarmaciaBackup',
      status,
      lastRun: cols[3] || null,
      nextRun: cols[1] || null,
    };
  } catch {
    return { name: 'FarmaciaBackup', status: 'NO_FOUND', lastRun: null, nextRun: null };
  }
}

/** Comprime el dump con gzip en el mismo directorio. */
export async function gzipFile(file: string): Promise<string> {
  const gzFile = `${file}.gz`;
  await pipeline(
    fs.createReadStream(file),
    createGzip(),
    fs.createWriteStream(gzFile)
  );
  fs.unlinkSync(file);
  return gzFile;
}
