let SPRITE_SIZE = 128;
const DRAG_THRESHOLD = 5;
const rootSprite = document.getElementById("root-sprite");
const rootImg = document.getElementById("root-img");
const rootControls = document.getElementById("root-controls");
const ctrlChat = document.getElementById("ctrl-chat");
const ctrlRoam = document.getElementById("ctrl-roam");
const ctrlSettings = document.getElementById("ctrl-settings");
const chatBubble = document.getElementById("chat-bubble");
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");
const chatClose = document.getElementById("chat-close");
let rootState = { x: 200, y: 200 };
let isDragging = false;
let dragOffsetX = 0, dragOffsetY = 0;
let dragStartX = 0, dragStartY = 0;
let dragDirection = "right";
let currentAnim = "idle";
let walkCycleTimer = null;
let walkCycleIndex = 0;
let roamTimeout = null;
let idleTimer = null;
let controlsTimeout = null;
let roamEnabled = true;
let roamInterval = 15;
let roamSpeed = 1800;
let isChatOpen = false;
const SPRITES = {
  idle: "../../asset/root-idle.png",
  idle2: "../../asset/root-idle2.png",
  walking: "../../asset/root-walk-left-1.png",
  "walking-left": "../../asset/root-walk-left-1.png",
  dragging: "../../asset/root-drag.png",
  "dragging-left": "../../asset/root-drag.png",
  happy: "../../asset/root-happy.png",
  wave: "../../asset/root-wave.png",
  thinking: "../../asset/root-think.png",
  writing: "../../asset/root-writing.png"
};
const WALK_CYCLE = {
  left: ["../../asset/root-walk-left-1.png", "../../asset/root-walk-left-2.png"],
  right: ["../../asset/root-walk-left-1.png", "../../asset/root-walk-left-2.png"]
};
let ignoreMouseEvents = true;
let isMouseOverRoot = false;
let isMouseOverControls = false;
let isMouseOverChat = false;
function setClickThrough(ignore, opts) {
  if (ignore === ignoreMouseEvents && !opts) return;
  ignoreMouseEvents = ignore;
  window.rootAPI.setIgnoreMouseEvents(ignore, opts || {});
}
function updateClickThrough() {
  if (isChatOpen) { setClickThrough(false); return; }
  if (isDragging || isMouseOverRoot || isMouseOverControls || isMouseOverChat) setClickThrough(false);
  else setClickThrough(true, { forward: true });
}
function positionRoot(x, y) {
  rootSprite.style.left = x + "px";
  rootSprite.style.top = y + "px";
  rootSprite.style.width = SPRITE_SIZE + "px";
  rootSprite.style.height = SPRITE_SIZE + "px";
  rootState.x = x;
  rootState.y = y;
  try { localStorage.setItem("root-pos", JSON.stringify(rootState)); } catch {}
  updateControlsPosition();
  if (isChatOpen) updateChatPosition();
}
function updateControlsPosition() {
  rootControls.style.left = rootState.x + SPRITE_SIZE + 6 + "px";
  rootControls.style.top = rootState.y - 4 + "px";
}
function updateChatPosition() {
  const w = 300, h = 380;
  let cx = rootState.x - w - 10;
  let cy = rootState.y - 10;
  if (cx < 10) cx = rootState.x + SPRITE_SIZE + 10;
  if (cy + h > window.innerHeight - 10) cy = window.innerHeight - h - 10;
  if (cy < 10) cy = 10;
  chatBubble.style.left = cx + "px";
  chatBubble.style.top = cy + "px";
}
function setAnimation(state, duration) {
  currentAnim = state;
  rootSprite.setAttribute("data-state", state);
  stopWalkCycle();
  rootImg.src = SPRITES[state] || SPRITES.idle;
  if (state === "walking-left" || state === "dragging-left") {
    rootSprite.style.setProperty("--sx", "-1");
  } else {
    rootSprite.style.setProperty("--sx", "1");
  }
  if (duration) setTimeout(() => setAnimation("idle"), duration);
}
function startWalkCycle(direction) {
  stopWalkCycle();
  const cycle = WALK_CYCLE[direction];
  walkCycleIndex = 0;
  rootImg.src = cycle[0];
  rootSprite.style.setProperty("--sx", direction === "left" ? "-1" : "1");
  walkCycleTimer = setInterval(() => {
    walkCycleIndex = (walkCycleIndex + 1) % cycle.length;
    rootImg.src = cycle[walkCycleIndex];
  }, 220);
}
function stopWalkCycle() {
  if (walkCycleTimer) { clearInterval(walkCycleTimer); walkCycleTimer = null; }
}
function showControls() {
  if (controlsTimeout) clearTimeout(controlsTimeout);
  rootControls.classList.remove("hidden");
}
function hideControls() {
  controlsTimeout = setTimeout(() => {
    if (!isMouseOverControls && !isMouseOverRoot) rootControls.classList.add("hidden");
  }, 400);
}
function updateRoamButton() {
  ctrlRoam.classList.toggle("active", roamEnabled);
  ctrlRoam.title = "Promenade: " + (roamEnabled ? "ON" : "OFF");
}
function addMessage(author, text) {
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
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function openChat() {
  isChatOpen = true;
  updateChatPosition();
  chatBubble.classList.remove("hidden");
  isMouseOverChat = true;
  updateClickThrough();
  setTimeout(() => chatInput.focus(), 80);
}
function closeChat() {
  isChatOpen = false;
  chatBubble.classList.add("hidden");
  isMouseOverChat = false;
  updateClickThrough();
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
}
const speakAudio = new Audio("../../asset/root-speak.mp3");
speakAudio.loop = true;
let speakTimer = null;
function typeEffect(el, text, done) {
  const words = String(text).split(/\s+/).filter(Boolean);
  let i = 0;
  el.textContent = "";
  speakAudio.currentTime = 0;
  speakAudio.play().catch(() => {});
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
  if (!text) return;
  chatInput.value = "";
  addMessage("user", text);
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
  speakAudio.currentTime = 0;
  speakAudio.play().catch(() => {});
  let chatHistory = [];
  chatMessages.querySelectorAll(".msg").forEach(m => {
    const author = m.classList.contains("user") ? "user" : "assistant";
    const txt = m.querySelector(".text");
    if (txt && !m.classList.contains("typing")) chatHistory.push({ role: author === "user" ? "user" : "assistant", content: txt.textContent });
  });
  const messages = [{ role: "system", content: "Tu es Rout, petit compagnon de bureau mignon et utile. Reponds court en francais." }, ...chatHistory.slice(-10)];
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
      chatMessages.appendChild(div);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      typeEffect(t, res.content, null);
    } else {
      addMessage("root", res.error || "Erreur IA");
      setAnimation("idle");
      stopSpeak();
    }
  } catch (e) {
    typingDiv.remove();
    stopSpeak();
    addMessage("root", "Erreur : " + String(e.message || e));
    setAnimation("idle");
  }
}
function setupDrag() {
  rootSprite.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    isDragging = false;
    dragStartX = e.clientX; dragStartY = e.clientY;
    dragOffsetX = e.clientX - rootState.x;
    dragOffsetY = e.clientY - rootState.y;
    dragDirection = "right";
    updateClickThrough();
    document.addEventListener("mousemove", onPointerMove);
    document.addEventListener("mouseup", onPointerUp);
  });
  rootSprite.addEventListener("mouseenter", () => {
    isMouseOverRoot = true;
    showControls();
    updateClickThrough();
  });
  rootSprite.addEventListener("mouseleave", () => {
    isMouseOverRoot = false;
    hideControls();
    updateClickThrough();
  });
  rootControls.addEventListener("mouseenter", () => {
    isMouseOverControls = true;
    updateClickThrough();
  });
  rootControls.addEventListener("mouseleave", () => {
    isMouseOverControls = false;
    hideControls();
    updateClickThrough();
  });
}
function onPointerMove(e) {
  const dx = e.clientX - dragStartX, dy = e.clientY - dragStartY;
  const dist = Math.sqrt(dx*dx + dy*dy);
  if (!isDragging && dist > DRAG_THRESHOLD) {
    isDragging = true;
    stopIdleAnim();
    hideControls();
    if (isChatOpen) closeChat();
    dragDirection = e.clientX - dragStartX < 0 ? "left" : "right";
    startWalkCycle(dragDirection);
    rootSprite.setAttribute("data-state", dragDirection === "left" ? "dragging-left" : "dragging");
  }
  if (isDragging) {
    const newDir = e.clientX - (rootState.x + dragOffsetX) < 0 ? "left" : "right";
    if (newDir !== dragDirection) {
      dragDirection = newDir;
      startWalkCycle(dragDirection);
      rootSprite.setAttribute("data-state", dragDirection === "left" ? "dragging-left" : "dragging");
    }
    const maxX = window.innerWidth - SPRITE_SIZE;
    const maxY = window.innerHeight - SPRITE_SIZE;
    positionRoot(
      Math.max(0, Math.min(maxX, e.clientX - dragOffsetX)),
      Math.max(0, Math.min(maxY, e.clientY - dragOffsetY))
    );
  }
}
function onPointerUp(e) {
  document.removeEventListener("mousemove", onPointerMove);
  document.removeEventListener("mouseup", onPointerUp);
  if (isDragging) {
    isDragging = false;
    stopWalkCycle();
    setAnimation("idle");
    startIdleAnim();
    resetRoam();
    updateClickThrough();
  } else {
    if (isChatOpen) closeChat(); else openChat();
  }
}
function startIdleAnim() {
  stopIdleAnim();
}
function stopIdleAnim() {
  if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
}
function resetRoam() {
  if (roamTimeout) clearTimeout(roamTimeout);
  if (!roamEnabled) return;
  const delay = roamInterval * 1000;
  roamTimeout = setTimeout(roamToRandom, delay);
}
function roamToRandom() {
  if (isDragging || isMouseOverRoot || isMouseOverControls || isMouseOverChat || isChatOpen || !roamEnabled) { resetRoam(); return; }
  const w = window.innerWidth, h = window.innerHeight;
  const newX = Math.floor(40 + Math.random() * (w - SPRITE_SIZE - 80));
  const newY = Math.floor(40 + Math.random() * (h - SPRITE_SIZE - 80));
  const dir = newX < rootState.x ? "left" : "right";
  const dur = roamSpeed;
  const sx = rootState.x, sy = rootState.y, t0 = Date.now();
  startWalkCycle(dir);
  rootSprite.setAttribute("data-state", dir === "left" ? "walking-left" : "walking");
  (function step() {
    const p = Math.min((Date.now() - t0) / dur, 1);
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    positionRoot(sx + (newX - sx) * e, sy + (newY - sy) * e);
    if (p < 1) requestAnimationFrame(step);
    else {
      stopWalkCycle();
      setAnimation("idle");
      resetRoam();
    }
  })();
}
function setupControls() {
  ctrlRoam.addEventListener("click", (e) => {
    e.stopPropagation();
    roamEnabled = !roamEnabled;
    updateRoamButton();
    window.rootAPI.updateRootConfig({ roamEnabled });
    if (roamEnabled) resetRoam();
    else if (roamTimeout) { clearTimeout(roamTimeout); roamTimeout = null; }
  });
  ctrlSettings.addEventListener("click", (e) => { e.stopPropagation(); window.rootAPI.openSettings(); });
  rootSprite.addEventListener("contextmenu", (e) => { e.preventDefault(); window.rootAPI.openSettings(); });
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
  } catch {}
  window.rootAPI.onRootConfig((cfg) => {
    if (cfg.scale) { SPRITE_SIZE = cfg.scale; positionRoot(rootState.x, rootState.y); }
    if (typeof cfg.roamEnabled === "boolean") { roamEnabled = cfg.roamEnabled; updateRoamButton(); if (roamEnabled) resetRoam(); else if (roamTimeout) { clearTimeout(roamTimeout); roamTimeout = null; } }
    if (cfg.roamInterval) { roamInterval = cfg.roamInterval; resetRoam(); }
    if (cfg.roamSpeed) { roamSpeed = cfg.roamSpeed; }
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
  updateRoamButton();
  startIdleAnim();
  resetRoam();
  updateClickThrough();
  setTimeout(() => { setAnimation("wave", 1200); setTimeout(() => setAnimation("idle"), 1300); }, 600);
}
init();
