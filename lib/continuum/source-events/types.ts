/**
 * Read-time source communication events.
 * Plane 1 of Today: SOURCE EVENT. Candidates are interpretation, not required
 * for a Gmail message to participate in current work.
 * Future sources (concierge_form, SMS, PLAUD, founder_note) can emit the same class.
 * Read-model only. No table. No writes.
 */

export const SOURCE_COMMUNICATION_SOURCE_TYPES = [
  "gmail",
  "concierge_form",
  "sms",
  "plaud",
  "founder_note",
] as const;

export type SourceCommunicationSourceType =
  (typeof SOURCE_COMMUNICATION_SOURCE_TYPES)[number];

export const SOURCE_COMMUNICATION_ACTORS = [
  "founder",
  "client",
  "vendor_shop",
  "system",
  "unknown",
] as const;

export type SourceCommunicationActor = (typeof SOURCE_COMMUNICATION_ACTORS)[number];

export const SOURCE_COMMUNICATION_EVENT_CLASSES = [
  "founder_requests_vendor",
  "founder_updates_client",
  "founder_fulfills_commitment",
  "client_requests",
  "client_approves",
  "client_replies_nonblocking",
  "vendor_promises",
  "vendor_delivers_artifact",
  "vendor_order_confirmation",
  "vendor_acknowledges",
  "workshop_started",
  "unknown_communication",
] as const;

export type SourceCommunicationEventClass =
  (typeof SOURCE_COMMUNICATION_EVENT_CLASSES)[number];

export const SOURCE_COMMUNICATION_DIRECTIONS = [
  "inbound",
  "outbound",
  "unknown",
] as const;

export type SourceCommunicationDirection =
  (typeof SOURCE_COMMUNICATION_DIRECTIONS)[number];

export type SourceCommunicationEvent = {
  sourceType: SourceCommunicationSourceType;
  sourceRef: string;
  messageId: string | null;
  threadId: string | null;
  timestamp: string;
  direction: SourceCommunicationDirection;
  actor: SourceCommunicationActor;
  subject: string | null;
  authorOwnedText: string;
  quotedText: string;
  attachmentFilenames: readonly string[];
  hasAttachments: boolean;
  cadIds: readonly string[];
  orderIds: readonly string[];
  productionJobIds: readonly string[];
  personLabel: string | null;
  projectId: string | null;
  workLoopId: string | null;
  semanticClass: SourceCommunicationEventClass;
  /** Current-message wording that supports semanticClass. */
  evidenceExcerpt: string;
  /** Exact identity evidence that permits this event to enter operational work. */
  workIdentityBasis:
    | "project"
    | "cad"
    | "order"
    | "production_job"
    | "candidate_message"
    | null;
  provenance:
    | "indexed_gmail"
    | "indexed_gmail+interpretation"
    | "indexed_gmail+live_operational_fact"
    | "indexed_gmail+interpretation+live_operational_fact";
};

export function isCurrentWorkSourceClass(
  value: SourceCommunicationEventClass,
): boolean {
  return (
    value !== "unknown_communication" &&
    value !== "client_replies_nonblocking" &&
    value !== "vendor_acknowledges"
  );
}

export function isOperationalSourceEvent(event: SourceCommunicationEvent): boolean {
  return event.workIdentityBasis !== null && isCurrentWorkSourceClass(event.semanticClass);
}
