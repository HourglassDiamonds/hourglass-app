import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { candidateDispositionCorrectionEvents } from "@/lib/continuum/concierge-sol/founder-command";
import type { SourceCommunicationEvent } from "@/lib/continuum/source-events/types";

/**
 * Includes durable, source-identity-bound founder dispositions in Sterling's
 * authority stream. These rows already retain their review audit in the
 * candidate store; this adapter prevents v6 recomposition from overlooking
 * them merely because no canonical Person or Project exists yet.
 */
export function mergeSterlingFounderCorrections(
  canonicalCorrections: readonly SourceCommunicationEvent[],
  candidates: readonly ContinuumCandidate[],
): SourceCommunicationEvent[] {
  return [
    ...canonicalCorrections,
    ...candidateDispositionCorrectionEvents(candidates),
  ];
}
