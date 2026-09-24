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
import {
  emitCosFeedbackSettle,
  shortDigest,
  type CosFeedbackSettleRoute,
  type CosFeedbackValidationResult,
} from "./settle-telemetry";

export type { CosFeedbackSettleRoute, CosFeedbackValidationResult };

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
const inflight = new Map<string, Promise<CosFeedbackV1>>();

export function resetCosFeedbackCache(): void {
  cached = null;
  inflight.clear();
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

export function cosFeedbackIsCached(input: {
  docket: CosTodayDocketView;
  sourceWatermark: string;
  nowIso: string;
}): boolean {
  const packet = buildCosFeedbackPacket(input);
  return cached?.key === cacheKey(packet);
}

export function noteCosFeedbackUnavailable(input: {
  docket: CosTodayDocketView;
  sourceWatermark: string;
  nowIso: string;
}): void {
  emitSettle(buildCosFeedbackPacket(input), {
    provider: null,
    model: null,
    outcome: "model_unavailable",
    cache: "miss",
    modelInvoked: false,
    latencyMs: null,
    inputBytes: null,
    outputBytes: null,
    validationResult: "missing_key",
  });
}

export function noteCosFeedbackCacheHit(input: {
  docket: CosTodayDocketView;
  sourceWatermark: string;
  nowIso: string;
  route?: CosFeedbackSettleRoute | null;
}): void {
  emitSettle(buildCosFeedbackPacket(input), {
    provider: input.route?.provider ?? null,
    model: input.route?.model ?? null,
    outcome: "cache_hit",
    cache: "hit",
    modelInvoked: false,
    latencyMs: null,
    inputBytes: null,
    outputBytes: null,
    validationResult: null,
  });
}

export async function refreshCosFeedback(input: {
  docket: CosTodayDocketView;
  sourceWatermark: string;
  nowIso: string;
  model?: CosFeedbackModel | null;
  route?: CosFeedbackSettleRoute | null;
}): Promise<CosFeedbackV1> {
  const packet = buildCosFeedbackPacket(input);
  const key = cacheKey(packet);
  if (cached?.key === key) {
    noteCosFeedbackCacheHit(input);
    return cached.feedback;
  }
  const pending = inflight.get(key);
  if (pending) return pending;
  const job = resolveCosFeedback(packet, key, input.model ?? null, input.route ?? null);
  inflight.set(key, job);
  try {
    return await job;
  } finally {
    if (inflight.get(key) === job) inflight.delete(key);
  }
}

async function resolveCosFeedback(
  packet: CosFeedbackPacket,
  key: string,
  model: CosFeedbackModel | null,
  route: CosFeedbackSettleRoute | null,
): Promise<CosFeedbackV1> {
  const fallback = deriveDeterministicCosFeedback(packet);
  if (!model) {
    cached = { key, feedback: fallback };
    emitSettle(packet, {
      provider: null,
      model: null,
      outcome: "model_unavailable",
      cache: "miss",
      modelInvoked: false,
      latencyMs: null,
      inputBytes: null,
      outputBytes: null,
      validationResult: "missing_key",
    });
    return fallback;
  }
  const started = Date.now();
  const inputBytes = Buffer.byteLength(JSON.stringify(packet), "utf8");
  try {
    const raw = await model(packet);
    const judged = judgeModelFeedback(packet, raw);
    const feedback = judged.feedback ?? fallback;
    cached = { key, feedback };
    emitSettle(packet, {
      provider: route?.provider ?? null,
      model: route?.model ?? null,
      outcome: judged.feedback ? "model_accepted" : "deterministic_fallback",
      cache: "miss",
      modelInvoked: true,
      latencyMs: Date.now() - started,
      inputBytes,
      outputBytes: encodedBytes(raw),
      validationResult: judged.validationResult,
    });
    return feedback;
  } catch (error) {
    cached = { key, feedback: fallback };
    emitSettle(packet, {
      provider: route?.provider ?? null,
      model: route?.model ?? null,
      outcome: "deterministic_fallback",
      cache: "miss",
      modelInvoked: true,
      latencyMs: Date.now() - started,
      inputBytes,
      outputBytes: null,
      validationResult: providerFailure(error),
    });
    return fallback;
  }
}

export function acceptModelFeedback(
  packet: CosFeedbackPacket,
  raw: unknown,
): CosFeedbackV1 | null {
  return judgeModelFeedback(packet, raw).feedback;
}

function judgeModelFeedback(
  packet: CosFeedbackPacket,
  raw: unknown,
): {
  feedback: CosFeedbackV1 | null;
  validationResult: Exclude<CosFeedbackValidationResult, "provider_error" | "timeout" | "missing_key">;
} {
  const rejected = (
    validationResult: Exclude<CosFeedbackValidationResult, "accepted" | "provider_error" | "timeout" | "missing_key">,
  ) => ({ feedback: null, validationResult });
  if (!raw || typeof raw !== "object") return rejected("parse_failure");
  const body = raw as {
    portfolioSummary?: unknown;
    founderGuidance?: unknown;
    focusOrder?: unknown;
    risks?: unknown;
    safeToIgnore?: unknown;
  };
  if (typeof body.portfolioSummary !== "string" || typeof body.founderGuidance !== "string") {
    return rejected("parse_failure");
  }
  if (!Array.isArray(body.focusOrder) || !Array.isArray(body.safeToIgnore)) return rejected("parse_failure");
  const byId = new Map(packet.items.map((item) => [item.itemId, item]));
  const allowedDates = dateTokens(packet);
  const prose = `${body.portfolioSummary}\n${body.founderGuidance}`;
  const proseFailure = scheduleOrDate(prose, allowedDates);
  if (proseFailure) return rejected(proseFailure);

  const focusOrder: CosFeedbackFocus[] = [];
  for (const row of body.focusOrder) {
    if (!row || typeof row !== "object") return rejected("parse_failure");
    const itemId = (row as { itemId?: unknown }).itemId;
    const why = (row as { why?: unknown }).why;
    if (typeof itemId !== "string" || typeof why !== "string") return rejected("parse_failure");
    const item = byId.get(itemId);
    if (!item) return rejected("parse_failure");
    const whyFailure = dateOrSchedule(why, allowedDates);
    if (whyFailure) return rejected(whyFailure);
    focusOrder.push({
      itemId,
      rank: focusOrder.length + 1,
      why: clip(why),
      sourceRefs: item.sourceRefs,
      basis: "recommendation",
    });
  }
  if (!clientWorkStaysAhead(focusOrder, packet)) return rejected("priority_violation");

  const safeToIgnore: CosFeedbackIgnore[] = [];
  for (const row of body.safeToIgnore) {
    if (!row || typeof row !== "object") return rejected("parse_failure");
    const itemId = (row as { itemId?: unknown }).itemId;
    const why = (row as { why?: unknown }).why;
    if (typeof itemId !== "string" || typeof why !== "string") return rejected("parse_failure");
    const item = byId.get(itemId);
    if (!item) return rejected("parse_failure");
    if (item.founderDue || item.currentFounderAction) return rejected("hidden_due_work");
    const whyFailure = dateOrSchedule(why, allowedDates);
    if (whyFailure) return rejected(whyFailure);
    safeToIgnore.push({
      itemId,
      why: clip(why),
      sourceRefs: item.sourceRefs,
      basis: "recommendation",
    });
  }

  const risks: CosFeedbackRisk[] = [];
  if (body.risks != null) {
    if (!Array.isArray(body.risks)) return rejected("parse_failure");
    for (const row of body.risks) {
      if (!row || typeof row !== "object") return rejected("parse_failure");
      const itemId = (row as { itemId?: unknown }).itemId;
      const statement = (row as { statement?: unknown }).statement;
      const basis = (row as { basis?: unknown }).basis;
      if (typeof itemId !== "string" || typeof statement !== "string") return rejected("parse_failure");
      if (basis !== "evidence" && basis !== "recommendation") return rejected("parse_failure");
      const item = byId.get(itemId);
      if (!item) return rejected("parse_failure");
      const statementFailure = dateOrSchedule(statement, allowedDates);
      if (statementFailure) return rejected(statementFailure);
      if (basis === "evidence" && !item.timingFacts.some((fact) => fact.statement === statement)) {
        return rejected("parse_failure");
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
    feedback: {
      modelId: COS_FEEDBACK_MODEL_ID,
      portfolioSummary: clip(body.portfolioSummary),
      focusOrder,
      risks,
      safeToIgnore,
      founderGuidance: clip(body.founderGuidance),
      generatedAt: packet.generatedAt,
      sourceWatermark: packet.sourceWatermark,
    },
    validationResult: "accepted",
  };
}

function emitSettle(
  packet: CosFeedbackPacket,
  fields: Omit<
    Parameters<typeof emitCosFeedbackSettle>[0],
    "event" | "feedbackContract" | "toolsSent" | "sourceWatermarkDigest" | "portfolioDigest"
  >,
): void {
  emitCosFeedbackSettle({
    event: "continuum.cos_feedback.settle",
    feedbackContract: "cos-feedback-v1",
    toolsSent: false,
    sourceWatermarkDigest: shortDigest(packet.sourceWatermark),
    portfolioDigest: shortDigest(cosFeedbackDigest(packet)),
    ...fields,
  });
}

function encodedBytes(value: unknown): number | null {
  if (value == null) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return typeof text === "string" ? Buffer.byteLength(text, "utf8") : null;
}

function providerFailure(error: unknown): "timeout" | "parse_failure" | "provider_error" {
  if (error instanceof SyntaxError) return "parse_failure";
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  const message = error instanceof Error ? error.message : "";
  if (name === "AbortError" || name === "TimeoutError" || /aborted|timeout/i.test(message)) {
    return "timeout";
  }
  return "provider_error";
}

function scheduleOrDate(
  text: string,
  allowed: Set<string>,
): "scheduled_claim" | "invented_date" | null {
  if (mentionsSchedule(text)) return "scheduled_claim";
  if (hasInventedDate(text, allowed)) return "invented_date";
  return null;
}

function dateOrSchedule(
  text: string,
  allowed: Set<string>,
): "invented_date" | "scheduled_claim" | null {
  if (hasInventedDate(text, allowed)) return "invented_date";
  if (mentionsSchedule(text)) return "scheduled_claim";
  return null;
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
