import { app, BrowserWindow, Menu } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DataStore } from '../core/store';
import { CH } from '../shared/channels';
import { systemCipher } from './cipher';
import { registerIpc } from './ipc';
import { SessionManager } from './sessions';

const smoke = process.argv.includes('--smoke') || process.argv.includes('--screenshot');
const screenshot = process.argv.includes('--screenshot');
let quitting = false;
let mainWindow: BrowserWindow | null = null;

app.setAppUserModelId('dev.moeterm.app');
Menu.setApplicationMenu(null);

const gotLock = smoke || app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(() => {
    void createWindow();
  });
  app.on('window-all-closed', () => {
    app.quit();
  });
}

async function createWindow(): Promise<void> {
  if (smoke) {
    process.env.MOETERM_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'moeterm-'));
  }
  const dataDir = process.env.MOETERM_DATA_DIR || path.join(app.getPath('appData'), 'MoeTerm');
  const store = new DataStore(dataDir, systemCipher());
  if (screenshot) seedDemo(store);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0c100e',
    show: false,
    frame: false,
    title: 'MoeTerm',
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow = win;
  const sessions = new SessionManager(() => mainWindow, store);
  sessions.setDefaultLogging(store.getSettings().logEnabled);
  win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => undefined);
  registerIpc({
    getWindow: () => win,
    store,
    sessions,
    version: app.getVersion(),
    requestQuit() {
      quitting = true;
      sessions.closeAll();
      win.close();
    },
  });

  win.on('enter-full-screen', () => win.webContents.send(CH.winFullscreenChanged, true));
  win.on('leave-full-screen', () => win.webContents.send(CH.winFullscreenChanged, false));
  win.on('close', (event) => {
    if (!quitting && !smoke && sessions.hasLive()) {
      event.preventDefault();
      win.webContents.send(CH.appConfirmClose);
      return;
    }
    sessions.closeAll();
  });
  win.once('ready-to-show', () => win.show());

  const devServer = process.env.MOETERM_DEV_SERVER;
  if (devServer) await win.loadURL(devServer);
  else await win.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (!smoke) return;
  const ready = await win.webContents.executeJavaScript(`(async () => {
    const needFolder = ${screenshot ? 'true' : 'false'};
    const start = Date.now();
    while (Date.now() - start < 8000) {
      const folderOk = !needFolder || document.querySelector('.node.folder');
      if (window.moeterm && document.querySelector('.brand-name') && document.querySelector('.sidebar') && document.querySelector('.pet') && folderOk) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  })()`);
  if (!ready) {
    console.error('SMOKE FAILED: 界面没有就绪');
    app.exit(1);
    return;
  }
  const info = await win.webContents.executeJavaScript(`({
    brand: document.querySelector('.brand-name')?.textContent ?? '',
    folders: document.querySelectorAll('.node.folder').length
  })`);
  if (!String(info.brand).includes('MoeTerm')) {
    console.error('SMOKE FAILED', JSON.stringify(info));
    app.exit(1);
    return;
  }
  if (screenshot && Number(info.folders) < 1) {
    console.error('SMOKE FAILED: 示例目录没有出现', JSON.stringify(info));
    app.exit(1);
    return;
  }
  if (screenshot) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const image = await win.webContents.capturePage();
    const dir = path.join(process.cwd(), 'docs');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'screenshot.png'), image.toPNG());
  }
  app.exit(0);
}

function iconPath(): string {
  if (app.isPackaged) return path.join(process.resourcesPath, 'icon.png');
  return path.join(app.getAppPath(), 'build', 'icon.png');
}

function seedDemo(store: DataStore): void {
  store.createFolder(null, '存储服务器');
  const storage = store.getTree().find((node) => node.type === 'folder' && node.name === '存储服务器');
  if (!storage || storage.type !== 'folder') return;
  store.saveConnection({
    parentId: storage.id,
    name: 'nas-01',
    host: '10.0.0.11',
    port: 22,
    username: 'root',
    authType: 'password',
    saveSecret: false,
    legacyAlgorithms: false,
  });
  store.saveConnection({
    parentId: storage.id,
    name: 'nas-02',
    host: '10.0.0.12',
    port: 22,
    username: 'backup',
    authType: 'password',
    saveSecret: false,
    legacyAlgorithms: true,
  });
  store.createFolder(null, '计算节点');
}
