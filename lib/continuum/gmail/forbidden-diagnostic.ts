/**
 * Temporary one-thread Gmail 403 diagnostic coordinator.
 * It reuses the exact-thread Source Viewer and returns aggregate status only.
 */

import {
  GMAIL_FORBIDDEN_SAFE_CATEGORIES,
  type GmailForbiddenSafeCategory,
} from "./adapter";
import type {
  PreparedIndexedMessage,
  SourceViewerFetchResult,
} from "./source-viewer";

const DIAGNOSTIC_THREAD_ID = "1a0881b53067a9e6";

export type GmailForbiddenDiagnosticResult = {
  success: boolean;
  httpStatus: number | null;
  normalizedCategory: GmailForbiddenSafeCategory | null;
};

type DiagnosticBatch = {
  fetchThread(input: {
    threadId: string;
    indexed: readonly PreparedIndexedMessage[];
  }): Promise<SourceViewerFetchResult>;
};

export type GmailForbiddenDiagnosticDependencies = {
  founderSessionOk: boolean;
  listIndexedMessagesByThread(
    threadId: string,
  ): Promise<readonly PreparedIndexedMessage[]>;
  createBatch(): Promise<DiagnosticBatch | null>;
};

function failed(
  httpStatus: number | null = null,
  normalizedCategory: GmailForbiddenSafeCategory = "unknown_forbidden",
): GmailForbiddenDiagnosticResult {
  return { success: false, httpStatus, normalizedCategory };
}

function isForbiddenCategory(
  value: string,
): value is GmailForbiddenSafeCategory {
  return (GMAIL_FORBIDDEN_SAFE_CATEGORIES as readonly string[]).includes(value);
}

export async function runGmailForbiddenDiagnostic(
  dependencies: GmailForbiddenDiagnosticDependencies,
): Promise<GmailForbiddenDiagnosticResult> {
  if (!dependencies.founderSessionOk) return failed();

  let indexed: readonly PreparedIndexedMessage[];
  try {
    indexed = (
      await dependencies.listIndexedMessagesByThread(DIAGNOSTIC_THREAD_ID)
    ).filter((row) => row.threadId === DIAGNOSTIC_THREAD_ID);
  } catch {
    return failed();
  }
  if (indexed.length === 0) return failed();

  let batch: DiagnosticBatch | null;
  try {
    batch = await dependencies.createBatch();
  } catch {
    return failed();
  }
  if (!batch) return failed();

  let result: SourceViewerFetchResult;
  try {
    result = await batch.fetchThread({
      threadId: DIAGNOSTIC_THREAD_ID,
      indexed,
    });
  } catch {
    return failed();
  }

  if (result.ok) {
    return { success: true, httpStatus: 200, normalizedCategory: null };
  }
  if (
    result.httpStatus === 403 &&
    isForbiddenCategory(result.safeErrorCode)
  ) {
    return failed(403, result.safeErrorCode);
  }
  return failed(result.httpStatus ?? null);
}
