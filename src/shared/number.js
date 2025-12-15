/**
 * Normalize a number-like input into SV-Meldeportal compatible format.
 *
 * Rules:
 * - Accepts either comma or dot decimals (e.g. "12.5" -> "12,5").
 * - Removes thousand separators when both "." and "," exist (e.g. "1.234,50" -> "1234,50").
 * - Preserves a leading minus sign.
 * - Returns "" for empty inputs.
 * - Returns null for non-numeric inputs.
 */
export function normalizeNumberToPortal(val) {
  if (val == null) return "";
  let s = String(val).trim();
  if (s === "") return "";

  s = s.replace(/\s+/g, "");
  const neg = s.startsWith("-");
  if (neg) s = s.slice(1);

  if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "");
  else if (s.includes(".") && !s.includes(",")) s = s.replace(/\./g, ",");

  if (!/^\d+(?:,\d+)?$/.test(s)) return null;
  return (neg ? "-" : "") + s;
}

/**
 * Returns true if the given value represents numeric zero (e.g. "0", "0,00", 0).
 */
export function isZeroValue(val) {
  if (val == null) return false;
  const s = String(val).trim();
  if (s === "") return false;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n === 0;
}
