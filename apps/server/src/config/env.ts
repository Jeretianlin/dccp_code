import { config } from 'dotenv';
import { existsSync } from 'fs';
import { dirname, join, isAbsolute } from 'path';

declare global {
  namespace NodeJS {
    interface Process {
      pkg?: boolean;
    }
  }
}

const baseDir = process.pkg ? dirname(process.execPath) : process.cwd();
const configPath = join(baseDir, 'config.env');

if (existsSync(configPath)) {
  config({ path: configPath });
}

function resolvePath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (isAbsolute(path)) return path;
  return join(baseDir, path);
}

export const env = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  DATABASE_URL: process.env.DATABASE_URL || '',
  HTTPS_ENABLED: process.env.HTTPS_ENABLED === 'true',
  HTTPS_KEY_PATH: resolvePath(process.env.HTTPS_KEY_PATH),
  HTTPS_CERT_PATH: resolvePath(process.env.HTTPS_CERT_PATH),
  JWT_SECRET: process.env.JWT_SECRET || 'default-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  DATA_DIR: process.env.DATA_DIR || './data',
  UPLOAD_CHUNK_SIZE: parseInt(process.env.UPLOAD_CHUNK_SIZE || '5242880', 10),
};