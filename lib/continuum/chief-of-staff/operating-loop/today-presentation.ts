/**
 * Sterling's bounded presentation over a canonical Today item.
 *
 * This module is deliberately pure: it does not rank, persist, or change the
 * underlying ball-holder. It only turns already-composed Continuum truth into
 * concise founder-facing language and fails closed to REVIEW on contradictions.
 */

import type { CosDocketItemView } from "./types";

export const TODAY_SEMANTIC_STATES = [
  "FOUNDER ACTION",
  "WAITING ON CLIENT",
  "WAITING ON SHOP",
  "WAITING",
  "HELD",
  "SNOOZED",
  "RESOLVED",
  "REVIEW",
] as const;

export type TodaySemanticState = (typeof TODAY_SEMANTIC_STATES)[number];

export type TodaySemanticPresentation = {
  title: string;
  summary: string;
  stateLabel: TodaySemanticState;
  ownerLabel: "Justin" | "Client" | "Shop" | "External" | "Review";
  founderCheckpoint: string;
  suggestedAction: string | null;
  confidence: "high" | "review";
  conflict: boolean;
  likelyNoise: boolean;
  reason: string;
};

const RECEIPT_REQUEST = /\b(?:please\s+)?confirm (?:the )?receipt|\bconfirm (?:you )?(?:received|got) (?:this|the (?:email|message))\b/i;
const AUTOMATED_NOISE = /\b(?:unsubscribe|marketing (?:email|message)|automated (?:email|message|notice)|do not reply|noreply|no-reply|technology update|system notification)\b/i;
const HELD = /\b(?:held|hold|on hold)\b/i;
const SNOOZED = /\bsnoozed?\b/i;
const RESOLVED = /\b(?:resolved|complete|completed|cancelled|canceled)\b/i;

export function normalizeFounderFacingSource(value: string | null | undefined): string {
  const raw = value ?? "";
  const withoutQuoted = raw
    .split(/\n(?:On .+ wrote:|From:\s|Sent:\s|-{2,}\s*Original Message\s*-{2,})/i)[0]
    .replace(/\b(?:best regards|kind regards|sincerely|thanks,)[\s\S]*$/i, "")
    .replace(/\b(?:unsubscribe|view in browser|privacy policy)\b[\s\S]*$/i, "")
    .replace(/^(?:re|fwd?):\s*/i, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!withoutQuoted) return "";

  const chunks = withoutQuoted
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const chunk of chunks) {
    const key = chunk.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(chunk);
    if (unique.join(" ").length >= 220) break;
  }
  const joined = unique.join(" ").trim();
  if (joined.length <= 220) return joined;
  const clipped = joined.slice(0, 217).replace(/\s+\S*$/, "").trim();
  return `${clipped}…`;
}

export function isLikelyOperationalNoise(value: string): boolean {
  return RECEIPT_REQUEST.test(value) || AUTOMATED_NOISE.test(value);
}

export function presentTodayItem(item: CosDocketItemView): TodaySemanticPresentation {
  const packet = item.briefingPacket ?? null;
  const briefing = item.briefing ?? null;
  const sourceHay = [
    item.subject,
    item.headline,
    item.context,
    briefing?.headline,
    briefing?.stand,
    briefing?.nextBody,
    ...(item.brief?.evidence.map((beat) => beat.summary) ?? []),
  ].filter((value): value is string => Boolean(value)).join(" ");
  const likelyNoise = isLikelyOperationalNoise(sourceHay);

  let stateLabel = semanticState(item);
  const conflict = hasSemanticConflict(item, stateLabel);
  if (conflict) stateLabel = "REVIEW";

  const title = likelyNoise
    ? RECEIPT_REQUEST.test(sourceHay)
      ? "Receipt confirmation request"
      : "Low-value automated message"
    : normalizeFounderFacingSource(briefing?.headline ?? item.headline) || "Review this item";
  const summary = likelyNoise
    ? RECEIPT_REQUEST.test(sourceHay)
      ? "The sender is asking for confirmation that the message arrived."
      : "This appears automated and has no clear operational consequence."
    : normalizeFounderFacingSource(briefing?.stand ?? item.context ?? item.headline) || title;

  const checkpoint = founderCheckpoint(item, stateLabel, likelyNoise);
  const suggestedAction = suggestedNextAction(item, stateLabel, likelyNoise);
  return {
    title,
    summary,
    stateLabel,
    ownerLabel: ownerFor(stateLabel),
    founderCheckpoint: checkpoint,
    suggestedAction,
    confidence: conflict || packet?.uncertainty.length ? "review" : "high",
    conflict,
    likelyNoise,
    reason: reasonFor(item, stateLabel, likelyNoise),
  };
}

function semanticState(item: CosDocketItemView): TodaySemanticState {
  if (item.origin === "master_sprint") return "FOUNDER ACTION";
  const projection = item.briefingPacket?.projection;
  const dependency = projection?.dependency ?? item.briefingPacket?.nextExpectedEvent ?? "";
  if (projection?.stage === "complete") return "RESOLVED";
  if (HELD.test(dependency)) return "HELD";
  if (item.briefingPacket?.ballHolder === "scheduled_future") {
    return SNOOZED.test(dependency) ? "SNOOZED" : "HELD";
  }
  if (RESOLVED.test(item.headline) && item.origin === "open_job") return "RESOLVED";
  const holder = item.briefingPacket?.ballHolder;
  if (holder === "founder") return "FOUNDER ACTION";
  if (holder === "client") return "WAITING ON CLIENT";
  if (holder === "vendor_shop") return "WAITING ON SHOP";
  return "WAITING";
}

function hasSemanticConflict(item: CosDocketItemView, state: TodaySemanticState): boolean {
  const cos = item.cosBriefing;
  const briefing = item.briefing;
  if (state === "FOUNDER ACTION") {
    if (cos && !cos.currentFounderAction) return true;
    if (/nothing (?:needed|required|from you)|no active obligation/i.test(`${cos?.checkpointProse ?? ""} ${briefing?.nextBody ?? ""}`)) return true;
  }
  if ((state === "WAITING ON SHOP" || state === "WAITING ON CLIENT" || state === "HELD") && cos?.currentFounderAction) return true;
  if ((state === "HELD" || state === "SNOOZED" || state === "RESOLVED") && briefing?.stateChip === "YOUR MOVE") return true;
  if (state === "RESOLVED" && Boolean(briefing?.nextBody?.trim())) return true;
  return false;
}

function founderCheckpoint(item: CosDocketItemView, state: TodaySemanticState, noise: boolean): string {
  if (state === "REVIEW") return "Continuum sources conflict. Review the evidence before acting.";
  if (noise) return "Dismiss it unless this sender needs a receipt confirmation.";
  if (state === "FOUNDER ACTION") {
    return normalizeFounderFacingSource(
      item.briefing?.nextBody ??
        item.briefingPacket?.candidateNextAction ??
        item.briefingPacket?.unresolvedFounderObligation ??
        item.cosBriefing?.checkpointProse,
    ) || "Review the evidence and choose the next move.";
  }
  if (state === "WAITING ON SHOP") return "Nothing needed now; the shop owns the next move.";
  if (state === "WAITING ON CLIENT") return "Nothing needed now; the client owns the next move.";
  if (state === "HELD") return "No action until the hold condition is met.";
  if (state === "SNOOZED") return "No action until the snooze ends.";
  if (state === "RESOLVED") return "No open action.";
  return "No founder action is proven yet.";
}

function suggestedNextAction(item: CosDocketItemView, state: TodaySemanticState, noise: boolean): string | null {
  if (state === "REVIEW") return "Open Evidence";
  if (noise) return "Dismiss";
  if (state === "FOUNDER ACTION") {
    return normalizeFounderFacingSource(item.briefing?.nextBody ?? item.briefingPacket?.candidateNextAction) || "Review";
  }
  return null;
}

function ownerFor(state: TodaySemanticState): TodaySemanticPresentation["ownerLabel"] {
  if (state === "FOUNDER ACTION") return "Justin";
  if (state === "WAITING ON CLIENT") return "Client";
  if (state === "WAITING ON SHOP") return "Shop";
  if (state === "REVIEW") return "Review";
  return "External";
}

function reasonFor(item: CosDocketItemView, state: TodaySemanticState, noise: boolean): string {
  if (noise) return "Sterling classified this as likely low-value; the source remains available in Evidence.";
  if (state === "REVIEW") return "Canonical signals disagree, so Sterling is not presenting a confident action.";
  if (item.cosBriefing?.why) return normalizeFounderFacingSource(item.cosBriefing.why);
  if (state === "FOUNDER ACTION") return "A current founder-owned obligation keeps this on Today.";
  return "This remains visible because an external next move or checkpoint is still open.";
}
