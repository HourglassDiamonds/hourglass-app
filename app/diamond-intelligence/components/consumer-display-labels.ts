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
  technicalDecisionProfileTitle: "Technical Decision Profile",
  reportMeasurementsTitle: "Report Measurements",
  reportMeasurementsSubcopy:
    "Extracted values from the uploaded report, shown for transparency.",
  emptyStateIntro:
    "An easy-to-understand, lab-neutral read of how a diamond is likely to perform in person.",
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

export const GRAPH_REPORT_CONFIDENCE_LABELS = {
  full: "STRONG REPORT READ",
  preliminary: "MODERATE REPORT READ",
  limited: "LIMITED REPORT DATA",
} as const;
