import { execSync } from 'child_process';
import path from 'path';

const root = path.resolve(__dirname, '..');

console.log('Aplicando migraciones de Prisma...');
execSync('npx prisma migrate dev', { stdio: 'inherit', cwd: root });
console.log('[OK] Migraciones aplicadas.');
