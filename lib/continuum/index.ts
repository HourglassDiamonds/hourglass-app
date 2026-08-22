/**
 * Continuum V1 kernel — server-only.
 * Does not mutate Agent OS, HubSpot, GA4, GSC, or founder cadence.
 */

export {
  CONTINUUM_CONTRACT_VERSION,
  CONTINUUM_SCHEMA_VERSION,
  PERSON_IDENTITY_KINDS,
} from "./contracts";
export type {
  ContinuumEvent,
  ContinuumEvidence,
  ContinuumException,
  ContinuumObservation,
} from "./contracts";
export { InMemoryContinuumStore, tryCreateContinuumStore } from "./persistence";
export type { ContinuumStore } from "./persistence";
export {
  ingestStudioViewEmailed,
  ingestStudioViewEmailedBestEffort,
  recordIdentifiedPersistenceFailedBestEffort,
} from "./ingest";
export { reconcileStudioIdentifiedEvents } from "./reconcile";
