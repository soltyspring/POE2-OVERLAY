const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('poe', {
  scan: mode => ipcRenderer.invoke('scan', mode),
  item: () => ipcRenderer.invoke('item'), open: url => ipcRenderer.invoke('open', url),
  onStatus: callback => ipcRenderer.on('status', (_event, value) => callback(value)),
  onBusy: callback => ipcRenderer.on('busy', (_event, value) => callback(value)),
  onMetrics: callback => ipcRenderer.on('metrics',(_event,value)=>callback(value)),
  onRows: callback => ipcRenderer.on('rows', (_event, value) => callback(value))
});
