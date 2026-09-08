/**
 * Continuum Calendar read-only public surface.
 * Does not export the Supabase adapter — import that from `./server`.
 */

export { CALENDAR_READONLY_SCOPE } from "./types";
export type {
  CalendarConnection,
  CalendarEventEvidence,
  CalendarOAuthErrorCode,
  CalendarTokenCiphertext,
} from "./types";
export {
  CALENDAR_FOUNDER_SLOT,
  CALENDAR_SOURCE_SYSTEM,
  CONCIERGE_CALENDAR_PATH,
} from "./types";
export { InMemoryCalendarConnectionStore } from "./connection";
export type { CalendarConnectionStore } from "./connection";
export {
  applyCalendarDisconnect,
  applyCalendarInvalidGrant,
  applyCalendarPause,
  applyCalendarResume,
  isCalendarReadEligible,
} from "./connection";
export { MockCalendarApi } from "./adapter";
export type { CalendarReadApi } from "./adapter";
export { assessCalendarOAuthProductionReadiness } from "./oauth-readiness";
export { toCalendarAssociationHandoff } from "./handoff";
export type { CalendarAssociationHandoff } from "./handoff";
export { readCalendarContext } from "./context";
export { toCalendarFounderContextView } from "./presentation";
export {
  analyzeCalendarEventAssociation,
  ingestCalendarAssociationCandidates,
  proposeCalendarAssociationCandidates,
} from "./association";
