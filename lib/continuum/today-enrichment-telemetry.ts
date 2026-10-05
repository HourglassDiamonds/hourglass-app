import type { TodayLiveEnrichmentDiagnostics } from "./gmail/today-thread-context";

export const TODAY_LIVE_ENRICHMENT_EVENT =
  "continuum.today.live_enrichment.required_thread_batch" as const;
export const TODAY_CANONICAL_INPUTS_EVENT =
  "continuum.today.canonical_inputs_loaded" as const;
export const TODAY_UNINDEXED_SOURCE_REFS_EVENT =
  "continuum.today.live_enrichment.unindexed_source_refs_skipped" as const;

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

export function emitTodayCanonicalInputCounts(input: {
  jobsConnected: boolean;
  jobCount: number;
  projectCount: number;
  candidateCount: number;
}): void {
  console.info(JSON.stringify({ event: TODAY_CANONICAL_INPUTS_EVENT, ...input }));
}

export function emitTodayUnindexedSourceRefCount(count: number): void {
  console.info(JSON.stringify({ event: TODAY_UNINDEXED_SOURCE_REFS_EVENT, count }));
}

export function emitTodayPipelineFailure(
  event:
    | "continuum.today.snapshot_publish_failed"
    | "continuum.today.recompute_failed"
    | "continuum.today.authenticated_read_failed",
  error: unknown,
): void {
  console.error(JSON.stringify({
    event,
    code: error instanceof Error ? error.message.slice(0, 120) : "unknown",
  }));
}
