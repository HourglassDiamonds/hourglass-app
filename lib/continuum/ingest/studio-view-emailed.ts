import { randomUUID } from "node:crypto";
import { CONTINUUM_SCHEMA_VERSION } from "../contracts/types";
import type {
  ContinuumEvent,
  ContinuumEvidence,
  StudioViewEmailedPayload,
} from "../contracts/types";
import {
  studioIdentifiedRecordEvidenceIdempotencyKey,
  studioViewEmailedEventIdempotencyKey,
} from "../contracts/ids";
import { assertNoPii } from "../contracts/validation";
import type { ContinuumStore } from "../persistence/types";

export type StudioIdentifiedSourceRef = {
  identifiedRecordId: string;
  occurredAt: string;
  sharePath: string;
  configuration: StudioViewEmailedPayload["configuration"];
};

export type StudioViewEmailedIngestResult = {
  eventStatus: "inserted" | "already-present";
  evidenceStatus: "inserted" | "already-present";
  event: ContinuumEvent;
  evidence: ContinuumEvidence;
};

export function mapStudioConfiguration(
  configuration: StudioViewEmailedPayload["configuration"],
): StudioViewEmailedPayload["configuration"] {
  return {
    shape: configuration.shape,
    carat: configuration.carat,
    ringSize: configuration.ringSize,
    bandWidth: configuration.bandWidth,
    skinTone: configuration.skinTone,
    orientation: configuration.orientation,
    metal: configuration.metal,
  };
}

export function buildStudioViewEmailedEvent(
  source: StudioIdentifiedSourceRef,
  nowIso: string,
): ContinuumEvent {
  const payload: StudioViewEmailedPayload = {
    identifiedRecordId: source.identifiedRecordId,
    sharePath: source.sharePath,
    configuration: mapStudioConfiguration(source.configuration),
  };
  return {
    id: randomUUID(),
    schemaVersion: CONTINUUM_SCHEMA_VERSION,
    eventType: "studio.view_emailed",
    occurredAt: source.occurredAt,
    ingestedAt: nowIso,
    producer: "diamond-studio-email-view",
    sourceSystem: "studio-identified",
    sourceRecordId: source.identifiedRecordId,
    subjectEntityId: null,
    idempotencyKey: studioViewEmailedEventIdempotencyKey(
      source.identifiedRecordId,
    ),
    payload,
  };
}

export function buildStudioViewEmailedEvidence(
  source: StudioIdentifiedSourceRef,
  nowIso: string,
): ContinuumEvidence {
  return {
    id: randomUUID(),
    schemaVersion: CONTINUUM_SCHEMA_VERSION,
    sourceSystem: "studio-identified",
    sourceKind: "source-record",
    sourceRecordId: source.identifiedRecordId,
    eventId: null,
    observationId: null,
    collectedAt: nowIso,
    reportingPeriod: null,
    freshness: "fresh",
    reliability: "reliable",
    redactionStatus: "clean",
    summary: "Identified Studio view emailed",
    supportingPointer: `diamond_studio_identified_events:${source.identifiedRecordId}`,
    idempotencyKey: studioIdentifiedRecordEvidenceIdempotencyKey(
      source.identifiedRecordId,
    ),
    claimFingerprint: null,
  };
}

export async function ingestStudioViewEmailed(
  store: ContinuumStore,
  source: StudioIdentifiedSourceRef,
  nowIso: string = new Date().toISOString(),
): Promise<StudioViewEmailedIngestResult> {
  const pii = assertNoPii(source, "studio identified source");
  if (!pii.ok) throw new Error(pii.reason);

  const eventResult = await store.insertEvent(
    buildStudioViewEmailedEvent(source, nowIso),
  );
  const evidenceResult = await store.insertEvidence(
    buildStudioViewEmailedEvidence(source, nowIso),
  );

  return {
    eventStatus: eventResult.status,
    evidenceStatus: evidenceResult.status,
    event: eventResult.record,
    evidence: evidenceResult.record,
  };
}

export async function ingestStudioViewEmailedBestEffort(input: {
  store: ContinuumStore | null;
  source: StudioIdentifiedSourceRef;
  operationId: string;
}): Promise<"inserted" | "already-present" | "skipped" | "failed"> {
  if (!input.store) return "skipped";
  try {
    const result = await ingestStudioViewEmailed(input.store, input.source);
    return result.eventStatus === "already-present" &&
      result.evidenceStatus === "already-present"
      ? "already-present"
      : "inserted";
  } catch (error) {
    console.error("[continuum-ingest]", {
      failed: true,
      eventType: "studio.view_emailed",
      identifiedRecordId: input.source.identifiedRecordId,
      operationId: input.operationId,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return "failed";
  }
}
