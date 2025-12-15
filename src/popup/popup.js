import { clearStatus, setBusy, setStatus } from "./ui.js";
import { popupDbg, popupDebugEnabled } from "./debug.js";
import { readFromClipboardIfEmpty } from "./clipboard.js";
import { transformPositionalToKeyed } from "../shared/transform.js";
import { runInActiveTab } from "./tabBridge.js";

async function handleClipboardClick() {
  const textarea = document.getElementById("jlohnInput");
  await readFromClipboardIfEmpty(textarea);
}

async function handleFillClick() {
  clearStatus();
  setBusy(true);
  try {
    const textarea = document.getElementById("jlohnInput");
    let raw = (textarea?.value || "").trim();
    if (!raw) raw = await readFromClipboardIfEmpty(textarea);
    if (!raw) return;

    setStatus("Sending positional data to the active SV-Meldeportal tab …", "info");
    const r = await runInActiveTab({ raw, debug: popupDebugEnabled() });

    if (r.ok) {
      setStatus(
        `Positional: OK – ${r.message || "Filled."}` +
          (typeof r.appliedCount === "number" ? ` (${r.appliedCount})` : ""),
        "ok"
      );
      if (r.keyedExport) {
        const keyed = document.getElementById("keyedInput");
        if (keyed && !keyed.value.trim()) keyed.value = r.keyedExport;
      }
    } else {
      setStatus(`Positional: Error – ${r.message || "unknown"}`, "error");
    }
  } finally {
    setBusy(false);
  }
}

function handleTransformClick() {
  clearStatus();
  const src = document.getElementById("jlohnInput");
  const dst = document.getElementById("keyedInput");

  const raw = (src?.value || "").trim();
  if (!raw) return setStatus("No positional line provided.", "error");

  try {
    dst.value = transformPositionalToKeyed(raw);
    setStatus("Transformed: positional → keyed (only fillable values, excluding 0).", "ok");
  } catch (e) {
    console.error(e);
    setStatus("Transform failed: " + (e?.message || String(e)), "error");
  }
}

async function handleFillKeyedClick() {
  clearStatus();
  setBusy(true);
  try {
    const textarea = document.getElementById("keyedInput");
    const raw = (textarea?.value || "").trim();
    if (!raw) return setStatus("No keyed input provided.", "error");

    setStatus("Sending keyed data to the active SV-Meldeportal tab …", "info");
    const r = await runInActiveTab({ raw, debug: popupDebugEnabled() });

    if (r.ok) {
      setStatus(
        `Keyed: OK – ${r.message || "Filled."}` +
          (typeof r.appliedCount === "number" ? ` (${r.appliedCount})` : ""),
        "ok"
      );
    } else {
      setStatus(`Keyed: Error – ${r.message || "unknown"}`, "error");
    }
  } finally {
    setBusy(false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  popupDbg("Popup loaded");
  document.getElementById("btnClipboard")?.addEventListener("click", handleClipboardClick);
  document.getElementById("btnFill")?.addEventListener("click", handleFillClick);
  document.getElementById("btnTransform")?.addEventListener("click", handleTransformClick);
  document.getElementById("btnFillKeyed")?.addEventListener("click", handleFillKeyedClick);
});
