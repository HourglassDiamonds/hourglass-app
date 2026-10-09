/**
 * Aggregate-only Gmail evidence completeness audit for the two explicitly
 * authorized Sterling Today cases. This module never accepts scope from a
 * caller and never returns live message material.
 */

import { extractCurrentMessageOperationalFacts } from "@/lib/continuum/source-events/operational-facts";
import type {
  PreparedIndexedMessage,
  SourceViewerErrorCode,
  SourceViewerFetchResult,
} from "./source-viewer";

export const GMAIL_EVIDENCE_AUDIT_CASE_KEYS = ["sarah", "nathan"] as const;

export type GmailEvidenceAuditCaseKey =
  (typeof GMAIL_EVIDENCE_AUDIT_CASE_KEYS)[number];

const AUTHORIZED_SCOPES = Object.freeze([
  Object.freeze({
    caseKey: "sarah" as const,
    threadIds: Object.freeze(["1a0881b53067a9e6", "1a01c4ee4d198ef0"]),
  }),
  Object.freeze({
    caseKey: "nathan" as const,
    threadIds: Object.freeze(["1a09120d797337d9", "19a854e42f90344f"]),
  }),
]);

export type GmailEvidenceAuditSafeErrorCategory =
  | SourceViewerErrorCode
  | "index-unavailable"
  | "unindexed-thread"
  | "live-credentials-unavailable";

export type GmailEvidenceAuditCaseResult = {
  scopedMessageCount: number;
  indexedMessageCount: number;
  successfullyLiveRetrievedMessageCount: number;
  unavailableMessageCount: number;
  completeness: "complete" | "incomplete";
  substantiveAuthorOwnedContentCount: number;
  attachmentPresenceMessageCount: number;
  safeErrorCategories: readonly GmailEvidenceAuditSafeErrorCategory[];
};

export type GmailEvidenceAuditResult = {
  completeness: "complete" | "incomplete";
  cases: Readonly<Record<GmailEvidenceAuditCaseKey, GmailEvidenceAuditCaseResult>>;
  safeErrorCategories: readonly GmailEvidenceAuditSafeErrorCategory[];
};

type AuditBatch = {
  fetchThread(input: {
    threadId: string;
    indexed: readonly PreparedIndexedMessage[];
  }): Promise<SourceViewerFetchResult>;
};

export type GmailEvidenceAuditDependencies = {
  founderSessionOk: boolean;
  listIndexedMessagesByThread(
    threadId: string,
  ): Promise<readonly PreparedIndexedMessage[]>;
  createBatch(): Promise<AuditBatch | null>;
};

type MutableCaseResult = {
  indexedMessageCount: number;
  successfullyLiveRetrievedMessageCount: number;
  unavailableMessageCount: number;
  substantiveAuthorOwnedContentCount: number;
  attachmentPresenceMessageCount: number;
  safeErrors: Set<GmailEvidenceAuditSafeErrorCategory>;
};

function emptyCases(): Record<GmailEvidenceAuditCaseKey, MutableCaseResult> {
  return {
    sarah: {
      indexedMessageCount: 0,
      successfullyLiveRetrievedMessageCount: 0,
      unavailableMessageCount: 0,
      substantiveAuthorOwnedContentCount: 0,
      attachmentPresenceMessageCount: 0,
      safeErrors: new Set(),
    },
    nathan: {
      indexedMessageCount: 0,
      successfullyLiveRetrievedMessageCount: 0,
      unavailableMessageCount: 0,
      substantiveAuthorOwnedContentCount: 0,
      attachmentPresenceMessageCount: 0,
      safeErrors: new Set(),
    },
  };
}

function sortedErrors(
  values: Iterable<GmailEvidenceAuditSafeErrorCategory>,
): GmailEvidenceAuditSafeErrorCategory[] {
  return [...new Set(values)].sort();
}

function presentResult(
  mutable: Record<GmailEvidenceAuditCaseKey, MutableCaseResult>,
): GmailEvidenceAuditResult {
  const presentCase = (row: MutableCaseResult): GmailEvidenceAuditCaseResult => {
    const safeErrorCategories = sortedErrors(row.safeErrors);
    const completeness =
      row.unavailableMessageCount === 0 && safeErrorCategories.length === 0
        ? "complete"
        : "incomplete";
    return {
      scopedMessageCount: row.indexedMessageCount,
      indexedMessageCount: row.indexedMessageCount,
      successfullyLiveRetrievedMessageCount:
        row.successfullyLiveRetrievedMessageCount,
      unavailableMessageCount: row.unavailableMessageCount,
      completeness,
      substantiveAuthorOwnedContentCount:
        row.substantiveAuthorOwnedContentCount,
      attachmentPresenceMessageCount: row.attachmentPresenceMessageCount,
      safeErrorCategories,
    };
  };
  const cases = {
    sarah: presentCase(mutable.sarah),
    nathan: presentCase(mutable.nathan),
  };
  const safeErrorCategories = sortedErrors([
    ...cases.sarah.safeErrorCategories,
    ...cases.nathan.safeErrorCategories,
  ]);
  return {
    completeness:
      cases.sarah.completeness === "complete" &&
      cases.nathan.completeness === "complete"
        ? "complete"
        : "incomplete",
    cases,
    safeErrorCategories,
  };
}

export function failedGmailEvidenceAuditResult(
  category: GmailEvidenceAuditSafeErrorCategory,
): GmailEvidenceAuditResult {
  const mutable = emptyCases();
  for (const row of Object.values(mutable)) row.safeErrors.add(category);
  return presentResult(mutable);
}

/**
 * Reads only the immutable authorized scope. Plaintext is inspected in-memory
 * and reduced to counts before this function returns.
 */
export async function runGmailEvidenceCompletenessAudit(
  dependencies: GmailEvidenceAuditDependencies,
): Promise<GmailEvidenceAuditResult> {
  if (!dependencies.founderSessionOk) {
    return failedGmailEvidenceAuditResult("unauthorized");
  }

  const mutable = emptyCases();
  const indexedByThread = new Map<string, readonly PreparedIndexedMessage[]>();

  for (const scope of AUTHORIZED_SCOPES) {
    const result = mutable[scope.caseKey];
    for (const threadId of scope.threadIds) {
      try {
        const listed = await dependencies.listIndexedMessagesByThread(threadId);
        const unique = [
          ...new Map(
            listed
              .filter((row) => row.threadId === threadId)
              .map((row) => [row.messageId, row]),
          ).values(),
        ];
        indexedByThread.set(threadId, unique);
        result.indexedMessageCount += unique.length;
        if (unique.length === 0) result.safeErrors.add("unindexed-thread");
      } catch {
        indexedByThread.set(threadId, []);
        result.safeErrors.add("index-unavailable");
      }
    }
  }

  if ([...indexedByThread.values()].every((rows) => rows.length === 0)) {
    return presentResult(mutable);
  }

  let batch: AuditBatch | null;
  try {
    batch = await dependencies.createBatch();
  } catch {
    batch = null;
  }
  if (!batch) {
    for (const result of Object.values(mutable)) {
      result.unavailableMessageCount = result.indexedMessageCount;
      if (result.indexedMessageCount > 0) {
        result.safeErrors.add("live-credentials-unavailable");
      }
    }
    return presentResult(mutable);
  }

  for (const scope of AUTHORIZED_SCOPES) {
    const result = mutable[scope.caseKey];
    for (const threadId of scope.threadIds) {
      const indexed = indexedByThread.get(threadId) ?? [];
      if (indexed.length === 0) continue;
      let fetched: SourceViewerFetchResult;
      try {
        fetched = await batch.fetchThread({ threadId, indexed });
      } catch {
        fetched = { ok: false, safeErrorCode: "unavailable" };
      }
      if (!fetched.ok) {
        result.unavailableMessageCount += indexed.length;
        result.safeErrors.add(fetched.safeErrorCode);
        continue;
      }

      const indexedIds = new Set(indexed.map((row) => row.messageId));
      const live = [
        ...new Map(
          fetched.messages
            .filter((row) => indexedIds.has(row.messageId))
            .map((row) => [row.messageId, row]),
        ).values(),
      ];
      result.successfullyLiveRetrievedMessageCount += live.length;
      result.unavailableMessageCount += Math.max(0, indexed.length - live.length);
      for (const message of live) {
        if (
          extractCurrentMessageOperationalFacts(
            message.plainText ?? message.snippet,
          ) !== null
        ) {
          result.substantiveAuthorOwnedContentCount += 1;
        }
        if (message.attachments.length > 0) {
          result.attachmentPresenceMessageCount += 1;
        }
      }
    }
  }

  return presentResult(mutable);
}
