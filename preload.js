const { contextBridge, ipcRenderer } = require("electron");

console.log("[Preload] Script running");

contextBridge.exposeInMainWorld("electronAPI", {
  onShowUrlBar: (callback) =>
    ipcRenderer.on("show-url-bar", (event, currentURL) => callback(currentURL)),
  onHideUrlBar: (callback) => ipcRenderer.on("hide-url-bar", () => callback()),
  sendLoadURL: (url) => ipcRenderer.send("load-url", url),
  sendUrlBarEscape: () => ipcRenderer.send("url-bar-escape"),
});

console.log("[Preload] electronAPI exposed");
