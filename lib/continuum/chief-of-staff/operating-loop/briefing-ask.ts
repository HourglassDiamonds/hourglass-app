/**
 * Contextual Ask Concierge on a Today card.
 * Routes through the existing propose-only brain-dump path.
 * Does not write Person/Project, schedule calendar, or claim a reminder fired.
 */

import { brainDumpCopy, interpretBrainDump } from "@/lib/continuum/concierge-sol/brain-dump";
import type { TodayBriefingPacket } from "./briefing-packet";
import { deriveCosBriefingV1, type CosBriefingV1 } from "./cos-briefing-v1";

export const TODAY_ASK_PLACEHOLDER = "Ask Concierge…" as const;

const REMINDER_INTENT =
  /\b(remind(?:er| me)?|calendar|schedule|put (?:it |this )?on (?:my )?calendar|monday(?: morning)?|tuesday|wednesday|thursday|friday|saturday|sunday|this weekend|tomorrow(?: morning)?|next week)\b/i;
const SCHEDULED_CLAIM =
  /\b(?:(?:I(?:'ve| have) |it's |it is )?(?:scheduled|booked|set a reminder|added to (?:your )?calendar)|I(?:'ll| will) remind you)\b/i;
const PLAN_INTENT =
  /\b(print(?:ing)?|ship(?:ping)?|send(?:ing)?|plan(?:ned|ning)?|this weekend|monday afternoon)\b/i;

export type TodayAskAnswer = {
  kind: "today-ask";
  text: string;
  reminderIntent: boolean;
  calendarPending: boolean;
  writesCanonical: false;
  itemId: string;
  packetItemId: string;
};

export function hasReminderOrCalendarIntent(query: string): boolean {
  return REMINDER_INTENT.test(query);
}

export function answerTodayCardAsk(input: {
  query: string;
  packet: TodayBriefingPacket;
  briefing?: CosBriefingV1 | null;
  solText?: string | null;
  nowIso?: string | null;
}): TodayAskAnswer {
  const query = input.query.replace(/\s+/g, " ").trim();
  const reminderIntent = hasReminderOrCalendarIntent(query);
  const plan = PLAN_INTENT.test(query);
  const who = input.packet.displayName;
  const briefing =
    input.briefing ??
    deriveCosBriefingV1({
      packet: input.packet,
      nowIso: input.nowIso ?? null,
    });
  const deterministic = deterministicAskCopy({
    who,
    ballHolder: input.packet.ballHolder,
    plan,
    reminderIntent,
    query,
    briefing,
  });
  const sol = sanitizeAskSol(input.solText, reminderIntent);
  const text = sol ?? deterministic;
  return {
    kind: "today-ask",
    text,
    reminderIntent,
    calendarPending: reminderIntent,
    writesCanonical: false,
    itemId: input.packet.itemId,
    packetItemId: input.packet.itemId,
  };
}

export function todayAskContextPayload(
  packet: TodayBriefingPacket,
  briefing?: CosBriefingV1 | null,
  nowIso?: string | null,
): {
  itemId: string;
  projectId: string | null;
  personId: string | null;
  organizationLabel: string | null;
  ballHolder: TodayBriefingPacket["ballHolder"];
  unresolvedFounderObligation: string | null;
  lifecycle: string | null;
  sourceRefs: readonly string[];
  currentState: string;
  timingFacts: CosBriefingV1["timingFacts"];
  checkpoint: CosBriefingV1["checkpoint"];
  packet: TodayBriefingPacket;
  briefing: CosBriefingV1;
} {
  const resolved =
    briefing ??
    deriveCosBriefingV1({
      packet,
      nowIso: nowIso ?? null,
    });
  return {
    itemId: packet.itemId,
    projectId: packet.projectId,
    personId: packet.personId,
    organizationLabel: packet.organizationLabel,
    ballHolder: packet.ballHolder,
    unresolvedFounderObligation: packet.unresolvedFounderObligation,
    lifecycle: packet.lifecycle,
    sourceRefs: packet.sourceRefs,
    currentState: resolved.currentState,
    timingFacts: resolved.timingFacts,
    checkpoint: resolved.checkpoint,
    packet,
    briefing: resolved,
  };
}

function deterministicAskCopy(input: {
  who: string;
  ballHolder: TodayBriefingPacket["ballHolder"];
  plan: boolean;
  reminderIntent: boolean;
  query: string;
  briefing: CosBriefingV1;
}): string {
  const planLine = input.plan
    ? `I'll treat that as a proposed checkpoint for ${input.who} and keep it off your immediate list.`
    : `Noted for ${input.who}.`;
  if (input.reminderIntent) {
    const state = input.briefing.currentState ? ` Current state: ${input.briefing.currentState}` : "";
    return `Got it. ${planLine}${state} The timed follow-up stays advisory; calendar/reminder execution isn't wired yet, so I won't pretend it's scheduled.`;
  }
  if (input.ballHolder !== "founder" && input.plan) {
    return `Got it. ${planLine} Nothing from you is required until the next event lands.`;
  }
  return `Got it. ${planLine}`;
}

function sanitizeAskSol(solText: string | null | undefined, reminderIntent: boolean): string | null {
  const trimmed = solText?.replace(/\s+/g, " ").trim() || "";
  if (!trimmed) return null;
  if (reminderIntent && SCHEDULED_CLAIM.test(trimmed)) return null;
  if (/\b(?:saved|created the (?:person|project)|updated canonical|minted)\b/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function todayAskFallbackNote(query: string): string {
  return brainDumpCopy(interpretBrainDump(query));
}
