import type { ClientSafeMetadata } from "./client-api";

export type IgiNaturalPresentationFlags = {
  active: boolean;
};

const LAB_GROWN_MARKERS =
  /laboratory[-\s]?grown|lab[-\s]?grown|labgrown|\bCVD\b|\bHPHT\b|type\s+IIa.*lab[-\s]?grown|lab[-\s]?grown.*type\s+IIa/i;

/** LG-prefixed report IDs paired with lab-grown report language — not bare "LG" tokens. */
const LG_STYLE_LAB_GROWN =
  /\b(?:LG[A-Z0-9]{6,12}|laboratory[-\s]?grown\s+diamond|lab[-\s]?grown\s+diamond)\b/i;

const NATURAL_DIAMOND_HINT = /\bnatural\s+diamond\b/i;

function normalizedHint(reportTextHint?: string): string {
  return reportTextHint?.replace(/\s+/g, " ").trim() ?? "";
}

export function hasIgiLabGrownPresentationMarkers(
  reportTextHint?: string,
): boolean {
  const hint = normalizedHint(reportTextHint);
  if (!hint) return false;
  if (LAB_GROWN_MARKERS.test(hint)) return true;
  if (LG_STYLE_LAB_GROWN.test(hint) && /lab(?:oratory)?[-\s]?grown/i.test(hint)) {
    return true;
  }
  return false;
}

export function hasIgiNaturalDiamondEvidence(
  metadata?: Pick<ClientSafeMetadata, "stoneType"> | null,
  reportTextHint?: string,
): boolean {
  if (metadata?.stoneType === "natural") return true;
  return NATURAL_DIAMOND_HINT.test(normalizedHint(reportTextHint));
}

/** Presentation-only — IGI natural round reports; excludes lab-grown and non-IGI labs. */
export function isIgiNaturalPresentationContext(
  metadata?: Pick<
    ClientSafeMetadata,
    "lab" | "stoneType" | "reportFormat"
  > | null,
  reportTextHint?: string,
): boolean {
  if (!metadata || metadata.lab !== "IGI") return false;
  if (metadata.reportFormat === "gcal-8x") return false;
  if (metadata.stoneType === "lab-grown") return false;
  if (hasIgiLabGrownPresentationMarkers(reportTextHint)) return false;
  return hasIgiNaturalDiamondEvidence(metadata, reportTextHint);
}

export function resolveIgiNaturalPresentationFlags(input: {
  metadata?: Pick<
    ClientSafeMetadata,
    "lab" | "stoneType" | "reportFormat"
  > | null;
  reportTextHint?: string;
}): IgiNaturalPresentationFlags {
  const active = isIgiNaturalPresentationContext(
    input.metadata,
    input.reportTextHint,
  );
  return { active };
}
