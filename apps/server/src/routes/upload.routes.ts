import { Router } from 'express';
import multer from 'multer';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireTaskPermission } from '../middleware/permission';
import * as versionService from '../services/version.service';
import * as auditService from '../services/audit.service';
import * as taskService from '../services/task.service';
import { mkdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { paths } from '../config/paths';
import { v4 as uuidv4 } from 'uuid';

interface FileManifest {
  path: string;
  hash: string;
  size: number;
  modifiedAt: Date;
  mimeType?: string;
}

function serializeVersion(version: any) {
  return {
    ...version,
    total_size: version.total_size?.toString() || '0',
    delta_size: version.delta_size?.toString() || '0',
    files: version.files?.map((f: any) => ({
      ...f,
      file_size: f.file_size?.toString() || '0',
    })),
  };
}

const router = Router();

const upload = multer({
  dest: paths.tempDir,
  limits: { fileSize: 1024 * 1024 * 1024 * 2 },
});

router.post(
  '/init',
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { taskId } = req.body;
      const uploadId = uuidv4();
      const tempDir = join(paths.tempDir, uploadId);
      await mkdir(tempDir, { recursive: true });

      res.json({
        success: true,
        data: {
          uploadId,
          tempDir,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

router.post(
  '/chunk',
  authMiddleware,
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      const { uploadId, relativePath } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      res.json({
        success: true,
        data: {
          path: req.file.path,
          originalName: req.file.originalname,
          size: req.file.size,
          relativePath,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

router.post(
  '/complete',
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { taskId, uploadId, files, uploadType } = req.body;

      const version = await versionService.createVersion(
        taskId,
        req.userId!,
        files,
        uploadType || 'MANUAL'
      );

      const tempDir = join(paths.tempDir, uploadId);
      await rm(tempDir, { recursive: true, force: true });

      res.json({ success: true, data: serializeVersion(version) });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

router.post(
  '/files',
  authMiddleware,
  upload.array('files'),
  requireTaskPermission('upload'),
  async (req: AuthRequest, res) => {
    try {
      const { taskId, manifest, uploadType } = req.body;
      
      console.log('Upload request received:', { taskId, manifestLength: manifest?.length });
      
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ success: false, error: '没有上传文件' });
      }

const filesManifest: FileManifest[] = manifest ? JSON.parse(manifest) : [];
      
      // Clean quotes from paths if present
      filesManifest.forEach(f => {
        if (f.path.startsWith('"') && f.path.endsWith('"')) {
          f.path = f.path.slice(1, -1);
        }
      });
      
      console.log('Files manifest paths:', filesManifest.map(f => f.path));
      console.log('Uploaded files originalnames:', (req.files as Express.Multer.File[]).map(f => f.originalname));
      
      if (filesManifest.length === 0) {
        return res.status(400).json({ success: false, error: '文件清单不能为空' });
      }

      console.log(`Uploading ${req.files.length} files for task ${taskId}`);

      const uploadId = uuidv4();
      const tempDir = join(paths.tempDir, uploadId);
      await mkdir(tempDir, { recursive: true });

      const uploadedFiles = req.files as Express.Multer.File[];
      
      // Match files by index since order should be consistent
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const manifestItem = filesManifest[i];
        
        if (manifestItem) {
          const targetPath = join(tempDir, manifestItem.path);
          console.log('Moving file:', file.originalname, '->', targetPath);
          await mkdir(dirname(targetPath), { recursive: true });
          const { rename } = await import('fs/promises');
          await rename(file.path, targetPath);
        } else {
          console.log('No manifest item at index:', i);
        }
      }

      const diff = await versionService.compareWithLastVersion(taskId, filesManifest);

      const version = await versionService.createVersionFromTemp(
        taskId,
        req.userId!,
        filesManifest,
        tempDir,
        uploadType || 'MANUAL',
        (uploadType || 'MANUAL') === 'MANUAL'
      );

      await rm(tempDir, { recursive: true, force: true });

      console.log(`Version ${version.version_number} created with ${version.file_count} files`);
      
      const task = await taskService.getTaskById(taskId);
      await auditService.createAuditLog({
        category: 'TASK',
        action: 'UPLOAD',
        operatorId: req.userId,
        operatorName: req.userName,
        targetType: 'Task',
        targetId: taskId,
        targetName: task?.name,
        newValue: `V${version.version_number}`,
        description: `上传了版本 V${version.version_number}，${version.file_count} 个文件`,
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        data: {
          version: serializeVersion(version),
          diff: {
            newFiles: diff.newFiles.length,
            changedFiles: diff.changedFiles.length,
            unchangedFiles: diff.unchangedFiles.length,
          },
        },
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

export default router;