import type {
  BufferDomainId,
  BufferReserveState,
} from "@/app/ledger/buffer-health-data";
import type {
  LedgerEvidenceSource,
} from "@/app/ledger/ledger-monitor-framework";
import type { LedgerIndexId } from "@/app/ledger/ledger-data";
import type {
  ConfidenceLevel,
  SystemTemperatureSnapshot,
} from "@/app/ledger/system-temperature";
import type {
  FounderDecisionRecord,
  LedgerRunClassification,
  LedgerRunType,
  LedgerSourceStatus,
} from "./types";

export const LEDGER_MONITOR_IDS = [
  "global-pressure",
  "ai-capability",
  "precious-materials",
  "infrastructure-strain",
  "global-water-stress",
  "information-signal",
] as const satisfies readonly Exclude<LedgerIndexId, "buffer-health">[];

export const LEDGER_BUFFER_DOMAIN_IDS = [
  "households",
  "labor",
  "food",
  "energy",
  "grid",
  "financial-system",
] as const satisfies readonly BufferDomainId[];

export type LedgerPublicationStatus =
  | "DRAFTED"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "PUBLICATION_FAILED";

export type LedgerPublicationMonitor = {
  id: (typeof LEDGER_MONITOR_IDS)[number];
  publicationDate: string;
  evidenceReviewedThrough: string;
  state: string;
  direction: string;
  /** Deliberately duplicated surface values; validation prevents hub drift. */
  hubState: string;
  hubDirection: string;
  hubSummary: string;
  summary: string;
  supportingEvidence: readonly string[];
  counterEvidence: readonly string[];
  watchItems: readonly string[];
  sourceReferences: readonly LedgerEvidenceSource[];
};

export type LedgerPublicationBufferDomain = {
  id: (typeof LEDGER_BUFFER_DOMAIN_IDS)[number];
  publicationDate: string;
  evidenceReviewedThrough: string;
  state: BufferReserveState;
  direction: string | null;
  rationale: string;
  supportingEvidence: readonly string[];
  counterEvidence: readonly string[];
  sourceReferences: readonly LedgerEvidenceSource[];
};

export type LedgerPublicationAudit = {
  sourceHealthSummary: Readonly<Record<LedgerSourceStatus, number>>;
  classification: LedgerRunClassification;
  approvalRequired: boolean;
  founderDecision: FounderDecisionRecord | null;
  publicationStatus: LedgerPublicationStatus;
  methodologyChanged: boolean;
  materiallyNewNarrativeClaim: boolean;
  requiredSourceFailure: boolean;
  validationWarnings: readonly string[];
};

export type LedgerPublication = {
  schemaVersion: "ledger-publication-v2";
  publicationId: string;
  publicationDate: string;
  evidenceReviewedThrough: string;
  createdAt: string;
  approvedAt: string;
  publishedAt: string;
  runId: string;
  runType: LedgerRunType;
  previousPublicationId: string | null;
  overall: {
    temperature: number;
    qualitativeState: string;
    systemicDirection: string;
    confidence: ConfidenceLevel;
    ledgerNote: string;
    synopsis: string;
    whatChanged: readonly string[];
    temperatureSnapshot: SystemTemperatureSnapshot;
  };
  monitors: readonly LedgerPublicationMonitor[];
  bufferHealth: {
    publicationDate: string;
    evidenceReviewedThrough: string;
    state: string;
    direction: string;
    summary: string;
    functioningQualifier: string;
    domains: readonly LedgerPublicationBufferDomain[];
  };
  historicalComparison: {
    previousPublicationId: string | null;
    previousPublicationDate: string | null;
    temperatureDelta: number | null;
  };
  audit: LedgerPublicationAudit;
};

export type LedgerPublicationPointer = {
  schemaVersion: "ledger-publication-pointer-v1";
  currentPublicationId: string;
  previousPublicationId: string | null;
  updatedAt: string;
};

export type LedgerPublicationEvent = {
  schemaVersion: "ledger-publication-event-v1";
  eventId: string;
  publicationId: string;
  runId: string;
  status: "PUBLISHING" | "PUBLISHED" | "PUBLICATION_FAILED";
  occurredAt: string;
  detail: string;
};
