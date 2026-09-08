/**
 * Ranking interface for the CoS operating loop.
 * Ranking recommends order. It does not create or mutate canonical work.
 *
 * Model: cos-operating-loop-rank-v1
 *
 * Factors (internal scores; never shown as numbers to the founder):
 * - overdue — explicit dueAt is earlier than now
 * - explicit_due — a due date exists
 * - due_soon — due within 7 days (not already overdue)
 * - founder_action — waiting on the founder (next required founder action)
 * - hourglass_action — waiting on Hourglass
 * - client_owed — client-originated work waiting on founder
 * - client_waiting — waiting on the client (lower than founder action)
 * - vendor_waiting — waiting on a vendor
 * - founder_commitment — Open Job kind is commitment
 * - blocked — Open Job kind is blocked_issue
 * - request_or_approval — request or approval kinds
 * - active_project — project is in Current Projects
 * - aging — untouched for 14+ days (founder/Hourglass work)
 * - waiting_duration — days since created, capped
 *
 * Stability: score desc, dueAt asc (missing last), createdAt asc, id asc.
 */

import { OPEN_JOB_DUE_SOON_MS, OPEN_JOB_STALE_MS } from "@/lib/continuum/client-memory/project-jobs/intelligence";
import type {
  ActionableRanker,
  ActionableWork,
  RankedActionable,
  RankingFactorHit,
  RankingFactorId,
} from "./types";

export const COS_RANKING_MODEL_ID = "cos-operating-loop-rank-v1" as const;

export const RANKING_FACTOR_LABELS: Record<RankingFactorId, string> = {
  overdue: "Past due",
  explicit_due: "Has a due date",
  due_soon: "Due soon",
  founder_action: "You're the next required action",
  hourglass_action: "Hourglass still owes this",
  client_owed: "Client is waiting",
  client_waiting: "Waiting on the client",
  vendor_waiting: "Waiting on the shop",
  founder_commitment: "Founder commitment",
  blocked: "Blocking another step",
  request_or_approval: "Client request or approval",
  active_project: "Active project",
  aging: "Quiet longer than expected",
  waiting_duration: "Aging",
};

const WEIGHT: Record<RankingFactorId, number> = {
  overdue: 400,
  blocked: 300,
  founder_action: 220,
  client_owed: 90,
  hourglass_action: 120,
  founder_commitment: 80,
  request_or_approval: 70,
  due_soon: 90,
  active_project: 60,
  aging: 50,
  explicit_due: 40,
  vendor_waiting: 30,
  client_waiting: 20,
  waiting_duration: 1,
};

function parseMs(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function collectFactors(item: ActionableWork, nowMs: number): RankingFactorHit[] {
  const hits: RankingFactorHit[] = [];
  const fire = (id: RankingFactorId) => {
    hits.push({ id, label: RANKING_FACTOR_LABELS[id] });
  };

  const dueMs = parseMs(item.dueAt);
  if (dueMs != null && dueMs < nowMs) fire("overdue");
  if (item.dueAt) fire("explicit_due");
  if (dueMs != null && dueMs >= nowMs && dueMs - nowMs <= OPEN_JOB_DUE_SOON_MS) {
    fire("due_soon");
  }

  if (item.waitingOnActor === "founder") fire("founder_action");
  if (item.waitingOnActor === "hourglass") fire("hourglass_action");
  if (item.waitingOnActor === "client") fire("client_waiting");
  if (item.waitingOnActor === "vendor") fire("vendor_waiting");

  if (
    item.waitingOnActor === "founder" &&
    (item.kind === "request" || item.kind === "approval" || item.kind === "question")
  ) {
    fire("client_owed");
  }

  if (item.kind === "commitment") fire("founder_commitment");
  if (item.kind === "blocked_issue") fire("blocked");
  if (item.kind === "request" || item.kind === "approval") fire("request_or_approval");
  if (item.isCurrentProject) fire("active_project");

  const touched = parseMs(item.updatedAt) ?? parseMs(item.createdAt);
  const ours =
    item.waitingOnActor === "founder" || item.waitingOnActor === "hourglass";
  if (ours && touched != null && nowMs - touched >= OPEN_JOB_STALE_MS) {
    fire("aging");
  }

  const created = parseMs(item.createdAt);
  if (created != null && nowMs > created) fire("waiting_duration");

  return hits;
}

function scoreOf(item: ActionableWork, factors: RankingFactorHit[], nowMs: number): number {
  let score = 0;
  for (const factor of factors) {
    if (factor.id === "waiting_duration") {
      const created = parseMs(item.createdAt);
      if (created == null) continue;
      const days = Math.min(30, Math.max(0, Math.floor((nowMs - created) / 86_400_000)));
      score += days * WEIGHT.waiting_duration;
      continue;
    }
    score += WEIGHT[factor.id];
  }
  return score;
}

function compareRanked(a: RankedActionable, b: RankedActionable): number {
  if (a.score !== b.score) return b.score - a.score;
  const aDue = parseMs(a.dueAt);
  const bDue = parseMs(b.dueAt);
  if (aDue != null && bDue != null && aDue !== bDue) return aDue - bDue;
  if (aDue != null && bDue == null) return -1;
  if (aDue == null && bDue != null) return 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id.localeCompare(b.id);
}

export function rankActionableWork(
  items: readonly ActionableWork[],
  nowIso: string,
): RankedActionable[] {
  const nowMs = Date.parse(nowIso);
  const clock = Number.isFinite(nowMs) ? nowMs : 0;
  const ranked: RankedActionable[] = items.map((item) => {
    const factors = collectFactors(item, clock);
    return {
      ...item,
      rankingModelId: COS_RANKING_MODEL_ID,
      score: scoreOf(item, factors, clock),
      factors,
    };
  });
  return ranked.sort(compareRanked);
}

export const DETERMINISTIC_ACTIONABLE_RANKER: ActionableRanker = {
  modelId: COS_RANKING_MODEL_ID,
  rank: rankActionableWork,
};
