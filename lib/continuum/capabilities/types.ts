/**
 * Universal specialist Capability protocol.
 * Domain-neutral. No persistence client, executive ranking, or model coupling.
 */

import type {
  ContinuumEvidence,
  ContinuumId,
  ContinuumJsonPrimitive,
  ContinuumJsonValue,
  ContinuumObservation,
  ContinuumObservationEvidence,
  EpistemicClass,
  FreshnessStatus,
  Materiality,
  Urgency,
} from "../contracts/types";

export const CAPABILITY_CONTRACT_VERSION = "1.0.0" as const;

export type CapabilityId = string;

export type CapabilityDomain =
  | "studio"
  | "search"
  | "client-ops"
  | "website"
  | "finance"
  | "communications"
  | "other";

export const CAPABILITY_DOMAINS = [
  "studio",
  "search",
  "client-ops",
  "website",
  "finance",
  "communications",
  "other",
] as const satisfies readonly CapabilityDomain[];

export type CapabilityRunStatus =
  | "completed"
  | "completed-degraded"
  | "blocked"
  | "failed";

export type CapabilitySourceAvailability =
  | "available"
  | "empty"
  | "unavailable"
  | "not-configured";

export type CapabilitySourceQuality = "healthy" | "degraded" | "unknown";

export type CapabilityDefinition = {
  capabilityId: CapabilityId;
  contractVersion: typeof CAPABILITY_CONTRACT_VERSION;
  capabilityVersion: string;
  domain: CapabilityDomain;
  requiredSources: readonly string[];
  allowedObservationTypes: readonly string[];
  reads: readonly string[];
  producesObservations: boolean;
};

export type CapabilityTimeWindow = {
  start: string;
  end: string;
};

export type CapabilityInvocation = {
  invocationId: string;
  capabilityId: CapabilityId;
  requestedAt: string;
  asOf: string;
  mode: "fixture" | "live";
  window?: CapabilityTimeWindow;
};

export type CapabilityContext = {
  invocation: CapabilityInvocation;
  now: () => Date;
  log: {
    info(
      event: string,
      fields?: Record<string, string | number | boolean | null>,
    ): void;
    warn(
      event: string,
      fields?: Record<string, string | number | boolean | null>,
    ): void;
  };
};

export type CapabilitySourceHealth = {
  sourceId: string;
  required: boolean;
  availability: CapabilitySourceAvailability;
  quality: CapabilitySourceQuality;
  freshness: FreshnessStatus;
  note: string;
};

export type JsonPrimitive = ContinuumJsonPrimitive;
export type JsonValue = ContinuumJsonValue;

export type ObservationDraft<V extends JsonValue = JsonValue> = {
  observationType: string;
  subjectEntityId: ContinuumId | null;
  statement: string;
  value: V;
  epistemicClass: EpistemicClass;
  confidence: number;
  evidenceRefs: [ContinuumId, ...ContinuumId[]];
  validFrom?: string;
  validUntil?: string | null;
  materiality: Materiality;
  urgency: Urgency;
};

export type CapabilityDiagnostic = {
  capabilityVersion: string;
  inputFingerprint?: string;
  notes: string[];
  model?: { provider: string; model: string; promptVersion: string };
};

export type CapabilityResult<V extends JsonValue = JsonValue> = {
  status: CapabilityRunStatus;
  observations: ObservationDraft<V>[];
  sourceHealth: CapabilitySourceHealth[];
  failureCode?: string;
  diagnostics: CapabilityDiagnostic;
};

export type Capability<I, V extends JsonValue = JsonValue> = {
  definition: CapabilityDefinition;
  run(input: I, context: CapabilityContext): Promise<CapabilityResult<V>>;
  validateObservationValue(observationType: string, value: JsonValue): value is V;
};

export type EvidenceLookup = {
  getById(id: string): Promise<ContinuumEvidence | null>;
};

export type ObservationPersistPort = {
  insertObservation(
    observation: ContinuumObservation,
  ): Promise<unknown>;
  linkObservationEvidence(
    link: ContinuumObservationEvidence,
  ): Promise<unknown>;
};

export type ExecuteCapabilityInput<I, V extends JsonValue = JsonValue> = {
  capability: Capability<I, V>;
  domainInput: I;
  context: CapabilityContext;
  evidence?: EvidenceLookup;
  persist?: ObservationPersistPort;
};
