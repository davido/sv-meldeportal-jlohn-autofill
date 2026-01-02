// Debug helper functions controlled ONLY by an explicit boolean.
// No storage access here.

function isPlainObject(v) {
  return (
    v != null &&
    typeof v === "object" &&
    (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)
  );
}

function isArrayOfObjects(v) {
  return Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object");
}

/**
 * dbg(debug, prefix, label, data?)
 *
 * Behaviors:
 * - dbg(..., label) -> simple log line
 * - dbg(..., label, arrayOfObjects) -> table
 * - dbg(..., label, plainObject) -> table with 1 row (no JSON string)
 * - dbg(..., label, anythingElse...) -> console.log(...)
 */
export function dbg(debug, prefix, ...args) {
  if (!debug) return;

  // no payload
  if (args.length <= 1) {
    console.log(prefix, ...args);
    return;
  }

  const [label, payload, ...rest] = args;

  // If payload is a table candidate, show it as a compact table wrapped in a group.
  if (isArrayOfObjects(payload)) {
    console.groupCollapsed(`${prefix} ${label}`);
    console.table(payload);
    if (rest.length) console.log(...rest);
    console.groupEnd();
    return;
  }

  if (isPlainObject(payload)) {
    console.groupCollapsed(`${prefix} ${label}`);
    console.table([payload]); // <-- this fixes the JSON-string "summary"
    if (rest.length) console.log(...rest);
    console.groupEnd();
    return;
  }

  // Fallback: normal log (keeps e.g. strings, numbers, etc.)
  console.log(prefix, label, payload, ...rest);
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
