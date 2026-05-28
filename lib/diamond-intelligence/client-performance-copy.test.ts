import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFaceUpPresenceCopy,
  buildOpticalInterpretationSummary,
  buildPerformanceReadCopy,
} from "./client-performance-copy";

describe("buildPerformanceReadCopy", () => {
  it("explains strong reads in plain English", () => {
    const copy = buildPerformanceReadCopy({
      overallScore: 91,
      overallLabel: "Strong",
      clientScore: {
        eligible: true,
        overall: 91,
        bandLabel: "Strong optical read",
        summaryLine: "",
        lightTraits: [],
      },
      interpretationLevel: "deep",
      needsExpertDiagramReview: false,
    });
    assert.match(copy.whatThisMeans, /strong overall light-performance/i);
    assert.match(copy.whatThisMeans, /balanced brightness/i);
    assert.doesNotMatch(copy.whatThisMeans, /parser|OCR|calibration|corpus/i);
  });

  it("uses calm language for mixed reads", () => {
    const copy = buildPerformanceReadCopy({
      overallScore: 78,
      overallLabel: "Mixed",
      clientScore: {
        eligible: true,
        overall: 78,
        bandLabel: "Mixed",
        summaryLine: "",
        lightTraits: [],
      },
      interpretationLevel: "proportion",
      needsExpertDiagramReview: false,
    });
    assert.match(copy.confidenceNote, /worth reviewing/i);
    assert.doesNotMatch(copy.whatThisMeans, /catastrophic|failed|reject/i);
  });
});

describe("buildFaceUpPresenceCopy", () => {
  it("does not fabricate percentile claims", () => {
    const copy = buildFaceUpPresenceCopy({
      measurements: "8.10 - 8.14 x 5.00 mm",
      carat: "2.00",
      avgDiameterMm: 8.12,
    });
    assert.doesNotMatch(copy.summary, /Top %|percentile|corpus/i);
    assert.match(copy.footnote, /measurements and carat/i);
  });
});

describe("buildOpticalInterpretationSummary", () => {
  it("reads like a calm expert summary", () => {
    const text = buildOpticalInterpretationSummary({
      capability: {
        interpretationLevel: "proportion",
        clientSummaryTitle: "Proportion-based interpretation",
        clientSummaryBody: "",
        missingForNextLevel: ["lowerHalfPercent"],
        guidedCompletionFields: [],
        suggestedNextStep: "justin_review",
        canRunClientInterpretation: true,
        needsGuidedCompletion: false,
        needsExpertDiagramReview: true,
        manualValuesAllowedForInterpretationOnly: true,
        confidentlyReadKeys: [],
        supportsLevel: "proportion",
      },
      clientScore: {
        eligible: true,
        overall: 89,
        bandLabel: "Strong",
        summaryLine: "",
        lightTraits: [
          { label: "Fire", level: "Strong", fillPercent: 90 },
          { label: "Contrast", level: "Balanced", fillPercent: 84 },
          { label: "Brightness", level: "Strong", fillPercent: 88 },
          { label: "Scintillation", level: "Needs review", fillPercent: 0 },
        ],
      },
      overallLabel: "Strong",
      needsExpertDiagramReview: true,
    });
    assert.match(text, /balanced overall presentation/i);
    assert.match(text, /expert review/i);
    assert.doesNotMatch(text, /parser|provenance|low confidence/i);
  });
});
