import { clearStatus, setBusy, setStatus } from "./ui.js";
import { readFromClipboardIfEmpty } from "./clipboard.js";
import { runInActiveTab } from "./tabBridge.js";

const DEBUG_KEY = "SV_AUTOFILL_DEBUG";

// --- chrome.storage.local helpers (MV3 safe) ---
function storageGet(key) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([key], (result) => resolve(result?.[key]));
    } catch {
      resolve(undefined);
    }
  });
}

function storageSet(obj) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(obj, () => resolve());
    } catch {
      resolve();
    }
  });
}

async function getDebugEnabled() {
  const v = await storageGet(DEBUG_KEY);
  return v === true; // stored as boolean
}

async function setDebugEnabled(on) {
  await storageSet({ [DEBUG_KEY]: !!on });
}

// --- handlers ---
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

    // optional: falls leer, direkt aus Zwischenablage holen
    if (!raw) raw = await readFromClipboardIfEmpty(textarea);
    if (!raw) return setStatus("Keine Eingabe gefunden.", "error");

    const debug = await getDebugEnabled();

    setStatus("Sende Daten an den aktiven SV-Meldeportal-Tab …", "info");
    const r = await runInActiveTab({ raw, debug });

    if (r?.ok) {
      const filled = typeof r.appliedCount === "number" ? r.appliedCount : 0;
      const skippedZero = typeof r.skippedZeroCount === "number" ? r.skippedZeroCount : 0;

      const filledLabel = filled === 1 ? "Feld" : "Felder";
      let msg = `OK – ${filled} ${filledLabel} befüllt`;

      if (skippedZero > 0) msg += `, ${skippedZero} × 0,00 übersprungen`;

      setStatus(msg, "ok");
    } else {
      setStatus(`Fehler – ${r?.message || "unbekannt"}`, "error");
    }
  } finally {
    setBusy(false);
  }
}

async function initDebugToggle() {
  const toggle = document.getElementById("debugToggle");
  if (!toggle) return;

  toggle.checked = await getDebugEnabled();

  toggle.addEventListener("change", async () => {
    await setDebugEnabled(toggle.checked);
    setStatus(
      toggle.checked
        ? "Debug-Ausgaben aktiv (in der Konsole der SV-Meldeportal-Seite)."
        : "Debug-Ausgaben deaktiviert.",
      "info"
    );
  });
}

// --- init ---
document.addEventListener("DOMContentLoaded", () => {
  initDebugToggle();
  document.getElementById("btnClipboard")?.addEventListener("click", handleClipboardClick);
  document.getElementById("btnFillKeyed")?.addEventListener("click", handleFillKeyedClick);
});
