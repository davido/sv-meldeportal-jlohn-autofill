// Debug helper functions controlled ONLY by an explicit boolean.
// No storage access here.

/**
 * True when the value is an array of plain objects suitable for console.table.
 */
function isArrayOfObjects(v) {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((x) => x && typeof x === "object" && !Array.isArray(x))
  );
}

/**
 * Compact formatting to avoid DevTools dumping huge prototype trees.
 * - primitives pass through
 * - arrays of primitives get a short inline representation
 * - objects/arrays/maps/sets are JSON-stringified best-effort
 */
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

export function dbg(debug, prefix, ...args) {
  if (!debug) return;

  // If any argument is an array of objects, show it as a table
  const idx = args.findIndex(isArrayOfObjects);
  if (idx >= 0) {
    const tableData = args[idx];
    const before = args.slice(0, idx).map(formatArg);
    const after = args.slice(idx + 1).map(formatArg);

    // Keep context line compact
    console.log(prefix, ...before, ...after);

    // Show the structured data as a table
    console.table(tableData);
    return;
  }

  // Default: compact output
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
