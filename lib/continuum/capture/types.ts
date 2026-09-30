/** Serializable proposals only. No lookup, scheduling, or write authority. */
import type { ConciergeForegroundModelId } from "../concierge-sol/models";
import type { DateOnly } from "../date-only";

export const CAPTURE_CONTRACT_VERSION = 1 as const;

/** Caller supplies stable opaque capture/item IDs; entity/mutation IDs are UUIDs. */
export type CaptureRequest = {
  captureId: string;
  text: string;
  provenance: "text" | "voice";
  referenceTime: string;
  timezone: string;
  context?: { personId?: string; projectId?: string };
  requestedModel?: ConciergeForegroundModelId;
};
export type CaptureEntityReference = { kind: "person" | "project"; id: string; evidence: string };
/** Resolved is an interpretation claim, not proof of existence or authorization. */
export type CaptureEntityResolution =
  | { status: "resolved"; personId?: string; projectId?: string; evidence: string }
  | { status: "ambiguous"; candidates: readonly CaptureEntityReference[] }
  | { status: "unresolved"; mention: string };

export type CaptureScheduledTiming =
  | { kind: "date-only"; originalWording: string; date: DateOnly; timezone?: string; referenceInstant?: string }
  | { kind: "exact-instant"; originalWording: string; instantAt: string; timezone: string; referenceInstant?: string };
/** Instants require an explicit offset. Never copy instantAt into job dueAt. */
export type CaptureTiming = CaptureScheduledTiming
  | { kind: "unspecified"; originalWording: string }
  | { kind: "checkpoint"; originalWording: string; condition: string; checkAt?: CaptureScheduledTiming;
      timezone?: string; referenceInstant?: string };

export type CaptureProposedItem = {
  itemId: string;
  kind: "action" | "reminder" | "watching" | "note";
  sourceExcerpt: string;
  title: string;
  content: string;
  entityResolution?: CaptureEntityResolution;
  timing?: CaptureTiming;
  clarification?: { question: string };
  /** Finite 0..1 interpretation confidence. Never permission to save. */
  confidence: number;
};
export type CaptureProposal = {
  version: typeof CAPTURE_CONTRACT_VERSION;
  captureId: string;
  items: readonly CaptureProposedItem[];
  canonical: false;
};
/** Selected items carry the full reviewed snapshot, including edits.
 * Future authenticated writers must revalidate entities and confirmation.
 * Reuse mutationId for a retry; use a new ID for a different operation.
 */
export type CaptureCommitInput = {
  version: typeof CAPTURE_CONTRACT_VERSION;
  captureId: string;
  items: readonly (
    | { itemId: string; selected: false }
    | { itemId: string; selected: true; mutationId: string; confirmedItem: CaptureProposedItem }
  )[];
};
export type CaptureCommitItemResult =
  | { itemId: string; status: "saved" | "already-present"; target: { kind: "open_job" | "source_note"; id: string } }
  | { itemId: string; status: "needs-review" | "failed"; message: string };
/** Results cover selected items only. Batch atomicity is not promised. */
export type CaptureCommitResult = {
  version: typeof CAPTURE_CONTRACT_VERSION;
  captureId: string;
  items: readonly CaptureCommitItemResult[];
};
