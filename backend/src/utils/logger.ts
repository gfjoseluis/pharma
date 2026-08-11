import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import fs from 'fs';
import { paths } from '../config/env';

fs.mkdirSync(paths.logs, { recursive: true });

const { combine, timestamp, printf, colorize, json } = winston.format;

const fileFormat = combine(timestamp(), json());

const rotate = new DailyRotateFile({
  dirname: paths.logs,
  filename: 'app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '10m',
  maxFiles: '30d',
  format: fileFormat,
});

const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ level, message, timestamp: ts, module, userId }) =>
    `[${ts}] [${module || 'app'}]${userId ? ` [user:${userId}]` : ''} ${level}: ${message}`
  )
);

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: fileFormat,
  transports: [rotate, new winston.transports.Console({ format: consoleFormat })],
});

export interface LogContext {
  module?: string;
  userId?: number;
}

/** Registra una accion en el log rotativo diario. */
export function logAction(level: 'info' | 'warn' | 'error', action: string, details?: Record<string, unknown>, ctx?: LogContext): void {
  logger.log({ level, message: action, ...(details || {}), ...(ctx || {}) });
}
