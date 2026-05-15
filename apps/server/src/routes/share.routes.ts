import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireTaskPermission } from '../middleware/permission';
import * as shareService from '../services/share.service';
import * as versionService from '../services/version.service';
import * as taskService from '../services/task.service';
import { paths } from '../config/paths';
import { join } from 'path';
import { mkdir, rm } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.get('/:shareId/page', async (req: Request, res: Response) => {
  const { shareId } = req.params;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(getSharePageHtml(shareId));
});

function getSharePageHtml(shareId: string) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>文件分享</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-gray-100">
  <div id="app" class="min-h-screen flex items-center justify-center">
    <div class="text-lg">加载中...</div>
  </div>
  <script>
    const shareId = '${shareId}';
    const API_URL = window.location.origin + '/api';
    let savedPassword = '';
    
    async function fetchShareInfo(password) {
      try {
        const params = new URLSearchParams();
        if (password) {
          savedPassword = password;
          params.append('password', password);
        }
        
        const response = await fetch(API_URL + '/share/' + shareId + '?' + params.toString());
        const data = await response.json();
        
        if (!data.success) {
          if (data.error === '密码错误') {
            showPasswordForm();
            return;
          }
          showError(data.error);
          return;
        }
        
        showShareInfo(data.data);
      } catch (err) {
        showError('获取分享信息失败');
      }
    }
    
    function showPasswordForm() {
      document.getElementById('app').innerHTML = \`
        <div class="bg-white rounded-lg p-8 w-full max-w-md shadow-lg">
          <h1 class="text-xl font-bold mb-6 text-center">访问密码</h1>
          <form onsubmit="submitPassword(event)">
            <input type="password" id="password" class="w-full border rounded px-3 py-2 mb-4" placeholder="请输入访问密码" autofocus>
            <p id="error" class="text-red-500 text-sm mb-4"></p>
            <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">确认</button>
          </form>
        </div>
      \`;
    }
    
    function submitPassword(e) {
      e.preventDefault();
      const password = document.getElementById('password').value;
      fetchShareInfo(password);
    }
    
    function showError(message) {
      document.getElementById('app').innerHTML = \`
        <div class="bg-white rounded-lg p-8 w-full max-w-md shadow-lg text-center">
          <div class="text-red-500 text-5xl mb-4">!</div>
          <h1 class="text-xl font-bold mb-2">无法访问</h1>
          <p class="text-gray-500">\${message}</p>
        </div>
      \`;
    }
    
    function showShareInfo(data) {
      const { share, version, task } = data;
      const sizeMB = version ? (Number(version.totalSize) / 1024 / 1024).toFixed(2) : '0';
      
      document.getElementById('app').innerHTML = \`
        <div class="bg-white rounded-lg p-8 w-full max-w-md shadow-lg">
          <h1 class="text-xl font-bold mb-6">文件分享</h1>
          <div class="space-y-3 mb-6">
            \${task ? \`
            <div class="border-b pb-3 mb-3">
              <span class="text-gray-500 text-sm">任务</span>
              <p class="font-medium text-lg">\${task.name}</p>
              \${task.description ? \`<p class="text-gray-500 text-sm mt-1">\${task.description}</p>\` : ''}
            </div>
            \` : ''}
            <div class="flex justify-between">
              <span class="text-gray-500">版本</span>
              <span class="font-medium">V\${version?.versionNumber || 1}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">文件数</span>
              <span>\${version?.fileCount || 0} 个</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">大小</span>
              <span>\${sizeMB} MB</span>
            </div>
            \${share.expiresAt ? \`
            <div class="flex justify-between">
              <span class="text-gray-500">过期时间</span>
              <span>\${new Date(share.expiresAt).toLocaleString()}</span>
            </div>
            \` : ''}
            \${share.maxDownloads ? \`
            <div class="flex justify-between">
              <span class="text-gray-500">下载次数</span>
              <span>\${share.downloadCount} / \${share.maxDownloads}</span>
            </div>
            \` : ''}
          </div>
          <button onclick="downloadFile()" class="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium">
            下载文件
          </button>
        </div>
      \`;
    }
    
    async function downloadFile() {
      const params = new URLSearchParams();
      if (savedPassword) params.append('password', savedPassword);
      
      window.location.href = API_URL + '/share/' + shareId + '/download?' + params.toString();
    }
    
    fetchShareInfo();
  </script>
</body>
</html>`;
}

router.post('/create', authMiddleware, requireTaskPermission('view'), async (req: AuthRequest, res) => {
  try {
    const { taskId, versionNumber, password, expiresAt, maxDownloads } = req.body;

    if (!taskId || !versionNumber) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    const share = await shareService.createShare({
      taskId,
      versionNumber: parseInt(versionNumber),
      userId: req.userId!,
      password,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      maxDownloads: maxDownloads ? parseInt(maxDownloads) : undefined,
    });

    res.json({
      success: true,
      data: {
        id: share.id,
        expiresAt: share.expires_at,
        maxDownloads: share.max_downloads,
        hasPassword: !!share.password,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
});

router.get('/task/:taskId', authMiddleware, requireTaskPermission('view'), async (req: AuthRequest, res) => {
  try {
    const shares = await shareService.getSharesByTask(req.params.taskId);
    res.json({ success: true, data: shares });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:shareId/page', async (req: Request, res: Response) => {
  const { shareId } = req.params;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(getSharePageHtml(shareId));
});

router.get('/:shareId', async (req: Request, res: Response) => {
  try {
    const { shareId } = req.params;
    const { password } = req.query;

    const share = await shareService.getShare(shareId, password as string);

    const version = await versionService.getVersion(share.task_id, share.version_number);
    const task = await taskService.getTaskById(share.task_id);

    res.json({
      success: true,
      data: {
        share: {
          id: share.id,
          expiresAt: share.expires_at,
          maxDownloads: share.max_downloads,
          downloadCount: share.download_count,
          hasPassword: !!share.password,
        },
        task: task
          ? {
              name: task.name,
              description: task.description,
            }
          : null,
        version: version
          ? {
              versionNumber: version.version_number,
              fileCount: version.file_count,
              totalSize: version.total_size.toString(),
            }
          : null,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:shareId/download', async (req: Request, res: Response) => {
  try {
    const { shareId } = req.params;
    const { password } = req.query;

    const share = await shareService.getShare(shareId, password as string);

    const tempDir = join(paths.tempDir, 'downloads', uuidv4());
    await mkdir(tempDir, { recursive: true });

    const zipPath = join(tempDir, `v${share.version_number}.zip`);

    await shareService.createVersionZip(share.task_id, share.version_number, zipPath);

    await shareService.incrementDownloadCount(shareId);

    const version = await versionService.getVersion(share.task_id, share.version_number);
    const fileName = `task-${share.task_id.substring(0, 8)}-v${share.version_number}.zip`;

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
    res.status(400).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/:shareId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await shareService.deleteShare(req.params.shareId, req.userId!);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
});

export default router;