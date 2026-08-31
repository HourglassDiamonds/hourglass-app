/**
 * Founder-facing Project Book copy. Does not invent specs, kind, or lifecycle.
 */

import type { PersonProjectBookSectionId } from "./types";

export const PROJECT_BOOK_SECTION_TITLE: Record<PersonProjectBookSectionId, string> =
  {
    overview: "Overview",
    "items-and-specs": "Items & Specs",
    communication: "Communication",
    "decisions-and-approvals": "Decisions & Approvals",
    "cad-design": "CAD / Design",
    artifacts: "Artifacts",
    commercial: "Commercial",
    "history-sources": "History / Sources",
  };

export const PROJECT_BOOKS_SECTION_TITLE = "Project Books";

export const PROJECT_BOOKS_EMPTY =
  "No Project Books are linked to this person.";

export const PROJECT_BOOK_EMPTY = {
  itemsAndSpecs: "No stored item specifications yet.",
  communication: "No indexed communication on file.",
  decisions: "No recorded decisions or approvals.",
  cad: "No CAD identifier on file.",
  artifacts: "No attached project files yet.",
  commercial: "No stored commercial identifiers yet.",
  history: "No project-specific sources on file.",
} as const;

export const PROJECT_BOOK_FOUNDER_REVIEW = "Founder review required";

export function projectBookDefaultExpanded(bookCount: number): boolean {
  return bookCount === 1;
}

export function projectBookSourceSignal(sourceCount: number): string | null {
  if (sourceCount <= 0) return null;
  return sourceCount === 1 ? "1 source" : `${sourceCount} sources`;
}

export function projectBookEmailSignal(indexedEmailOnFile: boolean): string | null {
  return indexedEmailOnFile ? "Email index on file" : null;
}

export function projectBookToggleId(projectId: string): string {
  return `project-book-toggle-${projectId}`;
}

export function projectBookPanelId(projectId: string): string {
  return `project-book-panel-${projectId}`;
}

export function projectBookSectionId(
  projectId: string,
  section: PersonProjectBookSectionId,
): string {
  return `project-book-${projectId}-${section}`;
}
