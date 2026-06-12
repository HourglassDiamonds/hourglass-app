import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { extractFieldsFromReportText } from "@/lib/calibration-library/extract-from-text";
import { GCAL360196486_OCR_MULTILINE } from "@/lib/calibration-library/fixtures/gcal360196486";
import { GCAL_SARINE_LG353456516_OCR_TEXT } from "@/lib/calibration-library/fixtures/gcal-sarine-lg353456516";
import { toClientSafeInterpretationPayload } from "@/lib/diamond-intelligence/client-api";
import { classifyFinalized } from "@/lib/diamond-intelligence/client-interpretation-pipeline";
import { parseReportGradeHints } from "@/lib/diamond-intelligence/report-grade-hints";
import {
  buildDiamondIntelligenceArchiveRecord,
  resolveArchiveStatus,
} from "@/lib/diamond-intelligence/submission-archive";
import { interpretUploadedReport } from "@/lib/diamond-intelligence/interpret-uploaded-report";

function assertArchivePayloadComplete(
  record: ReturnType<typeof buildDiamondIntelligenceArchiveRecord>,
  expectedStatus: string,
) {
  assert.equal(record.status, expectedStatus);
  assert.ok(record.fileMime);
  assert.ok(record.fileSizeBytes != null && record.fileSizeBytes > 0);
  assert.ok(record.fileSha256 && record.fileSha256.length === 64);
  assert.ok(record.uploadMetadata);
  assert.ok("decisionTier" in (record.uploadMetadata as object));

  if (expectedStatus === "success" || expectedStatus === "partial") {
    assert.ok(record.parserFamily, "parserFamily");
    assert.ok(record.lab, "lab");
    assert.ok(record.rawFieldsJson, "rawFieldsJson");
    assert.ok(record.finalOutputJson, "finalOutputJson");
    assert.ok(record.purchaseRecommendation, "purchaseRecommendation");
  }

  if (expectedStatus === "unsupported_report" || expectedStatus === "unable_to_verify") {
    assert.ok(record.errorCode, "errorCode");
    assert.ok(record.failureReason, "failureReason");
    assert.equal(record.finalOutputJson, null);
  }
}

describe("submission archive record completeness", () => {
  it("success record includes parser, grades, interpretation, and file metadata", () => {
    const text = GCAL360196486_OCR_MULTILINE;
    const finalized = extractFieldsFromReportText(text, {
      lab: "GCAL",
      textMethod: "ocr",
      reportNumber: "LG360196486",
    });
    finalized.reportGradeHintText = text;
    const hints = parseReportGradeHints(text);
    const decision = classifyFinalized(finalized);
    const interpretation = toClientSafeInterpretationPayload(finalized);
    const bytes = Buffer.from("gcal-8x-fixture-bytes");
    const expectedStatus = resolveArchiveStatus({ httpStatus: 200, decision, finalized });

    const record = buildDiamondIntelligenceArchiveRecord({
      httpStatus: 200,
      bytes,
      mime: "image/jpeg",
      sourceFilename: "GCAL360196486.jpg",
      finalized,
      decision,
      interpretation,
    });

    assertArchivePayloadComplete(record, expectedStatus);
    assert.equal(record.parserFamily, "gcal-8x");
    assert.equal(record.lab, "GCAL");
    assert.equal(record.color, hints.color);
    assert.equal(record.clarity, hints.clarity);
    assert.equal(record.opticalTier, interpretation.decisionProfile.opticalPerformance.band);
    assert.ok(record.rawExtractedText);
    assert.equal(record.ocrUsed, true);
  });

  it("partial record preserves extracted fields and partial decision tier", () => {
    const text = GCAL_SARINE_LG353456516_OCR_TEXT;
    const finalized = extractFieldsFromReportText(text, {
      lab: "GCAL",
      textMethod: "ocr",
      reportNumber: "LG353456516",
    });
    finalized.reportGradeHintText = text;
    finalized.fields.crownAngle = "";
    finalized.fields.pavilionAngle = "";
    finalized.fields.depthPercent = "";
    const decision = classifyFinalized(finalized);
    const interpretation = toClientSafeInterpretationPayload(finalized, undefined, {
      partial: decision.tier === "partial",
    });

    const record = buildDiamondIntelligenceArchiveRecord({
      httpStatus: 200,
      bytes: Buffer.from("partial-fixture"),
      mime: "image/jpeg",
      sourceFilename: "partial.jpg",
      finalized,
      decision,
      interpretation,
    });

    assert.equal(resolveArchiveStatus({ httpStatus: 200, decision }), "partial");
    assertArchivePayloadComplete(record, "partial");
    assert.equal(record.uploadMetadata?.decisionTier, "partial");
    assert.ok(record.missingFields.length > 0);
  });

  it("failure record captures unsupported mime metadata", () => {
    const record = buildDiamondIntelligenceArchiveRecord({
      httpStatus: 400,
      mime: "text/plain",
      sourceFilename: "notes.txt",
      bytes: Buffer.from("not a report"),
      earlyFailure: {
        reason: "unsupported_mime",
        message: "Please upload a PDF or image of your lab report.",
      },
    });

    assertArchivePayloadComplete(record, "unsupported_report");
    assert.equal(record.parserFamily, null);
  });
});

const LIVE_JPG = "C:/Users/justi/OneDrive/Desktop/GCAL353456516.jpg";

if (existsSync(LIVE_JPG)) {
  describe("live submission archive validation", () => {
    it("LG353456516 interpret path produces archive-ready success payload", async () => {
      const bytes = readFileSync(LIVE_JPG);
      const result = await interpretUploadedReport({
        bytes,
        mime: "image/jpeg",
        sourceFilename: "GCAL353456516.jpg",
      });

      if (!result.ok) {
        assert.ok(result.decision, "decision on failure path");
        const failureRecord = buildDiamondIntelligenceArchiveRecord({
          httpStatus: result.httpStatus,
          bytes,
          mime: "image/jpeg",
          sourceFilename: "GCAL353456516.jpg",
          finalized: result.finalized,
          decision: result.decision,
          pipelineError: result.pipelineError,
          timedOut: result.timedOut,
        });
        assert.ok(failureRecord.status);
        assert.ok(failureRecord.errorCode || failureRecord.failureReason);
        return;
      }

      const record = buildDiamondIntelligenceArchiveRecord({
        httpStatus: 200,
        bytes,
        mime: "image/jpeg",
        sourceFilename: "GCAL353456516.jpg",
        finalized: result.finalized,
        decision: result.decision,
        interpretation: result.interpretation,
      });

      assert.ok(["success", "partial"].includes(record.status));
      assert.equal(record.parserFamily, "gcal-sarine-4cs");
      assert.equal(record.color, "D");
      assert.equal(record.clarity, "VS1");
      assert.ok(record.finalOutputJson);
      assert.ok(record.purchaseRecommendation);
      assert.ok(record.rawExtractedText);
    });
  });
}
