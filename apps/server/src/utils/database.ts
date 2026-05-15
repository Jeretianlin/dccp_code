import { PrismaClient } from '@prisma/client';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { paths } from '../config/paths';

declare global {
  namespace NodeJS {
    interface Process {
      pkg?: boolean;
    }
  }
}

function getPrismaEnginePath(): string | undefined {
  if (process.pkg) {
    const baseDir = dirname(process.execPath);
    return join(baseDir, 'prisma-engines', 'query_engine-windows.dll.node');
  }
  return undefined;
}

const enginePath = getPrismaEnginePath();
if (enginePath) {
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = enginePath;
}

export const prisma = new PrismaClient();

export async function initDatabase() {
  await mkdir(paths.dataDir, { recursive: true });
  await mkdir(paths.contentDir, { recursive: true });
  await mkdir(paths.tasksDir, { recursive: true });
  await mkdir(paths.tempDir, { recursive: true });
  
  console.log('Database initialized');
}