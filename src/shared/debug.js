// Debug helper functions controlled ONLY by an explicit boolean.
// No storage access here.

export function dbg(debug, prefix, ...args) {
  if (!debug) return;
  console.log(prefix, ...args);
}

export function dbgGroup(debug, prefix, title) {
  if (!debug) return false;
  console.groupCollapsed(`${prefix} ${title}`);
  return true;
}

export function dbgGroupEnd(debug) {
  if (!debug) return;
  console.groupEnd();
}

