/**
 * Deterministic Opportunity identifiers.
 * No timestamps, customer PII, contacts, secrets, or raw notes.
 */

import type { OpportunityReadiness, OpportunityType } from "./types";

export type OpportunityIdSource =
  | "search"
  | "bi"
  | "content"
  | "repository"
  | "derived";

/**
 * Stable ID shape:
 *   opportunity:<source>:<type>:<subject-slug>:<readiness>
 */
export function buildOpportunityId(input: {
  source: OpportunityIdSource;
  type: OpportunityType;
  subject: string;
  readiness: OpportunityReadiness;
}): string {
  return [
    "opportunity",
    input.source,
    input.type,
    slugifyOpportunitySubject(input.subject),
    input.readiness,
  ].join(":");
}

export function buildOpportunityRecommendationId(opportunityId: string): string {
  return opportunityId;
}

export function slugifyOpportunitySubject(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/https?:\/\//g, "")
      .replace(/www\./g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "unknown"
  );
}

export function opportunityIdLooksSafe(id: string): boolean {
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(id)) return false;
  if (/sk-|api[_-]?key|bearer\s|password|secret=/i.test(id)) return false;
  if (/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/.test(id)) return false;
  if (/\b\d{10,}\b/.test(id)) return false;
  if (id.length > 200) return false;
  if (/\b(contact|prospect|email|phone|linkedin\.com\/in)\b/i.test(id)) {
    return false;
  }
  // Reject ISO timestamps
  if (/\d{4}-\d{2}-\d{2}t\d{2}/i.test(id)) return false;
  return /^opportunity:(search|bi|content|repository|derived):[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]+$/.test(
    id,
  );
}
