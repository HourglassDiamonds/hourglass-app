import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDiamondDecisionProfile } from "./diamond-decision-profile";
import {
  presentLowConfidenceGraphLabel,
  presentOpticalPerformanceDisplay,
} from "./interpretation-display";
import type { CalibrationReportFields, ReportFieldKey } from "@/lib/calibration-library/types";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";
import { buildDiamondInterpretationContext } from "./client-interpretation-context";
import { presentClientInterpretationScore } from "./client-score-present";
import type { ClientSafeReportCapability } from "./client-api";

function fields(
  overrides: Partial<Record<ReportFieldKey, string>>,
): CalibrationReportFields {
  const base = Object.fromEntries(
    REPORT_FIELD_KEYS.map((k) => [k, ""]),
  ) as CalibrationReportFields;
  return { ...base, ...overrides };
}

function capability(): ClientSafeReportCapability {
  return {
    interpretationLevel: "deep",
    clientSummaryTitle: "Test",
    clientSummaryBody: "Test",
    missingForNextLevel: [],
    guidedCompletionFields: [],
    suggestedNextStep: "view_interpretation",
    canRunClientInterpretation: true,
    needsGuidedCompletion: false,
    needsExpertDiagramReview: false,
    manualValuesAllowedForInterpretationOnly: true,
    confidentlyReadKeys: [],
    supportsLevel: "deep",
  };
}

describe("interpretation display (presentation only)", () => {
  it("suppresses optical score when confidence is Low", () => {
    const f = fields({
      shape: "Round",
      carat: "1.00",
      tablePercent: "57",
      depthPercent: "61.5",
    });
    const clientScore = presentClientInterpretationScore(f, "deep");
    const raw =
      clientScore.eligible && clientScore.overall !== null
        ? clientScore.overall
        : 99;
    const context = {
      ...buildDiamondInterpretationContext({ fields: f, rawScore: raw }),
      extractionState: "PARTIAL_EXTRACTION" as const,
      readState: "partial" as const,
      scoreEligible: false,
      canShowScore: false,
    };
    const profile = buildDiamondDecisionProfile({
      fields: f,
      metadata: { lab: "IGI", reportNumber: "TEST", stoneType: "natural" },
      capability: capability(),
      context,
      clientScore,
      displayScore: context.displayScore,
    });

    assert.equal(profile.confidence.band, "Low");
    assert.equal(profile.opticalPerformance.score, null);

    const display = presentOpticalPerformanceDisplay(profile);
    assert.equal(display.band, "Preliminary Assessment");
    assert.equal(display.score, null);
    assert.equal(
      presentLowConfidenceGraphLabel(profile),
      "Preliminary Assessment",
    );
  });

  it("shows score and band when confidence is High", () => {
    const f = fields({
      shape: "Round Brilliant",
      carat: "1.50",
      measurements: "7.40 - 7.42 x 4.58",
      tablePercent: "57",
      depthPercent: "61.5",
      crownAngle: "34.5",
      pavilionAngle: "40.8",
      polish: "Excellent",
      symmetry: "Excellent",
      cutGrade: "Excellent",
    });
    const clientScore = presentClientInterpretationScore(f, "deep");
    const raw = clientScore.overall!;
    const context = buildDiamondInterpretationContext({ fields: f, rawScore: raw });
    const profile = buildDiamondDecisionProfile({
      fields: f,
      metadata: { lab: "GCAL", reportNumber: "TEST", stoneType: "lab-grown" },
      capability: capability(),
      context,
      clientScore,
      displayScore: context.displayScore,
      gradeHints: { clarity: "VS1" },
    });

    assert.equal(profile.confidence.band, "High");
    const display = presentOpticalPerformanceDisplay(profile);
    assert.match(display.band, /Strong|Solid/);
    assert.ok(display.score !== null && display.score > 0);
  });
});
