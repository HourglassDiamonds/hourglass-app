import type { StudioIdentifiedSourceRef } from "../ingest/studio-view-emailed";
import { ingestStudioViewEmailed } from "../ingest/studio-view-emailed";
import {
  studioIdentifiedRecordEvidenceIdempotencyKey,
  studioViewEmailedEventIdempotencyKey,
} from "../contracts/ids";
import type { ContinuumStore } from "../persistence/types";

export type StudioIdentifiedSourcePage = {
  rows: StudioIdentifiedSourceRef[];
  done: boolean;
};

export type StudioIdentifiedSourceReader = {
  list(input: {
    offset: number;
    limit: number;
  }): Promise<StudioIdentifiedSourcePage>;
};

export type ReconcileStudioIdentifiedResult = {
  scanned: number;
  eventsInserted: number;
  evidenceInserted: number;
  skippedComplete: number;
  repairedPartial: number;
  observationsWritten: 0;
};

export async function reconcileStudioIdentifiedEvents(input: {
  source: StudioIdentifiedSourceReader;
  store: ContinuumStore;
  batchSize?: number;
  maxRows?: number;
  nowIso?: string;
}): Promise<ReconcileStudioIdentifiedResult> {
  const batchSize = input.batchSize ?? 100;
  const maxRows = input.maxRows ?? 5_000;
  const nowIso = input.nowIso ?? new Date().toISOString();
  const result: ReconcileStudioIdentifiedResult = {
    scanned: 0,
    eventsInserted: 0,
    evidenceInserted: 0,
    skippedComplete: 0,
    repairedPartial: 0,
    observationsWritten: 0,
  };

  let offset = 0;
  while (result.scanned < maxRows) {
    const page = await input.source.list({
      offset,
      limit: Math.min(batchSize, maxRows - result.scanned),
    });
    if (page.rows.length === 0) break;

    for (const row of page.rows) {
      result.scanned += 1;
      const eventKey = studioViewEmailedEventIdempotencyKey(
        row.identifiedRecordId,
      );
      const evidenceKey = studioIdentifiedRecordEvidenceIdempotencyKey(
        row.identifiedRecordId,
      );
      const existingEvent = await input.store.getEventByIdempotencyKey(eventKey);
      const existingEvidence =
        await input.store.getEvidenceByIdempotencyKey(evidenceKey);

      if (existingEvent && existingEvidence) {
        result.skippedComplete += 1;
        continue;
      }

      const ingested = await ingestStudioViewEmailed(input.store, row, nowIso);
      if (ingested.eventStatus === "inserted") result.eventsInserted += 1;
      if (ingested.evidenceStatus === "inserted") result.evidenceInserted += 1;
      if (existingEvent && !existingEvidence) result.repairedPartial += 1;
    }

    if (page.done || page.rows.length < batchSize) break;
    offset += page.rows.length;
  }

  return result;
}
