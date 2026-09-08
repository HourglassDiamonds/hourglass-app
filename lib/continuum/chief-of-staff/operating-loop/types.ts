/**
 * Founder-facing Chief of Staff operating loop V1.
 * Top 5 is a ranked view over canonical Open Jobs — not a second task store.
 * Ranking never writes canonical truth.
 */

import type { OpenJobActor, OpenJobKind, ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";

export const COS_OPERATING_LOOP_CONTRACT_VERSION = "cos-operating-loop-v1" as const;

export const COS_TOP_5_LIMIT = 5 as const;

export const COS_COMPLETION_WRITERS = ["open_job.resolve"] as const;

export type CosCompletionWriter = (typeof COS_COMPLETION_WRITERS)[number];

export const ACTIONABLE_SOURCE_TYPES = ["open_job"] as const;

export type ActionableSourceType = (typeof ACTIONABLE_SOURCE_TYPES)[number];

export type ActionableWork = {
  id: string;
  sourceType: ActionableSourceType;
  job: ProjectJob;
  projectId: string;
  projectTitle: string;
  personName: string | null;
  isCurrentProject: boolean;
  kind: OpenJobKind;
  waitingOnActor: OpenJobActor;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  action: string;
};

export const RANKING_FACTOR_IDS = [
  "overdue",
  "explicit_due",
  "due_soon",
  "founder_action",
  "hourglass_action",
  "client_owed",
  "client_waiting",
  "vendor_waiting",
  "founder_commitment",
  "blocked",
  "request_or_approval",
  "active_project",
  "aging",
  "waiting_duration",
] as const;

export type RankingFactorId = (typeof RANKING_FACTOR_IDS)[number];

export type RankingFactorHit = {
  id: RankingFactorId;
  label: string;
};

export type RankedActionable = ActionableWork & {
  rankingModelId: string;
  /** Internal only. Never shown to the founder. */
  score: number;
  factors: RankingFactorHit[];
};

export type ActionableRanker = {
  modelId: string;
  rank(items: readonly ActionableWork[], nowIso: string): RankedActionable[];
};

export type CosTop5Item = {
  id: string;
  sourceType: ActionableSourceType;
  action: string;
  clientLabel: string | null;
  projectTitle: string;
  projectId: string;
  ownership: string;
  timing: string;
  why: string;
  accordionHref: string;
  jobHref: string;
  completable: boolean;
  writer: CosCompletionWriter | null;
  mutationId: string;
};

export type CosRecapKind =
  | "likely-complete"
  | "ambiguous-complete"
  | "approved-follow-up-without-job";

export type CosRecapItem = {
  id: string;
  kind: CosRecapKind;
  question: string;
  sourceLabel: string;
  sourceHref: string;
  matchedText: string | null;
  jobId: string | null;
  projectId: string | null;
  projectTitle: string | null;
  completable: boolean;
  writer: CosCompletionWriter | null;
  mutationId: string | null;
};

export type CosAnomalyKind =
  | "contradicts-completion"
  | "overdue-no-action"
  | "stalled-founder"
  | "client-responded"
  | "vendor-evidence";

export type CosAnomalyItem = {
  id: string;
  kind: CosAnomalyKind;
  headline: string;
  detail: string;
  sourceLabel: string | null;
  sourceHref: string | null;
  jobId: string | null;
  projectId: string | null;
};

export type CosOperatingLoopStatus = "caught-up" | "active" | "disconnected";

export type CosOperatingLoopView = {
  contractVersion: typeof COS_OPERATING_LOOP_CONTRACT_VERSION;
  status: CosOperatingLoopStatus;
  heading: string;
  quietDetail: string | null;
  top5: CosTop5Item[];
  remainingCount: number;
  recap: CosRecapItem[];
  anomalies: CosAnomalyItem[];
};

export type CosProjectContext = {
  projectId: string;
  title: string;
  personName: string | null;
  people?: ReadonlyArray<{ personId: string; displayName: string }>;
  isCurrent: boolean;
};
