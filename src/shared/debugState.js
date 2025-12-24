// src/shared/debugState.js
const KEY = "svAutofillDebug";

/**
 * Returns Promise<boolean>
 */
export async function getDebugEnabled() {
  try {
    const r = await chrome.storage.local.get(KEY);
    return r?.[KEY] === true;
  } catch {
    return false;
  }
}

/**
 * Set debug flag.
 * @param {boolean} enabled
 */
export async function setDebugEnabled(enabled) {
  try {
    await chrome.storage.local.set({ [KEY]: !!enabled });
  } catch {
    // ignore
  }
}
