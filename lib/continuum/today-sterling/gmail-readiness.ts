export type SuccessfulGmailCheckpoint = {
  status: string | null;
  errorCode: string | null;
  updatedAt: string | null;
};

/**
 * Initial live readiness requires provider ingestion after the credential was
 * authorized. An old checkpoint that merely remains inside the freshness
 * window cannot validate a newly authorized mailbox.
 */
export function hasSuccessfulGmailIngestionAfterAuthorization(
  authorizedAt: string | null | undefined,
  checkpoints: readonly SuccessfulGmailCheckpoint[],
): boolean {
  const authorizedMs = Date.parse(authorizedAt ?? "");
  if (!Number.isFinite(authorizedMs)) return false;
  return checkpoints.some((checkpoint) => {
    if (checkpoint.status !== "completed" || checkpoint.errorCode) return false;
    const checkpointMs = Date.parse(checkpoint.updatedAt ?? "");
    return Number.isFinite(checkpointMs) && checkpointMs > authorizedMs;
  });
}
