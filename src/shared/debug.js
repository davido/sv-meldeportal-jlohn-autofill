const DEBUG_KEY = "SV_AUTOFILL_DEBUG";

export function isDebugEnabled() {
  try {
    return localStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

export function dbg(prefix, ...args) {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log(prefix, ...args);
}

export function dbgGroup(prefix, title) {
  if (!isDebugEnabled()) return false;
  // eslint-disable-next-line no-console
  console.groupCollapsed(`${prefix} ${title}`);
  return true;
}

export function dbgGroupEnd() {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.groupEnd();
}
