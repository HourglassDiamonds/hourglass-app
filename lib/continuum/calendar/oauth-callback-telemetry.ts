/**
 * One privacy-safe Calendar OAuth callback event.
 * Allowlisted fields only. No codes, tokens, emails, secrets, or provider text.
 */

export const CALENDAR_OAUTH_CALLBACK_EVENT =
  "continuum.calendar.oauth_callback" as const;

export const CALENDAR_OAUTH_CALLBACK_REDIRECT_STATUS = 307 as const;

export const CALENDAR_OAUTH_CALLBACK_STAGES = [
  "request",
  "google_error",
  "state_validated",
  "token_exchange",
  "token_validated",
  "scope_validated",
  "identity_validated",
  "encrypted",
  "connection_written",
  "redirect",
] as const;

export type CalendarOauthCallbackStage =
  (typeof CALENDAR_OAUTH_CALLBACK_STAGES)[number];

export const CALENDAR_OAUTH_CALLBACK_OUTCOMES = [
  "success",
  "google_denied",
  "missing_code",
  "state_invalid",
  "token_exchange_failed",
  "missing_refresh_token",
  "scope_missing",
  "write_scope_rejected",
  "identity_mismatch",
  "kek_missing",
  "encryption_failed",
  "connection_write_failed",
  "success_redirect",
  "unknown_failure",
] as const;

export type CalendarOauthCallbackOutcome =
  (typeof CALENDAR_OAUTH_CALLBACK_OUTCOMES)[number];

export const CALENDAR_OAUTH_CALLBACK_REDIRECT_CODES = [
  "connected",
  "oauth-denied",
  "invalid_grant",
  "token-exchange-failed",
  "oauth-refresh-token-missing",
  "calendar-scope-rejected",
  "token-kek-missing",
  "token-kek-invalid",
  "oauth-encryption-failed",
  "calendar-wrong-mailbox",
  "calendar-mailbox-unconfigured",
  "oauth-write-failed",
  "oauth-state-mismatch",
  "oauth-code-missing",
] as const;

export type CalendarOauthCallbackRedirectCode =
  (typeof CALENDAR_OAUTH_CALLBACK_REDIRECT_CODES)[number];

export const CALENDAR_OAUTH_CALLBACK_FIELDS = [
  "event",
  "stage",
  "outcome",
  "callbackStatus",
  "googleErrorPresent",
  "codePresent",
  "stateValid",
  "tokenExchangeAttempted",
  "tokenExchangeSucceeded",
  "refreshTokenPresent",
  "calendarReadonlyGranted",
  "writeScopePresent",
  "identityValidated",
  "encryptionAttempted",
  "encryptionSucceeded",
  "connectionWriteAttempted",
  "connectionWriteSucceeded",
  "redirectCode",
] as const;

export type CalendarOauthCallbackReport = {
  stage: CalendarOauthCallbackStage;
  outcome: CalendarOauthCallbackOutcome;
  callbackStatus: number;
  googleErrorPresent: boolean;
  codePresent: boolean;
  stateValid: boolean | null;
  tokenExchangeAttempted: boolean;
  tokenExchangeSucceeded: boolean | null;
  refreshTokenPresent: boolean | null;
  calendarReadonlyGranted: boolean | null;
  writeScopePresent: boolean | null;
  identityValidated: boolean | null;
  encryptionAttempted: boolean;
  encryptionSucceeded: boolean | null;
  connectionWriteAttempted: boolean;
  connectionWriteSucceeded: boolean | null;
  redirectCode: CalendarOauthCallbackRedirectCode | null;
};

export function createCalendarOauthCallbackReport(input: {
  googleErrorPresent: boolean;
  codePresent: boolean;
}): CalendarOauthCallbackReport {
  return {
    stage: "request",
    outcome: "unknown_failure",
    callbackStatus: 0,
    googleErrorPresent: input.googleErrorPresent,
    codePresent: input.codePresent,
    stateValid: null,
    tokenExchangeAttempted: false,
    tokenExchangeSucceeded: null,
    refreshTokenPresent: null,
    calendarReadonlyGranted: null,
    writeScopePresent: null,
    identityValidated: null,
    encryptionAttempted: false,
    encryptionSucceeded: null,
    connectionWriteAttempted: false,
    connectionWriteSucceeded: null,
    redirectCode: null,
  };
}

function asStage(value: string): CalendarOauthCallbackStage {
  return (CALENDAR_OAUTH_CALLBACK_STAGES as readonly string[]).includes(value)
    ? (value as CalendarOauthCallbackStage)
    : "request";
}

function asOutcome(value: string): CalendarOauthCallbackOutcome {
  return (CALENDAR_OAUTH_CALLBACK_OUTCOMES as readonly string[]).includes(value)
    ? (value as CalendarOauthCallbackOutcome)
    : "unknown_failure";
}

function asRedirectCode(value: string | null): CalendarOauthCallbackRedirectCode | null {
  if (!value) return null;
  return (CALENDAR_OAUTH_CALLBACK_REDIRECT_CODES as readonly string[]).includes(value)
    ? (value as CalendarOauthCallbackRedirectCode)
    : null;
}

function asBool(value: boolean): boolean {
  return value === true;
}

function asBoolOrNull(value: boolean | null): boolean | null {
  if (value === true || value === false) return value;
  return null;
}

export function sanitizeCalendarOauthCallbackReport(
  report: CalendarOauthCallbackReport,
): Record<string, string | number | boolean | null> {
  const status = Number.isInteger(report.callbackStatus) ? report.callbackStatus : 0;
  return {
    event: CALENDAR_OAUTH_CALLBACK_EVENT,
    stage: asStage(report.stage),
    outcome: asOutcome(report.outcome),
    callbackStatus: status,
    googleErrorPresent: asBool(report.googleErrorPresent),
    codePresent: asBool(report.codePresent),
    stateValid: asBoolOrNull(report.stateValid),
    tokenExchangeAttempted: asBool(report.tokenExchangeAttempted),
    tokenExchangeSucceeded: asBoolOrNull(report.tokenExchangeSucceeded),
    refreshTokenPresent: asBoolOrNull(report.refreshTokenPresent),
    calendarReadonlyGranted: asBoolOrNull(report.calendarReadonlyGranted),
    writeScopePresent: asBoolOrNull(report.writeScopePresent),
    identityValidated: asBoolOrNull(report.identityValidated),
    encryptionAttempted: asBool(report.encryptionAttempted),
    encryptionSucceeded: asBoolOrNull(report.encryptionSucceeded),
    connectionWriteAttempted: asBool(report.connectionWriteAttempted),
    connectionWriteSucceeded: asBoolOrNull(report.connectionWriteSucceeded),
    redirectCode: asRedirectCode(report.redirectCode),
  };
}

export function emitCalendarOauthCallback(report: CalendarOauthCallbackReport): void {
  const line: Record<string, string | number | boolean | null> = {};
  const sanitized = sanitizeCalendarOauthCallbackReport(report);
  for (const key of CALENDAR_OAUTH_CALLBACK_FIELDS) {
    line[key] = sanitized[key] ?? null;
  }
  console.info(JSON.stringify(line));
}
