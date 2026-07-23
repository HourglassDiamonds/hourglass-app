/**
 * Deterministic Local Authority finding identifiers.
 * No timestamps, PII, secrets, location IDs, session IDs, or review text.
 */

import type { LocalAuthorityFindingType, LocalGeography } from "./types";
import { GBP_ROOT_SOURCE_GAP_ID } from "./types";

export { GBP_ROOT_SOURCE_GAP_ID };

export type LocalAuthorityIdSource = "gsc" | "repository" | "gbp" | "local";

/**
 * Stable ID shapes:
 *   search-strategy:local:<type>:<geography>:<subject>
 *   search-strategy:repository:<type>:<subject>
 *   search-strategy:gbp:measurement-gap:google-business-profile
 *   search-strategy:gsc:<type>:<subject>
 */
export function buildLocalAuthorityFindingId(input: {
  source: LocalAuthorityIdSource;
  type: LocalAuthorityFindingType;
  subject: string;
  geography?: LocalGeography | null;
}): string {
  if (
    input.type === "gbp-source-gap" &&
    input.subject === "google-business-profile"
  ) {
    return GBP_ROOT_SOURCE_GAP_ID;
  }

  const parts = ["search-strategy", input.source, input.type];
  if (input.geography && input.geography !== "unknown") {
    parts.push(slugifyLocalSubject(input.geography));
  }
  parts.push(slugifyLocalSubject(input.subject));
  return parts.join(":");
}

export function buildLocalAuthorityRecommendationId(findingId: string): string {
  return findingId;
}

export function slugifyLocalSubject(raw: string): string {
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

export function localAuthorityIdLooksSafe(id: string): boolean {
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(id)) return false;
  if (/sk-|api[_-]?key|bearer\s|password|secret=/i.test(id)) return false;
  if (/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/.test(id)) return false;
  if (/\b\d{10,}\b/.test(id)) return false;
  if (/\d{4}-\d{2}-\d{2}t\d{2}/i.test(id)) return false;
  if (
    /\b(session|upload|email|customer|payload|reviewer|location-id)\b/i.test(
      id,
    )
  ) {
    return false;
  }
  return /^search-strategy:(gsc|repository|gbp|local):[a-z0-9-]+:[a-z0-9-]+(?::[a-z0-9-]+)?$/.test(
    id,
  );
}
