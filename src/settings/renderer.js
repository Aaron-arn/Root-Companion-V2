const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");
tabs.forEach(t => {
  t.addEventListener("click", () => {
    tabs.forEach(x => x.classList.remove("active"));
    panels.forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    document.getElementById("panel-" + t.dataset.tab).classList.add("active");
  });
});
const scaleInput = document.getElementById("scale");
const scaleValue = document.getElementById("scale-value");
const roamEnabledInput = document.getElementById("roam-enabled");
const roamIntervalInput = document.getElementById("roam-interval");
const roamIntervalValue = document.getElementById("roam-interval-value");
const roamSpeedInput = document.getElementById("roam-speed");
const roamSpeedValue = document.getElementById("roam-speed-value");
const idleSleepInput = document.getElementById("idle-sleep");
const idleSleepValue = document.getElementById("idle-sleep-value");
const idleHideInput = document.getElementById("idle-hide");
const idleHideValue = document.getElementById("idle-hide-value");
const sleepPosInput = document.getElementById("sleep-pos");
const providerInput = document.getElementById("api-provider");
const modelInput = document.getElementById("api-model");
const keyInput = document.getElementById("api-key");
const baseUrlInput = document.getElementById("api-base-url");
const baseUrlRow = document.getElementById("base-url-row");
const saveBtn = document.getElementById("save-ia");
const testBtn = document.getElementById("test-ia");
const resultEl = document.getElementById("ia-result");
function updateScaleLabel() { scaleValue.textContent = scaleInput.value + "px"; }
function updateIntervalLabel() {
  const v = parseInt(roamIntervalInput.value);
  roamIntervalValue.textContent = v >= 60 ? (v / 60).toFixed(v % 60 === 0 ? 0 : 1) + "min" : v + "s";
}
function updateSpeedLabel() { roamSpeedValue.textContent = parseFloat(roamSpeedInput.value).toFixed(1) + "s"; }
function updateSleepLabel() { idleSleepValue.textContent = idleSleepInput.value + " min"; }
function updateHideLabel() { idleHideValue.textContent = idleHideInput.value + " min"; }
scaleInput.addEventListener("input", () => {
  updateScaleLabel();
  saveSprite();
});
roamIntervalInput.addEventListener("input", () => {
  updateIntervalLabel();
  saveSprite();
});
roamSpeedInput.addEventListener("input", () => {
  updateSpeedLabel();
  saveSprite();
});
idleSleepInput.addEventListener("input", () => {
  updateSleepLabel();
  saveSprite();
});
idleHideInput.addEventListener("input", () => {
  updateHideLabel();
  saveSprite();
});
sleepPosInput.addEventListener("change", saveSprite);
roamEnabledInput.addEventListener("change", saveSprite);
providerInput.addEventListener("change", () => {
  if (providerInput.value === "custom") baseUrlRow.style.display = "flex";
  else baseUrlRow.style.display = "none";
});
async function loadConfig() {
  const cfg = await window.rootAPI.getRootConfig();
  scaleInput.value = cfg.scale || 128;
  updateScaleLabel();
  roamEnabledInput.checked = cfg.roamEnabled !== false;
  roamIntervalInput.value = cfg.roamInterval || 15;
  updateIntervalLabel();
  roamSpeedInput.value = cfg.roamSpeed ? (cfg.roamSpeed / 1000) : 1.8;
  updateSpeedLabel();
  idleSleepInput.value = cfg.idleSleepMin || 3;
  updateSleepLabel();
  idleHideInput.value = cfg.idleHideMin || 5;
  updateHideLabel();
  sleepPosInput.value = cfg.sleepPos || "bottom-center";
  providerInput.value = cfg.apiProvider || "openai";
  modelInput.value = cfg.apiModel || "gpt-4o-mini";
  keyInput.value = cfg.apiKey || "";
  baseUrlInput.value = cfg.apiBaseUrl || "";
  if (providerInput.value === "custom") baseUrlRow.style.display = "flex";
}
async function saveSprite() {
  await window.rootAPI.updateRootConfig({
    scale: parseInt(scaleInput.value),
    roamEnabled: roamEnabledInput.checked,
    roamInterval: parseInt(roamIntervalInput.value),
    roamSpeed: Math.round(parseFloat(roamSpeedInput.value) * 1000),
    idleSleepMin: parseInt(idleSleepInput.value),
    idleHideMin: parseInt(idleHideInput.value),
    sleepPos: sleepPosInput.value
  });
}
saveBtn.addEventListener("click", async () => {
  await window.rootAPI.updateRootConfig({
    apiProvider: providerInput.value,
    apiModel: modelInput.value.trim(),
    apiKey: keyInput.value.trim(),
    apiBaseUrl: baseUrlInput.value.trim()
  });
  resultEl.textContent = "Sauvegarde okk";
  resultEl.className = "result ok";
  resultEl.classList.remove("hidden");
  setTimeout(() => resultEl.classList.add("hidden"), 2000);
});
testBtn.addEventListener("click", async () => {
  resultEl.textContent = "Test en cours...";
  resultEl.className = "result";
  resultEl.classList.remove("hidden");
  const res = await window.rootAPI.testIA({
    apiProvider: providerInput.value,
    apiModel: modelInput.value.trim(),
    apiKey: keyInput.value.trim(),
    apiBaseUrl: baseUrlInput.value.trim()
  });
  if (res.success) {
    resultEl.textContent = "connexion reussiee";
    resultEl.className = "result ok";
  } else {
    resultEl.textContent = "Erreurr : " + res.error;
    resultEl.className = "result err";
  }
});
loadConfig();
