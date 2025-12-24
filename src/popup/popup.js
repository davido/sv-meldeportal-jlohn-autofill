import { clearStatus, setBusy, setStatus } from "./ui.js";
import { popupDbg } from "./debug.js";
import { readFromClipboardIfEmpty } from "./clipboard.js";
import { runInActiveTab } from "./tabBridge.js";
import { getDebugEnabled, setDebugEnabled } from "../shared/debugState.js";

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

async function initDebugToggle() {
  const toggle = document.getElementById("debugToggle");
  if (!toggle) return;

  toggle.checked = await getDebugEnabled();

  toggle.addEventListener("change", async () => {
    await setDebugEnabled(toggle.checked);
    setStatus(toggle.checked ? "Debug-Ausgaben aktiviert." : "Debug-Ausgaben deaktiviert.", "info");
    await popupDbg("Debug toggled:", toggle.checked ? "ON" : "OFF");
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await popupDbg("Popup loaded");

  await initDebugToggle();

  document.getElementById("btnClipboard")?.addEventListener("click", handleClipboardClick);
  document.getElementById("btnFillKeyed")?.addEventListener("click", handleFillKeyedClick);
});
