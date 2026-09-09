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
  editHref: string;
};

export type CosProposedAction = {
  id: string;
  candidateId: string;
  sourceId: string | null;
  headline: string;
  sourceLabel: string;
  sourceHref: string;
  projectId: string | null;
  projectTitle: string | null;
  canAddToActions: boolean;
  canDismiss: boolean;
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

export {
  FOUNDER_ATTENTION_LANES,
  type FounderAttentionLane,
} from "@/lib/continuum/candidates/founder-attention";

export type CosFounderAttentionItem = {
  id: string;
  lane: "decision" | "signal";
  title: string;
  headline: string;
  detail: string | null;
  projectId: string | null;
  projectTitle: string | null;
  sourceLabel: string | null;
  sourceHref: string | null;
  candidateIds: readonly string[];
  recap: CosRecapItem | null;
  proposedAction: CosProposedAction | null;
};

export const COS_MODERATOR_MODEL_ID = "cos-executive-moderator-v1" as const;

export const COS_BRIEF_LIMIT = 5 as const;

export const BRIEF_RANK_CLASSES = [
  "deadline_risk",
  "founder_commitment",
  "production_blocker",
  "client_reply",
  "state_transition",
  "new_opportunity",
  "follow_up",
  "informational",
] as const;

export type CosBriefRankClass = (typeof BRIEF_RANK_CLASSES)[number];

export const BRIEF_ACTION_KINDS = [
  "open_project",
  "open_email",
  "add_to_top5",
  "confirm_person",
  "create_project",
  "review_evidence",
] as const;

export type CosBriefActionKind = (typeof BRIEF_ACTION_KINDS)[number];

export type CosBriefSpeaker = "founder" | "client" | "vendor" | "system";

export type CosBriefAction = {
  kind: CosBriefActionKind;
  label: string;
  href: string | null;
};

export type CosEvidenceBeat = {
  at: string;
  label: string;
  summary: string;
  speaker: CosBriefSpeaker;
  sourceHref: string | null;
  candidateId: string;
};

export type CosBriefItem = {
  id: string;
  rank: number;
  rankClass: CosBriefRankClass;
  personLabel: string | null;
  projectTitle: string | null;
  projectId: string | null;
  headline: string;
  explanation: string;
  recommended: string;
  stateLabel: string | null;
  urgencyLabel: string | null;
  actions: readonly CosBriefAction[];
  evidence: readonly CosEvidenceBeat[];
  openJobLabel: string | null;
  projectStateLabel: string | null;
  candidateIds: readonly string[];
  proposedAction: CosProposedAction | null;
};

export type CosWatchingItem = {
  id: string;
  title: string;
  detail: string;
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
  brief: CosBriefItem[];
  watching: CosWatchingItem[];
  needsYourDecision: CosFounderAttentionItem[];
  worthKnowing: CosFounderAttentionItem[];
  recap: CosRecapItem[];
  anomalies: CosAnomalyItem[];
  proposedActions: CosProposedAction[];
};

export type CosProjectPerson = {
  personId: string;
  displayName: string;
  role?: string | null;
};

export type CosProjectSpec = {
  fieldName: string;
  value: string;
};

export type CosProjectContext = {
  projectId: string;
  title: string;
  personName: string | null;
  people?: ReadonlyArray<CosProjectPerson>;
  isCurrent: boolean;
  lifecycleStage?: string | null;
  specs?: ReadonlyArray<CosProjectSpec>;
};
