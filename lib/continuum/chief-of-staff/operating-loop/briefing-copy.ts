/**
 * Deterministic Chief-of-Staff briefing copy from a bounded packet.
 * Sol may rephrase; it may not invent facts.
 */

import type { TodayBallHolder, TodayBriefingPacket } from "./briefing-packet";
import {
  currentIdentifierValues,
  historicalIdentifierValues,
  isIdentifierOnlyProse,
} from "./briefing-packet";
import { isUnsafeBriefingFragment } from "./work-loop-state";

export type TodayBriefingStateChip =
  | "YOUR MOVE"
  | "WAITING ON SHOP"
  | "WAITING ON CLIENT"
  | "WAITING";

export type TodayRenderedBriefing = {
  displayName: string;
  projectName: string | null;
  stateChip: TodayBriefingStateChip;
  headline: string;
  stand: string;
  nextKind: "best_next_step" | "waiting_on" | "nothing_from_you";
  nextLabel: string;
  nextBody: string;
  source: "deterministic" | "sol";
};

export function stateChipFor(ballHolder: TodayBallHolder): TodayBriefingStateChip {
  if (ballHolder === "founder") return "YOUR MOVE";
  if (ballHolder === "vendor_shop") return "WAITING ON SHOP";
  if (ballHolder === "client") return "WAITING ON CLIENT";
  return "WAITING";
}

export function renderDeterministicBriefing(
  packet: TodayBriefingPacket,
): TodayRenderedBriefing {
  const chip = stateChipFor(packet.ballHolder);
  const currentIds = currentIdentifierValues(packet.identifiers);
  const cad = currentIds.find((value) => /^C\d{5,}/i.test(value));
  const who = packet.displayName;
  if (packet.ballHolder === "founder") {
    return sanitizeRendered({
      displayName: who,
      projectName: packet.projectName,
      stateChip: chip,
      headline: founderHeadline(packet, cad),
      stand: founderStand(packet, who, cad),
      nextKind: "best_next_step",
      nextLabel: "Best next step",
      nextBody:
        packet.candidateNextAction ??
        (packet.semanticNextActionClass === "founder_review"
          ? "Review them and send the next design direction / approval."
          : packet.briefingKind === "founder_print_check"
            ? `Print/check the model and send ${who} the size update.`
            : packet.unresolvedFounderObligation ?? `Send ${who} the next step.`),
      source: "deterministic",
    }, packet);
  }
  if (packet.ballHolder === "vendor_shop") {
    return sanitizeRendered({
      displayName: who,
      projectName: packet.projectName,
      stateChip: chip,
      headline: shopHeadline(packet),
      stand: shopStand(packet),
      nextKind: "nothing_from_you",
      nextLabel: "Nothing from you right now",
      nextBody: packet.candidateNextAction ?? "Review the new CAD when it arrives.",
      source: "deterministic",
    }, packet);
  }
  if (packet.ballHolder === "client") {
    return sanitizeRendered({
      displayName: who,
      projectName: packet.projectName,
      stateChip: chip,
      headline: `${who} has the next turn.`,
      stand: clientStand(packet, who),
      nextKind: "waiting_on",
      nextLabel: "Waiting on",
      nextBody: who,
      source: "deterministic",
    }, packet);
  }
  return sanitizeRendered({
    displayName: who,
    projectName: packet.projectName,
    stateChip: chip,
    headline: packet.nextExpectedEvent ?? "No founder action is proven.",
    stand: [packet.latestMeaningfulExternalEvent?.summary, packet.latestMeaningfulFounderAction?.summary]
      .filter(Boolean)
      .join(" ") || "Continuum does not have a proven next founder move.",
    nextKind: "nothing_from_you",
    nextLabel: "Nothing from you right now",
    nextBody: "Leave it until a later event lands.",
    source: "deterministic",
  }, packet);
}

export function sanitizeRendered(
  briefing: TodayRenderedBriefing,
  packet: TodayBriefingPacket,
): TodayRenderedBriefing {
  const banned = [
    /\bresponded\b/i,
    /\bconfirm person\b/i,
    /shop evidence is already (?:tied to|on) this production Project/gi,
    /canonical Project is already in production/gi,
    /I will not create a reminder Open Job/gi,
    ...historicalIdentifierValues(packet.identifiers).map(
      (value) => new RegExp(`\\b${escapeReg(value)}\\b`, "i"),
    ),
  ];
  const scrub = (text: string) => {
    let next = text;
    for (const pattern of banned) next = next.replace(pattern, "").replace(/\s{2,}/g, " ").trim();
    return next;
  };
  return {
    ...briefing,
    headline: scrub(briefing.headline),
    stand: scrub(briefing.stand),
    nextBody: scrub(briefing.nextBody),
  };
}

function founderHeadline(packet: TodayBriefingPacket, cad: string | undefined): string {
  const external = packet.latestMeaningfulExternalEvent?.summary ?? "";
  if (packet.semanticNextActionClass === "founder_review" || (/cad/i.test(external) && /stl/i.test(external))) {
    if (/cad/i.test(external) && /stl/i.test(external)) {
      const mod = external.match(/\bmod\s*\d+/i)?.[0];
      return mod ? `${capitalizePhrase(mod)} CAD and STL are in.` : "CAD and STL are in.";
    }
    if (/stl/i.test(external)) return "STL is in; you're up to check the size.";
    if (/cad/i.test(external)) {
      const mod = external.match(/\bmod\s*\d+/i)?.[0];
      return mod ? `${capitalizePhrase(mod)} CAD is in.` : "CAD is in.";
    }
  }
  if (packet.latestMeaningfulExternalEvent && /stl/i.test(packet.latestMeaningfulExternalEvent.summary)) {
    if (packet.briefingKind === "founder_print_check") {
      return "STL is in; you're up to check the size.";
    }
  }
  const specific =
    (packet.candidateNextAction && !/send the recap/i.test(packet.candidateNextAction)
      ? packet.candidateNextAction
      : null) ??
    (packet.unresolvedFounderObligation &&
    !/send the recap/i.test(packet.unresolvedFounderObligation) &&
    !isUnsafeBriefingFragment(packet.unresolvedFounderObligation)
      ? packet.unresolvedFounderObligation
      : null);
  if (specific) return specific;
  return cad ? `${cad} is waiting on you.` : "You're up.";
}

function founderStand(
  packet: TodayBriefingPacket,
  who: string,
  cad: string | undefined,
): string {
  if (packet.briefingKind === "founder_print_check") {
    const cadBit = cad ? ` ${cad}` : "";
    return `The shop delivered the${cadBit} model. Print/check it, then update ${who}.`.replace(/\s{2,}/g, " ");
  }
  if (packet.semanticNextActionClass === "founder_review") {
    const cadBit = cad ? ` ${cad}` : "";
    const external = usableProse(packet.latestMeaningfulExternalEvent?.summary);
    if (external && /CAD|STL/i.test(external)) return sentence(external);
    return `The shop delivered the${cadBit} CAD/STL. Review them and send ${who} the next design direction.`.replace(
      /\s{2,}/g,
      " ",
    );
  }
  if (packet.unresolvedFounderObligation && !isUnsafeBriefingFragment(packet.unresolvedFounderObligation)) {
    return `A founder move is still open with ${who}.`;
  }
  const external = usableProse(packet.latestMeaningfulExternalEvent?.summary);
  if (external && /CAD|STL|print|check the model/i.test(external)) {
    return sentence(external);
  }
  return `A founder move is still open with ${who}.`;
}

function capitalizePhrase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function clientStand(_packet: TodayBriefingPacket, who: string): string {
  return `You already wrote. Waiting on ${who}.`;
}

function shopHeadline(packet: TodayBriefingPacket): string {
  const org = packet.organizationLabel || "the shop";
  if (packet.briefingKind === "vendor_cad_wait" || /CAD|STL/i.test(packet.nextExpectedEvent ?? "")) {
    return `Updated CAD is pending from ${org}.`;
  }
  return `Current dependency is ${org}.`;
}

function shopStand(packet: TodayBriefingPacket): string {
  const who = packet.vendorContactName || "The shop";
  const verb = packet.vendorContactName ? "she'll" : "they'll";
  const org = packet.organizationLabel || "the shop";
  if (packet.briefingKind === "vendor_cad_wait" || /CAD|STL/i.test(packet.nextExpectedEvent ?? "")) {
    if (packet.vendorContactName) {
      return `${who} said ${verb} send the updated CAD when it's ready.`;
    }
    return `Updated CAD/STL is pending from ${org}. Nothing from you until it arrives.`;
  }
  return `Current dependency is ${org}. Nothing from you until they turn.`;
}

function usableProse(text: string | null | undefined): string | null {
  const trimmed = text?.replace(/\s+/g, " ").trim() ?? "";
  if (!trimmed || isIdentifierOnlyProse(trimmed)) return null;
  if (isUnsafeBriefingFragment(trimmed)) return null;
  return trimmed;
}

function sentence(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
