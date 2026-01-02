import { STANDARD_FIELDS, STANDARD_REQUIRED_FIELDS, STANDARD_DYNAMIC_FIELDS } from "./fields.js";

/**
 * Form definitions for SV-Meldeportal.
 *
 * Properties:
 * - fields: superset of all fields we know for this form
 * - requiredFields: missing non-zero values here -> ERROR
 * - dynamicFields: missing non-zero values here -> usually WARNING
 * - detectBy: subset used for detection scoring (more stable than full fields)
 */
export const FORM_DEFS = [
  {
    id: "formStandard",
    label: "Standard-Beitragsformular",
    fields: STANDARD_FIELDS,
    requiredFields: STANDARD_REQUIRED_FIELDS,
    dynamicFields: STANDARD_DYNAMIC_FIELDS,
    detectBy: ["beitrag1000", "beitrag0100", "beitrag0010"]
  },

  {
    id: "formMinijobKnappschaft",
    label: "Minijob (KV Knappschaft)",
    fields: [
      "beitrag6000",
      "beitrag0100",
      "beitrag0500",
      "beitragU1",
      "beitragU2",
      "beitrag0050",
      "beitragPauschsteuer",
      "beitragErstattungKrankMutter"
    ],
    requiredFields: ["beitrag6000", "beitrag0100", "beitragU1", "beitragU2", "beitrag0050"],
    dynamicFields: ["beitragErstattungKrankMutter"],
    detectBy: ["beitrag6000", "beitragPauschsteuer"]
  }
];
