import { FIELD_ORDER } from "./fields.js";

/**
 * Formular-Definitionen für das SV-Meldeportal.
 * - formStandard: bisheriges "Beitragsformular" (basierend auf FIELD_ORDER)
 * - formMinijobKnappschaft: Minijobs (KV Knappschaft) – andere Feldnamen
 *
 * Wichtig:
 * - Die Namen müssen exakt den input[name="..."] Attributen im Portal entsprechen.
 * - Für die Form-Erkennung reichen einige "typische" Felder; du kannst die Liste jederzeit ergänzen.
 */

export const FORM_DEFS = [
  {
    id: "formStandard",
    label: "Standard-Beitragsformular",
    fields: FIELD_ORDER
  },

  {
    id: "formMinijobKnappschaft",
    label: "Minijob (KV Knappschaft)",
    fields: [
      // Aus deinem Beispiel (Keyed Input)
      "beitrag6000",
      "beitrag0100",
      "beitrag0500",
      "beitragU1",
      "beitragU2",
      "beitrag0050",
      "beitragPauschsteuer",
      "beitragErstattungKrankMutter"
    ]
  }
];
