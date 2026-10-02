import type { LedgerIndexId } from "@/app/ledger/ledger-data";
import type {
  ConfidenceLevel,
  SystemTemperatureSnapshot,
  TemperatureChannelId,
} from "@/app/ledger/system-temperature";
import type {
  BufferDomainId,
  BufferReserveState,
} from "@/app/ledger/buffer-health-data";

export const LEDGER_AUTOMATION_MODE = "APPROVAL_ONLY" as const;

export type LedgerRunType = "TUESDAY_FULL" | "FRIDAY_DELTA";
export type LedgerRunClassification = "NO_CHANGE" | "SAFE_UPDATE" | "APPROVAL_REQUIRED";
export type LedgerRunState =
  | "CREATED"
  | "FETCHING"
  | "ANALYZING"
  | "DRAFTED"
  | "NO_CHANGE"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "PUBLISHED"
  | "FAILED";

export type SourceFreshness = "CURRENT" | "STALE" | "UNKNOWN";
export type SourceFailure = { code: string; message: string; retryable: boolean };
export type LedgerSourceMode = "LIVE" | "MANUAL_APPROVED" | "DERIVED" | "DISABLED";
export type LedgerSourceStatus =
  | "OK"
  | "STALE"
  | "UNAVAILABLE"
  | "INVALID"
  | "RATE_LIMITED"
  | "AUTH_REQUIRED"
  | "MANUAL_REVIEW_REQUIRED";
export type LedgerLiveProvider =
  | "BEA_PERSONAL_INCOME"
  | "BLS_EMPLOYMENT"
  | "BLS_JOLTS"
  | "EIA_PETROLEUM"
  | "EIA_STEO"
  | "EIA_ELECTRICITY"
  | "TREASURY_YIELD_CURVE"
  | "FRED_HIGH_YIELD_OAS"
  | "FRED_FINANCIAL_STRESS";

export type NormalizedLedgerObservation = {
  summary: string;
  proposedMonitorState?: string;
  proposedBufferState?: BufferReserveState;
  proposedTemperatureChannel?: {
    channelId: TemperatureChannelId;
    pressure: SystemTemperatureSnapshot["channels"][number]["pressure"];
    transmission: SystemTemperatureSnapshot["channels"][number]["transmission"];
    explanation: string;
    coolingNotes: string;
  };
  significance: "NONE" | "MINOR" | "MATERIAL";
};

export type LedgerSourceDefinition = {
  sourceId: string;
  monitorId: LedgerIndexId;
  bufferDomainId?: BufferDomainId;
  sourceName: string;
  sourceAuthority: string;
  sourceLocation: string;
  sourceUrl: string;
  sourceType: "PUBLICATION" | "DATASET" | "INTERNAL_FIXTURE";
  sourceMode: LedgerSourceMode;
  liveProvider?: LedgerLiveProvider;
  accessMethod: string;
  updateFrequency: string;
  credentialEnv?: "BEA_API_KEY" | "EIA_API_KEY" | "FRED_API_KEY";
  reliability: "HIGH" | "MODERATE" | "LOW";
  required: boolean;
  maxAgeDays: number;
  lastChecked: string;
  baselineObservationTimestamp: string;
  baselineRawObservation: string;
  baselineNormalizedObservation: NormalizedLedgerObservation;
};

export type LedgerSourceCheck = {
  sourceId: string;
  monitorId: LedgerIndexId;
  bufferDomainId?: BufferDomainId;
  sourceName: string;
  sourceAuthority: string;
  sourceLocation: string;
  sourceUrl: string;
  sourceType: LedgerSourceDefinition["sourceType"];
  sourceMode: LedgerSourceMode;
  checkedAt: string;
  fetchedAt: string;
  observationTimestamp: string | null;
  rawObservation: string | null;
  rawValue: unknown;
  rawPayload: unknown;
  normalizedObservation: NormalizedLedgerObservation | null;
  normalizedValue: unknown;
  unit: string | null;
  reliability: LedgerSourceDefinition["reliability"];
  confidence: LedgerSourceDefinition["reliability"];
  required: boolean;
  freshness: SourceFreshness;
  sourceFreshness: SourceFreshness;
  status: LedgerSourceStatus;
  failure: SourceFailure | null;
  failureReason: string | null;
  metadata: Readonly<Record<string, unknown>>;
  contradictorySourceIds: readonly string[];
};

export type LedgerAdapterContext = {
  runType: LedgerRunType;
  checkedAt: string;
  runId?: string;
};

export type LedgerSourceAdapter = {
  adapterId: string;
  check(source: LedgerSourceDefinition, context: LedgerAdapterContext): Promise<LedgerSourceCheck>;
};

export type MonitorProposal = {
  monitorId: Exclude<LedgerIndexId, "buffer-health">;
  previousState: string;
  proposedState: string;
  changeExplanation: string;
  confidence: "HIGH" | "MODERATE" | "LOW";
  supportingSourceIds: readonly string[];
  contradictorySourceIds: readonly string[];
  materialChange: boolean;
};

export type BufferProposal = {
  domainId: BufferDomainId;
  previousState: BufferReserveState;
  proposedState: BufferReserveState;
  changeExplanation: string;
  confidence: "HIGH" | "MODERATE" | "LOW";
  supportingSourceIds: readonly string[];
  materialChange: boolean;
};

export type TemperatureProposal = {
  previousDegrees: number;
  proposedDegrees: number;
  previousState: string;
  proposedState: string;
  previousConfidence: ConfidenceLevel;
  proposedConfidence: ConfidenceLevel;
  snapshot: SystemTemperatureSnapshot;
  validationIssues: readonly { severity: "error" | "warning"; code: string; message: string }[];
};

export type LedgerPublicationPreview = {
  proposedDate: string;
  proposedTemperature: number;
  proposedState: string;
  proposedConfidence: ConfidenceLevel;
  proposedMonitorChanges: readonly MonitorProposal[];
  proposedBufferHealthChanges: readonly BufferProposal[];
  whatChanged: readonly string[];
  evidenceReferences: readonly string[];
};

export type LedgerEvidencePacket = {
  schemaVersion: "ledger-automation-v1" | "ledger-automation-v1.1";
  runId: string;
  runKey: string;
  runType: LedgerRunType;
  startedAt: string;
  completedAt: string;
  sourceChecks: readonly LedgerSourceCheck[];
  sourceFailures: readonly LedgerSourceCheck[];
  monitorObservations: readonly MonitorProposal[];
  bufferHealthChanges: readonly BufferProposal[];
  overallTemperature: TemperatureProposal;
  reasons: readonly string[];
  publicationRecommendation: LedgerRunClassification;
};

export type LedgerAutomationRunRecord = {
  schemaVersion: "ledger-run-v1";
  runId: string;
  runKey: string;
  runType: LedgerRunType;
  scheduledDate: string;
  createdAt: string;
  completedAt: string;
  state: LedgerRunState;
  stateHistory: readonly { state: LedgerRunState; at: string }[];
  classification: LedgerRunClassification;
  theoreticalAutoPublishEligible: boolean;
  mode: typeof LEDGER_AUTOMATION_MODE;
  evidencePacket: LedgerEvidencePacket;
  proposedPublication: LedgerPublicationPreview;
  founderApproval: null;
  publicationOccurred: false;
  publicationId: null;
  publicationDate: null;
};

export type FounderDecision = "APPROVE" | "REJECT" | "NEEDS_REVIEW";
export type FounderDecisionRecord = {
  schemaVersion: "ledger-founder-decision-v1";
  decisionId: string;
  runKey: string;
  decision: FounderDecision;
  decidedAt: string;
  decidedBy: string;
  note: string | null;
  resultingState: "APPROVED" | "REJECTED" | "AWAITING_APPROVAL";
};
