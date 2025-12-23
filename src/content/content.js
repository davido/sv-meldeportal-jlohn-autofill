import { runAutofillFromRaw } from "./autofill.js";

/**
 * Content script message handler.
 * The popup injects this script on demand and then sends { raw } to be processed.
 */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "SV_AUTOFILL_RUN") return;

  try {
    const raw = msg?.payload?.raw ?? "";
    const debug = msg?.payload?.debug === true;

    // keyed-only: runAutofillFromRaw expects field:value;;field:value...
    const result = runAutofillFromRaw(raw, document, { debug });
    sendResponse(result);
  } catch (e) {
    console.error("[SV-Autofill] Content error:", e);
    sendResponse({ ok: false, message: e?.message || String(e) });
  }

  return true;
});
