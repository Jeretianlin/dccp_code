import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireTaskPermission } from '../middleware/permission';
import * as versionService from '../services/version.service';
import * as shareService from '../services/share.service';
import { paths } from '../config/paths';
import { join } from 'path';
import { mkdir, rm } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

const router = Router({ mergeParams: true });

function serializeVersion(version: any) {
  if (!version) return version;
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

function serializeVersions(versions: any[]) {
  return versions.map(serializeVersion);
}

router.get('/:taskId/versions', authMiddleware, requireTaskPermission('view'), async (req: AuthRequest, res) => {
  try {
    const versions = await versionService.getVersions(req.params.taskId);
    res.json({ success: true, data: serializeVersions(versions) });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:taskId/versions/:version', authMiddleware, requireTaskPermission('view'), async (req: AuthRequest, res) => {
  try {
    const version = await versionService.getVersion(
      req.params.taskId,
      parseInt(req.params.version)
    );
    if (!version) {
      return res.status(404).json({ success: false, error: 'Version not found' });
    }
    res.json({ success: true, data: serializeVersion(version) });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post(
  '/:taskId/versions/:version/rollback',
  authMiddleware,
  requireTaskPermission('edit'),
  async (req: AuthRequest, res) => {
    try {
      const versionNumber = parseInt(req.params.version);
      const version = await versionService.rollbackToVersion(
        req.params.taskId,
        versionNumber
      );
      res.json({ success: true, data: serializeVersion(version) });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }
);

router.get(
  '/:taskId/versions/:version/download',
  authMiddleware,
  requireTaskPermission('view'),
  async (req: AuthRequest, res) => {
    try {
      const { taskId, version } = req.params;
      const versionNumber = parseInt(version);

      const versionData = await versionService.getVersion(taskId, versionNumber);
      if (!versionData) {
        return res.status(404).json({ success: false, error: '版本不存在' });
      }

      const tempDir = join(paths.tempDir, 'downloads', uuidv4());
      await mkdir(tempDir, { recursive: true });

      const zipPath = join(tempDir, `v${versionNumber}.zip`);

      await shareService.createVersionZip(taskId, versionNumber, zipPath);

      const fileName = `task-${taskId.substring(0, 8)}-v${versionNumber}.zip`;

      res.download(zipPath, fileName, async (err) => {
        if (err) {
          console.error('Download error:', err);
        }
        setTimeout(async () => {
          try {
            await rm(tempDir, { recursive: true, force: true });
          } catch (e) {
            console.error('Cleanup error:', e);
          }
        }, 5000);
      });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

export default router;