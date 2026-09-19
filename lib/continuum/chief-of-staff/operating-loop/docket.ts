/**
 * Founder-facing Today docket. Presentation only.
 * Up Next and Watching both render from the same packet-gated boundary.
 * Master Sprint fills unused Up next slots with the same grammar.
 */

import {
  isMeaningfulTodayActionText,
  isNoiseOnlyCandidateText,
} from "@/lib/continuum/candidates/founder-attention";
import { COS_SPRINT_CLEAR_COPY } from "./master-sprint";
import {
  COS_CAUGHT_UP_DETAIL,
  COS_CAUGHT_UP_HEADING,
} from "./present";
import {
  docketSubject,
  isExecutiveBriefing,
  presentDocketBriefing,
} from "./docket-present";
import { finalizeTodayDocket } from "./today-docket-boundary";
import type {
  CosDocketItemView,
  CosDocketLane,
  CosDocketOrigin,
  CosOperatingLoopView,
  CosWatchingItem,
} from "./types";

export const COS_DOCKET_TITLE = "Up next";
export const COS_DOCKET_VISIBLE_LIMIT = 3;

export type { CosDocketLane, CosDocketOrigin, CosDocketItemView };

export {
  docketSubject,
  isExecutiveBriefing,
  presentDocketBriefing,
};

export type CosTodayDocketView = {
  title: typeof COS_DOCKET_TITLE;
  items: CosDocketItemView[];
  queuedCount: number;
  watchingCount: number;
  watching: readonly CosWatchingItem[];
  showCaughtUp: boolean;
  showDisconnected: boolean;
  caughtUpHeading: string;
  caughtUpDetail: string | null;
  disconnectedHeading: string | null;
  disconnectedDetail: string | null;
};

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
  if (item.origin === "open_job") return true;
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
  if (item.brief?.staleInboundSatisfied && /recap|next step/i.test(item.headline)) {
    return false;
  }
  if (item.brief?.noFounderAction && /recap|next step|Identify who this is from/i.test(item.headline)) {
    return false;
  }
  if (item.origin === "decision") {
    if (item.decision?.recap) return true;
    if (/recap|answered the design|Your turn/i.test(`${item.headline} ${item.context ?? ""}`)) {
      return false;
    }
  }
  if (/Identify who this is from/i.test(item.headline)) {
    const supportedReply = /answered a design question|latest meaningful turn|asked for|confirm the next step|isn't attached to a person/i.test(
      item.brief?.explanation ?? "",
    );
    const recovered = Boolean(
      item.brief?.recoveredGmailThreadId || item.brief?.canonicalGmailThreadId,
    );
    const confirm = item.brief?.actions.some((action) => action.kind === "confirm_person") ?? false;
    return Boolean(confirm || recovered || supportedReply || !noiseEvidenceOnly);
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
    };
  });
}

export function composeTodayDocket(loop: CosOperatingLoopView): CosTodayDocketView {
  const finalized = finalizeTodayDocket(loop);
  const actionableLive = finalized.upNext.filter(isActionableTodayDocketItem);
  const unused = Math.max(0, COS_DOCKET_VISIBLE_LIMIT - actionableLive.length);
  const sprint = masterSprintDocketItems(loop, unused);
  const queue = [...actionableLive, ...sprint];
  const items = queue.slice(0, COS_DOCKET_VISIBLE_LIMIT);
  const queuedCount = Math.max(0, actionableLive.length - COS_DOCKET_VISIBLE_LIMIT);
  const showDisconnected = loop.status === "disconnected";
  const showCaughtUp = !showDisconnected && actionableLive.length === 0 && sprint.length === 0;

  return {
    title: COS_DOCKET_TITLE,
    items,
    queuedCount,
    watchingCount: finalized.watching.length,
    watching: finalized.watching,
    showCaughtUp,
    showDisconnected,
    caughtUpHeading: COS_CAUGHT_UP_HEADING,
    caughtUpDetail: COS_CAUGHT_UP_DETAIL,
    disconnectedHeading: showDisconnected ? loop.heading : null,
    disconnectedDetail: showDisconnected ? loop.quietDetail : null,
  };
}
