import { contextBridge, ipcRenderer } from 'electron';

const electronHandler = {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  scanFiles: (filePaths: string[]) => ipcRenderer.invoke('scan-files', filePaths),
  uploadDirectory: (taskId: string, dirPath: string, token: string, selectedFiles?: { path: string; size: number; selected: boolean }[], filterConfig?: { enabled: boolean; mode: 'INCLUDE' | 'EXCLUDE'; rules: string[] }) =>
    ipcRenderer.invoke('upload-directory', taskId, dirPath, token, selectedFiles, filterConfig),
  uploadFiles: (taskId: string, filePaths: string[], token: string, selectedFiles?: { path: string; size: number; selected: boolean }[]) =>
    ipcRenderer.invoke('upload-files', taskId, filePaths, token, selectedFiles),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  writeClipboard: (text: string) => ipcRenderer.invoke('write-clipboard', text),
  
  startScheduler: (token: string) => ipcRenderer.invoke('start-scheduler', token),
  stopScheduler: () => ipcRenderer.invoke('stop-scheduler'),
  scheduleTask: (task: any, token: string) => ipcRenderer.invoke('schedule-task', task, token),
  cancelTask: (taskId: string) => ipcRenderer.invoke('cancel-task', taskId),
  
  startWatching: (taskId: string, dirPath: string) =>
    ipcRenderer.send('start-watching', taskId, dirPath),
  stopWatching: (taskId: string) => ipcRenderer.send('stop-watching', taskId),
  
  onFileChanged: (callback: (data: { taskId: string; event: string; path: string }) => void) => {
    ipcRenderer.on('file-changed', (_, data) => callback(data));
  },
  removeFileChangedListener: () => {
    ipcRenderer.removeAllListeners('file-changed');
  },
  
  onAutoUploadCompleted: (callback: (data: { taskId: string; success: boolean; version?: any }) => void) => {
    ipcRenderer.on('auto-upload-completed', (_, data) => callback(data));
  },
  removeAutoUploadCompletedListener: () => {
    ipcRenderer.removeAllListeners('auto-upload-completed');
  },

  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: (config: { serverUrl: string }) => ipcRenderer.invoke('update-config', config),
  testConnection: (serverUrl: string) => ipcRenderer.invoke('test-connection', serverUrl),
  getApiUrl: () => ipcRenderer.invoke('get-api-url'),
  getBaseUrl: () => ipcRenderer.invoke('get-base-url'),
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;