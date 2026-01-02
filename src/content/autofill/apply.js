import { normalizeNumberToPortal, isZeroValue } from "../../shared/number.js";
import { dbg, dbgGroup, dbgGroupEnd } from "../../shared/debug.js";
import { classifyMissingNonZero, computeSeverity } from "./severity.js";

const LOG_PREFIX = "[SV-Autofill]";

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
  const missingRequiredNonZero = []; // {bucket,name,value}
  const missingDynamicNonZero = []; // {bucket,name,value}
  const missingOtherNonZero = []; // {bucket,name,value}

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

  // ✅ Debug clean-up:
  // - Keep "summary" compact (no nested arrays)
  // - Show missingNonZero as a dedicated table (if present)
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
    missingOtherNonZeroCount
  });

  if (missingNonZeroCount > 0) {
    dbg(debug, LOG_PREFIX, "missingNonZero", missingNonZero);
  }

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
