import { describe, it, expect } from "vitest";
import { FIELD_ORDER } from "../src/shared/fields.js";
import {
  extractRelevantLine,
  parseKeyedToMap,
  splitTokens,
  mapPositionalToFields,
  runAutofillFromRaw
} from "../src/content/autofill.js";

function makeDocWithInputs() {
  const doc = document.implementation.createHTMLDocument("test");
  const form = doc.createElement("form");
  for (const f of FIELD_ORDER) {
    const input = doc.createElement("input");
    input.setAttribute("name", f);
    form.appendChild(input);
  }
  doc.body.appendChild(form);
  return doc;
}

describe("content/autofill helpers", () => {
  it("extractRelevantLine picks a meaningful line", () => {
    const raw = "hello\n511,00;;17,89;;\nbye";
    expect(extractRelevantLine(raw)).toBe("511,00;;17,89;;");
  });

  it("parseKeyedToMap parses field:value pairs", () => {
    const m = parseKeyedToMap("a:1;;b:2");
    expect(m.get("a")).toBe("1");
    expect(m.get("b")).toBe("2");
  });

  it("splitTokens treats ';;;' like ';;' (ignores extra ';')", () => {
    expect(splitTokens("1;;;2")).toEqual(["1", "2"]);
  });

  it("mapPositionalToFields pads to FIELD_ORDER length", () => {
    const r = mapPositionalToFields(["1", "2"]);
    expect(r.ok).toBe(true);
    expect(r.values.get(FIELD_ORDER[0])).toBe("1");
    expect(r.values.get(FIELD_ORDER[1])).toBe("2");
    expect(r.values.get(FIELD_ORDER[2])).toBe("");
  });
});

describe("runAutofillFromRaw (jsdom)", () => {
  it("fills fields from positional input", () => {
    const doc = makeDocWithInputs();
    const r = runAutofillFromRaw("511,00;;17,89;;0,00;;", doc);
    expect(r.ok).toBe(true);
    expect(doc.querySelector('input[name="beitrag1000"]').value).toBe("511,00");
    expect(doc.querySelector('input[name="beitragssatzAllgemein"]').value).toBe("17,89");
    expect(doc.querySelector('input[name="beitrag3000"]').value).toBe("");
  });

  it("fills fields from keyed input", () => {
    const doc = makeDocWithInputs();
    const r = runAutofillFromRaw("beitrag1000:10,00;;beitragU1:5,00", doc);
    expect(r.ok).toBe(true);
    expect(doc.querySelector('input[name="beitrag1000"]').value).toBe("10,00");
    expect(doc.querySelector('input[name="beitragU1"]').value).toBe("5,00");
  });

  it("fails if required fields are missing", () => {
    const doc = document.implementation.createHTMLDocument("missing");
    doc.body.innerHTML = '<input name="beitrag1000" />';
    const r = runAutofillFromRaw("beitrag1000:10,00", doc);
    expect(r.ok).toBe(false);
    expect(String(r.message)).toContain("Not all expected fields");
  });

  it("rejects non-numeric positional value", () => {
    const doc = makeDocWithInputs();
    const r = runAutofillFromRaw("abc;;17,89;;", doc);
    expect(r.ok).toBe(false);
    expect(String(r.message)).toContain("Non-numeric");
  });

  it("skips readonly fields", () => {
    const doc = makeDocWithInputs();
    const el = doc.querySelector('input[name="beitrag1000"]');
    el.setAttribute("readonly", "");
    const r = runAutofillFromRaw("beitrag1000:10,00;;beitragU1:5,00", doc);
    expect(r.ok).toBe(true);
    expect(el.value).toBe("");
    expect(doc.querySelector('input[name="beitragU1"]').value).toBe("5,00");
  });
});
