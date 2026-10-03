import type {
  SterlingConfidence,
  SterlingProposal,
  SterlingProposedAction,
} from "../types";

export const STERLING_LEDGER_VERSION = "sterling-proposal-ledger-v1" as const;

export const STERLING_PROPOSAL_STATUSES = [
  "proposed",
  "approved",
  "edited_and_approved",
  "rejected",
  "deferred",
  "executing",
  "executed",
  "failed",
  "superseded",
] as const;

export type SterlingProposalStatus = (typeof STERLING_PROPOSAL_STATUSES)[number];
export type SterlingFounderDecision = "approved" | "edited_and_approved" | "rejected" | "deferred";
export type SterlingExecutionStatus =
  | "not_requested"
  | "pending"
  | "executing"
  | "executed"
  | "failed"
  | "blocked_stale"
  | "blocked_unsupported";

export type SterlingProposalRecord = {
  proposalId: string;
  proposalType: SterlingProposal["kind"];
  status: SterlingProposalStatus;
  affectedEntityType: SterlingProposal["affectedEntity"]["kind"];
  affectedEntityId: string;
  currentStateFingerprint: string;
  currentStateSnapshot: unknown;
  entityVersion: string | null;
  originalProposal: SterlingProposal;
  evidenceRefs: readonly string[];
  reasoningSummary: string;
  confidence: SterlingConfidence;
  sourceWorkflow: string;
  sourceWatermark: string | null;
  provider: "openai";
  model: string;
  modelConfiguration: string;
  runId: string;
  traceId: string | null;
  founderDecision: SterlingFounderDecision | null;
  founderDecisionAt: string | null;
  founderDecisionNote: string | null;
  founderEditedPayload: SterlingProposedAction | null;
  deferUntil: string | null;
  canonicalMutationId: string | null;
  executedPayload: SterlingProposedAction | null;
  executionStatus: SterlingExecutionStatus;
  executionErrorCategory: string | null;
  supersededBy: string | null;
  replacesProposalId: string | null;
  createdAt: string;
  updatedAt: string;
  executedAt: string | null;
  ledgerVersion: typeof STERLING_LEDGER_VERSION;
  contractVersion: string;
  promptVersion: string;
};

export type CreateSterlingProposalInput = Omit<
  SterlingProposalRecord,
  | "status"
  | "founderDecision"
  | "founderDecisionAt"
  | "founderDecisionNote"
  | "founderEditedPayload"
  | "deferUntil"
  | "canonicalMutationId"
  | "executedPayload"
  | "executionStatus"
  | "executionErrorCategory"
  | "supersededBy"
  | "updatedAt"
  | "executedAt"
  | "ledgerVersion"
>;

export type SterlingDecisionInput = {
  decidedAt: string;
  note?: string | null;
};

export type SterlingLedgerResult =
  | { ok: true; record: SterlingProposalRecord; idempotent: boolean }
  | { ok: false; reason: "not-found" | "invalid-transition" | "decision-conflict" | "unavailable" };

export type SterlingProposalRepository = {
  create(input: CreateSterlingProposalInput): Promise<{ status: "created" | "already-present"; record: SterlingProposalRecord }>;
  get(proposalId: string): Promise<SterlingProposalRecord | null>;
  listActive(limit?: number): Promise<SterlingProposalRecord[]>;
  listForEntity(entityType: SterlingProposalRecord["affectedEntityType"], entityId: string): Promise<SterlingProposalRecord[]>;
  listRecentDecisions(limit?: number): Promise<SterlingProposalRecord[]>;
  recordApproval(proposalId: string, input: SterlingDecisionInput): Promise<SterlingLedgerResult>;
  recordEditAndApproval(proposalId: string, edited: SterlingProposedAction, input: SterlingDecisionInput): Promise<SterlingLedgerResult>;
  recordRejection(proposalId: string, input: SterlingDecisionInput): Promise<SterlingLedgerResult>;
  recordDefer(proposalId: string, deferUntil: string, input: SterlingDecisionInput): Promise<SterlingLedgerResult>;
  markExecuting(proposalId: string): Promise<SterlingLedgerResult>;
  markExecuted(proposalId: string, mutationId: string, payload: SterlingProposedAction, at: string): Promise<SterlingLedgerResult>;
  markFailed(proposalId: string, category: string, at: string): Promise<SterlingLedgerResult>;
  markUnsupported(proposalId: string, category: string, at: string): Promise<SterlingLedgerResult>;
  supersede(proposalId: string, replacementId: string | null, reason: string, at: string): Promise<SterlingLedgerResult>;
};
