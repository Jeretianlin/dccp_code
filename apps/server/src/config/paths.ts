import { join, dirname } from 'path';
import { env } from './env';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Process {
      pkg?: boolean;
    }
  }
}

function getBaseDir(): string {
  if (process.pkg) {
    return dirname(process.execPath);
  }
  return process.cwd();
}

const baseDir = getBaseDir();

export const paths = {
  dataDir: join(baseDir, env.DATA_DIR),
  contentDir: join(baseDir, env.DATA_DIR, 'content'),
  tasksDir: join(baseDir, env.DATA_DIR, 'tasks'),
  tempDir: join(baseDir, env.DATA_DIR, 'temp'),
};

export function getTaskDir(taskId: string) {
  return join(paths.tasksDir, taskId);
}

export function getVersionDir(taskId: string, versionNumber: number) {
  return join(paths.tasksDir, taskId, 'versions', `v${versionNumber}`);
}

export function getLatestDir(taskId: string) {
  return join(paths.tasksDir, taskId, 'latest');
}

export function getContentPath(hash: string) {
  return join(paths.contentDir, hash.substring(0, 2), hash);
}