const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("rootAPI", {
  setIgnoreMouseEvents: (ignore, opts) => ipcRenderer.send("set-ignore-mouse-events", ignore, opts),
  getRootConfig: () => ipcRenderer.invoke("get-root-config"),
  updateRootConfig: (patch) => ipcRenderer.send("update-root-config", patch),
  testIA: (cfg) => ipcRenderer.invoke("test-ia", cfg),
  aiChat: (messages) => ipcRenderer.invoke("ai-chat", messages),
  getMemory: () => ipcRenderer.invoke("get-memory"),
  addMemory: (t) => ipcRenderer.invoke("add-memory", t),
  deleteMemory: (id) => ipcRenderer.invoke("delete-memory", id),
  getConversations: () => ipcRenderer.invoke("get-conversations"),
  getConversation: (id) => ipcRenderer.invoke("get-conversation", id),
  deleteConversation: (id) => ipcRenderer.invoke("delete-conversation", id),
  resumeConversation: (id) => ipcRenderer.invoke("resume-conversation", id),
  conversationMessage: (m) => ipcRenderer.send("conversation-message", m),
  onLoadConversation: (cb) => ipcRenderer.on("load-conversation", (e, c) => cb(c)),
  updateApp: () => ipcRenderer.invoke("update-app"),
  captureScreen: (mode) => ipcRenderer.invoke("capture-screen", mode),
  getRegionScreenshot: () => ipcRenderer.invoke("get-region-screenshot"),
  sendRegionResult: (r) => ipcRenderer.send("region-result", r),
  openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
  openSettings: () => ipcRenderer.send("open-settings"),
  onRootConfig: (cb) => ipcRenderer.on("root-config", (e, c) => cb(c))
});
