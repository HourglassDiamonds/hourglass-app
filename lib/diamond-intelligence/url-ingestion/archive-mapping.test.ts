import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyReportFields } from "@/lib/calibration-library/fields";
import { buildDiamondIntelligenceArchiveRecord } from "@/lib/diamond-intelligence/submission-archive";
import { buildUrlArchiveMetadata } from "./archive-mapping";

describe("buildUrlArchiveMetadata", () => {
  it("maps listing extraction into archive metadata", () => {
    const meta = buildUrlArchiveMetadata({
      sourceType: "url",
      sourceUrl: "https://www.rarecarat.com/diamond/123",
      listing: {
        vendor: "rare-carat",
        url: "https://www.rarecarat.com/diamond/123",
        canonicalUrl: "https://www.rarecarat.com/diamond/123",
        listingId: "123",
        price: 4100,
        currency: "USD",
        shape: "Round",
        carat: 1.1,
        color: "H",
        clarity: "VS2",
        cut: "Excellent",
        polish: null,
        symmetry: null,
        fluorescence: null,
        lab: "GIA",
        reportNumber: "2141000000",
        reportUrl: null,
        certificateUrl: null,
        imageUrl: null,
        videoUrl: null,
        availability: null,
        extractedAt: "2026-06-11T00:00:00.000Z",
        extractionConfidence: "medium",
        extractionWarnings: ["no_report_on_page"],
      },
      urlIngestionStatus: "listing_found_no_report",
    });

    assert.equal(meta.source_type, "url");
    assert.equal(meta.vendor, "rare-carat");
    assert.equal(meta.listing_id, "123");
    assert.equal(meta.listing_price, 4100);
    assert.equal(meta.url_ingestion_status, "listing_found_no_report");
    assert.ok(meta.listing_extraction_json);
  });
});

describe("buildDiamondIntelligenceArchiveRecord url fields", () => {
  it("includes url ingestion metadata on archive records", () => {
    const urlArchive = buildUrlArchiveMetadata({
      sourceType: "url",
      sourceUrl: "https://www.ritani.com/diamonds/abc",
      urlIngestionStatus: "unsupported_vendor",
    });

    const record = buildDiamondIntelligenceArchiveRecord({
      httpStatus: 422,
      earlyFailure: {
        reason: "unsupported_vendor",
        message: "unsupported",
      },
      urlArchive,
    });

    assert.equal(record.sourceType, "url");
    assert.equal(record.sourceUrl, "https://www.ritani.com/diamonds/abc");
    assert.equal(record.urlIngestionStatus, "unsupported_vendor");
    assert.equal(record.uploadMetadata.source_type, "url");
  });

  it("keeps upload archive behavior with upload source type", () => {
    const fields = emptyReportFields({ carat: "1.00" });
    const record = buildDiamondIntelligenceArchiveRecord({
      httpStatus: 200,
      bytes: Buffer.from("pdf"),
      mime: "application/pdf",
      sourceFilename: "gia.pdf",
      finalized: { fields, metadata: { lab: "GIA", reportNumber: "1" } } as never,
      decision: {
        tier: "full",
        useful: true,
        sufficient: true,
        snapshot: {
          lab: "GIA",
          reportNumber: "1",
          shape: "",
          carat: "1.00",
          measurements: "",
          table: "",
          depth: "",
          crownAngle: "",
          pavilionAngle: "",
          polish: "",
          symmetry: "",
          fluorescence: "",
          missingFields: [],
        },
      },
    });

    assert.equal(record.sourceType, "upload");
    assert.equal(record.uploadMetadata.source_type, "upload");
  });
});
