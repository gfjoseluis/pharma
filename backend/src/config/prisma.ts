import { PrismaClient } from '@prisma/client';
import { env } from './env';

// Pool acotado con timeout corto: si se cambia de instancia de base de datos
// (o la BD se reinicia), las conexiones viejas fallan rapido en lugar de
// colgar peticiones, y Prisma vuelve a conectar solo en la siguiente consulta.
const url = new URL(env.databaseUrl);
url.searchParams.set('connection_limit', '5');
url.searchParams.set('pool_timeout', '10');

export const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
