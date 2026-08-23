/**
 * Internal Concierge Client Memory read/search surface.
 * App Router code must import the Supabase adapter from `./server`.
 * Never import the reader from client components or public routes.
 */

export type { ClientMemoryReader } from "./reader";
export {
  CLIENT_MEMORY_READER_METHODS,
  InMemoryClientMemoryReader,
  createInMemoryClientMemoryReader,
} from "./reader";
export {
  CLIENT_MEMORY_CONCIERGE_AUTH_GATE,
  requireInternalClientMemorySession,
} from "./access";
export {
  CLIENT_MEMORY_FINANCIAL_FIELD_NAMES,
  CLIENT_MEMORY_NOTE_LIMIT,
  CLIENT_MEMORY_SEARCH_LIMIT,
  ACTIVE_WISH_STATUSES,
} from "./types";
export type {
  ClientSearchResult,
  ConciergePersonProfile,
  ConciergePersonProfileResult,
  ClientRelationshipSummary,
  IdentityReviewSummary,
  LinkedProjectRead,
  ProjectHistorySummary,
  ProjectProfileSummary,
  SourceNoteSummary,
  WishSummary,
  ClientMemoryReadSnapshot,
} from "./types";
export { searchPeopleFromSnapshot, rankSearchHit, SEARCH_RANK } from "./search";
export { composePersonProfile } from "./profile";
