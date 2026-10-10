"use server";

import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import { createLiveSourceViewerBatch } from "@/lib/continuum/gmail/source-viewer-run";
import {
  runGmailForbiddenDiagnostic,
  type GmailForbiddenDiagnosticResult,
} from "@/lib/continuum/gmail/forbidden-diagnostic";

export async function runGmailForbiddenDiagnosticAction(): Promise<GmailForbiddenDiagnosticResult> {
  const auth = await getAuthenticatedGmailHistoryStores();
  if (!auth.ok) {
    return {
      success: false,
      httpStatus: null,
      normalizedCategory: "unknown_forbidden",
    };
  }

  return runGmailForbiddenDiagnostic({
    founderSessionOk: true,
    listIndexedMessagesByThread: (threadId) =>
      auth.index.listMessagesByThread(threadId),
    createBatch: () => createLiveSourceViewerBatch(30_000),
  });
}
