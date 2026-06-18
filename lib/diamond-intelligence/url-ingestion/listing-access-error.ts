/** Classify retailer listing fetch failures for client-facing copy. */
export function isListingAccessBlockedMessage(
  status: string | undefined | null,
  error: string | undefined | null,
): boolean {
  if (status === "listing_inaccessible") return true;
  const message = error?.trim() ?? "";
  if (!message) return false;
  return /\bHTTP\s*403\b/i.test(message) || /\b403\b/.test(message);
}

export function resolveUrlIngestUploadErrorKind(
  status: string | undefined | null,
  error: string | undefined | null,
): "listing_inaccessible" | "interpret_failure" {
  return isListingAccessBlockedMessage(status, error)
    ? "listing_inaccessible"
    : "interpret_failure";
}
