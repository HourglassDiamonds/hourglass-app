import { fetchListingPage } from "./fetch-listing-page";
import {
  extractListingId,
  classifyVendorSupport,
  normalizeDiamondListingUrl,
} from "./vendor-detection";
import { validateListingUrl } from "./url-safety";
import {
  normalizeListingExtraction,
  extractFromStructuredData,
} from "./structured-extractors";
import { extractWithVendorAdapter } from "./vendor-adapters";
import type { ListingExtraction } from "./types";

export type ExtractListingResult =
  | { ok: true; listing: ListingExtraction }
  | { ok: false; reason: string; stage: "validation" | "vendor" | "fetch" | "extract" };

export async function extractListingFromUrl(
  inputUrl: string,
): Promise<ExtractListingResult> {
  const safety = validateListingUrl(inputUrl);
  if (!safety.ok) {
    return { ok: false, reason: safety.reason, stage: "validation" };
  }

  const canonicalUrl = normalizeDiamondListingUrl(inputUrl);
  if (!canonicalUrl) {
    return {
      ok: false,
      reason: "Please enter a valid diamond listing URL.",
      stage: "validation",
    };
  }

  const support = classifyVendorSupport(canonicalUrl);
  if (!support.supported) {
    return {
      ok: false,
      reason:
        support.vendor === "unknown"
          ? "This retailer is not supported yet."
          : "This retailer is not supported in the current beta.",
      stage: "vendor",
    };
  }

  const fetched = await fetchListingPage(canonicalUrl);
  if (!fetched.ok) {
    return { ok: false, reason: fetched.reason, stage: "fetch" };
  }

  const listingId = extractListingId(fetched.page.finalUrl, support.vendor);
  const partial =
    support.tier === "tier1"
      ? extractWithVendorAdapter(
          support.vendor,
          fetched.page.html,
          fetched.page.finalUrl,
        )
      : extractFromStructuredData(fetched.page.html);

  const listing = normalizeListingExtraction({
    vendor: support.vendor,
    url: inputUrl.trim(),
    canonicalUrl: fetched.page.finalUrl,
    listingId,
    partial,
  });

  if (
    listing.extractionConfidence === "low" &&
    !listing.carat &&
    !listing.shape &&
    !listing.reportUrl
  ) {
    return {
      ok: false,
      reason: "We found the listing but could not read enough diamond details.",
      stage: "extract",
    };
  }

  return { ok: true, listing };
}
