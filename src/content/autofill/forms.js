import { FORM_DEFS } from "../../shared/forms.js";
import { dbg } from "../../shared/debug.js";

const LOG_PREFIX = "[SV-Autofill]";

/** Baut eine Map(name -> inputElement|null) für ein bestimmtes Feld-Set. */
export function findInputsByName(doc, fields) {
  const map = new Map();
  for (const f of fields) map.set(f, doc.querySelector(`input[name="${f}"]`));
  return map;
}

/**
 * Erkennt automatisch, welches Formular (Form-Definition) auf der Seite ist.
 * Scoring: Anzahl gefundener Detect-Felder, Tie-Break: Coverage.
 */
export function detectForm(doc, { debug = false } = {}) {
  const scored = FORM_DEFS.map((def) => {
    const inputsByName = findInputsByName(doc, def.fields);

    const detectFields =
      Array.isArray(def.detectBy) && def.detectBy.length ? def.detectBy : def.fields;
    const found = detectFields.filter((f) => doc.querySelector(`input[name="${f}"]`)).length;
    const coverage = detectFields.length ? found / detectFields.length : 0;

    return { def, inputsByName, found, coverage, detectTotal: detectFields.length };
  }).sort((a, b) => {
    if (b.found !== a.found) return b.found - a.found;
    return b.coverage - a.coverage;
  });

  const best = scored[0];

  dbg(
    debug,
    LOG_PREFIX,
    "form detection scores",
    scored.map((x) => ({
      id: x.def.id,
      label: x.def.label,
      found: x.found,
      total: x.detectTotal,
      coverage: Math.round(x.coverage * 100) + "%"
    }))
  );

  if (!best || best.found === 0) {
    return {
      ok: false,
      message: "Kein bekanntes Formular erkannt. Bist du auf der richtigen Eingabeseite?"
    };
  }

  return {
    ok: true,
    formId: best.def.id,
    formLabel: best.def.label,
    fields: best.def.fields,
    requiredFields: best.def.requiredFields || [],
    dynamicFields: best.def.dynamicFields || [],
    inputsByName: best.inputsByName,
    foundCount: best.found,
    totalCount: best.detectTotal
  };
}

