import type { DecisionJournalEntry, FounderDecision } from "./types";

const FOUNDERS: FounderDecision[] = [
  "approve",
  "reject",
  "defer",
  "request-more-evidence",
];

const OUTCOMES = [
  "pending",
  "accepted",
  "rejected",
  "deferred",
  "in-progress",
  "completed",
  "abandoned",
] as const;

export type DecisionJournalValidation =
  | { ok: true; entry: DecisionJournalEntry }
  | { ok: false; errors: string[] };

export function validateDecisionJournalEntry(
  input: unknown,
): DecisionJournalValidation {
  const errors: string[] = [];
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Entry must be an object"] };
  }
  const e = input as Record<string, unknown>;

  requireString(e, "decisionId", errors);
  requireString(e, "recommendationId", errors);
  requireString(e, "originatingExecutive", errors);
  requireString(e, "dateProposed", errors);
  requireString(e, "founderRationale", errors);
  requireString(e, "actionOwner", errors);

  if (!Array.isArray(e.evidenceSnapshot)) {
    errors.push("evidenceSnapshot must be an array");
  }
  if (typeof e.confidenceAtDecision !== "number") {
    errors.push("confidenceAtDecision must be a number");
  } else if (e.confidenceAtDecision < 0 || e.confidenceAtDecision > 1) {
    errors.push("confidenceAtDecision must be between 0 and 1");
  }
  if (!FOUNDERS.includes(e.founderDecision as FounderDecision)) {
    errors.push("founderDecision is invalid");
  }
  if (!OUTCOMES.includes(e.outcomeStatus as (typeof OUTCOMES)[number])) {
    errors.push("outcomeStatus is invalid");
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, entry: e as unknown as DecisionJournalEntry };
}

function requireString(
  obj: Record<string, unknown>,
  key: string,
  errors: string[],
): void {
  if (typeof obj[key] !== "string" || !(obj[key] as string).trim()) {
    errors.push(`${key} is required`);
  }
}

/**
 * Test/local-only in-memory Decision Journal.
 * Must not be used during production Agent OS execution writes.
 */
export class InMemoryDecisionJournal {
  private readonly entries = new Map<string, DecisionJournalEntry>();

  upsert(entry: DecisionJournalEntry): void {
    const result = validateDecisionJournalEntry(entry);
    if (!result.ok) {
      throw new Error(`Invalid Decision Journal entry: ${result.errors.join("; ")}`);
    }
    this.entries.set(entry.decisionId, entry);
  }

  get(decisionId: string): DecisionJournalEntry | undefined {
    return this.entries.get(decisionId);
  }

  list(): DecisionJournalEntry[] {
    return [...this.entries.values()];
  }

  clear(): void {
    this.entries.clear();
  }
}
