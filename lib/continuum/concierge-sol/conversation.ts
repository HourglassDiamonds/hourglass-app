/**
 * Short-term Concierge conversation slots.
 * Not durable business memory. Continuum remains the source of truth.
 */

import type { ConciergeSolHistoryTurn } from "./types";
import { CONCIERGE_SOL_HISTORY_MAX_TURNS, CONCIERGE_SOL_TURN_MAX_LENGTH } from "./types";

const NAME_RE = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g;
const STOP = new Set([
  "What",
  "Where",
  "Which",
  "When",
  "Who",
  "How",
  "The",
  "This",
  "That",
  "There",
  "Then",
  "And",
  "For",
  "With",
  "From",
  "Have",
  "Does",
  "Did",
  "Can",
  "Could",
  "Would",
  "Should",
  "November",
  "December",
  "January",
  "February",
  "March",
  "April",
  "August",
  "September",
  "October",
  "Monday",
  "Today",
  "Concierge",
  "Continuum",
  "Hourglass",
  "Gmail",
  "Project",
  "Person",
]);

export type ConversationSlots = {
  personName: string | null;
  projectHint: string | null;
};

export function clipHistory(
  history: readonly ConciergeSolHistoryTurn[] | null | undefined,
): ConciergeSolHistoryTurn[] {
  if (!history) return [];
  return history
    .filter((row) => row && (row.role === "founder" || row.role === "concierge"))
    .map((row) => ({
      role: row.role,
      text: String(row.text ?? "").slice(0, CONCIERGE_SOL_TURN_MAX_LENGTH),
    }))
    .filter((row) => row.text.trim())
    .slice(-CONCIERGE_SOL_HISTORY_MAX_TURNS);
}

export function extractProperNames(text: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const matches = text.matchAll(NAME_RE);
  for (const match of matches) {
    const name = match[1]?.trim() ?? "";
    if (!name || STOP.has(name.split(" ")[0] ?? "")) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

export function resolveConversationSlots(input: {
  query: string;
  history?: readonly ConciergeSolHistoryTurn[] | null;
}): ConversationSlots {
  const queryNames = extractProperNames(input.query);
  if (queryNames[0]) {
    return { personName: queryNames[0], projectHint: projectHintFrom(input.query) };
  }
  const turns = clipHistory(input.history);
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (!turn || turn.role !== "founder") continue;
    const names = extractProperNames(turn.text);
    if (names[0]) {
      return { personName: names[0], projectHint: projectHintFrom(turn.text) };
    }
  }
  return {
    personName: null,
    projectHint: projectHintFrom(input.query),
  };
}

function projectHintFrom(text: string): string | null {
  const match = text.match(
    /\b(chicken ring|wedding band|engagement|repair|pendant|bracelet|necklace|earring)s?\b/i,
  );
  return match?.[0] ?? null;
}

export function queryLooksLikeFollowUp(query: string): boolean {
  const folded = query.trim().toLowerCase();
  if (!folded) return false;
  return (
    /^(what|where|which|how|and|also)\b/.test(folded) &&
    !extractProperNames(query).length
  );
}
