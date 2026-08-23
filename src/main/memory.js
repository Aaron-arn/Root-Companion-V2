const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const memPath = path.join(app.getPath("userData"), "memory.json");
function loadMemory() {
  try {
    const d = JSON.parse(fs.readFileSync(memPath, "utf8"));
    return { entries: Array.isArray(d && d.entries) ? d.entries : [] };
  } catch { return { entries: [] }; }
}
function saveMemory(m) {
  try { fs.mkdirSync(path.dirname(memPath), { recursive: true }); fs.writeFileSync(memPath, JSON.stringify(m, null, 2)); } catch {}
}
function addMemoryEntry(text, type = "fact") {
  const m = loadMemory();
  const norm = String(text).trim().toLowerCase().replace(/[.,;:!?]+$/, "");
  if (m.entries.some(e => String(e.text).trim().toLowerCase() === norm)) return m;
  m.entries.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: String(text).trim(), type, timestamp: new Date().toISOString() });
  if (m.entries.length > 200) m.entries = m.entries.slice(-200);
  saveMemory(m);
  return m;
}
function searchMemory(q) {
  const m = loadMemory();
  const s = q.toLowerCase();
  return m.entries.filter(e => e.text.toLowerCase().includes(s)).slice(0, 10);
}
function deleteMemoryEntry(id) {
  const m = loadMemory();
  m.entries = m.entries.filter(e => e.id !== id);
  saveMemory(m);
  return true;
}
function autoMemorize(text) {
  if (!text || typeof text !== "string") return [];
  const added = [];
  const pats = [
    { re: /\bje m'appelle\s+([A-Za-zÀ-ÿ'\- ]{2,40})/gi, f: n => `L'utilisateur s'appel ${n.trim()}.` },
    { re: /\bmon nom est\s+([A-Za-zÀ-ÿ'\- ]{2,40})/gi, f: n => `L'utilisateur s'appel ${n.trim()}.` },
    { re: /\bappelle-?moi\s+([A-Za-zÀ-ÿ'\- ]{2,40})/gi, f: n => `L'utilisateur s'appel ${n.trim()}.` },
    { re: /\bm'appeler\s+([A-Za-zÀ-ÿ'\- ]{2,40})/gi, f: n => `L'utilisateur s'appel ${n.trim()}.` },
    { re: /\bm[oô]i c'est\s+([A-Za-zÀ-ÿ'\- ]{2,40})/gi, f: n => `L'utilisateur s'appel ${n.trim()}.` }
  ];
  pats.forEach(({ re, f }) => {
    let m;
    while ((m = re.exec(text)) !== null) {
      const name = m[1].trim();
      if (name.length < 2) continue;
      if (/^(content|fâché|heureux|triste|en train|prêt|d'accord|sûr|certain|perdu|chez moi|au travail|de retour|là|disponible|occupé|fatigué)/i.test(name)) continue;
      const t = f(name);
      const before = loadMemory().entries.length;
      addMemoryEntry(t);
      if (loadMemory().entries.length > before) added.push(t);
    }
  });
  return added;
}
module.exports = { loadMemory, saveMemory, addMemoryEntry, searchMemory, deleteMemoryEntry, autoMemorize };
