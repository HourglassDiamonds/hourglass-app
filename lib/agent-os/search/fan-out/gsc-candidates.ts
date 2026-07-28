/**
 * GSC query → fan-out candidate evidence helpers.
 * Deterministic normalization only — no live ingestion service in V1.1.
 */

import { normalizeText } from "./normalize";

export type GscCandidateKind =
  | "brand-navigational"
  | "informational"
  | "commercial"
  | "local"
  | "noise"
  | "unknown";

export type NormalizedGscCandidate = {
  rawQuery: string;
  normalizedQuery: string;
  kind: GscCandidateKind;
  /** True when the query is primarily brand/home navigational */
  isBrandQuery: boolean;
  /** Suggested cluster key for near-duplicate grouping */
  clusterKey: string;
};

const BRAND_TERMS = ["hourglass", "hourglass diamonds", "hourglassdiamonds"];

const NOISE_RE =
  /^(login|signin|sign in|contact us|hours|phone|email|instagram|facebook|youtube)$/i;

/**
 * Fixture GSC queries available in Agent OS (sample-data + local overlay).
 * Used as candidate evidence — never auto-promoted to canonicals.
 */
export const FIXTURE_GSC_CANDIDATE_QUERIES = [
  "hourglass diamonds",
  "oval engagement ring",
  "lab grown vs natural diamonds",
  "custom engagement rings charlotte",
  "diamond fluorescence meaning",
  "engagement rings charlotte nc",
  "best jeweler fort mill sc",
  "hourglass diamonds charlotte",
  "waxhaw diamond appraisal",
  "south charlotte engagement rings",
] as const;

export function normalizeGscQuery(raw: string): string {
  return normalizeText(raw)
    .replace(/\bnc\b/g, "north carolina")
    .replace(/\bs\.?\s*c\.?\b/g, "south carolina")
    .trim();
}

export function isBrandGscQuery(normalized: string): boolean {
  return BRAND_TERMS.some(
    (term) =>
      normalized === term ||
      normalized.startsWith(`${term} `) ||
      normalized.endsWith(` ${term}`),
  );
}

export function classifyGscCandidate(raw: string): NormalizedGscCandidate {
  const normalizedQuery = normalizeGscQuery(raw);
  if (!normalizedQuery || NOISE_RE.test(normalizedQuery)) {
    return {
      rawQuery: raw,
      normalizedQuery,
      kind: "noise",
      isBrandQuery: false,
      clusterKey: normalizedQuery || "empty",
    };
  }
  const isBrandQuery = isBrandGscQuery(normalizedQuery);
  if (isBrandQuery && !/\b(engagement|diamond|custom|appraisal|jeweler)\b/.test(normalizedQuery)) {
    return {
      rawQuery: raw,
      normalizedQuery,
      kind: "brand-navigational",
      isBrandQuery: true,
      clusterKey: "brand:hourglass",
    };
  }
  const local =
    /\b(charlotte|waxhaw|fort mill|ballantyne|southpark|south park|metro)\b/.test(
      normalizedQuery,
    );
  const commercial =
    /\b(buy|price|cost|custom|best|near)\b/.test(normalizedQuery) || local;
  const kind: GscCandidateKind = local
    ? "local"
    : commercial
      ? "commercial"
      : "informational";
  const clusterKey = normalizedQuery
    .replace(/\b(best|top|near me|nc|north carolina)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    rawQuery: raw,
    normalizedQuery,
    kind,
    isBrandQuery,
    clusterKey: clusterKey || normalizedQuery,
  };
}

export function clusterGscCandidates(
  queries: readonly string[],
): Map<string, NormalizedGscCandidate[]> {
  const groups = new Map<string, NormalizedGscCandidate[]>();
  for (const raw of queries) {
    const candidate = classifyGscCandidate(raw);
    if (candidate.kind === "noise" || candidate.kind === "brand-navigational") {
      continue;
    }
    const list = groups.get(candidate.clusterKey) ?? [];
    list.push(candidate);
    groups.set(candidate.clusterKey, list);
  }
  return groups;
}

export function collectFixtureGscCandidates(): NormalizedGscCandidate[] {
  return FIXTURE_GSC_CANDIDATE_QUERIES.map(classifyGscCandidate);
}
