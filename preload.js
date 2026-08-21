const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("rootAPI", {
  setIgnoreMouseEvents: (ignore, opts) => ipcRenderer.send("set-ignore-mouse-events", ignore, opts),
  getRootConfig: () => ipcRenderer.invoke("get-root-config"),
  updateRootConfig: (patch) => ipcRenderer.send("update-root-config", patch),
  testIA: (cfg) => ipcRenderer.invoke("test-ia", cfg),
  aiChat: (messages) => ipcRenderer.invoke("ai-chat", messages),
  openSettings: () => ipcRenderer.send("open-settings"),
  onRootConfig: (cb) => ipcRenderer.on("root-config", (e, c) => cb(c))
});
