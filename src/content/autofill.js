import { FIELD_ORDER } from "../shared/fields.js";
import { normalizeNumberToPortal, isZeroValue } from "../shared/number.js";
import { dbg, dbgGroup, dbgGroupEnd } from "../shared/debug.js";

const LOG_PREFIX = "[SV-Autofill]";

export function extractRelevantLine(input) {
  if (input == null) return "";
  const s0 = String(input)
    .replace(/^\uFEFF/, "")
    .trim();
  if (!s0) return "";

  const lines = s0
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  return (lines.find((l) => l.includes(":")) || lines[0] || "").trim();
}

export function parseKeyedToMap(line) {
  const map = new Map();
  const parts = String(line || "")
    .split(";;")
    .map((p) => p.trim())
    .filter(Boolean);

  for (let p of parts) {
    p = p.replace(/^;+/, "").trim(); // tolerate ';;;'

    const idx = p.indexOf(":");
    if (idx <= 0) continue;

    const key = p.slice(0, idx).trim().replace(/^;+/, "");
    const value = p.slice(idx + 1).trim();
    if (!key) continue;

    map.set(key, value);
  }
  return map;
}

/** Find all expected inputs by their name attribute. */
export function findInputsByName(doc) {
  const map = new Map();
  for (const f of FIELD_ORDER) map.set(f, doc.querySelector(`input[name="${f}"]`));
  return map;
}

export function applyValuesToDocument(doc, valuesMap, { debug = false } = {}) {
  const evOpts = { bubbles: true };
  const inputsByName = findInputsByName(doc);

  const missing = FIELD_ORDER.filter((f) => !inputsByName.get(f));
  if (missing.length) {
    dbg(debug, LOG_PREFIX, "missing fields", missing);
    return {
      ok: false,
      message: "Not all expected fields were found.",
      details: missing.join(", ")
    };
  }

  let applied = 0;
  let skippedZero = 0;

  const g = dbgGroup(debug, LOG_PREFIX, "apply");

  for (const [name, rawVal] of valuesMap.entries()) {
    const el = inputsByName.get(name);
    if (!el) {
      dbg(debug, LOG_PREFIX, "ignore unknown key", name);
      continue;
    }

    const normalized = normalizeNumberToPortal(rawVal);
    if (normalized == null || normalized === "") continue;

    if (isZeroValue(normalized)) {
      skippedZero++;
      dbg(debug, LOG_PREFIX, "skip zero", name);
      continue;
    }

    if (el.readOnly || el.disabled) {
      dbg(debug, LOG_PREFIX, "skip readonly", name);
      continue;
    }

    el.value = normalized;
    el.dispatchEvent(new Event("input", evOpts));
    el.dispatchEvent(new Event("change", evOpts));
    el.dispatchEvent(new Event("blur", evOpts));

    applied++;
    dbg(debug, LOG_PREFIX, "set", name, normalized);
  }

  if (g) dbgGroupEnd(debug);

  dbg(debug, LOG_PREFIX, "summary", { applied, skippedZero });

  return {
    ok: true,
    appliedCount: applied,
    skippedZeroCount: skippedZero,
    message:
      applied === 0
        ? "No fields filled"
        : skippedZero === 0
          ? `Filled ${applied} field${applied === 1 ? "" : "s"}`
          : `Filled ${applied} field${applied === 1 ? "" : "s"}, ${skippedZero} × 0,00 skipped`
  };
}

export function runAutofillFromRaw(raw, doc = document, { debug = false } = {}) {
  const line = extractRelevantLine(raw);
  if (!line) return { ok: false, message: "No input found. Please paste keyed data." };

  if (!line.includes(":")) {
    return {
      ok: false,
      message: "Invalid format. Expected keyed input: feld:wert;;feld:wert;;…"
    };
  }

  const values = parseKeyedToMap(line);
  if (values.size === 0) {
    return { ok: false, message: "Keyed format detected, but no field:value pairs found." };
  }

  return applyValuesToDocument(doc, values, { debug });
}
