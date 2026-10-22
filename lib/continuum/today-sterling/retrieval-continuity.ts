import { createHash } from "node:crypto";
import type { SterlingTodayWorkingSet } from "./types";
import { collectSterlingRequiredLiveThreadIds } from "./evidence-completeness";

export const STERLING_THREAD_VERIFICATION_MAX_AGE_MS = 15 * 60 * 1000;

/**
 * Content-free continuity metadata proposed for a separately authorized store.
 * It cannot reconstruct Gmail content and therefore is not used by semantic
 * execution. It only supports assembly verification planning.
 */
export type SterlingThreadVerificationMetadata = {
  threadKeyDigest: string;
  indexedFingerprint: string;
  verifiedAt: string;
  latestIndexedMessageAt: string | null;
  indexedMessageCount: number;
  outcome: "complete_live";
};

export type SterlingThreadVerificationPlan = {
  requiredThreadCount: number;
  reusableVerificationCount: number;
  invalidatedVerificationCount: number;
  liveRequestThreadIds: readonly string[];
  budgetDeferredThreadIds: readonly string[];
  /** Always false until minimized model evidence has its own approved store. */
  semanticEvidenceReusable: false;
};

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function threadEvidence(workingSet: SterlingTodayWorkingSet, threadId: string) {
  return workingSet.evidence.filter((row) => row.threadId === threadId);
}

export function sterlingThreadKeyDigest(threadId: string): string {
  return digest(`sterling-thread-v1:${threadId.trim()}`);
}

export function sterlingIndexedThreadFingerprint(
  workingSet: SterlingTodayWorkingSet,
  threadId: string,
): { fingerprint: string; latestIndexedMessageAt: string | null; indexedMessageCount: number } {
  const rows = threadEvidence(workingSet, threadId).sort((a, b) =>
    `${a.messageId ?? ""}|${a.timestamp}`.localeCompare(`${b.messageId ?? ""}|${b.timestamp}`));
  return {
    fingerprint: digest(JSON.stringify(rows.map((row) => ({
      messageId: row.messageId,
      timestamp: row.timestamp,
      direction: row.direction,
      hasAttachments: row.attachmentFilenames.length > 0,
    })))),
    latestIndexedMessageAt: rows.map((row) => row.timestamp).sort().at(-1) ?? null,
    indexedMessageCount: rows.length,
  };
}

export function planSterlingThreadVerificationContinuity(input: {
  workingSet: SterlingTodayWorkingSet;
  priorVerifications?: readonly SterlingThreadVerificationMetadata[];
  now?: Date;
  maxAgeMs?: number;
  requestBudget?: number;
}): SterlingThreadVerificationPlan {
  const required = collectSterlingRequiredLiveThreadIds(input.workingSet);
  const prior = new Map((input.priorVerifications ?? []).map((row) => [row.threadKeyDigest, row]));
  const now = (input.now ?? new Date()).getTime();
  const maxAgeMs = Math.max(0, input.maxAgeMs ?? STERLING_THREAD_VERIFICATION_MAX_AGE_MS);
  const needingLive: string[] = [];
  let reusableVerificationCount = 0;
  let invalidatedVerificationCount = 0;

  for (const threadId of required) {
    const current = sterlingIndexedThreadFingerprint(input.workingSet, threadId);
    const checkpoint = prior.get(sterlingThreadKeyDigest(threadId));
    const verifiedAt = checkpoint ? Date.parse(checkpoint.verifiedAt) : Number.NaN;
    const reusable = checkpoint?.outcome === "complete_live" &&
      checkpoint.indexedFingerprint === current.fingerprint &&
      checkpoint.indexedMessageCount === current.indexedMessageCount &&
      checkpoint.latestIndexedMessageAt === current.latestIndexedMessageAt &&
      Number.isFinite(verifiedAt) && now - verifiedAt <= maxAgeMs;
    if (reusable) reusableVerificationCount += 1;
    else {
      if (checkpoint) invalidatedVerificationCount += 1;
      needingLive.push(threadId);
    }
  }

  const budget = Math.max(0, Math.floor(input.requestBudget ?? 48));
  return {
    requiredThreadCount: required.length,
    reusableVerificationCount,
    invalidatedVerificationCount,
    liveRequestThreadIds: needingLive.slice(0, budget),
    budgetDeferredThreadIds: needingLive.slice(budget),
    semanticEvidenceReusable: false,
  };
}
