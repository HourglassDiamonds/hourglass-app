export const COS_FOUNDER_TIME_ZONE = "America/New_York" as const;

export const COS_FOUNDER_DISPLAY_NAME = "Justin" as const;

export const MAX_NUMBERED_ATTENTION_ITEMS = 3 as const;

export const MAX_WORTH_KNOWING_ITEMS = 2 as const;

export const BIRTHDAY_HORIZON_DAYS = 14 as const;

export const SILENCE_REASON =
  "No material founder priorities require action today." as const;

export const REASON = {
  founderFocus: "founder-focus",
  clientFollowUpDue: "client-follow-up-due",
  criticalWebsite: "critical-website",
  slaOverdue: "sla-overdue",
  birthdayUpcoming: "birthday-upcoming",
  duplicate: "duplicate",
  acknowledgedUnchanged: "acknowledged-unchanged",
  resolved: "resolved",
  expired: "expired",
  snoozed: "snoozed",
  watchSuppressed: "watch-suppressed",
  backgroundSuppressed: "background-suppressed",
  pausedSuppressed: "paused-suppressed",
  completedSuppressed: "completed-suppressed",
  lowConfidenceInference: "low-confidence-inference",
  unknownSourceHealth: "unknown-source-health",
  numberedCap: "numbered-cap",
  worthKnowingCap: "worth-knowing-cap",
  worsened: "worsened",
  novel: "novel",
  audienceNotFounderAction: "audience-not-founder-action",
  gmailNotConfigured: "gmail-not-configured",
  healthy: "healthy",
  birthdayNoDay: "birthday-no-day",
} as const;

export type ReasonCode = (typeof REASON)[keyof typeof REASON];

export const NUMBERED_AUDIENCES = [
  "urgent-founder-action",
  "founder-action",
] as const;
