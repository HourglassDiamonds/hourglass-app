/**
 * Source-of-truth ownership for Client Attention intelligence.
 * Gmail, HubSpot, and Concierge are not assumed synchronized.
 * Chief of Staff owns ranking and founder language — not raw source dumps.
 */

export const CLIENT_ATTENTION_SOURCE_TYPES = [
  "gmail",
  "hubspot",
  "concierge",
] as const;

export type ClientAttentionSourceType =
  (typeof CLIENT_ATTENTION_SOURCE_TYPES)[number];

/**
 * Information classes owned by each source.
 * Prefer the owning source when building signals; surface discrepancies
 * when another source materially conflicts.
 */
export const CLIENT_ATTENTION_SOURCE_OWNERSHIP = {
  gmail: [
    "whether-justin-replied",
    "age-of-latest-inbound",
    "unread-or-unanswered-client-threads",
    "client-language-and-concerns",
    "recent-relationship-context",
    "promised-follow-ups",
    "missed-emails",
    "attachments-or-documents-mentioned",
  ],
  hubspot: [
    "contact-identity",
    "lifecycle-stage",
    "deal-or-opportunity-stage",
    "owner",
    "last-activity",
    "next-activity",
    "deal-amount",
    "proposal-or-target-date",
    "pipeline-status",
    "structured-notes",
    "source-attribution",
    "concierge-form-values",
    "task-and-follow-up-status",
  ],
  concierge: [
    "initial-intent",
    "project-type",
    "timeline",
    "budget-range",
    "design-direction",
    "preferred-contact-method",
    "uncertainty-or-decision-blocker",
    "originating-page-or-tool",
    "first-contact-timestamp",
  ],
  "chief-of-staff": [
    "deduplication",
    "urgency",
    "ranking",
    "founder-facing-action",
    "safe-language",
    "data-gaps",
    "recommendation-caps",
  ],
  "business-intelligence": [
    "normalize-client-attention-signals",
    "identity-resolution-within-signal",
    "cross-source-discrepancy-detection",
    "buyer-concern-pattern-aggregation",
    "signal-to-recommendation-mapping",
  ],
} as const;

export type ClientAttentionOwnedDomain =
  (typeof CLIENT_ATTENTION_SOURCE_OWNERSHIP)[keyof typeof CLIENT_ATTENTION_SOURCE_OWNERSHIP][number];

export type ClientAttentionOwner =
  | ClientAttentionSourceType
  | "chief-of-staff"
  | "business-intelligence";

/** Resolve the preferred owner for a domain string (exact match). */
export function ownerForClientAttentionDomain(
  domain: string,
): ClientAttentionOwner | null {
  for (const [owner, domains] of Object.entries(
    CLIENT_ATTENTION_SOURCE_OWNERSHIP,
  ) as Array<[ClientAttentionOwner, readonly string[]]>) {
    if (domains.includes(domain)) return owner;
  }
  return null;
}

/**
 * Material conflict classes that must not be silently merged away.
 * CoS / BI should emit data-discrepancy signals when these affect action.
 */
export const CLIENT_ATTENTION_DISCREPANCY_CLASSES = [
  "reply-status-gmail-vs-hubspot",
  "last-activity-timestamp-mismatch",
  "contact-identity-collision",
  "deal-stage-vs-inbox-tone",
  "concierge-intent-vs-crm-stage",
  "duplicate-contact-records",
  "stale-next-activity",
] as const;

export type ClientAttentionDiscrepancyClass =
  (typeof CLIENT_ATTENTION_DISCREPANCY_CLASSES)[number];
