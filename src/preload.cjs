const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('poe', {
  scan: () => ipcRenderer.invoke('scan'), league: value => ipcRenderer.invoke('league', value),
  item: () => ipcRenderer.invoke('item'), open: url => ipcRenderer.invoke('open', url),
  onStatus: callback => ipcRenderer.on('status', (_event, value) => callback(value)),
  onRows: callback => ipcRenderer.on('rows', (_event, value) => callback(value))
});
