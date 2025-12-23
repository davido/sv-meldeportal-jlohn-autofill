import { FIELD_ORDER } from "../shared/fields.js";
import { normalizeNumberToPortal, isZeroValue } from "../shared/number.js";

/**
 * Extract a single relevant line from raw input.
 * - Handles pasted multi-line strings by picking a line containing ':' (keyed).
 */
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

  // keyed-only: prefer a line that contains ':'
  return (lines.find((l) => l.includes(":")) || lines[0] || "").trim();
}

/**
 * Parse keyed input into a Map(fieldName -> rawValue).
 *
 * Robust against accidental extra semicolons (e.g. ';;;') which can leave leading ';'
 * on the next token when splitting by ';;'.
 */
export function parseKeyedToMap(line) {
  const map = new Map();
  const parts = String(line || "")
    .split(";;")
    .map((p) => p.trim())
    .filter(Boolean);

  for (let p of parts) {
    // ✅ tolerate ';;;': remove leftover leading ';' from tokens like ';beitragX:123'
    p = p.replace(/^;+/, "").trim();

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

/**
 * Apply values to the document and trigger events.
 * Skips empty/zero/readonly/disabled fields.
 * Counts skipped zero values (0,00) for JLohn/AutoHotKey compatibility.
 */
export function applyValuesToDocument(doc, valuesMap, { debug = false } = {}) {
  const evOpts = { bubbles: true };
  const inputsByName = findInputsByName(doc);

  const missing = FIELD_ORDER.filter((f) => !inputsByName.get(f));
  if (missing.length) {
    return {
      ok: false,
      message: "Not all expected fields were found. Are you on the contribution form page?",
      details: missing.join(", ")
    };
  }

  const applied = [];
  let skippedZeroCount = 0;

  function setField(name, rawVal) {
    const el = inputsByName.get(name);
    if (!el) return;

    const normalized = normalizeNumberToPortal(rawVal);
    if (normalized == null) return;
    if (normalized === "") return;

    if (isZeroValue(normalized)) {
      skippedZeroCount++;
      return;
    }

    if (el.readOnly || el.hasAttribute("readonly") || el.disabled) {
      if (debug) console.log("[SV-Autofill] SKIP readonly/disabled", name);
      return;
    }

    el.focus();
    el.value = normalized;
    el.dispatchEvent(new Event("input", evOpts));
    el.dispatchEvent(new Event("change", evOpts));
    el.dispatchEvent(new Event("blur", evOpts));

    applied.push({ name, val: normalized });
  }

  // Only apply keys we actually know (FIELD_ORDER). Unknown keys are ignored.
  for (const [name, rawVal] of valuesMap.entries()) {
    if (!inputsByName.has(name)) continue;
    setField(name, rawVal);
  }

  const keyedExport = applied.map((x) => `${x.name}:${x.val}`).join(";;");
  return {
    ok: true,
    message: applied.length
      ? `Filled ${applied.length} fields`
      : "No fields filled (only empty/zero or non-editable).",
    appliedCount: applied.length,
    skippedZeroCount,
    keyedExport
  };
}

/** Main entry point called by the content script message handler. */
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
