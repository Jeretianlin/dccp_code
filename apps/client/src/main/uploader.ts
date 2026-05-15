import { createHash } from 'crypto';
import { stat, readdir, readFile } from 'fs/promises';
import { join, relative, basename } from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import { getApiUrl } from './config';

interface FileManifest {
  path: string;
  hash: string;
  size: number;
  modifiedAt: Date;
  mimeType?: string;
}

interface FileFilterConfig {
  enabled: boolean;
  mode: 'INCLUDE' | 'EXCLUDE';
  rules: string[];
}

async function calculateFileHash(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function filterFiles(
  files: FileManifest[],
  filterConfig: FileFilterConfig | undefined
): FileManifest[] {
  if (!filterConfig || !filterConfig.enabled || !filterConfig.rules || filterConfig.rules.length === 0) {
    return files;
  }

  return files.filter(file => {
    const fileName = basename(file.path);
    const matches = filterConfig.rules.some(rule => fileName.includes(rule));

    if (filterConfig.mode === 'INCLUDE') {
      return matches;
    } else {
      return !matches;
    }
  });
}

async function scanDirectory(dirPath: string): Promise<FileManifest[]> {
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

async function scanFilePaths(filePaths: string[]): Promise<{ manifest: FileManifest[]; basePath: string }> {
  const files: FileManifest[] = [];
  let basePath = '';

  for (const filePath of filePaths) {
    const fileStat = await stat(filePath);

    if (fileStat.isDirectory()) {
      const dirFiles = await scanDirectory(filePath);
      files.push(...dirFiles);
      if (!basePath) {
        basePath = filePath;
      }
    } else {
      const hash = await calculateFileHash(filePath);
      files.push({
        path: basename(filePath),
        hash,
        size: fileStat.size,
        modifiedAt: fileStat.mtime,
      });
      if (!basePath) {
        basePath = join(filePath, '..');
      }
    }
  }

  return { manifest: files, basePath };
}

export async function scanFiles(filePaths: string[]): Promise<{ files: FileManifest[]; totalSize: number }> {
  const { manifest } = await scanFilePaths(filePaths);
  const totalSize = manifest.reduce((sum, f) => sum + f.size, 0);
  return { files: manifest, totalSize };
}

export async function uploadDirectory(
  taskId: string,
  dirPath: string,
  token: string,
  selectedFiles?: { path: string; size: number; selected: boolean }[],
  uploadType?: 'MANUAL' | 'AUTO_SCHEDULED' | 'AUTO_TRIGGERED',
  filterConfig?: FileFilterConfig
): Promise<{ success: boolean; data?: { version?: any; diff?: any }; error?: string }> {
  try {
    console.log('uploadDirectory called:', { taskId, dirPath, selectedFilesCount: selectedFiles?.length, filterConfig });

    let filePathsToUpload: string[];

    if (selectedFiles && selectedFiles.length > 0) {
      filePathsToUpload = selectedFiles
        .filter(f => f.selected)
        .map(f => f.path);
      console.log('Selected paths to upload:', filePathsToUpload);
    } else {
      const files = await scanDirectory(dirPath);
      const filteredFiles = filterFiles(files, filterConfig);
      filePathsToUpload = filteredFiles.map(f => f.path);
      console.log('Filtered files to upload:', filePathsToUpload.length, 'of', files.length);
    }

    const manifest: FileManifest[] = [];
    for (const relativePath of filePathsToUpload) {
      const fullPath = join(dirPath, relativePath);
      console.log('Processing file:', { relativePath, fullPath });
      
      try {
        const fileStat = await stat(fullPath);
        const hash = await calculateFileHash(fullPath);

        manifest.push({
          path: relativePath,
          hash,
          size: fileStat.size,
          modifiedAt: fileStat.mtime,
        });
      } catch (fileError: any) {
        console.error('Failed to process file:', fullPath, fileError.message);
        throw new Error(`文件不存在: ${fullPath}`);
      }
    }

    const formData = new FormData();
    formData.append('taskId', taskId);
    formData.append('manifest', JSON.stringify(manifest));
    formData.append('uploadType', uploadType || 'MANUAL');

    for (const file of manifest) {
      const filePath = join(dirPath, file.path);
      formData.append('files', createReadStream(filePath), {
        filename: file.path,
      });
    }

    const response = await axios.post(`${getApiUrl()}/upload/files`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...formData.getHeaders(),
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message,
    };
  }
}

export async function uploadFiles(
  taskId: string,
  filePaths: string[],
  token: string,
  selectedFiles?: { path: string; size: number; selected: boolean }[],
  uploadType?: 'MANUAL' | 'AUTO_SCHEDULED' | 'AUTO_TRIGGERED'
): Promise<{ success: boolean; version?: any; error?: string }> {
  try {
    // 如果提供了选中的文件列表，则使用该列表
    let filteredPaths = filePaths;
    if (selectedFiles && selectedFiles.length > 0) {
      const selectedPaths = selectedFiles.filter(f => f.selected).map(f => f.path);
      // 对于直接选择的文件，路径就是文件名
      filteredPaths = filePaths.filter(fp => selectedPaths.includes(basename(fp)));
    }
    
    // 扫描这些选中的文件
    const { manifest } = await scanFilePaths(filteredPaths);
    
    if (manifest.length === 0) {
      return { success: false, error: '没有找到可上传的文件' };
    }

    const formData = new FormData();
    formData.append('taskId', taskId);
    formData.append('manifest', JSON.stringify(manifest));
    formData.append('uploadType', uploadType || 'MANUAL');

    for (const file of manifest) {
      // 找到原始路径
      let originalPath: string | undefined;
      for (const fp of filePaths) {
        if (basename(fp) === file.path) {
          originalPath = fp;
          break;
        }
      }
      
      if (!originalPath) continue;

      formData.append('files', createReadStream(originalPath), {
        filename: file.path,
      });
    }

    const response = await axios.post(`${getApiUrl()}/upload/files`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...formData.getHeaders(),
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message,
    };
  }
}