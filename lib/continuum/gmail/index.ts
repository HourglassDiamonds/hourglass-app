/**
 * Continuum Gmail read-only activation public surface.
 * Does not export the Supabase adapter or exact-thread fetch —
 * import those from `./server`.
 */

export { GMAIL_READONLY_SCOPE } from "./types";
export type {
  ExactProjectThreadMatch,
  GmailAttachmentMeta,
  GmailConnection,
  GmailConnectionStatus,
  GmailOAuthErrorCode,
  GmailTokenCiphertext,
  PersonCandidateMatch,
} from "./types";
export {
  GMAIL_FOUNDER_MAILBOX_SLOT,
  GMAIL_HISTORICAL_JOB_KEY,
  GMAIL_SYNC_PAGE_SIZE,
} from "./types";
export { InMemoryGmailConnectionStore } from "./connection";
export type { GmailConnectionStore } from "./connection";
export {
  applyDisconnect,
  applyInvalidGrant,
  applyPause,
  applyResume,
  isSyncEligible,
} from "./connection";
export { InMemoryGmailAttachmentStore } from "./attachments";
export type { GmailAttachmentStore } from "./attachments";
export { MockGmailApi } from "./adapter";
export type { GmailApi } from "./adapter";
export { gmailMessageDirection } from "./direction";
export { correlateExactProjectThread } from "./projects";
export { resolvePersonCandidate } from "./participants";
export { assessGmailOAuthProductionReadiness } from "./oauth-readiness";
export { historicalGmailQuery, runHistoricalSync } from "./sync";
