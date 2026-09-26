/**
 * Map existing source-communication events into the Project Book record.
 * Does not classify, reduce, or assign projects.
 * Quoted text is dropped here and never enters the book.
 */

import type { SourceCommunicationEvent } from "@/lib/continuum/source-events/types";
import { SOURCE_COMMUNICATION_SOURCE_TYPES } from "@/lib/continuum/source-events/types";
import type { ProjectBookSourceRecord, ProjectBookSourceType } from "./types";

function sourceTypeOf(value: SourceCommunicationEvent["sourceType"]): ProjectBookSourceType {
  if ((SOURCE_COMMUNICATION_SOURCE_TYPES as readonly string[]).includes(value)) {
    if (value === "gmail" || value === "sms" || value === "plaud" || value === "founder_note" || value === "concierge_form") {
      return value;
    }
  }
  return "gmail";
}

export function projectBookRecordFromSourceEvent(
  event: SourceCommunicationEvent,
): ProjectBookSourceRecord {
  const projectId = event.projectId?.trim() || null;
  return {
    sourceType: sourceTypeOf(event.sourceType),
    sourceRef: event.sourceRef,
    timestamp: event.timestamp,
    actor: event.actor,
    direction: event.direction,
    semanticClass: event.semanticClass,
    subject: event.subject,
    authorOwnedText: event.authorOwnedText,
    attachmentFilenames: event.attachmentFilenames,
    personLabel: event.personLabel,
    projectId,
    association: projectId ? "exact" : "unassigned",
    plausibleProjectIds: projectId ? [projectId] : [],
    cadIds: event.cadIds,
    provenance: event.provenance,
  };
}

export function projectBookRecordsFromSourceEvents(
  events: readonly SourceCommunicationEvent[],
): ProjectBookSourceRecord[] {
  return events.map(projectBookRecordFromSourceEvent);
}
