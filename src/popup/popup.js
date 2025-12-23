import { clearStatus, setBusy, setStatus } from "./ui.js";
import { popupDbg, popupDebugEnabled } from "./debug.js";
import { readFromClipboardIfEmpty } from "./clipboard.js";
import { runInActiveTab } from "./tabBridge.js";

const DEBUG_KEY = "SV_AUTOFILL_DEBUG";

function isDebugEnabled() {
  try {
    return localStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

function setDebugEnabled(on) {
  try {
    if (on) localStorage.setItem(DEBUG_KEY, "1");
    else localStorage.removeItem(DEBUG_KEY);
  } catch {
    // ignore
  }
}

async function handleClipboardClick() {
  const textarea = document.getElementById("keyedInput");
  await readFromClipboardIfEmpty(textarea);
}

async function handleFillKeyedClick() {
  clearStatus();
  setBusy(true);
  try {
    const textarea = document.getElementById("keyedInput");
    let raw = (textarea?.value || "").trim();

    // Optional: falls leer, direkt aus Zwischenablage holen
    if (!raw) raw = await readFromClipboardIfEmpty(textarea);
    if (!raw) return setStatus("Keine Eingabe gefunden.", "error");

    setStatus("Sende Daten an den aktiven SV-Meldeportal-Tab …", "info");
    const r = await runInActiveTab({ raw, debug: popupDebugEnabled() });

    if (r?.ok) {
      const filled = typeof r.appliedCount === "number" ? r.appliedCount : 0;
      const skippedZero = typeof r.skippedZeroCount === "number" ? r.skippedZeroCount : 0;

      const filledLabel = filled === 1 ? "Feld" : "Felder";
      let msg = `OK – ${filled} ${filledLabel} befüllt`;

      if (skippedZero > 0) {
        msg += `, ${skippedZero} × 0,00 übersprungen`;
      }

      setStatus(msg, "ok");
    } else {
      setStatus(`Fehler – ${r?.message || "unbekannt"}`, "error");
    }
  } finally {
    setBusy(false);
  }
}

function initDebugToggle() {
  const toggle = document.getElementById("debugToggle");
  if (!toggle) return;

  toggle.checked = isDebugEnabled();

  toggle.addEventListener("change", () => {
    setDebugEnabled(toggle.checked);

    // nur Info, kein "ok/error"
    setStatus(toggle.checked ? "Debug-Ausgaben aktiviert." : "Debug-Ausgaben deaktiviert.", "info");

    popupDbg("Debug toggled:", toggle.checked ? "ON" : "OFF");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  popupDbg("Popup loaded");

  initDebugToggle();

  document.getElementById("btnClipboard")?.addEventListener("click", handleClipboardClick);
  document.getElementById("btnFillKeyed")?.addEventListener("click", handleFillKeyedClick);
});
