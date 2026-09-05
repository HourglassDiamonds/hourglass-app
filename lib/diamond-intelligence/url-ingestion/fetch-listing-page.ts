import type { FetchedListingPage } from "./types";
import {
  fetchValidatedRemoteUrl,
  readResponseBytesWithLimit,
  readResponseTextWithLimit,
  URL_FETCH_BINARY_MAX_BYTES,
  URL_FETCH_MAX_BYTES,
  URL_FETCH_MAX_REDIRECTS,
  URL_FETCH_TIMEOUT_MS,
} from "./safe-remote-fetch";

export {
  URL_FETCH_TIMEOUT_MS,
  URL_FETCH_MAX_REDIRECTS,
  URL_FETCH_MAX_BYTES,
  URL_FETCH_BINARY_MAX_BYTES,
};

const LEGACY_USER_AGENT =
  "HourglassDiamondIntelligence/1.0 (+https://hourglass.com/diamond-intelligence)";

const BROWSER_LISTING_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Browser-like headers for retailer listing HTML — one narrow access improvement. */
export function buildListingPageFetchHeaders(
  listingUrl: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: BROWSER_LISTING_ACCEPT,
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": BROWSER_USER_AGENT,
  };
  try {
    headers.Referer = `${new URL(listingUrl).origin}/`;
  } catch {
    // omit referer when URL is invalid — caller should not reach fetch in that case
  }
  return headers;
}

const USER_AGENT = LEGACY_USER_AGENT;

export type FetchListingResult =
  | { ok: true; page: FetchedListingPage }
  | { ok: false; reason: string };

export async function fetchListingPage(
  url: string,
  options?: { timeoutMs?: number; maxRedirects?: number; maxBytes?: number },
): Promise<FetchListingResult> {
  const timeoutMs = options?.timeoutMs ?? URL_FETCH_TIMEOUT_MS;
  const maxRedirects = options?.maxRedirects ?? URL_FETCH_MAX_REDIRECTS;
  const maxBytes = options?.maxBytes ?? URL_FETCH_MAX_BYTES;

  const fetched = await fetchValidatedRemoteUrl(url, {
    timeoutMs,
    maxRedirects,
    maxBytes,
    headers: buildListingPageFetchHeaders(url),
    timeoutReason: "Timed out while fetching listing.",
    redirectReason: "Too many redirects while fetching listing.",
    inaccessibleReason: "Unable to access this listing.",
    oversizedReason: "Listing page exceeded size limit.",
  });

  if (!fetched.ok) {
    return { ok: false, reason: fetched.reason };
  }

  const html = await readResponseTextWithLimit(fetched.response, maxBytes);
  if (html === null) {
    return { ok: false, reason: "Listing page exceeded size limit." };
  }

  return {
    ok: true,
    page: {
      finalUrl: fetched.finalUrl,
      html,
      contentType: fetched.response.headers.get("content-type"),
    },
  };
}

export async function fetchBinaryResource(
  url: string,
  options?: { timeoutMs?: number; maxBytes?: number; maxRedirects?: number },
): Promise<{ ok: true; bytes: Buffer; mime: string } | { ok: false; reason: string }> {
  const timeoutMs = options?.timeoutMs ?? URL_FETCH_TIMEOUT_MS;
  const maxBytes = options?.maxBytes ?? URL_FETCH_BINARY_MAX_BYTES;
  const maxRedirects = options?.maxRedirects ?? URL_FETCH_MAX_REDIRECTS;

  const fetched = await fetchValidatedRemoteUrl(url, {
    timeoutMs,
    maxRedirects,
    maxBytes,
    headers: {
      Accept: "application/pdf,image/*,*/*;q=0.8",
      "User-Agent": USER_AGENT,
    },
    timeoutReason: "Timed out while fetching report.",
    redirectReason: "Too many redirects while fetching report.",
    inaccessibleReason: "Unable to download grading report.",
    oversizedReason: "Report file exceeded size limit.",
  });

  if (!fetched.ok) {
    return { ok: false, reason: fetched.reason };
  }

  const buffer = await readResponseBytesWithLimit(fetched.response, maxBytes);
  if (buffer === null) {
    return { ok: false, reason: "Report file exceeded size limit." };
  }

  const mime =
    fetched.response.headers.get("content-type")?.split(";")[0]?.trim() ??
    "application/octet-stream";

  return { ok: true, bytes: buffer, mime };
}
