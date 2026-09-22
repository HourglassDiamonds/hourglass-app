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

export const WORK_LOOP_SEMANTIC_CLASSES = [
  "founder_review",
  "founder_print_check",
  "founder_communication",
  "vendor_shop_wait",
  "client_wait",
  "unknown",
] as const;

export type WorkLoopSemanticClass = (typeof WORK_LOOP_SEMANTIC_CLASSES)[number];

export type ReducedWorkLoopState = {
  ballHolder: TodayBallHolder;
  briefingKind: TodayBriefingKind;
  semanticClass: WorkLoopSemanticClass;
  vendorOpen: boolean;
  founderOpen: boolean;
  clientOpen: boolean;
  latestFounderText: string | null;
  latestExternalText: string | null;
  nextExpectedEvent: string | null;
  authoritative: boolean;
};

const STL_DELIVERED =
  /\b(?:mod\s*\d+\s+)?stl\b.{0,80}\b(?:attached|delivered|sent|here|ready)\b|\b(?:attached|delivered|sent|here|ready).{0,80}\b(?:mod\s*\d+\s+)?stl\b|\bhere is the\b[^.!?\n]{0,80}\b(?:mod\s*\d+\s+)?stl\b/i;
const CAD_DELIVERED =
  /\b(?:here is|attached|delivered|sent)\b[^.!?\n]{0,80}\b(?:updated\s+)?cad\b|\b(?:updated\s+)?cad\b[^.!?\n]{0,40}\b(?:attached|delivered|sent)\b/i;
const CAD_FORTHCOMING =
  /\b(?:updated CAD|CAD as soon as|CAD when it(?:'s| is) ready|(?:I|we|she|they)(?:'ll| will) send (?:you )?(?:the )?(?:updated )?(?:CAD|STL|file)|send (?:you )?(?:the )?updated CAD|CAD ASAP|CAD expected|final CAD|CAD in (?:about |approximately )?\d+)\b/i;
const VENDOR_PRODUCTION_PROMISE =
  /\b(?:order confirmation|place (?:the |your )?order|going to (?:the )?workshop|stone is going|will update (?:the )?size)\b/i;
const PRINT_CHECK =
  /\bI(?:'ll| will| am going to| planned to)?\s*(?:print|check|show|look at)[^.!?\n]{0,180}|\b(?:print(?:ing)?|check(?:ing)?)\s+(?:the\s+)?(?:updated\s+)?(?:model|stl|earring|huggie|size|proportion)/i;
const PRINT_FULFILLED =
  /\b(?:already printed|models? (?:are|is|were) (?:already )?printed|finished printing|printing (?:is|was) (?:done|finished)|printed and (?:ready|done))\b/i;
const SHIP_COMMIT =
  /\b(?:I(?:'ll| will)|expect(?:s|ing)? to|going to)\s+(?:mail|ship)\b|\bmail them\b|\bship them\b/i;
const SHIPPING_ADDRESS =
  /\b(?:shipping address|new address|updated address|ship (?:it|them|this) to|please (?:use|ship to) (?:this |the )?(?:updated )?address)\b/i;
const STREET_ADDRESS =
  /\b\d{1,5}\s+[A-Za-z][A-Za-z.'\-]+(?:\s+[A-Za-z][A-Za-z.'\-]+){0,4}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive|Ct|Court|Way|Pl|Place)\.?\b/i;
const FOUNDER_ASKS_VENDOR =
  /\b(?:can you|could you|please)\s+(?:send|make|revise|update|price|quote)\b|\b(?:updated CAD|STL file|current changes|platinum-bead pricing)\b/i;
const FOUNDER_INSTRUCTS_VENDOR =
  /\b(?:moving forward|please proceed|go ahead|all three bands|all platinum|all lab)\b/i;
const FOUNDER_STILL_OWNS =
  /\bsending the\b(?![^.!?\n]{0,40}\bto the shop\b)|\bI(?:'ll| will) (?:get|show|bring|mail|ship)\b/i;
const FOUNDER_ASKS_CLIENT =
  /\b(?:let me know(?: what you think)?|when you (?:have a chance|can)|looks? good to you)\b/i;
const CAD_SENT_TO_CLIENT =
  /\b(?:sent|forwarded|shared|showed)\b[^.!?\n]{0,80}\b(?:the\s+)?(?:updated\s+)?(?:CAD|STL)\b|\b(?:CAD|STL)\b[^.!?\n]{0,40}\b(?:to\s+(?:the\s+)?client|to\s+him|to\s+her|to\s+them)\b|\bhere(?:['’]s| is) (?:the )?(?:latest |updated )?(?:CAD|STL)\b/i;
const CLIENT_ASKS_FOUNDER =
  /\bwhat do (?:you|we) think we should do\b|\bwhat(?:'s| is) next\b|\bwhat should we do next\b/i;
const CLIENT_WAITING_ON_CAD =
  /\b(?:looking forward to (?:the )?cad|cad breakdown|when (?:will|is) (?:the )?(?:latest )?cad)\b/i;
const FOUNDER_ACK =
  /^(?:perfect|thanks|thank you|got it|sounds good)[:).!\s]*$/i;
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
  if (isShippingAddressText(trimmed)) return true;
  return false;
}

export function isShippingAddressText(text: string | null | undefined): boolean {
  const hay = text?.replace(/\s+/g, " ").trim() ?? "";
  if (!hay) return false;
  return STREET_ADDRESS.test(hay);
}

export function isCurrentShippingObligation(events: readonly WorkLoopEvent[]): boolean {
  const opening = [...events].reverse().find((row) => row.opens === "founder");
  if (!opening) return false;
  return PRINT_FULFILLED.test(opening.text) || SHIP_COMMIT.test(opening.text) || SHIPPING_ADDRESS.test(opening.text);
}

export function clientIsWaitingOnCad(events: readonly WorkLoopEvent[]): boolean {
  return events.some((row) => row.actor === "client" && CLIENT_WAITING_ON_CAD.test(row.text));
}

export type ReduceWorkLoopInput = {
  evidence: readonly CosEvidenceBeat[];
  founderOwnTexts?: readonly string[];
  vendorOwnTexts?: readonly string[];
  quotedTexts?: readonly string[];
  remaining?: RemainingFounderCommitment | null;
  waitingState?: ThreadWaitingKind | string | null;
  communication?: string | null;
  noFounderAction?: boolean;
  staleInboundSatisfied?: boolean;
};

export function reduceWorkLoop(input: ReduceWorkLoopInput): ReducedWorkLoopState {
  const events = eventsFromInput(input);
  let vendorOpen = false;
  let founderOpen = false;
  let clientOpen = false;
  let founderPending = false;
  let cadInFounderHands = false;
  let printCheckOpen = false;
  if (input.waitingState === "cad" || input.waitingState === "shop" || input.waitingState === "production") {
    vendorOpen = true;
  } else if (input.waitingState === "client" && input.communication !== "vendor") {
    clientOpen = true;
  } else if (input.communication === "vendor") {
    vendorOpen = true;
  }

  let latestFounderText: string | null = null;
  let latestExternalText: string | null = null;

  for (const event of events) {
    if (event.eventType === "vendor_delivers") {
      cadInFounderHands = true;
      printCheckOpen = false;
    }
    if (event.eventType === "founder_print_check") printCheckOpen = true;
    if (PRINT_FULFILLED.test(event.text) || SHIP_COMMIT.test(event.text) || SHIPPING_ADDRESS.test(event.text)) {
      printCheckOpen = false;
      cadInFounderHands = false;
    }
    if (event.actor === "founder" && CAD_SENT_TO_CLIENT.test(event.text)) cadInFounderHands = false;
    if (event.satisfies === "vendor_shop") {
      vendorOpen = false;
      founderOpen = true;
      clientOpen = false;
    }
    if (event.satisfies === "founder") {
      if (!(cadInFounderHands && event.eventType === "founder_asks_client")) {
        founderOpen = false;
      }
    }
    if (event.satisfies === "client") clientOpen = false;
    if (event.opens === "vendor_shop") {
      vendorOpen = true;
      founderOpen = false;
      clientOpen = false;
      cadInFounderHands = false;
    } else if (event.opens === "founder") {
      if (event.eventType === "founder_print_check" && vendorOpen) {
        founderPending = true;
      } else {
        founderOpen = true;
        vendorOpen = false;
        clientOpen = false;
      }
    } else if (event.opens === "client" && !vendorOpen) {
      if (cadInFounderHands) {
        founderOpen = true;
        clientOpen = false;
      } else {
        clientOpen = true;
        founderOpen = false;
      }
    }
    if (event.actor === "founder" && event.text) latestFounderText = event.text;
    if (event.actor !== "founder" && event.text) latestExternalText = event.text;
  }

  if (founderPending && !vendorOpen) {
    founderOpen = true;
    clientOpen = false;
  }
  if (cadInFounderHands && !vendorOpen) {
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
    cadInFounderHands,
  });

  const inboundAskOpen =
    !cadWait &&
    !cadInFounderHands &&
    !input.staleInboundSatisfied &&
    events.some(
      (row) => isCurrentInboundAskText(row.text) || CLIENT_ASKS_FOUNDER.test(row.text),
    );
  if (inboundAskOpen) {
    founderOpen = true;
    vendorOpen = false;
    clientOpen = false;
  }

  const vendorBlockingAskOpen = latestOpening(events)?.opens === "founder" && latestOpening(events)?.actor === "vendor_shop";
  if (
    input.staleInboundSatisfied &&
    !remainingIsUsable(remainingTextOf(input)) &&
    !cadInFounderHands &&
    !founderPending &&
    !inboundAskOpen &&
    !vendorBlockingAskOpen &&
    !clientOpen
  ) {
    if (
      vendorOpen ||
      cadWait ||
      input.waitingState === "cad" ||
      input.waitingState === "shop" ||
      input.waitingState === "production" ||
      input.communication === "vendor"
    ) {
      vendorOpen = true;
      founderOpen = false;
      clientOpen = false;
    } else {
      clientOpen = true;
      founderOpen = false;
      vendorOpen = false;
    }
  } else if (
    input.noFounderAction &&
    !inboundAskOpen &&
    !remainingIsUsable(remainingTextOf(input)) &&
    !cadInFounderHands &&
    !founderPending &&
    !vendorBlockingAskOpen &&
    (input.waitingState === "cad" ||
      input.waitingState === "shop" ||
      input.waitingState === "production" ||
      input.waitingState === "client" ||
      input.communication === "vendor")
  ) {
    if (input.waitingState === "client") {
      clientOpen = true;
      founderOpen = false;
      vendorOpen = false;
    } else {
      vendorOpen = true;
      founderOpen = false;
      clientOpen = false;
    }
  }

  const ballHolder: TodayBallHolder = vendorOpen
    ? "vendor_shop"
    : founderOpen
      ? "founder"
      : clientOpen
        ? "client"
        : "unknown";
  const printCheck =
    ballHolder === "founder" &&
    (printCheckOpen || (founderPending && events.some((row) => row.eventType === "founder_print_check")));
  const deliveredReview =
    ballHolder === "founder" &&
    !printCheck &&
    cadInFounderHands &&
    events.some((row) => row.eventType === "vendor_delivers");
  const briefingKind: TodayBriefingKind = printCheck
    ? "founder_print_check"
    : ballHolder === "vendor_shop" && (cadWait || input.waitingState === "cad")
      ? "vendor_cad_wait"
      : ballHolder === "client"
        ? "client_wait"
        : "generic";
  const semanticClass: WorkLoopSemanticClass =
    ballHolder === "vendor_shop"
      ? "vendor_shop_wait"
      : ballHolder === "client"
        ? "client_wait"
        : ballHolder !== "founder"
          ? "unknown"
          : printCheck
            ? "founder_print_check"
            : deliveredReview
              ? "founder_review"
              : "founder_communication";
  const nextExpectedEvent =
    ballHolder === "vendor_shop"
      ? briefingKind === "vendor_cad_wait"
        ? "Updated CAD/STL from the shop"
        : "Shop turn on current instructions"
      : ballHolder === "founder"
        ? printCheck
          ? "Founder print/check, then client update"
          : deliveredReview
            ? "Founder review of delivered CAD/STL"
            : "Founder action"
        : ballHolder === "client"
          ? "Client reply"
          : null;

  return {
    ballHolder,
    briefingKind,
    semanticClass,
    vendorOpen,
    founderOpen,
    clientOpen,
    latestFounderText,
    latestExternalText,
    nextExpectedEvent,
    authoritative: ballHolder !== "unknown",
  };
}

function latestOpening(events: readonly WorkLoopEvent[]): WorkLoopEvent | undefined {
  return [...events].reverse().find((row) => row.opens != null);
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
    if (event.opens === "founder" && event.actor === "vendor_shop") cad = false;
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
    cadInFounderHands: boolean;
  },
): void {
  const text = remainingTextOf(input);
  if (!remainingIsUsable(text)) return;
  if (state.cadWait || state.cadInFounderHands) return;
  const inbound = isCurrentInboundAskText(text) || CLIENT_ASKS_FOUNDER.test(text);
  const classified = classifyEvent(text, inbound ? "client" : "founder");
  if (classified.eventType === "founder_asks_client" || classified.opens === "client") {
    if (!state.vendorOpen() && !state.cadWait && !state.cadInFounderHands) {
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
  if (state.vendorOpen() && classified.opens !== "founder") return;
  if (state.cadWait) return;
  state.setFounderOpen(true);
  state.setVendorOpen(false);
  state.setClientOpen(false);
}

export function eventsFromInput(input: ReduceWorkLoopInput): WorkLoopEvent[] {
  const events: WorkLoopEvent[] = [];
  let index = 0;
  const ownHay = [...(input.founderOwnTexts ?? []), ...(input.vendorOwnTexts ?? [])]
    .join("\n")
    .replace(/\s+/g, " ")
    .toLowerCase();
  const quotedHay = (input.quotedTexts ?? []).join("\n").replace(/\s+/g, " ").toLowerCase();
  const quotedOnly = (text: string): boolean => {
    const needle = text.replace(/\s+/g, " ").trim().toLowerCase();
    if (!needle || needle.length < 8) return false;
    if (!quotedHay.includes(needle)) return false;
    return !ownHay.includes(needle);
  };
  const pushBeat = (beat: CosEvidenceBeat) => {
    const text = authorOwnedText(beat.summary) || beat.summary;
    if (quotedOnly(text)) return;
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
    if (VENDOR_PRODUCTION_PROMISE.test(own) && !STL_DELIVERED.test(own) && !CAD_DELIVERED.test(own)) {
      return { eventType: "other", opens: "vendor_shop", satisfies: null };
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
    if (SHIPPING_ADDRESS.test(own)) {
      return { eventType: "founder_obligation", opens: "founder", satisfies: "client" };
    }
    if (isCurrentInboundAskText(own) || CLIENT_ASKS_FOUNDER.test(own) || /\?/.test(own)) {
      return { eventType: "client_turn", opens: "founder", satisfies: "client" };
    }
    if (/\b(?:thanks|thank you|looks good|perfect|got it|sounds good)\b/i.test(own)) {
      return { eventType: "client_turn", opens: null, satisfies: "founder" };
    }
    return { eventType: "client_turn", opens: null, satisfies: null };
  }
  if (PRINT_FULFILLED.test(own) || SHIP_COMMIT.test(own)) {
    return { eventType: "founder_obligation", opens: "founder", satisfies: "founder" };
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
  if (FOUNDER_ACK.test(own) || isShopReviewFallbackText(own) || isInternalQaCopy(own) || isUnsafeBriefingFragment(own)) {
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
