import { isAcceptedReportMime } from "@/lib/calibration-library/document-extract";
import type { ClientSafeInterpretationPayload } from "@/lib/diamond-intelligence/client-api";
import {
  interpretUploadedReport,
  type InterpretUploadedReportSuccess,
} from "@/lib/diamond-intelligence/interpret-uploaded-report";
import { fetchBinaryResource } from "./fetch-listing-page";
import { extractListingFromUrl } from "./extract-listing";
import { validateListingUrl, isPdfOrReportUrl } from "./url-safety";
import { classifyVendorSupport } from "./vendor-detection";
import { applyListingGradeHintFallback } from "./listing-grade-hint-fallback";
import { resolveRareCaratReportFetchUrl } from "./rare-carat-embedded-pdf";
import type { ListingExtraction, UrlIngestionStatus } from "./types";

export type UrlIngestionResponse =
  | {
      ok: true;
      status: "full_interpretation" | "report_incomplete";
      interpretation: ClientSafeInterpretationPayload;
      partial: boolean;
      listing: ListingExtraction;
      reportUrl: string | null;
      reportBytes?: Buffer;
      reportMime?: string;
      reportFilename?: string;
      cacheHit?: boolean;
      finalized?: InterpretUploadedReportSuccess["finalized"];
      decision?: InterpretUploadedReportSuccess["decision"];
    }
  | {
      ok: true;
      status: "listing_found_no_report";
      listing: ListingExtraction;
      message: string;
    }
  | {
      ok: false;
      status: "invalid_url" | "unsupported_vendor" | "listing_inaccessible";
      error: string;
      listing?: ListingExtraction;
    };

export function resolveUrlIngestionStatus(
  result: UrlIngestionResponse,
): UrlIngestionStatus {
  return result.status;
}

export function logUrlIngestion(result: UrlIngestionResponse): void {
  const vendor =
    result.ok && "listing" in result
      ? result.listing.vendor
      : classifyVendorSupport("").vendor;

  const entry = {
    vendor: result.ok ? result.listing?.vendor ?? vendor : vendor,
    status: result.status,
    extractionConfidence:
      result.ok && "listing" in result
        ? result.listing.extractionConfidence
        : null,
    failureReason: result.ok ? null : result.error,
  };

  console.info("[di-url-ingestion]", JSON.stringify(entry));
}

export async function ingestDiamondListingUrl(
  inputUrl: string,
): Promise<UrlIngestionResponse> {
  const safety = validateListingUrl(inputUrl);
  if (!safety.ok) {
    return { ok: false, status: "invalid_url", error: safety.reason };
  }

  const support = classifyVendorSupport(safety.url.toString());
  if (!support.supported) {
    return {
      ok: false,
      status: "unsupported_vendor",
      error:
        support.vendor === "unknown"
          ? "This retailer is not supported yet. Paste a link from James Allen, Blue Nile, Rare Carat, Brilliant Earth, Ritani, or Adiamor."
          : "This retailer is not supported in the current beta.",
    };
  }

  const extracted = await extractListingFromUrl(inputUrl);
  if (!extracted.ok) {
    const status =
      extracted.stage === "vendor"
        ? "unsupported_vendor"
        : extracted.stage === "validation"
          ? "invalid_url"
          : "listing_inaccessible";
    return { ok: false, status, error: extracted.reason };
  }

  const listing = extracted.listing;
  const reportUrl = listing.reportUrl ?? listing.certificateUrl;

  if (!reportUrl) {
    return {
      ok: true,
      status: "listing_found_no_report",
      listing,
      message:
        "We found listing details, but no grading report was available on the page. Upload the GIA, IGI, or GCAL report for a complete Diamond Intelligence review.",
    };
  }

  const safeReportUrl = resolveAbsoluteUrl(reportUrl, listing.canonicalUrl);
  if (!safeReportUrl || !isPdfOrReportUrl(safeReportUrl)) {
    return {
      ok: true,
      status: "listing_found_no_report",
      listing,
      message:
        "We found listing details, but could not access a grading report from this page. Upload the report for a complete review.",
    };
  }

  const reportSafety = validateListingUrl(safeReportUrl);
  if (!reportSafety.ok) {
    return {
      ok: true,
      status: "listing_found_no_report",
      listing,
      message:
        "We found listing details, but the grading report link could not be accessed safely. Upload the report for a complete review.",
    };
  }

  const { fetchUrl: reportFetchUrl, unwrapped: unwrapAttempted } =
    resolveRareCaratReportFetchUrl(listing.vendor, safeReportUrl);

  let downloaded = await fetchBinaryResource(reportFetchUrl);
  let effectiveReportUrl = safeReportUrl;
  if (unwrapAttempted && downloaded.ok) {
    effectiveReportUrl = reportFetchUrl;
  } else if (unwrapAttempted && !downloaded.ok) {
    downloaded = await fetchBinaryResource(safeReportUrl);
  }

  if (!downloaded.ok) {
    return {
      ok: true,
      status: "listing_found_no_report",
      listing: {
        ...listing,
        extractionWarnings: [
          ...listing.extractionWarnings,
          downloaded.reason,
        ],
      },
      message:
        "We found listing details, but could not download the grading report from the retailer. Upload the report for a complete review.",
    };
  }

  let mime = downloaded.mime;
  if (!isAcceptedReportMime(mime)) {
    if (effectiveReportUrl.toLowerCase().includes(".pdf")) {
      mime = "application/pdf";
    } else if (!isAcceptedReportMime(mime)) {
      return {
        ok: true,
        status: "listing_found_no_report",
        listing,
        message:
          "We found a report link, but it was not a supported PDF or image format. Upload the report for a complete review.",
      };
    }
  }

  const interpreted = await interpretUploadedReport({
    bytes: downloaded.bytes,
    mime,
    sourceFilename: deriveReportFilename(listing, effectiveReportUrl),
  });

  if (!interpreted.ok) {
    return {
      ok: true,
      status: "listing_found_no_report",
      listing: {
        ...listing,
        extractionWarnings: [
          ...listing.extractionWarnings,
          interpreted.error,
        ],
      },
      message:
        "We found listing details and a report link, but could not build a complete interpretation from the downloaded report. Upload the report for a complete review.",
    };
  }

  const reportFilename = deriveReportFilename(listing, effectiveReportUrl);
  const interpretation = applyListingGradeHintFallback(
    interpreted.interpretation,
    listing,
  );

  return {
    ok: true,
    status: interpreted.partial ? "report_incomplete" : "full_interpretation",
    interpretation,
    partial: interpreted.partial,
    listing,
    reportUrl: effectiveReportUrl,
    reportBytes: downloaded.bytes,
    reportMime: mime,
    reportFilename,
    cacheHit: interpreted.cacheHit,
    finalized: interpreted.cacheHit ? undefined : interpreted.finalized,
    decision: interpreted.decision,
  };
}

function resolveAbsoluteUrl(url: string, base: string): string | null {
  try {
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}

function deriveReportFilename(
  listing: ListingExtraction,
  reportUrl: string,
): string {
  const fromUrl = reportUrl.split("/").pop();
  if (fromUrl?.includes(".")) return fromUrl;
  const lab = listing.lab?.toLowerCase() ?? "report";
  const number = listing.reportNumber ?? listing.listingId ?? "listing";
  return `${lab}-${number}.pdf`;
}
