import type { SterlingEvidence } from "./types";

export type SterlingTargetChronologyDiagnostics = {
  missingMessageIdCount: number;
  malformedMessageIdCount: number;
  duplicateMessageIdCount: number;
  invalidTimestampCount: number;
  outOfOrderMessageCount: number;
  missingRequiredThreadCount: number;
  requiredThreadMembershipMismatchCount: number;
  provenanceMismatchCount: number;
  unexpectedEvidenceMembershipCount: number;
  indexedLiveCountDisagreementCount: number;
  indexedIncludedCountDisagreementCount: number;
};

type TargetChronologyInput = {
  evidence: readonly SterlingEvidence[];
  requiredThreadIds: readonly string[];
  referencedEvidenceIds: readonly string[];
  indexedMessageCount: number;
  liveMessageCount: number;
  includedMessageCount: number;
};

const GMAIL_OPAQUE_ID = /^[A-Za-z0-9_-]+$/;
const COMPLETE_LIVE_PROVENANCE = "indexed_gmail+live_quote_stripped_current_message";

export function diagnoseSterlingTargetChronology(
  input: TargetChronologyInput,
): SterlingTargetChronologyDiagnostics {
  const requiredThreads = new Set(input.requiredThreadIds);
  const referencedEvidence = new Set(input.referencedEvidenceIds);
  const seenMessageIds = new Set<string>();
  let missingMessageIdCount = 0;
  let malformedMessageIdCount = 0;
  let duplicateMessageIdCount = 0;
  let invalidTimestampCount = 0;
  let outOfOrderMessageCount = 0;
  let requiredThreadMembershipMismatchCount = 0;
  let provenanceMismatchCount = 0;
  let unexpectedEvidenceMembershipCount = 0;
  let previousTimestamp: number | null = null;

  for (const row of input.evidence) {
    const messageId = row.messageId?.trim() ?? "";
    if (!messageId) missingMessageIdCount += 1;
    else {
      if (messageId !== row.messageId || !GMAIL_OPAQUE_ID.test(messageId)) malformedMessageIdCount += 1;
      if (seenMessageIds.has(messageId)) duplicateMessageIdCount += 1;
      else seenMessageIds.add(messageId);
    }

    const timestamp = Date.parse(row.timestamp);
    if (!Number.isFinite(timestamp)) invalidTimestampCount += 1;
    else {
      if (previousTimestamp !== null && timestamp < previousTimestamp) outOfOrderMessageCount += 1;
      previousTimestamp = timestamp;
    }

    if (!row.threadId || !requiredThreads.has(row.threadId)) requiredThreadMembershipMismatchCount += 1;
    if (row.provenance !== COMPLETE_LIVE_PROVENANCE) provenanceMismatchCount += 1;
    if (!referencedEvidence.has(row.evidenceId)) unexpectedEvidenceMembershipCount += 1;
  }

  const observedThreads = new Set(input.evidence.flatMap((row) => row.threadId ? [row.threadId] : []));
  const missingRequiredThreadCount = input.requiredThreadIds.filter((threadId) => !observedThreads.has(threadId)).length;
  return {
    missingMessageIdCount,
    malformedMessageIdCount,
    duplicateMessageIdCount,
    invalidTimestampCount,
    outOfOrderMessageCount,
    missingRequiredThreadCount,
    requiredThreadMembershipMismatchCount,
    provenanceMismatchCount,
    unexpectedEvidenceMembershipCount,
    indexedLiveCountDisagreementCount: Math.abs(input.indexedMessageCount - input.liveMessageCount),
    indexedIncludedCountDisagreementCount: Math.abs(input.indexedMessageCount - input.includedMessageCount),
  };
}

export function sterlingTargetChronologyComplete(
  diagnostics: SterlingTargetChronologyDiagnostics,
): boolean {
  return Object.values(diagnostics).every((count) => count === 0);
}

export function sterlingTargetChronologyFailureStage(
  diagnostics: SterlingTargetChronologyDiagnostics,
): "target-package-cross-unit-evidence" | "target-evidence-binding-incomplete" |
  "target-chronology-incomplete" | null {
  if (diagnostics.requiredThreadMembershipMismatchCount > 0) {
    return "target-package-cross-unit-evidence";
  }
  if (diagnostics.missingRequiredThreadCount > 0 || diagnostics.unexpectedEvidenceMembershipCount > 0) {
    return "target-evidence-binding-incomplete";
  }
  return sterlingTargetChronologyComplete(diagnostics) ? null : "target-chronology-incomplete";
}
