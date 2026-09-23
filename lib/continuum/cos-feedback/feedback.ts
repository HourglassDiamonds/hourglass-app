/**
 * Chief of Staff Feedback V1.
 * Advisory only. Continuum Today remains the source of truth.
 * A model may recommend. It may not create facts, dates, or writes.
 */

import { civilDateInZone, compareDateOnly, FOUNDER_BUSINESS_TIME_ZONE } from "@/lib/continuum/date-only";
import type { CosTodayDocketView } from "@/lib/continuum/chief-of-staff/operating-loop/docket";
import {
  classifyCosPriority,
  clientFacingCategory,
  type CosPriorityInput,
} from "@/lib/continuum/chief-of-staff/operating-loop/cos-priority";
import type {
  CosDocketItemView,
  CosWatchingItem,
} from "@/lib/continuum/chief-of-staff/operating-loop/types";

export const COS_FEEDBACK_MODEL_ID = "cos-feedback-v1" as const;

export type CosFeedbackBasis = "evidence" | "recommendation";

export type CosFeedbackFocus = {
  itemId: string;
  rank: number;
  why: string;
  sourceRefs: readonly string[];
  basis: "recommendation";
};

export type CosFeedbackRisk = {
  itemId: string;
  statement: string;
  basis: CosFeedbackBasis;
  sourceRefs: readonly string[];
};

export type CosFeedbackIgnore = {
  itemId: string;
  why: string;
  sourceRefs: readonly string[];
  basis: "recommendation";
};

export type CosFeedbackV1 = {
  modelId: typeof COS_FEEDBACK_MODEL_ID;
  portfolioSummary: string;
  focusOrder: readonly CosFeedbackFocus[];
  risks: readonly CosFeedbackRisk[];
  safeToIgnore: readonly CosFeedbackIgnore[];
  founderGuidance: string;
  generatedAt: string;
  sourceWatermark: string;
};

export type CosFeedbackPacketItem = {
  itemId: string;
  displayName: string;
  projectId: string | null;
  projectTitle: string | null;
  sourceRefs: readonly string[];
  currentState: string;
  ballHolder: string | null;
  currentFounderAction: boolean;
  founderDue: boolean;
  clientFacing: boolean;
  lane: "focus" | "watching";
  timingFacts: readonly { statement: string; dueDate: string | null; sourceRefs: readonly string[] }[];
  checkpointBasis: CosFeedbackBasis | null;
  checkpointStatement: string | null;
};

export type CosFeedbackPacket = {
  modelId: typeof COS_FEEDBACK_MODEL_ID;
  sourceWatermark: string;
  generatedAt: string;
  items: readonly CosFeedbackPacketItem[];
};

export type CosFeedbackModel = (packet: CosFeedbackPacket) => Promise<unknown> | unknown;

const PLACE = ["first", "second", "third"] as const;
const COUNT_WORD = ["none", "one", "two", "three"] as const;

let cached: { key: string; feedback: CosFeedbackV1 } | null = null;

export function resetCosFeedbackCache(): void {
  cached = null;
}

export function buildCosFeedbackPacket(input: {
  docket: CosTodayDocketView;
  sourceWatermark: string;
  nowIso: string;
}): CosFeedbackPacket {
  const today = civilDateInZone(input.nowIso, FOUNDER_BUSINESS_TIME_ZONE);
  const items = [
    ...input.docket.items.map((item) => packetItem(item, "focus", today)),
    ...input.docket.watching.map((item) => watchingItem(item, today)),
  ];
  return {
    modelId: COS_FEEDBACK_MODEL_ID,
    sourceWatermark: input.sourceWatermark,
    generatedAt: input.nowIso,
    items,
  };
}

export function cosFeedbackDigest(packet: CosFeedbackPacket): string {
  return packet.items
    .map((item) =>
      [
        item.itemId,
        item.lane,
        item.currentState,
        item.ballHolder ?? "",
        item.currentFounderAction ? "1" : "0",
        item.founderDue ? "1" : "0",
        item.clientFacing ? "1" : "0",
        item.timingFacts.map((fact) => fact.statement).join(","),
        item.checkpointBasis ?? "",
        item.checkpointStatement ?? "",
      ].join("|"),
    )
    .join("\n");
}

export function deriveDeterministicCosFeedback(packet: CosFeedbackPacket): CosFeedbackV1 {
  const focus = packet.items.filter((item) => item.lane === "focus").slice(0, 3);
  const ignore = packet.items.filter(
    (item) => item.lane === "watching" && !item.founderDue && !item.currentFounderAction,
  );
  const focusOrder: CosFeedbackFocus[] = focus.map((item, index) => ({
    itemId: item.itemId,
    rank: index + 1,
    why: clip(item.currentState || item.displayName),
    sourceRefs: item.sourceRefs,
    basis: "recommendation",
  }));
  const risks: CosFeedbackRisk[] = [];
  for (const item of packet.items) {
    for (const fact of item.timingFacts) {
      risks.push({
        itemId: item.itemId,
        statement: fact.statement,
        basis: "evidence",
        sourceRefs: fact.sourceRefs,
      });
    }
    if (item.checkpointBasis === "recommendation" && item.checkpointStatement) {
      risks.push({
        itemId: item.itemId,
        statement: item.checkpointStatement,
        basis: "recommendation",
        sourceRefs: item.sourceRefs,
      });
    }
  }
  return {
    modelId: COS_FEEDBACK_MODEL_ID,
    portfolioSummary: portfolioSummary(focus.length),
    focusOrder,
    risks,
    safeToIgnore: ignore.map((item) => ({
      itemId: item.itemId,
      why: waitWhy(item),
      sourceRefs: item.sourceRefs,
      basis: "recommendation",
    })),
    founderGuidance: guidance(focus, ignore),
    generatedAt: packet.generatedAt,
    sourceWatermark: packet.sourceWatermark,
  };
}

export function presentCosFeedback(input: {
  docket: CosTodayDocketView;
  sourceWatermark: string | null;
  nowIso: string;
}): CosFeedbackV1 {
  const packet = buildCosFeedbackPacket({
    docket: input.docket,
    sourceWatermark: input.sourceWatermark || "docket",
    nowIso: input.nowIso,
  });
  const key = cacheKey(packet);
  if (cached?.key === key) return cached.feedback;
  return deriveDeterministicCosFeedback(packet);
}

export async function refreshCosFeedback(input: {
  docket: CosTodayDocketView;
  sourceWatermark: string;
  nowIso: string;
  model?: CosFeedbackModel | null;
}): Promise<CosFeedbackV1> {
  const packet = buildCosFeedbackPacket(input);
  const key = cacheKey(packet);
  if (cached?.key === key) return cached.feedback;
  const fallback = deriveDeterministicCosFeedback(packet);
  if (!input.model) {
    cached = { key, feedback: fallback };
    return fallback;
  }
  try {
    const raw = await input.model(packet);
    const accepted = acceptModelFeedback(packet, raw);
    const feedback = accepted ?? fallback;
    cached = { key, feedback };
    return feedback;
  } catch {
    cached = { key, feedback: fallback };
    return fallback;
  }
}

export function acceptModelFeedback(
  packet: CosFeedbackPacket,
  raw: unknown,
): CosFeedbackV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as {
    portfolioSummary?: unknown;
    founderGuidance?: unknown;
    focusOrder?: unknown;
    risks?: unknown;
    safeToIgnore?: unknown;
  };
  if (typeof body.portfolioSummary !== "string" || typeof body.founderGuidance !== "string") {
    return null;
  }
  if (!Array.isArray(body.focusOrder) || !Array.isArray(body.safeToIgnore)) return null;
  const byId = new Map(packet.items.map((item) => [item.itemId, item]));
  const allowedDates = dateTokens(packet);
  const prose = `${body.portfolioSummary}\n${body.founderGuidance}`;
  if (mentionsSchedule(prose) || hasInventedDate(prose, allowedDates)) return null;

  const focusOrder: CosFeedbackFocus[] = [];
  for (const row of body.focusOrder) {
    if (!row || typeof row !== "object") return null;
    const itemId = (row as { itemId?: unknown }).itemId;
    const why = (row as { why?: unknown }).why;
    if (typeof itemId !== "string" || typeof why !== "string") return null;
    const item = byId.get(itemId);
    if (!item || hasInventedDate(why, allowedDates) || mentionsSchedule(why)) return null;
    focusOrder.push({
      itemId,
      rank: focusOrder.length + 1,
      why: clip(why),
      sourceRefs: item.sourceRefs,
      basis: "recommendation",
    });
  }
  if (!clientWorkStaysAhead(focusOrder, packet)) return null;

  const safeToIgnore: CosFeedbackIgnore[] = [];
  for (const row of body.safeToIgnore) {
    if (!row || typeof row !== "object") return null;
    const itemId = (row as { itemId?: unknown }).itemId;
    const why = (row as { why?: unknown }).why;
    if (typeof itemId !== "string" || typeof why !== "string") return null;
    const item = byId.get(itemId);
    if (!item || item.founderDue || item.currentFounderAction) return null;
    if (hasInventedDate(why, allowedDates) || mentionsSchedule(why)) return null;
    safeToIgnore.push({
      itemId,
      why: clip(why),
      sourceRefs: item.sourceRefs,
      basis: "recommendation",
    });
  }

  const risks: CosFeedbackRisk[] = [];
  if (body.risks != null) {
    if (!Array.isArray(body.risks)) return null;
    for (const row of body.risks) {
      if (!row || typeof row !== "object") return null;
      const itemId = (row as { itemId?: unknown }).itemId;
      const statement = (row as { statement?: unknown }).statement;
      const basis = (row as { basis?: unknown }).basis;
      if (typeof itemId !== "string" || typeof statement !== "string") return null;
      if (basis !== "evidence" && basis !== "recommendation") return null;
      const item = byId.get(itemId);
      if (!item || hasInventedDate(statement, allowedDates) || mentionsSchedule(statement)) return null;
      if (basis === "evidence" && !item.timingFacts.some((fact) => fact.statement === statement)) {
        return null;
      }
      risks.push({
        itemId,
        statement: clip(statement),
        basis,
        sourceRefs: item.sourceRefs,
      });
    }
  }

  return {
    modelId: COS_FEEDBACK_MODEL_ID,
    portfolioSummary: clip(body.portfolioSummary),
    focusOrder,
    risks,
    safeToIgnore,
    founderGuidance: clip(body.founderGuidance),
    generatedAt: packet.generatedAt,
    sourceWatermark: packet.sourceWatermark,
  };
}

function cacheKey(packet: CosFeedbackPacket): string {
  return `${packet.sourceWatermark}\n${cosFeedbackDigest(packet)}`;
}

function packetItem(
  item: CosDocketItemView,
  lane: "focus",
  today: ReturnType<typeof civilDateInZone>,
): CosFeedbackPacketItem {
  const packet = item.briefingPacket ?? item.brief?.briefingPacket ?? null;
  const briefing = item.cosBriefing ?? null;
  const priority: CosPriorityInput = {
    origin: item.origin,
    subject: item.subject,
    headline: item.headline,
    context: null,
    projectId: packet?.projectId ?? null,
    projectName: packet?.projectName ?? null,
    entityType: packet?.entityType ?? null,
    briefingKind: packet?.briefingKind ?? null,
    ballHolder: packet?.ballHolder ?? null,
    timingLabel: null,
  };
  return baseItem({
    itemId: item.id,
    displayName: packet?.displayName || item.subject,
    projectId: packet?.projectId ?? null,
    projectTitle: packet?.projectName ?? null,
    sourceRefs: packet?.sourceRefs ?? [],
    currentState: clip(stripQuotes(briefing?.currentState || item.headline)),
    ballHolder: packet?.ballHolder ?? null,
    currentFounderAction: Boolean(briefing?.currentFounderAction),
    founderDue: founderDue(briefing, today),
    clientFacing: clientFacingCategory(classifyCosPriority(priority)),
    lane,
    timingFacts: timingFacts(briefing),
    checkpointBasis: briefing?.checkpoint?.basis ?? null,
    checkpointStatement: briefing?.checkpoint
      ? clip(`${briefing.checkpoint.condition} ${briefing.checkpoint.action}`.trim())
      : null,
  });
}

function watchingItem(
  item: CosWatchingItem,
  today: ReturnType<typeof civilDateInZone>,
): CosFeedbackPacketItem {
  const packet = item.briefingPacket ?? null;
  const briefing = item.cosBriefing ?? null;
  const priority: CosPriorityInput = {
    origin: "brief",
    subject: item.title,
    headline: item.detail,
    context: null,
    projectId: packet?.projectId ?? item.projectId,
    projectName: packet?.projectName ?? null,
    entityType: packet?.entityType ?? null,
    briefingKind: packet?.briefingKind ?? null,
    ballHolder: packet?.ballHolder ?? null,
    timingLabel: null,
  };
  return baseItem({
    itemId: item.id,
    displayName: packet?.displayName || item.title,
    projectId: packet?.projectId ?? item.projectId,
    projectTitle: packet?.projectName ?? null,
    sourceRefs: packet?.sourceRefs ?? [],
    currentState: clip(stripQuotes(briefing?.currentState || item.detail)),
    ballHolder: packet?.ballHolder ?? null,
    currentFounderAction: Boolean(briefing?.currentFounderAction),
    founderDue: founderDue(briefing, today),
    clientFacing: clientFacingCategory(classifyCosPriority(priority)),
    lane: "watching",
    timingFacts: timingFacts(briefing),
    checkpointBasis: briefing?.checkpoint?.basis ?? null,
    checkpointStatement: briefing?.checkpoint
      ? clip(`${briefing.checkpoint.condition} ${briefing.checkpoint.action}`.trim())
      : null,
  });
}

function baseItem(item: CosFeedbackPacketItem): CosFeedbackPacketItem {
  return item;
}

function founderDue(
  briefing: CosDocketItemView["cosBriefing"],
  today: ReturnType<typeof civilDateInZone>,
): boolean {
  if (!briefing?.currentFounderAction || !today) return false;
  const dates = [
    briefing.checkpoint?.dueDate ?? null,
    ...briefing.timingFacts.map((fact) => fact.dueDate),
  ].filter((date): date is string => Boolean(date));
  return dates.some((date) => compareDateOnly(date, today) <= 0);
}

function timingFacts(
  briefing: CosDocketItemView["cosBriefing"],
): CosFeedbackPacketItem["timingFacts"] {
  return (briefing?.timingFacts ?? []).map((fact) => ({
    statement: clip(stripQuotes(fact.statement)),
    dueDate: fact.dueDate,
    sourceRefs: fact.sourceRefs,
  }));
}

function portfolioSummary(count: number): string {
  if (count <= 0) return "Nothing needed from you right now.";
  const word = COUNT_WORD[count] ?? String(count);
  const noun = count === 1 ? "action" : "actions";
  return `You have ${word} real founder ${noun}.`;
}

function guidance(focus: readonly CosFeedbackPacketItem[], ignore: readonly CosFeedbackPacketItem[]): string {
  if (focus.length === 0 && ignore.length === 0) return "Nothing needed from you right now.";
  const sequence = focus
    .map((item, index) => {
      const place = PLACE[index] ?? `${index + 1}`;
      return `${item.displayName} ${place}: ${item.currentState || item.displayName}`;
    })
    .join(" ");
  const waiting = ignore.length
    ? ` ${ignore.map((item) => item.displayName).join(" and ")} can wait; ${waitWhy(ignore[0]!)}`
    : "";
  if (!sequence) return `Nothing needed from you right now.${waiting}`;
  return `${portfolioSummary(focus.length)} ${sequence}${waiting}`;
}

function waitWhy(item: CosFeedbackPacketItem): string {
  if (item.ballHolder === "vendor_shop") return "the shop has it.";
  if (item.ballHolder === "client") return "it is with the client.";
  return "it does not need you right now.";
}

function clientWorkStaysAhead(focus: readonly CosFeedbackFocus[], packet: CosFeedbackPacket): boolean {
  const byId = new Map(packet.items.map((item) => [item.itemId, item]));
  let seenInternal = false;
  for (const row of focus) {
    const item = byId.get(row.itemId);
    if (!item) return false;
    if (!item.clientFacing) seenInternal = true;
    if (seenInternal && item.clientFacing && item.currentFounderAction) return false;
  }
  return true;
}

function dateTokens(packet: CosFeedbackPacket): Set<string> {
  const found = new Set<string>();
  const blob = JSON.stringify(packet);
  for (const match of blob.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)) found.add(match[0]);
  for (const match of blob.matchAll(
    /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}\b/gi,
  )) {
    found.add(match[0].toLowerCase().replace(/\./g, ""));
  }
  return found;
}

function hasInventedDate(text: string, allowed: Set<string>): boolean {
  const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
  if (iso.some((date) => !allowed.has(date))) return true;
  const named =
    text.match(
      /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}\b/gi,
    ) ?? [];
  return named.some((date) => !allowed.has(date.toLowerCase().replace(/\./g, "")));
}

function mentionsSchedule(text: string): boolean {
  return /\b(?:i |we |i've |we've )?scheduled\b/i.test(text) || /\bcalendar event\b/i.test(text);
}

function stripQuotes(value: string): string {
  return value
    .split("\n")
    .filter((line) => !/^\s*>/.test(line) && !/\bwrote:\s*$/i.test(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(value: string): string {
  const clean = stripQuotes(value);
  return clean.length > 240 ? clean.slice(0, 240) : clean;
}
