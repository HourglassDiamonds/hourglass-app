/** Display-only upload MIME hints for consumer UI routing — not validation logic. */

export type ReportUploadMimeHint = {
  mime?: string | null;
  originalMime?: string | null;
  normalizedMime?: string | null;
  fileName?: string | null;
};

function normalizeMime(value?: string | null): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || undefined;
}

/** Prefer server/client MIME fields; fall back to filename extension only when MIME is absent or inconclusive. */
export function isLikelyReportImageUpload(hint: ReportUploadMimeHint): boolean {
  const mimeChain = [
    hint.normalizedMime,
    hint.originalMime,
    hint.mime,
  ]
    .map(normalizeMime)
    .filter(Boolean) as string[];

  for (const mime of mimeChain) {
    if (mime.startsWith("image/")) return true;
    if (mime === "application/pdf") return false;
  }

  const fileName = hint.fileName?.trim();
  if (!fileName) return false;
  return /\.(png|jpe?g|webp|heic|heif|bmp)$/i.test(fileName);
}

export function mergeReportUploadMimeHint(
  base: ReportUploadMimeHint,
  override?: Partial<ReportUploadMimeHint> | null,
): ReportUploadMimeHint {
  if (!override) return base;
  return {
    fileName: override.fileName ?? base.fileName,
    mime: override.mime ?? base.mime,
    originalMime: override.originalMime ?? base.originalMime,
    normalizedMime: override.normalizedMime ?? base.normalizedMime,
  };
}

export function buildReportUploadMimeHintFromApi(input?: {
  mime?: string;
  normalizedMime?: string;
  originalMime?: string;
} | null): Partial<ReportUploadMimeHint> | undefined {
  if (!input) return undefined;
  const hint: Partial<ReportUploadMimeHint> = {};
  if (input.mime?.trim()) hint.mime = input.mime.trim();
  if (input.normalizedMime?.trim()) {
    hint.normalizedMime = input.normalizedMime.trim();
  }
  if (input.originalMime?.trim()) hint.originalMime = input.originalMime.trim();
  return Object.keys(hint).length > 0 ? hint : undefined;
}
