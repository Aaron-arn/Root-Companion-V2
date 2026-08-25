let SPRITE_SIZE = 128;
const DRAG_THRESHOLD = 5;
const rootSprite = document.getElementById("root-sprite");
const rootImg = document.getElementById("root-img");
const rootControls = document.getElementById("root-controls");
const ctrlChat = document.getElementById("ctrl-chat");
const ctrlRoam = document.getElementById("ctrl-roam");
const ctrlSleep = document.getElementById("ctrl-sleep");
const ctrlSettings = document.getElementById("ctrl-settings");
const sleepBubble = document.getElementById("sleep-bubble");
const sleepPill = document.getElementById("sleep-pill");
const notifBubble = document.getElementById("notif-bubble");
const sleepWakeBtn = document.getElementById("sleep-wake-btn");
const sleepHideBtn = document.getElementById("sleep-hide-btn");
const notifClose = document.getElementById("notif-close");
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
let idleSleepMin = 3;
let idleHideMin = 5;
let sleepPos = "bottom-center";
let isChatOpen = false;
let isSleeping = false;
let isHidden = false;
let isSleepBubbleHidden = false;
let idleTimeout = null;
let hideTimeout = null;
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
  writing: "../../asset/root-writing.png",
  sleeping: "../../asset/root-sleep.png"
};
const WALK_CYCLE = {
  left: ["../../asset/root-walk-left-1.png", "../../asset/root-walk-left-2.png"],
  right: ["../../asset/root-walk-left-1.png", "../../asset/root-walk-left-2.png"]
};
let ignoreMouseEvents = true;
let isMouseOverRoot = false;
let isMouseOverControls = false;
let isMouseOverChat = false;
let isMouseOverSleep = false;
let isMouseOverNotif = false;
function setClickThrough(ignore, opts) {
  if (ignore === ignoreMouseEvents && !opts) return;
  ignoreMouseEvents = ignore;
  window.rootAPI.setIgnoreMouseEvents(ignore, opts || {});
}
function updateClickThrough() {
  if (isChatOpen) { setClickThrough(false); return; }
  if (isDragging || isMouseOverRoot || isMouseOverControls || isMouseOverChat || isMouseOverSleep || isMouseOverNotif) { setClickThrough(false); return; }
  setClickThrough(true, { forward: true });
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
function applySleepPos(pos) {
  sleepPos = pos;
  const els = [sleepBubble, notifBubble];
  els.forEach(el => {
    el.style.top = "";
    el.style.bottom = "";
    el.style.left = "";
    el.style.right = "";
    el.style.transform = "";
  });
  sleepPill.style.top = "";
  sleepPill.style.bottom = "";
  sleepPill.style.left = "";
  sleepPill.style.right = "";
  sleepPill.style.transform = "";
  const isTop = pos.startsWith("top");
  const isLeft = pos.endsWith("left");
  const isRight = pos.endsWith("right");
  const isCenter = pos.endsWith("center");
  els.forEach(el => {
    if (isTop) el.style.top = "18px"; else el.style.bottom = "18px";
    if (isLeft) { el.style.left = "18px"; el.style.right = "auto"; el.style.transform = "none"; }
    else if (isRight) { el.style.right = "18px"; el.style.left = "auto"; el.style.transform = "none"; }
    else { el.style.left = "50%"; el.style.transform = "translateX(-50%)"; }
  });
  if (isTop) sleepPill.style.top = "18px"; else sleepPill.style.bottom = "18px";
  if (isLeft) { sleepPill.style.left = "18px"; sleepPill.style.right = "auto"; sleepPill.style.transform = "none"; }
  else if (isRight) { sleepPill.style.right = "18px"; sleepPill.style.left = "auto"; sleepPill.style.transform = "none"; }
  else { sleepPill.style.left = "50%"; sleepPill.style.transform = "translateX(-50%)"; }
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
    if (isSleeping) { rootSprite.setAttribute("data-state", "sleeping"); stopWalkCycle(); rootImg.src = SPRITES.sleeping; }
  }
  if (isDragging) {
    const newDir = e.clientX - (rootState.x + dragOffsetX) < 0 ? "left" : "right";
    if (newDir !== dragDirection && !isSleeping) {
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
    if (isSleeping) setAnimation("sleeping");
    else { setAnimation("idle"); startIdleAnim(); }
    resetRoam();
    updateClickThrough();
    resetIdleTimer();
  } else {
    if (isSleeping || isHidden) return;
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
  if (!roamEnabled || isSleeping || isHidden) return;
  const delay = roamInterval * 1000;
  roamTimeout = setTimeout(roamToRandom, delay);
}
function roamToRandom() {
  if (isDragging || isMouseOverRoot || isMouseOverControls || isMouseOverChat || isMouseOverSleep || isMouseOverNotif || isChatOpen || isSleeping || isHidden || !roamEnabled) { resetRoam(); return; }
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
    resetIdleTimer();
  });
  ctrlSleep.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isSleeping || isHidden) wakeRoot(); else sleepRoot();
    resetIdleTimer();
  });
  ctrlSettings.addEventListener("click", (e) => { e.stopPropagation(); window.rootAPI.openSettings(); resetIdleTimer(); });
  rootSprite.addEventListener("contextmenu", (e) => { e.preventDefault(); window.rootAPI.openSettings(); resetIdleTimer(); });
}
function resetIdleTimer() {
  if (idleTimeout) clearTimeout(idleTimeout);
  if (hideTimeout) clearTimeout(hideTimeout);
  if (isSleeping || isHidden) return;
  idleTimeout = setTimeout(() => { if (!isChatOpen && !isDragging && !isSleeping) sleepRoot(); }, idleSleepMin * 60000);
  hideTimeout = setTimeout(() => { if (isSleeping && !isChatOpen && !isDragging) hideRoot(); }, idleHideMin * 60000);
}
function sleepRoot() {
  isSleeping = true;
  setAnimation("sleeping");
  if (!isSleepBubbleHidden) sleepBubble.classList.remove("hidden");
  updateClickThrough();
  const w = window.innerWidth, h = window.innerHeight;
  let tx, ty;
  if (sleepPos.endsWith("left")) tx = 20;
  else if (sleepPos.endsWith("right")) tx = w - SPRITE_SIZE - 20;
  else tx = Math.floor((w - SPRITE_SIZE) / 2);
  if (sleepPos.startsWith("top")) ty = 20;
  else ty = h - SPRITE_SIZE - 100;
  const sx = rootState.x, sy = rootState.y, t0 = Date.now(), dur = 1200;
  (function step() {
    const p = Math.min((Date.now() - t0) / dur, 1);
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    positionRoot(sx + (tx - sx) * e, sy + (ty - sy) * e);
    if (p < 1) requestAnimationFrame(step);
  })();
}
function wakeRoot() {
  isSleeping = false;
  isHidden = false;
  rootSprite.classList.remove("hidden-sprite");
  sleepBubble.classList.add("hidden");
  notifBubble.classList.add("hidden");
  sleepPill.classList.add("hidden");
  setAnimation("idle");
  updateClickThrough();
  resetIdleTimer();
}
function hideRoot() {
  isHidden = true;
  rootSprite.classList.add("hidden-sprite");
  sleepBubble.classList.add("hidden");
  notifBubble.classList.add("hidden");
  sleepPill.classList.remove("hidden");
  updateClickThrough();
}
function setupSleep() {
  sleepWakeBtn.addEventListener("click", (e) => { e.stopPropagation(); wakeRoot(); });
  sleepBubble.addEventListener("click", (e) => {
    if (e.target === sleepWakeBtn || e.target.closest("#sleep-wake-btn") || e.target.closest("#sleep-hide-btn")) return;
    isSleepBubbleHidden = true;
    sleepBubble.classList.add("hidden");
    sleepPill.classList.remove("hidden");
    updateClickThrough();
  });
  sleepHideBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    isSleepBubbleHidden = true;
    sleepBubble.classList.add("hidden");
    sleepPill.classList.remove("hidden");
    updateClickThrough();
  });
  sleepPill.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isHidden) { notifBubble.classList.remove("hidden"); sleepPill.classList.add("hidden"); isMouseOverNotif = true; updateClickThrough(); }
    else { sleepBubble.classList.remove("hidden"); sleepPill.classList.add("hidden"); isSleepBubbleHidden = false; isMouseOverSleep = true; updateClickThrough(); }
  });
  notifBubble.addEventListener("click", () => wakeRoot());
  notifBubble.addEventListener("mouseenter", () => { isMouseOverNotif = true; updateClickThrough(); });
  notifBubble.addEventListener("mouseleave", () => { isMouseOverNotif = false; updateClickThrough(); });
  sleepBubble.addEventListener("mouseenter", () => { isMouseOverSleep = true; updateClickThrough(); });
  sleepBubble.addEventListener("mouseleave", () => { isMouseOverSleep = false; updateClickThrough(); });
  sleepPill.addEventListener("mouseenter", () => { isMouseOverSleep = true; updateClickThrough(); });
  sleepPill.addEventListener("mouseleave", () => { isMouseOverSleep = false; updateClickThrough(); });
  notifClose.addEventListener("click", (e) => {
    e.stopPropagation();
    notifBubble.classList.add("hidden");
    sleepPill.classList.remove("hidden");
    updateClickThrough();
  });
}
