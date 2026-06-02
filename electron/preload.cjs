const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  postJob: (payload) => ipcRenderer.invoke('POST_JOB', payload)
});
