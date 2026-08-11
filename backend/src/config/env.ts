import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  port: parseInt(process.env.PORT || '4000', 10),
  databaseUrl: process.env.DATABASE_URL || 'mysql://root:@localhost:3306/farmacia',
  jwtSecret: process.env.JWT_SECRET || 'cambiar-esta-clave-por-una-segura',
  jwtExpires: process.env.JWT_EXPIRES || '12h',
  googleCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'farmacia',
  },
  mysqldumpPath: process.env.MYSQLDUMP_PATH || 'mysqldump',
};

export const paths = {
  backendRoot: path.resolve(__dirname, '../..'),
  logs: path.resolve(__dirname, '../../logs'),
  backups: path.resolve(__dirname, '../../backups'),
};
