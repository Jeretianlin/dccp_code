// 禁用 Node.js TLS 证书验证（开发和生产环境都生效，用于自签名证书）
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { setupFileWatcher } from './watcher';
import { setupIpcHandlers } from './ipc';
import { startScheduler, stopScheduler } from './scheduler';
import { getConfig } from './config';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// 信任自签名证书（开发和生产环境都生效）
app.commandLine.appendSwitch('ignore-certificate-errors');

// 处理证书错误事件（打包后必须）
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});

function createTray(): void {
  const iconPath = join(__dirname, '../../resources/icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('DCCP');
  
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示窗口', click: () => showWindow() },
    { type: 'separator' },
    { label: '退出应用', click: () => quitApp() },
  ]);
  
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      showWindow();
    }
  });
}

function showWindow(): void {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
}

function quitApp(): void {
  stopScheduler();
  tray?.destroy();
  app.quit();
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('minimize', (event: Electron.Event) => {
    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on('close', (event: Electron.Event) => {
    if (!(app as any).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    require('electron').shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.dccp.app');

  const config = getConfig();
  console.log('Server URL:', config.serverUrl);

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  setupIpcHandlers();
  setupFileWatcher();

  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  (app as any).isQuitting = true;
});

app.on('window-all-closed', () => {
  // 不自动退出，保持在托盘
});