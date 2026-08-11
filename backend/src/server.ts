import app from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info(`Conectado a la base de datos ${env.db.name}`);
  } catch (err) {
    logger.error('No se pudo conectar a la base de datos. Verifique MySQL y ejecute npm run install:db', { error: String(err) });
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    logger.info(`API de farmacia escuchando en http://localhost:${env.port}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`El puerto ${env.port} ya esta en uso. Ejecute scripts/restart.ps1 (o scripts/start.sh) para detener el proceso anterior.`);
    } else {
      logger.error('Error al iniciar el servidor', { error: err.message });
    }
    process.exit(1);
  });
}

main();
