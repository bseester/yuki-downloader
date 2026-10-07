const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Fetch video metadata
  fetchInfo: (url) => ipcRenderer.invoke('fetch-info', url),

  // Download control
  startDownload: (opts) => ipcRenderer.send('start-download', opts),
  cancelDownload: (id)  => ipcRenderer.send('cancel-download', id),

  // Events from main → renderer
  onProgress: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('download-progress', handler);
    return () => ipcRenderer.removeListener('download-progress', handler);
  },
  onComplete: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('download-complete', handler);
    return () => ipcRenderer.removeListener('download-complete', handler);
  },
  onError: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('download-error', handler);
    return () => ipcRenderer.removeListener('download-error', handler);
  },

  // Finder / folder
  showInFinder:   (p) => ipcRenderer.send('show-in-finder', p),
  openDownloads:  ()  => ipcRenderer.send('open-downloads'),
  chooseFolder:   ()  => ipcRenderer.invoke('choose-folder'),
});
