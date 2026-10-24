import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import {
  LIVE_MESSAGE_EXTRACTION_OUTCOMES,
  type LiveMessageExtractionDiagnostic,
  type LiveMessageExtractionOutcome,
} from "@/lib/continuum/gmail/live-extraction-diagnostics";

export type SterlingSafeExtractionMismatch = LiveMessageExtractionDiagnostic & {
  messageRef: string;
};

export type SterlingTargetExtractionDiagnostics = {
  totalMessageCount: number;
  provenanceMismatchCount: number;
  outcomeCounts: Readonly<Record<LiveMessageExtractionOutcome, number>>;
  decodingSucceededCount: number;
  currentMessageTextFoundCount: number;
  operationalTextRecognizedCount: number;
  attachmentMetadataPresentCount: number;
  providerFallbackAffectedCount: number;
  uncertainCount: number;
  mismatches: readonly SterlingSafeExtractionMismatch[];
};

const UNKNOWN: LiveMessageExtractionDiagnostic = {
  outcome: "uncertain_or_failed_decoding",
  decodingSucceeded: false,
  currentMessageTextFound: false,
  operationalTextRecognized: false,
  attachmentMetadataPresent: false,
  providerFallbackAffectedExtraction: false,
  extractionUncertain: true,
};

function emptyOutcomeCounts(): Record<LiveMessageExtractionOutcome, number> {
  return Object.fromEntries(
    LIVE_MESSAGE_EXTRACTION_OUTCOMES.map((outcome) => [outcome, 0]),
  ) as Record<LiveMessageExtractionOutcome, number>;
}

/**
 * Produces request-local opaque labels and aggregate counters only. Raw Gmail
 * identifiers and message content never cross this boundary.
 */
export function summarizeSterlingTargetExtractionDiagnostics(input: {
  threadContext: ReadonlyMap<string, TodayGmailThreadContext>;
  requiredThreadIds: readonly string[];
  provenanceMismatchMessageIds: ReadonlySet<string>;
}): SterlingTargetExtractionDiagnostics {
  const required = new Set(input.requiredThreadIds);
  const messages = [...input.threadContext.entries()]
    .filter(([threadId]) => required.has(threadId))
    .flatMap(([, thread]) => thread.messages ?? [])
    .sort((left, right) => left.sentAt.localeCompare(right.sentAt) ||
      left.messageId.localeCompare(right.messageId));
  const outcomeCounts = emptyOutcomeCounts();
  let decodingSucceededCount = 0;
  let currentMessageTextFoundCount = 0;
  let operationalTextRecognizedCount = 0;
  let attachmentMetadataPresentCount = 0;
  let providerFallbackAffectedCount = 0;
  let uncertainCount = 0;
  const mismatchRows: Array<{ diagnostic: LiveMessageExtractionDiagnostic; messageId: string }> = [];

  for (const message of messages) {
    const diagnostic = message.liveExtractionDiagnostic ?? UNKNOWN;
    outcomeCounts[diagnostic.outcome] += 1;
    if (diagnostic.decodingSucceeded) decodingSucceededCount += 1;
    if (diagnostic.currentMessageTextFound) currentMessageTextFoundCount += 1;
    if (diagnostic.operationalTextRecognized) operationalTextRecognizedCount += 1;
    if (diagnostic.attachmentMetadataPresent) attachmentMetadataPresentCount += 1;
    if (diagnostic.providerFallbackAffectedExtraction) providerFallbackAffectedCount += 1;
    if (diagnostic.extractionUncertain) uncertainCount += 1;
    if (input.provenanceMismatchMessageIds.has(message.messageId)) {
      mismatchRows.push({ diagnostic, messageId: message.messageId });
    }
  }

  return {
    totalMessageCount: messages.length,
    provenanceMismatchCount: mismatchRows.length,
    outcomeCounts,
    decodingSucceededCount,
    currentMessageTextFoundCount,
    operationalTextRecognizedCount,
    attachmentMetadataPresentCount,
    providerFallbackAffectedCount,
    uncertainCount,
    mismatches: mismatchRows.map(({ diagnostic }, index) => ({
      messageRef: `mismatch-${String(index + 1).padStart(2, "0")}`,
      ...diagnostic,
    })),
  };
}
