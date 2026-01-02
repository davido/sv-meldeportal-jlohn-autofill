import { describe, it, expect } from "vitest";
import { FIELD_ORDER } from "../src/shared/fields.js";
import { FORM_DEFS } from "../src/shared/forms.js";
import {
  extractRelevantLine,
  parseKeyedToMap,
  detectForm,
  runAutofillFromRaw
} from "../src/content/autofill.js";

function makeDocWithInputs(fieldNames) {
  const doc = document.implementation.createHTMLDocument("test");
  const form = doc.createElement("form");
  for (const f of fieldNames) {
    const input = doc.createElement("input");
    input.setAttribute("name", f);
    form.appendChild(input);
  }
  doc.body.appendChild(form);
  return doc;
}

function getFormDef(id) {
  const def = FORM_DEFS.find((d) => d.id === id);
  if (!def) throw new Error(`FORM_DEFS missing id=${id}`);
  return def;
}

describe("content/autofill helpers (keyed-only)", () => {
  it("extractRelevantLine prefers a line containing ':'", () => {
    const raw = "hello\nbeitrag1000:10,00;;beitragU1:5,00\nbye";
    expect(extractRelevantLine(raw)).toBe("beitrag1000:10,00;;beitragU1:5,00");
  });

  it("extractRelevantLine falls back to first non-empty line", () => {
    const raw = "  \nfoo\nbar";
    expect(extractRelevantLine(raw)).toBe("foo");
  });

  it("parseKeyedToMap parses field:value pairs", () => {
    const m = parseKeyedToMap("a:1;;b:2");
    expect(m.get("a")).toBe("1");
    expect(m.get("b")).toBe("2");
  });

  it("parseKeyedToMap ignores invalid parts", () => {
    const m = parseKeyedToMap("a:1;;invalid;;:nope;;b:2;;");
    expect(m.get("a")).toBe("1");
    expect(m.get("b")).toBe("2");
    expect(m.has("invalid")).toBe(false);
  });

  it("parseKeyedToMap tolerates leading ';' (e.g. from ';;;')", () => {
    const m = parseKeyedToMap(";beitragKrankenversFreiw:438,00;;beitragU1:214,58");
    expect(m.get("beitragKrankenversFreiw")).toBe("438,00");
    expect(m.get("beitragU1")).toBe("214,58");
  });
});

describe("detectForm (jsdom)", () => {
  it("detects standard form when FIELD_ORDER inputs exist", () => {
    const doc = makeDocWithInputs(FIELD_ORDER);
    const r = detectForm(doc);
    expect(r.ok).toBe(true);
    expect(r.formId).toBe("formStandard");
  });

  it("detects minijob form when its inputs exist", () => {
    const minijob = getFormDef("formMinijobKnappschaft");
    const doc = makeDocWithInputs(minijob.fields);
    const r = detectForm(doc);
    expect(r.ok).toBe(true);
    expect(r.formId).toBe("formMinijobKnappschaft");
  });

  it("fails if no known form fields exist", () => {
    const doc = makeDocWithInputs(["someOtherField1", "someOtherField2"]);
    const r = detectForm(doc);
    expect(r.ok).toBe(false);
    expect(String(r.message)).toContain("Kein bekanntes Formular erkannt");
  });
});

describe("runAutofillFromRaw (jsdom, multi-form keyed-only)", () => {
  it("fills fields on standard form", () => {
    const doc = makeDocWithInputs(FIELD_ORDER);
    const r = runAutofillFromRaw("beitrag1000:10,00;;beitragU1:5,00", doc);
    expect(r.ok).toBe(true);
    expect(r.form).toBe("formStandard");
    expect(doc.querySelector('input[name="beitrag1000"]').value).toBe("10,00");
    expect(doc.querySelector('input[name="beitragU1"]').value).toBe("5,00");
  });

  it("fills fields on minijob form (KV Knappschaft)", () => {
    const minijob = getFormDef("formMinijobKnappschaft");
    const doc = makeDocWithInputs(minijob.fields);

    const raw =
      "beitrag6000:39,00;;beitrag0100:55,80;;beitragU1:3,30;;beitragU2:0,66;;beitragPauschsteuer:6,00";
    const r = runAutofillFromRaw(raw, doc);

    expect(r.ok).toBe(true);
    expect(r.form).toBe("formMinijobKnappschaft");

    expect(doc.querySelector('input[name="beitrag6000"]').value).toBe("39,00");
    expect(doc.querySelector('input[name="beitrag0100"]').value).toBe("55,80");
    expect(doc.querySelector('input[name="beitragU1"]').value).toBe("3,30");
    expect(doc.querySelector('input[name="beitragU2"]').value).toBe("0,66");
    expect(doc.querySelector('input[name="beitragPauschsteuer"]').value).toBe("6,00");
  });

  it("fills fields even if keyed parts contain leading ';' from ';;;'", () => {
    const doc = makeDocWithInputs(FIELD_ORDER);
    const r = runAutofillFromRaw("beitragU1:214,58;;;beitragKrankenversFreiw:438,00", doc);
    expect(r.ok).toBe(true);
    expect(doc.querySelector('input[name="beitragU1"]').value).toBe("214,58");
    expect(doc.querySelector('input[name="beitragKrankenversFreiw"]').value).toBe("438,00");
  });

  it("ignores unknown keys (counts ignoredUnknownCount)", () => {
    const doc = makeDocWithInputs(FIELD_ORDER);
    const r = runAutofillFromRaw("unknownField:99,99;;beitrag1000:10,00", doc);
    expect(r.ok).toBe(true);
    expect(r.ignoredUnknownCount).toBeGreaterThanOrEqual(1);
    expect(doc.querySelector('input[name="beitrag1000"]').value).toBe("10,00");
  });

  it("fails if input is not keyed format", () => {
    const doc = makeDocWithInputs(FIELD_ORDER);
    const r = runAutofillFromRaw("511,00;;17,89;;", doc);
    expect(r.ok).toBe(false);
    expect(String(r.message)).toContain("Ungültiges Format");
  });

  it("fails if no known form is detected on the page", () => {
    const doc = makeDocWithInputs(["someOtherField"]);
    const r = runAutofillFromRaw("beitrag1000:10,00", doc);
    expect(r.ok).toBe(false);
    expect(String(r.message)).toContain("Kein bekanntes Formular erkannt");
  });

  it("skips readonly fields and counts skippedReadonlyCount", () => {
    const doc = makeDocWithInputs(FIELD_ORDER);
    const el = doc.querySelector('input[name="beitrag1000"]');
    el.setAttribute("readonly", "");

    const r = runAutofillFromRaw("beitrag1000:10,00;;beitragU1:5,00", doc);

    expect(r.ok).toBe(true);
    expect(r.skippedReadonlyCount).toBeGreaterThanOrEqual(1);
    expect(el.value).toBe("");
    expect(doc.querySelector('input[name="beitragU1"]').value).toBe("5,00");
  });

  it("skips zero values and counts skippedZeroCount", () => {
    const doc = makeDocWithInputs(FIELD_ORDER);
    const r = runAutofillFromRaw("beitrag1000:0.00;;beitragU1:5.00", doc);

    expect(r.ok).toBe(true);
    expect(r.appliedCount).toBe(1);
    expect(r.skippedZeroCount).toBe(1);

    expect(doc.querySelector('input[name="beitrag1000"]').value).toBe("");
    expect(doc.querySelector('input[name="beitragU1"]').value).toBe("5,00");
  });

  it("skips non-numeric values (normalize returns null)", () => {
    const doc = makeDocWithInputs(FIELD_ORDER);
    const r = runAutofillFromRaw("beitrag1000:abc;;beitragU1:5,00", doc);
    expect(r.ok).toBe(true);
    expect(doc.querySelector('input[name="beitrag1000"]').value).toBe("");
    expect(doc.querySelector('input[name="beitragU1"]').value).toBe("5,00");
  });

  // -----------------------------
  // Ampel-Signale (severity + buckets)
  // -----------------------------

  it("ampel: green (severity=ok) when missing fields exist but missing values are 0,00", () => {
    const reducedFields = FIELD_ORDER.filter(
      (f) => f !== "beitragZusatzKrankenvers" && f !== "beitragZusatz"
    );
    const doc = makeDocWithInputs(reducedFields);

    const raw =
      "beitrag1000:10,00;;beitragZusatzKrankenvers:0,00;;beitragZusatz:0,00;;beitragU1:5,00";
    const r = runAutofillFromRaw(raw, doc);

    expect(r.ok).toBe(true);
    expect(r.severity).toBe("ok");
    expect(r.missingNonZeroCount ?? 0).toBe(0);
  });

  it("ampel: yellow (severity=warn) when exactly one dynamic non-zero field cannot be set", () => {
    const reducedFields = FIELD_ORDER.filter((f) => f !== "beitragZusatzKrankenvers");
    const doc = makeDocWithInputs(reducedFields);

    const raw = "beitrag1000:10,00;;beitragZusatzKrankenvers:115,16;;beitragU1:5,00";
    const r = runAutofillFromRaw(raw, doc);

    expect(r.ok).toBe(false); // not all values applied
    expect(r.severity).toBe("warn");

    expect(r.missingNonZeroCount).toBe(1);
    expect(r.missingDynamicNonZeroCount).toBe(1);
    expect(r.missingRequiredNonZeroCount).toBe(0);

    expect(String(r.details || "")).toContain("beitragZusatzKrankenvers");
    expect(String(r.details || "")).toContain("115,16");
  });

  it("ampel: red (severity=error) when two or more non-zero fields cannot be set", () => {
    const reducedFields = FIELD_ORDER.filter(
      (f) => f !== "beitragZusatzKrankenvers" && f !== "beitragZusatz"
    );
    const doc = makeDocWithInputs(reducedFields);

    const raw =
      "beitrag1000:10,00;;beitragZusatzKrankenvers:115,16;;beitragZusatz:12,34;;beitragU1:5,00";
    const r = runAutofillFromRaw(raw, doc);

    expect(r.ok).toBe(false);
    expect(r.severity).toBe("error");
    expect(r.missingNonZeroCount).toBeGreaterThanOrEqual(2);
    expect(String(r.details || "")).toContain("beitragZusatzKrankenvers");
    expect(String(r.details || "")).toContain("beitragZusatz");
  });
});
