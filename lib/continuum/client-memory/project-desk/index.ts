/**
 * Internal Project Desk read surface.
 * App Router code must import the Supabase adapter from `./server`.
 * Never import from client components or public routes.
 * Slice A has no writer.
 */

export type {
  CoverageLevel,
  ListProjectsFilter,
  ProjectDeskCoverage,
  ProjectDeskGetResult,
  ProjectDeskNote,
  ProjectDeskOperationalStatus,
  ProjectDeskPerson,
  ProjectDeskRead,
  ProjectDeskSnapshot,
  ProjectDeskSummary,
  ProjectSpecField,
} from "./types";
export {
  PROJECT_DESK_HOME_LIMIT,
  PROJECT_DESK_NOTE_LIMIT,
} from "./types";
export type { ProjectDeskReader } from "./reader";
export {
  PROJECT_DESK_READER_METHODS,
  InMemoryProjectDeskReader,
  createInMemoryProjectDeskReader,
} from "./reader";
export {
  getProjectDeskFromSnapshot,
  listProjectsFromSnapshot,
} from "./compose";
