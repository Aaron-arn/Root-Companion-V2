const chatBubble = document.getElementById("chat-bubble");
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");
const chatClose = document.getElementById("chat-close");
const chatHistoryBtn = document.getElementById("chat-history-btn");
const chatHistoryPanel = document.getElementById("chat-history-panel");
const chatHistoryList = document.getElementById("chat-history-list");
const chatHistoryClose = document.getElementById("chat-history-close");
const attachBtn = document.getElementById("attach-btn");
const attachMenu = document.getElementById("attach-menu");
const attachPreview = document.getElementById("attach-preview");
let attachments = [];
function addMessage(author, text, atts = []) {
  const div = document.createElement("div");
  div.className = "msg " + author;
  const a = document.createElement("span");
  a.className = "author";
  a.textContent = author === "user" ? "Toi" : "Root";
  const t = document.createElement("span");
  t.className = "text";
  t.textContent = text;
  div.appendChild(a);
  div.appendChild(t);
  if (atts.length) {
    const w = document.createElement("div");
    w.className = "msg-attachments";
    atts.forEach(att => {
      if (att.type === "image" && att.dataUrl) {
        const img = document.createElement("img");
        img.src = att.dataUrl;
        w.appendChild(img);
      } else {
        const s = document.createElement("span");
        s.textContent = att.name || "fichier";
        w.appendChild(s);
      }
    });
    div.appendChild(w);
  }
  const cp = document.createElement("button");
  cp.className = "msg-copy";
  cp.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3"/></svg> Copier';
  cp.addEventListener("click", e => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      cp.textContent = "Copié";
      setTimeout(() => cp.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3"/></svg> Copier', 1200);
    }).catch(() => {});
  });
  div.appendChild(cp);
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function updateAttachPreview() {
  if (!attachments.length) { attachPreview.classList.add("hidden"); attachPreview.innerHTML = ""; return; }
  attachPreview.classList.remove("hidden");
  attachPreview.innerHTML = attachments.map((att, i) => {
    if (att.type === "image") return `<div class="attach-item"><img src="${att.dataUrl}" alt=""><span>${att.name}</span><button data-rm="${i}" class="attach-remove">✕</button></div>`;
    return `<div class="attach-item"><span>${att.name}</span><button data-rm="${i}" class="attach-remove">✕</button></div>`;
  }).join("");
  attachPreview.querySelectorAll("[data-rm]").forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      attachments.splice(parseInt(b.getAttribute("data-rm")), 1);
      updateAttachPreview();
    });
  });
}
async function refreshHistory() {
  const list = await window.rootAPI.getConversations();
  chatHistoryList.innerHTML = "";
  if (!list.length) { chatHistoryList.innerHTML = '<div class="desc">Aucune conversation</div>'; return; }
  list.forEach(c => {
    const d = document.createElement("div");
    d.className = "history-item";
    d.innerHTML = `<div class="history-item-head"><span>${c.name}</span><span>${new Date(c.startedAt).toLocaleString("fr-FR")}</span></div><div class="history-item-actions"><button class="history-btn" data-resume="${c.id}">Reprendre</button><button class="history-btn" data-del="${c.id}">Suppr</button></div>`;
    d.querySelector("[data-resume]").addEventListener("click", async e => {
      e.stopPropagation();
      const conv = await window.rootAPI.getConversation(c.id);
      if (conv) {
        chatMessages.innerHTML = "";
        conv.messages.forEach(m => addMessage(m.author === "user" ? "user" : "root", m.text || "", m.attachments || []));
        await window.rootAPI.resumeConversation(c.id);
        closeHistoryPanel();
      }
    });
    d.querySelector("[data-del]").addEventListener("click", async e => {
      e.stopPropagation();
      await window.rootAPI.deleteConversation(c.id);
      refreshHistory();
    });
    chatHistoryList.appendChild(d);
  });
}
function openHistoryPanel() { refreshHistory(); chatHistoryPanel.classList.remove("hidden"); }
function closeHistoryPanel() { chatHistoryPanel.classList.add("hidden"); }
function openChat() {
  isChatOpen = true;
  updateChatPosition();
  chatBubble.classList.remove("hidden");
  isMouseOverChat = true;
  updateClickThrough();
  wakeRoot();
  resetIdleTimer();
  setTimeout(() => chatInput.focus(), 80);
}
function closeChat() {
  isChatOpen = false;
  chatBubble.classList.add("hidden");
  isMouseOverChat = false;
  attachMenu.classList.add("hidden");
  closeHistoryPanel();
  updateClickThrough();
  resetIdleTimer();
}
function setupChat() {
  ctrlChat.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isChatOpen) closeChat(); else openChat();
  });
  chatClose.addEventListener("click", (e) => {
    e.stopPropagation();
    closeChat();
  });
  chatSend.addEventListener("click", (e) => {
    e.stopPropagation();
    sendChat();
  });
  chatInput.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") sendChat();
  });
  chatInput.addEventListener("keyup", (e) => e.stopPropagation());
  chatBubble.addEventListener("mouseenter", () => {
    isMouseOverChat = true;
    updateClickThrough();
  });
  chatBubble.addEventListener("mouseleave", () => {
    isMouseOverChat = false;
    updateClickThrough();
  });
  chatBubble.addEventListener("mousedown", (e) => e.stopPropagation());
  document.addEventListener("mousedown", (e) => {
    if (!isChatOpen) return;
    if (chatBubble.contains(e.target) || rootSprite.contains(e.target) || rootControls.contains(e.target)) return;
    closeChat();
  });
  attachBtn.addEventListener("click", e => {
    e.stopPropagation();
    attachMenu.classList.toggle("hidden");
  });
  function compressDataUrl(dataUrl, maxW = 900) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        res(c.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => res(dataUrl);
      img.src = dataUrl;
    });
  }
  attachMenu.querySelectorAll(".attach-option").forEach(b => {
    b.addEventListener("click", async e => {
      e.stopPropagation();
      attachMenu.classList.add("hidden");
      const act = b.getAttribute("data-action");
      if (act === "screen" || act === "window" || act === "zone") {
        const r = await window.rootAPI.captureScreen(act);
        if (r.success) {
          const small = await compressDataUrl(r.dataUrl);
          attachments.push({ type: "image", dataUrl: small, name: act === "screen" ? "capture-ecran.png" : act === "zone" ? "capture-zone.png" : "capture-fenetre.png" }); updateAttachPreview();
        } else addMessage("root", "Erreur capture: " + (r.error || ""), []);
      } else if (act === "file") {
        const r = await window.rootAPI.openFileDialog();
        if (r.success) {
          if (r.type === "image") {
            const small = await compressDataUrl(r.dataUrl);
            attachments.push({ type: "image", dataUrl: small, name: r.name });
          } else attachments.push({ type: "text", name: r.name, content: r.content });
          updateAttachPreview();
        }
      }
      chatInput.focus();
    });
  });
  document.addEventListener("mousedown", e => {
    if (!attachMenu.classList.contains("hidden") && !attachBtn.contains(e.target) && !attachMenu.contains(e.target)) attachMenu.classList.add("hidden");
  });
  chatHistoryBtn.addEventListener("click", e => {
    e.stopPropagation();
    if (chatHistoryPanel.classList.contains("hidden")) openHistoryPanel();
    else closeHistoryPanel();
  });
  chatHistoryClose.addEventListener("click", e => {
    e.stopPropagation();
    closeHistoryPanel();
  });
}
const speakAudio = new Audio("../../asset/root-speak.mp3");
speakAudio.loop = true;
let speakTimer = null;
function typeEffect(el, text, done) {
  const words = String(text).split(/\s+/).filter(Boolean);
  let i = 0;
  el.textContent = "";
  try { speakAudio.currentTime = 0; speakAudio.play().catch(() => {}); } catch {}
  setAnimation("writing");
  function step() {
    if (i < words.length) {
      el.textContent += (i ? " " : "") + words[i++];
      chatMessages.scrollTop = chatMessages.scrollHeight;
      speakTimer = setTimeout(step, 35 + Math.random() * 90);
    } else {
      try { speakAudio.pause(); speakAudio.currentTime = 0; } catch {}
      if (speakTimer) { clearTimeout(speakTimer); speakTimer = null; }
      setAnimation("idle");
      done && done();
    }
  }
  step();
}
function stopSpeak() {
  try { speakAudio.pause(); speakAudio.currentTime = 0; } catch {}
  if (speakTimer) { clearTimeout(speakTimer); speakTimer = null; }
}
async function sendChat() {
  const text = chatInput.value.trim();
  if (!text && !attachments.length) return;
  const curAtts = [...attachments];
  attachments = [];
  updateAttachPreview();
  chatInput.value = "";
  addMessage("user", text || "(image)", curAtts);
  window.rootAPI.conversationMessage({ author: "user", text: text || "(image)", timestamp: new Date().toISOString(), attachments: curAtts });
  resetIdleTimer();
  const typingDiv = document.createElement("div");
  typingDiv.className = "msg root typing";
  const ta = document.createElement("span");
  ta.className = "author";
  ta.textContent = "Root";
  const tt = document.createElement("span");
  tt.className = "text";
  tt.textContent = "Rout reflechiit...";
  typingDiv.appendChild(ta);
  typingDiv.appendChild(tt);
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  setAnimation("thinking");
  let chatHistory = [];
  chatMessages.querySelectorAll(".msg").forEach(m => {
    const author = m.classList.contains("user") ? "user" : "assistant";
    const txt = m.querySelector(".text");
    if (txt && !m.classList.contains("typing")) chatHistory.push({ role: author === "user" ? "user" : "assistant", content: txt.textContent });
  });
  let userContent;
  if (curAtts.length) {
    userContent = [];
    if (text) userContent.push({ type: "text", text });
    curAtts.forEach(att => {
      if (att.type === "image") userContent.push({ type: "image_url", image_url: { url: att.dataUrl } });
      else userContent.push({ type: "text", text: `[Fichier ${att.name}]\n${att.content || ""}` });
    });
  } else userContent = text || "(image)";
  const lastUser = { role: "user", content: userContent };
  const messages = [{ role: "system", content: "Tu es Rout, petit compagnon de bureau mignon et utile. Reponds court en francais. Si tu vois une image decris la." }, ...chatHistory.slice(-10).map(m => ({ role: m.role, content: m.content })), lastUser];
  try {
    const res = await window.rootAPI.aiChat(messages);
    typingDiv.remove();
    stopSpeak();
    if (res.success) {
      const div = document.createElement("div");
      div.className = "msg root";
      const a = document.createElement("span");
      a.className = "author";
      a.textContent = "Root";
      const t = document.createElement("span");
      t.className = "text";
      div.appendChild(a);
      div.appendChild(t);
      const cp2 = document.createElement("button");
      cp2.className = "msg-copy";
      cp2.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3"/></svg> Copier';
      div.appendChild(cp2);
      chatMessages.appendChild(div);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      typeEffect(t, res.content, () => {
        if (res.memoryAdded && res.memoryAdded.length) {
          const tag = document.createElement("div");
          tag.className = "memory-tag";
          tag.textContent = "éléments ajoutée a la memoire: " + res.memoryAdded.join(", ");
          div.appendChild(tag);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        window.rootAPI.conversationMessage({ author: "root", text: res.content, timestamp: new Date().toISOString(), attachments: [] });
        resetIdleTimer();
      });
      cp2.addEventListener("click", e => {
        e.stopPropagation();
        navigator.clipboard.writeText(t.textContent).then(() => {
          cp2.textContent = "Copié";
          setTimeout(() => cp2.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3"/></svg> Copier', 1200);
        }).catch(() => {});
      });
    } else {
      addMessage("root", res.error || "Erreur IA", []);
      window.rootAPI.conversationMessage({ author: "root", text: res.error || "Erreur IA", timestamp: new Date().toISOString(), attachments: [] });
      setAnimation("idle");
      stopSpeak();
      resetIdleTimer();
    }
  } catch (e) {
    typingDiv.remove();
    stopSpeak();
    addMessage("root", "Erreur : " + String(e.message || e), []);
    window.rootAPI.conversationMessage({ author: "root", text: "Erreur : " + String(e.message || e), timestamp: new Date().toISOString(), attachments: [] });
    setAnimation("idle");
    resetIdleTimer();
  }
}
async function init() {
  try {
    const saved = JSON.parse(localStorage.getItem("root-pos"));
    if (saved && typeof saved.x === "number") rootState = saved;
  } catch {}
  try {
    const cfg = await window.rootAPI.getRootConfig();
    if (cfg.scale) SPRITE_SIZE = cfg.scale;
    if (typeof cfg.roamEnabled === "boolean") roamEnabled = cfg.roamEnabled;
    if (cfg.roamInterval) roamInterval = cfg.roamInterval;
    if (cfg.roamSpeed) roamSpeed = cfg.roamSpeed;
    if (cfg.idleSleepMin) idleSleepMin = cfg.idleSleepMin;
    if (cfg.idleHideMin) idleHideMin = cfg.idleHideMin;
    if (cfg.sleepPos) applySleepPos(cfg.sleepPos);
  } catch {}
  applySleepPos(sleepPos);
  window.rootAPI.onRootConfig((cfg) => {
    if (cfg.scale) { SPRITE_SIZE = cfg.scale; positionRoot(rootState.x, rootState.y); }
    if (typeof cfg.roamEnabled === "boolean") { roamEnabled = cfg.roamEnabled; updateRoamButton(); if (roamEnabled) resetRoam(); else if (roamTimeout) { clearTimeout(roamTimeout); roamTimeout = null; } }
    if (cfg.roamInterval) { roamInterval = cfg.roamInterval; resetRoam(); }
    if (cfg.roamSpeed) { roamSpeed = cfg.roamSpeed; }
    if (cfg.idleSleepMin) { idleSleepMin = cfg.idleSleepMin; resetIdleTimer(); }
    if (cfg.idleHideMin) { idleHideMin = cfg.idleHideMin; resetIdleTimer(); }
    if (cfg.sleepPos) applySleepPos(cfg.sleepPos);
  });
  window.rootAPI.onLoadConversation((c) => {
    chatMessages.innerHTML = "";
    c.messages.forEach(m => addMessage(m.author === "user" ? "user" : "root", m.text || "", m.attachments || []));
    if (!isChatOpen) openChat();
    else { updateChatPosition(); chatMessages.scrollTop = chatMessages.scrollHeight; }
  });
  const maxX = window.innerWidth - SPRITE_SIZE;
  const maxY = window.innerHeight - SPRITE_SIZE;
  rootState.x = Math.max(0, Math.min(maxX, rootState.x));
  rootState.y = Math.max(0, Math.min(maxY, rootState.y));
  positionRoot(rootState.x, rootState.y);
  setAnimation("idle");
  setupDrag();
  setupControls();
  setupChat();
  setupSleep();
  updateRoamButton();
  startIdleAnim();
  resetRoam();
  resetIdleTimer();
  updateClickThrough();
  setTimeout(() => { setAnimation("wave", 1200); setTimeout(() => setAnimation("idle"), 1300); }, 600);
}
init();
