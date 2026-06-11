import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyReportFields } from "@/lib/calibration-library/fields";
import {
  buildDiamondIntelligenceArchiveRecord,
  resolveArchiveStatus,
} from "./submission-archive";

describe("resolveArchiveStatus", () => {
  it("maps unsupported mime to unsupported_report", () => {
    const status = resolveArchiveStatus({
      httpStatus: 400,
      earlyFailure: {
        reason: "unsupported_mime",
        message: "bad mime",
      },
    });
    assert.equal(status, "unsupported_report");
  });

  it("maps full tier to success", () => {
    const status = resolveArchiveStatus({
      httpStatus: 200,
      decision: {
        tier: "full",
        useful: true,
        sufficient: true,
        snapshot: {
          lab: "GIA",
          reportNumber: "123",
          shape: "Round Brilliant",
          carat: "1.00",
          measurements: "6.40",
          table: "57",
          depth: "61",
          crownAngle: "34.5",
          pavilionAngle: "40.8",
          polish: "Excellent",
          symmetry: "Excellent",
          fluorescence: "None",
          missingFields: [],
        },
      },
    });
    assert.equal(status, "success");
  });

  it("maps partial tier to partial", () => {
    const status = resolveArchiveStatus({
      httpStatus: 200,
      decision: {
        tier: "partial",
        useful: true,
        sufficient: false,
        snapshot: {
          lab: "GIA",
          reportNumber: "123",
          shape: "Round Brilliant",
          carat: "1.00",
          measurements: "",
          table: "",
          depth: "",
          crownAngle: "",
          pavilionAngle: "",
          polish: "",
          symmetry: "",
          fluorescence: "",
          missingFields: ["measurements"],
        },
      },
    });
    assert.equal(status, "partial");
  });

  it("maps failure tier to unable_to_verify", () => {
    const status = resolveArchiveStatus({
      httpStatus: 422,
      decision: {
        tier: "failure",
        useful: false,
        sufficient: false,
        snapshot: {
          lab: "",
          reportNumber: "",
          shape: "",
          carat: "",
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
    assert.equal(status, "unable_to_verify");
  });

  it("maps route timeout without extraction to timeout", () => {
    const status = resolveArchiveStatus({
      httpStatus: 504,
      timedOut: true,
      pipelineError: "diamond-intelligence-interpret timed out",
    });
    assert.equal(status, "timeout");
  });
});

describe("buildDiamondIntelligenceArchiveRecord", () => {
  it("builds a success record with extracted fields and final output", () => {
    const fields = emptyReportFields({
      shape: "Round Brilliant",
      carat: "1.02",
      tablePercent: "57",
      depthPercent: "61.2",
      polish: "Excellent",
      symmetry: "Excellent",
      fluorescence: "None",
      cutGrade: "Excellent",
    });

    const record = buildDiamondIntelligenceArchiveRecord({
      httpStatus: 200,
      bytes: Buffer.from("pdf-bytes"),
      mime: "application/pdf",
      sourceFilename: "gia-report.pdf",
      finalized: {
        fields,
        metadata: {
          lab: "GIA",
          reportNumber: "2141234567",
          reportSource: "pdf-upload",
          stoneType: "natural",
        },
        parserType: "gia-modern",
        parserPathUsed: "gia-modern",
        textMethod: "pdf-text",
        ocrAttempted: false,
        warnings: [],
        missingFields: [],
        confidence: {} as never,
      } as never,
      decision: {
        tier: "full",
        useful: true,
        sufficient: true,
        snapshot: {
          lab: "GIA",
          reportNumber: "2141234567",
          shape: "Round Brilliant",
          carat: "1.02",
          measurements: "",
          table: "57",
          depth: "61.2",
          crownAngle: "",
          pavilionAngle: "",
          polish: "Excellent",
          symmetry: "Excellent",
          fluorescence: "None",
          missingFields: [],
        },
      },
      interpretation: {
        metadata: {
          lab: "GIA",
          reportNumber: "2141234567",
          stoneType: "natural",
          parserFamily: "gia-modern",
        },
        extractedFields: fields,
        interpretationFields: fields,
        capability: {
          interpretationLevel: "proportion",
          canRunClientInterpretation: true,
          canShowOpticalProfile: true,
          canShowPerformanceScore: true,
          canShowDeepOptical: false,
        },
        decisionProfile: {
          opticalPerformance: {
            label: "Optical performance",
            band: "Solid",
            explanation: "test",
          },
          overallRecommendation: {
            label: "Overall",
            band: "Strong Candidate",
            explanation: "test",
          },
        } as never,
        gradeHints: { clarity: "VS1", color: "G" },
      },
    });

    assert.equal(record.status, "success");
    assert.equal(record.httpStatus, 200);
    assert.equal(record.lab, "GIA");
    assert.equal(record.reportNumber, "2141234567");
    assert.equal(record.parserFamily, "gia-modern");
    assert.equal(record.cut, "Excellent");
    assert.equal(record.clarity, "VS1");
    assert.equal(record.color, "G");
    assert.equal(record.fileSha256?.length, 64);
    assert.ok(record.finalOutputJson);
  });

  it("builds a failure record for unsupported uploads", () => {
    const record = buildDiamondIntelligenceArchiveRecord({
      httpStatus: 400,
      earlyFailure: {
        reason: "upload_validation",
        message: "File is too large.",
      },
      mime: "application/pdf",
      sourceFilename: "huge.pdf",
    });

    assert.equal(record.status, "unsupported_report");
    assert.equal(record.errorCode, "upload_validation");
    assert.equal(record.failureReason, "File is too large.");
    assert.equal(record.finalOutputJson, null);
  });
});
