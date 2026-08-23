const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { BrowserWindow, ipcMain, screen } = require("electron");
const CAPTURE_SCRIPT = `param([string]$Mode = "screen", [string]$Out = "")
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Win32Cap {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int max);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$x = $bounds.X; $y = $bounds.Y; $w = $bounds.Width; $h = $bounds.Height
if ($Mode -eq "window") {
  $script:target = [IntPtr]::Zero
  $cb = [Win32Cap+EnumWindowsProc]{ param($hWnd, $lParam)
    if ([Win32Cap]::IsWindowVisible($hWnd)) {
      $sb = New-Object System.Text.StringBuilder 256
      [Win32Cap]::GetWindowText($hWnd, $sb, 256) | Out-Null
      if ($sb.ToString() -and $sb.ToString() -notmatch "Root") {
        $script:target = $hWnd
        return $false
      }
    }
    return $true
  }
  [Win32Cap]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
  if ($script:target -ne [IntPtr]::Zero) {
    $rect = New-Object Win32Cap+RECT
    [Win32Cap]::GetWindowRect($script:target, [ref]$rect) | Out-Null
    $x = $rect.Left; $y = $rect.Top; $w = $rect.Right - $rect.Left; $h = $rect.Bottom - $rect.Top
  }
}
if ($w -le 0 -or $h -le 0) { Write-Error "Aucune fenetre trouvee"; exit 1 }
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($x, $y, 0, 0, (New-Object System.Drawing.Size($w, $h)))
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()`;
const TEMP_DIR = path.join(os.tmpdir(), "root-v2");
function ensureDir() { if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true }); }
function scriptPath() {
  ensureDir();
  const p = path.join(TEMP_DIR, "capture.ps1");
  if (!fs.existsSync(p)) fs.writeFileSync(p, "\ufeff" + CAPTURE_SCRIPT, "utf8");
  return p;
}
function pngSize(buf) { try { return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }; } catch { return { width: 0, height: 0 }; } }
function captureWithPS(mode) {
  return new Promise(resolve => {
    ensureDir();
    const out = path.join(TEMP_DIR, "cap-" + Date.now() + ".png");
    execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath(), "-Mode", mode, "-Out", out], { timeout: 15000, windowsHide: true }, err => {
      if (err) { try { fs.unlinkSync(out); } catch {} return resolve({ success: false, error: "Echec capture: " + err.message }); }
      if (!fs.existsSync(out)) return resolve({ success: false, error: "Aucune image" });
      const buf = fs.readFileSync(out);
      try { fs.unlinkSync(out); } catch {}
      const s = pngSize(buf);
      resolve({ success: true, dataUrl: "data:image/png;base64," + buf.toString("base64"), width: s.width, height: s.height });
    });
  });
}
let pendingShot = null;
async function captureScreenshot(mode, hide, show) {
  if (hide) hide();
  await new Promise(r => setTimeout(r, 400));
  try { return await captureWithPS(mode === "window" ? "window" : "screen"); } finally { if (show) show(); }
}
async function captureRegion(hide, show, getWin, createWin) {
  if (hide) hide();
  await new Promise(r => setTimeout(r, 400));
  try {
    const shot = await captureWithPS("screen");
    if (!shot.success) return shot;
    pendingShot = shot;
    const { screen, BrowserWindow, ipcMain } = require("electron");
    const path = require("path");
    const b = screen.getPrimaryDisplay().bounds;
    return await new Promise(resolve => {
      let done = false;
      const finish = r => { if (done) return; done = true; if (!win.isDestroyed()) win.close(); resolve(r); };
      const win = new BrowserWindow({ width: b.width, height: b.height, x: b.x, y: b.y, frame: false, transparent: true, alwaysOnTop: true, resizable: false, skipTaskbar: true, hasShadow: false, webPreferences: { preload: require("path").join(__dirname, "..", "..", "preload.js"), contextIsolation: true, nodeIntegration: false } });
      win.loadFile(path.join(__dirname, "..", "region", "index.html"));
      const { ipcMain: ipc } = require("electron");
      ipc.once("region-result", (e, r) => finish(r));
      win.on("closed", () => finish({ success: false, error: "Annulé" }));
    });
  } finally { pendingShot = null; if (show) show(); }
}
function getRegionScreenshot() { return pendingShot; }
module.exports = { captureScreenshot, captureRegion, getRegionScreenshot };
