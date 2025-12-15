import { describe, it, expect } from "vitest";
import { splitTokensStrict, transformPositionalToKeyed } from "../src/shared/transform.js";

describe("shared/transform", () => {
  it("splits tokens and trims", () => {
    expect(splitTokensStrict(" 1 ;; 2 ;;3 ")).toEqual(["1", "2", "3"]);
  });

  it("treats ';;;' like ';;' (ignores extra ';')", () => {
    // With current tokenizer behavior, ';;;'
    // is interpreted the same as ';;' (extra ';' is ignored).
    expect(splitTokensStrict("1;;;2")).toEqual(["1", "2"]);
  });

  it("drops trailing empties", () => {
    expect(splitTokensStrict("1;;2;;;;")).toEqual(["1", "2"]);
  });

  it("transforms positional to keyed and skips zeros/empties", () => {
    const line = "511,00;;17,89;;0,00;;";
    const keyed = transformPositionalToKeyed(line);
    expect(keyed).toContain("beitrag1000:511,00");
    expect(keyed).toContain("beitragssatzAllgemein:17,89");
    expect(keyed).not.toContain("beitrag3000");
  });

  it("throws if no separator", () => {
    expect(() => transformPositionalToKeyed("abc")).toThrow();
  });
});
