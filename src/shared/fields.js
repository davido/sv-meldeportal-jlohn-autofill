/**
 * Canonical field definitions for SV-Meldeportal contributions.
 *
 * Naming rules:
 * - Keys MUST exactly match input[name="..."] in the SV-Meldeportal.
 * - FIELD_ORDER mirrors the JLohn keyed export order for the standard form.
 */

// Canonical JLohn export order for the standard form
export const FIELD_ORDER = [
  "beitrag1000",
  "beitragssatzAllgemein",
  "beitrag3000",
  "beitragssatzErmaessigt",
  "beitragZusatzKrankenvers",
  "beitrag0100",
  "beitrag0300",
  "beitrag0010",
  "beitrag0020",
  "beitrag0001",
  "beitragU1",
  "beitragU2",
  "beitrag0050",
  "beitragKrankenversFreiw",
  "beitragZusatz",
  "beitragPflegeversFreiw",
  "beitragErstattungKrankMutter"
];

// Superset of all known fields for the standard portal form
export const STANDARD_FIELDS = [...FIELD_ORDER];

/**
 * Fields that are expected to be present on the standard form in the "normal ready" state.
 * Missing non-zero values for these fields should be treated as an ERROR.
 */
export const STANDARD_REQUIRED_FIELDS = [
  "beitrag1000",
  "beitrag0100",
  "beitrag0010",
  "beitrag0001",
  "beitragU1",
  "beitragU2",
  "beitrag0050"
];

/**
 * Fields that are known to be UI-state dependent (appear/disappear).
 * Missing non-zero values for these fields should usually be treated as a WARNING.
 */
export const STANDARD_DYNAMIC_FIELDS = [
  // often appears only after setting the contribution period
  "beitragZusatzKrankenvers",

  // depends on insurance type / selections
  "beitragZusatz",
  "beitragKrankenversFreiw",
  "beitragPflegeversFreiw",

  // some fields may only appear for specific cases
  "beitrag3000",
  "beitrag0300",
  "beitrag0020",
  "beitragErstattungKrankMutter"
];
