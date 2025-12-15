import { FIELD_ORDER } from "../shared/fields.js";
import { normalizeNumberToPortal, isZeroValue } from "../shared/number.js";

/**
 * Extract a single relevant line from raw input.
 * - Handles pasted multi-line strings by picking a line containing ';;' or ':'.
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
  return (lines.find((l) => l.includes(";;") || l.includes(":")) || lines[0] || "").trim();
}

/** Split positional input by ';;'. */
export function splitTokens(line) {
  let tokens = String(line || "")
    .split(";;")
    .map((t) => t.trim());
  while (tokens.length > 0 && tokens[tokens.length - 1] === "") tokens.pop();
  tokens = tokens.map((t) => t.replace(/^;+/, "").trim());
  return tokens;
}

/** Parse keyed input into a Map(fieldName -> rawValue). */
export function parseKeyedToMap(line) {
  const map = new Map();
  const parts = String(line || "")
    .split(";;")
    .map((p) => p.trim())
    .filter(Boolean);

  for (const p of parts) {
    const idx = p.indexOf(":");
    if (idx <= 0) continue;
    const key = p.slice(0, idx).trim();
    const value = p.slice(idx + 1).trim();
    if (!key) continue;
    map.set(key, value);
  }
  return map;
}

/**
 * Build a Map(fieldName -> rawValue) from positional tokens.
 * Missing values are padded with "".
 */
export function mapPositionalToFields(tokens) {
  if (tokens.length > FIELD_ORDER.length) {
    return { ok: false, message: `Too many positional values (${tokens.length}).` };
  }
  const filled = tokens.slice();
  while (filled.length < FIELD_ORDER.length) filled.push("");

  const values = new Map();
  for (let i = 0; i < FIELD_ORDER.length; i++) values.set(FIELD_ORDER[i], filled[i] ?? "");
  return { ok: true, values };
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
  function setField(name, rawVal) {
    const el = inputsByName.get(name);
    if (!el) return;

    const normalized = normalizeNumberToPortal(rawVal);
    if (normalized == null) return;
    if (normalized === "" || isZeroValue(normalized)) return;

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
    keyedExport
  };
}

/** Main entry point called by the content script message handler. */
export function runAutofillFromRaw(raw, doc = document, { debug = false } = {}) {
  const line = extractRelevantLine(raw);
  if (!line)
    return { ok: false, message: "No input found. Please paste positional or keyed data." };

  const isKeyed = line.includes(":");
  if (isKeyed) {
    const values = parseKeyedToMap(line);
    if (values.size === 0)
      return { ok: false, message: "Keyed format detected, but no field:value pairs found." };
    return applyValuesToDocument(doc, values, { debug });
  }

  if (!line.includes(";;"))
    return { ok: false, message: "Invalid format: ';;' separator not found." };

  const tokens = splitTokens(line);
  const mapped = mapPositionalToFields(tokens);
  if (!mapped.ok) return mapped;

  for (const [name, rawVal] of mapped.values.entries()) {
    if (!rawVal) continue;
    const n = normalizeNumberToPortal(rawVal);
    if (n == null) {
      return {
        ok: false,
        message: "Non-numeric value in positional input.",
        details: `${name}: "${rawVal}"`
      };
    }
  }

  return applyValuesToDocument(doc, mapped.values, { debug });
}
