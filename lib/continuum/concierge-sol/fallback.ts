/**
 * Deterministic tool routing when Sol is unavailable.
 * Still Continuum-owned. Never hallucinates prices or specs.
 */

import { parseAskConciergeIntent } from "@/lib/continuum/client-memory/ask/intent";
import type { ConciergeToolCall, ConciergeSolMode } from "./types";
import { parseRepairQuoteIntent } from "./repair";
import { clipHistory, resolveConversationSlots } from "./conversation";
import type { ConciergeSolHistoryTurn } from "./types";

export function deterministicToolPlan(input: {
  query: string;
  mode: ConciergeSolMode;
  history?: readonly ConciergeSolHistoryTurn[] | null;
}): ConciergeToolCall[] {
  const query = input.query.trim();
  const folded = query.toLowerCase();
  const slots = resolveConversationSlots({ query, history: input.history });
  const calls: ConciergeToolCall[] = [];
  const call = (name: string, args: Record<string, unknown>): void => {
    calls.push({ id: `det_${calls.length + 1}`, name, arguments: args });
  };

  if (input.mode === "brain-dump") return calls;

  const birthday = parseAskConciergeIntent(query);
  if (birthday.kind === "birthdays-by-month") {
    call("get_birthdays", { month: birthday.month, query });
    return calls;
  }
  if (birthday.kind === "birthdays-next-month") {
    call("get_birthdays", { query });
    return calls;
  }

  const repairQuery = repairConversationQuery(query, input.history);
  const repair = parseRepairQuoteIntent({ query: repairQuery });
  if (repair.repairType === "sizing" && (repair.direction || (repair.fromSize != null && repair.toSize != null))) {
    call("get_repair_quote", { query: repairQuery });
    return calls;
  }

  if (/top three|today|handle today|on my plate/.test(folded)) {
    call("get_today_items", { limit: 3 });
    return calls;
  }
  if (/waiting on (the )?client|waiting for (the )?client/.test(folded)) {
    call("get_waiting_on_client", {});
    return calls;
  }
  if (/waiting on (the )?shop|waiting on vendor/.test(folded)) {
    call("get_waiting_on_shop", {});
    return calls;
  }
  if (/waiting on me|waiting on you|your turn/.test(folded)) {
    call("get_open_commitments", {});
    return calls;
  }
  if (/in production/.test(folded)) {
    call("get_in_production", {});
    return calls;
  }

  const personQuery = slots.personName ?? "";
  if (/finger size|what size|size do we have|where did .+ come from/.test(folded) && personQuery) {
    call("get_person_summary", { query: personQuery });
    call("get_provenance_summary", { query: personQuery, fieldName: "finger_size" });
    call("get_source_evidence", { query: personQuery, fieldName: "finger_size" });
    return calls;
  }
  if (/latest email|what did .+ email|recent email/.test(folded)) {
    const hint = personQuery || slots.projectHint || query;
    call("find_project", { query: hint });
    call("get_recent_project_email", { query: hint });
    return calls;
  }
  if (input.mode === "design") {
    const hint = personQuery || slots.projectHint || query;
    call("find_project", { query: hint });
    call("get_project_specs", { query: hint });
    call("get_project_notes", { query: hint });
    return calls;
  }
  if (personQuery && (/going on|what's going|what is going|status|what's up/.test(folded) || folded === personQuery.toLowerCase())) {
    call("find_person", { query: personQuery });
    call("get_person_summary", { query: personQuery });
    return calls;
  }
  if (/\bproject\b/.test(folded) || /\bcad\b/.test(folded) || /\bring\b/.test(folded)) {
    call("find_project", { query: personQuery || query });
    if (/email/.test(folded)) call("get_recent_project_email", { query: personQuery || query });
    return calls;
  }
  if (personQuery) {
    call("find_person", { query: personQuery });
    call("get_person_summary", { query: personQuery });
    return calls;
  }
  return calls;
}

export function repairConversationQuery(
  query: string,
  history?: readonly ConciergeSolHistoryTurn[] | null,
): string {
  const current = query.trim();
  const currentIntent = parseRepairQuoteIntent({ query: current });
  if (
    currentIntent.repairType === "sizing" &&
    (currentIntent.direction ||
      (currentIntent.fromSize != null && currentIntent.toSize != null))
  ) {
    return current;
  }
  if (!/^(yes|yes it is|laser|correct|that'?s right|no|no it isn'?t)[.!\s]*$/i.test(current)) {
    return current;
  }
  const turns = clipHistory(history);
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (!turn || turn.role !== "founder") continue;
    const prior = parseRepairQuoteIntent({ query: turn.text });
    if (prior.repairType !== "sizing") continue;
    return `${turn.text} ${current}`.trim();
  }
  return current;
}
