"use server";

import "server-only";

import {
  failedGmailEvidenceAuditResult,
  runGmailEvidenceCompletenessAudit,
  type GmailEvidenceAuditResult,
} from "@/lib/continuum/gmail/evidence-completeness-audit";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import { createLiveSourceViewerBatch } from "@/lib/continuum/gmail/source-viewer-run";

/**
 * Founder-only, aggregate-only audit. It intentionally accepts no arguments,
 * so a caller cannot broaden the immutable Sarah/Nathan scope.
 */
export async function runPrivateGmailEvidenceAuditAction(): Promise<GmailEvidenceAuditResult> {
  const auth = await getAuthenticatedGmailHistoryStores();
  if (!auth.ok) {
    return failedGmailEvidenceAuditResult(
      auth.reason === "unauthorized" ? "unauthorized" : "index-unavailable",
    );
  }

  return runGmailEvidenceCompletenessAudit({
    founderSessionOk: true,
    listIndexedMessagesByThread: async (threadId) => {
      const rows = await auth.index.listMessagesByThread(threadId);
      return rows.map((row) => ({
        messageId: row.messageId,
        threadId: row.threadId,
        sentAt: row.sentAt,
        subject: null,
      }));
    },
    createBatch: () => createLiveSourceViewerBatch(30_000),
  });
}
