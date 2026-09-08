/**
 * Calendar association public surface.
 * Does not export the Supabase writer — import that from `./server`.
 */

export { packCalendarCandidateSourceRef, parseCalendarCandidateSourceRef } from "./source-ref";
export type { CalendarCandidateSourceRef } from "./source-ref";
export { CALENDAR_CANDIDATE_SOURCE_VERSION } from "./source-ref";
export { analyzeCalendarEventAssociation } from "./associate";
export { proposeCalendarAssociationCandidates } from "./propose";
export {
  ingestCalendarAssociationCandidates,
  listCalendarAssociationCandidates,
} from "./ingest";
export { InMemoryCalendarAssociationWriter } from "./writer";
export type { CalendarAssociationWriter } from "./writer";
export { reviewCalendarAssociationCandidate } from "./apply";
export { presentCalendarAssociationReviewViews } from "./present";
export { calendarEventEvidence } from "./fixtures";
export type {
  CalendarAssociationWorld,
  CalendarAssociationAnalysis,
} from "./types";
