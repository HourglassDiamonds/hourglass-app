import type { ContinuumEventType } from "./types";

export function studioViewEmailedEventIdempotencyKey(
  identifiedRecordId: string,
): string {
  return `studio.view_emailed:identified:${identifiedRecordId}`;
}

export function studioIdentifiedRecordEvidenceIdempotencyKey(
  identifiedRecordId: string,
): string {
  return `studio-record:${identifiedRecordId}`;
}

export function eventIdempotencyKey(
  eventType: ContinuumEventType,
  identifiedRecordId: string,
): string {
  if (eventType === "studio.view_emailed") {
    return studioViewEmailedEventIdempotencyKey(identifiedRecordId);
  }
  const _never: never = eventType;
  return _never;
}
