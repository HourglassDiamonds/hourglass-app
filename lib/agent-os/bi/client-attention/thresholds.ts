/**
 * Configurable Client Attention thresholds.
 * Defaults encode Hourglass’s ~24-hour Concierge response promise.
 */

export type ClientAttentionThresholds = {
  /** Hours before a new Concierge inquiry may surface (medium). */
  newInquiryMediumHours: number;
  /** Hours for high urgency. */
  newInquiryHighHours: number;
  /** Hours for critical urgency. */
  newInquiryCriticalHours: number;
  /** Hours before an unanswered inbound Gmail thread surfaces. */
  unansweredInboundHours: number;
  /** Days of inactivity before early-stage stall surfaces. */
  stalledEarlyDays: number;
  /** Days of inactivity before advanced-stage stall surfaces. */
  stalledAdvancedDays: number;
  /** Days before a proposal/target date to raise approaching urgency. */
  proposalApproachingDays: number;
  /** Minimum evidence count for a buyer-concern pattern to surface. */
  buyerConcernMinEvidence: number;
  /** Max Gmail threads inspected per run. */
  maxGmailThreads: number;
  /** Max HubSpot contacts inspected per run. */
  maxHubSpotContacts: number;
  /** Max HubSpot deals inspected per run. */
  maxHubSpotDeals: number;
  /** Lookback window in days for source adapters. */
  lookbackDays: number;
};

export const DEFAULT_CLIENT_ATTENTION_THRESHOLDS: ClientAttentionThresholds = {
  newInquiryMediumHours: 12,
  newInquiryHighHours: 24,
  newInquiryCriticalHours: 48,
  unansweredInboundHours: 24,
  stalledEarlyDays: 7,
  stalledAdvancedDays: 5,
  proposalApproachingDays: 14,
  buyerConcernMinEvidence: 3,
  maxGmailThreads: 40,
  maxHubSpotContacts: 50,
  maxHubSpotDeals: 40,
  lookbackDays: 30,
};

export function mergeThresholds(
  overrides?: Partial<ClientAttentionThresholds>,
): ClientAttentionThresholds {
  return { ...DEFAULT_CLIENT_ATTENTION_THRESHOLDS, ...overrides };
}
