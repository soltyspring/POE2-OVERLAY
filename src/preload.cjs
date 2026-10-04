const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('poe', {
  scan: () => ipcRenderer.invoke('scan'), league: value => ipcRenderer.invoke('league', value),
  auto: enabled => ipcRenderer.invoke('auto',enabled),
  options: value => ipcRenderer.invoke('scan-options',value),
  item: () => ipcRenderer.invoke('item'), open: url => ipcRenderer.invoke('open', url),
  onStatus: callback => ipcRenderer.on('status', (_event, value) => callback(value)),
  onBusy: callback => ipcRenderer.on('busy', (_event, value) => callback(value)),
  onAuto: callback => ipcRenderer.on('auto-state',(_event,value)=>callback(value)),
  onMetrics: callback => ipcRenderer.on('metrics',(_event,value)=>callback(value)),
  onRows: callback => ipcRenderer.on('rows', (_event, value) => callback(value))
});
