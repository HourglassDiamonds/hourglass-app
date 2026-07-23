/**
 * Deterministic Content opportunity / recommendation identifiers.
 * No timestamps, transcripts, customer PII, or secrets.
 */

import type { ContentFormat, ContentOpportunityType } from "./types";

export type ContentOpportunitySource =
  | "repository"
  | "search"
  | "bi"
  | "derived";

/**
 * Stable ID shape:
 *   content:<source>:<opportunity-type>:<subject-slug>[:<format>]
 */
export function buildContentOpportunityId(input: {
  type: ContentOpportunityType;
  subject: string;
  source: ContentOpportunitySource;
  format?: ContentFormat;
}): string {
  const parts = [
    "content",
    input.source,
    input.type,
    slugifyContentSubject(input.subject),
  ];
  if (input.format) {
    parts.push(slugifyContentSubject(input.format));
  }
  return parts.join(":");
}

export function buildContentRecommendationId(opportunityId: string): string {
  return opportunityId;
}

export function slugifyContentSubject(raw: string): string {
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

export function contentIdLooksSafe(id: string): boolean {
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(id)) return false;
  if (/sk-|api[_-]?key|bearer\s|password|secret=/i.test(id)) return false;
  if (/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/.test(id)) return false;
  // Reject long free-text that looks like transcript fragments
  if (id.length > 180) return false;
  if (/\bi'm justin\b|\bdraft transcript\b/i.test(id)) return false;
  return /^content:(repository|search|bi|derived):[a-z0-9-]+:[a-z0-9-]+(?::[a-z0-9-]+)?$/.test(
    id,
  );
}
