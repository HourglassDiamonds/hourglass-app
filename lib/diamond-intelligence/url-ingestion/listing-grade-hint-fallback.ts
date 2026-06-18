import type { CalibrationLab } from "@/lib/calibration-library/types";
import type { ClientSafeInterpretationPayload } from "@/lib/diamond-intelligence/client-api";
import { buildClientDiamondDecisionProfile } from "@/lib/diamond-intelligence/client-decision-profile";
import { presentClientInterpretationScore } from "@/lib/diamond-intelligence/client-score-present";
import {
  isUsableDisplayClarityValue,
  isUsableDisplayColorValue,
  normalizeClarityGrade,
  type ReportGradeHints,
} from "@/lib/diamond-intelligence/report-grade-hints";
import type { ListingExtraction } from "./types";

const LISTING_LAB_TO_CALIBRATION: Record<string, CalibrationLab> = {
  GIA: "GIA",
  IGI: "IGI",
  GCAL: "GCAL",
  AGS: "AGS",
};

/** Whitelist lab tokens from listing HTML — rejects adapter noise like "label". */
export function normalizeListingLab(
  lab: string | null | undefined,
): CalibrationLab | null {
  if (!lab?.trim()) return null;
  return LISTING_LAB_TO_CALIBRATION[lab.trim().toUpperCase()] ?? null;
}

function mergeGradeHints(
  report: ReportGradeHints,
  listing: ListingExtraction,
): ReportGradeHints {
  const next: ReportGradeHints = { ...report };

  if (
    !isUsableDisplayColorValue(report.color) &&
    isUsableDisplayColorValue(listing.color)
  ) {
    next.color = listing.color!.trim();
  }

  const listingClarity = normalizeClarityGrade(listing.clarity ?? "");
  if (
    !isUsableDisplayClarityValue(report.clarity) &&
    isUsableDisplayClarityValue(listingClarity)
  ) {
    next.clarity = listingClarity;
  }

  next.fancyColor = report.fancyColor;
  next.coloredDiamondReport = report.coloredDiamondReport;

  return next;
}

function gradeHintsEqual(a: ReportGradeHints, b: ReportGradeHints): boolean {
  return a.color === b.color && a.clarity === b.clarity;
}

/**
 * Fill missing report grade hints from high-confidence URL listing extraction.
 * Report-derived usable values always win. URL ingestion only.
 */
export function applyListingGradeHintFallback(
  interpretation: ClientSafeInterpretationPayload,
  listing: ListingExtraction,
): ClientSafeInterpretationPayload {
  if (listing.extractionConfidence !== "high") {
    return interpretation;
  }

  const reportHints = interpretation.gradeHints ?? {};
  const mergedHints = mergeGradeHints(reportHints, listing);

  const metadata = { ...interpretation.metadata };
  const listingLab = normalizeListingLab(listing.lab);
  if (!metadata.lab?.trim() && listingLab) {
    metadata.lab = listingLab;
  }

  const extractedFields = { ...interpretation.extractedFields };
  const interpretationFields = { ...interpretation.interpretationFields };

  if (!extractedFields.carat?.trim() && listing.carat != null) {
    const carat = String(listing.carat);
    extractedFields.carat = carat;
    if (!interpretationFields.carat?.trim()) {
      interpretationFields.carat = carat;
    }
  }

  if (!extractedFields.shape?.trim() && listing.shape?.trim()) {
    const shape = listing.shape.trim();
    extractedFields.shape = shape;
    if (!interpretationFields.shape?.trim()) {
      interpretationFields.shape = shape;
    }
  }

  const metadataUnchanged =
    metadata.lab === interpretation.metadata.lab &&
    metadata.reportNumber === interpretation.metadata.reportNumber &&
    metadata.stoneType === interpretation.metadata.stoneType;

  const fieldsUnchanged =
    extractedFields.carat === interpretation.extractedFields.carat &&
    extractedFields.shape === interpretation.extractedFields.shape &&
    extractedFields.tablePercent === interpretation.extractedFields.tablePercent &&
    extractedFields.depthPercent === interpretation.extractedFields.depthPercent &&
    extractedFields.crownAngle === interpretation.extractedFields.crownAngle &&
    extractedFields.pavilionAngle ===
      interpretation.extractedFields.pavilionAngle &&
    extractedFields.polish === interpretation.extractedFields.polish &&
    extractedFields.symmetry === interpretation.extractedFields.symmetry &&
    extractedFields.fluorescence === interpretation.extractedFields.fluorescence &&
    extractedFields.cutGrade === interpretation.extractedFields.cutGrade;

  if (
    gradeHintsEqual(reportHints, mergedHints) &&
    metadataUnchanged &&
    fieldsUnchanged
  ) {
    return interpretation;
  }

  const clientScore = presentClientInterpretationScore(
    interpretationFields,
    interpretation.capability.interpretationLevel,
  );
  const rawOverall =
    clientScore.eligible && clientScore.overall !== null
      ? clientScore.overall
      : null;

  return {
    ...interpretation,
    gradeHints: mergedHints,
    metadata,
    extractedFields,
    interpretationFields,
    decisionProfile: buildClientDiamondDecisionProfile({
      fields: interpretationFields,
      metadata,
      capability: interpretation.capability,
      rawScore: rawOverall,
      reportTextHint: metadata.reportTextHint,
      gradeHints: mergedHints,
    }),
  };
}
