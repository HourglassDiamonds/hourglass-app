/**
 * Founder-facing Gmail index freshness for intake.
 * Reads the existing #16B incremental checkpoint. Does not start a second sync.
 */

export const GMAIL_INDEX_STALE_AFTER_MS = 4 * 60 * 60 * 1000;
export const GMAIL_INDEX_FOUNDER_TIME_ZONE = "America/New_York" as const;

export function isGmailIndexStale(
  lastSuccessfulSyncAt: string | null | undefined,
  nowIso: string,
  staleAfterMs = GMAIL_INDEX_STALE_AFTER_MS,
): boolean {
  if (!lastSuccessfulSyncAt) return true;
  const last = Date.parse(lastSuccessfulSyncAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(last) || !Number.isFinite(now)) return true;
  return now - last >= staleAfterMs;
}

export function formatGmailIndexUpdatedAt(
  iso: string | null | undefined,
  timeZone = GMAIL_INDEX_FOUNDER_TIME_ZONE,
): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}
