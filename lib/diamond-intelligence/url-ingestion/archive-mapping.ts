import type { ListingExtraction, UrlIngestionStatus } from "./types";
import type { DiamondIntelligenceArchiveContext } from "@/lib/diamond-intelligence/submission-archive";

export type UrlArchiveMetadata = {
  source_type: "upload" | "url";
  source_url: string | null;
  vendor: string | null;
  listing_id: string | null;
  listing_price: number | null;
  listing_currency: string | null;
  listing_extraction_json: ListingExtraction | null;
  report_url: string | null;
  url_ingestion_status: UrlIngestionStatus | null;
  url_ingestion_warnings: string[];
};

export function buildUrlArchiveMetadata(input: {
  sourceType: "upload" | "url";
  sourceUrl?: string | null;
  listing?: ListingExtraction | null;
  reportUrl?: string | null;
  urlIngestionStatus?: UrlIngestionStatus | null;
  warnings?: string[];
}): UrlArchiveMetadata {
  const listing = input.listing ?? null;
  return {
    source_type: input.sourceType,
    source_url: input.sourceUrl ?? listing?.url ?? null,
    vendor: listing?.vendor ?? null,
    listing_id: listing?.listingId ?? null,
    listing_price: listing?.price ?? null,
    listing_currency: listing?.currency ?? null,
    listing_extraction_json: listing,
    report_url: input.reportUrl ?? listing?.reportUrl ?? listing?.certificateUrl ?? null,
    url_ingestion_status: input.urlIngestionStatus ?? null,
    url_ingestion_warnings: [
      ...(listing?.extractionWarnings ?? []),
      ...(input.warnings ?? []),
    ],
  };
}

export function mergeUrlMetadataIntoArchiveContext(
  ctx: DiamondIntelligenceArchiveContext,
  urlMeta: UrlArchiveMetadata,
): DiamondIntelligenceArchiveContext {
  return {
    ...ctx,
    urlArchive: urlMeta,
  };
}
