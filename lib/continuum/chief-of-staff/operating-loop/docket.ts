/**
 * Founder-facing Today docket. Presentation only.
 * Up Next and Watching both render from the same packet-gated boundary.
 * Up next contains only current founder-owned actions. It may contain 0–3 items.
 */

import { COS_SPRINT_CLEAR_COPY } from "./master-sprint";
import {
  isMeaningfulTodayActionText,
  isNoiseOnlyCandidateText,
} from "@/lib/continuum/candidates/founder-attention";
import {
  COS_CAUGHT_UP_DETAIL,
  COS_CAUGHT_UP_HEADING,
} from "./present";
import {
  docketSubject,
  isExecutiveBriefing,
  presentDocketBriefing,
} from "./docket-present";
import { finalizeTodayDocket, hasRealFounderOwnedObligation } from "./today-docket-boundary";
import { presentTodayItem, presentTodayWatchingItem } from "./today-presentation";
import { isIdentityCleanupText } from "./briefing-packet";
import { isAmbiguousFollowUpFragment } from "./obligation-currentness";
import type {
  CosDocketItemView,
  CosDocketLane,
  CosDocketOrigin,
  CosOperatingLoopView,
  CosWatchingItem,
  TodayDocketVersion,
} from "./types";
import { TODAY_DOCKET_VERSION } from "./types";
import { civilDateInZone, FOUNDER_BUSINESS_TIME_ZONE } from "@/lib/continuum/date-only";

export const COS_DOCKET_TITLE = "Up next";
export const COS_DOCKET_VISIBLE_LIMIT = 3;
export { TODAY_DOCKET_VERSION };

export type { CosDocketLane, CosDocketOrigin, CosDocketItemView };

export {
  docketSubject,
  isExecutiveBriefing,
  presentDocketBriefing,
};

export type CosTodayDocketView = {
  todayDocketVersion: TodayDocketVersion;
  title: typeof COS_DOCKET_TITLE;
  items: CosDocketItemView[];
  queuedCount: number;
  watchingCount: number;
  watching: readonly CosWatchingItem[];
  cleanup?: readonly CosDocketItemView[];
  sections?: readonly CosTodaySectionView[];
  showCaughtUp: boolean;
  showDisconnected: boolean;
  caughtUpHeading: string;
  caughtUpDetail: string | null;
  disconnectedHeading: string | null;
  disconnectedDetail: string | null;
};

export type CosTodaySectionId =
  | "founder"
  | "ready"
  | "waiting_client"
  | "cad_design"
  | "production"
  | "repairs"
  | "watching";

export type CosTodaySectionItem = {
  id: string;
  title: string;
  summary: string;
  stateLabel: string;
  origin: CosDocketOrigin | "watching";
  ballHolder: string | null;
  lifecycle: string | null;
  projectId: string | null;
  jobId: string | null;
  packet: CosDocketItemView["briefingPacket"];
  cosBriefing: CosDocketItemView["cosBriefing"];
};

export type CosTodaySectionView = {
  id: CosTodaySectionId;
  title: string;
  items: readonly CosTodaySectionItem[];
};

export function isExternalPromiseFollowUpDue(
  packet: CosDocketItemView["briefingPacket"],
  asOfIso: string | null | undefined,
): boolean {
  const commitment = packet?.projection?.commitment;
  if (!commitment || commitment.actor !== "client" || !asOfIso) return false;
  const asOf = civilDateInZone(asOfIso, FOUNDER_BUSINESS_TIME_ZONE);
  const due = commitment.window?.end ?? commitment.date;
  return Boolean(asOf && due && asOf > due);
}

const SECTION_TITLES: Record<CosTodaySectionId, string> = {
  founder: "Founder / Your Turn",
  ready: "Ready / Delivery",
  waiting_client: "Waiting on Client",
  cad_design: "CAD / Design",
  production: "In Production",
  repairs: "Repairs",
  watching: "Watching / Held / Deferred",
};

function sectionIdFor(item: CosTodaySectionItem): CosTodaySectionId {
  const lifecycle = item.lifecycle?.trim().toLowerCase().replaceAll(" ", "_") ?? "";
  const projectionStage = item.packet?.projection?.stage ?? "";
  const state = item.stateLabel.trim().toLowerCase().replaceAll(" ", "_");
  const hay = `${item.title} ${item.summary} ${item.stateLabel}`.toLowerCase();
  const resolvedStage = [state, projectionStage, lifecycle].find((value) =>
    /^(?:ready|ready_for_delivery|ready_for_return|ready_for_pickup|delivery|final_qc|in_production|production|manufacturing|bench|order_confirmed|repair|repairs|resize|sizing|restoration|cad|design|design_requested|revision_requested|cad_review|approved)$/.test(value),
  ) ?? "";
  if (item.origin === "master_sprint") return "founder";
  if (/\b(?:held|hold|deferred|snoozed)\b/.test(`${lifecycle} ${projectionStage} ${state} ${hay}`)) return "watching";
  if (item.ballHolder === "founder") return "founder";
  if (/^(?:ready|ready_for_delivery|ready_for_return|ready_for_pickup|delivery|final_qc)$/.test(resolvedStage)) return "ready";
  if (item.ballHolder === "client") return "waiting_client";
  if (/^(?:in_production|production|manufacturing|bench|order_confirmed)$/.test(resolvedStage)) return "production";
  if (/^(?:repair|repairs|resize|sizing|restoration)$/.test(resolvedStage)) return "repairs";
  if (
    item.ballHolder === "vendor_shop" &&
    /^(?:cad|design|design_requested|revision_requested|cad_review|approved)$/.test(resolvedStage)
  ) return "cad_design";
  if (/ready[_ ]for[_ ](?:delivery|return)|final qc|ready for (?:pickup|shipping|presentation|delivery)/.test(hay)) return "ready";
  if (/\b(?:in[_ ]production|production|manufacturing|bench)\b/.test(hay)) return "production";
  if (/\b(?:repair|resize|sizing|restoration)\b/.test(hay)) return "repairs";
  if (/\b(?:cad|design|stl|render)\b/.test(hay) && item.ballHolder === "vendor_shop") return "cad_design";
  return "watching";
}

function hasOnlyNonblockingClientReplyEvidence(item: CosDocketItemView): boolean {
  const events = item.briefingPacket?.sourceEvents ?? [];
  return (
    !item.job &&
    events.length > 0 &&
    events.every((event) => event.semanticClass === "client_replies_nonblocking")
  );
}

export function composeTodaySections(input: {
  active: readonly CosDocketItemView[];
  watching: readonly CosWatchingItem[];
  masterSprint?: readonly CosDocketItemView[];
  asOfIso?: string | null;
}): CosTodaySectionView[] {
  const active = [...input.active, ...(input.masterSprint ?? [])]
    .filter((item) => item.semanticPresentation?.likelyNoise !== true)
    .filter((item) => !hasOnlyNonblockingClientReplyEvidence(item))
    .filter(
      (item) =>
        item.origin !== "decision" ||
        !isAmbiguousFollowUpFragment(`${item.headline} ${item.context ?? ""}`),
    )
    .filter(
      (item) =>
        !item.decision ||
        Boolean(item.job) ||
        hasRealFounderOwnedObligation(item.briefingPacket),
    )
    .map((item): CosTodaySectionItem => ({
    id: item.id,
    title: item.subject,
    summary:
      item.briefingPacket?.ballHolder === "founder"
        ? item.briefing?.nextBody || item.semanticPresentation?.suggestedAction || item.headline
        : item.semanticPresentation?.founderCheckpoint || item.headline,
    stateLabel: item.semanticPresentation?.stateLabel || item.briefing?.stateChip || (item.origin === "master_sprint" ? "MASTER SPRINT" : "ACTIVE"),
    origin: item.origin,
    ballHolder: item.briefingPacket?.ballHolder ?? (item.origin === "master_sprint" ? "founder" : null),
    lifecycle: item.briefingPacket?.lifecycle ?? null,
    projectId: item.briefingPacket?.projectId ?? item.job?.projectId ?? null,
    jobId: item.job?.id ?? null,
    packet: item.briefingPacket,
    cosBriefing: item.cosBriefing,
    }));
  const resting = input.watching.map((item): CosTodaySectionItem => {
    const followUpDue = isExternalPromiseFollowUpDue(item.briefingPacket, input.asOfIso);
    const deliverable = item.briefingPacket?.projection?.commitment?.deliverable;
    return {
      id: item.id,
      title: item.title,
      summary: followUpDue && deliverable
        ? `Follow up for ${deliverable.replace(/[.!?]+$/, "")}.`
        : item.briefing?.nextBody || item.detail,
      stateLabel: followUpDue ? "FOUNDER ACTION" : item.briefing?.stateChip || "WATCHING",
      origin: "watching",
      ballHolder: followUpDue ? "founder" : item.briefingPacket?.ballHolder ?? null,
      lifecycle: item.briefingPacket?.lifecycle ?? null,
      projectId: item.projectId,
      jobId: null,
      packet: item.briefingPacket,
      cosBriefing: item.cosBriefing,
    };
  });
  const seen = new Set<string>();
  const buckets = new Map<CosTodaySectionId, CosTodaySectionItem[]>();
  for (const item of [...active, ...resting]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const id = sectionIdFor(item);
    buckets.set(id, [...(buckets.get(id) ?? []), item]);
  }
  const order: CosTodaySectionId[] = ["founder", "ready", "waiting_client", "cad_design", "production", "repairs", "watching"];
  return order.map((id) => ({ id, title: SECTION_TITLES[id], items: buckets.get(id) ?? [] }));
}

export function cosQueuedLabel(count: number): string {
  return `+${count} queued`;
}

export function cosWatchingCountLabel(count: number): string {
  return `Watching · ${count}`;
}

export function founderFacingBriefActionLabel(kind: string, label: string): string {
  if (kind === "add_to_top5") return "Add to Today";
  if (kind === "open_email") return "View email";
  return label;
}

export function isActionableTodayDocketItem(item: CosDocketItemView): boolean {
  const semantic = presentTodayItem(item);
  if (semantic.likelyNoise || semantic.stateLabel === "WAITING ON CLIENT" || semantic.stateLabel === "WAITING ON SHOP") {
    return false;
  }
  if (
    item.origin === "brief" &&
    item.briefing &&
    (item.briefing.stateChip === "WAITING ON SHOP" ||
      item.briefing.stateChip === "WAITING ON CLIENT")
  ) {
    return false;
  }
  if (item.origin === "master_sprint") return true;
  if (isNoiseOnlyCandidateText(item.headline)) return false;
  if (isIdentityCleanupText(item.headline) && !hasRealFounderOwnedObligation(item.briefingPacket)) {
    return false;
  }
  if (item.origin === "open_job") {
    if (
      item.briefingPacket?.ballHolder === "vendor_shop" ||
      item.briefingPacket?.ballHolder === "client"
    ) {
      return false;
    }
    if (hasRealFounderOwnedObligation(item.briefingPacket)) return true;
    if (!item.briefingPacket || item.briefingPacket.ballHolder === "unknown") {
      return !isIdentityCleanupText(item.headline) && !isAmbiguousFollowUpFragment(item.headline);
    }
    return false;
  }
  const evidence = item.brief?.evidence ?? [];
  const evidenceTexts = evidence.map((beat) => beat.summary);
  const noiseEvidenceOnly =
    evidence.length > 0 && evidenceTexts.every((text) => isNoiseOnlyCandidateText(text));
  if (
    noiseEvidenceOnly &&
    (/Identify who this is from/i.test(item.headline) || /recap|next step/i.test(item.headline))
  ) {
    return false;
  }
  if (item.brief?.staleInboundSatisfied && /recap|next step/i.test(item.headline)) return false;
  if (item.brief?.noFounderAction && /recap|next step|Identify who this is from/i.test(item.headline)) {
    return false;
  }
  if (item.origin === "decision") {
    if (item.decision?.recap) return hasRealFounderOwnedObligation(item.briefingPacket);
    if (/recap|answered the design|Your turn/i.test(`${item.headline} ${item.context ?? ""}`)) {
      return false;
    }
  }
  if (item.briefingPacket) {
    if (item.briefingPacket.ballHolder === "founder") {
      return hasRealFounderOwnedObligation(item.briefingPacket);
    }
    if (
      item.briefingPacket.ballHolder === "unknown" &&
      item.brief &&
      !isIdentityCleanupText(item.headline) &&
      !isAmbiguousFollowUpFragment(item.headline) &&
      (item.brief.rankClass === "founder_commitment" ||
        (item.brief.rankClass === "follow_up" && !/recap|next step/i.test(item.headline)))
    ) {
      return true;
    }
    return false;
  }
  return Boolean(item.brief || item.job || isMeaningfulTodayActionText(item.headline));
}

/**
 * Master Sprint fallback into unused Up next capacity.
 * Client/work always occupies slots first. Extra sprint items stay off the queue.
 */
export function masterSprintDocketItems(
  loop: CosOperatingLoopView,
  unusedSlots = COS_DOCKET_VISIBLE_LIMIT,
): CosDocketItemView[] {
  const liveClear = unusedSlots >= COS_DOCKET_VISIBLE_LIMIT;
  const seeds = loop.masterSprint ?? [];
  const cap = Math.max(0, unusedSlots);
  if (cap === 0) return [];
  return seeds.slice(0, cap).map((item) => {
    const briefing = presentDocketBriefing({
      subject: item.title,
      headline: item.action,
      context: liveClear ? COS_SPRINT_CLEAR_COPY : item.why,
      origin: "master_sprint",
    });
    return {
      id: item.id,
      lane: "master_sprint" as const,
      origin: "master_sprint" as const,
      subject: item.title,
      headline: briefing.headline,
      context: briefing.context,
      job: null,
      brief: null,
      decision: null,
      anomaly: null,
      briefing: null,
      todayDocketVersion: TODAY_DOCKET_VERSION,
    };
  });
}

export function isAuthoritativeTodayCard(
  item: Pick<CosDocketItemView, "origin" | "todayDocketVersion" | "briefingPacket" | "job">,
): boolean {
  if (item.todayDocketVersion !== TODAY_DOCKET_VERSION) return false;
  if (item.origin === "master_sprint") return true;
  if (item.origin === "open_job" && item.job?.attentionMode && item.job.attentionMode !== "action") return true;
  return item.briefingPacket != null;
}

export function isAuthoritativeWatchingCard(
  item: Pick<CosWatchingItem, "todayDocketVersion" | "briefingPacket" | "attention">,
): boolean {
  return item.todayDocketVersion === TODAY_DOCKET_VERSION &&
    (item.briefingPacket != null || item.attention?.canonical === true);
}

function attentionWatchingItems(loop: CosOperatingLoopView, occupied: ReadonlySet<string>): CosWatchingItem[] {
  return (loop.attentionItems ?? [])
    .filter((item) => item.status === "scheduled-later" || item.status === "still-waiting")
    .filter((item) => !occupied.has(item.jobId))
    .map((item) => ({
      id: `attention:${item.jobId}`,
      title: item.projectTitle,
      detail: item.status === "scheduled-later"
        ? `${item.subject} · Scheduled for later.`
        : `${item.subject} · No authoritative resolution has been observed.`,
      projectId: item.projectId,
      todayDocketVersion: TODAY_DOCKET_VERSION,
      attention: item,
    }));
}

export function authoritativeTodayDocket(docket: CosTodayDocketView): CosTodayDocketView {
  if (docket.todayDocketVersion !== TODAY_DOCKET_VERSION) {
    return {
      todayDocketVersion: TODAY_DOCKET_VERSION,
      title: COS_DOCKET_TITLE,
      items: [],
      queuedCount: 0,
      watchingCount: 0,
      watching: [],
      cleanup: [],
      sections: composeTodaySections({ active: [], watching: [] }),
      showCaughtUp: !docket.showDisconnected,
      showDisconnected: docket.showDisconnected,
      caughtUpHeading: COS_CAUGHT_UP_HEADING,
      caughtUpDetail: COS_CAUGHT_UP_DETAIL,
      disconnectedHeading: docket.disconnectedHeading,
      disconnectedDetail: docket.disconnectedDetail,
    };
  }
  const authoritativeItems = docket.items.filter(isAuthoritativeTodayCard);
  const cleanup = [
    ...(docket.cleanup ?? []).filter(isAuthoritativeTodayCard),
    ...authoritativeItems.filter((item) => presentTodayItem(item).likelyNoise),
  ]
    .filter((item) => presentTodayItem(item).noiseKind === "receipt")
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
  const waitingFromItems: CosWatchingItem[] = authoritativeItems
    .filter((item) => {
      const semantic = presentTodayItem(item);
      return !semantic.likelyNoise && semantic.stateLabel !== "FOUNDER ACTION";
    })
    .map((item) => ({
      id: item.id,
      title: item.subject,
      detail: presentTodayItem(item).summary || item.context || item.headline,
      projectId: item.briefingPacket?.projectId ?? item.job?.projectId ?? null,
      candidateIds: item.brief?.evidence.map((beat) => beat.candidateId) ?? [],
      briefingPacket: item.briefingPacket,
      briefing: item.briefing,
      cosBriefing: item.cosBriefing,
      todayDocketVersion: TODAY_DOCKET_VERSION,
      wasTodayAction: true,
    }));
  const items = authoritativeItems.filter(isActionableTodayDocketItem);
  const watching = [...docket.watching.filter(isAuthoritativeWatchingCard), ...waitingFromItems]
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .map((item) => {
      const semantic = presentTodayWatchingItem(item);
      return { ...item, title: semantic.title, detail: semantic.summary };
    });
  const sections = docket.sections ?? composeTodaySections({ active: items, watching });
  return {
    ...docket,
    items,
    watching,
    cleanup,
    sections,
    watchingCount: watching.length,
    showCaughtUp: !docket.showDisconnected && items.length === 0,
  };
}

export function composeTodayDocket(loop: CosOperatingLoopView): CosTodayDocketView {
  const finalized = finalizeTodayDocket(loop);
  const terminalAttentionIds = new Set((loop.attentionItems ?? [])
    .filter((item) => item.status === "terminal-resolved")
    .map((item) => item.jobId));
  const actionableLive = finalized.upNext
    .filter((item) => !item.job || !terminalAttentionIds.has(item.job.id))
    .filter(isActionableTodayDocketItem);
  const allSprint = masterSprintDocketItems(loop, loop.masterSprint?.length ?? 0);
  const items = actionableLive.slice(0, COS_DOCKET_VISIBLE_LIMIT);
  const queuedCount = Math.max(0, actionableLive.length - COS_DOCKET_VISIBLE_LIMIT);
  const showDisconnected = loop.status === "disconnected";
  const showCaughtUp = !showDisconnected && actionableLive.length === 0;

  const occupied = new Set([
    ...finalized.upNext.map((item) => item.job?.id ?? item.id),
    ...finalized.watching.map((item) => item.attention?.jobId ?? item.id),
  ]);
  const watching = [...finalized.watching, ...attentionWatchingItems(loop, occupied)];
  return authoritativeTodayDocket({
    todayDocketVersion: TODAY_DOCKET_VERSION,
    title: COS_DOCKET_TITLE,
    items,
    queuedCount,
    watchingCount: watching.length,
    watching,
    cleanup: finalized.upNext.filter((item) => presentTodayItem(item).noiseKind === "receipt"),
    sections: composeTodaySections({
      active: actionableLive,
      watching,
      masterSprint: allSprint,
      asOfIso: loop.asOfIso,
    }),
    showCaughtUp,
    showDisconnected,
    caughtUpHeading: COS_CAUGHT_UP_HEADING,
    caughtUpDetail: COS_CAUGHT_UP_DETAIL,
    disconnectedHeading: showDisconnected ? loop.heading : null,
    disconnectedDetail: showDisconnected ? loop.quietDetail : null,
  });
}
