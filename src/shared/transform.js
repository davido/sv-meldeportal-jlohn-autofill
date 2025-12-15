import { FIELD_ORDER } from "./fields.js";
import { normalizeNumberToPortal, isZeroValue } from "./number.js";

/**
 * Split a positional JLohn line into tokens by ';;'.
 * - Trims whitespace
 * - Removes trailing empty tokens
 * - Interprets ';;;' as an empty field (leading ';' gets stripped)
 */
export function splitTokensStrict(line) {
  let tokens = String(line || "")
    .split(";;")
    .map((t) => t.trim());

  while (tokens.length > 0 && tokens[tokens.length - 1] === "") tokens.pop();
  tokens = tokens.map((t) => t.replace(/^;+/, "").trim());
  return tokens;
}

/**
 * Transform a positional JLohn line into the "keyed" format:
 *   fieldName:value;;fieldName:value;;...
 *
 * Notes:
 * - Only includes fields that are non-empty, numeric, and not zero.
 * - Ignores invalid numbers instead of failing (review-friendly behavior).
 */
export function transformPositionalToKeyed(raw) {
  const line = String(raw || "")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!line.includes(";;"))
    throw new Error("No ';;' separator found. Expected positional JLohn format.");

  const tokens = splitTokensStrict(line);
  if (tokens.length > FIELD_ORDER.length) {
    throw new Error(`Too many values (${tokens.length}), expected max ${FIELD_ORDER.length}.`);
  }

  const filled = tokens.slice();
  while (filled.length < FIELD_ORDER.length) filled.push("");

  const pairs = [];
  for (let i = 0; i < FIELD_ORDER.length; i++) {
    const rawVal = filled[i];
    if (!rawVal) continue;

    const normalized = normalizeNumberToPortal(rawVal);
    if (normalized == null) continue;
    if (normalized === "" || isZeroValue(normalized)) continue;

    pairs.push(`${FIELD_ORDER[i]}:${normalized}`);
  }

  if (!pairs.length) throw new Error("No fillable values found (only empty or 0).");
  return pairs.join(";;");
}
