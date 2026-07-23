/**
 * Deterministic Search Strategy opportunity / recommendation identifiers.
 * No timestamps, random UUIDs, customer PII, or secrets.
 */

import type { SearchOpportunityType } from "./types";

export type SearchOpportunitySource = "gsc" | "repository";

/**
 * Stable ID shape:
 *   search-strategy:<source>:<opportunity-type>:<subject-slug>
 */
export function buildSearchOpportunityId(input: {
  type: SearchOpportunityType;
  subject: string;
  source: SearchOpportunitySource;
}): string {
  return [
    "search-strategy",
    input.source,
    input.type,
    slugifySubject(input.subject),
  ].join(":");
}

/** Recommendation IDs reuse the opportunity ID for 1:1 traceability. */
export function buildSearchRecommendationId(opportunityId: string): string {
  return opportunityId;
}

export function slugifySubject(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/www\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "unknown";
}

/** Reject IDs that look like they embedded emails, tokens, or key material. */
export function searchIdLooksSafe(id: string): boolean {
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(id)) return false;
  if (/sk-|api[_-]?key|bearer\s|password|secret=/i.test(id)) return false;
  if (/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/.test(id)) return false;
  return /^search-strategy:(gsc|repository):[a-z0-9-]+:[a-z0-9-]+$/.test(id);
}
