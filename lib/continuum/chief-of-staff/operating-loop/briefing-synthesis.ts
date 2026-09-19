/**
 * Sol may phrase a Today briefing. Continuum rejects unsupported claims
 * and falls back to deterministic copy. No Gmail reconstruction, no
 * identifier rebinding, no lifecycle or completion invention.
 */

import type { TodayBallHolder, TodayBriefingPacket } from "./briefing-packet";
import { historicalIdentifierValues } from "./briefing-packet";
import {
  renderDeterministicBriefing,
  sanitizeRendered,
  stateChipFor,
  type TodayRenderedBriefing,
} from "./briefing-copy";

export type SolBriefingSynthesis = {
  headline?: string | null;
  stand?: string | null;
  nextBody?: string | null;
  ballHolder?: TodayBallHolder | string | null;
  completed?: boolean | null;
  inProduction?: boolean | null;
  approved?: boolean | null;
};

const COMPLETION =
  /\b(?:already printed|printing (?:is|was) (?:done|complete)|print(?:ed|ing) already happened|work is complete|job is complete|approved the|client approved)\b/i;
const PRODUCTION =
  /\b(?:in production|canonical open job|open job is live|moved to production)\b/i;
const BALL_SHIFT =
  /\b(?:ball is with|waiting on (?:the )?(?:shop|client)|your move|nothing from you)\b/i;

export function applySolBriefingSynthesis(
  packet: TodayBriefingPacket,
  sol: SolBriefingSynthesis | string | null | undefined,
): TodayRenderedBriefing {
  const fallback = renderDeterministicBriefing(packet);
  if (sol == null) return fallback;
  const parsed = typeof sol === "string" ? parseSolBriefingText(sol) : sol;
  if (!parsed) return fallback;
  const rejection = unsupportedSolClaim(packet, parsed);
  if (rejection) return fallback;
  const chip = stateChipFor(packet.ballHolder);
  const nextKind = fallback.nextKind;
  const nextLabel =
    nextKind === "best_next_step"
      ? "Best next step"
      : nextKind === "waiting_on"
        ? "Waiting on"
        : "Nothing from you right now";
  return sanitizeRendered({
    displayName: packet.displayName,
    projectName: packet.projectName,
    stateChip: chip,
    headline: (parsed.headline ?? fallback.headline).trim() || fallback.headline,
    stand: (parsed.stand ?? fallback.stand).trim() || fallback.stand,
    nextKind,
    nextLabel,
    nextBody: (parsed.nextBody ?? fallback.nextBody).trim() || fallback.nextBody,
    source: "sol",
  }, packet);
}

export function unsupportedSolClaim(
  packet: TodayBriefingPacket,
  sol: SolBriefingSynthesis,
): string | null {
  if (sol.completed === true) return "completion";
  if (sol.approved === true) return "approval";
  if (sol.inProduction === true && packet.lifecycle !== "production" && packet.lifecycle !== "in_production") {
    return "production";
  }
  if (sol.ballHolder && sol.ballHolder !== packet.ballHolder) return "ball-holder";
  const hay = [sol.headline, sol.stand, sol.nextBody].filter(Boolean).join("\n");
  if (COMPLETION.test(hay)) return "completion-copy";
  if (PRODUCTION.test(hay) && packet.lifecycle !== "production" && packet.lifecycle !== "in_production") {
    return "production-copy";
  }
  for (const value of historicalIdentifierValues(packet.identifiers)) {
    if (new RegExp(`\\b${escapeReg(value)}\\b`, "i").test(hay)) return "historical-identifier";
  }
  for (const banned of packet.mustNotState) {
    const token = banned.replace(/ is current$/i, "").trim();
    if (token.length >= 5 && new RegExp(`\\b${escapeReg(token)}\\b`, "i").test(hay) && /current|approved|production|open job|printed/i.test(banned)) {
      if (new RegExp(escapeReg(banned), "i").test(hay)) return "must-not-state";
    }
  }
  if (sol.ballHolder == null && BALL_SHIFT.test(hay) && contradictsBallHolder(packet.ballHolder, hay)) {
    return "ball-holder-copy";
  }
  return null;
}

export function parseSolBriefingText(text: string): SolBriefingSynthesis | null {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(text) as SolBriefingSynthesis;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* founder-facing prose */
  }
  const parts = trimmed.split(/(?<=\.)\s+/).filter(Boolean);
  return {
    headline: parts[0] ?? trimmed,
    stand: parts.slice(1, 3).join(" ") || trimmed,
    nextBody: parts.at(-1) ?? null,
  };
}

function contradictsBallHolder(ball: TodayBallHolder, hay: string): boolean {
  const yourMove = /\byour move\b/i.test(hay);
  const waitingShop = /\bwaiting on (?:the )?shop\b/i.test(hay);
  const waitingClient = /\bwaiting on (?:the )?client\b/i.test(hay);
  const nothing = /\bnothing from you\b/i.test(hay);
  if (ball === "founder" && (waitingShop || waitingClient || nothing) && !yourMove) return true;
  if (ball === "vendor_shop" && yourMove && !waitingShop) return true;
  if (ball === "client" && yourMove && !waitingClient) return true;
  return false;
}

function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
