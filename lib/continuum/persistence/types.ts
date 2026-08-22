import type {
  ContinuumEvent,
  ContinuumEvidence,
  ContinuumException,
  ContinuumExceptionStatus,
  ContinuumExceptionType,
  ContinuumObservation,
  ContinuumObservationEvidence,
} from "../contracts/types";

export type InsertResult<T> =
  | { status: "inserted"; record: T }
  | { status: "already-present"; record: T };

export type ContinuumStore = {
  insertEvent(event: ContinuumEvent): Promise<InsertResult<ContinuumEvent>>;
  getEventByIdempotencyKey(key: string): Promise<ContinuumEvent | null>;
  insertEvidence(
    evidence: ContinuumEvidence,
  ): Promise<InsertResult<ContinuumEvidence>>;
  getEvidenceByIdempotencyKey(key: string): Promise<ContinuumEvidence | null>;
  insertObservation(
    observation: ContinuumObservation,
  ): Promise<InsertResult<ContinuumObservation>>;
  getObservationById(id: string): Promise<ContinuumObservation | null>;
  linkObservationEvidence(
    link: ContinuumObservationEvidence,
  ): Promise<ContinuumObservationEvidence>;
  listEvidenceIdsForObservation(observationId: string): Promise<string[]>;
  closeObservationValidity(id: string, validUntil: string): Promise<void>;
  upsertOpenException(
    exception: ContinuumException,
  ): Promise<ContinuumException>;
  setExceptionStatus(input: {
    exceptionType: ContinuumExceptionType;
    subjectKey: string;
    status: Exclude<ContinuumExceptionStatus, "open">;
    at: string;
  }): Promise<ContinuumException | null>;
  getException(
    exceptionType: ContinuumExceptionType,
    subjectKey: string,
  ): Promise<ContinuumException | null>;
  listObservations(): Promise<ContinuumObservation[]>;
  listEntities(): Promise<{ id: string; kind: string }[]>;
};
