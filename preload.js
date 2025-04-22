const { contextBridge, ipcRenderer } = require('electron');

console.log('[Preload] Script running');

contextBridge.exposeInMainWorld('electronAPI', {
    // Main -> Renderer listeners
    onShowUrlBar: (callback) => ipcRenderer.on('show-url-bar', (event, currentURL) => callback(currentURL)),
    onHideUrlBar: (callback) => ipcRenderer.on('hide-url-bar', () => callback()),

    // Renderer -> Main actions
    sendLoadURL: (url) => ipcRenderer.send('load-url', url),
    sendUrlBarEscape: () => ipcRenderer.send('url-bar-escape'),
    // sendFocusView is removed, main handles focus directly
});

console.log('[Preload] electronAPI exposed');