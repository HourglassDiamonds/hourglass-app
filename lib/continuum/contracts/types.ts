/**
 * Continuum V1 domain contracts.
 * Persistence implements these types; this module must not import Supabase
 * or Agent OS Recommendation.
 */

export const CONTINUUM_CONTRACT_VERSION = "1.0.0" as const;
export const CONTINUUM_SCHEMA_VERSION = 1 as const;

export type ContinuumId = string;

export type EpistemicClass =
  | "observed"
  | "derived"
  | "inferred"
  | "speculative";

export const EPISTEMIC_CLASSES = [
  "observed",
  "derived",
  "inferred",
  "speculative",
] as const satisfies readonly EpistemicClass[];

export type ContinuumSourceSystem =
  | "studio-identified"
  | "studio-runtime"
  | "hubspot"
  | "ga4"
  | "gsc"
  | "concierge-sla"
  | "concierge-manual"
  | "agent-os"
  | "continuum"
  | "continuum-reconciliation-v3";

export const CONTINUUM_SOURCE_SYSTEMS = [
  "studio-identified",
  "studio-runtime",
  "hubspot",
  "ga4",
  "gsc",
  "concierge-sla",
  "concierge-manual",
  "agent-os",
  "continuum",
  "continuum-reconciliation-v3",
] as const satisfies readonly ContinuumSourceSystem[];

export type EvidenceSourceKind =
  | "source-record"
  | "event"
  | "analytics-query"
  | "document"
  | "computation"
  | "observation";

export const EVIDENCE_SOURCE_KINDS = [
  "source-record",
  "event",
  "analytics-query",
  "document",
  "computation",
  "observation",
] as const satisfies readonly EvidenceSourceKind[];

export type IdentityKind =
  | "hubspot_contact_id"
  | "email_hash"
  | "phone_hash"
  | "google_contact_id"
  | "import_row_key";

export const PERSON_IDENTITY_KINDS = [
  "hubspot_contact_id",
  "email_hash",
  "phone_hash",
  "google_contact_id",
  "import_row_key",
] as const satisfies readonly IdentityKind[];

export type EntityKind = "person" | "project" | "other";

export const ENTITY_KINDS = [
  "person",
  "project",
  "other",
] as const satisfies readonly EntityKind[];

export type FreshnessStatus = "fresh" | "stale" | "unknown" | "unavailable";
export type ReliabilityStatus =
  | "reliable"
  | "degraded"
  | "unverified"
  | "unavailable";
export type RedactionStatus = "clean" | "redacted" | "blocked";
export type Urgency = "critical" | "high" | "medium" | "low";
export type Materiality = "monitor" | "notable" | "material";

export type ContinuumEntity = {
  id: ContinuumId;
  kind: EntityKind;
  createdAt: string;
  createdBy: string;
};

export type ExternalIdentity = {
  id: ContinuumId;
  entityId: ContinuumId | null;
  sourceSystem: ContinuumSourceSystem;
  identityKind: IdentityKind;
  identifier: string;
  createdAt: string;
  revokedAt: string | null;
};

export type StudioViewEmailedPayload = {
  identifiedRecordId: string;
  sharePath: string;
  configuration: {
    shape: string;
    carat: number;
    ringSize: number;
    bandWidth: number;
    skinTone: string;
    orientation: string;
    metal: string;
  };
};

export type ContinuumEventType = "studio.view_emailed";

export type ContinuumEvent = {
  id: ContinuumId;
  schemaVersion: typeof CONTINUUM_SCHEMA_VERSION;
  eventType: ContinuumEventType;
  occurredAt: string;
  ingestedAt: string;
  producer: "diamond-studio-email-view";
  sourceSystem: "studio-identified";
  sourceRecordId: string;
  subjectEntityId: ContinuumId | null;
  idempotencyKey: string;
  payload: StudioViewEmailedPayload;
};

export type ContinuumEvidence = {
  id: ContinuumId;
  schemaVersion: typeof CONTINUUM_SCHEMA_VERSION;
  sourceSystem: ContinuumSourceSystem;
  sourceKind: EvidenceSourceKind;
  sourceRecordId: string | null;
  eventId: ContinuumId | null;
  observationId: ContinuumId | null;
  collectedAt: string;
  reportingPeriod: { start: string; end: string } | null;
  freshness: FreshnessStatus;
  reliability: ReliabilityStatus;
  redactionStatus: RedactionStatus;
  summary: string;
  supportingPointer: string | null;
  idempotencyKey: string;
  claimFingerprint: string | null;
};

/** JSON-safe primitive stored in jsonb (SQL json null / scalar). */
export type ContinuumJsonPrimitive = string | number | boolean | null;

/**
 * Recursive JSON-safe value stored on Observation.value (SQL jsonb).
 * Matches JSONB: primitive, array, or object. No Date, undefined, or class instances.
 */
export type ContinuumJsonValue =
  | ContinuumJsonPrimitive
  | readonly ContinuumJsonValue[]
  | { readonly [key: string]: ContinuumJsonValue };

export type ContinuumObservationValue = ContinuumJsonValue;

export type ContinuumObservation = {
  id: ContinuumId;
  schemaVersion: typeof CONTINUUM_SCHEMA_VERSION;
  observationType: string;
  subjectEntityId: ContinuumId | null;
  statement: string;
  value: ContinuumObservationValue;
  epistemicClass: EpistemicClass;
  confidence: number;
  producedBy: string;
  createdAt: string;
  validFrom: string;
  validUntil: string | null;
  supersedesId: ContinuumId | null;
  materiality: Materiality;
  urgency: Urgency;
};

export type ContinuumObservationEvidence = {
  observationId: ContinuumId;
  evidenceId: ContinuumId;
};

export type ContinuumExceptionType = "studio.identified_persistence_failed";

export type ContinuumExceptionStatus = "open" | "resolved" | "suppressed";

export type ContinuumException = {
  id: ContinuumId;
  exceptionType: ContinuumExceptionType;
  subjectKey: string;
  subjectEntityId: ContinuumId | null;
  status: ContinuumExceptionStatus;
  openedAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  detector: "studio-email-view";
  evidenceId: ContinuumId | null;
  payload: { emailsSent?: number };
};
