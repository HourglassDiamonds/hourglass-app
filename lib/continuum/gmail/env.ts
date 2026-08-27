/**
 * Server-only Continuum Gmail activation env.
 * Dedicated client — never fall back to Intelligence GOOGLE_* OAuth.
 * Never NEXT_PUBLIC_*.
 */

function trimmed(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

export const SERVER_ONLY_CONTINUUM_GMAIL_ENV = [
  "CONTINUUM_GMAIL_TOKEN_KEK",
  "CONTINUUM_GMAIL_OAUTH_CLIENT_ID",
  "CONTINUUM_GMAIL_OAUTH_CLIENT_SECRET",
  "CONTINUUM_GMAIL_OAUTH_REDIRECT_URI",
  "CONTINUUM_GMAIL_FOUNDER_EMAIL",
  "CONTINUUM_GMAIL_INTERNAL_ADDRESSES",
  "CONTINUUM_GMAIL_MAILBOX_HOSTING",
  "CONTINUUM_GMAIL_CLOUD_PROJECT_ORG_ALIGNED",
  "CONTINUUM_GMAIL_OAUTH_USER_TYPE",
  "CONTINUUM_GMAIL_OAUTH_PUBLISHING_STATUS",
] as const;

export function getContinuumGmailTokenKek(): string | undefined {
  return trimmed(process.env.CONTINUUM_GMAIL_TOKEN_KEK);
}

export function getContinuumGmailOAuthClientId(): string | undefined {
  return trimmed(process.env.CONTINUUM_GMAIL_OAUTH_CLIENT_ID);
}

export function getContinuumGmailOAuthClientSecret(): string | undefined {
  return trimmed(process.env.CONTINUUM_GMAIL_OAUTH_CLIENT_SECRET);
}

export function getContinuumGmailOAuthRedirectUri(): string | undefined {
  return trimmed(process.env.CONTINUUM_GMAIL_OAUTH_REDIRECT_URI);
}

export function getContinuumGmailFounderEmail(): string | undefined {
  return trimmed(process.env.CONTINUUM_GMAIL_FOUNDER_EMAIL);
}

export function getContinuumGmailInternalAddresses(): string[] {
  const raw = trimmed(process.env.CONTINUUM_GMAIL_INTERNAL_ADDRESSES);
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export type GmailMailboxHosting = "workspace" | "consumer" | "unknown";
export type GmailCloudOrgAligned = "yes" | "no" | "unknown";
export type GmailOAuthUserType = "internal" | "external" | "unknown";
export type GmailOAuthPublishingStatus =
  | "testing"
  | "in-production"
  | "unknown";

function enumOrUnknown<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | "unknown" {
  if (!value) return "unknown";
  const lower = value.trim().toLowerCase();
  return (allowed as readonly string[]).includes(lower)
    ? (lower as T)
    : "unknown";
}

export function getGmailMailboxHosting(): GmailMailboxHosting {
  return enumOrUnknown(process.env.CONTINUUM_GMAIL_MAILBOX_HOSTING, [
    "workspace",
    "consumer",
  ]);
}

export function getGmailCloudProjectOrgAligned(): GmailCloudOrgAligned {
  return enumOrUnknown(
    process.env.CONTINUUM_GMAIL_CLOUD_PROJECT_ORG_ALIGNED,
    ["yes", "no"],
  );
}

export function getGmailOAuthUserType(): GmailOAuthUserType {
  return enumOrUnknown(process.env.CONTINUUM_GMAIL_OAUTH_USER_TYPE, [
    "internal",
    "external",
  ]);
}

export function getGmailOAuthPublishingStatus(): GmailOAuthPublishingStatus {
  return enumOrUnknown(process.env.CONTINUUM_GMAIL_OAUTH_PUBLISHING_STATUS, [
    "testing",
    "in-production",
  ]);
}

export function isContinuumGmailOAuthConfigured(): boolean {
  return Boolean(
    getContinuumGmailOAuthClientId() &&
      getContinuumGmailOAuthClientSecret() &&
      getContinuumGmailOAuthRedirectUri(),
  );
}
