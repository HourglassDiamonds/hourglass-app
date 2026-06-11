import type { FetchedListingPage } from "./types";

export const URL_FETCH_TIMEOUT_MS = 12_000;
export const URL_FETCH_MAX_REDIRECTS = 3;
export const URL_FETCH_MAX_BYTES = 2 * 1024 * 1024;

const USER_AGENT =
  "HourglassDiamondIntelligence/1.0 (+https://hourglass.com/diamond-intelligence)";

export type FetchListingResult =
  | { ok: true; page: FetchedListingPage }
  | { ok: false; reason: string };

async function readBodyWithLimit(
  response: Response,
  maxBytes: number,
): Promise<string | null> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (text.length > maxBytes) return null;
    return text;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

export async function fetchListingPage(
  url: string,
  options?: { timeoutMs?: number; maxRedirects?: number; maxBytes?: number },
): Promise<FetchListingResult> {
  const timeoutMs = options?.timeoutMs ?? URL_FETCH_TIMEOUT_MS;
  const maxRedirects = options?.maxRedirects ?? URL_FETCH_MAX_REDIRECTS;
  const maxBytes = options?.maxBytes ?? URL_FETCH_MAX_BYTES;

  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "User-Agent": USER_AGENT,
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirectCount >= maxRedirects) {
          return { ok: false, reason: "Too many redirects while fetching listing." };
        }
        currentUrl = new URL(location, currentUrl).toString();
        redirectCount += 1;
        continue;
      }

      if (!response.ok) {
        return {
          ok: false,
          reason: `Listing returned HTTP ${response.status}.`,
        };
      }

      const contentType = response.headers.get("content-type");
      const html = await readBodyWithLimit(response, maxBytes);
      if (html === null) {
        return { ok: false, reason: "Listing page exceeded size limit." };
      }

      return {
        ok: true,
        page: {
          finalUrl: currentUrl,
          html,
          contentType,
        },
      };
    } catch (err) {
      const message =
        err instanceof Error && err.name === "AbortError"
          ? "Timed out while fetching listing."
          : "Unable to access this listing.";
      return { ok: false, reason: message };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { ok: false, reason: "Too many redirects while fetching listing." };
}

export async function fetchBinaryResource(
  url: string,
  options?: { timeoutMs?: number; maxBytes?: number },
): Promise<{ ok: true; bytes: Buffer; mime: string } | { ok: false; reason: string }> {
  const timeoutMs = options?.timeoutMs ?? URL_FETCH_TIMEOUT_MS;
  const maxBytes = options?.maxBytes ?? 20 * 1024 * 1024;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/pdf,image/*,*/*;q=0.8",
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok) {
      return { ok: false, reason: `Report fetch returned HTTP ${response.status}.` };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      return { ok: false, reason: "Report file exceeded size limit." };
    }

    const mime =
      response.headers.get("content-type")?.split(";")[0]?.trim() ??
      "application/octet-stream";

    return { ok: true, bytes: buffer, mime };
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Timed out while fetching report."
        : "Unable to download grading report.";
    return { ok: false, reason: message };
  } finally {
    clearTimeout(timeoutId);
  }
}
