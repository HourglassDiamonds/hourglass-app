/**
 * Reduce one current work-loop state from all strongly associated evidence.
 * Per-thread packets are inputs; they are not independently authoritative.
 * Read-model only.
 */

import { authorOwnedText } from "@/lib/continuum/gmail/candidates/spec-provenance";
import type { CosEvidenceBeat } from "./types";
import type { TodayBallHolder, TodayBriefingKind } from "./briefing-packet";
import type { RemainingFounderCommitment, ThreadWaitingKind } from "./thread-truth";
import {
  isAmbiguousFollowUpFragment,
  isCurrentInboundAskText,
  isGenericFallbackObligationText,
} from "./obligation-currentness";

export type WorkLoopActor = "founder" | "client" | "vendor_shop" | "system";

export type WorkLoopDependency = "vendor_shop" | "founder" | "client";

export type WorkLoopEventType =
  | "founder_asks_vendor"
  | "founder_instructs_vendor"
  | "vendor_promises_delivery"
  | "vendor_delivers"
  | "founder_print_check"
  | "founder_asks_client"
  | "client_turn"
  | "founder_obligation"
  | "other";

export type WorkLoopEvent = {
  timestamp: string | null;
  sortMs: number;
  actor: WorkLoopActor;
  eventType: WorkLoopEventType;
  opens: WorkLoopDependency | null;
  satisfies: WorkLoopDependency | null;
  text: string;
  sourceRef: string | null;
  threadId: string | null;
};

export type ReducedWorkLoopState = {
  ballHolder: TodayBallHolder;
  briefingKind: TodayBriefingKind;
  vendorOpen: boolean;
  founderOpen: boolean;
  clientOpen: boolean;
  latestFounderText: string | null;
  latestExternalText: string | null;
  nextExpectedEvent: string | null;
};

const STL_DELIVERED =
  /\b(?:mod\s*\d+\s+)?stl\b.{0,80}\b(?:attached|delivered|sent|here|ready)\b|\b(?:attached|delivered|sent|here|ready).{0,80}\b(?:mod\s*\d+\s+)?stl\b|\bhere is the\b[^.!?\n]{0,80}\b(?:mod\s*\d+\s+)?stl\b/i;
const CAD_DELIVERED =
  /\b(?:here is|attached|delivered|sent)\b[^.!?\n]{0,80}\b(?:updated\s+)?cad\b|\b(?:updated\s+)?cad\b[^.!?\n]{0,40}\b(?:attached|delivered|sent)\b/i;
const CAD_FORTHCOMING =
  /\b(?:updated CAD|CAD as soon as|CAD when it(?:'s| is) ready|(?:I|we|she|they)(?:'ll| will) send (?:you )?(?:the )?(?:updated )?(?:CAD|STL|file)|send (?:you )?(?:the )?updated CAD)\b/i;
const PRINT_CHECK =
  /\bI(?:'ll| will| am going to| planned to)?\s*(?:print|check|show|look at)[^.!?\n]{0,180}|\b(?:print(?:ing)?|check(?:ing)?)\s+(?:the\s+)?(?:updated\s+)?(?:model|stl|earring|huggie|size|proportion)/i;
const FOUNDER_ASKS_VENDOR =
  /\b(?:can you|could you|please)\s+(?:send|make|revise|update|price|quote)\b|\b(?:updated CAD|STL file|current changes|platinum-bead pricing)\b/i;
const FOUNDER_INSTRUCTS_VENDOR =
  /\b(?:moving forward|please proceed|go ahead|all three bands|all platinum|all lab)\b/i;
const FOUNDER_STILL_OWNS =
  /\bsending the\b(?![^.!?\n]{0,40}\bto the shop\b)|\bI(?:'ll| will) (?:get|show|bring|mail|ship)\b/i;
const FOUNDER_ASKS_CLIENT =
  /\b(?:let me know(?: what you think)?|when you (?:have a chance|can)|looks? good to you)\b/i;
const CLIENT_ASKS_FOUNDER =
  /\bwhat do (?:you|we) think we should do\b|\bwhat(?:'s| is) next\b|\bwhat should we do next\b/i;
const SHOP_REVIEW_COPY =
  /\breview the latest shop (?:turn|update)\b/i;
const INTERNAL_QA_COPY =
  /\bgmail evidence\b|marked complete, but newer evidence disagrees|newer evidence disagrees/i;

export function isShopReviewFallbackText(text: string | null | undefined): boolean {
  return SHOP_REVIEW_COPY.test(text ?? "");
}

export function isInternalQaCopy(text: string | null | undefined): boolean {
  return INTERNAL_QA_COPY.test(text ?? "");
}

export function isUnsafeBriefingFragment(text: string | null | undefined): boolean {
  const trimmed = text?.replace(/\s+/g, " ").trim() ?? "";
  if (!trimmed) return true;
  if (/^(?:platinum|gold|silver|white gold|yellow gold|rose gold)\.?$/i.test(trimmed)) return true;
  if (/\bexpress my extreme gratitude\b/i.test(trimmed)) return true;
  if (/\bfollow up with you and express\b/i.test(trimmed)) return true;
  if (/\bcircle back\b/i.test(trimmed) && trimmed.split(/\s+/).length <= 8) return true;
  if (/\b(?:with|for|to|from|and)\.?$/i.test(trimmed) && trimmed.split(/\s+/).filter((word) => /[a-zA-Z]{3,}/.test(word)).length <= 4) {
    return true;
  }
  return false;
}

export type ReduceWorkLoopInput = {
  evidence: readonly CosEvidenceBeat[];
  founderOwnTexts?: readonly string[];
  vendorOwnTexts?: readonly string[];
  remaining?: RemainingFounderCommitment | null;
  waitingState?: ThreadWaitingKind | string | null;
  communication?: string | null;
  noFounderAction?: boolean;
};

export function reduceWorkLoop(input: ReduceWorkLoopInput): ReducedWorkLoopState {
  const events = eventsFromInput(input);
  let vendorOpen = false;
  let founderOpen = false;
  let clientOpen = false;
  let founderPending = false;
  if (input.waitingState === "cad" || input.waitingState === "shop" || input.waitingState === "production") {
    vendorOpen = true;
  } else if (input.waitingState === "client") {
    clientOpen = true;
  } else if (input.communication === "vendor") {
    vendorOpen = true;
  }

  let latestFounderText: string | null = null;
  let latestExternalText: string | null = null;

  for (const event of events) {
    if (event.satisfies === "vendor_shop") {
      vendorOpen = false;
      founderOpen = true;
      clientOpen = false;
    }
    if (event.satisfies === "founder") founderOpen = false;
    if (event.satisfies === "client") clientOpen = false;
    if (event.opens === "vendor_shop") {
      vendorOpen = true;
      founderOpen = false;
      clientOpen = false;
    } else if (event.opens === "founder") {
      if (event.eventType === "founder_print_check" && vendorOpen) {
        founderPending = true;
      } else {
        founderOpen = true;
        vendorOpen = false;
        clientOpen = false;
      }
    } else if (event.opens === "client" && !vendorOpen) {
      clientOpen = true;
      founderOpen = false;
    }
    if (event.actor === "founder" && event.text) latestFounderText = event.text;
    if (event.actor !== "founder" && event.text) latestExternalText = event.text;
  }

  if (founderPending && !vendorOpen) {
    founderOpen = true;
    clientOpen = false;
  }

  const cadWait = unresolvedCadWait(events, input.waitingState);
  if (cadWait) {
    vendorOpen = true;
    founderOpen = false;
    clientOpen = false;
  }
  applyRemaining(input, {
    vendorOpen: () => vendorOpen,
    setVendorOpen: (value) => {
      vendorOpen = value;
    },
    setFounderOpen: (value) => {
      founderOpen = value;
    },
    setClientOpen: (value) => {
      clientOpen = value;
    },
    cadWait,
  });

  const ballHolder: TodayBallHolder = vendorOpen
    ? "vendor_shop"
    : founderOpen
      ? "founder"
      : clientOpen
        ? "client"
        : "unknown";
  const printCheck =
    ballHolder === "founder" &&
    (founderPending ||
      events.some((row) => row.eventType === "founder_print_check" || row.eventType === "vendor_delivers"));
  const briefingKind: TodayBriefingKind = printCheck
    ? "founder_print_check"
    : ballHolder === "vendor_shop" && (cadWait || input.waitingState === "cad")
      ? "vendor_cad_wait"
      : ballHolder === "client"
        ? "client_wait"
        : "generic";
  const nextExpectedEvent =
    ballHolder === "vendor_shop"
      ? briefingKind === "vendor_cad_wait"
        ? "Updated CAD/STL from the shop"
        : "Shop turn on current instructions"
      : ballHolder === "founder"
        ? printCheck
          ? "Founder print/check, then client update"
          : "Founder action"
        : ballHolder === "client"
          ? "Client reply"
          : null;

  return {
    ballHolder,
    briefingKind,
    vendorOpen,
    founderOpen,
    clientOpen,
    latestFounderText,
    latestExternalText,
    nextExpectedEvent,
  };
}

function remainingTextOf(input: ReduceWorkLoopInput): string {
  return (input.remaining?.matchedText ?? input.remaining?.recommended ?? "").replace(/\s+/g, " ").trim();
}

function remainingIsUsable(text: string): boolean {
  if (!text) return false;
  if (isShopReviewFallbackText(text) || isInternalQaCopy(text) || isUnsafeBriefingFragment(text)) {
    return false;
  }
  if (isGenericFallbackObligationText(text) || isAmbiguousFollowUpFragment(text)) return false;
  return true;
}

function unresolvedCadWait(
  events: readonly WorkLoopEvent[],
  waitingState: ThreadWaitingKind | string | null | undefined,
): boolean {
  let cad = waitingState === "cad";
  for (const event of events) {
    if (event.eventType === "founder_asks_vendor" || event.eventType === "vendor_promises_delivery") {
      cad = true;
    }
    if (event.eventType === "vendor_delivers") cad = false;
  }
  return cad;
}

function applyRemaining(
  input: ReduceWorkLoopInput,
  state: {
    vendorOpen: () => boolean;
    setVendorOpen: (value: boolean) => void;
    setFounderOpen: (value: boolean) => void;
    setClientOpen: (value: boolean) => void;
    cadWait: boolean;
  },
): void {
  const text = remainingTextOf(input);
  if (!remainingIsUsable(text)) return;
  const inbound = isCurrentInboundAskText(text) || CLIENT_ASKS_FOUNDER.test(text);
  const classified = classifyEvent(text, inbound ? "client" : "founder");
  if (classified.eventType === "founder_asks_client" || classified.opens === "client") {
    if (!state.vendorOpen() && !state.cadWait) {
      state.setClientOpen(true);
      state.setFounderOpen(false);
    }
    return;
  }
  if (classified.opens === "vendor_shop") {
    state.setVendorOpen(true);
    state.setFounderOpen(false);
    state.setClientOpen(false);
    return;
  }
  if (state.cadWait) return;
  state.setFounderOpen(true);
  state.setVendorOpen(false);
  state.setClientOpen(false);
}

export function eventsFromInput(input: ReduceWorkLoopInput): WorkLoopEvent[] {
  const events: WorkLoopEvent[] = [];
  let index = 0;
  const pushBeat = (beat: CosEvidenceBeat) => {
    const text = authorOwnedText(beat.summary) || beat.summary;
    const actor = actorOf(beat.speaker);
    const classified = classifyEvent(text, actor);
    events.push({
      timestamp: beat.timestamp || beat.at || null,
      sortMs: eventMs(beat.timestamp || beat.at, index++),
      actor,
      eventType: classified.eventType,
      opens: classified.opens,
      satisfies: classified.satisfies,
      text: text.replace(/\s+/g, " ").trim(),
      sourceRef: beat.sourceHref,
      threadId: null,
    });
  };
  for (const beat of input.evidence) {
    if (beat.generatedSource) continue;
    pushBeat(beat);
  }
  for (const text of input.founderOwnTexts ?? []) {
    const own = authorOwnedText(text) || text;
    if (!own.trim()) continue;
    const classified = classifyEvent(own, "founder");
    if (classified.eventType === "other") continue;
    events.push({
      timestamp: null,
      sortMs: eventMs(null, index++),
      actor: "founder",
      eventType: classified.eventType,
      opens: classified.opens,
      satisfies: classified.satisfies,
      text: own.replace(/\s+/g, " ").trim(),
      sourceRef: null,
      threadId: null,
    });
  }
  for (const text of input.vendorOwnTexts ?? []) {
    const own = authorOwnedText(text) || text;
    if (!own.trim()) continue;
    const classified = classifyEvent(own, "vendor_shop");
    if (classified.eventType === "other") continue;
    events.push({
      timestamp: null,
      sortMs: eventMs(null, index++),
      actor: "vendor_shop",
      eventType: classified.eventType,
      opens: classified.opens,
      satisfies: classified.satisfies,
      text: own.replace(/\s+/g, " ").trim(),
      sourceRef: null,
      threadId: null,
    });
  }
  return events.sort((left, right) => left.sortMs - right.sortMs || left.text.localeCompare(right.text));
}

export function classifyEvent(
  text: string,
  actor: WorkLoopActor,
): { eventType: WorkLoopEventType; opens: WorkLoopDependency | null; satisfies: WorkLoopDependency | null } {
  const own = authorOwnedText(text) || text;
  if (actor === "vendor_shop" || actor === "system") {
    if (CAD_FORTHCOMING.test(own) && !STL_DELIVERED.test(own) && !CAD_DELIVERED.test(own)) {
      return { eventType: "vendor_promises_delivery", opens: "vendor_shop", satisfies: null };
    }
    if (STL_DELIVERED.test(own) || CAD_DELIVERED.test(own)) {
      return { eventType: "vendor_delivers", opens: null, satisfies: "vendor_shop" };
    }
    if (isCurrentInboundAskText(own) || CLIENT_ASKS_FOUNDER.test(own)) {
      return { eventType: "founder_obligation", opens: "founder", satisfies: null };
    }
    return { eventType: "other", opens: null, satisfies: null };
  }
  if (actor === "client") {
    if (isCurrentInboundAskText(own) || CLIENT_ASKS_FOUNDER.test(own)) {
      return { eventType: "client_turn", opens: "founder", satisfies: "client" };
    }
    return { eventType: "client_turn", opens: null, satisfies: "founder" };
  }
  if (PRINT_CHECK.test(own)) {
    return { eventType: "founder_print_check", opens: "founder", satisfies: null };
  }
  if (FOUNDER_STILL_OWNS.test(own)) {
    return { eventType: "founder_obligation", opens: "founder", satisfies: "client" };
  }
  if (FOUNDER_INSTRUCTS_VENDOR.test(own) || FOUNDER_ASKS_VENDOR.test(own)) {
    return {
      eventType: FOUNDER_INSTRUCTS_VENDOR.test(own) ? "founder_instructs_vendor" : "founder_asks_vendor",
      opens: "vendor_shop",
      satisfies: "client",
    };
  }
  if (FOUNDER_ASKS_CLIENT.test(own)) {
    return { eventType: "founder_asks_client", opens: "client", satisfies: "founder" };
  }
  if (isShopReviewFallbackText(own) || isInternalQaCopy(own) || isUnsafeBriefingFragment(own)) {
    return { eventType: "other", opens: null, satisfies: null };
  }
  return { eventType: "other", opens: null, satisfies: null };
}

function actorOf(speaker: CosEvidenceBeat["speaker"]): WorkLoopActor {
  if (speaker === "vendor") return "vendor_shop";
  if (speaker === "founder") return "founder";
  if (speaker === "client") return "client";
  return "system";
}

function eventMs(at: string | null | undefined, fallback: number): number {
  if (!at) return fallback;
  const direct = Date.parse(at);
  if (Number.isFinite(direct)) return direct;
  const withYear = Date.parse(`${at}, 2026`);
  if (Number.isFinite(withYear)) return withYear;
  return fallback;
}
