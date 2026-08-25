const { app, BrowserWindow, screen, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { loadMemory, addMemoryEntry, deleteMemoryEntry, autoMemorize } = require("./src/main/memory");
const { captureScreenshot, captureRegion, getRegionScreenshot } = require("./src/main/capture");
const { getConversations, getConversation, appendMessage, deleteConversation, resumeConversation } = require("./src/main/history");
let overlayWindow = null;
let settingsWindow = null;
let updateWindow = null;
const configPath = path.join(require("os").homedir(), ".root", "config.json");
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(configPath, "utf8")); } catch { return { scale: 128, roamEnabled: true, roamInterval: 15, roamSpeed: 1800, idleSleepMin: 3, idleHideMin: 5, sleepPos: "bottom-center", apiProvider: "openai", apiModel: "gpt-4o-mini", apiKey: "", apiBaseUrl: "" }; }
}
function saveConfig(cfg) {
  try { fs.mkdirSync(path.dirname(configPath), { recursive: true }); fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2)); } catch {}
}
function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  overlayWindow = new BrowserWindow({
    width, height, x: 0, y: 0,
    transparent: true, frame: false, alwaysOnTop: true, hasShadow: false, resizable: false, skipTaskbar: false, focusable: true, show: false,
    title: "Root Companion V2",
    icon: path.join(__dirname, "asset", "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false }
  });
  overlayWindow.loadFile(path.join(__dirname, "src", "overlay", "index.html"));
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnAllWorkspaces: true });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.once("ready-to-show", () => { overlayWindow.show(); if (settingsWindow) settingsWindow.webContents.send("root-config", loadConfig()); overlayWindow.webContents.send("root-config", loadConfig()); });
  overlayWindow.on("closed", () => { overlayWindow = null; });
}
function hideOverlay() { if (overlayWindow && !overlayWindow.isDestroyed()) { overlayWindow.hide(); if (overlayWindow) overlayWindow.webContents.send("hide-for-capture", true); } }
function showOverlay() { if (overlayWindow && !overlayWindow.isDestroyed()) { overlayWindow.show(); if (overlayWindow) overlayWindow.webContents.send("hide-for-capture", false); } }
function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.focus(); settingsWindow.webContents.send("root-config", loadConfig()); return; }
  settingsWindow = new BrowserWindow({
    width: 640, height: 680, title: "Parametres - Root", icon: path.join(__dirname, "asset", "icon.png"), resizable: true, show: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false }
  });
  settingsWindow.loadFile(path.join(__dirname, "src", "settings", "index.html"));
  settingsWindow.setMenu(null);
  settingsWindow.once("ready-to-show", () => { settingsWindow.show(); settingsWindow.webContents.send("root-config", loadConfig()); });
  settingsWindow.on("closed", () => { settingsWindow = null; });
}
function createUpdateWindow() {
  if (updateWindow && !updateWindow.isDestroyed()) { updateWindow.focus(); return; }
  updateWindow = new BrowserWindow({
    width: 420, height: 320, title: "Mise à jour - Root", resizable: false, minimizable: false, maximizable: false, show: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false }
  });
  updateWindow.loadFile(path.join(__dirname, "src", "update", "index.html"));
  updateWindow.setMenu(null);
  updateWindow.once("ready-to-show", () => updateWindow.show());
  updateWindow.on("closed", () => { updateWindow = null; });
}
app.whenReady().then(() => {
  app.setAppUserModelId("com.root.companion-v2");
  createOverlayWindow();
});
app.on("window-all-closed", () => {});
app.on("before-quit", () => {});
app.on("activate", () => { if (!overlayWindow || overlayWindow.isDestroyed()) createOverlayWindow(); });
ipcMain.on("set-ignore-mouse-events", (event, ignore, opts) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.setIgnoreMouseEvents(ignore, opts || {});
});
ipcMain.handle("get-root-config", () => loadConfig());
ipcMain.on("update-root-config", (e, patch) => {
  const cfg = { ...loadConfig(), ...patch };
  saveConfig(cfg);
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send("root-config", cfg);
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.webContents.send("root-config", cfg);
});
function makeAIRequest(provider, model, key, base, messages) {
  const https = require("https");
  const hasImage = messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === "image_url"));
  const url = new URL((base.replace(/\/$/, "")) + (provider === "anthropic" ? "/v1/messages" : "/v1/chat/completions"));
  let body;
  if (provider === "anthropic") {
    const sys = (messages.find(m => m.role === "system") || {}).content || undefined;
    const msgs = messages.filter(m => m.role !== "system").map(m => {
      if (Array.isArray(m.content)) return { role: m.role, content: m.content.map(c => c.type === "image_url" ? { type: "image", source: { type: "base64", media_type: "image/png", data: c.image_url.url.split(",")[1] } } : { type: "text", text: c.text }) };
      return { role: m.role, content: m.content };
    });
    body = JSON.stringify({ model, max_tokens: 1024, messages: msgs, system: sys });
  } else {
    body = JSON.stringify({ model, messages, max_tokens: 1024 });
  }
  const headers = provider === "anthropic" ? { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" } : { "Content-Type": "application/json", "Authorization": "Bearer " + key };
  return new Promise((resolve, reject) => {
    const req = https.request({ method: "POST", hostname: url.hostname, path: url.pathname + url.search, port: url.port || 443, headers }, (res) => {
      let data = ""; res.on("data", d => data += d); res.on("end", () => resolve({ status: res.statusCode, data }));
    });
    req.on("error", reject); req.write(body); req.end();
  });
}
ipcMain.handle("test-ia", async (e, cfg) => {
  const provider = cfg.apiProvider || "openai";
  const model = cfg.apiModel || "";
  const key = cfg.apiKey || "";
  const base = cfg.apiBaseUrl || (provider === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com");
  if (!key) return { success: false, error: "Clee API manquante" };
  try {
    const result = await makeAIRequest(provider, model, key, base, [{ role: "user", content: "dis bonjour" }]);
    if (result.status >= 200 && result.status < 300) return { success: true, content: "connexion reussie" };
    return { success: false, error: "HTTP " + result.status };
  } catch (err) { return { success: false, error: String(err.message || err) }; }
});
ipcMain.handle("ai-chat", async (e, messages) => {
  const cfg = loadConfig();
  const provider = cfg.apiProvider || "openai";
  const model = cfg.apiModel || "gpt-4o-mini";
  const key = cfg.apiKey || "";
  const base = cfg.apiBaseUrl || (provider === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com");
  if (!key) return { success: false, error: "Clee API manquante - va dans Parametres > IA" };
  try {
    const mem = loadMemory().entries.slice(-10).map(en => en.text).join("\n");
    const sysExtra = mem ? "\nMemoire:\n" + mem : "";
    const withMem = messages.map(m => m.role === "system" ? { role: "system", content: m.content + sysExtra } : m);
    const added = autoMemorize(messages.filter(m => m.role === "user").map(m => typeof m.content === "string" ? m.content : "").join(" "));
    const result = await makeAIRequest(provider, model, key, base, withMem);
    if (result.status < 200 || result.status >= 300) return { success: false, error: "HTTP " + result.status + " " + result.data.slice(0, 200) };
    const j = JSON.parse(result.data);
    const content = provider === "anthropic" ? (j.content && j.content[0] && j.content[0].text) : (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content);
    let finalContent = content || "...";
    const memAdds = [...finalContent.matchAll(/\[MEMORY_ADD:\s*(.+?)\]/g)].map(x => x[1]);
    memAdds.forEach(t => addMemoryEntry(t));
    finalContent = finalContent.replace(/\[MEMORY_ADD:[^\]]+\]/g, "").trim();
    return { success: true, content: finalContent, memoryAdded: added.concat(memAdds) };
  } catch (err) { return { success: false, error: String(err.message || err) }; }
});
ipcMain.handle("get-memory", () => loadMemory());
ipcMain.handle("add-memory", (e, t) => { addMemoryEntry(t); return loadMemory(); });
ipcMain.handle("delete-memory", (e, id) => { deleteMemoryEntry(id); return loadMemory(); });
ipcMain.handle("get-conversations", () => getConversations());
ipcMain.handle("get-conversation", (e, id) => getConversation(id));
ipcMain.handle("delete-conversation", (e, id) => { deleteConversation(id); return true; });
ipcMain.handle("resume-conversation", (e, id) => {
  const c = resumeConversation(id);
  if (c && overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send("load-conversation", c);
  return c ? true : false;
});
ipcMain.on("conversation-message", (e, msg) => appendMessage(msg));
ipcMain.handle("capture-screen", async (e, mode) => {
  try {
    if (mode === "zone") return await captureRegion(hideOverlay, showOverlay);
    return await captureScreenshot(mode, hideOverlay, showOverlay);
  } catch (err) { return { success: false, error: String(err.message || err) }; }
});
ipcMain.handle("get-region-screenshot", () => getRegionScreenshot());
ipcMain.handle("open-file-dialog", async () => {
  try {
    const r = await dialog.showOpenDialog(settingsWindow || overlayWindow, { properties: ["openFile"] });
    if (r.canceled || !r.filePaths[0]) return { success: false, error: "Annulé" };
    const fp = r.filePaths[0];
    const ext = path.extname(fp).toLowerCase();
    const isImg = [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext);
    const buf = fs.readFileSync(fp);
    if (isImg) return { success: true, type: "image", name: path.basename(fp), mime: ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg", base64: buf.toString("base64"), dataUrl: "data:" + (ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg") + ";base64," + buf.toString("base64") };
    return { success: true, type: "text", name: path.basename(fp), content: buf.toString("utf8").slice(0, 8000) };
  } catch (err) { return { success: false, error: String(err.message || err) }; }
});
ipcMain.on("open-settings", () => createSettingsWindow());
ipcMain.handle("update-app", async () => {
  try {
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
    if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.hide();
    createUpdateWindow();
    const { execFile } = require("child_process");
    const repoPath = __dirname;
    const out = await new Promise((res, rej) => {
      execFile("git", ["pull"], { cwd: repoPath, timeout: 60000 }, (err, stdout, stderr) => {
        if (err) rej(new Error((stderr || err.message).trim()));
        else res(stdout);
      });
    });
    const up = !out.trim().toLowerCase().startsWith("already up to date");
    if (!up) {
      if (updateWindow && !updateWindow.isDestroyed()) updateWindow.close();
      if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.show();
      return { updated: false, message: "Deja à jour." };
    }
    setTimeout(() => { app.relaunch(); app.exit(0); }, 1500);
    return { updated: true, message: "Mise à jour en cours - relance..." };
  } catch (err) {
    if (updateWindow && !updateWindow.isDestroyed()) updateWindow.close();
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.show();
    return { updated: false, message: "Erreur: " + String(err.message || err) };
  }
});
