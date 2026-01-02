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

  const allowed = new Set(fields);

  // Erwartete Felder, die aktuell nicht im DOM sind (toleriert, aber wir reporten)
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

  // NEU: ≠0,00 Werte, die nicht gesetzt werden konnten, weil Feld fehlt
  const missingNonZero = []; // { name, value }

  const g = dbgGroup(debug, LOG_PREFIX, `apply (${formLabel})`);

  for (const [name, rawVal] of valuesMap.entries()) {
    // 1) Wirklich unbekannt: nicht Teil dieses Formulars
    if (!allowed.has(name)) {
      ignoredUnknown++;
      dbg(debug, LOG_PREFIX, "ignoriere unbekannten Key (für dieses Formular)", name);
      continue;
    }

    const normalized = normalizeNumberToPortal(rawVal);
    if (normalized == null || normalized === "") continue;

    // 0,00 ist explizit "egal" -> nicht required
    if (isZeroValue(normalized)) {
      skippedZero++;
      dbg(debug, LOG_PREFIX, "überspringe 0,00", name);
      continue;
    }

    // 2) Lazy lookup: falls Feld dynamisch nach Beitragszeitraum o. ä. erscheint
    let el = inputsByName.get(name);
    if (!el) {
      el = doc.querySelector(`input[name="${name}"]`);
      if (el) inputsByName.set(name, el);
    }

    // 3) Feld fehlt -> für ≠0,00 ein Fehler (für Status rot)
    if (!el) {
      missingNonZero.push({ name, value: normalized });
      dbg(
        debug,
        LOG_PREFIX,
        "FEHLT (≠0,00) – Feld nicht im DOM, Wert NICHT gesetzt",
        name,
        normalized
      );
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

  const missingNonZeroCount = missingNonZero.length;

  dbg(debug, LOG_PREFIX, "summary", {
    formId,
    applied,
    skippedZero,
    skippedReadonly,
    ignoredUnknown,
    missingNonZeroCount,
    missingNonZero
  });

  // Details fürs Popup
  const detailsParts = [];

  if (missingNonZeroCount > 0) {
    detailsParts.push(
      `Nicht gesetzte Werte (≠ 0,00), weil Felder auf der Maske fehlen:\n` +
        missingNonZero.map((x) => `- ${x.name}: ${x.value}`).join("\n")
    );
    detailsParts.push(
      `Tipp: Im SV-Meldeportal erscheinen manche Felder (z.B. Zusatzbeitrag) erst nach Eingabe des Beitragszeitraums.`
    );
  }

  if (missing.length > 0) {
    detailsParts.push(
      `Hinweis: ${missing.length} Formularfelder sind aktuell nicht vorhanden (evtl. abhängig von Auswahl).`
    );
  }

  const details = detailsParts.filter(Boolean).join("\n\n");

  // ✅ Rot (ok=false), sobald ≠0,00 nicht gesetzt werden konnte
  const ok = missingNonZeroCount === 0;

  const baseMsg =
    applied === 0
      ? `Keine Felder befüllt (${formLabel}).`
      : skippedZero === 0
        ? `${applied} Feld${applied === 1 ? "" : "er"} befüllt (${formLabel}).`
        : `${applied} Feld${applied === 1 ? "" : "er"} befüllt (${formLabel}), ${skippedZero}× 0,00 übersprungen.`;

  const message = ok ? baseMsg : `Fehler – nicht alle Werte konnten gesetzt werden (${formLabel}).`;

  return {
    ok,
    message,
    details,
    form: formId,
    formLabel,
    appliedCount: applied,
    skippedZeroCount: skippedZero,
    skippedReadonlyCount: skippedReadonly,
    ignoredUnknownCount: ignoredUnknown,
    missingNonZeroCount,
    missingNonZero
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
