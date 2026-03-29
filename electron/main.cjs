const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 350,
    height: 500,
    title: "DeepWork",
    icon: path.join(__dirname, '../build/icon.png'),
    frame: false,        // Frameless — custom window controls in React UI
    transparent: true,
    alwaysOnTop: true,   // Floating widget stays above other windows
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    // win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// IPC handlers for custom window controls
ipcMain.on('window-close',    () => win?.close());
ipcMain.on('window-minimize', () => win?.minimize());

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
