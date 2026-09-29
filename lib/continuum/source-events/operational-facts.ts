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

export function extractCurrentMessageOperationalFacts(
  plaintext: string | null | undefined,
): string | null {
  const own = authorOwnedText(plaintext);
  if (!own.trim()) return null;
  const units = own
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map(compact)
    .filter(Boolean);
  const selected = units.filter((unit) => OPERATIONAL.test(unit));
  if (selected.length === 0) return null;
  return selected.slice(0, 6).join(" ").slice(0, 1200);
}
