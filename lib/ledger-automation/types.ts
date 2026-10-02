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
  sourceLocation: string;
  sourceType: "PUBLICATION" | "DATASET" | "INTERNAL_FIXTURE";
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
  sourceLocation: string;
  sourceType: LedgerSourceDefinition["sourceType"];
  checkedAt: string;
  observationTimestamp: string | null;
  rawObservation: string | null;
  normalizedObservation: NormalizedLedgerObservation | null;
  reliability: LedgerSourceDefinition["reliability"];
  required: boolean;
  freshness: SourceFreshness;
  failure: SourceFailure | null;
  contradictorySourceIds: readonly string[];
};

export type LedgerSourceAdapter = {
  adapterId: string;
  check(source: LedgerSourceDefinition, context: { runType: LedgerRunType; checkedAt: string }): Promise<LedgerSourceCheck>;
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
  schemaVersion: "ledger-automation-v1";
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
