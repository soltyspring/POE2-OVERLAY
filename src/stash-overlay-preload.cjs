const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('stashOverlay',{
  onItems:callback=>ipcRenderer.on('stash-items',(_event,items)=>callback(items))
});
