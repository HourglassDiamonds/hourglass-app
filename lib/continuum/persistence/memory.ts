/**
 * In-memory Continuum store for tests. Not durable. Not production.
 */

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
} from "../contracts/types";
import type { ContinuumStore, InsertResult } from "./types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function requireOk(result: { ok: true } | { ok: false; reason: string }): void {
  if (!result.ok) throw new Error(result.reason);
}

export class InMemoryContinuumStore implements ContinuumStore {
  private events = new Map<string, ContinuumEvent>();
  private evidence = new Map<string, ContinuumEvidence>();
  private observations = new Map<string, ContinuumObservation>();
  private observationEvidence = new Set<string>();
  private exceptions: ContinuumException[] = [];

  reset(): void {
    this.events.clear();
    this.evidence.clear();
    this.observations.clear();
    this.observationEvidence.clear();
    this.exceptions = [];
  }

  async insertEvent(event: ContinuumEvent): Promise<InsertResult<ContinuumEvent>> {
    requireOk(assertNoPii(event, "event"));
    const existing = this.events.get(event.idempotencyKey);
    if (existing) return { status: "already-present", record: clone(existing) };
    this.events.set(event.idempotencyKey, clone(event));
    return { status: "inserted", record: clone(event) };
  }

  async getEventByIdempotencyKey(key: string): Promise<ContinuumEvent | null> {
    const existing = this.events.get(key);
    return existing ? clone(existing) : null;
  }

  async insertEvidence(
    evidence: ContinuumEvidence,
  ): Promise<InsertResult<ContinuumEvidence>> {
    requireOk(validateEvidenceSourceRefs(evidence));
    requireOk(assertNoPii(evidence, "evidence"));
    const existing = this.evidence.get(evidence.idempotencyKey);
    if (existing) return { status: "already-present", record: clone(existing) };
    this.evidence.set(evidence.idempotencyKey, clone(evidence));
    return { status: "inserted", record: clone(evidence) };
  }

  async getEvidenceByIdempotencyKey(
    key: string,
  ): Promise<ContinuumEvidence | null> {
    const existing = this.evidence.get(key);
    return existing ? clone(existing) : null;
  }

  async insertObservation(
    observation: ContinuumObservation,
  ): Promise<InsertResult<ContinuumObservation>> {
    requireOk(validateObservation(observation));
    requireOk(assertNoPii(observation, "observation"));
    const existing = this.observations.get(observation.id);
    if (existing) return { status: "already-present", record: clone(existing) };
    this.observations.set(observation.id, clone(observation));
    return { status: "inserted", record: clone(observation) };
  }

  async getObservationById(id: string): Promise<ContinuumObservation | null> {
    const existing = this.observations.get(id);
    return existing ? clone(existing) : null;
  }

  async linkObservationEvidence(
    link: ContinuumObservationEvidence,
  ): Promise<ContinuumObservationEvidence> {
    if (!this.observations.has(link.observationId)) {
      throw new Error("observation not found");
    }
    const evidenceExists = [...this.evidence.values()].some(
      (row) => row.id === link.evidenceId,
    );
    if (!evidenceExists) throw new Error("evidence not found");
    this.observationEvidence.add(`${link.observationId}:${link.evidenceId}`);
    return { ...link };
  }

  async listEvidenceIdsForObservation(observationId: string): Promise<string[]> {
    const ids: string[] = [];
    for (const key of this.observationEvidence) {
      const [obsId, evidenceId] = key.split(":");
      if (obsId === observationId && evidenceId) ids.push(evidenceId);
    }
    return ids.sort();
  }

  async closeObservationValidity(id: string, validUntil: string): Promise<void> {
    const existing = this.observations.get(id);
    if (!existing) throw new Error("observation not found");
    this.observations.set(id, { ...existing, validUntil });
  }

  async upsertOpenException(
    exception: ContinuumException,
  ): Promise<ContinuumException> {
    requireOk(validateExceptionPayload(exception.payload));
    requireOk(assertNoPii(exception, "exception"));
    const existing = this.exceptions.find(
      (row) =>
        row.exceptionType === exception.exceptionType &&
        row.subjectKey === exception.subjectKey,
    );
    if (existing) {
      if (existing.status === "open") {
        existing.lastSeenAt = exception.lastSeenAt;
        return clone(existing);
      }
      return clone(existing);
    }
    const stored = clone(exception);
    this.exceptions.push(stored);
    return clone(stored);
  }

  async setExceptionStatus(input: {
    exceptionType: ContinuumExceptionType;
    subjectKey: string;
    status: Exclude<ContinuumExceptionStatus, "open">;
    at: string;
  }): Promise<ContinuumException | null> {
    const existing = this.exceptions.find(
      (row) =>
        row.exceptionType === input.exceptionType &&
        row.subjectKey === input.subjectKey,
    );
    if (!existing) return null;
    existing.status = input.status;
    existing.resolvedAt = input.at;
    existing.lastSeenAt = input.at;
    return clone(existing);
  }

  async getException(
    exceptionType: ContinuumExceptionType,
    subjectKey: string,
  ): Promise<ContinuumException | null> {
    const existing = this.exceptions.find(
      (row) =>
        row.exceptionType === exceptionType && row.subjectKey === subjectKey,
    );
    return existing ? clone(existing) : null;
  }

  async listObservations(): Promise<ContinuumObservation[]> {
    return [...this.observations.values()].map(clone);
  }

  async listEntities(): Promise<{ id: string; kind: string }[]> {
    return [];
  }

  /** Test-only: simulate partial Event-without-Evidence state. */
  deleteEvidenceByIdempotencyKey(key: string): void {
    this.evidence.delete(key);
  }
}
