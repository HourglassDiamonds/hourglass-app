/**
 * Concierge manual-note write contracts.
 * Context is the relationship layer of a memory, not a Person identity,
 * not a permission, and not a Fact/Wish status.
 */

import type { RelationshipContextLayer } from "../types";

export type { RelationshipContextLayer };

export const CONCIERGE_MANUAL_SOURCE_SYSTEM = "concierge-manual" as const;
export const CONCIERGE_MANUAL_SOURCE_ARTIFACT = "concierge" as const;
export const CONCIERGE_MANUAL_SOURCE_SHEET = "manual-note" as const;
export const CONCIERGE_MANUAL_SOURCE_FIELD = "note" as const;
export const MANUAL_NOTE_MAX_LENGTH = 10_000;

export type AddManualNoteInput = {
  submissionId: string;
  personId: string;
  projectId?: string | null;
  contextLayer: RelationshipContextLayer;
  noteText: string;
};

export type AddManualNoteInvalidCode =
  | "empty-note"
  | "oversized-note"
  | "invalid-context"
  | "invalid-id"
  | "project-not-allowed";

export type AddManualNoteResult =
  | {
      ok: true;
      noteId: string;
      status: "inserted" | "already-present";
    }
  | {
      ok: false;
      reason:
        | "invalid-input"
        | "person-not-found"
        | "project-not-linked"
        | "idempotency-conflict"
        | "unavailable";
      code?: AddManualNoteInvalidCode;
      operationId?: string;
    };

export function conciergeManualImportRowKey(submissionId: string): string {
  return `${CONCIERGE_MANUAL_SOURCE_SYSTEM}:${submissionId}`;
}
