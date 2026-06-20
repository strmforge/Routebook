const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

process.env.LUSHU_CONFIG_DIR = path.join(app.getPath('userData'), 'config');

const {
  handleTurn,
  handlePlan,
  handleSpec,
  publicModelConfig,
  saveModelConfig,
  listWindows,
  loadWindow,
  createChatWindow,
  setActiveWindow,
  renameChatWindow,
  deleteChatWindow,
  importWindows,
  appInfo,
  exportWindows,
} = require('../server');

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 920,
    minHeight: 620,
    title: '路书',
    backgroundColor: '#f7f5f0',
    icon: path.join(__dirname, '..', 'assets', 'icons', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('lushu:turn', async (_event, body) => handleTurn(body || {}));
ipcMain.handle('lushu:plan', async (_event, body) => handlePlan(body || {}));
ipcMain.handle('lushu:spec', async (_event, body) => handleSpec(body || {}));
ipcMain.handle('lushu:getModels', async () => publicModelConfig());
ipcMain.handle('lushu:saveModels', async (_event, body) => saveModelConfig(body || {}));
ipcMain.handle('lushu:listWindows', async () => listWindows());
ipcMain.handle('lushu:getWindow', async (_event, windowKey) => ({ window: loadWindow(windowKey), index: listWindows() }));
ipcMain.handle('lushu:createWindow', async (_event, body) => createChatWindow((body || {}).title));
ipcMain.handle('lushu:setActiveWindow', async (_event, body) => setActiveWindow((body || {}).windowKey));
ipcMain.handle('lushu:renameWindow', async (_event, body) => renameChatWindow((body || {}).windowKey, (body || {}).title));
ipcMain.handle('lushu:deleteWindow', async (_event, body) => deleteChatWindow((body || {}).windowKey));
ipcMain.handle('lushu:importWindows', async (_event, body) => importWindows((body || {}).windows || []));
ipcMain.handle('lushu:appInfo', async () => appInfo());
ipcMain.handle('lushu:exportWindows', async () => exportWindows());
