/**
 * Internal Concierge Client Memory project-spec write surface.
 * App Router code must import the Supabase adapter from `./server`.
 * Never import the writer from client components or public routes.
 */

export type { ClientMemoryProjectSpecWriter } from "./writer";
export {
  InMemoryClientMemoryProjectSpecWriter,
  createInMemoryClientMemoryProjectSpecWriter,
} from "./writer";
export { correctProjectSpec } from "./correct";
export { correctProjectKind } from "./correct-kind";
export { validateProjectSpecCorrection } from "./validate";
export {
  EDITABLE_PROJECT_SPEC_FIELDS,
  PROJECT_SPEC_CORRECTION_SOURCE_SYSTEM,
  PROJECT_SPEC_FIELD_LABELS,
  currentSpecValue,
  founderCorrectedFieldsOf,
  projectRevisionFieldLabel,
} from "./types";
export type { EditableProjectSpecField, ProjectHistoryRevision } from "./types";
export type {
  CorrectProjectSpecInput,
  CorrectProjectSpecResult,
} from "./correct";
export type {
  CorrectProjectKindInput,
  CorrectProjectKindResult,
} from "./correct-kind";
export { correctProjectOperatingDetail } from "../project-operating/correct";
export type {
  CorrectOperatingDetailInput,
  CorrectOperatingDetailResult,
} from "../project-operating/correct";
export {
  isFounderCorrectedProjectSpecField,
  mergeImportedProjectHistory,
} from "./import-guard";
