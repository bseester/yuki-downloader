const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Fetch video / Spotify metadata
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
  showInFinder:  (p) => ipcRenderer.send('show-in-finder', p),
  openDownloads: ()  => ipcRenderer.send('open-downloads'),
  chooseFolder:  ()  => ipcRenderer.invoke('choose-folder'),

  // Settings & Tools
  getSettings:    ()         => ipcRenderer.invoke('get-settings'),
  saveSettings:   (settings) => ipcRenderer.invoke('save-settings', settings),
  getToolsStatus: ()         => ipcRenderer.invoke('get-tools-status'),

  // Download History (persisted to disk)
  getHistory:          ()      => ipcRenderer.invoke('get-history'),
  saveHistoryEntry:    (entry) => ipcRenderer.invoke('save-history-entry', entry),
  removeHistoryEntry:  (id)    => ipcRenderer.invoke('remove-history-entry', id),
  clearHistory:        ()      => ipcRenderer.send('clear-history'),
});

