// Debug helper functions controlled ONLY by an explicit boolean.
// No storage access here.

function isArrayOfObjects(v) {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((x) => x && typeof x === "object" && !Array.isArray(x))
  );
}

function formatArg(v) {
  if (v == null) return String(v);

  const t = typeof v;
  if (t === "string" || t === "number" || t === "boolean") return v;

  if (Array.isArray(v)) {
    const smallPrimitive =
      v.length <= 12 &&
      v.every((x) => x == null || ["string", "number", "boolean"].includes(typeof x));
    if (smallPrimitive) return `[${v.map((x) => (x == null ? String(x) : x)).join(", ")}]`;

    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }

  try {
    if (v instanceof Map) return JSON.stringify(Object.fromEntries(v));
    if (v instanceof Set) return JSON.stringify(Array.from(v));
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * Debug logger:
 * - If an argument is an array of objects -> show it as a table, but grouped/collapsed.
 * - Otherwise compact log output (stringify objects to avoid prototype tree noise).
 */
export function dbg(debug, prefix, ...args) {
  if (!debug) return;

  const idx = args.findIndex(isArrayOfObjects);
  if (idx >= 0) {
    const tableData = args[idx];
    const before = args.slice(0, idx).map(formatArg);
    const after = args.slice(idx + 1).map(formatArg);

    // Put the table inside a collapsed group so it doesn't spam the console timeline.
    const titleParts = [prefix, ...before, ...after].filter((x) => x !== "");
    console.groupCollapsed(...titleParts);
    console.table(tableData);
    console.groupEnd();
    return;
  }

  console.log(prefix, ...args.map(formatArg));
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
