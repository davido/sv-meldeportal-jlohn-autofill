import { describe, it, expect } from "vitest";
import { normalizeNumberToPortal, isZeroValue } from "../src/shared/number.js";

describe("shared/number", () => {
  it("converts dot decimals to comma", () => {
    expect(normalizeNumberToPortal("12.5")).toBe("12,5");
  });

  it("removes thousand separators when dot+comma present", () => {
    expect(normalizeNumberToPortal("1.234,50")).toBe("1234,50");
  });

  it("keeps negative sign", () => {
    expect(normalizeNumberToPortal("-1.234,50")).toBe("-1234,50");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeNumberToPortal("")).toBe("");
    expect(normalizeNumberToPortal(null)).toBe("");
  });

  it("returns null for invalid inputs", () => {
    expect(normalizeNumberToPortal("abc")).toBeNull();
    expect(normalizeNumberToPortal("12,3,4")).toBeNull();
  });

  it("detects zero values", () => {
    expect(isZeroValue("0")).toBe(true);
    expect(isZeroValue("0,00")).toBe(true);
    expect(isZeroValue(" 0,0 ")).toBe(true);
    expect(isZeroValue("1")).toBe(false);
    expect(isZeroValue("")).toBe(false);
  });
});
