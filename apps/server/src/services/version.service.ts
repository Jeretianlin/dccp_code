import { createHash } from 'crypto';
import { stat, readFile, mkdir, rm, cp, writeFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { prisma } from '../utils/database';
import { paths, getTaskDir, getVersionDir, getLatestDir, getContentPath } from '../config/paths';
import { updateLastUploadStatus } from './task.service';

export interface FileManifest {
  path: string;
  hash: string;
  size: number;
  modifiedAt: Date;
  mimeType?: string;
}

export async function calculateFileHash(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

export async function scanDirectory(dirPath: string): Promise<FileManifest[]> {
  const files: FileManifest[] = [];

  async function scan(path: string, base: string) {
    const entries = await readdir(path, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(path, entry.name);
      const relativePath = relative(base, fullPath);

      if (entry.isDirectory()) {
        await scan(fullPath, base);
      } else if (entry.isFile()) {
        const fileStat = await stat(fullPath);
        const hash = await calculateFileHash(fullPath);

        files.push({
          path: relativePath,
          hash,
          size: fileStat.size,
          modifiedAt: fileStat.mtime,
        });
      }
    }
  }

  await scan(dirPath, dirPath);
  return files;
}

export async function compareWithLastVersion(
  taskId: string,
  currentFiles: FileManifest[]
): Promise<{
  newFiles: FileManifest[];
  changedFiles: FileManifest[];
  unchangedFiles: FileManifest[];
}> {
  const lastVersion = await prisma.version.findFirst({
    where: { task_id: taskId },
    orderBy: { version_number: 'desc' },
    include: { files: true },
  });

  if (!lastVersion) {
    return {
      newFiles: currentFiles,
      changedFiles: [],
      unchangedFiles: [],
    };
  }

  const lastFileMap = new Map(lastVersion.files.map((f) => [f.relative_path, f]));

  const newFiles: FileManifest[] = [];
  const changedFiles: FileManifest[] = [];
  const unchangedFiles: FileManifest[] = [];

  for (const file of currentFiles) {
    const lastFile = lastFileMap.get(file.path);

    if (!lastFile) {
      newFiles.push(file);
    } else if (lastFile.file_hash !== file.hash) {
      changedFiles.push(file);
    } else {
      unchangedFiles.push(file);
    }
  }

  return { newFiles, changedFiles, unchangedFiles };
}

export async function storeFileByHash(sourcePath: string, hash: string): Promise<string> {
  const storageDir = join(paths.contentDir, hash.substring(0, 2));
  const storagePath = join(storageDir, hash);

  if (existsSync(storagePath)) {
    await prisma.contentStore.update({
      where: { file_hash: hash },
      data: { ref_count: { increment: 1 } },
    });
    return storagePath;
  }

  await mkdir(storageDir, { recursive: true });
  await cp(sourcePath, storagePath);

  const fileStat = await stat(sourcePath);
  await prisma.contentStore.create({
    data: {
      file_hash: hash,
      storage_path: storagePath,
      file_size: fileStat.size,
      ref_count: 1,
    },
  });

  return storagePath;
}

export async function createVersion(
  taskId: string,
  userId: string,
  files: FileManifest[],
  uploadType: 'MANUAL' | 'AUTO_SCHEDULED' | 'AUTO_TRIGGERED' = 'MANUAL'
) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, deleted_at: null },
  });

  if (!task) {
    throw new Error('任务不存在或已删除');
  }

  const lastVersion = await prisma.version.findFirst({
    where: { task_id: taskId },
    orderBy: { version_number: 'desc' },
    include: { files: true },
  });

  const versionNumber = lastVersion ? lastVersion.version_number + 1 : 1;
  const versionDir = getVersionDir(taskId, versionNumber);

  await mkdir(versionDir, { recursive: true });

  const uploadedFileMap = new Map(files.map((f) => [f.path, f]));

  let allFiles: FileManifest[] = [];
  let inheritedFiles: FileManifest[] = [];

  if (lastVersion && lastVersion.files.length > 0) {
    const lastVersionDir = getVersionDir(taskId, lastVersion.version_number);
    const lastManifestPath = join(lastVersionDir, 'manifest.json');
    
    if (existsSync(lastManifestPath)) {
      const lastManifest = JSON.parse(await readFile(lastManifestPath, 'utf-8'));
      const lastFiles: FileManifest[] = lastManifest.files || [];
      
      for (const lastFile of lastFiles) {
        if (uploadedFileMap.has(lastFile.path)) {
          continue;
        }
        inheritedFiles.push(lastFile);
      }
    }
  }

  allFiles = [...files, ...inheritedFiles];

  const diff = await compareWithLastVersion(taskId, files);
  const filesToStore = [...diff.newFiles, ...diff.changedFiles];

  for (const file of filesToStore) {
    await storeFileByHash(join(versionDir, file.path), file.hash);
  }

  for (const file of files) {
    const targetPath = join(versionDir, file.path);
    await mkdir(dirname(targetPath), { recursive: true });
    const sourcePath = join(versionDir, file.path);
  }

  if (lastVersion && inheritedFiles.length > 0) {
    const lastVersionDir = getVersionDir(taskId, lastVersion.version_number);
    for (const inheritedFile of inheritedFiles) {
      const sourcePath = join(lastVersionDir, inheritedFile.path);
      const targetPath = join(versionDir, inheritedFile.path);
      if (existsSync(sourcePath)) {
        await mkdir(dirname(targetPath), { recursive: true });
        await cp(sourcePath, targetPath);
      }
    }
  }

  const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0);
  const deltaSize = filesToStore.reduce((sum, f) => sum + f.size, 0);

  const version = await prisma.version.create({
    data: {
      task_id: taskId,
      version_number: versionNumber,
      created_by_id: userId,
      upload_type: uploadType,
      file_count: allFiles.length,
      total_size: BigInt(totalSize),
      delta_size: BigInt(deltaSize),
      storage_path: versionDir,
      files: {
        create: allFiles.map((f) => ({
          relative_path: f.path,
          file_hash: f.hash,
          file_size: BigInt(f.size),
          mime_type: f.mimeType,
          is_new: diff.newFiles.some((nf) => nf.path === f.path),
          is_changed: diff.changedFiles.some((cf) => cf.path === f.path),
        })),
      },
    },
    include: { files: true },
  });

  const latestDir = getLatestDir(taskId);
  await rm(latestDir, { recursive: true, force: true });
  await cp(versionDir, latestDir, { recursive: true });

  await writeFile(
    join(versionDir, 'manifest.json'),
    JSON.stringify(
      {
        version: versionNumber,
        created_at: version.created_at,
        files: allFiles,
        stats: {
          total_files: allFiles.length,
          uploaded_files: files.length,
          inherited_files: inheritedFiles.length,
          new_files: diff.newFiles.length,
          changed_files: diff.changedFiles.length,
        },
      },
      null,
      2
    )
  );

  return version;
}

export async function getVersions(taskId: string) {
  return prisma.version.findMany({
    where: { task_id: taskId },
    orderBy: { version_number: 'desc' },
    include: {
      created_by: { select: { id: true, name: true, email: true } },
      _count: { select: { files: true } },
    },
  });
}

export async function getVersion(taskId: string, versionNumber: number) {
  return prisma.version.findFirst({
    where: { task_id: taskId, version_number: versionNumber },
    include: {
      files: true,
      created_by: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function createVersionFromTemp(
  taskId: string,
  userId: string,
  files: FileManifest[],
  tempDir: string,
  uploadType: 'MANUAL' | 'AUTO_SCHEDULED' | 'AUTO_TRIGGERED' = 'MANUAL',
  autoStart: boolean = false
) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, deleted_at: null },
  });

  if (!task) {
    throw new Error('任务不存在或已删除');
  }

  const lastVersion = await prisma.version.findFirst({
    where: { task_id: taskId },
    orderBy: { version_number: 'desc' },
    include: { files: true },
  });

  const versionNumber = lastVersion ? lastVersion.version_number + 1 : 1;
  const versionDir = getVersionDir(taskId, versionNumber);

  await mkdir(versionDir, { recursive: true });

  const uploadedFileMap = new Map(files.map((f) => [f.path, f]));

  let allFiles: FileManifest[] = [];
  let inheritedFiles: FileManifest[] = [];

  if (lastVersion && lastVersion.files.length > 0) {
    const lastVersionDir = getVersionDir(taskId, lastVersion.version_number);
    const lastManifestPath = join(lastVersionDir, 'manifest.json');
    
    if (existsSync(lastManifestPath)) {
      const lastManifest = JSON.parse(await readFile(lastManifestPath, 'utf-8'));
      const lastFiles: FileManifest[] = lastManifest.files || [];
      
      for (const lastFile of lastFiles) {
        if (uploadedFileMap.has(lastFile.path)) {
          continue;
        }
        inheritedFiles.push(lastFile);
      }
    }
  }

  allFiles = [...files, ...inheritedFiles];

  const diff = await compareWithLastVersion(taskId, files);
  const filesToStore = [...diff.newFiles, ...diff.changedFiles];

  for (const file of filesToStore) {
    const sourcePath = join(tempDir, file.path);
    await storeFileByHash(sourcePath, file.hash);
  }

  for (const file of files) {
    const sourcePath = join(tempDir, file.path);
    const targetPath = join(versionDir, file.path);
    await mkdir(dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath);
  }

  if (lastVersion && inheritedFiles.length > 0) {
    const lastVersionDir = getVersionDir(taskId, lastVersion.version_number);
    for (const inheritedFile of inheritedFiles) {
      const sourcePath = join(lastVersionDir, inheritedFile.path);
      const targetPath = join(versionDir, inheritedFile.path);
      if (existsSync(sourcePath)) {
        await mkdir(dirname(targetPath), { recursive: true });
        await cp(sourcePath, targetPath);
      }
    }
  }

  const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0);
  const deltaSize = filesToStore.reduce((sum, f) => sum + f.size, 0);

  const allFilesMap = new Map(allFiles.map((f) => [f.path, f]));
  const version = await prisma.version.create({
    data: {
      task_id: taskId,
      version_number: versionNumber,
      created_by_id: userId,
      upload_type: uploadType,
      file_count: allFiles.length,
      total_size: BigInt(totalSize),
      delta_size: BigInt(deltaSize),
      storage_path: versionDir,
      files: {
        create: allFiles.map((f) => ({
          relative_path: f.path,
          file_hash: f.hash,
          file_size: BigInt(f.size),
          mime_type: f.mimeType,
          is_new: diff.newFiles.some((nf) => nf.path === f.path),
          is_changed: diff.changedFiles.some((cf) => cf.path === f.path),
        })),
      },
    },
    include: { files: true },
  });

  const latestDir = getLatestDir(taskId);
  await rm(latestDir, { recursive: true, force: true });
  await cp(versionDir, latestDir, { recursive: true });

  await writeFile(
    join(versionDir, 'manifest.json'),
    JSON.stringify(
      {
        version: versionNumber,
        created_at: version.created_at,
        files: allFiles,
        stats: {
          total_files: allFiles.length,
          uploaded_files: files.length,
          inherited_files: inheritedFiles.length,
          new_files: diff.newFiles.length,
          changed_files: diff.changedFiles.length,
        },
      },
      null,
      2
    )
  );

  const taskDir = getTaskDir(taskId);
  const metadataPath = join(taskDir, 'metadata.json');
  let metadata: any = {};
  if (existsSync(metadataPath)) {
    metadata = JSON.parse(await readFile(metadataPath, 'utf-8'));
  }
  metadata.currentVersion = versionNumber;
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

  await updateLastUploadStatus(taskId, 'SUCCESS', { versionNumber, uploadType });

  if (autoStart && task.status === 'ACCEPTED') {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'IN_PROGRESS',
        started_at: new Date(),
      },
    });
  }

  return version;
}

export async function rollbackToVersion(taskId: string, versionNumber: number) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, deleted_at: null },
  });

  if (!task) {
    throw new Error('任务不存在或已删除');
  }

  const version = await prisma.version.findFirst({
    where: { task_id: taskId, version_number: versionNumber },
    include: { files: true },
  });

  if (!version) {
    throw new Error('版本不存在');
  }

  const versionDir = getVersionDir(taskId, versionNumber);
  const latestDir = getLatestDir(taskId);

  if (!existsSync(versionDir)) {
    throw new Error('版本文件不存在');
  }

  await rm(latestDir, { recursive: true, force: true });
  await cp(versionDir, latestDir, { recursive: true });

  const taskDir = getTaskDir(taskId);
  const metadataPath = join(taskDir, 'metadata.json');
  let metadata: any = {};
  if (existsSync(metadataPath)) {
    metadata = JSON.parse(await readFile(metadataPath, 'utf-8'));
  }
  metadata.currentVersion = versionNumber;
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

  return version;
}