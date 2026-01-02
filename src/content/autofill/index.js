import { extractRelevantLine, parseKeyedToMap } from "./parse.js";
import { detectForm } from "./forms.js";
import { applyValuesToDocument } from "./apply.js";

export { extractRelevantLine, parseKeyedToMap } from "./parse.js";
export { detectForm, findInputsByName } from "./forms.js";
export { applyValuesToDocument } from "./apply.js";
export { classifyMissingNonZero, computeSeverity } from "./severity.js";

export function runAutofillFromRaw(raw, doc = document, { debug = false } = {}) {
  const line = extractRelevantLine(raw);
  if (!line) return { ok: false, message: "Kein Input gefunden. Bitte Feld-Input einfügen." };

  if (!line.includes(":")) {
    return { ok: false, message: "Ungültiges Format. Erwartet: feld:wert;;feld:wert;;…" };
  }

  const values = parseKeyedToMap(line);
  if (values.size === 0) {
    return { ok: false, message: "Eingabe erkannt, aber keine feld:wert-Paare gefunden." };
  }

  const formInfo = detectForm(doc, { debug });
  if (!formInfo.ok) return formInfo;

  return applyValuesToDocument(doc, values, formInfo, { debug });
}
