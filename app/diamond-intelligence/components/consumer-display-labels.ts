/** Client-facing label overrides — presentation only, does not change lib output. */

import type { ProfileAxis } from "@/lib/diamond-intelligence/client-balance-profile";

const DIMENSION_LABELS: Record<string, string> = {
  "Risk Profile": "Risk Factors",
  Confidence: "Report Confidence",
};

const CONFIDENCE_BAND_LABELS: Record<string, string> = {
  High: "Strong report confidence",
  Moderate: "Moderate report confidence",
  Low: "Limited report data",
};

export function consumerProfileDimensionLabel(label: string): string {
  return DIMENSION_LABELS[label] ?? label;
}

export function consumerConfidenceBandLabel(band: string): string {
  return CONFIDENCE_BAND_LABELS[band] ?? band;
}

export const CONSUMER_COPY = {
  recommendationLabel: "Recommendation",
  recommendationQualifier:
    "Based on report information — not a final buy recommendation.",
  reportSuggestsLabel: "What the Report Suggests",
  performanceAtAGlanceLabel: "Performance at a Glance",
  supportingEvidenceLabel: "Supporting Evidence",
  performanceEvidenceLabel: "Performance Evidence",
  technicalDecisionProfileTitle: "Technical Appendix",
  reportMeasurementsTitle: "Measurements Used in This Interpretation",
  reportMeasurementsSubcopy:
    "Extracted values from the uploaded report, shown for transparency.",
  reportCannotConfirmItems: [
    "Eye-clean appearance under everyday viewing distances",
    "Video performance and movement sparkle",
    "Optical imaging such as ASET or IdealScope",
    "Transparency and in-person color nuance",
  ] as const,
  emptyStateIntro:
    "Paste a diamond listing URL for a professional read of the diamond.",
  emptyStateSupportingCopy:
    "We'll look for the grading report and build a professional read from the details available. For the most complete review, use listings that include a GIA, IGI, or GCAL report.",
  urlIngestHeadline: "Paste a diamond listing URL",
  urlIngestSubcopy:
    "We'll look for the grading report and build a professional read from the details available.",
  urlIngestHelperLines: [
    "For the most complete review, use listings that include a GIA, IGI, or GCAL report.",
    "Includes a professional assessment of the diamond and whether the asking price appears appropriate relative to the current market.",
  ] as const,
  justinReviewCta: "Have Justin Review This Diamond",
  uploadTabLabel: "Upload Report",
  urlTabLabel: "Paste Listing URL",
  uploadHelperLines: [
    "Round brilliant reports only.",
    "Upload a PDF report from GIA, IGI, or GCAL 8X.",
    "Diamond Intelligence evaluates the diamond itself, not the asking price.",
  ] as const,
  partialListingHeadline: "Listing Found — Report Needed for Full Review",
  partialListingBody:
    "We extracted what we could from this listing. Upload the grading report for a complete Diamond Intelligence interpretation.",
  processingStateHeadline: "Building your interpretation…",
  processingStateSupportingCopy:
    "We are reading proportion details from your report. This usually takes a few moments.",
  assessmentScopeCopy:
    "Assessment scope: This interpretation evaluates the diamond itself — including proportions, cut quality, visual performance, clarity considerations, and overall desirability. It does not evaluate price. A diamond may be beautifully cut and still be overpriced, or poorly suited despite an attractive price.",
  estimatedReadLabel: "Estimated read from reported proportions",
} as const;

const STRENGTH_HUMANIZATIONS: Record<string, string> = {
  "Strong brightness":
    "Strong brightness — likely to remain lively across a wide range of everyday lighting.",
  "Strong fire":
    "Colored flashes may be visible when lighting conditions allow.",
  "Strong contrast":
    "Contrast appears well defined — sparkle may read clearly rather than flat.",
  "Strong scintillation":
    "Movement sparkle may appear lively as the diamond shifts in light.",
  "Well-controlled light leakage":
    "Light leakage appears well controlled based on reported proportions.",
  "Generous face-up spread":
    "May face up larger than many diamonds of similar weight.",
  "Balanced spread": "Spread appears balanced for its weight on paper.",
  "Harmonious overall balance":
    "Proportions appear harmoniously balanced in the report-based read.",
};

export function humanizeStrengthLabel(label: string): string {
  if (STRENGTH_HUMANIZATIONS[label]) return STRENGTH_HUMANIZATIONS[label];
  if (label.endsWith(" optical architecture")) {
    const band = label.replace(" optical architecture", "");
    return `${band} optical architecture on paper — one supporting signal, not a final verdict.`;
  }
  if (label.startsWith("Strong ")) {
    const trait = label.slice(7);
    return `Strong ${trait.toLowerCase()} — a favorable signal in the report-based read.`;
  }
  return label;
}

function axisLevel(value: number): string {
  if (value >= 88) return "High";
  if (value >= 78) return "Above average";
  if (value >= 72) return "Balanced";
  if (value >= 60) return "Moderate";
  return "Preliminary";
}

export function axisPerformanceSummary(axis: ProfileAxis): string | null {
  if (axis.uncertain || axis.value === null) {
    return `${axis.label}: Preliminary`;
  }
  if (axis.key === "leakage") {
    if (axis.value >= 78) return "Leakage: Well controlled";
    if (axis.value >= 65) return "Leakage: Moderate";
    return "Leakage: Worth noting";
  }
  if (axis.key === "spread") {
    if (axis.value >= 82) return "Spread: Above average";
    if (axis.value >= 72) return "Spread: Balanced";
    return "Spread: Compact";
  }
  if (axis.key === "balance") {
    if (axis.value >= 85) return "Balance: Very good";
    if (axis.value >= 72) return "Balance: Balanced";
    return "Balance: Mixed";
  }
  return `${axis.label}: ${axisLevel(axis.value)}`;
}

export type V3IncompleteAssessmentCopy = {
  eyebrow: string;
  headline: string;
  subhead: string;
  sectionHeadline: string;
  sectionBody: string;
  recommendationStatus: string;
  missingDataValue: string;
  opticalRead: string;
  confidenceLevel: string;
  nextStep: string;
};

/** Shown when color or clarity is truly missing from the report read. */
export const V3_INCOMPLETE_GRADE_ASSESSMENT: V3IncompleteAssessmentCopy = {
  eyebrow: "Concierge Review",
  headline: "Assessment Requires Additional Information",
  subhead:
    "We were able to verify portions of the report, but a complete recommendation requires a few missing grading details.",
  sectionHeadline: "A Complete Recommendation Isn't Possible Yet",
  sectionBody:
    "Missing grading details may materially affect the final recommendation. Once color and clarity are confirmed, the assessment can move from a partial read to a complete purchase recommendation.",
  recommendationStatus: "Additional Information Required",
  missingDataValue: "Color Grade, Clarity Grade",
  opticalRead: "Preliminary",
  confidenceLevel: "Incomplete Report",
  nextStep: "Verify Missing Grades",
};

/** Shown when 4Cs are present but proportion/diagram detail is incomplete. */
export const V3_INCOMPLETE_PROPORTION_ASSESSMENT: V3IncompleteAssessmentCopy = {
  eyebrow: "Concierge Review",
  headline: "Additional Report Detail Needed",
  subhead:
    "We were able to verify the grading information, but a complete recommendation requires a few additional proportion details from the report diagram.",
  sectionHeadline: "A Complete Recommendation Isn't Possible Yet",
  sectionBody:
    "Additional proportion details from the report diagram may materially affect the final recommendation. Once those fields are confirmed, the assessment can move from a partial read to a complete purchase recommendation.",
  recommendationStatus: "Additional Report Detail Needed",
  missingDataValue: "Additional proportion details",
  opticalRead: "Preliminary",
  confidenceLevel: "Incomplete Report",
  nextStep: "Verify Missing Proportions",
};

/** @deprecated Use resolveV3IncompleteAssessmentCopy — grade-missing copy only. */
export const V3_INCOMPLETE_ASSESSMENT = V3_INCOMPLETE_GRADE_ASSESSMENT;

export const V3_UNABLE_TO_VERIFY = {
  eyebrow: "Concierge Review",
  headline: "Unable to Verify Report",
  body: "We couldn't confidently read enough information from this document to generate a reliable assessment.",
} as const;

export const GRAPH_REPORT_CONFIDENCE_LABELS = {
  full: "STRONG REPORT READ",
  preliminary: "MODERATE REPORT READ",
  limited: "LIMITED REPORT DATA",
} as const;
