const fs = require("fs");
const path = require("path");
const os = require("os");
const histDir = path.join(os.homedir(), ".root", "history");
const imgDir = path.join(histDir, "images");
function ensureDir() {
  if (!fs.existsSync(histDir)) fs.mkdirSync(histDir, { recursive: true });
  if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
}
let current = null;
function createConv(name) {
  ensureDir();
  const now = new Date();
  const p = n => String(n).padStart(2, "0");
  const base = `${p(now.getDate())}-${p(now.getMonth() + 1)}-${now.getFullYear()}_${p(now.getHours())}-${p(now.getMinutes())}`;
  let file = path.join(histDir, base + ".json");
  let c = 2;
  while (fs.existsSync(file)) file = path.join(histDir, `${base}_${c++}.json`);
  const conv = { id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: (name || "Conversation").slice(0, 60), file, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] };
  fs.writeFileSync(file, JSON.stringify(conv, null, 2));
  return conv;
}
function saveConv(conv) {
  try { fs.writeFileSync(conv.file, JSON.stringify(conv, null, 2)); } catch {}
}
function loadConv(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}
function findFile(id) {
  ensureDir();
  const files = fs.readdirSync(histDir).filter(f => f.endsWith(".json"));
  for (const f of files) {
    const c = loadConv(path.join(histDir, f));
    if (c && c.id === id) return path.join(histDir, f);
  }
  return null;
}
function getConversations() {
  ensureDir();
  const out = [];
  fs.readdirSync(histDir).filter(f => f.endsWith(".json")).forEach(f => {
    const c = loadConv(path.join(histDir, f));
    if (c && c.id) out.push({ id: c.id, name: c.name, file: f, startedAt: c.startedAt, updatedAt: c.updatedAt, messageCount: (c.messages || []).length });
  });
  return out.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
}
function getConversation(id) {
  const f = findFile(id);
  if (!f) return null;
  const c = loadConv(f);
  if (!c) return null;
  return {
    ...c,
    messages: (c.messages || []).map(m => {
      const r = { author: m.author, text: m.text, timestamp: m.timestamp };
      if (m.attachments) r.attachments = m.attachments.map(att => {
        if (att.file) {
          try {
            const buf = fs.readFileSync(path.join(histDir, att.file));
            const ext = att.file.split(".").pop();
            const mime = ext === "jpg" ? "image/jpeg" : "image/" + ext;
            return { ...att, dataUrl: `data:${mime};base64,${buf.toString("base64")}` };
          } catch { return att; }
        }
        return att;
      });
      return r;
    })
  };
}
function saveImg(convId, dataUrl, idx) {
  ensureDir();
  const mime = (dataUrl.match(/^data:([^;]+);/) || [])[1] || "image/png";
  const ext = (mime.split("/")[1] || "png").replace("jpeg", "jpg");
  const file = path.join(imgDir, `${convId}_${idx + 1}.${ext}`);
  const b64 = dataUrl.split(",")[1] || "";
  try { fs.writeFileSync(file, Buffer.from(b64, "base64")); return path.relative(histDir, file).replace(/\\/g, "/"); } catch { return null; }
}
function appendMessage(msg) {
  if (!current) current = createConv(msg.text || "Conversation du " + new Date().toLocaleString("fr-FR"));
  const e = { author: msg.author, text: msg.text || "", timestamp: msg.timestamp || new Date().toISOString() };
  if (msg.attachments && msg.attachments.length) {
    e.attachments = msg.attachments.map((att, i) => {
      if (att.type === "image" && att.dataUrl) {
        const rel = saveImg(current.id, att.dataUrl, current.messages.length + i);
        return { type: "image", name: att.name || "image.png", file: rel };
      }
      return { type: att.type, name: att.name || "fichier", content: att.content || "" };
    });
  }
  current.messages.push(e);
  current.updatedAt = new Date().toISOString();
  saveConv(current);
}
function deleteConversation(id) {
  const f = findFile(id);
  if (f) try { fs.unlinkSync(f); } catch {}
  try {
    fs.readdirSync(imgDir).filter(ff => ff.startsWith(id + "_")).forEach(ff => { try { fs.unlinkSync(path.join(imgDir, ff)); } catch {} });
  } catch {}
  if (current && current.id === id) current = null;
  return true;
}
function resumeConversation(id) {
  const c = getConversation(id);
  if (!c) return null;
  current = loadConv(findFile(id));
  return c;
}
module.exports = { ensureDir, getConversations, getConversation, appendMessage, deleteConversation, resumeConversation };
