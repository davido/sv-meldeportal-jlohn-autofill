// Debug helper functions controlled ONLY by an explicit boolean.
// No storage access here.

export function dbg(debug, prefix, ...args) {
  if (!debug) return;
  // eslint-disable-next-line no-console
  console.log(prefix, ...args);
}

export function dbgGroup(debug, prefix, title) {
  if (!debug) return false;
  // eslint-disable-next-line no-console
  console.groupCollapsed(`${prefix} ${title}`);
  return true;
}

export function dbgGroupEnd(debug) {
  if (!debug) return;
  // eslint-disable-next-line no-console
  console.groupEnd();
}
