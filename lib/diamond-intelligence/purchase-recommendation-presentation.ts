import type { OverallRecommendationBand } from "./diamond-decision-profile";
import type { HourglassClarityDisplayPolicy } from "./hourglass-clarity-policy";
import {
  suppressesBroadPercentileForColor,
  warmColorPreferenceContextCopy,
  worstColorLetterIndex,
} from "./color-grade-policy";

export type PurchaseRecommendationLabel =
  | "Recommended"
  | "Strong Candidate"
  | "Worth Reviewing After Additional Information"
  | "Justin Inspection Required"
  | "Outside Hourglass Standards"
  | "Not Recommended";

const PURCHASE_RANK: Record<PurchaseRecommendationLabel, number> = {
  Recommended: 6,
  "Strong Candidate": 5,
  "Worth Reviewing After Additional Information": 4,
  "Justin Inspection Required": 3,
  "Not Recommended": 2,
  "Outside Hourglass Standards": 1,
};

function worsePurchase(
  a: PurchaseRecommendationLabel,
  b: PurchaseRecommendationLabel,
): PurchaseRecommendationLabel {
  return PURCHASE_RANK[a] <= PURCHASE_RANK[b] ? a : b;
}

function capPurchase(
  label: PurchaseRecommendationLabel,
  ceiling: PurchaseRecommendationLabel,
): PurchaseRecommendationLabel {
  return worsePurchase(label, ceiling);
}

function mapInternalToPurchase(
  band: OverallRecommendationBand,
): PurchaseRecommendationLabel {
  switch (band) {
    case "Strong Candidate":
      return "Strong Candidate";
    case "Worth Reviewing":
    case "Compare Carefully":
      return "Worth Reviewing After Additional Information";
    case "Worth Reviewing After Additional Information":
    case "Needs More Information":
      return "Worth Reviewing After Additional Information";
    case "Not Recommended":
      return "Not Recommended";
    default:
      return "Worth Reviewing After Additional Information";
  }
}

function canElevateToRecommended(input: {
  internalBand: OverallRecommendationBand;
  clarity?: string;
  color?: string;
  opticalTierLabel: string;
}): boolean {
  if (input.internalBand !== "Strong Candidate") return false;
  const worst = worstColorLetterIndex(input.color);
  if (worst === null || worst > 2) return false;
  const clarity = input.clarity?.trim().toUpperCase() ?? "";
  if (
    !clarity ||
    (!clarity.startsWith("VVS") &&
      clarity !== "IF" &&
      clarity !== "FL")
  ) {
    return false;
  }
  return (
    input.opticalTierLabel === "Rare" ||
    input.opticalTierLabel === "Exceptional" ||
    input.opticalTierLabel === "Distinctive"
  );
}

export function resolvePurchaseRecommendationLabel(input: {
  internalBand: OverallRecommendationBand;
  clarityPolicy: HourglassClarityDisplayPolicy;
  color?: string;
  clarity?: string;
  uncappedOpticalTierLabel: string;
}): PurchaseRecommendationLabel {
  if (input.clarityPolicy.isExcluded) {
    return "Outside Hourglass Standards";
  }

  let label = mapInternalToPurchase(input.internalBand);

  if (input.clarityPolicy.isSi2) {
    label = capPurchase(label, "Justin Inspection Required");
  }

  if (
    canElevateToRecommended({
      internalBand: input.internalBand,
      clarity: input.clarity,
      color: input.color,
      opticalTierLabel: input.uncappedOpticalTierLabel,
    })
  ) {
    label = "Recommended";
  }

  return label;
}

export function isPurchaseRecommendationEligibleForBroadPercentile(input: {
  purchaseLabel: PurchaseRecommendationLabel;
  clarityPolicy: HourglassClarityDisplayPolicy;
  color?: string;
}): boolean {
  if (input.clarityPolicy.isExcluded || input.clarityPolicy.isSi2) {
    return false;
  }
  if (suppressesBroadPercentileForColor(input.color)) return false;
  return (
    input.purchaseLabel === "Recommended" ||
    input.purchaseLabel === "Strong Candidate"
  );
}

export function purchaseRecommendationBlocksPremiumHeroHeadline(
  label: PurchaseRecommendationLabel,
): boolean {
  return (
    label === "Outside Hourglass Standards" ||
    label === "Not Recommended" ||
    label === "Justin Inspection Required" ||
    label === "Worth Reviewing After Additional Information"
  );
}

export function buildPurchaseConstrainedOpticalDetail(input: {
  purchaseLabel: PurchaseRecommendationLabel;
  clarityPolicy: HourglassClarityDisplayPolicy;
  color?: string;
  clarity?: string;
  displayScore: number | null;
  uncappedOpticalTierLabel: string;
}): string | null {
  if (input.clarityPolicy.isExcluded) return null;
  if (input.displayScore === null || !Number.isFinite(input.displayScore)) {
    return null;
  }

  const topPercent = Math.min(
    99,
    Math.max(1, Math.round(100 - input.displayScore)),
  );
  const premiumOptics =
    input.uncappedOpticalTierLabel === "Rare" ||
    input.uncappedOpticalTierLabel === "Exceptional" ||
    input.uncappedOpticalTierLabel === "Distinctive" ||
    input.uncappedOpticalTierLabel === "Strong";

  const warmContext = warmColorPreferenceContextCopy(input.color);

  if (input.clarityPolicy.isSi2) {
    if (premiumOptics) {
      if (warmContext) {
        return `Strong proportions on paper. ${warmContext}`;
      }
      return "Strong proportions, but SI2 clarity requires human review before a purchase recommendation can be made.";
    }
    return "Strong optical geometry, pending human review.";
  }

  if (warmContext && premiumOptics) {
    return `Top ${topPercent}% for reported proportions. ${warmContext}`;
  }

  if (
    purchaseRecommendationBlocksPremiumHeroHeadline(input.purchaseLabel) &&
    premiumOptics
  ) {
    return `Top ${topPercent}% for reported proportions`;
  }

  if (
    isPurchaseRecommendationEligibleForBroadPercentile({
      purchaseLabel: input.purchaseLabel,
      clarityPolicy: input.clarityPolicy,
      color: input.color,
    })
  ) {
    return `Top ${topPercent}% for reported proportions`;
  }

  if (warmContext) {
    return warmContext;
  }

  return null;
}

export function presentPurchaseRecommendationLabel(
  label: PurchaseRecommendationLabel,
): string {
  return label;
}
