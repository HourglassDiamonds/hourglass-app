import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { logGiaExtractionCheck } from "@/lib/calibration-library/gia-extraction-check";
import { logGcalSarineCheck } from "@/lib/calibration-library/parsers/gcal/gcal-sarine-4cs";
import { logGiaDiagramOcrCheck } from "@/lib/calibration-library/parsers/gia/gia-facsimile-image-ocr";
import { logGcalRoutingCheck } from "@/lib/calibration-library/parsers/gcal/gcal-routing-check";
import { logIgiExtractionCheck } from "@/lib/calibration-library/igi-proportions";
import {
  logDiamondIntelligenceInterpretObservability,
  logDiamondIntelligenceInterpretStage,
} from "@/lib/diamond-intelligence/interpret-observability";
import { PRIVACY_FORBIDDEN_SUBSTRINGS } from "@/lib/calibration-library/safe-diagnostic-log";
import type { UploadExtractionOutput } from "@/lib/calibration-library/extract-upload-pipeline";
import { emptyReportFields } from "@/lib/calibration-library/fields";

function captureLogs(run: () => void): string {
  const chunks: string[] = [];
  const log = (...args: unknown[]) => {
    chunks.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  };
  const original = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };
  console.log = log;
  console.info = log;
  console.warn = log;
  console.error = log;
  try {
    run();
  } finally {
    console.log = original.log;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
  }
  return chunks.join("\n");
}

function assertNoForbidden(blob: string) {
  for (const needle of PRIVACY_FORBIDDEN_SUBSTRINGS) {
    assert.equal(
      blob.includes(needle),
      false,
      `forbidden substring leaked: ${needle}`,
    );
  }
  assert.equal(blob.includes("sample OCR text for privacy"), false);
  assert.equal(blob.includes("PDF TEXT LAYER SAMPLE"), false);
  assert.equal(blob.includes("2548574094.pdf"), false);
  assert.equal(/tablePercent":\s*"56"/.test(blob), false);
}

describe("DI diagnostic logging privacy", () => {
  it("GIA extraction check omits report numbers and text previews", () => {
    const blob = captureLogs(() => {
      logGiaExtractionCheck({
        reportNumber: "2548574094",
        parserPathUsed: "gia-modern",
        headerTextPreview: "PDF TEXT LAYER SAMPLE for report 2548574094",
        proportionTextPreview: "sample OCR text for privacy table 56",
        assignedFields: { tablePercent: "56", depthPercent: "62.6" },
        missingFields: ["girdle"],
        warnings: ["warn"],
      });
    });
    assert.match(blob, /GIA EXTRACTION CHECK/);
    assert.match(blob, /tablePercent/);
    assert.match(blob, /girdle/);
    assertNoForbidden(blob);
  });

  it("GIA diagram OCR check omits OCR previews and report numbers", () => {
    const blob = captureLogs(() => {
      logGiaDiagramOcrCheck({
        reportNumber: "2517213965",
        triggered: true,
        reason: "missing-cores",
        cropCoordinates: [],
        ocrRawPreview: "sample OCR text for privacy 33.0°",
        repairedOcrPreview: "sample OCR text for privacy",
        candidatesFound: { crownAngle: "33.0" },
        assignmentsMade: { crownAngle: "33.0" },
        rejectedCandidates: [],
        durationMs: 12,
        timedOut: false,
      });
    });
    assert.match(blob, /GIA DIAGRAM OCR CHECK/);
    assert.match(blob, /crownAngle/);
    assertNoForbidden(blob);
  });

  it("GCAL Sarine check omits OCR text and report payloads", () => {
    const blob = captureLogs(() => {
      logGcalSarineCheck({
        parserType: "gcal-sarine-4cs",
        phase: "image-ocr",
        parserPathUsed: "gcal-8x",
        cropAttempted: true,
        cropGatePassed: true,
        ocrPathExecuted: true,
        ocrRuntimeAvailable: true,
        pageRendered: true,
        pageWidth: 1000,
        pageHeight: 800,
        cropSucceeded: true,
        ocrOk: true,
        ocrRawTextPreview: "sample OCR text for privacy LG360796247",
        repairedOcrTextPreview: "sample OCR text for privacy",
        finishOcrRawTextPreview: "Excellent",
        recoveredFields: {
          tablePercent: "57",
          depthPercent: "61.6",
        },
        assignedProportionFields: { tablePercent: "57" },
      });
    });
    assert.match(blob, /GCAL SARINE CHECK/);
    assert.match(blob, /tablePercent/);
    assertNoForbidden(blob);
  });

  it("GCAL routing and IGI extraction checks omit sensitive values", () => {
    const blob = captureLogs(() => {
      logGcalRoutingCheck({
        reportNumber: "LG360796247",
        detectedFormat: "gcal-8x",
        sarineColumnListSignature: true,
        sarineMarkers: false,
        gcal8xMarkers: true,
        parserPathUsed: "gcal-8x",
        fieldsRecoveredByPath: { carat: "1.04" },
      });
      logIgiExtractionCheck({
        reportNumber: "LG773657228",
        parserPathUsed: "igi",
        headerTextPreview: "PDF TEXT LAYER SAMPLE",
        proportionTextPreview: "sample OCR text for privacy",
        detectedCandidates: { tablePercent: "56" },
        assignedFields: { tablePercent: "56" },
        rejectedCandidates: [],
      });
    });
    assertNoForbidden(blob);
  });

  it("interpret observability keeps safe metadata only", () => {
    const fields = emptyReportFields();
    fields.tablePercent = "56";
    fields.depthPercent = "62.6";
    fields.crownAngle = "36.5";
    fields.pavilionAngle = "40.6";
    const finalized = {
      fields,
      metadata: {
        lab: "GIA",
        reportNumber: "2548574094",
        stoneType: "unknown",
      },
      parserType: "gia-modern",
      confidence: {},
      timings: { imageOcrMs: 100 },
      ocrAttempted: true,
      giaDiagramProportionWait: true,
    } as unknown as UploadExtractionOutput;

    const blob = captureLogs(() => {
      logDiamondIntelligenceInterpretStage({
        requestId: "req-privacy-test",
        event: { stage: "interpret-complete", status: "complete", elapsedMs: 10 },
        extras: {
          parserFamily: "gia-modern",
          ocrTransport: "remote",
          secretLeak: "OCR_WORKER_SECRET=should-not-log",
          reportNumber: "2548574094",
        },
      });
      logDiamondIntelligenceInterpretObservability({
        finalized,
        httpStatus: 200,
        requestId: "req-privacy-test",
      });
    });
    assert.match(blob, /ocrTransport/);
    assert.match(blob, /populatedFieldKeys/);
    assert.equal(blob.includes("OCR_WORKER_SECRET=should-not-log"), false);
    assert.equal(blob.includes("2548574094"), false);
    assertNoForbidden(blob);
  });
});
