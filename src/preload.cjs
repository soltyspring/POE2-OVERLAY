const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('poe', {
  scan: mode => ipcRenderer.invoke('scan', mode),
  getHotkeys: () => ipcRenderer.invoke('hotkeys:get'),
  beginHotkeyCapture: action => ipcRenderer.invoke('hotkeys:begin', action),
  cancelHotkeyCapture: action => ipcRenderer.invoke('hotkeys:cancel', action),
  setHotkey: (action, accelerator) => ipcRenderer.invoke('hotkeys:set', action, accelerator),
  item: () => ipcRenderer.invoke('item'), open: url => ipcRenderer.invoke('open', url),
  onStatus: callback => ipcRenderer.on('status', (_event, value) => callback(value)),
  onBusy: callback => ipcRenderer.on('busy', (_event, value) => callback(value)),
  onHealth: callback => ipcRenderer.on('health',(_event,value)=>callback(value)),
  onMetrics: callback => ipcRenderer.on('metrics',(_event,value)=>callback(value)),
  onRows: callback => ipcRenderer.on('rows', (_event, value) => callback(value)),
  onHotkeys: callback => ipcRenderer.on('hotkeys', (_event, value) => callback(value)),
  stashToggle: () => ipcRenderer.invoke('stash-toggle'),
  stashRemoveAtCursor: () => ipcRenderer.invoke('stash-remove-at-cursor'),
  stashClear: () => ipcRenderer.invoke('stash-clear'),
  onStashState: callback => ipcRenderer.on('stash-state',(_event,value)=>callback(value))
});
