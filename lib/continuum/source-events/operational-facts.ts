/**
 * Extract the smallest quote-stripped current-message wording needed by Today.
 * The returned excerpts are ephemeral read-model facts, never persisted bodies.
 */

import { authorOwnedText } from "@/lib/continuum/gmail/candidates/spec-provenance";

const OPERATIONAL =
  /\b(?:CAD|STL|render|revision|revise|approved|approval|order confirmation|SP\d{4,}|RN\d{4,}|workshop|production|ready|complete|completed|deliver(?:y|ed)?|ship(?:ped|ping)?|tracking|dependency|waiting on|sent to|received|I should have it|I(?:'ll| will) (?:have|send|deliver)|business days?|tomorrow|by \d{1,2}[/-]\d{1,2})\b/i;

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function operationalPriority(unit: string): number {
  if (/\b(?:production (?:has )?started|started production|in (?:production|manufacturing)|on the bench)\b/i.test(unit)) return 100;
  if (/\b(?:ready for (?:pickup|collection|delivery)|ready to ship|delivered|completed|complete)\b/i.test(unit)) return 95;
  if (/\border confirmation|\bSP\d{4,}\b/i.test(unit)) return 90;
  if (/\bwaiting (?:on|for)|dependency|pearl|center stone|finger size\b/i.test(unit)) return 85;
  if (/\b(?:tomorrow|business days?|delivery by|deliver by|expected|due|promise)\b/i.test(unit)) return 80;
  if (/\b(?:CAD|STL|render|revision|revise|approved|approval)\b/i.test(unit)) return 70;
  return 10;
}

export function extractCurrentMessageOperationalFacts(
  plaintext: string | null | undefined,
): string | null {
  const own = authorOwnedText(plaintext);
  if (!own.trim()) return null;
  const units = own
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map(compact)
    .filter(Boolean);
  const selected = units
    .map((unit, index) => ({ unit, index, priority: operationalPriority(unit) }))
    .filter(({ unit }) => OPERATIONAL.test(unit))
    .sort((a, b) => b.priority - a.priority || a.index - b.index)
    .slice(0, 12)
    .sort((a, b) => a.index - b.index)
    .map(({ unit }) => unit);
  if (selected.length === 0) return null;
  return selected.join(" ").slice(0, 2400);
}
