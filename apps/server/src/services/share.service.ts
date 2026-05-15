import { prisma } from '../utils/database';
import { getVersionDir } from '../config/paths';
import { existsSync } from 'fs';
import { readdir, stat, readFile } from 'fs/promises';
import { join, basename } from 'path';
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import { v4 as uuidv4 } from 'uuid';

export interface CreateShareData {
  taskId: string;
  versionNumber: number;
  userId: string;
  password?: string;
  expiresAt?: Date;
  maxDownloads?: number;
}

export async function createShare(data: CreateShareData) {
  const version = await prisma.version.findFirst({
    where: { task_id: data.taskId, version_number: data.versionNumber },
  });

  if (!version) {
    throw new Error('版本不存在');
  }

  const share = await prisma.share.create({
    data: {
      id: uuidv4(),
      task_id: data.taskId,
      version_number: data.versionNumber,
      created_by_id: data.userId,
      password: data.password,
      expires_at: data.expiresAt,
      max_downloads: data.maxDownloads,
    },
  });

  return share;
}

export async function getShare(shareId: string, password?: string) {
  const share = await prisma.share.findUnique({
    where: { id: shareId },
  });

  if (!share) {
    throw new Error('分享不存在');
  }

  if (share.expires_at && new Date() > share.expires_at) {
    throw new Error('分享已过期');
  }

  if (share.max_downloads && share.download_count >= share.max_downloads) {
    throw new Error('下载次数已达上限');
  }

  if (share.password && share.password !== password) {
    throw new Error('密码错误');
  }

  return share;
}

export async function incrementDownloadCount(shareId: string) {
  await prisma.share.update({
    where: { id: shareId },
    data: { download_count: { increment: 1 } },
  });
}

export async function getSharesByTask(taskId: string) {
  return prisma.share.findMany({
    where: { task_id: taskId },
    orderBy: { created_at: 'desc' },
  });
}

export async function deleteShare(shareId: string, userId: string) {
  const share = await prisma.share.findUnique({
    where: { id: shareId },
  });

  if (!share) {
    throw new Error('分享不存在');
  }

  if (share.created_by_id !== userId) {
    throw new Error('无权删除此分享');
  }

  await prisma.share.delete({
    where: { id: shareId },
  });
}

export async function createVersionZip(
  taskId: string,
  versionNumber: number,
  outputPath: string
): Promise<void> {
  const versionDir = getVersionDir(taskId, versionNumber);

  if (!existsSync(versionDir)) {
    throw new Error('版本文件不存在');
  }

  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 3 } });

    output.on('close', () => resolve());
    archive.on('error', (err: Error) => reject(err));

    archive.pipe(output);
    
    async function addDirectoryToArchive(dir: string, basePath: string = '') {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const entryPath = basePath ? join(basePath, entry.name) : entry.name;
        
        if (entry.name === 'manifest.json') continue;
        
        if (entry.isDirectory()) {
          await addDirectoryToArchive(fullPath, entryPath);
        } else {
          archive.file(fullPath, { name: entryPath });
        }
      }
    }
    
    addDirectoryToArchive(versionDir).then(() => {
      archive.finalize();
    }).catch(reject);
  });
}

export async function getVersionFiles(taskId: string, versionNumber: number) {
  const versionDir = getVersionDir(taskId, versionNumber);

  if (!existsSync(versionDir)) {
    return [];
  }

  const files: { path: string; size: number }[] = [];

  async function scan(dir: string, base: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = join(base, entry.name);

      if (entry.isDirectory()) {
        await scan(fullPath, relativePath);
      } else if (entry.isFile() && entry.name !== 'manifest.json') {
        const fileStat = await stat(fullPath);
        files.push({
          path: relativePath,
          size: fileStat.size,
        });
      }
    }
  }

  await scan(versionDir, '');
  return files;
}