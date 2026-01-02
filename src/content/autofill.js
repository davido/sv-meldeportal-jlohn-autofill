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

function classifyMissingNonZero(name, value, requiredSet, dynamicSet) {
  if (requiredSet.has(name)) return { bucket: "required", name, value };
  if (dynamicSet.has(name)) return { bucket: "dynamic", name, value };
  return { bucket: "other", name, value };
}

/**
 * Severity policy:
 * - ok: no missing non-zero values
 * - warn: exactly 1 missing non-zero value AND it is dynamic (common UI-state case)
 * - error: missing required non-zero OR >=2 missing non-zero OR unknown/other missing
 *
 * This matches your “traffic light” expectations while still leveraging form metadata.
 */
function computeSeverity({ missingRequired, missingDynamic, missingOther }) {
  const total = missingRequired.length + missingDynamic.length + missingOther.length;
  if (total === 0) return "ok";

  // hard error if required/other missing
  if (missingRequired.length > 0 || missingOther.length > 0) return "error";

  // only dynamic missing
  return total === 1 ? "warn" : "error";
}

export function applyValuesToDocument(doc, valuesMap, formInfo, { debug = false } = {}) {
  const evOpts = { bubbles: true };
  const { fields, inputsByName, formId, formLabel, requiredFields, dynamicFields } = formInfo;

  const allowed = new Set(fields);
  const requiredSet = new Set(requiredFields || []);
  const dynamicSet = new Set(dynamicFields || []);

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

  // Missing non-zero buckets
  const missingRequiredNonZero = []; // {name,value}
  const missingDynamicNonZero = []; // {name,value}
  const missingOtherNonZero = []; // {name,value}

  const g = dbgGroup(debug, LOG_PREFIX, `apply (${formLabel})`);

  for (const [name, rawVal] of valuesMap.entries()) {
    // unknown for this form
    if (!allowed.has(name)) {
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

    // Lazy lookup: dynamic UI may render fields after user input (period selection etc.)
    let el = inputsByName.get(name);
    if (!el) {
      el = doc.querySelector(`input[name="${name}"]`);
      if (el) inputsByName.set(name, el);
    }

    if (!el) {
      const item = classifyMissingNonZero(name, normalized, requiredSet, dynamicSet);
      if (item.bucket === "required") missingRequiredNonZero.push(item);
      else if (item.bucket === "dynamic") missingDynamicNonZero.push(item);
      else missingOtherNonZero.push(item);

      dbg(
        debug,
        LOG_PREFIX,
        `FEHLT (≠0,00) [${item.bucket}] – Feld nicht im DOM, Wert NICHT gesetzt`,
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

  const missingRequiredNonZeroCount = missingRequiredNonZero.length;
  const missingDynamicNonZeroCount = missingDynamicNonZero.length;
  const missingOtherNonZeroCount = missingOtherNonZero.length;

  const missingNonZero = [
    ...missingRequiredNonZero,
    ...missingDynamicNonZero,
    ...missingOtherNonZero
  ];
  const missingNonZeroCount = missingNonZero.length;

  const severity = computeSeverity({
    missingRequired: missingRequiredNonZero,
    missingDynamic: missingDynamicNonZero,
    missingOther: missingOtherNonZero
  });

  // Keep ok semantics for popup compatibility:
  // ok=true only when severity is ok (green)
  const ok = severity === "ok";

  dbg(debug, LOG_PREFIX, "summary", {
    formId,
    applied,
    skippedZero,
    skippedReadonly,
    ignoredUnknown,
    severity,
    missingNonZeroCount,
    missingRequiredNonZeroCount,
    missingDynamicNonZeroCount,
    missingOtherNonZeroCount,
    missingRequiredNonZero,
    missingDynamicNonZero,
    missingOtherNonZero
  });

  // Details fürs Popup
  const detailsParts = [];

  if (missingNonZeroCount > 0) {
    const lines = [];
    if (missingRequiredNonZeroCount > 0) {
      lines.push(
        "Nicht gesetzte Pflichtfelder (≠ 0,00):\n" +
          missingRequiredNonZero.map((x) => `- ${x.name}: ${x.value}`).join("\n")
      );
    }
    if (missingDynamicNonZeroCount > 0) {
      lines.push(
        "Nicht gesetzte dynamische Felder (≠ 0,00):\n" +
          missingDynamicNonZero.map((x) => `- ${x.name}: ${x.value}`).join("\n")
      );
    }
    if (missingOtherNonZeroCount > 0) {
      lines.push(
        "Nicht gesetzte unbekannte/unerwartete Felder (≠ 0,00):\n" +
          missingOtherNonZero.map((x) => `- ${x.name}: ${x.value}`).join("\n")
      );
    }

    detailsParts.push(lines.join("\n\n"));

    if (missingDynamicNonZeroCount > 0) {
      detailsParts.push(
        "Tipp: Im SV-Meldeportal erscheinen manche Felder (z.B. Zusatzbeitrag) erst nach Eingabe des Beitragszeitraums oder abhängig von Auswahl."
      );
    }
  }

  if (missing.length > 0) {
    detailsParts.push(
      `Hinweis: ${missing.length} Formularfelder sind aktuell nicht vorhanden (evtl. abhängig von Auswahl).`
    );
  }

  const details = detailsParts.filter(Boolean).join("\n\n");

  const baseMsg =
    applied === 0
      ? `Keine Felder befüllt (${formLabel}).`
      : skippedZero === 0
        ? `${applied} Feld${applied === 1 ? "" : "er"} befüllt (${formLabel}).`
        : `${applied} Feld${applied === 1 ? "" : "er"} befüllt (${formLabel}), ${skippedZero}× 0,00 übersprungen.`;

  const message =
    severity === "ok"
      ? baseMsg
      : severity === "warn"
        ? `Warnung – nicht alle Werte konnten gesetzt werden (${formLabel}).`
        : `Fehler – nicht alle Werte konnten gesetzt werden (${formLabel}).`;

  return {
    ok,
    severity,
    message,
    details,

    form: formId,
    formLabel,

    appliedCount: applied,
    skippedZeroCount: skippedZero,
    skippedReadonlyCount: skippedReadonly,
    ignoredUnknownCount: ignoredUnknown,

    // Backwards-compatible fields
    missingNonZeroCount,
    missingNonZero,

    // New structured signal fields
    missingRequiredNonZeroCount,
    missingDynamicNonZeroCount,
    missingOtherNonZeroCount,
    missingRequiredNonZero,
    missingDynamicNonZero,
    missingOtherNonZero
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
