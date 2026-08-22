const { app, BrowserWindow, screen, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
let overlayWindow = null;
let settingsWindow = null;
const configPath = path.join(app.getPath("userData"), "config.json");
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
  const url = new URL((base.replace(/\/$/, "")) + (provider === "anthropic" ? "/v1/messages" : "/v1/chat/completions"));
  const body = provider === "anthropic" ? JSON.stringify({ model, max_tokens: 512, messages: messages.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content })), system: (messages.find(m => m.role === "system") || {}).content || undefined }) : JSON.stringify({ model, messages, max_tokens: 512 });
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
  const model = cfg.apiModel || "gpt-4o-mini";
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
    const result = await makeAIRequest(provider, model, key, base, messages);
    if (result.status < 200 || result.status >= 300) return { success: false, error: "HTTP " + result.status + " " + result.data.slice(0, 200) };
    const j = JSON.parse(result.data);
    const content = provider === "anthropic" ? (j.content && j.content[0] && j.content[0].text) : (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content);
    return { success: true, content: content || "..." };
  } catch (err) { return { success: false, error: String(err.message || err) }; }
});
ipcMain.on("open-settings", () => createSettingsWindow());
