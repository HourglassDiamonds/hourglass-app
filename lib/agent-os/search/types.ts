/**
 * Search Strategy typed contracts — opportunities and search evidence fields.
 * Extends Agent OS evidence without replacing the shared Evidence model.
 */

export const SEARCH_OPPORTUNITY_TYPES = [
  "high-impression-low-ctr",
  "near-page-one",
  "declining-query",
  "declining-page",
  "rising-query",
  "query-page-mismatch",
  "possible-cannibalization",
  "content-gap",
  "internal-link-gap",
  "tool-handoff-gap",
  "local-intent-gap",
  "geo-readiness-gap",
  "schema-gap",
  "metadata-gap",
  "measurement-gap",
] as const;

export type SearchOpportunityType = (typeof SEARCH_OPPORTUNITY_TYPES)[number];

export type SearchIntentClass =
  | "branded"
  | "non-branded"
  | "local"
  | "commercial"
  | "informational"
  | "navigational";

export type SearchOpportunity = {
  id: string;
  type: SearchOpportunityType;
  title: string;
  whyItMatters: string;
  recommendedAction: string;
  queryOrPage: string;
  metric: string;
  currentValue: string;
  comparisonValue?: string | null;
  sampleSize: number;
  classifications: SearchIntentClass[];
  /** True when the claim is inferred rather than directly measured */
  isInference: boolean;
  confidence: number;
  likelyImpact: number; // 0–10 for rankingFactors.expectedBusinessImpact
  effort: "low" | "medium" | "high";
  urgency: "critical" | "high" | "medium" | "low";
  dependency?: string;
  approvalRequired: boolean;
  supportingReference: string;
  evidenceNotes: string[];
};
