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
    "Receive an independent read of a diamond's quality, light performance, and overall purchase value before making a decision.",
  emptyStateSupportingCopy:
    "Some retailer pages allow full report review automatically; others may require you to upload the report yourself.",
  urlIngestHeadline: "Paste a diamond listing URL",
  urlIngestSubcopy:
    "We'll review the available listing information and, when possible, retrieve the grading report automatically. Some retailers provide full report access, while others may require a manual upload.",
  urlInputPlaceholder: "https://www.retailer.com/diamond/...",
  urlIngestHelperLines: [
    "Supports many listings from Blue Nile, Rare Carat, Adiamor, Ritani, Brilliant Earth, James Allen, and other major retailers.",
  ] as const,
  justinReviewCta: "Have Justin Review This Diamond",
  justinReviewCtaSupporting:
    "Justin personally reviews a limited number of diamonds each week. Share the report or listing and he can help determine whether it is worth pursuing.",
  uploadTabLabel: "Upload Report",
  urlTabLabel: "Paste Listing URL",
  uploadHelperLines: [
    "Round brilliant diamonds only.",
    "GIA, IGI, or GCAL 8X grading report PDFs.",
    "Evaluates the diamond itself — not the asking price.",
  ] as const,
  betaDisclosure:
    "Diamond Intelligence is currently in beta and supports round brilliant diamonds only. Fancy shapes and additional report formats are still being added.",
  betaDisclosureOutreach:
    "Evaluating a fancy shape, antique cut, or an unusual report format? Reach out directly at",
  betaDisclosureEmail: "Justin@HourglassDiamonds.com",
  betaDisclosureShort:
    "Beta supports round brilliant diamonds with GIA, IGI, or GCAL 8X reports.",
  partialListingHeadline: "Listing Found — Report Needed for Full Review",
  partialListingBody:
    "We found the listing details, but this retailer does not expose the grading report in a format we can reliably read. Upload the GIA, IGI, or GCAL 8X report from this listing to complete the review.",
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
  kind: "grade" | "proportion";
  eyebrow: string;
  headline: string;
  subhead: string;
  sectionHeadline: string;
  sectionBody: string;
  chapterNote: string;
  recommendationStatus: string;
  /** Technical appendix row label — avoids "Missing Data" for proportion gaps. */
  missingDataLabel: string;
  missingDataValue: string;
  /** When grades are usable, shown in proportion-state technical appendix. */
  gradesConfirmed: string | null;
  opticalRead: string;
  confidenceLevel: string;
  nextStep: string;
  technicalAppendixNote: string;
};

/** Shown when color or clarity is truly missing from the report read. */
export const V3_INCOMPLETE_GRADE_ASSESSMENT: V3IncompleteAssessmentCopy = {
  kind: "grade",
  eyebrow: "Concierge Review",
  headline: "A Few Grading Details Still Needed",
  subhead:
    "We verified portions of the report, but a few grading details are still needed before a complete purchase read can be offered.",
  sectionHeadline: "The Read Is Not Complete Yet",
  sectionBody:
    "Missing grading details can materially affect the recommendation. Confirm them on the report to move from a partial read to a complete assessment.",
  chapterNote: "Grading detail needed before the read can be completed.",
  recommendationStatus: "Pending Grading Detail",
  missingDataLabel: "Missing Grades",
  missingDataValue: "Color Grade, Clarity Grade",
  gradesConfirmed: null,
  opticalRead: "Preliminary",
  confidenceLevel: "Partial Report Read",
  nextStep: "Confirm Missing Grades",
  technicalAppendixNote:
    "This partial read reflects missing or unverified color and/or clarity grades — not a proportion limitation.",
};

/** Shown when 4Cs are present but proportion/diagram detail is incomplete. */
export const V3_INCOMPLETE_PROPORTION_ASSESSMENT: V3IncompleteAssessmentCopy = {
  kind: "proportion",
  eyebrow: "Concierge Review",
  headline: "Proportion Detail Needed",
  subhead:
    "Color and clarity are already on the report, but a few proportion measurements from the diagram are still needed for a complete read.",
  sectionHeadline: "The Read Is Not Complete Yet",
  sectionBody:
    "Diagram proportions can materially affect brightness, balance, and the final recommendation. Confirm those measurements on the report to complete the assessment.",
  chapterNote:
    "Proportion detail needed — color and clarity are already established on the report.",
  recommendationStatus: "Pending Proportion Detail",
  missingDataLabel: "Outstanding Detail",
  missingDataValue: "Report diagram proportions",
  gradesConfirmed: null,
  opticalRead: "Preliminary",
  confidenceLevel: "Limited Proportion Data",
  nextStep: "Confirm Missing Proportions",
  technicalAppendixNote:
    "Color and clarity grades are confirmed. The partial read reflects limited proportion or diagram detail from the report — not missing 4Cs.",
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
