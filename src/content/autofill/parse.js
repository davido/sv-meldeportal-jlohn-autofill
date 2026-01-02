/**
 * Parsing helpers for keyed JLohn export input.
 * Keeps parsing isolated from DOM logic and form handling.
 */

/**
 * Extrahiert eine sinnvolle Zeile aus dem Rohtext.
 * - Bei Multi-Line: bevorzugt eine Zeile mit ":" (keyed)
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

  return (lines.find((l) => l.includes(":")) || lines[0] || "").trim();
}

/**
 * Parsed keyed input in Map(fieldName -> rawValue).
 * Toleriert ";;;" (führt zu leerem Token) und führende ';' in Tokens.
 */
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

