/**
 * Chief of Staff Briefing V1.
 * Presentation over an existing Today packet. Does not change ball-holder,
 * work-loop reduction, or current-action eligibility.
 *
 * Timing sentences are facts copied from evidence.
 * Checkpoint dates are either computed from those facts or labeled recommendations.
 * V1 checkpoint status is advisory until an evidence-based date has arrived,
 * then triggered. Nothing here is a calendar event.
 */

import {
  addCalendarDays,
  civilDateInZone,
  compareDateOnly,
  FOUNDER_BUSINESS_TIME_ZONE,
  parseDateOnly,
  type DateOnly,
} from "@/lib/continuum/date-only";
import type { TodayBriefingPacket } from "./briefing-packet";
import type { TodayRenderedBriefing } from "./briefing-copy";

export const COS_BRIEFING_MODEL_ID = "cos-briefing-v1" as const;

export const COS_BRIEFING_SECTION_TITLE = "Chief of Staff briefing" as const;

export const COS_CHECKPOINT_STATUSES = [
  "advisory",
  "scheduled",
  "triggered",
  "satisfied",
] as const;

export type CosCheckpointStatus = (typeof COS_CHECKPOINT_STATUSES)[number];

export const COS_TIMING_FACT_KINDS = [
  "promised_date",
  "quoted_lead_time",
  "delivery_estimate",
  "quote_validity",
  "client_travel_or_event",
  "production_duration",
  "established_checkpoint",
] as const;

export type CosTimingFactKind = (typeof COS_TIMING_FACT_KINDS)[number];

export type CosTimingFact = {
  kind: CosTimingFactKind;
  statement: string;
  anchorDate: DateOnly | null;
  dueDate: DateOnly | null;
  leadBusinessDays: number | null;
  sourceRefs: readonly string[];
};

export type CosCheckpoint = {
  dueAt: string | null;
  dueDate: DateOnly | null;
  condition: string;
  action: string;
  reason: string | null;
  sourceRefs: readonly string[];
  status: CosCheckpointStatus;
  /** evidence = computed from a quoted fact. recommendation = CoS judgment. */
  basis: "evidence" | "recommendation";
};

export type CosBriefingV1 = {
  modelId: typeof COS_BRIEFING_MODEL_ID;
  currentState: string;
  timingFacts: readonly CosTimingFact[];
  timingProse: string | null;
  checkpoint: CosCheckpoint | null;
  checkpointProse: string;
  why: string | null;
  /** True only when the closed truth layer already has a current founder move. */
  currentFounderAction: boolean;
};

export type CosBriefingEvidence = {
  summary: string;
  at?: string | null;
  sourceRef?: string | null;
};

export type DeriveCosBriefingInput = {
  packet: TodayBriefingPacket;
  rendered?: TodayRenderedBriefing | null;
  evidence?: readonly CosBriefingEvidence[];
  nowIso?: string | null;
};

const MONTH_INDEX: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const VOICE_MONTH = [
  "Jan.",
  "Feb.",
  "March",
  "April",
  "May",
  "June",
  "July",
  "Aug.",
  "Sept.",
  "Oct.",
  "Nov.",
  "Dec.",
] as const;

const SPOKEN_DATE =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:,\s*(\d{4}))?\b/i;

const FILLER =
  /price, timeline, or next steps|best next step|has the next turn|nothing from you right now/i;

export function occupiesCurrentUpNext(briefing: CosBriefingV1): boolean {
  if (briefing.currentFounderAction) return true;
  return briefing.checkpoint?.status === "triggered";
}

export function deriveCosBriefingV1(input: DeriveCosBriefingInput): CosBriefingV1 {
  const packet = input.packet;
  const evidence = evidenceRows(input);
  const hay = evidence.map((row) => row.summary).join("\n");
  const asOf = input.nowIso ? civilDateInZone(input.nowIso, FOUNDER_BUSINESS_TIME_ZONE) : null;
  const year = asOf ? Number(asOf.slice(0, 4)) : evidenceYear(evidence) ?? 2026;
  const facts = collectTimingFacts(hay, evidence, year);
  const currentFounderAction = isCurrentFounderAction(packet);
  const currentState = currentStateOf(packet, input.rendered ?? null, facts, hay);
  const checkpoint = checkpointOf({
    packet,
    rendered: input.rendered ?? null,
    facts,
    hay,
    asOf,
    currentState,
    currentFounderAction,
    sourceRefs: packet.sourceRefs,
  });
  const why = whyOf(facts, hay, checkpoint);
  const timingProse = timingProseOf(facts, currentState);
  return {
    modelId: COS_BRIEFING_MODEL_ID,
    currentState,
    timingFacts: facts,
    timingProse,
    checkpoint,
    checkpointProse: checkpoint?.action
      ? joinProse(checkpoint.action, checkpoint.condition)
      : "Nothing needed now.",
    why,
    currentFounderAction,
  };
}

export function readCosBriefingV1(value: unknown): CosBriefingV1 | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<CosBriefingV1>;
  if (row.modelId !== COS_BRIEFING_MODEL_ID) return null;
  if (typeof row.currentState !== "string" || !row.currentState.trim()) return null;
  if (typeof row.checkpointProse !== "string") return null;
  if (typeof row.currentFounderAction !== "boolean") return null;
  return {
    modelId: COS_BRIEFING_MODEL_ID,
    currentState: clip(row.currentState, 280),
    timingFacts: [],
    timingProse: typeof row.timingProse === "string" ? clip(row.timingProse, 240) : null,
    checkpoint: readCheckpoint(row.checkpoint),
    checkpointProse: clip(row.checkpointProse, 320),
    why: typeof row.why === "string" ? clip(row.why, 240) : null,
    currentFounderAction: row.currentFounderAction,
  };
}

function readCheckpoint(value: CosCheckpoint | null | undefined): CosCheckpoint | null {
  if (!value || typeof value !== "object") return null;
  if (typeof value.action !== "string" || typeof value.condition !== "string") return null;
  const status = COS_CHECKPOINT_STATUSES.includes(value.status) ? value.status : "advisory";
  return {
    dueAt: typeof value.dueAt === "string" ? value.dueAt : null,
    dueDate: parseDateOnly(value.dueDate),
    condition: clip(value.condition, 180),
    action: clip(value.action, 180),
    reason: typeof value.reason === "string" ? clip(value.reason, 180) : null,
    sourceRefs: Array.isArray(value.sourceRefs)
      ? value.sourceRefs.filter((row) => typeof row === "string").slice(0, 8)
      : [],
    status,
    basis: value.basis === "evidence" ? "evidence" : "recommendation",
  };
}

function evidenceRows(input: DeriveCosBriefingInput): CosBriefingEvidence[] {
  const rows: CosBriefingEvidence[] = [...(input.evidence ?? [])];
  const external = input.packet.latestMeaningfulExternalEvent;
  const founder = input.packet.latestMeaningfulFounderAction;
  if (external?.summary) {
    rows.push({ summary: external.summary, at: external.at, sourceRef: external.sourceRef });
  }
  if (founder?.summary) {
    rows.push({ summary: founder.summary, at: founder.at, sourceRef: founder.sourceRef });
  }
  if (input.packet.externalCommitment) rows.push({ summary: input.packet.externalCommitment });
  if (input.packet.nextExpectedEvent) rows.push({ summary: input.packet.nextExpectedEvent });
  return rows.filter((row) => row.summary.trim().length > 0);
}

function isCurrentFounderAction(packet: TodayBriefingPacket): boolean {
  if (packet.ballHolder === "founder") return true;
  if (packet.briefingKind === "founder_print_check") return true;
  if (
    packet.semanticNextActionClass === "founder_review" ||
    packet.semanticNextActionClass === "founder_print_check"
  ) {
    return true;
  }
  return false;
}

function collectTimingFacts(
  hay: string,
  evidence: readonly CosBriefingEvidence[],
  fallbackYear: number,
): CosTimingFact[] {
  const facts: CosTimingFact[] = [];
  const lead = hay.match(
    /(?:~|about\s+|approximately\s+|around\s+)?(\d{1,2})\s+business\s+days(?:\s+from\s+([A-Za-z.]+\s+\d{1,2}(?:,\s*\d{4})?))?/i,
  );
  if (lead) {
    const days = Number(lead[1]);
    const spokenAnchor = lead[2] ? spokenDate(lead[2], fallbackYear) : null;
    const anchor = spokenAnchor ?? evidenceAnchor(evidence, hay);
    const due = anchor && days > 0 && days <= 60 ? addBusinessDays(anchor, days) : null;
    const statement = anchor
      ? `Estimated ~${days} business days from ${formatCosDate(anchor)}.`
      : `Estimated ~${days} business days. No start date is on the evidence.`;
    facts.push({
      kind: "quoted_lead_time",
      statement,
      anchorDate: anchor,
      dueDate: due,
      leadBusinessDays: days,
      sourceRefs: refsFrom(evidence),
    });
  }

  const delivery = hay.match(
    /\b(?:estimated\s+)?deliver(?:y|ed)\s+(?:is\s+|by\s+|on\s+|around\s+)?([A-Za-z.]+\s+\d{1,2}(?:,\s*\d{4})?)/i,
  );
  if (delivery) {
    const due = spokenDate(delivery[1] ?? "", fallbackYear);
    if (due) {
      facts.push({
        kind: "delivery_estimate",
        statement: `Estimated delivery ${formatCosDate(due)}.`,
        anchorDate: null,
        dueDate: due,
        leadBusinessDays: null,
        sourceRefs: refsFrom(evidence),
      });
    }
  }

  const quote = hay.match(
    /\bquote\b[^.\n]{0,80}\bvalid\s+(?:until|through)\s+([A-Za-z.]+\s+\d{1,2}(?:,\s*\d{4})?)/i,
  );
  if (quote) {
    const due = spokenDate(quote[1] ?? "", fallbackYear);
    if (due) {
      facts.push({
        kind: "quote_validity",
        statement: `Quote is valid through ${formatCosDate(due)}.`,
        anchorDate: null,
        dueDate: due,
        leadBusinessDays: null,
        sourceRefs: refsFrom(evidence),
      });
    }
  }

  const travel = hay.match(
    /\b(?:travel(?:ing|s|l)?|wedding)\b[^.\n]{0,60}\b([A-Za-z.]+\s+\d{1,2}(?:,\s*\d{4})?)/i,
  );
  if (travel) {
    const due = spokenDate(travel[1] ?? "", fallbackYear);
    if (due) {
      facts.push({
        kind: "client_travel_or_event",
        statement: `Client date ${formatCosDate(due)}.`,
        anchorDate: null,
        dueDate: due,
        leadBusinessDays: null,
        sourceRefs: refsFrom(evidence),
      });
    }
  }
  return facts;
}

function checkpointOf(input: {
  packet: TodayBriefingPacket;
  rendered: TodayRenderedBriefing | null;
  facts: readonly CosTimingFact[];
  hay: string;
  asOf: DateOnly | null;
  currentState: string;
  currentFounderAction: boolean;
  sourceRefs: readonly string[];
}): CosCheckpoint | null {
  const lead = input.facts.find((fact) => fact.kind === "quoted_lead_time" && fact.dueDate);
  const delivery = input.facts.find((fact) => fact.kind === "delivery_estimate" && fact.dueDate);
  const quote = input.facts.find((fact) => fact.kind === "quote_validity" && fact.dueDate);
  const travel = input.facts.find((fact) => fact.kind === "client_travel_or_event" && fact.dueDate);

  if (!input.currentFounderAction && lead?.dueDate && lead.anchorDate) {
    const windowStart = previousBusinessDay(lead.dueDate) ?? lead.dueDate;
    const window =
      windowStart === lead.dueDate
        ? formatCosDate(lead.dueDate)
        : `${formatCosDate(windowStart)}–${formatCosDate(lead.dueDate)}`;
    return finishCheckpoint({
      dueDate: lead.dueDate,
      action: "Nothing needed from you now.",
      condition: `If the final CAD has not landed by around ${window}, bring this back up.`,
      reason: lead.statement,
      sourceRefs: input.sourceRefs,
      asOf: input.asOf,
      basis: "evidence",
    });
  }

  if (!input.currentFounderAction && delivery?.dueDate) {
    const check = addCalendarDays(delivery.dueDate, -7);
    return finishCheckpoint({
      dueDate: check,
      action: "Nothing needed now.",
      condition: `Proactively check around ${formatCosDate(check)} so ${formatCosDate(delivery.dueDate)} is not the first time we discover a delay.`,
      reason: delivery.statement,
      sourceRefs: input.sourceRefs,
      asOf: input.asOf,
      basis: "evidence",
    });
  }

  if (!input.currentFounderAction && quote?.dueDate) {
    return finishCheckpoint({
      dueDate: quote.dueDate,
      action: "Nothing needed now.",
      condition: `Reconfirm the price before proceeding once ${formatCosDate(quote.dueDate)} passes.`,
      reason: quote.statement,
      sourceRefs: input.sourceRefs,
      asOf: input.asOf,
      basis: "evidence",
    });
  }

  if (!input.currentFounderAction && travel?.dueDate) {
    const check = addCalendarDays(travel.dueDate, -7);
    return finishCheckpoint({
      dueDate: check,
      action: "Nothing needed now.",
      condition: `Status check around ${formatCosDate(check)}, a week before ${formatCosDate(travel.dueDate)}.`,
      reason: travel.statement,
      sourceRefs: input.sourceRefs,
      asOf: input.asOf,
      basis: "evidence",
    });
  }

  if (input.currentFounderAction && /order confirmation/i.test(`${input.hay} ${input.currentState}`)) {
    return finishCheckpoint({
      dueDate: input.asOf,
      action: "Review the confirmation today for discrepancies.",
      condition: "If clean, no further action until the next production milestone.",
      reason: null,
      sourceRefs: input.sourceRefs,
      asOf: input.asOf,
      basis: "recommendation",
    });
  }

  if (input.currentFounderAction) {
    const next = usable(input.rendered?.nextBody) ?? usable(input.packet.candidateNextAction);
    const action = next && !sameProse(next, input.currentState) ? next : "Handle this today.";
    return finishCheckpoint({
      dueDate: input.asOf,
      action: /today|tomorrow/i.test(action) ? action : action.replace(/\.$/, "") + " today.",
      condition: "After that, leave it until the next real milestone.",
      reason: null,
      sourceRefs: input.sourceRefs,
      asOf: input.asOf,
      basis: "recommendation",
    });
  }

  if (input.packet.ballHolder === "vendor_shop" || input.packet.ballHolder === "client") {
    const org = voiceName(input.packet.organizationLabel || "them");
    const waitingOnCad = /cad|stl|workshop/i.test(input.hay);
    return finishCheckpoint({
      dueDate: input.asOf ? addCalendarDays(input.asOf, 1) : null,
      action: "Nothing needed now.",
      condition: waitingOnCad
        ? `If it has not landed tomorrow, check again with ${org}.`
        : input.packet.ballHolder === "client"
          ? `Bring this back only if ${input.packet.displayName} goes quiet.`
          : "Bring this back when the next shop note lands.",
      reason: null,
      sourceRefs: input.sourceRefs,
      asOf: input.asOf,
      basis: "recommendation",
    });
  }

  return finishCheckpoint({
    dueDate: null,
    action: "Nothing needed now.",
    condition: "Leave it until a later event lands.",
    reason: null,
    sourceRefs: input.sourceRefs,
    asOf: input.asOf,
    basis: "recommendation",
  });
}

function finishCheckpoint(input: {
  dueDate: DateOnly | null;
  action: string;
  condition: string;
  reason: string | null;
  sourceRefs: readonly string[];
  asOf: DateOnly | null;
  basis: "evidence" | "recommendation";
}): CosCheckpoint {
  const due = input.basis === "evidence" && input.dueDate && input.asOf && compareDateOnly(input.dueDate, input.asOf) <= 0;
  return {
    dueAt: null,
    dueDate: input.dueDate,
    condition: sentence(input.condition),
    action: sentence(input.action),
    reason: input.reason,
    sourceRefs: input.sourceRefs,
    status: due ? "triggered" : "advisory",
    basis: input.basis,
  };
}

function currentStateOf(
  packet: TodayBriefingPacket,
  rendered: TodayRenderedBriefing | null,
  facts: readonly CosTimingFact[],
  hay: string,
): string {
  const org = voiceName(packet.organizationLabel || "the shop");
  if (isCurrentFounderAction(packet)) {
    if (/order confirmation/i.test(hay)) {
      const order = hay.match(/\b(SP\d{4,})\b/i);
      return order ? `${order[1]!.toUpperCase()} order confirmation is in.` : "Order confirmation is in.";
    }
    const headline = usable(rendered?.headline);
    if (headline && !FILLER.test(headline)) return sentence(headline);
    const obligation = usable(packet.unresolvedFounderObligation) ?? usable(packet.candidateNextAction);
    if (obligation) return sentence(obligation);
    return "You're up.";
  }
  const lead = facts.find((fact) => fact.kind === "quoted_lead_time");
  if (lead && /workshop|stone|final cad|rn\d/i.test(hay)) {
    return sentence(
      `Stone is at the workshop. ${org} estimated final CAD in ~${lead.leadBusinessDays} business days${
        lead.anchorDate ? ` from ${formatCosDate(lead.anchorDate)}` : ""
      }`,
    );
  }
  const delivery = facts.find((fact) => fact.kind === "delivery_estimate");
  if (delivery?.dueDate) return delivery.statement;
  if (packet.ballHolder === "vendor_shop" && /cad|stl|workshop/i.test(hay)) {
    const clar = clarification(hay);
    if (/workshop|stone/i.test(hay)) {
      return sentence(`Stone is at the workshop. Final CAD is still with ${org}`);
    }
    return clar
      ? `Updated CAD is with ${org} after ${clar}.`
      : `Updated CAD is with ${org}.`;
  }
  if (packet.ballHolder === "client") {
    return `The last note is with ${packet.displayName}.`;
  }
  const headline = usable(rendered?.headline);
  if (headline && !FILLER.test(headline)) return sentence(headline);
  return "No founder action is proven.";
}

function whyOf(
  facts: readonly CosTimingFact[],
  hay: string,
  checkpoint: CosCheckpoint | null,
): string | null {
  const quote = facts.find((fact) => fact.kind === "quote_validity");
  if (quote?.dueDate && checkpoint?.basis === "evidence") {
    return `The quote expires ${formatCosDate(quote.dueDate)}.`;
  }
  const travel = facts.find((fact) => fact.kind === "client_travel_or_event");
  if (travel?.dueDate) return `There is a client date on ${formatCosDate(travel.dueDate)}.`;
  if (/\bslipped\b|\bagain\b|second time/i.test(hay) && /cad|delivery|quote/i.test(hay)) {
    return "This has already slipped once.";
  }
  return null;
}

function timingProseOf(facts: readonly CosTimingFact[], currentState: string): string | null {
  const next = facts.find((fact) => !currentState.includes(fact.statement.replace(/\.$/, "")));
  if (!next) return null;
  if (currentState.toLowerCase().includes("business day") && next.kind === "quoted_lead_time") return null;
  if (currentState.toLowerCase().includes("delivery") && next.kind === "delivery_estimate") return null;
  return next.statement;
}

function voiceName(label: string): string {
  const trimmed = label.trim();
  if (!trimmed || trimmed === "the shop" || trimmed === "them") return trimmed;
  if (trimmed === trimmed.toLowerCase()) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
  return trimmed;
}

function clarification(hay: string): string | null {
  if (/prong/i.test(hay)) return "the prong clarification";
  if (/finger size|size change/i.test(hay)) return "the size change";
  return null;
}

function usable(text: string | null | undefined): string | null {
  const trimmed = text?.replace(/\s+/g, " ").trim() ?? "";
  if (!trimmed || FILLER.test(trimmed)) return null;
  if (/^you(?:'re| are) up\.?$/i.test(trimmed)) return null;
  return trimmed;
}

function sameProse(left: string, right: string): boolean {
  return left.replace(/[.]+$/g, "").trim().toLowerCase() === right.replace(/[.]+$/g, "").trim().toLowerCase();
}

function joinProse(action: string, condition: string): string {
  if (!condition || sameProse(action, condition)) return sentence(action);
  return `${sentence(action)} ${sentence(condition)}`.replace(/\s{2,}/g, " ");
}

function sentence(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function clip(text: string, max: number): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

export function formatCosDate(date: DateOnly | null): string {
  if (!date) return "";
  const parsed = parseDateOnly(date);
  if (!parsed) return "";
  const month = Number(parsed.slice(5, 7));
  const day = Number(parsed.slice(8, 10));
  const label = VOICE_MONTH[month - 1];
  if (!label || !day) return parsed;
  return `${label} ${day}`;
}

export function addBusinessDays(date: DateOnly, days: number): DateOnly | null {
  if (!Number.isInteger(days) || days < 0 || days > 60) return null;
  let cursor: DateOnly | null = date;
  let left = days;
  while (left > 0) {
    cursor = cursor ? addCalendarDays(cursor, 1) : null;
    if (!cursor) return null;
    const dow = weekday(cursor);
    if (dow !== 0 && dow !== 6) left -= 1;
  }
  return cursor;
}

function previousBusinessDay(date: DateOnly): DateOnly | null {
  let cursor: DateOnly | null = date;
  for (let i = 0; i < 7; i += 1) {
    cursor = cursor ? addCalendarDays(cursor, -1) : null;
    if (!cursor) return null;
    const dow = weekday(cursor);
    if (dow !== 0 && dow !== 6) return cursor;
  }
  return null;
}

function weekday(date: DateOnly): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function spokenDate(text: string, fallbackYear: number): DateOnly | null {
  const match = text.match(SPOKEN_DATE);
  if (!match) return null;
  const month = MONTH_INDEX[match[1]!.replace(".", "").toLowerCase()];
  const day = Number(match[2]);
  const year = match[3] ? Number(match[3]) : fallbackYear;
  if (!month || day < 1 || day > 31 || year < 2000) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return parseDateOnly(iso);
}

function evidenceAnchor(evidence: readonly CosBriefingEvidence[], hay: string): DateOnly | null {
  const leadRow = evidence.find((row) => /business\s+days/i.test(row.summary));
  const stamp = leadRow?.at ?? evidence.find((row) => /business\s+days/i.test(hay) && row.at)?.at;
  if (!stamp) return null;
  return civilDateInZone(stamp, FOUNDER_BUSINESS_TIME_ZONE) ?? parseDateOnly(stamp);
}

function evidenceYear(evidence: readonly CosBriefingEvidence[]): number | null {
  for (const row of evidence) {
    const date = row.at ? civilDateInZone(row.at, FOUNDER_BUSINESS_TIME_ZONE) ?? parseDateOnly(row.at) : null;
    if (date) return Number(date.slice(0, 4));
  }
  return null;
}

function refsFrom(evidence: readonly CosBriefingEvidence[]): string[] {
  return evidence.map((row) => row.sourceRef).filter((row): row is string => Boolean(row)).slice(0, 8);
}
