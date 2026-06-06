import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  CalibrationReportFields,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";
import { buildDiamondInterpretationContext } from "./client-interpretation-context";
import { presentClientInterpretationScore } from "./client-score-present";
import type { ClientSafeReportCapability } from "./client-api";
import {
  buildDiamondDecisionProfile,
  classifyProportionArchetype,
} from "./diamond-decision-profile";

function fields(
  overrides: Partial<Record<ReportFieldKey, string>>,
): CalibrationReportFields {
  const base = Object.fromEntries(
    REPORT_FIELD_KEYS.map((k) => [k, ""]),
  ) as CalibrationReportFields;
  return { ...base, ...overrides };
}

const STRONG_FIELDS = fields({
  shape: "Round Brilliant",
  carat: "1.50",
  measurements: "7.40 - 7.42 x 4.58",
  tablePercent: "57.0",
  depthPercent: "61.5",
  crownAngle: "34.5",
  pavilionAngle: "40.8",
  polish: "Excellent",
  symmetry: "Excellent",
  cutGrade: "Excellent",
  fluorescence: "None",
});

const SPREAD_FIELDS = fields({
  ...Object.fromEntries(REPORT_FIELD_KEYS.map((k) => [k, STRONG_FIELDS[k]])),
  tablePercent: "62.0",
  depthPercent: "59.0",
  crownAngle: "32.0",
  pavilionAngle: "40.0",
});

function capability(
  level: ClientSafeReportCapability["interpretationLevel"] = "deep",
): ClientSafeReportCapability {
  return {
    interpretationLevel: level,
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
    supportsLevel: level,
  };
}

function profileFor(
  f: CalibrationReportFields,
  rawScore: number | null,
  hints: { clarity?: string; fancyColor?: boolean } = {},
  extractionOverride?: Partial<ReturnType<typeof buildDiamondInterpretationContext>>,
) {
  const clientScore = presentClientInterpretationScore(f, "deep");
  const context = buildDiamondInterpretationContext({ fields: f, rawScore });
  const mergedContext = { ...context, ...extractionOverride };
  return buildDiamondDecisionProfile({
    fields: f,
    metadata: { lab: "GCAL", reportNumber: "TEST", stoneType: "lab-grown" },
    capability: capability(),
    context: mergedContext,
    clientScore,
    displayScore: mergedContext.displayScore,
    gradeHints: hints,
  });
}

describe("classifyProportionArchetype", () => {
  it("detects spread-oriented proportions", () => {
    assert.equal(classifyProportionArchetype(SPREAD_FIELDS), "spread-oriented");
  });
});

describe("buildDiamondDecisionProfile", () => {
  it("Case A: strong proportions and low clarity risk → strong candidate", () => {
    const p = profileFor(STRONG_FIELDS, 92, { clarity: "VS1" });
    assert.match(p.opticalPerformance.band, /Strong|Solid/);
    assert.equal(p.riskProfile.band, "Low");
    assert.equal(p.primaryLimitingFactor.display, "No Significant Concerns Identified");
    assert.equal(p.overallRecommendation.band, "Strong Candidate");
  });

  it("Case B: decent optics but I2 → high risk, not recommended", () => {
    const p = profileFor(STRONG_FIELDS, 82, { clarity: "I2" });
    assert.ok(
      ["Strong", "Solid", "Moderate", "Mixed"].includes(p.opticalPerformance.band),
    );
    assert.equal(p.riskProfile.band, "High");
    assert.equal(p.confidence.band, "High");
    assert.equal(p.primaryLimitingFactor.display, "Clarity");
    assert.equal(p.overallRecommendation.band, "Not Recommended");
    assert.match(
      p.overallRecommendation.explanation,
      /Hourglass recommended clarity standards/i,
    );
  });

  it("IGI 700528875: solid optics but I2 clarity dominates recommendation", () => {
    const igiI2 = fields({
      shape: "Round Brilliant",
      carat: "1.00",
      measurements: "6.40 - 6.42 x 4.08",
      tablePercent: "55",
      depthPercent: "63.7",
      crownAngle: "36.1",
      pavilionAngle: "40.0",
      polish: "Very Good",
      symmetry: "Very Good",
      cutGrade: "Very Good",
      fluorescence: "None",
    });
    const clientScore = presentClientInterpretationScore(igiI2, "deep");
    const raw =
      clientScore.eligible && clientScore.overall !== null
        ? clientScore.overall
        : 82;
    const p = profileFor(igiI2, raw, { clarity: "I2", color: "G" });
    assert.equal(p.riskProfile.band, "High");
    assert.equal(p.overallRecommendation.band, "Not Recommended");
    assert.notEqual(p.riskProfile.band, "Low");
    assert.match(
      p.overallRecommendation.explanation,
      /Hourglass recommended clarity standards/i,
    );
  });

  it("I3 is always Not Recommended", () => {
    const p = profileFor(STRONG_FIELDS, 95, { clarity: "I3" });
    assert.equal(p.riskProfile.band, "High");
    assert.equal(p.overallRecommendation.band, "Not Recommended");
  });

  it("I1 is Not Recommended under Hourglass clarity standards", () => {
    const p = profileFor(STRONG_FIELDS, 92, { clarity: "I1" });
    assert.equal(p.overallRecommendation.band, "Not Recommended");
    assert.match(
      p.overallRecommendation.explanation,
      /Hourglass recommended clarity standards/i,
    );
  });

  it("SI2 with strong optics is worth reviewing with clarity limitation", () => {
    const p = profileFor(STRONG_FIELDS, 92, { clarity: "SI2" });
    assert.equal(p.overallRecommendation.band, "Worth Reviewing");
    assert.equal(p.primaryLimitingFactor.display, "Clarity");
  });

  it("Case C: spread-oriented good cut → compare carefully or worth reviewing", () => {
    const p = profileFor(
      fields({
        ...Object.fromEntries(
          REPORT_FIELD_KEYS.map((k) => [k, SPREAD_FIELDS[k]]),
        ),
        cutGrade: "Good",
        symmetry: "Good",
      }),
      74,
      { clarity: "SI1" },
    );
    assert.match(p.visualPresence.band, /Spread|Generous/);
    assert.ok(
      ["Compare Carefully", "Worth Reviewing"].includes(
        p.overallRecommendation.band,
      ),
    );
  });

  it("Case D: missing core proportions → needs more information", () => {
    const incomplete = fields({
      shape: "Round Brilliant",
      carat: "1.00",
    });
    const p = profileFor(incomplete, null, {}, {
      extractionState: "REPORT_ONLY",
      readState: "orientation",
      scoreEligible: false,
      canShowScore: false,
    });
    assert.equal(p.opticalPerformance.band, "Unavailable");
    assert.equal(p.confidence.band, "Low");
    assert.equal(p.primaryLimitingFactor.display, "Incomplete Report Data");
    assert.equal(
      p.overallRecommendation.band,
      "Worth Reviewing After Additional Information",
    );
  });

  it("Case E: fancy color caveat elevates risk framing", () => {
    const p = profileFor(STRONG_FIELDS, 88, { fancyColor: true });
    assert.ok(["Moderate", "Elevated", "High"].includes(p.riskProfile.band));
    assert.ok(
      ["Worth Reviewing", "Compare Carefully"].includes(
        p.overallRecommendation.band,
      ),
    );
    assert.match(p.riskProfile.explanation, /fancy|colored/i);
  });
});
