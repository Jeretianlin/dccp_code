import { ipcMain, dialog, app, clipboard } from 'electron';
import { uploadDirectory, uploadFiles, scanFiles } from './uploader';
import { startScheduler, stopScheduler, scheduleTask, cancelTask } from './scheduler';
import { getConfig, updateConfig, testConnection, getApiUrl, getBaseUrl } from './config';

export function setupIpcHandlers(): void {
  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    return result.filePaths[0] || null;
  });

  ipcMain.handle('select-files', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    return result.filePaths.length > 0 ? result.filePaths : null;
  });

  ipcMain.handle('scan-files', async (_, filePaths: string[]) => {
    return scanFiles(filePaths);
  });

  ipcMain.handle('upload-directory', async (_, taskId: string, dirPath: string, token: string, selectedFiles?: { path: string; size: number; selected: boolean }[], filterConfig?: { enabled: boolean; mode: 'INCLUDE' | 'EXCLUDE'; rules: string[] }) => {
    return uploadDirectory(taskId, dirPath, token, selectedFiles, undefined, filterConfig);
  });

  ipcMain.handle('upload-files', async (_, taskId: string, filePaths: string[], token: string, selectedFiles?: { path: string; size: number; selected: boolean }[]) => {
    return uploadFiles(taskId, filePaths, token, selectedFiles);
  });

  ipcMain.handle('get-app-path', () => {
    return {
      userData: app.getPath('userData'),
      documents: app.getPath('documents'),
      home: app.getPath('home'),
    };
  });

  ipcMain.handle('write-clipboard', (_, text: string) => {
    clipboard.writeText(text);
    return true;
  });

  ipcMain.handle('start-scheduler', async (_, token: string) => {
    await startScheduler(token);
    return true;
  });

  ipcMain.handle('stop-scheduler', () => {
    stopScheduler();
    return true;
  });

  ipcMain.handle('schedule-task', async (_, task: any, token: string) => {
    scheduleTask(task, token);
    return true;
  });

  ipcMain.handle('cancel-task', (_, taskId: string) => {
    cancelTask(taskId);
    return true;
  });

  ipcMain.handle('get-config', () => {
    return getConfig();
  });

  ipcMain.handle('update-config', (_, config: { serverUrl: string }) => {
    return updateConfig(config);
  });

  ipcMain.handle('test-connection', async (_, serverUrl: string) => {
    return testConnection(serverUrl);
  });

  ipcMain.handle('get-api-url', () => {
    return getApiUrl();
  });

  ipcMain.handle('get-base-url', () => {
    return getBaseUrl();
  });
}