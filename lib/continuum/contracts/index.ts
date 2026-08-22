export {
  CONTINUUM_CONTRACT_VERSION,
  CONTINUUM_SCHEMA_VERSION,
  CONTINUUM_SOURCE_SYSTEMS,
  ENTITY_KINDS,
  EPISTEMIC_CLASSES,
  EVIDENCE_SOURCE_KINDS,
  PERSON_IDENTITY_KINDS,
} from "./types";
export type {
  ContinuumEntity,
  ContinuumEvent,
  ContinuumEventType,
  ContinuumEvidence,
  ContinuumException,
  ContinuumExceptionStatus,
  ContinuumExceptionType,
  ContinuumId,
  ContinuumObservation,
  ContinuumObservationEvidence,
  ContinuumSourceSystem,
  EntityKind,
  EpistemicClass,
  EvidenceSourceKind,
  ExternalIdentity,
  FreshnessStatus,
  IdentityKind,
  Materiality,
  RedactionStatus,
  ReliabilityStatus,
  StudioViewEmailedPayload,
  Urgency,
} from "./types";

export {
  eventIdempotencyKey,
  studioIdentifiedRecordEvidenceIdempotencyKey,
  studioViewEmailedEventIdempotencyKey,
} from "./ids";

export {
  assertNoPii,
  findPiiViolation,
  isPersonIdentityKind,
  validateConfidence,
  validateEvidenceSourceRefs,
  validateExceptionPayload,
  validateIdentityKind,
  validateObservation,
} from "./validation";
export type { ContinuumValidation } from "./validation";
