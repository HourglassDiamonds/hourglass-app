/**
 * Calendar OAuth production-readiness.
 * Dedicated calendar.readonly consent. Does not print founder email or secrets.
 */

export const CALENDAR_CONSENT_REQUIRED =
  "CODE READY — CALENDAR CONSENT REQUIRED" as const;

export type CalendarOAuthProductionReadiness = {
  requestedScope: "calendar.readonly";
  mixedWithGmailOauth: false;
  productionActivation: "blocked";
  configurationGate: typeof CALENDAR_CONSENT_REQUIRED;
  notes: readonly string[];
};

export function assessCalendarOAuthProductionReadiness(): CalendarOAuthProductionReadiness {
  return {
    requestedScope: "calendar.readonly",
    mixedWithGmailOauth: false,
    productionActivation: "blocked",
    configurationGate: CALENDAR_CONSENT_REQUIRED,
    notes: [
      "Existing Continuum Gmail OAuth is gmail.readonly only and must not be broadened.",
      "Calendar uses a separate OAuth connection, cookies, token KEK, and custody table.",
      "calendar.readonly is a Google Sensitive scope and requires new founder consent.",
      "Do not apply SQL, push, or deploy from this lane.",
    ],
  };
}
