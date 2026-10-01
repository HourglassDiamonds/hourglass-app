import {
  buildIndexNowPayload,
  INDEXNOW_ENDPOINT,
  isValidIndexNowKey,
} from "./indexnow-core";

type IndexNowFetch = typeof fetch;

export type IndexNowSubmissionResult =
  | { status: "accepted"; httpStatus: 200 | 202; submitted: number }
  | { status: "skipped"; reason: "not_configured" | "no_urls" }
  | { status: "failed"; httpStatus?: number; reason: "network" | "rejected" };

/**
 * Server-side IndexNow notifier. Call only from an explicit publishing workflow
 * after materially adding, updating, or deleting canonical public URLs.
 */
export async function submitIndexNowUrls(
  urls: readonly string[],
  options: {
    key?: string;
    fetchImpl?: IndexNowFetch;
  } = {},
): Promise<IndexNowSubmissionResult> {
  const key = (options.key ?? process.env.INDEXNOW_KEY ?? "").trim();
  if (!key) {
    return { status: "skipped", reason: "not_configured" };
  }
  if (!isValidIndexNowKey(key)) {
    throw new Error("INDEXNOW_KEY must be 8-128 letters, numbers, or hyphens.");
  }

  const payload = buildIndexNowPayload(key, urls);
  if (payload.urlList.length === 0) {
    return { status: "skipped", reason: "no_urls" };
  }

  try {
    const response = await (options.fetchImpl ?? fetch)(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });

    if (response.status === 200 || response.status === 202) {
      return {
        status: "accepted",
        httpStatus: response.status,
        submitted: payload.urlList.length,
      };
    }

    return {
      status: "failed",
      httpStatus: response.status,
      reason: "rejected",
    };
  } catch {
    return { status: "failed", reason: "network" };
  }
}
