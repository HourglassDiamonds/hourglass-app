import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { GCAL353466126_OCR_MULTILINE } from "@/lib/calibration-library/fixtures/gcal353466126";
import { GCAL360796191_TEXT_LAYER } from "@/lib/calibration-library/fixtures/gcal360796191";
import { GCAL_SARINE_LG340946327_OCR_TEXT } from "@/lib/calibration-library/fixtures/gcal-sarine-lg340946327";
import { interpretUploadedReport } from "@/lib/diamond-intelligence/interpret-uploaded-report";
import { assessClientReportFormatSupport } from "@/lib/diamond-intelligence/unsupported-report-format";
import {
  probeClientUnsupportedReportFormat,
  resolvePdfUnsupportedFormatProbeFromText,
} from "@/lib/diamond-intelligence/unsupported-format-probe";

const STANDARD_GCAL_PDF = "data/diamond-intelligence/debug/standard-gcal-LG352146193-probe.pdf";

const GCAL_8X_LIVE_CERT_PROBE_OCR = `diamonds achieve EXCELLENT grades in all EIGHT Ultimate Diamond Cut Grade 7
aspects of CUT quality assessment.
GCAL LG353306143 RB 3.24 EVVS2 go EFEE
Scan QR code to view photos and videos of this ty
lab grown diamond, and the 8C grading scale, 4» hr
TAT, Optical Brilliance or go to https://www.gcalusa.com/c/353306143 [a] SmskE:`;

const GCAL_SARINE_LIVE_CERT_PROBE_OCR = `diamonds achieve EXCELLENT grades in all EIGHT Ultimate Diamond Cut Grade /
aspects of CUT quality assessment.
GCAL LG360796192 RB 1.01 D VS1 §C LIE 40]
go to https://www.gcalusa.com/c/360796192`;

const GCAL_8X_PDF_CANDIDATES = [
  "data/light-performance-calibration/anchor-pdfs/GCAL-LG353466126.pdf",
  "data/light-performance-calibration/validation-reports/GCAL-LG353466126.pdf",
  "C:/Users/justi/OneDrive/Desktop/LG353466126.pdf",
];

const GCAL_SARINE_PDF = "data/light-performance-calibration/validation-reports/GCAL-LG360796192.pdf";

const GCAL_8X_IMAGE_ONLY_CANDIDATES = [
  "data/light-performance-calibration/anchor-pdfs/GCAL-LG353306143.pdf",
  "data/light-performance-calibration/validation-reports/GCAL-LG353306143.pdf",
  "C:/Users/justi/OneDrive/Desktop/353306143.pdf",
];

function resolveFirstExisting(paths: string[]): string | null {
  for (const path of paths) {
    if (existsSync(path)) return path;
  }
  return null;
}

describe("unsupported-format-probe fast path", () => {
  it("classifies standard GCAL text layer as unsupported without OCR", async () => {
    assert.ok(existsSync(STANDARD_GCAL_PDF), `missing ${STANDARD_GCAL_PDF}`);
    const bytes = readFileSync(STANDARD_GCAL_PDF);
    const started = Date.now();
    const match = await probeClientUnsupportedReportFormat(
      bytes,
      "application/pdf",
    );
    const elapsedMs = Date.now() - started;

    assert.ok(match, "expected unsupported match");
    assert.equal(match.family, "gcal-standard");
    assert.ok(
      elapsedMs < 15_000,
      `probe should stay fast without full-page OCR (took ${elapsedMs}ms)`,
    );
  });

  it("returns unsupported_report_format quickly for standard GCAL LG352146193", async () => {
    assert.ok(existsSync(STANDARD_GCAL_PDF), `missing ${STANDARD_GCAL_PDF}`);
    const bytes = readFileSync(STANDARD_GCAL_PDF);
    const started = Date.now();
    const result = await interpretUploadedReport({
      bytes,
      mime: "application/pdf",
      sourceFilename: "LG352146193.pdf",
    });
    const elapsedMs = Date.now() - started;

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "unsupported_report_format");
      assert.equal(result.unsupportedFormat?.family, "gcal-standard");
    }
    assert.ok(
      elapsedMs < 15_000,
      `interpret should reject quickly (took ${elapsedMs}ms)`,
    );
  });

  it("flags GCAL Sarine fixture text as unsupported quickly", async () => {
    const support = assessClientReportFormatSupport(GCAL360796191_TEXT_LAYER);
    assert.equal(support.status, "unsupported");
    if (support.status === "unsupported") {
      assert.equal(support.match.family, "gcal-sarine-4cs");
    }

    const support340 = assessClientReportFormatSupport(
      GCAL_SARINE_LG340946327_OCR_TEXT,
    );
    assert.equal(support340.status, "unsupported");
  });

  it("defers GCAL 8X fixture text to the supported pipeline", () => {
    const support = assessClientReportFormatSupport(GCAL353466126_OCR_MULTILINE);
    assert.equal(support.status, "supported");
  });

  it("defers bare GCAL 8X certificate probe text", () => {
    assert.equal(assessClientReportFormatSupport("GCAL LG353306143").status, "unknown");
  });

  it("defers image-only GCAL 8X when text layer is insufficient and live cert band has 8X evidence", () => {
    const certProbeOcr = GCAL_8X_LIVE_CERT_PROBE_OCR;

    const match = resolvePdfUnsupportedFormatProbeFromText({
      layerText: "",
      layerSufficient: false,
      certProbe: { detected: true, probeText: certProbeOcr },
    });
    assert.equal(match, null);
  });

  it("rejects sufficient Sarine text layer even when cert band shares Ultimate Diamond marketing", () => {
    const match = resolvePdfUnsupportedFormatProbeFromText({
      layerText: GCAL360796191_TEXT_LAYER,
      layerSufficient: true,
      certProbe: {
        detected: true,
        probeText: GCAL_SARINE_LIVE_CERT_PROBE_OCR,
      },
    });
    assert.ok(match);
    assert.equal(match.family, "gcal-sarine-4cs");
  });

  it("still rejects Sarine PDF text layer when cert band lacks 8X evidence", () => {
    const match = resolvePdfUnsupportedFormatProbeFromText({
      layerText: GCAL360796191_TEXT_LAYER,
      layerSufficient: true,
      certProbe: { detected: false, probeText: "GCAL LG360796191" },
    });
    assert.ok(match);
    assert.equal(match.family, "gcal-sarine-4cs");
  });
});

const gcal8xPdf = resolveFirstExisting(GCAL_8X_PDF_CANDIDATES);
if (gcal8xPdf) {
  describe("unsupported-format-probe GCAL 8X text-layer PDF", () => {
    const bytes = readFileSync(gcal8xPdf);

    it("does not block GCAL 8X before the supported pipeline", async () => {
      const match = await probeClientUnsupportedReportFormat(
        bytes,
        "application/pdf",
      );
      assert.equal(match, null);
    });

    it("interpret still reaches a supported GCAL 8X outcome", async () => {
      const result = await interpretUploadedReport({
        bytes,
        mime: "application/pdf",
        sourceFilename: "LG353466126.pdf",
      });
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.interpretation.metadata.parserFamily, "gcal-8x");
      }
    });
  });
} else {
  describe("unsupported-format-probe GCAL 8X text-layer PDF", () => {
    it("skipped — GCAL 8X text-layer PDF not found", () => {
      assert.ok(true);
    });
  });
}

if (existsSync(GCAL_SARINE_PDF)) {
  describe("unsupported-format-probe GCAL Sarine PDF LG360796192", () => {
    const bytes = readFileSync(GCAL_SARINE_PDF);

    it("rejects GCAL BY SARINE from text layer without full-page OCR", async () => {
      const started = Date.now();
      const match = await probeClientUnsupportedReportFormat(
        bytes,
        "application/pdf",
      );
      const elapsedMs = Date.now() - started;
      assert.ok(match);
      assert.equal(match.family, "gcal-sarine-4cs");
      assert.ok(elapsedMs < 15_000);
    });
  });
}

const gcal8xImageOnlyPdf = resolveFirstExisting(GCAL_8X_IMAGE_ONLY_CANDIDATES);
if (gcal8xImageOnlyPdf) {
  describe("unsupported-format-probe GCAL 8X image-only LG353306143", () => {
    const bytes = readFileSync(gcal8xImageOnlyPdf);

    it("defers image-only GCAL 8X to the existing HEADER_TINY path", async () => {
      const match = await probeClientUnsupportedReportFormat(
        bytes,
        "application/pdf",
      );
      assert.equal(match, null);
    });

    it("interpret reaches supported GCAL 8X for LG353306143", async () => {
      const result = await interpretUploadedReport({
        bytes,
        mime: "application/pdf",
        sourceFilename: "LG353306143.pdf",
      });
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.interpretation.metadata.parserFamily, "gcal-8x");
      }
    });
  });
} else {
  describe("unsupported-format-probe GCAL 8X image-only LG353306143", () => {
    it("skipped — LG353306143 anchor PDF not found", () => {
      assert.ok(true);
    });
  });
}
