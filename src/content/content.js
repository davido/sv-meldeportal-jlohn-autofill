import { runAutofillFromRaw } from "./autofill/index.js";

/**
 * Content script message handler.
 *
 * IMPORTANT:
 * This file can be injected multiple times by chrome.scripting.executeScript.
 * Without a guard, we'd register the onMessage listener multiple times and
 * run autofill N times per click (duplicate logs / duplicate work).
 */
const LISTENER_FLAG = "__SV_AUTOFILL_LISTENER_INSTALLED__";

if (!globalThis[LISTENER_FLAG]) {
  globalThis[LISTENER_FLAG] = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "SV_AUTOFILL_RUN") return;

    try {
      const raw = msg?.payload?.raw ?? "";
      const debug = msg?.payload?.debug === true;

      const result = runAutofillFromRaw(raw, document, { debug });
      sendResponse(result);
    } catch (e) {
      console.error("[SV-Autofill] Content error:", e);
      sendResponse({ ok: false, message: e?.message || String(e) });
    }

    return true;
  });
}
