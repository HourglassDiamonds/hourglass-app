import type { DiamondVendorId } from "./types";
import { validateListingUrl } from "./url-safety";

const RARE_CARAT_CDN_HOST = "cldnr.rarecarat.com";
const PNG_WRAPPER_PATH_MARKER = "/f_png,";

export type RareCaratReportFetchResolution = {
  fetchUrl: string;
  unwrapped: boolean;
};

/** True when the URL is a Rare Carat CDN PNG raster wrapper around another resource. */
export function isRareCaratCdnPngWrapper(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.toLowerCase() === RARE_CARAT_CDN_HOST &&
      parsed.pathname.toLowerCase().includes(PNG_WRAPPER_PATH_MARKER)
    );
  } catch {
    return false;
  }
}

/**
 * Extract an embedded https PDF URL from a Rare Carat CDN PNG wrapper.
 * Returns null when the wrapper is malformed or the embedded target is not https PDF.
 */
export function extractEmbeddedHttpsPdfUrl(wrapperUrl: string): string | null {
  if (!isRareCaratCdnPngWrapper(wrapperUrl)) {
    return null;
  }

  const markerIndex = wrapperUrl.toLowerCase().indexOf(PNG_WRAPPER_PATH_MARKER);
  if (markerIndex < 0) {
    return null;
  }

  const tail = wrapperUrl.slice(markerIndex + PNG_WRAPPER_PATH_MARKER.length);
  const match = tail.match(/(https:\/\/[^\s"'<>]+\.pdf(?:\?[^\s"'<>]*)?)/i);
  const embedded = match?.[1];
  if (!embedded) {
    return null;
  }

  try {
    const parsed = new URL(embedded);
    if (parsed.protocol !== "https:") {
      return null;
    }
    if (!parsed.pathname.toLowerCase().endsWith(".pdf")) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Rare Carat URL ingestion only — prefer embedded PDF over PNG wrapper when safe.
 * Falls back to the original report URL when unwrap is unavailable or unsafe.
 */
export function resolveRareCaratReportFetchUrl(
  vendor: DiamondVendorId,
  reportUrl: string,
): RareCaratReportFetchResolution {
  if (vendor !== "rare-carat") {
    return { fetchUrl: reportUrl, unwrapped: false };
  }

  const embedded = extractEmbeddedHttpsPdfUrl(reportUrl);
  if (!embedded) {
    return { fetchUrl: reportUrl, unwrapped: false };
  }

  const safety = validateListingUrl(embedded);
  if (!safety.ok) {
    return { fetchUrl: reportUrl, unwrapped: false };
  }

  return { fetchUrl: embedded, unwrapped: true };
}
