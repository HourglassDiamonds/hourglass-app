/**
 * Re-apply generated-operating-mail provenance onto stored Gmail candidates.
 * Uses indexed from_email_hash vs cadence sender hashes. Never subject matching.
 * Presentation/load only. Does not write Candidates.
 */

import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import {
  isGeneratedFounderOperatingMail,
  withGeneratedFounderOperatingBriefRule,
} from "./generated-source";
import { parseGmailCandidateSourceRef } from "./source-ref";

export function withIndexedGeneratedOperatingMail(
  candidates: readonly ContinuumCandidate[],
  fromEmailHashByMessageId: ReadonlyMap<string, string | null | undefined>,
  generatedEmailHashes: readonly string[],
): ContinuumCandidate[] {
  if (generatedEmailHashes.length === 0) return [...candidates];
  return candidates.map((row) => {
    const parsed = parseGmailCandidateSourceRef(row.sourceRef);
    if (!parsed) return row;
    const fromHash =
      fromEmailHashByMessageId.get(parsed.messageId) ??
      fromEmailHashByMessageId.get(parsed.messageId.toLowerCase()) ??
      null;
    const generated = isGeneratedFounderOperatingMail(fromHash, generatedEmailHashes);
    if (!generated) return row;
    return {
      ...row,
      evidenceBasis: {
        ...row.evidenceBasis,
        ruleIds: withGeneratedFounderOperatingBriefRule(
          row.evidenceBasis.ruleIds,
          true,
        ),
      },
    };
  });
}
