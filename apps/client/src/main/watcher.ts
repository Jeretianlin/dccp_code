import { BrowserWindow, ipcMain } from 'electron';
import chokidar from 'chokidar';
import { uploadDirectory } from './uploader';

const watchers = new Map<string, chokidar.FSWatcher>();

export function setupFileWatcher(): void {
  ipcMain.on('start-watching', (_, taskId: string, dirPath: string) => {
    startWatching(taskId, dirPath);
  });

  ipcMain.on('stop-watching', (_, taskId: string) => {
    stopWatching(taskId);
  });
}

export function startWatching(taskId: string, dirPath: string): void {
  if (watchers.has(taskId)) {
    return;
  }

  const watcher = chokidar.watch(dirPath, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
  });

  watcher.on('all', (event, path) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win) => {
      win.webContents.send('file-changed', { taskId, event, path });
    });
  });

  watchers.set(taskId, watcher);
  console.log(`Started watching: ${dirPath} for task ${taskId}`);
}

export function stopWatching(taskId: string): void {
  const watcher = watchers.get(taskId);
  if (watcher) {
    watcher.close();
    watchers.delete(taskId);
    console.log(`Stopped watching for task ${taskId}`);
  }
}

export function stopAllWatchers(): void {
  watchers.forEach((watcher, taskId) => {
    watcher.close();
    console.log(`Stopped watching for task ${taskId}`);
  });
  watchers.clear();
}