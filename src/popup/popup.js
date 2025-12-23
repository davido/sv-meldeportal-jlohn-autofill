import { clearStatus, setBusy, setStatus } from "./ui.js";
import { popupDbg, popupDebugEnabled } from "./debug.js";
import { readFromClipboardIfEmpty } from "./clipboard.js";
import { runInActiveTab } from "./tabBridge.js";

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

    setStatus("Sende Daten an den aktiven SV-Meldeportal-Tab …", "info");
    const r = await runInActiveTab({ raw, debug: popupDebugEnabled() });

    if (r?.ok) {
      const filled = typeof r.appliedCount === "number" ? r.appliedCount : 0;
      const skippedZero = typeof r.skippedZeroCount === "number" ? r.skippedZeroCount : 0;

      const filledLabel = filled === 1 ? "Feld" : "Felder";
      const skippedLabel = skippedZero === 1 ? "× 0,00 übersprungen" : "× 0,00 übersprungen";

      let msg = `OK – ${filled} ${filledLabel} befüllt`;

      if (skippedZero > 0) {
        msg += `, ${skippedZero} ${skippedLabel}`;
      }

      setStatus(msg, "ok");
    } else {
      setStatus(`Fehler – ${r?.message || "unknown"}`, "error");
    }
  } finally {
    setBusy(false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  popupDbg("Popup loaded");
  document.getElementById("btnClipboard")?.addEventListener("click", handleClipboardClick);
  document.getElementById("btnFillKeyed")?.addEventListener("click", handleFillKeyedClick);
});
