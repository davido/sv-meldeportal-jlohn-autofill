import { FORM_DEFS } from "../shared/forms.js";
import { normalizeNumberToPortal, isZeroValue } from "../shared/number.js";
import { dbg, dbgGroup, dbgGroupEnd } from "../shared/debug.js";

const LOG_PREFIX = "[SV-Autofill]";

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

/** Baut eine Map(name -> inputElement|null) für ein bestimmtes Feld-Set. */
export function findInputsByName(doc, fields) {
  const map = new Map();
  for (const f of fields) map.set(f, doc.querySelector(`input[name="${f}"]`));
  return map;
}

/**
 * Erkennt automatisch, welches Formular (Form-Definition) auf der Seite ist.
 * Scoring: Anzahl gefundener Felder, Tie-Break: Coverage.
 */
export function detectForm(doc, { debug = false } = {}) {
  const scored = FORM_DEFS.map((def) => {
    const inputsByName = findInputsByName(doc, def.fields);
    const found = def.fields.filter((f) => inputsByName.get(f)).length;
    const coverage = def.fields.length ? found / def.fields.length : 0;
    return { def, inputsByName, found, coverage };
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
      total: x.def.fields.length,
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
    inputsByName: best.inputsByName,
    foundCount: best.found,
    totalCount: best.def.fields.length
  };
}

export function applyValuesToDocument(doc, valuesMap, formInfo, { debug = false } = {}) {
  const evOpts = { bubbles: true };
  const { fields, inputsByName, formId, formLabel } = formInfo;

  // Wir sind absichtlich tolerant: manche Portale blenden Felder dynamisch ein/aus.
  // Trotzdem loggen wir, wenn erwartete Felder fehlen.
  const missing = fields.filter((f) => !inputsByName.get(f));
  if (missing.length) {
    dbg(debug, LOG_PREFIX, "fehlende Felder (toleriert)", {
      formId,
      missingCount: missing.length,
      missing
    });
  }

  let applied = 0;
  let skippedZero = 0;
  let skippedReadonly = 0;
  let ignoredUnknown = 0;

  const g = dbgGroup(debug, LOG_PREFIX, `apply (${formLabel})`);

  for (const [name, rawVal] of valuesMap.entries()) {
    const el = inputsByName.get(name);
    if (!el) {
      // Keyed-Daten dürfen mehr enthalten als das aktuelle Formular braucht
      ignoredUnknown++;
      dbg(debug, LOG_PREFIX, "ignoriere unbekannten Key (für dieses Formular)", name);
      continue;
    }

    const normalized = normalizeNumberToPortal(rawVal);
    if (normalized == null || normalized === "") continue;

    if (isZeroValue(normalized)) {
      skippedZero++;
      dbg(debug, LOG_PREFIX, "überspringe 0,00", name);
      continue;
    }

    if (el.readOnly || el.hasAttribute("readonly") || el.disabled) {
      skippedReadonly++;
      dbg(debug, LOG_PREFIX, "überspringe readonly/disabled", name);
      continue;
    }

    el.value = normalized;
    el.dispatchEvent(new Event("input", evOpts));
    el.dispatchEvent(new Event("change", evOpts));
    el.dispatchEvent(new Event("blur", evOpts));

    applied++;
    dbg(debug, LOG_PREFIX, "setze", name, normalized);
  }

  if (g) dbgGroupEnd(debug);

  dbg(debug, LOG_PREFIX, "summary", {
    formId,
    applied,
    skippedZero,
    skippedReadonly,
    ignoredUnknown
  });

  // Optionaler Hinweistext (nur wenn wirklich viele Felder fehlen)
  const missingHint =
    missing.length > 0
      ? `Hinweis: ${missing.length} Felder des Formulars „${formLabel}“ sind auf der Seite nicht vorhanden (evtl. abhängig von Auswahl).`
      : "";

  const baseMsg =
    applied === 0
      ? `Keine Felder befüllt (${formLabel}).`
      : skippedZero === 0
        ? `${applied} Feld${applied === 1 ? "" : "er"} befüllt (${formLabel}).`
        : `${applied} Feld${applied === 1 ? "" : "er"} befüllt (${formLabel}), ${skippedZero}× 0,00 übersprungen.`;

  return {
    ok: true,
    form: formId,
    formLabel,
    appliedCount: applied,
    skippedZeroCount: skippedZero,
    skippedReadonlyCount: skippedReadonly,
    ignoredUnknownCount: ignoredUnknown,
    message: missingHint ? `${baseMsg}\n${missingHint}` : baseMsg
  };
}

export function runAutofillFromRaw(raw, doc = document, { debug = false } = {}) {
  const line = extractRelevantLine(raw);
  if (!line) return { ok: false, message: "Kein Input gefunden. Bitte Feld-Input einfügen." };

  if (!line.includes(":")) {
    return {
      ok: false,
      message: "Ungültiges Format. Erwartet: feld:wert;;feld:wert;;…"
    };
  }

  const values = parseKeyedToMap(line);
  if (values.size === 0) {
    return { ok: false, message: "Eingabe erkannt, aber keine feld:wert-Paare gefunden." };
  }

  const formInfo = detectForm(doc, { debug });
  if (!formInfo.ok) return formInfo;

  return applyValuesToDocument(doc, values, formInfo, { debug });
}
