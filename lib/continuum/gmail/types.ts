/**
 * Continuum Gmail read-only activation contracts.
 * Dedicated Gmail OAuth + token custody + mailbox-wide metadata sync.
 * Does not reuse Intelligence Google OAuth. Does not store mailbox bodies.
 */

export const GMAIL_READONLY_SCOPE =
  "https://www.googleapis.com/auth/gmail.readonly" as const;

export const GMAIL_FOUNDER_MAILBOX_SLOT = "founder-v1" as const;

export const CONCIERGE_GMAIL_PATH = "/executive-dashboard/concierge/gmail";

export const GMAIL_HISTORICAL_JOB_KEY = "gmail-historical" as const;

/** Reserved checkpoint job key. Incremental History API sync, not a calendar-day job. */
export const GMAIL_INCREMENTAL_JOB_KEY = "gmail-memory-daily" as const;

export const GMAIL_SYNC_PAGE_SIZE = 100 as const;

export const GMAIL_INCREMENTAL_HISTORY_PAGE_SIZE = 20 as const;

export const GMAIL_HISTORY_TYPES = [
  "messageAdded",
  "messageDeleted",
  "labelAdded",
  "labelRemoved",
] as const;

export type GmailHistoryType = (typeof GMAIL_HISTORY_TYPES)[number];

export const GMAIL_SYNC_MAX_GETS_PER_SEC = 10 as const;

export const GMAIL_CONNECTION_STATUSES = [
  "connected",
  "paused",
  "disconnected",
  "revoked",
] as const;

export type GmailConnectionStatus = (typeof GMAIL_CONNECTION_STATUSES)[number];

export const GMAIL_TOKEN_ENC_ALG = "aes-256-gcm" as const;

export type GmailTokenCiphertext = {
  alg: typeof GMAIL_TOKEN_ENC_ALG;
  version: 1;
  iv: string;
  tag: string;
  ciphertext: string;
};

export type GmailConnection = {
  connectionId: string;
  mailboxSlot: typeof GMAIL_FOUNDER_MAILBOX_SLOT;
  mailboxEmailHash: string;
  status: GmailConnectionStatus;
  refreshToken: GmailTokenCiphertext | null;
  grantedScope: string | null;
  providerTokenType: string | null;
  connectedAt: string | null;
  updatedAt: string;
  lastSyncAt: string | null;
  statusErrorCode: string | null;
};

export type GmailAttachmentMeta = {
  attachmentId: string;
  messageId: string;
  threadId: string;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  indexedAt: string;
};

export type GmailProfile = {
  emailAddress: string;
  historyId?: string;
};

export type GmailListedMessage = {
  id: string;
  threadId: string;
  labelIds?: readonly string[];
};

export type GmailListPage = {
  messages: readonly GmailListedMessage[];
  nextPageToken: string | null;
  resultSizeEstimate?: number;
};

export type GmailHeader = {
  name: string;
  value: string;
};

export type GmailPayloadPart = {
  filename?: string | null;
  mimeType?: string | null;
  body?: {
    attachmentId?: string | null;
    size?: number | null;
    data?: string | null;
  } | null;
  parts?: readonly GmailPayloadPart[] | null;
  headers?: readonly GmailHeader[] | null;
};

export type GmailApiMessage = {
  id: string;
  threadId: string;
  labelIds?: readonly string[];
  internalDate?: string;
  snippet?: string;
  payload?: GmailPayloadPart | null;
};

export type GmailApiThread = {
  id: string;
  historyId?: string;
  messages: readonly GmailApiMessage[];
};

export type GmailHistoryMessageRef = {
  id: string;
  threadId: string;
  labelIds?: readonly string[];
};

export type GmailHistoryRecord = {
  id: string;
  messages?: readonly GmailHistoryMessageRef[];
  messagesAdded?: readonly { message: GmailHistoryMessageRef }[];
  messagesDeleted?: readonly { message: GmailHistoryMessageRef }[];
  labelsAdded?: readonly {
    message: GmailHistoryMessageRef;
    labelIds?: readonly string[];
  }[];
  labelsRemoved?: readonly {
    message: GmailHistoryMessageRef;
    labelIds?: readonly string[];
  }[];
};

export type GmailHistoryPage = {
  history: readonly GmailHistoryRecord[];
  nextPageToken: string | null;
  historyId: string;
};

export const GMAIL_OAUTH_ERROR_CODES = [
  "unauthorized",
  "oauth-not-configured",
  "oauth-state-mismatch",
  "oauth-pkce-mismatch",
  "oauth-code-missing",
  "oauth-denied",
  "gmail-wrong-mailbox",
  "gmail-mailbox-unconfigured",
  "token-exchange-failed",
  "token-revoke-failed",
  "invalid_grant",
  "connection-inactive",
  "founder-slot-occupied",
] as const;

export type GmailOAuthErrorCode = (typeof GMAIL_OAUTH_ERROR_CODES)[number];

export type PersonCandidateMatch =
  | { status: "unresolved" }
  | { status: "internal" }
  | { status: "candidate"; personId: string }
  | { status: "REVIEW_IDENTITY_COLLISION"; personIds: readonly string[] };

export type ExactProjectThreadMatch =
  | { status: "unmatched" }
  | { status: "exact"; projectIds: readonly string[] };
