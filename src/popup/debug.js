const POPUP_DEBUG_DEFAULT = false;

export function popupDebugEnabled() {
  try {
    return localStorage.getItem("SV_AUTOFILL_DEBUG") === "1" || POPUP_DEBUG_DEFAULT;
  } catch {
    return POPUP_DEBUG_DEFAULT;
  }
}

export function popupDbg(...args) {
  if (!popupDebugEnabled()) return;
  console.log("[SV-Autofill][POPUP]", ...args);
}
