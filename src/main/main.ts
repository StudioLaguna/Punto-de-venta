import path from 'node:path';
import fs from 'node:fs';
import { app, BrowserWindow } from 'electron';
import { openDatabase, closeDatabase, getDb } from './db/connection';
import { registerIpcHandlers } from './ipc/handlers';
import { backupService } from './services/backupService';
import { getSetting } from './db/settingsRepo';

let win: BrowserWindow | null = null;

function dbFile(): string {
  return path.join(app.getPath('userData'), 'pos.db');
}

async function createWindow(): Promise<void> {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    await win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }
}

async function autoBackupOnExit(): Promise<void> {
  try {
    const db = getDb();
    const dir = getSetting(db, 'backup_dir');
    if (dir && fs.existsSync(dir)) {
      backupService.run(db, dir);
    }
  } catch {
    /* respaldo automático best-effort */
  }
}

app.whenReady().then(() => {
  openDatabase(dbFile());
  registerIpcHandlers();
  void createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on('before-quit', () => {
  void autoBackupOnExit();
});

app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') app.quit();
});
