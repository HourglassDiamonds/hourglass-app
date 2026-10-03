import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type {
  OpenJobActor,
  OpenJobKind,
  ProjectJob,
} from "@/lib/continuum/client-memory/project-jobs/types";
import type { ConditionalHoldCondition } from "./holds/types";

export const STERLING_CONTRACT_VERSION = "sterling-v1" as const;
export const STERLING_PROMPT_VERSION = "sterling-grounding-v1" as const;

export type SterlingOwner = "founder" | "client" | "shop" | "unknown";
export type SterlingConfidence = "high" | "medium" | "low";

export type SterlingTodayItem = {
  id: string;
  title: string;
  why: string;
  projectId: string | null;
  projectTitle: string | null;
  personName: string | null;
  owner: SterlingOwner;
  state: string;
  proposedNextAction: string | null;
  dueAt: string | null;
  sourceRefs: readonly string[];
  authoritative: boolean;
  clientFacing: boolean;
  productionBlocker: boolean;
};

export type SterlingTruth = {
  generatedAt: string;
  sourceWatermark: string | null;
  sourceStatus: "current" | "refreshing" | "disconnected";
  today: readonly SterlingTodayItem[];
  openJobs: readonly ProjectJob[];
  candidates: readonly ContinuumCandidate[];
  anomalies: readonly {
    id: string;
    kind: string;
    headline: string;
    detail: string;
    jobId: string | null;
    projectId: string | null;
    sourceRefs: readonly string[];
  }[];
};

export type SterlingPriority = {
  id: string;
  title: string;
  whyNow: string;
  evidenceSummary: string;
  urgencyReason: string;
  owner: SterlingOwner;
  state: string;
  proposedNextAction: string;
  confidence: SterlingConfidence;
  sourceRefs: readonly string[];
  canonicalIds: readonly string[];
};

export type SterlingProposalKind =
  | "job_update"
  | "priority_change"
  | "due_date"
  | "waiting_state"
  | "duplicate_merge"
  | "stale_resolution"
  | "new_projectless_job"
  | "follow_up"
  | "conditional_hold";

export type SterlingProposedAction =
  | {
      kind: "update_job";
      projectId: string | null;
      jobId: string;
      expectedUpdatedAt: string;
      waitingOnActor?: OpenJobActor;
      dueAt?: string | null;
    }
  | {
      kind: "create_projectless_job";
      candidateId: string;
      jobKind: OpenJobKind;
      subject: string;
      detail: string | null;
      waitingOnActor: OpenJobActor;
      dueAt: string | null;
      sourceRef: string;
    }
  | {
      kind: "activate_hold";
      holdId: string;
      projectId: string | null;
      jobId: string;
      expectedUpdatedAt: string;
      reason: string;
      condition: ConditionalHoldCondition;
      sourceRefs: readonly string[];
    }
  | { kind: "unsupported"; reason: string };

export type SterlingProposal = {
  proposalId: string;
  kind: SterlingProposalKind;
  affectedEntity: { kind: "job" | "candidate" | "project"; id: string };
  currentState: string;
  proposedState: string;
  reason: string;
  evidence: readonly string[];
  expectedDownstreamEffect: string;
  status: "review-required";
  canApplyWithExistingWriter: boolean;
  confidence: SterlingConfidence;
  currentStateFingerprint: string;
  currentStateSnapshot: unknown;
  proposedAction: SterlingProposedAction;
  persistence: "pending" | "persisted" | "not-activated" | "unavailable";
};

export type SterlingFinding = {
  id: string;
  kind: "stale" | "conflict" | "duplicate" | "orphan" | "gap" | "uncertainty";
  title: string;
  whyItMatters: string;
  evidence: readonly string[];
  sourceRefs: readonly string[];
  proposedFix: string;
  proposal: SterlingProposal | null;
};

export type SterlingPreferenceSignal = {
  key: string;
  description: string;
  supportingDecisionCount: number;
  confidence: SterlingConfidence;
  reviewable: true;
};

export type SterlingRunTelemetry = {
  contractVersion: typeof STERLING_CONTRACT_VERSION;
  model: string;
  modelConfiguration: string;
  promptVersion: typeof STERLING_PROMPT_VERSION;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  estimatedCostUsd: number | null;
  toolsInvoked: readonly string[];
  proposalCount: number;
  failures: readonly string[];
  fallback: "deterministic" | "none";
  runId: string;
  provider: "openai";
};

export type SterlingResponse = {
  kind: "next-three" | "missing" | "waiting" | "captures" | "changed" | "conditional-hold";
  headline: string;
  summary: string;
  priorities: readonly SterlingPriority[];
  findings: readonly SterlingFinding[];
  proposals: readonly SterlingProposal[];
  preferences: readonly SterlingPreferenceSignal[];
  uncertainty: readonly string[];
  telemetry: SterlingRunTelemetry;
  ledgerStatus: "not-applicable" | "persisted" | "not-activated" | "unavailable";
};
