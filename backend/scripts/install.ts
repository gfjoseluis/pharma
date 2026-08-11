import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Instalacion de la base de datos:
 *  1. Crea la base MySQL (farmacia) si no existe.
 *  2. Ejecuta prisma migrate dev --name init.
 *  3. Ejecuta el seed (usuarios de prueba, sucursal, catalogo y licencias).
 */
async function main(): Promise<void> {
  const root = path.resolve(__dirname, '..');
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) {
    fs.copyFileSync(path.join(root, '.env.example'), envPath);
    console.log('[OK] .env creado a partir de .env.example. Revise las credenciales de MySQL.');
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const get = (key: string): string => {
    const m = envContent.match(new RegExp(`^${key}="?([^"]*)"?`, 'm'));
    return m ? m[1] : '';
  };
  const dbHost = get('DB_HOST') || 'localhost';
  const dbPort = get('DB_PORT') || '3306';
  const dbUser = get('DB_USER') || 'root';
  const dbPassword = get('DB_PASSWORD') || '';
  const dbName = get('DB_NAME') || 'farmacia';

  console.log(`Creando base de datos "${dbName}" en ${dbHost}:${dbPort}...`);
  try {
    // dbName solo acepta caracteres alfanumericos y guion bajo (se valida antes de usar)
    if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
      throw new Error(`Nombre de base de datos invalido: ${dbName}`);
    }
    execSync(`mysql -h ${dbHost} -P ${dbPort} -u ${dbUser} ${dbPassword ? `-p${dbPassword}` : ''} -e "CREATE DATABASE IF NOT EXISTS ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"`, { stdio: 'inherit' });
    console.log('[OK] Base de datos creada.');
  } catch (err) {
    console.error('[ERROR] No se pudo crear la base de datos. Verifique que MySQL este corriendo y las credenciales en backend/.env');
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log('Ejecutando migraciones de Prisma...');
  execSync('npx prisma migrate dev --name init', { stdio: 'inherit', cwd: root });
  console.log('[OK] Migraciones aplicadas.');

  console.log('Generando cliente de Prisma...');
  execSync('npx prisma generate', { stdio: 'inherit', cwd: root });

  console.log('Ejecutando seed...');
  execSync('npx ts-node scripts/seed.ts', { stdio: 'inherit', cwd: root });
  console.log('[OK] Instalacion completada.');
}

main();
