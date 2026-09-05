/**
 * Email This View card images are delivery artifacts, not an archive.
 * Zero the in-memory JPEG after the send attempt so retries compose fresh.
 */
export function releaseStudioSnapshotBuffer(buffer: Buffer): void {
  if (buffer.length === 0) return;
  buffer.fill(0);
}
