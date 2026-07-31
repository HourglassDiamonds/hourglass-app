/**
 * Configurable Client Attention thresholds.
 * Defaults encode Hourglass’s ~24-hour Concierge response promise
 * and conservative HubSpot-only behavior when Gmail cannot confirm replies.
 */

export type ClientAttentionThresholds = {
  /**
   * Hours before a recent Concierge inquiry may surface as a review item
   * (not an asserted email-reply overdue). Medium urgency band starts here.
   */
  newInquiryMediumHours: number;
  /**
   * Hours before a Gmail-confirmed unreplied inbound may escalate to
   * high-urgency reply-overdue. Also used for Concierge review urgency.
   */
  newInquiryHighHours: number;
  /** Hours for critical urgency on Gmail-confirmed reply-overdue. */
  newInquiryCriticalHours: number;
  /**
   * Max age (hours) for a HubSpot/Concierge-only inquiry review when Gmail
   * cannot confirm response state. Older open inquiries are suppressed
   * unless an explicit task, next-activity date, proposal deadline, or
   * recent CRM activity anchors them as an active HubSpot signal.
   * Default: 72h (3 days). A ~30-day-old submission must not surface as
   * reply-overdue or as a generic “still waiting” email claim.
   */
  conciergeReviewMaxAgeHoursWithoutGmail: number;
  /** Hours before an unanswered inbound Gmail thread surfaces. */
  unansweredInboundHours: number;
  /** Days of inactivity before early-stage stall surfaces. */
  stalledEarlyDays: number;
  /** Days of inactivity before advanced-stage stall surfaces. */
  stalledAdvancedDays: number;
  /** Days before a proposal/target date to raise approaching urgency. */
  proposalApproachingDays: number;
  /**
   * Minimum days of CRM silence on a non-advanced open deal before
   * missing-next-step may fire from HubSpot alone.
   */
  missingNextStepMinIdleDays: number;
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
  conciergeReviewMaxAgeHoursWithoutGmail: 72,
  unansweredInboundHours: 24,
  stalledEarlyDays: 7,
  stalledAdvancedDays: 5,
  proposalApproachingDays: 14,
  missingNextStepMinIdleDays: 3,
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
