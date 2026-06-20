const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lushuDesktop', {
  turn: (body) => ipcRenderer.invoke('lushu:turn', body),
  plan: (body) => ipcRenderer.invoke('lushu:plan', body),
  spec: (body) => ipcRenderer.invoke('lushu:spec', body),
  getModels: () => ipcRenderer.invoke('lushu:getModels'),
  saveModels: (body) => ipcRenderer.invoke('lushu:saveModels', body),
  listWindows: () => ipcRenderer.invoke('lushu:listWindows'),
  getWindow: (windowKey) => ipcRenderer.invoke('lushu:getWindow', windowKey),
  createWindow: (body) => ipcRenderer.invoke('lushu:createWindow', body),
  setActiveWindow: (body) => ipcRenderer.invoke('lushu:setActiveWindow', body),
  renameWindow: (body) => ipcRenderer.invoke('lushu:renameWindow', body),
  deleteWindow: (body) => ipcRenderer.invoke('lushu:deleteWindow', body),
  importWindows: (body) => ipcRenderer.invoke('lushu:importWindows', body),
  appInfo: () => ipcRenderer.invoke('lushu:appInfo'),
  exportWindows: () => ipcRenderer.invoke('lushu:exportWindows'),
});
