/**
 * Deterministic Client Journey finding identifiers.
 * No timestamps, PII, sessions, uploads, secrets, or arbitrary IDs.
 */

import type { JourneyFindingType } from "./types";

/**
 * Stable ID shape:
 *   business-intelligence:journey:<type>:<subject-slug>
 */
export function buildJourneyFindingId(input: {
  type: JourneyFindingType | "source-gap";
  subject: string;
}): string {
  const subject = slugifyJourneySubject(input.subject);
  return ["business-intelligence", "journey", input.type, subject].join(":");
}

export function buildJourneyRecommendationId(findingId: string): string {
  return findingId;
}

export function slugifyJourneySubject(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/https?:\/\//g, "")
      .replace(/www\./g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "unknown"
  );
}

export function journeyIdLooksSafe(id: string): boolean {
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(id)) return false;
  if (/sk-|api[_-]?key|bearer\s|password|secret=/i.test(id)) return false;
  if (/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/.test(id)) return false;
  if (/\b\d{10,}\b/.test(id)) return false;
  if (/\d{4}-\d{2}-\d{2}t\d{2}/i.test(id)) return false;
  if (/\b(session|upload|email|phone|customer|payload)\b/i.test(id)) {
    return false;
  }
  return /^business-intelligence:journey:[a-z0-9-]+:[a-z0-9-]+$/.test(id);
}
