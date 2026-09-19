/**
 * Deterministic Chief-of-Staff briefing copy from a bounded packet.
 * Sol may rephrase; it may not invent facts.
 */

import type { TodayBallHolder, TodayBriefingPacket } from "./briefing-packet";
import { currentIdentifierValues, historicalIdentifierValues } from "./briefing-packet";

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
        `Print/check the model and send ${who} the size update.`,
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
      nextBody: packet.candidateNextAction ?? "Review the CAD when it comes back.",
      source: "deterministic",
    }, packet);
  }
  if (packet.ballHolder === "client") {
    return sanitizeRendered({
      displayName: who,
      projectName: packet.projectName,
      stateChip: chip,
      headline: `${who} has the next turn.`,
      stand:
        packet.latestMeaningfulFounderAction?.summary
          ? `You already wrote. ${packet.latestMeaningfulFounderAction.summary}`
          : `You already wrote. Waiting on ${who}.`,
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
  if (packet.latestMeaningfulExternalEvent && /stl/i.test(packet.latestMeaningfulExternalEvent.summary)) {
    return "STL is in; you're up to check the size.";
  }
  if (packet.unresolvedFounderObligation) {
    return "You're up.";
  }
  return cad ? `${cad} is waiting on you.` : "You're up.";
}

function founderStand(
  packet: TodayBriefingPacket,
  who: string,
  cad: string | undefined,
): string {
  const external = packet.latestMeaningfulExternalEvent?.summary;
  const founder = packet.latestMeaningfulFounderAction?.summary;
  if (external && founder) {
    const cadBit = cad && !external.includes(cad) ? ` (${cad})` : "";
    return `${sentence(`${external}${cadBit}`)} ${sentence(founder)}`.replace(/\s{2,}/g, " ").trim();
  }
  if (external) return sentence(external);
  if (founder) return `You told ${who} you'd handle the next check. ${sentence(founder)}`;
  return `A founder move is still open with ${who}.`;
}

function shopHeadline(packet: TodayBriefingPacket): string {
  const org = packet.organizationLabel || "the shop";
  if (packet.latestMeaningfulFounderAction) {
    return `You already sent the revised direction to ${org}.`;
  }
  return `Updated CAD is with ${org}.`;
}

function shopStand(packet: TodayBriefingPacket): string {
  const who = packet.vendorContactName || "The shop";
  const verb = packet.vendorContactName ? "she'll" : "they'll";
  const external = packet.latestMeaningfulExternalEvent?.summary;
  if (external && /CAD/i.test(external)) {
    return `You already sent the revised direction. ${who} has the changes and said ${verb} send the updated CAD when it's ready.`;
  }
  if (external) return `You already sent the revised direction. ${sentence(external)}`;
  return "You already replied. Current dependency is the shop.";
}

function sentence(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
