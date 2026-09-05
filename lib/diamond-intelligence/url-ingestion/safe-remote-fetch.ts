import {
  resolveAndValidateRemoteUrl,
  validateRedirectTarget,
} from "./url-safety";

export const URL_FETCH_TIMEOUT_MS = 12_000;
export const URL_FETCH_MAX_REDIRECTS = 3;
export const URL_FETCH_MAX_BYTES = 2 * 1024 * 1024;
export const URL_FETCH_BINARY_MAX_BYTES = 20 * 1024 * 1024;

export type SafeRemoteFetchResult =
  | { ok: true; response: Response; finalUrl: string }
  | { ok: false; reason: string };

export type SafeRemoteFetchOptions = {
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
  timeoutReason: string;
  redirectReason: string;
  inaccessibleReason: string;
  oversizedReason: string;
  fetchImpl?: typeof fetch;
};

function contentLengthExceeds(response: Response, maxBytes: number): boolean {
  const raw = response.headers.get("content-length");
  if (!raw) return false;
  const length = Number(raw);
  return Number.isFinite(length) && length > maxBytes;
}

/**
 * Fetch a remote URL with https-only validation on every hop.
 * Uses redirect: "manual" and re-validates Location before following.
 * Does not pin resolved IPs (Node fetch cannot); see url-safety.ts.
 */
export async function fetchValidatedRemoteUrl(
  inputUrl: string,
  options: SafeRemoteFetchOptions,
): Promise<SafeRemoteFetchResult> {
  const timeoutMs = options.timeoutMs ?? URL_FETCH_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? URL_FETCH_MAX_REDIRECTS;
  const maxBytes = options.maxBytes ?? URL_FETCH_MAX_BYTES;
  const fetchImpl = options.fetchImpl ?? fetch;

  let currentUrl = inputUrl;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    const destination = await resolveAndValidateRemoteUrl(currentUrl);
    if (!destination.ok) {
      return { ok: false, reason: destination.reason };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(destination.url.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: options.headers,
      });

      if (response.status >= 300 && response.status < 400) {
        if (redirectCount >= maxRedirects) {
          return { ok: false, reason: options.redirectReason };
        }
        const location = response.headers.get("location");
        if (!location) {
          return { ok: false, reason: options.redirectReason };
        }
        const next = validateRedirectTarget(location, currentUrl);
        if (!next.ok) {
          return { ok: false, reason: next.reason };
        }
        currentUrl = next.url.toString();
        redirectCount += 1;
        continue;
      }

      if (!response.ok) {
        return { ok: false, reason: options.inaccessibleReason };
      }

      if (contentLengthExceeds(response, maxBytes)) {
        return { ok: false, reason: options.oversizedReason };
      }

      return { ok: true, response, finalUrl: currentUrl };
    } catch (err) {
      const reason =
        err instanceof Error && err.name === "AbortError"
          ? options.timeoutReason
          : options.inaccessibleReason;
      return { ok: false, reason };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { ok: false, reason: options.redirectReason };
}

export async function readResponseBytesWithLimit(
  response: Response,
  maxBytes: number,
): Promise<Buffer | null> {
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) return null;
    return buffer;
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

  return Buffer.concat(chunks, total);
}

export async function readResponseTextWithLimit(
  response: Response,
  maxBytes: number,
): Promise<string | null> {
  const bytes = await readResponseBytesWithLimit(response, maxBytes);
  if (bytes === null) return null;
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}
