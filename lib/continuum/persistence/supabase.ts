/**
 * Supabase Continuum persistence. Service-role only.
 * Tables are not applied in Phase 1B.1 — inserts fail until 1B.2 activation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import {
  assertNoPii,
  validateEvidenceSourceRefs,
  validateExceptionPayload,
  validateObservation,
} from "../contracts/validation";
import type {
  ContinuumEvent,
  ContinuumEvidence,
  ContinuumException,
  ContinuumExceptionStatus,
  ContinuumExceptionType,
  ContinuumObservation,
  ContinuumObservationEvidence,
  ContinuumSourceSystem,
  EpistemicClass,
  EvidenceSourceKind,
  FreshnessStatus,
  Materiality,
  RedactionStatus,
  ReliabilityStatus,
  StudioViewEmailedPayload,
  Urgency,
} from "../contracts/types";
import { CONTINUUM_SCHEMA_VERSION } from "../contracts/types";
import type { ContinuumStore, InsertResult } from "./types";

const UNIQUE_VIOLATION = "23505";

function requireOk(result: { ok: true } | { ok: false; reason: string }): void {
  if (!result.ok) throw new Error(result.reason);
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === UNIQUE_VIOLATION;
}

function eventToRow(event: ContinuumEvent) {
  return {
    id: event.id,
    schema_version: event.schemaVersion,
    event_type: event.eventType,
    occurred_at: event.occurredAt,
    ingested_at: event.ingestedAt,
    producer: event.producer,
    source_system: event.sourceSystem,
    source_record_id: event.sourceRecordId,
    subject_entity_id: event.subjectEntityId,
    idempotency_key: event.idempotencyKey,
    payload: event.payload,
  };
}

function rowToEvent(row: Record<string, unknown>): ContinuumEvent {
  return {
    id: String(row.id),
    schemaVersion: CONTINUUM_SCHEMA_VERSION,
    eventType: "studio.view_emailed",
    occurredAt: String(row.occurred_at),
    ingestedAt: String(row.ingested_at),
    producer: "diamond-studio-email-view",
    sourceSystem: "studio-identified",
    sourceRecordId: String(row.source_record_id),
    subjectEntityId: row.subject_entity_id ? String(row.subject_entity_id) : null,
    idempotencyKey: String(row.idempotency_key),
    payload: row.payload as StudioViewEmailedPayload,
  };
}

function evidenceToRow(evidence: ContinuumEvidence) {
  return {
    id: evidence.id,
    schema_version: evidence.schemaVersion,
    source_system: evidence.sourceSystem,
    source_kind: evidence.sourceKind,
    source_record_id: evidence.sourceRecordId,
    event_id: evidence.eventId,
    observation_id: evidence.observationId,
    collected_at: evidence.collectedAt,
    period_start: evidence.reportingPeriod?.start ?? null,
    period_end: evidence.reportingPeriod?.end ?? null,
    freshness: evidence.freshness,
    reliability: evidence.reliability,
    redaction_status: evidence.redactionStatus,
    summary: evidence.summary,
    supporting_pointer: evidence.supportingPointer,
    idempotency_key: evidence.idempotencyKey,
    claim_fingerprint: evidence.claimFingerprint,
  };
}

function rowToEvidence(row: Record<string, unknown>): ContinuumEvidence {
  const periodStart = row.period_start ? String(row.period_start) : null;
  const periodEnd = row.period_end ? String(row.period_end) : null;
  return {
    id: String(row.id),
    schemaVersion: CONTINUUM_SCHEMA_VERSION,
    sourceSystem: row.source_system as ContinuumSourceSystem,
    sourceKind: row.source_kind as EvidenceSourceKind,
    sourceRecordId: row.source_record_id ? String(row.source_record_id) : null,
    eventId: row.event_id ? String(row.event_id) : null,
    observationId: row.observation_id ? String(row.observation_id) : null,
    collectedAt: String(row.collected_at),
    reportingPeriod:
      periodStart && periodEnd ? { start: periodStart, end: periodEnd } : null,
    freshness: row.freshness as FreshnessStatus,
    reliability: row.reliability as ReliabilityStatus,
    redactionStatus: row.redaction_status as RedactionStatus,
    summary: String(row.summary),
    supportingPointer: row.supporting_pointer
      ? String(row.supporting_pointer)
      : null,
    idempotencyKey: String(row.idempotency_key),
    claimFingerprint: row.claim_fingerprint
      ? String(row.claim_fingerprint)
      : null,
  };
}

function observationToRow(observation: ContinuumObservation) {
  return {
    id: observation.id,
    schema_version: observation.schemaVersion,
    observation_type: observation.observationType,
    subject_entity_id: observation.subjectEntityId,
    statement: observation.statement,
    value: observation.value,
    epistemic_class: observation.epistemicClass,
    confidence: observation.confidence,
    produced_by: observation.producedBy,
    created_at: observation.createdAt,
    valid_from: observation.validFrom,
    valid_until: observation.validUntil,
    supersedes_id: observation.supersedesId,
    materiality: observation.materiality,
    urgency: observation.urgency,
  };
}

function rowToObservation(row: Record<string, unknown>): ContinuumObservation {
  return {
    id: String(row.id),
    schemaVersion: CONTINUUM_SCHEMA_VERSION,
    observationType: String(row.observation_type),
    subjectEntityId: row.subject_entity_id
      ? String(row.subject_entity_id)
      : null,
    statement: String(row.statement),
    value: (row.value as ContinuumObservation["value"]) ?? null,
    epistemicClass: row.epistemic_class as EpistemicClass,
    confidence: Number(row.confidence),
    producedBy: String(row.produced_by),
    createdAt: String(row.created_at),
    validFrom: String(row.valid_from),
    validUntil: row.valid_until ? String(row.valid_until) : null,
    supersedesId: row.supersedes_id ? String(row.supersedes_id) : null,
    materiality: row.materiality as Materiality,
    urgency: row.urgency as Urgency,
  };
}

function exceptionToRow(exception: ContinuumException) {
  return {
    id: exception.id,
    exception_type: exception.exceptionType,
    subject_key: exception.subjectKey,
    subject_entity_id: exception.subjectEntityId,
    status: exception.status,
    opened_at: exception.openedAt,
    last_seen_at: exception.lastSeenAt,
    resolved_at: exception.resolvedAt,
    detector: exception.detector,
    evidence_id: exception.evidenceId,
    payload: exception.payload,
  };
}

function rowToException(row: Record<string, unknown>): ContinuumException {
  return {
    id: String(row.id),
    exceptionType: row.exception_type as ContinuumExceptionType,
    subjectKey: String(row.subject_key),
    subjectEntityId: row.subject_entity_id
      ? String(row.subject_entity_id)
      : null,
    status: row.status as ContinuumExceptionStatus,
    openedAt: String(row.opened_at),
    lastSeenAt: String(row.last_seen_at),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    detector: "studio-email-view",
    evidenceId: row.evidence_id ? String(row.evidence_id) : null,
    payload: (row.payload as ContinuumException["payload"]) ?? {},
  };
}

export class SupabaseContinuumStore implements ContinuumStore {
  constructor(private readonly client: SupabaseClient) {}

  async insertEvent(event: ContinuumEvent): Promise<InsertResult<ContinuumEvent>> {
    requireOk(assertNoPii(event, "event"));
    const { error } = await this.client
      .from("continuum_events")
      .insert(eventToRow(event));
    if (!error) return { status: "inserted", record: event };
    if (isUniqueViolation(error)) {
      const existing = await this.getEventByIdempotencyKey(event.idempotencyKey);
      if (existing) return { status: "already-present", record: existing };
    }
    throw new Error(error.message);
  }

  async getEventByIdempotencyKey(key: string): Promise<ContinuumEvent | null> {
    const { data, error } = await this.client
      .from("continuum_events")
      .select("*")
      .eq("idempotency_key", key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToEvent(data as Record<string, unknown>) : null;
  }

  async insertEvidence(
    evidence: ContinuumEvidence,
  ): Promise<InsertResult<ContinuumEvidence>> {
    requireOk(validateEvidenceSourceRefs(evidence));
    requireOk(assertNoPii(evidence, "evidence"));
    const { error } = await this.client
      .from("continuum_evidence")
      .insert(evidenceToRow(evidence));
    if (!error) return { status: "inserted", record: evidence };
    if (isUniqueViolation(error)) {
      const existing = await this.getEvidenceByIdempotencyKey(
        evidence.idempotencyKey,
      );
      if (existing) return { status: "already-present", record: existing };
    }
    throw new Error(error.message);
  }

  async getEvidenceByIdempotencyKey(
    key: string,
  ): Promise<ContinuumEvidence | null> {
    const { data, error } = await this.client
      .from("continuum_evidence")
      .select("*")
      .eq("idempotency_key", key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToEvidence(data as Record<string, unknown>) : null;
  }

  async insertObservation(
    observation: ContinuumObservation,
  ): Promise<InsertResult<ContinuumObservation>> {
    requireOk(validateObservation(observation));
    requireOk(assertNoPii(observation, "observation"));
    const { error } = await this.client
      .from("continuum_observations")
      .insert(observationToRow(observation));
    if (!error) return { status: "inserted", record: observation };
    if (isUniqueViolation(error)) {
      const existing = await this.getObservationById(observation.id);
      if (existing) return { status: "already-present", record: existing };
    }
    throw new Error(error.message);
  }

  async getObservationById(id: string): Promise<ContinuumObservation | null> {
    const { data, error } = await this.client
      .from("continuum_observations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToObservation(data as Record<string, unknown>) : null;
  }

  async linkObservationEvidence(
    link: ContinuumObservationEvidence,
  ): Promise<ContinuumObservationEvidence> {
    const { error } = await this.client
      .from("continuum_observation_evidence")
      .insert({
        observation_id: link.observationId,
        evidence_id: link.evidenceId,
      });
    if (error && !isUniqueViolation(error)) throw new Error(error.message);
    return link;
  }

  async listEvidenceIdsForObservation(observationId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from("continuum_observation_evidence")
      .select("evidence_id")
      .eq("observation_id", observationId);
    if (error) throw new Error(error.message);
    return (data ?? [])
      .map((row) => String((row as { evidence_id: string }).evidence_id))
      .sort();
  }

  async closeObservationValidity(id: string, validUntil: string): Promise<void> {
    const { error } = await this.client
      .from("continuum_observations")
      .update({ valid_until: validUntil })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  async upsertOpenException(
    exception: ContinuumException,
  ): Promise<ContinuumException> {
    requireOk(validateExceptionPayload(exception.payload));
    requireOk(assertNoPii(exception, "exception"));
    const existing = await this.getException(
      exception.exceptionType,
      exception.subjectKey,
    );
    if (existing) {
      if (existing.status === "open") {
        const { error } = await this.client
          .from("continuum_exceptions")
          .update({ last_seen_at: exception.lastSeenAt })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        return { ...existing, lastSeenAt: exception.lastSeenAt };
      }
      return existing;
    }
    const { error } = await this.client
      .from("continuum_exceptions")
      .insert(exceptionToRow(exception));
    if (!error) return exception;
    if (isUniqueViolation(error)) {
      const raced = await this.getException(
        exception.exceptionType,
        exception.subjectKey,
      );
      if (raced) return raced;
    }
    throw new Error(error.message);
  }

  async setExceptionStatus(input: {
    exceptionType: ContinuumExceptionType;
    subjectKey: string;
    status: Exclude<ContinuumExceptionStatus, "open">;
    at: string;
  }): Promise<ContinuumException | null> {
    const existing = await this.getException(input.exceptionType, input.subjectKey);
    if (!existing) return null;
    const { error } = await this.client
      .from("continuum_exceptions")
      .update({
        status: input.status,
        resolved_at: input.at,
        last_seen_at: input.at,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return {
      ...existing,
      status: input.status,
      resolvedAt: input.at,
      lastSeenAt: input.at,
    };
  }

  async getException(
    exceptionType: ContinuumExceptionType,
    subjectKey: string,
  ): Promise<ContinuumException | null> {
    const { data, error } = await this.client
      .from("continuum_exceptions")
      .select("*")
      .eq("exception_type", exceptionType)
      .eq("subject_key", subjectKey)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToException(data as Record<string, unknown>) : null;
  }

  async listObservations(): Promise<ContinuumObservation[]> {
    const { data, error } = await this.client
      .from("continuum_observations")
      .select("*");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) =>
      rowToObservation(row as Record<string, unknown>),
    );
  }

  async listEntities(): Promise<{ id: string; kind: string }[]> {
    const { data, error } = await this.client
      .from("continuum_entities")
      .select("id, kind");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: String((row as { id: string }).id),
      kind: String((row as { kind: string }).kind),
    }));
  }
}

export function tryCreateContinuumStore(
  client?: SupabaseClient | null,
): ContinuumStore | null {
  const resolved = client === undefined ? getSupabaseAdmin() : client;
  if (!resolved) return null;
  return new SupabaseContinuumStore(resolved);
}
