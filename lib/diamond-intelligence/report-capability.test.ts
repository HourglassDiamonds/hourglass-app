import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyReportFields } from "@/lib/calibration-library/fields";
import { assessReportCapability } from "./report-capability";

describe("assessReportCapability", () => {
  it("classifies deep when proportion diagram fields are complete", () => {
    const cap = assessReportCapability({
      fields: emptyReportFields({
        shape: "Round Brilliant",
        carat: "1.90",
        measurements: "8.01 - 8.05 x 4.84 mm",
        polish: "Excellent",
        symmetry: "Excellent",
        fluorescence: "None",
        tablePercent: "59",
        depthPercent: "60.2",
        crownAngle: "34.1",
        pavilionAngle: "40.8",
        girdle: "Medium",
        culet: "Pointed",
        lowerHalfPercent: "77",
        starLengthPercent: "48",
      }),
      internalCalibrationEligible: true,
    });
    assert.equal(cap.interpretationLevel, "deep");
    assert.equal(cap.supportsLevel, "deep");
    assert.equal(cap.needsGuidedCompletion, false);
    assert.equal(cap.internalCalibrationEligible, true);
  });

  it("suggests guided completion for missing proportion fields", () => {
    const cap = assessReportCapability({
      fields: emptyReportFields({
        shape: "Round Brilliant",
        carat: "1.90",
        measurements: "8 mm",
        polish: "Excellent",
        symmetry: "Excellent",
        fluorescence: "None",
        tablePercent: "59",
      }),
    });
    assert.equal(cap.interpretationLevel, "basic");
    assert.ok(cap.guidedCompletionFields.includes("depthPercent"));
    assert.equal(cap.suggestedNextStep, "guided_completion");
    assert.match(cap.clientSummaryBody, /strengthen this read/i);
    assert.doesNotMatch(cap.clientSummaryBody, /OCR|parser|calibration/i);
    assert.doesNotMatch(cap.clientSummaryBody, /lower-half|star length/i);
  });

  it("does not offer lower-half or star length in client guided completion", () => {
    const cap = assessReportCapability({
      fields: emptyReportFields({
        shape: "Round Brilliant",
        carat: "1.90",
        measurements: "8.01 - 8.05 x 4.84 mm",
        polish: "Excellent",
        symmetry: "Excellent",
        fluorescence: "None",
        tablePercent: "59",
        depthPercent: "60.2",
        crownAngle: "34.1",
        pavilionAngle: "40.8",
        girdle: "Medium",
        culet: "Pointed",
      }),
    });
    assert.equal(cap.interpretationLevel, "proportion");
    assert.equal(cap.needsGuidedCompletion, false);
    assert.equal(cap.needsExpertDiagramReview, true);
    assert.ok(!cap.guidedCompletionFields.includes("lowerHalfPercent"));
    assert.ok(!cap.guidedCompletionFields.includes("starLengthPercent"));
    assert.match(
      cap.clientSummaryBody,
      /proportion-based interpretation.*best verified by an expert/i,
    );
    assert.doesNotMatch(cap.clientSummaryBody, /enter lower-half|star length/i);
  });

  it("does not expose internal calibration language in client copy", () => {
    const cap = assessReportCapability({
      fields: emptyReportFields({ shape: "Round" }),
      internalCalibrationEligible: false,
    });
    const blob = `${cap.clientSummaryTitle} ${cap.clientSummaryBody}`;
    assert.doesNotMatch(blob, /quarantine|provenance|ineligible|parser/i);
  });
});
