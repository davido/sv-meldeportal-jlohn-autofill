// src/popup/debug.js
import { getDebugEnabled } from "../shared/debugState.js";

export async function popupDebugEnabled() {
  return await getDebugEnabled();
}

export async function popupDbg(...args) {
  if (!(await popupDebugEnabled())) return;
  // eslint-disable-next-line no-console
  console.log("[SV-Autofill][POPUP]", ...args);
}
