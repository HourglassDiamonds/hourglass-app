/**
 * Founder-facing Today docket. Presentation only.
 * Does not rerank Open Jobs, Brief, or Candidates.
 * Master Sprint fills unused Up next slots with the same grammar.
 */

import { uncoveredFallbackAttention } from "./moderator";
import {
  COS_CAUGHT_UP_DETAIL,
  COS_CAUGHT_UP_HEADING,
} from "./present";
import { COS_SPRINT_CLEAR_COPY } from "./master-sprint";
import type {
  CosAnomalyItem,
  CosBriefItem,
  CosDocketOrigin,
  CosFounderAttentionItem,
  CosOperatingLoopView,
  CosTop5Item,
  CosWatchingItem,
} from "./types";

export const COS_DOCKET_TITLE = "Up next";
export const COS_DOCKET_VISIBLE_LIMIT = 3;

export type CosDocketLane = "live_work" | "master_sprint";

export type { CosDocketOrigin };

export type CosDocketItemView = {
  id: string;
  lane: CosDocketLane;
  origin: CosDocketOrigin;
  subject: string;
  headline: string;
  context: string | null;
  job: CosTop5Item | null;
  brief: CosBriefItem | null;
  decision: CosFounderAttentionItem | null;
  anomaly: CosAnomalyItem | null;
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

export function docketSubject(
  person: string | null | undefined,
  project: string | null | undefined,
): string {
  const who = person?.trim() ?? "";
  const what = project?.trim() ?? "";
  if (who && what) {
    if (who === what) return who;
    const hay = what.toLowerCase();
    if (hay.includes(who.toLowerCase())) return who;
    const tokens = who
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4);
    if (tokens.some((token) => hay.includes(token))) return who;
    return `${who} / ${what}`;
  }
  return who || what || "Unassigned";
}

export function cosQueuedLabel(count: number): string {
  return `+${count} queued`;
}

export function cosWatchingCountLabel(count: number): string {
  return `Watching · ${count}`;
}

export function founderFacingBriefActionLabel(kind: string, label: string): string {
  if (kind === "add_to_top5") return "Add to Today";
  return label;
}

const UNASSIGNED_SUBJECT = "Unassigned";

function firstName(subject: string): string | null {
  const token = subject.trim().split(/\s+/)[0] ?? "";
  if (!token || token.toLowerCase() === "unassigned") return null;
  return token;
}

function finishImperative(text: string): string {
  const trimmed = text.replace(/\s*\/\s*/g, " and ").replace(/\.$/, "").trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function rewriteSpecBriefing(
  headline: string,
  context: string,
): { headline: string; context: string } | null {
  const labeled = context.match(
    /^([A-Za-z][A-Za-z ]+?) differs: approved (.+?) vs latest evidence (.+?)(?:\.|$)/i,
  );
  if (labeled) {
    const label = labeled[1]!.trim().toLowerCase();
    const approved = labeled[2]!.trim();
    const latest = labeled[3]!.trim();
    const action = /finger size/i.test(label)
      ? "Confirm the finger size before this moves forward."
      : `Confirm the ${label} before this moves forward.`;
    return {
      headline: action,
      context: `The project says ${approved}, but the latest evidence says ${latest}. I'd verify the current ${label} before production.`,
    };
  }
  const between = context.match(
    /(?:spec conflict:\s*)?([A-Za-z][A-Za-z ]+?) differs between approved (.+?) and latest evidence (.+?)(?:\.|$)/i,
  );
  if (between) {
    const label = between[1]!.trim().toLowerCase();
    const approved = between[2]!.trim();
    const latest = between[3]!.trim();
    const action = /finger size/i.test(label)
      ? "Confirm the finger size before this moves forward."
      : `Confirm the ${label} before this moves forward.`;
    return {
      headline: action,
      context: `The project says ${approved}, but the latest evidence says ${latest}. I'd verify the current ${label} before production.`,
    };
  }
  if (/still differ from the approved Project spec/i.test(context) || /Older (?:spec )?notes were superseded/i.test(context)) {
    return {
      headline: /confirm/i.test(headline)
        ? finishImperative(headline.replace(/\bthe current\b/i, "the").replace(/\.$/, "") + " before this moves forward")
        : "Confirm the spec before this moves forward.",
      context: "A few details still disagree with the project. I'd settle them before production continues.",
    };
  }
  return null;
}

function rewriteReplyBriefing(
  headline: string,
  context: string,
  subject: string,
  unassigned: boolean,
): { headline: string; context: string } | null {
  const reply =
    /latest meaningful turn is theirs/i.test(context) ||
    /answered a design question/i.test(context) ||
    /answered after your last question/i.test(context);
  if (!reply) return null;
  if (unassigned) {
    return {
      headline: "Identify the client, then send the recap.",
      context:
        "A client replied to a design question, but this conversation isn't attached to a person yet. Confirm who it belongs to, then send the next step.",
    };
  }
  const who = firstName(subject);
  return {
    headline: "Send the recap and next step.",
    context: who
      ? `${who} replied to the latest design question. I'd send the recap now, while the conversation is still live.`
      : "They replied to the latest design question. I'd send the recap now, while the conversation is still live.",
  };
}

function softenGeneratedPhrasing(text: string): string {
  return text
    .replace(/\bThe latest meaningful turn is theirs\.?/gi, "")
    .replace(/\bOlder spec notes were superseded\.?/gi, "")
    .replace(/\bOlder notes were superseded\.?/gi, "")
    .replace(/\bit is not already on Top 5\.?/gi, "it isn't already on Today.")
    .replace(/\bDo it, or add it to Top 5\.?/gi, "Do this now.")
    .replace(/\bSend the recap \/ next step\.?/gi, "Send the recap and next step.")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
}

function presentJobContext(why: string): string {
  const overdue = /overdue/i.test(why);
  const yours = /YOUR TURN|founder action/i.test(why);
  if (overdue && yours) return "This is overdue and still waiting on you.";
  if (overdue) return "This is overdue. I'd take the next step today.";
  if (yours) return "This is still waiting on you.";
  if (/Recorded Open Job/i.test(why)) return "This is still open. I'd take the next step.";
  return softenGeneratedPhrasing(why.replace(/\s*·\s*/g, ", "));
}

export function presentDocketBriefing(input: {
  subject: string;
  headline: string;
  context: string | null;
  origin: CosDocketOrigin;
}): { headline: string; context: string | null } {
  const unassigned = !input.subject || input.subject === UNASSIGNED_SUBJECT;
  const rawHeadline = input.headline.trim();
  const rawContext = input.context?.trim() || "";

  const spec = rawContext ? rewriteSpecBriefing(rawHeadline, rawContext) : null;
  if (spec) return spec;

  const reply = rawContext
    ? rewriteReplyBriefing(rawHeadline, rawContext, input.subject, unassigned)
    : null;
  if (reply) return reply;

  if (unassigned && /recap|next step/i.test(rawHeadline)) {
    return {
      headline: "Identify the client, then send the recap.",
      context:
        "A client replied to a design question, but this conversation isn't attached to a person yet. Confirm who it belongs to, then send the next step.",
    };
  }

  let headline = finishImperative(
    softenGeneratedPhrasing(rawHeadline)
      .replace(/\bConfirm the current /i, "Confirm the ")
      .replace(/\bDo it, or add it to Top 5/i, "Do this now"),
  );
  let context = rawContext
    ? softenGeneratedPhrasing(rawContext)
    : null;
  if (input.origin === "open_job" && context) {
    context = presentJobContext(rawContext);
  }
  if (context && /not already on Top 5/i.test(rawContext)) {
    headline = "Do this now.";
    context = "You committed to this, and it isn't on Today yet. I'd handle it while it's still in front of you.";
  }
  if (!context) return { headline, context: null };
  return { headline, context };
}

function coverKeysFor(item: {
  id: string;
  projectId?: string | null;
  candidateIds?: readonly string[];
}): string[] {
  const keys = [`id:${item.id}`];
  if (item.projectId) keys.push(`project:${item.projectId}`);
  for (const id of item.candidateIds ?? []) keys.push(`candidate:${id}`);
  return keys;
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
    };
  });
}

export function composeTodayDocket(loop: CosOperatingLoopView): CosTodayDocketView {
  const covered = new Set<string>();
  const liveWork: CosDocketItemView[] = [];

  const mark = (keys: readonly string[]) => {
    for (const key of keys) covered.add(key);
  };
  const isCovered = (keys: readonly string[]) => keys.some((key) => covered.has(key));

  for (const item of loop.brief) {
    const subject = docketSubject(item.personLabel, item.projectTitle);
    const briefing = presentDocketBriefing({
      subject,
      headline: item.recommended,
      context: item.explanation,
      origin: "brief",
    });
    liveWork.push({
      id: item.id,
      lane: "live_work",
      origin: "brief",
      subject,
      headline: briefing.headline,
      context: briefing.context,
      job: null,
      brief: item,
      decision: null,
      anomaly: null,
    });
    mark(coverKeysFor({
      id: item.id,
      projectId: item.projectId,
      candidateIds: item.candidateIds,
    }));
  }

  for (const item of loop.top5) {
    const idCovered = covered.has(`id:${item.id}`);
    const projectCovered = item.projectId
      ? covered.has(`project:${item.projectId}`)
      : false;
    if (idCovered || projectCovered) continue;
    const subject = docketSubject(item.clientLabel, item.projectTitle);
    const briefing = presentDocketBriefing({
      subject,
      headline: item.action,
      context: item.why,
      origin: "open_job",
    });
    liveWork.push({
      id: item.id,
      lane: "live_work",
      origin: "open_job",
      subject,
      headline: briefing.headline,
      context: briefing.context,
      job: item,
      brief: null,
      decision: null,
      anomaly: null,
    });
    mark([`id:${item.id}`]);
  }

  const fallback = uncoveredFallbackAttention(loop);

  for (const item of fallback.needsYourDecision) {
    const keys = coverKeysFor({
      id: item.id,
      projectId: item.projectId,
      candidateIds: item.candidateIds,
    });
    const sticky = Boolean(item.recap) || Boolean(item.proposedAction);
    if (!sticky && isCovered(keys)) continue;
    const subject = item.title.trim() || docketSubject(null, item.projectTitle);
    const briefing = presentDocketBriefing({
      subject,
      headline: item.headline,
      context: item.detail,
      origin: "decision",
    });
    liveWork.push({
      id: item.id,
      lane: "live_work",
      origin: "decision",
      subject,
      headline: briefing.headline,
      context: briefing.context,
      job: null,
      brief: null,
      decision: item,
      anomaly: null,
    });
    mark(keys);
  }

  for (const item of fallback.anomalies) {
    const keys = coverKeysFor({ id: item.id, projectId: item.projectId });
    if (isCovered(keys)) continue;
    const subject = docketSubject(null, item.sourceLabel);
    const briefing = presentDocketBriefing({
      subject,
      headline: item.headline,
      context: item.detail,
      origin: "anomaly",
    });
    liveWork.push({
      id: item.id,
      lane: "live_work",
      origin: "anomaly",
      subject,
      headline: briefing.headline,
      context: briefing.context,
      job: null,
      brief: null,
      decision: null,
      anomaly: item,
    });
    mark(keys);
  }

  const unused = Math.max(0, COS_DOCKET_VISIBLE_LIMIT - liveWork.length);
  const sprint = masterSprintDocketItems(loop, unused);
  const queue = [...liveWork, ...sprint];
  const items = queue.slice(0, COS_DOCKET_VISIBLE_LIMIT);
  const queuedCount = Math.max(0, liveWork.length - COS_DOCKET_VISIBLE_LIMIT);
  const showDisconnected = loop.status === "disconnected";
  const showCaughtUp = !showDisconnected && liveWork.length === 0 && sprint.length === 0;

  return {
    title: COS_DOCKET_TITLE,
    items,
    queuedCount,
    watchingCount: loop.watching.length,
    watching: loop.watching,
    showCaughtUp,
    showDisconnected,
    caughtUpHeading: COS_CAUGHT_UP_HEADING,
    caughtUpDetail: COS_CAUGHT_UP_DETAIL,
    disconnectedHeading: showDisconnected ? loop.heading : null,
    disconnectedDetail: showDisconnected ? loop.quietDetail : null,
  };
}
