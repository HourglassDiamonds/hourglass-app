/**
 * Common final Today invariant. Historical persisted claims are revalidated
 * against current lifecycle, recovered Gmail chronology, and type-safe
 * conflict rules immediately before Up Next ranking/render. Read-model only.
 */

import {
  isDesignStageActionText,
  isDesignStageSpecField,
  isPostCompletionObligationText,
  isProductionExceptionText,
  lifecycleAllowsHistoricalSpec,
  todayLifecycleClass,
} from "@/lib/continuum/candidates/today-lifecycle";
import {
  isActionableSystemAlert,
  isNonActionableSystemMail,
  isPromotionalSenderInfrastructure,
  isRecoverableExternalHumanSender,
  type TodayGmailThreadContext,
} from "@/lib/continuum/candidates/founder-attention";
import { reconcileGroupTruthState } from "./thread-truth";
import type { TodayBriefingPacket } from "./briefing-packet";
import type {
  CosAnomalyItem,
  CosBriefItem,
  CosDocketOrigin,
  CosFounderAttentionItem,
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
  briefingPacket?: TodayBriefingPacket | null;
};

export type TodayFinalInvariantContext = {
  lifecycleByProject?: ReadonlyMap<string, string | null> | null;
  lifecycleByGmailThread?: ReadonlyMap<string, string | null> | null;
  associatedGmailThreadsByProject?: ReadonlyMap<string, readonly string[]> | null;
  threadContext?: ReadonlyMap<string, TodayGmailThreadContext> | null;
  founderEmailHashes?: readonly string[] | null;
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

function recoveredThreadIdOf(item: TodayInvariantItem): string | null {
  return (
    item.brief?.canonicalGmailThreadId?.trim() ||
    item.brief?.recoveredGmailThreadId?.trim() ||
    null
  );
}

function lifecycleOf(
  item: TodayInvariantItem,
  ctx: TodayFinalInvariantContext,
): string | null {
  if (item.brief?.lifecycleStage) return item.brief.lifecycleStage;
  const projectId = projectIdOf(item);
  if (projectId) {
    const fromProject = ctx.lifecycleByProject?.get(projectId);
    if (fromProject) return fromProject;
  }
  const threadId = recoveredThreadIdOf(item);
  if (threadId) return ctx.lifecycleByGmailThread?.get(threadId) ?? null;
  return null;
}

function specOf(item: TodayInvariantItem): CosSpecConflictView | null {
  return item.brief?.specConflict ?? item.decision?.specConflict ?? null;
}

function haystackOf(item: TodayInvariantItem): string {
  return `${item.headline} ${item.context ?? ""} ${item.brief?.explanation ?? ""} ${item.brief?.recommended ?? ""}`;
}

function recoveredThreadOf(
  item: TodayInvariantItem,
  ctx: TodayFinalInvariantContext,
): TodayGmailThreadContext | null {
  const threadId = recoveredThreadIdOf(item);
  if (!threadId) return null;
  return ctx.threadContext?.get(threadId) ?? null;
}

function recoveredChronology(
  item: TodayInvariantItem,
  ctx: TodayFinalInvariantContext,
) {
  const thread = recoveredThreadOf(item, ctx);
  const threadId = recoveredThreadIdOf(item);
  const projectId = projectIdOf(item);
  const associated = projectId
    ? (ctx.associatedGmailThreadsByProject?.get(projectId) ?? null)
    : null;
  if (!thread?.messages?.length && !associated?.length) return null;
  return reconcileGroupTruthState({
    key: threadId ? `thread:${threadId}` : projectId ? `project:${projectId}` : "thread:",
    rows: [],
    threadContext: ctx.threadContext,
    founderEmailHashes: ctx.founderEmailHashes,
    associatedThreadIds: associated,
  });
}

function isRecapOrDesignReply(item: TodayInvariantItem, hay: string): boolean {
  return (
    isDesignStageActionText(hay) ||
    /identify who this is from/i.test(item.headline) ||
    /send the recap|your turn|answered a design question|latest meaningful turn is theirs/i.test(
      hay,
    )
  );
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
  if (item.briefingPacket?.authoritative && item.briefingPacket.ballHolder === "founder") {
    return false;
  }
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

function promotionalIdentityFailsClosed(
  item: TodayInvariantItem,
  ctx: TodayFinalInvariantContext,
): boolean {
  const thread = recoveredThreadOf(item, ctx);
  const hay = haystackOf(item);
  if (isActionableSystemAlert({ thread })) return false;
  if (
    isPromotionalSenderInfrastructure({
      fromEmail: thread?.fromEmail,
      fromDisplayName: thread?.fromDisplayName,
      haystack: hay,
    })
  ) {
    return true;
  }
  if (
    isNonActionableSystemMail({
      thread,
    })
  ) {
    return true;
  }
  const confirm = item.brief?.actions.some((action) => action.kind === "confirm_person") ?? false;
  const identityGap =
    confirm || /identify who this is from/i.test(item.headline);
  if (!identityGap) return false;
  if (thread?.liveIdentityLoaded === true) {
    return !isRecoverableExternalHumanSender({ thread, haystack: hay });
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
  const chronology = recoveredChronology(item, ctx);
  const recapLike = isRecapOrDesignReply(item, hay);

  if (promotionalIdentityFailsClosed(item, ctx)) return false;

  if (life === "queued") return false;

  if (spec && !persistedSpecStillCurrent(spec, stage)) {
    return false;
  }

  if (
    item.briefingPacket?.authoritative &&
    item.briefingPacket.ballHolder === "founder"
  ) {
    if (life === "terminal") {
      if (spec) return false;
      if (isDesignStageActionText(hay) && !isPostCompletionObligationText(hay)) {
        return false;
      }
      return isPostCompletionObligationText(hay);
    }
    return true;
  }

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

  if (chronology?.staleInboundSatisfied && recapLike && !chronology.remainingCommitment) {
    return false;
  }
  if (
    chronology &&
    recapLike &&
    !chronology.clientRepliedAfterOutbound &&
    chronology.latestOutboundAt &&
    !chronology.remainingCommitment
  ) {
    return false;
  }

  if (life === "production") {
    if (isDesignStageActionText(hay) && !isProductionExceptionText(hay)) return false;
    if (recapLike && !isProductionExceptionText(hay)) return false;
    if (item.origin === "decision" && item.decision?.recap) return false;
    if (item.origin === "anomaly" && isDesignStageActionText(hay)) return false;
  }

  if (life === "cad" || life === "design") {
    if (item.origin === "decision" && item.decision?.recap) return false;
    if (
      /send the recap/i.test(item.headline) &&
      (item.brief?.noFounderAction || item.brief?.waitingState || chronology?.staleInboundSatisfied)
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
  ctx: TodayFinalInvariantContext = {},
): T[] {
  return items.filter((item) => isCurrentTodayDocketItem(item, ctx));
}
