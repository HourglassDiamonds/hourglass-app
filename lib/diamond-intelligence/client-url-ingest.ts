import type { ClientSafeInterpretationPayload } from "./client-api";
import { CLIENT_RATE_LIMIT_ERROR, CLIENT_UPLOAD_INTERPRET_ERROR } from "./client-interpret-messages";
import type { ListingExtraction } from "./url-ingestion/types";

const CLIENT_FETCH_TIMEOUT_MS = 45_000;

export type UrlIngestApiStatus =
  | "invalid_url"
  | "unsupported_vendor"
  | "listing_inaccessible"
  | "listing_found_no_report"
  | "report_incomplete"
  | "full_interpretation";

export type UrlIngestApiPayload = {
  ok?: boolean;
  status?: UrlIngestApiStatus;
  error?: string;
  message?: string;
  listing?: ListingExtraction;
  interpretation?: ClientSafeInterpretationPayload;
  partial?: boolean;
  reportUrl?: string | null;
};

export type UrlIngestSuccessWithInterpretation = {
  kind: "interpretation";
  interpretation: ClientSafeInterpretationPayload;
  partial: boolean;
  listing: ListingExtraction;
};

export type UrlIngestPartialListing = {
  kind: "partial_listing";
  listing: ListingExtraction;
  message: string;
};

export type UrlIngestClientResult =
  | UrlIngestSuccessWithInterpretation
  | UrlIngestPartialListing;

export class UrlIngestClientError extends Error {
  status: UrlIngestApiStatus;

  constructor(message: string, status: UrlIngestApiStatus) {
    super(message);
    this.name = "UrlIngestClientError";
    this.status = status;
  }
}

export async function postUrlForIngestion(
  url: string,
): Promise<UrlIngestClientResult> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    CLIENT_FETCH_TIMEOUT_MS,
  );

  let res: Response;
  try {
    res = await fetch("/api/diamond-intelligence/ingest-url", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });
  } catch {
    throw new UrlIngestClientError(
      "We couldn't reach that listing. Check the URL and try again.",
      "listing_inaccessible",
    );
  } finally {
    window.clearTimeout(timeoutId);
  }

  const text = await res.text();
  let data: UrlIngestApiPayload;
  try {
    data = JSON.parse(text) as UrlIngestApiPayload;
  } catch {
    throw new UrlIngestClientError(CLIENT_UPLOAD_INTERPRET_ERROR, "listing_inaccessible");
  }

  if (res.status === 429) {
    throw new UrlIngestClientError(
      data.error ?? CLIENT_RATE_LIMIT_ERROR,
      "listing_inaccessible",
    );
  }

  if (!res.ok || !data.ok) {
    throw new UrlIngestClientError(
      data.error ?? CLIENT_UPLOAD_INTERPRET_ERROR,
      data.status ?? "listing_inaccessible",
    );
  }

  if (data.status === "listing_found_no_report" && data.listing) {
    return {
      kind: "partial_listing",
      listing: data.listing,
      message:
        data.message ??
        "We found listing details, but no grading report was available on the page.",
    };
  }

  if (data.interpretation && data.listing) {
    return {
      kind: "interpretation",
      interpretation: data.interpretation,
      partial: Boolean(data.partial),
      listing: data.listing,
    };
  }

  throw new UrlIngestClientError(CLIENT_UPLOAD_INTERPRET_ERROR, "listing_inaccessible");
}
