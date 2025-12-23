import { describe, it, expect } from "vitest";
import { FIELD_ORDER } from "../src/shared/fields.js";
import { extractRelevantLine, parseKeyedToMap, runAutofillFromRaw } from "../src/content/autofill.js";

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

describe("runAutofillFromRaw (jsdom, keyed-only)", () => {
  it("fills fields from keyed input", () => {
    const doc = makeDocWithInputs();
    const r = runAutofillFromRaw("beitrag1000:10,00;;beitragU1:5,00", doc);
    expect(r.ok).toBe(true);
    expect(doc.querySelector('input[name="beitrag1000"]').value).toBe("10,00");
    expect(doc.querySelector('input[name="beitragU1"]').value).toBe("5,00");
  });

  it("fills fields even if keyed parts contain leading ';' from ';;;'", () => {
    const doc = makeDocWithInputs();
    const r = runAutofillFromRaw("beitragU1:214,58;;;beitragKrankenversFreiw:438,00", doc);
    expect(r.ok).toBe(true);
    expect(doc.querySelector('input[name="beitragU1"]').value).toBe("214,58");
    expect(doc.querySelector('input[name="beitragKrankenversFreiw"]').value).toBe("438,00");
  });

  it("ignores unknown keys", () => {
    const doc = makeDocWithInputs();
    const r = runAutofillFromRaw("unknownField:99,99;;beitrag1000:10,00", doc);
    expect(r.ok).toBe(true);
    expect(doc.querySelector('input[name="beitrag1000"]').value).toBe("10,00");
  });

  it("fails if input is not keyed format", () => {
    const doc = makeDocWithInputs();
    const r = runAutofillFromRaw("511,00;;17,89;;", doc);
    expect(r.ok).toBe(false);
    expect(String(r.message)).toContain("Invalid format");
  });

  it("fails if required fields are missing", () => {
    const doc = document.implementation.createHTMLDocument("missing");
    doc.body.innerHTML = '<input name="beitrag1000" />';
    const r = runAutofillFromRaw("beitrag1000:10,00", doc);
    expect(r.ok).toBe(false);
    expect(String(r.message)).toContain("Not all expected fields");
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

  it("skips zero values and counts skippedZeroCount", () => {
    const doc = makeDocWithInputs();
    const r = runAutofillFromRaw("beitrag1000:0.00;;beitragU1:5.00", doc);

    expect(r.ok).toBe(true);
    expect(r.appliedCount).toBe(1);
    expect(r.skippedZeroCount).toBe(1);

    expect(doc.querySelector('input[name="beitrag1000"]').value).toBe("");
    expect(doc.querySelector('input[name="beitragU1"]').value).toBe("5,00");
  });

  it("skips non-numeric values (normalize returns null)", () => {
    const doc = makeDocWithInputs();
    const r = runAutofillFromRaw("beitrag1000:abc;;beitragU1:5,00", doc);
    expect(r.ok).toBe(true);
    expect(doc.querySelector('input[name="beitrag1000"]').value).toBe("");
    expect(doc.querySelector('input[name="beitragU1"]').value).toBe("5,00");
  });
});

