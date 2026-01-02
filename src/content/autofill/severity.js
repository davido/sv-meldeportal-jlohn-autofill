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
 * Matches “traffic light” expectations while still leveraging form metadata.
 */
function computeSeverity({ missingRequired, missingDynamic, missingOther }) {
  const total = missingRequired.length + missingDynamic.length + missingOther.length;
  if (total === 0) return "ok";

  // hard error if required/other missing
  if (missingRequired.length > 0 || missingOther.length > 0) return "error";

  // only dynamic missing
  return total === 1 ? "warn" : "error";
}

export { classifyMissingNonZero, computeSeverity };

