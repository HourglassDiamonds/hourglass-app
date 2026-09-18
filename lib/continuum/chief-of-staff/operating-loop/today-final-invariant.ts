/**
 * Common final Today invariant. Historical persisted claims are revalidated
 * against current lifecycle, group truth, and type-safe conflict rules
 * immediately before Up Next ranking/render. Read-model only.
 */

import {
  isDesignStageActionText,
  isDesignStageSpecField,
  isPostCompletionObligationText,
  isProductionExceptionText,
  lifecycleAllowsHistoricalSpec,
  todayLifecycleClass,
} from "@/lib/continuum/candidates/today-lifecycle";
import type {
  CosAnomalyItem,
  CosBriefItem,
  CosDocketOrigin,
  CosFounderAttentionItem,
  CosOperatingLoopView,
  CosSpecConflictView,
  CosTop5Item,
} from "./types";

export type TodayInvariantItem = {
  origin: CosDocketOrigin;
  headline: string;
  context: string | null;
  brief: CosBriefItem | null;
  job: CosTop5Item | null;
  decision: CosFounderAttentionItem | null;
  anomaly: CosAnomalyItem | null;
};

export type TodayFinalInvariantContext = {
  lifecycleByProject?: ReadonlyMap<string, string | null> | null;
};

function projectIdOf(item: TodayInvariantItem): string | null {
  return (
    item.brief?.projectId ??
    item.job?.projectId ??
    item.decision?.projectId ??
    item.anomaly?.projectId ??
    null
  );
}

function lifecycleOf(
  item: TodayInvariantItem,
  ctx: TodayFinalInvariantContext,
): string | null {
  if (item.brief?.lifecycleStage) return item.brief.lifecycleStage;
  const projectId = projectIdOf(item);
  if (!projectId) return null;
  return ctx.lifecycleByProject?.get(projectId) ?? null;
}

function specOf(item: TodayInvariantItem): CosSpecConflictView | null {
  return item.brief?.specConflict ?? item.decision?.specConflict ?? null;
}

function haystackOf(item: TodayInvariantItem): string {
  return `${item.headline} ${item.context ?? ""} ${item.brief?.explanation ?? ""} ${item.brief?.recommended ?? ""}`;
}

function persistedSpecStillCurrent(
  spec: CosSpecConflictView,
  stage: string | null,
): boolean {
  if (!lifecycleAllowsHistoricalSpec(stage)) return false;
  if (spec.fieldName === "finger_size") {
    if (spec.sourceProvenance !== "EXACT") return false;
    return true;
  }
  if (isDesignStageSpecField(spec.fieldName) && spec.sourceProvenance === "UNKNOWN") {
    return false;
  }
  return true;
}

function waitingSuppressesAction(item: TodayInvariantItem, hay: string): boolean {
  const waiting = item.brief?.waitingState;
  if (item.brief?.staleInboundSatisfied && isDesignStageActionText(hay)) return true;
  if (item.brief?.noFounderAction && isDesignStageActionText(hay)) return true;
  if (
    (waiting === "cad" || waiting === "shop" || waiting === "production" || waiting === "client") &&
    isDesignStageActionText(hay)
  ) {
    return true;
  }
  return false;
}

/**
 * Every Up Next lane must prove a current founder-owned obligation.
 * Persisted briefs, jobs, anomalies, and decisions that fail this contract
 * are dropped — not rewritten into recap/conflict copy.
 */
export function isCurrentTodayDocketItem(
  item: TodayInvariantItem,
  ctx: TodayFinalInvariantContext = {},
): boolean {
  if (item.origin === "master_sprint") return true;

  const stage = lifecycleOf(item, ctx);
  const life = todayLifecycleClass(stage);
  const hay = haystackOf(item);
  const spec = specOf(item);

  if (life === "queued") return false;

  if (life === "terminal") {
    if (spec) return false;
    if (isDesignStageActionText(hay) && !isPostCompletionObligationText(hay)) {
      return false;
    }
    return isPostCompletionObligationText(hay);
  }

  if (spec && !persistedSpecStillCurrent(spec, stage)) {
    return false;
  }

  if (waitingSuppressesAction(item, hay)) return false;

  if (life === "production") {
    if (isDesignStageActionText(hay) && !isProductionExceptionText(hay)) return false;
    if (item.origin === "decision" && item.decision?.recap) return false;
    if (item.origin === "anomaly" && isDesignStageActionText(hay)) return false;
  }

  if (life === "cad" || life === "design") {
    if (item.origin === "decision" && item.decision?.recap) return false;
    if (
      /send the recap/i.test(item.headline) &&
      (item.brief?.noFounderAction || item.brief?.waitingState)
    ) {
      return false;
    }
  }

  if (item.origin === "open_job") {
    if (isDesignStageActionText(hay) && (life === "production" || life === "cad")) {
      return false;
    }
  }

  if (item.origin === "decision" && item.decision?.recap) {
    if (life === "production" || life === "cad") return false;
  }

  return true;
}

export function filterCurrentTodayDocketItems<T extends TodayInvariantItem>(
  items: readonly T[],
  loop: Pick<CosOperatingLoopView, "lifecycleByProject">,
): T[] {
  return items.filter((item) =>
    isCurrentTodayDocketItem(item, {
      lifecycleByProject: loop.lifecycleByProject,
    }),
  );
}
