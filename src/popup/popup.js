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

function formatResultMessage(r) {
  const filled = typeof r.appliedCount === "number" ? r.appliedCount : 0;
  const skippedZero = typeof r.skippedZeroCount === "number" ? r.skippedZeroCount : 0;

  const filledLabel = filled === 1 ? "Feld" : "Felder";

  const formLabel =
    (typeof r.formLabel === "string" && r.formLabel.trim()) ||
    (typeof r.form === "string" && r.form.trim()) ||
    "unbekanntes Formular";

  const formSuffix = ` (${formLabel})`;

  let msg = `OK – ${filled} ${filledLabel} befüllt${formSuffix}`;

  if (skippedZero > 0) msg += `, ${skippedZero} × 0,00 übersprungen`;

  if (typeof r.details === "string" && r.details.trim()) {
    msg += `\n${r.details.trim()}`;
  }

  return msg;
}

function deriveLevelFromResult(r) {
  // Preferred: new structured severity
  if (r?.severity === "ok") return "ok";
  if (r?.severity === "warn") return "warn";
  if (r?.severity === "error") return "error";

  // Fallback: old heuristic based on count
  const missingNonZeroCount =
    typeof r?.missingNonZeroCount === "number"
      ? r.missingNonZeroCount
      : typeof r?.missingRequiredCount === "number"
        ? r.missingRequiredCount
        : 0;

  if (r?.ok) return "ok";
  return missingNonZeroCount === 1 ? "warn" : "error";
}

async function handleFillKeyedClick() {
  clearStatus();
  setBusy(true);

  try {
    const textarea = document.getElementById("keyedInput");
    let raw = (textarea?.value || "").trim();

    if (!raw) raw = await readFromClipboardIfEmpty(textarea);
    if (!raw) return setStatus("Keine Eingabe gefunden.", "error");

    const debug = await getDebugEnabled();

    setStatus("Sende Daten an den aktiven SV-Meldeportal-Tab …", "info");
    const r = await runInActiveTab({ raw, debug });

    if (debug) {
      console.log("[SV-Autofill][POPUP] Ergebnis:", r);
      if (r?.form || r?.formLabel) {
        console.log("[SV-Autofill][POPUP] Erkanntes Formular:", r.formLabel || r.form);
      }
    }

    const level = deriveLevelFromResult(r);

    if (level === "ok") {
      setStatus(formatResultMessage(r), "ok");
    } else {
      const details =
        typeof r?.details === "string" && r.details.trim() ? `\n${r.details.trim()}` : "";
      const msg = `${r?.message || "Fehler – nicht alle Werte konnten gesetzt werden."}${details}`;
      setStatus(msg, level);
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
        ? "Debug-Ausgaben aktiv (Konsole der SV-Meldeportal-Seite + Popup-Konsole)."
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
