/**
 * Typed identifier roles for CAD / workshop / production / repair / vendor tokens.
 * Classification only — does not write Project specs or ingest Gmail.
 */

export const IDENTIFIER_ROLES = [
  "cadId",
  "workshopJobId",
  "productionJobId",
  "repairJobId",
  "vendorOrderId",
] as const;

export type IdentifierRole = (typeof IDENTIFIER_ROLES)[number];

const CAD_FAMILIES = new Set(["C", "CR", "CAD", "J", "CBR"]);

function compactToken(value: string): string {
  return value.replace(/^[#:-]+/, "").replace(/[#:-]+$/, "").trim();
}

function familyPrefix(value: string): string {
  const match = /^([A-Za-z]+)/.exec(compactToken(value));
  return match ? match[1]!.toUpperCase() : "";
}

export function classifyIdentifierRole(
  value: string,
  haystack = "",
): IdentifierRole {
  const token = compactToken(value);
  const family = familyPrefix(token);
  const hay = haystack.replace(/\s+/g, " ");
  if (family === "RN") {
    if (/\brepair\b/i.test(hay)) return "repairJobId";
    if (/\bproduction\b/i.test(hay)) return "productionJobId";
    return "workshopJobId";
  }
  if (family === "SP") return "vendorOrderId";
  if (
    family &&
    !CAD_FAMILIES.has(family) &&
    (/\bworkshop\b/i.test(hay) || /\bvia job\b/i.test(hay))
  ) {
    return "workshopJobId";
  }
  return "cadId";
}

export function identifierRolesAreSameField(
  left: string,
  right: string,
  haystack = "",
): boolean {
  return (
    classifyIdentifierRole(left, haystack) ===
    classifyIdentifierRole(right, haystack)
  );
}
