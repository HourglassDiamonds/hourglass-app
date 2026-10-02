import type { TodayLiveEnrichmentDiagnostics } from "./gmail/today-thread-context";

export const TODAY_LIVE_ENRICHMENT_EVENT =
  "continuum.today.live_enrichment.required_thread_batch" as const;

/**
 * Content-free aggregate telemetry. Deliberately excludes thread/message IDs,
 * subjects, participants, attachment names, and operational text.
 */
export function emitTodayLiveEnrichmentDiagnostics(
  diagnostics: TodayLiveEnrichmentDiagnostics,
): void {
  const line = {
    event: TODAY_LIVE_ENRICHMENT_EVENT,
    requestedThreadCount: diagnostics.requestedThreadCount,
    completedThreadCount: diagnostics.completedThreadCount,
    failedThreadCount: diagnostics.failedThreadCount,
    missingIndexedThreadCount: diagnostics.missingIndexedThreadCount,
    missingLiveMessageThreadCount: diagnostics.missingLiveMessageThreadCount,
    threadFetches: diagnostics.threadFetches,
    durationMs: diagnostics.durationMs,
    failuresByCode: diagnostics.failuresByCode,
    sizeBuckets: diagnostics.sizeBuckets,
    attachmentThreads: diagnostics.attachmentThreads,
    nonAttachmentThreads: diagnostics.nonAttachmentThreads,
  };
  console.info(JSON.stringify(line));
}
