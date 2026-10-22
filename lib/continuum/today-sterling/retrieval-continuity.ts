import { createHash, createHmac } from "node:crypto";
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
  expiresAt: string;
  latestIndexedMessageAt: string | null;
  indexedMessageCount: number;
  outcome: "complete_live";
  revision: number;
};

export type SterlingThreadVerificationPlan = {
  requiredThreadCount: number;
  reusableVerificationCount: number;
  expiredVerificationCount: number;
  invalidatedVerificationCount: number;
  reusedVerificationThreadIds: readonly string[];
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

export function sterlingThreadKeyDigest(threadId: string, hmacKey: string): string {
  if (Buffer.byteLength(hmacKey, "utf8") < 32) throw new Error("sterling-continuity-hmac-key-invalid");
  return createHmac("sha256", hmacKey).update(`sterling-thread-v1:${threadId.trim()}`).digest("hex");
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
  threadKeyHmacKey: string;
  /** Reviewed target threads move within, but never expand, the portfolio frontier. */
  priorityThreadIds?: readonly string[];
  /** Targeted semantic assembly must live-read these even when planning metadata is fresh. */
  forceLiveThreadIds?: readonly string[];
}): SterlingThreadVerificationPlan {
  const requiredSet = new Set(collectSterlingRequiredLiveThreadIds(input.workingSet));
  const priority = [...new Set(input.priorityThreadIds ?? [])].filter((threadId) => requiredSet.has(threadId));
  const prioritySet = new Set(priority);
  const required = [...priority, ...[...requiredSet].filter((threadId) => !prioritySet.has(threadId))];
  const forceLive = new Set(input.forceLiveThreadIds ?? []);
  const prior = new Map((input.priorVerifications ?? []).map((row) => [row.threadKeyDigest, row]));
  const now = (input.now ?? new Date()).getTime();
  const maxAgeMs = Math.max(0, input.maxAgeMs ?? STERLING_THREAD_VERIFICATION_MAX_AGE_MS);
  const needingLive: string[] = [];
  const reusedVerificationThreadIds: string[] = [];
  let reusableVerificationCount = 0;
  let expiredVerificationCount = 0;
  let invalidatedVerificationCount = 0;

  for (const threadId of required) {
    const current = sterlingIndexedThreadFingerprint(input.workingSet, threadId);
    const checkpoint = prior.get(sterlingThreadKeyDigest(threadId, input.threadKeyHmacKey));
    const verifiedAt = checkpoint ? Date.parse(checkpoint.verifiedAt) : Number.NaN;
    const expiresAt = checkpoint ? Date.parse(checkpoint.expiresAt) : Number.NaN;
    const chronologyMatches = checkpoint?.outcome === "complete_live" &&
      checkpoint.indexedFingerprint === current.fingerprint &&
      checkpoint.indexedMessageCount === current.indexedMessageCount &&
      checkpoint.latestIndexedMessageAt === current.latestIndexedMessageAt;
    const fresh = Number.isFinite(verifiedAt) && Number.isFinite(expiresAt) &&
      now <= expiresAt && now - verifiedAt <= maxAgeMs;
    const reusable = !forceLive.has(threadId) && checkpoint?.outcome === "complete_live" &&
      chronologyMatches && fresh;
    if (reusable) {
      reusableVerificationCount += 1;
      reusedVerificationThreadIds.push(threadId);
    }
    else {
      if (checkpoint && chronologyMatches && !fresh) expiredVerificationCount += 1;
      else if (checkpoint) invalidatedVerificationCount += 1;
      needingLive.push(threadId);
    }
  }

  const budget = Math.max(0, Math.floor(input.requestBudget ?? 48));
  return {
    requiredThreadCount: required.length,
    reusableVerificationCount,
    expiredVerificationCount,
    invalidatedVerificationCount,
    reusedVerificationThreadIds,
    liveRequestThreadIds: needingLive.slice(0, budget),
    budgetDeferredThreadIds: needingLive.slice(budget),
    semanticEvidenceReusable: false,
  };
}
