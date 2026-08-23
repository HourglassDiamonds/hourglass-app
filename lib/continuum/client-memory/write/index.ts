/**
 * Internal Concierge Client Memory write surface.
 * App Router code must import the Supabase adapter from `./server`.
 * Never import the writer from client components or public routes.
 */

export type { ClientMemoryNoteWriter } from "./writer";
export {
  InMemoryClientMemoryNoteWriter,
  createInMemoryClientMemoryNoteWriter,
} from "./writer";
export { addManualNote } from "./add-manual-note";
export { suggestRelationshipContextLayer } from "./context";
export {
  CONCIERGE_MANUAL_SOURCE_SYSTEM,
  CONCIERGE_MANUAL_SOURCE_ARTIFACT,
  CONCIERGE_MANUAL_SOURCE_SHEET,
  CONCIERGE_MANUAL_SOURCE_FIELD,
  MANUAL_NOTE_MAX_LENGTH,
  conciergeManualImportRowKey,
} from "./types";
export type {
  AddManualNoteInput,
  AddManualNoteResult,
  AddManualNoteInvalidCode,
} from "./types";
