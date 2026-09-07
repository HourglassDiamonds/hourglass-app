/**
 * Server-only Continuum Calendar activation env.
 * Dedicated client — never fall back to Continuum Gmail or Intelligence GOOGLE_* OAuth.
 * Never NEXT_PUBLIC_*.
 */

function trimmed(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

export const SERVER_ONLY_CONTINUUM_CALENDAR_ENV = [
  "CONTINUUM_CALENDAR_TOKEN_KEK",
  "CONTINUUM_CALENDAR_OAUTH_CLIENT_ID",
  "CONTINUUM_CALENDAR_OAUTH_CLIENT_SECRET",
  "CONTINUUM_CALENDAR_OAUTH_REDIRECT_URI",
  "CONTINUUM_CALENDAR_FOUNDER_EMAIL",
  "CONTINUUM_CALENDAR_READ_ENABLED",
] as const;

export function getContinuumCalendarTokenKek(): string | undefined {
  return trimmed(process.env.CONTINUUM_CALENDAR_TOKEN_KEK);
}

export function getContinuumCalendarOAuthClientId(): string | undefined {
  return trimmed(process.env.CONTINUUM_CALENDAR_OAUTH_CLIENT_ID);
}

export function getContinuumCalendarOAuthClientSecret(): string | undefined {
  return trimmed(process.env.CONTINUUM_CALENDAR_OAUTH_CLIENT_SECRET);
}

export function getContinuumCalendarOAuthRedirectUri(): string | undefined {
  return trimmed(process.env.CONTINUUM_CALENDAR_OAUTH_REDIRECT_URI);
}

export function getContinuumCalendarFounderEmail(): string | undefined {
  return trimmed(process.env.CONTINUUM_CALENDAR_FOUNDER_EMAIL);
}

export function isContinuumCalendarOAuthConfigured(): boolean {
  return Boolean(
    getContinuumCalendarOAuthClientId() &&
      getContinuumCalendarOAuthClientSecret() &&
      getContinuumCalendarOAuthRedirectUri(),
  );
}

/**
 * Kill switch. Default off. Does not register or invoke a cron.
 * Production activation is out of scope for #22.
 */
export function isCalendarReadEnabled(): boolean {
  const raw = trimmed(process.env.CONTINUUM_CALENDAR_READ_ENABLED);
  return raw === "true" || raw === "1";
}
