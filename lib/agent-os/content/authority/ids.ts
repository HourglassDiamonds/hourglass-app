/**
 * Stable Authority IDs — no PII, contacts, emails, or timestamps.
 */

import { slugifyContentSubject } from "../ids";

export const AUTHORITY_CASE_STUDY_INVENTORY_ID =
  "content:authority:case-study-founder-input:inventory" as const;

export const AUTHORITY_NEXT_CASE_STUDY_ID_PREFIX =
  "content:authority:case-study-production:" as const;

export const AUTHORITY_OUTREACH_FOLLOW_UP_ID =
  "content:authority:authority-outreach-follow-up:current-wave" as const;

export function buildNextCaseStudyOpportunityId(caseStudyId: string): string {
  return `${AUTHORITY_NEXT_CASE_STUDY_ID_PREFIX}${slugifyContentSubject(caseStudyId)}`;
}

export function authorityIdLooksSafe(id: string): boolean {
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(id)) return false;
  if (/\b(contact|prospect|email|phone|linkedin\.com\/in)\b/i.test(id)) {
    return false;
  }
  if (/sk-|api[_-]?key|bearer\s|password|secret=/i.test(id)) return false;
  if (id.length > 180) return false;
  return /^content:authority:[a-z0-9-]+:[a-z0-9-]+$/.test(id);
}
