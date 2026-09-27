const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Iniciar servidor Express en segundo plano
require('./server.js');

let mainWindow;

function createWindow() {
  const iconPath = path.join(__dirname, 'media', 'logoSistemaWeb.ico');

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'Sistema Contable',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  Menu.setApplicationMenu(null);

  const url = 'http://localhost:3000/dashboard.html';

  const tryLoad = () => {
    mainWindow.loadURL(url).then(() => {
      if (!mainWindow.isVisible()) mainWindow.show();
    }).catch(() => {
      setTimeout(tryLoad, 300);
    });
  };

  tryLoad();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setTimeout(createWindow, 300);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
