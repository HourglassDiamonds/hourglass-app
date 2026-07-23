/**
 * Deterministic BI measurement finding identifiers.
 * No timestamps, PII, sessions, uploads, secrets, or arbitrary IDs.
 */

import type { FunnelId, MeasurementHealthType } from "./types";

/**
 * Stable ID shape:
 *   business-intelligence:measurement:<type>:<subject-slug>
 */
export function buildMeasurementFindingId(input: {
  type: MeasurementHealthType;
  subject: string;
  funnel?: FunnelId | "cross-cutting" | null;
}): string {
  const subject = slugifyMeasurementSubject(
    input.funnel && input.funnel !== "cross-cutting"
      ? `${input.funnel}-${input.subject}`
      : input.subject,
  );
  return ["business-intelligence", "measurement", input.type, subject].join(
    ":",
  );
}

export function buildMeasurementRecommendationId(findingId: string): string {
  return findingId;
}

export function slugifyMeasurementSubject(raw: string): string {
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

export function measurementIdLooksSafe(id: string): boolean {
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(id)) return false;
  if (/sk-|api[_-]?key|bearer\s|password|secret=/i.test(id)) return false;
  if (/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/.test(id)) return false;
  if (/\b\d{10,}\b/.test(id)) return false;
  if (/\d{4}-\d{2}-\d{2}t\d{2}/i.test(id)) return false;
  if (/\b(session|upload|email|phone|customer|payload)\b/i.test(id)) {
    return false;
  }
  return /^business-intelligence:measurement:[a-z0-9-]+:[a-z0-9-]+$/.test(id);
}
