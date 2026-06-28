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
  technicalDecisionProfileTitle: "Report Details",
  reportMeasurementsTitle: "Measurements Used in This Interpretation",
  reportMeasurementsSubcopy:
    "Extracted values from the uploaded report, shown for transparency.",
  reportCannotConfirmItems: [
    "Eye-clean appearance from normal viewing distance",
    "Overall visual personality and preference",
    "Transparency and brightness in motion",
    "Nuances that may only appear during in-person viewing",
  ] as const,
  ingestSectionHeadline: "Upload the original grading report PDF.",
  ingestSectionSupportingCopy:
    "Diamond Intelligence is most reliable when it reads the lab report itself.",
  uploadBestPracticeLine:
    "For best results, use the original PDF from GIA, IGI, or GCAL 8X.",
  uploadMobileHelperLine:
    "Mobile works when the PDF is already saved in Files. If you only see ‘Save to Photos,’ use Concierge instead.",
  uploadDesktopHelperLine:
    "Desktop is often the easiest way to download the original report PDF.",
  listingLinkConciergePrefix:
    "Only have a screenshot, image, or listing link?",
  listingLinkConciergeCta: "Begin the Conversation",
  listingLinkConciergeSuffix: "and we'll review it personally.",
  pdfOnlyRejectionPrimary:
    "Diamond Intelligence currently accepts original grading report PDFs only.",
  pdfOnlyRejectionSecondary:
    "If you only have a screenshot, image, or listing link, we can review it personally through Concierge.",
  justinReviewCta: "Have Justin Review This Diamond",
  justinReviewCtaPhilosophy:
    "We are extremely selective about what we recommend, but not about who we help.",
  justinReviewCtaCompetitive:
    "Within the quality range we believe in, we are generally very competitive. What we will not do is recommend diamonds we would not personally pursue ourselves.",
  justinReviewCtaGoal:
    "Our goal is not simply to find the lowest price. It is to identify the strongest value among diamonds genuinely worth considering.",
  uploadHelperLines: [
    "Round brilliant diamonds only.",
    "The analysis evaluates the diamond itself — not the asking price.",
  ] as const,
  betaDisclosure:
    "Diamond Intelligence is currently in beta and supports round brilliant diamonds only. Fancy shapes and additional report formats are still being added.",
  betaDisclosureOutreachPrefix:
    "Evaluating a fancy shape, antique cut, or unusual report format? Submit your project through",
  betaDisclosureConciergeLinkLabel: "Concierge",
  partialListingHeadline: "Listing Found — Report Needed for Full Review",
  partialListingBody:
    "We found the listing details, but this retailer does not expose the grading report in a format we can reliably read. Upload the GIA, IGI, or GCAL 8X report from this listing to complete the review.",
  trustLayerSoftwareReadLimit:
    "Some reports are difficult for software to interpret due to image quality, report formatting, or how the report was provided. This does not necessarily indicate a problem with the diamond itself.",
  trustLayerProportionDetailLimit:
    "Some measurements may be visible to a human reviewer but could not be confidently verified from the uploaded file.",
  trustLayerMissingGradeLimit:
    "The report may contain this information, but it could not be confidently verified from the uploaded file.",
  trustLayerManualReviewOffer:
    "Justin can review the report personally if you would like a second read.",
  beyondTheReportTitle: "Beyond the Report",
  beyondTheReportIntro:
    "Laboratory reports are useful starting points, but they do not fully show how a diamond appears in person.",
  beyondTheReportBody:
    "They rarely capture eye-cleanliness from normal viewing distance, milkiness or haze, color tinge or undertone, overall visual personality, real-world presence, and other details that may need human review before purchase.",
  assessmentScopeCopy:
    "Assessment scope: This interpretation evaluates the diamond itself — including proportions, cut quality, visual performance, clarity considerations, and overall desirability. It does not evaluate price. A diamond may be beautifully cut and still be overpriced, or poorly suited despite an attractive price.",
  igiNaturalLabContextTitle: "About This Laboratory",
  igiNaturalLabContextParagraphs: [
    "IGI is a widely recognized diamond grading laboratory used throughout the industry. While grading standards can vary somewhat between laboratories, many professionals consider natural-diamond color and clarity grades from IGI to be somewhat more generous than equivalent grades from GIA or GCAL.",
    "This does not mean an individual grade is incorrect. It is one reason we place significant emphasis on overall appearance, cut quality, and real-world performance rather than relying on any single grading category.",
  ] as const,
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
    "We verified portions of the report, but a few grading details could not be confidently verified from the uploaded file.",
  sectionHeadline: "The Read Is Not Complete Yet",
  sectionBody:
    "Missing grading details can materially affect the recommendation. The report may contain this information, but it could not be confidently verified from the uploaded file. Some reports are difficult for software to interpret due to image quality, report formatting, or how the report was provided. This does not necessarily indicate a problem with the diamond itself. Justin can review the report personally if you would like a second read.",
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

/** Shown when a non-round shape was read successfully but round-brilliant scoring does not apply. */
export type V3FancyShapeAssessmentCopy = {
  kind: "fancy-shape";
  eyebrow: string;
  headline: string;
  subhead: string;
  sectionHeadline: string;
  sectionBody: string;
  justinNote: string;
  chapterNote: string;
  recommendationStatus: string;
  reviewScope: string;
  nextStep: string;
  technicalAppendixNote: string;
};

export const V3_FANCY_SHAPE_ASSESSMENT: V3FancyShapeAssessmentCopy = {
  kind: "fancy-shape",
  eyebrow: "Concierge Review",
  headline: "Fancy Shape Detected",
  subhead:
    "This report was successfully read, but this version of Diamond Intelligence currently evaluates round brilliant diamonds.",
  sectionHeadline: "Shape-Specific Review Recommended",
  sectionBody:
    "Fancy shapes such as princess, oval, cushion, radiant, emerald, pear, marquise, and asscher diamonds require shape-specific review rather than the round-brilliant proportion model. The grading details below were extracted from your report — they are shown for transparency, not as a round-brilliant performance score.",
  justinNote:
    "Fancy shapes are judged differently than round brilliants. I would not rely on a single proportion score for this diamond. If you are considering it, I would review the report, images, video, and face-up appearance manually before making a recommendation.",
  chapterNote:
    "Round-brilliant proportion scoring does not apply to this shape.",
  recommendationStatus: "Manual Shape Review Recommended",
  reviewScope: "Round brilliant proportion model not applicable",
  nextStep: "Have Justin Review This Diamond",
  technicalAppendixNote:
    "This read reflects a successfully extracted fancy-shape report. No round-brilliant optical score or purchase recommendation is produced for this shape.",
};

/** Shown when 4Cs are present but proportion/diagram detail is incomplete. */
export const V3_INCOMPLETE_PROPORTION_ASSESSMENT: V3IncompleteAssessmentCopy = {
  kind: "proportion",
  eyebrow: "Concierge Review",
  headline: "Proportion Detail Needed",
  subhead:
    "Color and clarity are already on the report, but some proportion measurements could not be confidently verified from the uploaded file.",
  sectionHeadline: "The Read Is Not Complete Yet",
  sectionBody:
    "Diagram proportions can materially affect brightness, balance, and the final recommendation. Some measurements may be visible to a human reviewer but could not be confidently verified from the uploaded file. Some reports are difficult for software to interpret due to image quality, report formatting, or how the report was provided. This does not necessarily indicate a problem with the diamond itself. Justin can review the report personally if you would like a second read.",
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

export const V3_RATE_LIMITED = {
  eyebrow: "Diamond Intelligence",
  headline: "Please Wait a Moment",
  bodyParagraphs: [
    "We've temporarily paused new report submissions to keep Diamond Intelligence responsive.",
    "This is not an issue with your report.",
    "Please wait a moment and try again.",
  ] as const,
  retryAfterLine: (seconds: number) =>
    `We'll be ready again in approximately ${seconds} seconds.`,
  tryAgainCta: "Try Again",
} as const;

export const V3_UNABLE_TO_VERIFY = {
  eyebrow: "Diamond Intelligence",
  headline: "We Couldn't Read This Report",
  body: "We weren't able to extract enough information from this file to provide a useful interpretation. The diamond may still be valid — the report or image may simply be difficult for software to read.",
  reassurance:
    "Some reports are difficult for software to interpret due to image quality, report formatting, or how the report was provided. This does not necessarily indicate a problem with the diamond itself. Justin can review the report personally if you would like a second read.",
  reasons: [
    "Unsupported report format",
    "Low image quality",
    "Incomplete screenshot",
    "Missing report pages",
  ] as const,
} as const;

/** Softer variant when an image upload did not yield a reliable read. */
export const V3_UNABLE_TO_VERIFY_IMAGE = {
  eyebrow: "Diamond Intelligence",
  headline: V3_UNABLE_TO_VERIFY.headline,
  body: "We could not read enough of this screenshot to provide a reliable interpretation. This can happen when a report image is cropped, compressed, or difficult to read.",
  followUp:
    "For the best result, upload the original report PDF. If you would rather have a personal review, send it through Concierge and Justin can take a look.",
} as const;

/** Shown on partial grade review before manual confirmation fields. */
export const V3_PARTIAL_SCREENSHOT_CLARITY = {
  eyebrow: "Some report images need a closer read",
  body: "Phone screenshots can sometimes crop, compress, or blur small grading details. We were able to read part of this report, but not enough to confirm every grade automatically.",
  followUp:
    "Upload the original grading report PDF for the cleanest read, or confirm the missing details below.",
  conciergeNote:
    "If you would prefer a personal review, send the report through Concierge and Justin will be happy to take a look.",
} as const;

/** Shown when a fancy-color GIA report bypasses standard D–Z grade confirmation. */
export const V3_FANCY_COLOR_GUIDANCE = {
  eyebrow: "Fancy color report",
  headline: "A Different Kind of Color Grade",
  body: "This appears to be a fancy color diamond report. Fancy color grading works differently than the standard D–Z color scale, so Diamond Intelligence may need a personal review rather than a standard automatic score.",
  conciergeNote:
    "Send it through Concierge if you would like Justin to review it personally.",
} as const;

export const V3_LISTING_INACCESSIBLE = {
  eyebrow: "Diamond Intelligence",
  headline: "We Couldn't Access This Listing",
  bodyParagraphs: [
    "Some retailers restrict direct access to listing and grading report information. This does not indicate a problem with the diamond itself.",
    "For the most reliable analysis, upload the grading report directly. If you would prefer a personal review, send the listing through Concierge and Justin will be happy to take a look.",
  ] as const,
  uploadCta: "Upload Report",
} as const;

export const GRAPH_REPORT_CONFIDENCE_LABELS = {
  full: "STRONG REPORT READ",
  preliminary: "MODERATE REPORT READ",
  limited: "LIMITED REPORT DATA",
} as const;
