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
import { buildDiamondDecisionProfile } from "./diamond-decision-profile";
import {
  IDENTITY_TRANSLATIONS,
  translationForIdentityLabel,
  type DiamondIdentityLabel,
} from "./diamond-purchase-personality";

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
  shape: "Round",
  carat: "1.00",
  measurements: "6.55 - 6.57 x 3.95",
  tablePercent: "62",
  depthPercent: "59.0",
  crownAngle: "32.0",
  pavilionAngle: "40.0",
  polish: "Excellent",
  symmetry: "Excellent",
  cutGrade: "Excellent",
  fluorescence: "None",
});

const DEEP_FIELDS = fields({
  shape: "Round",
  carat: "1.00",
  measurements: "6.45 - 6.47 x 4.15",
  tablePercent: "55",
  depthPercent: "64.0",
  crownAngle: "36.0",
  pavilionAngle: "40.5",
  polish: "Excellent",
  symmetry: "Excellent",
  cutGrade: "Excellent",
  fluorescence: "None",
});

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

function profileFor(
  f: CalibrationReportFields,
  rawScore: number | null,
  hints: { clarity?: string; color?: string; fancyColor?: boolean } = {},
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

describe("buildDiamondPurchasePersonality", () => {
  it("every identity label has a fixed translation", () => {
    const labels = Object.keys(IDENTITY_TRANSLATIONS) as DiamondIdentityLabel[];
    assert.equal(labels.length, 9);
    for (const label of labels) {
      const translation = translationForIdentityLabel(label);
      assert.ok(translation.length > 10, label);
      assert.equal(translation, IDENTITY_TRANSLATIONS[label]);
    }
  });

  it("Performance-Led Choice includes expected translation", () => {
    const p = profileFor(STRONG_FIELDS, 99, { clarity: "VS1" });
    assert.equal(p.purchasePersonality.label, "Performance-Led Choice");
    assert.equal(
      p.purchasePersonality.translation,
      "Strong reason to pursue if sparkle and light performance are priorities.",
    );
  });

  it("I3 → Outside Hourglass Standards", () => {
    const p = profileFor(STRONG_FIELDS, 95, { clarity: "I3" });
    assert.equal(
      p.purchasePersonality.label,
      "Outside Hourglass Standards",
    );
    assert.equal(p.purchasePersonality.tone, "negative");
  });

  it("I2 → Outside Hourglass Standards under Hourglass standards", () => {
    const igiI2 = fields({
      ...Object.fromEntries(REPORT_FIELD_KEYS.map((k) => [k, STRONG_FIELDS[k]])),
      measurements: "6.40 - 6.42 x 4.08",
      tablePercent: "55",
      depthPercent: "63.7",
      crownAngle: "36.1",
      pavilionAngle: "40.0",
      polish: "Very Good",
      symmetry: "Very Good",
      cutGrade: "Very Good",
    });
    const p = profileFor(igiI2, 80, { clarity: "I2", color: "G" });
    assert.equal(p.purchasePersonality.label, "Outside Hourglass Standards");
    assert.equal(p.overallRecommendation.band, "Not Recommended");
    assert.match(p.purchasePersonality.summary, /Hourglass typical client clarity standards/i);
    assert.notEqual(p.purchasePersonality.label, "Performance-Led Choice");
  });

  it("high optical / normal risk → Performance-Led Choice", () => {
    const p = profileFor(STRONG_FIELDS, 99, { clarity: "VS1" });
    assert.equal(p.purchasePersonality.label, "Performance-Led Choice");
    assert.ok(p.purchasePersonality.why.length >= 2);
  });

  it("spread-forward diamond → Spread-Oriented Choice", () => {
    const p = profileFor(SPREAD_FIELDS, 78, { clarity: "VS1" });
    assert.equal(p.purchasePersonality.label, "Spread-Oriented Choice");
  });

  it("deep architecture diamond → Architecture-Limited Candidate", () => {
    const p = profileFor(DEEP_FIELDS, 91, { clarity: "VS2" });
    assert.equal(p.purchasePersonality.label, "Architecture-Limited Candidate");
  });

  it("incomplete report data → Review-Dependent Candidate", () => {
    const incomplete = fields({
      shape: "Round",
      carat: "1.00",
      tablePercent: "57",
      depthPercent: "61.5",
    });
    const p = profileFor(incomplete, null, {}, {
      extractionState: "PARTIAL_EXTRACTION",
      readState: "partial",
      scoreEligible: false,
      canShowScore: false,
    });
    assert.equal(p.purchasePersonality.label, "Review-Dependent Candidate");
  });

  it("clean balanced diamond → Balanced Everyday or Conservative Candidate", () => {
    const p = profileFor(
      fields({
        ...Object.fromEntries(REPORT_FIELD_KEYS.map((k) => [k, STRONG_FIELDS[k]])),
        carat: "1.00",
        measurements: "6.50 - 6.53 x 4.01",
      }),
      88,
      { clarity: "VVS2" },
    );
    assert.ok(
      ["Balanced Everyday Choice", "Conservative Candidate", "Performance-Led Choice"].includes(
        p.purchasePersonality.label,
      ),
    );
  });

  it("strong color/clarity but weaker optics → Appearance-Led Choice", () => {
    const p = profileFor(
      fields({
        ...Object.fromEntries(REPORT_FIELD_KEYS.map((k) => [k, STRONG_FIELDS[k]])),
        carat: "1.00",
        measurements: "6.50 - 6.53 x 4.01",
        tablePercent: "60",
        depthPercent: "62.5",
        crownAngle: "33.0",
        pavilionAngle: "41.2",
      }),
      76,
      { clarity: "VS1", color: "F" },
    );
    assert.equal(p.purchasePersonality.label, "Appearance-Led Choice");
  });

  it("SI2 with strong optics → Value-Oriented Candidate (distinct from I2)", () => {
    const p = profileFor(STRONG_FIELDS, 99, { clarity: "SI2" });
    assert.equal(p.purchasePersonality.label, "Value-Oriented Candidate");
    assert.equal(p.overallRecommendation.band, "Worth Reviewing");
  });

  it("I1 and I2 use distinct not-favorable copy under Hourglass standards", () => {
    const i1 = profileFor(STRONG_FIELDS, 93, { clarity: "I1" });
    const i2 = profileFor(
      fields({
        ...Object.fromEntries(REPORT_FIELD_KEYS.map((k) => [k, STRONG_FIELDS[k]])),
        polish: "Very Good",
        symmetry: "Very Good",
        cutGrade: "Very Good",
      }),
      80,
      { clarity: "I2" },
    );
    assert.equal(i1.overallRecommendation.band, "Not Recommended");
    assert.equal(i2.overallRecommendation.band, "Not Recommended");
    assert.equal(i1.purchasePersonality.label, "Outside Hourglass Standards");
    assert.equal(i2.purchasePersonality.label, "Outside Hourglass Standards");
    assert.match(i1.purchasePersonality.why.join(" "), /I1/i);
    assert.match(i2.purchasePersonality.why.join(" "), /I2/i);
  });

  it("partial extraction copy frames missing information, not the diamond", () => {
    const incomplete = fields({
      shape: "Round",
      carat: "1.00",
      tablePercent: "57",
      depthPercent: "61.5",
    });
    const p = profileFor(incomplete, null, {}, {
      extractionState: "PARTIAL_EXTRACTION",
      readState: "partial",
      scoreEligible: false,
      canShowScore: false,
    });
    assert.match(p.purchasePersonality.summary, /not a verdict on the diamond/i);
    assert.match(p.purchasePersonality.why.join(" "), /incomplete report information/i);
  });

  it("deep strong candidate uses architecture-aware strong-candidate copy", () => {
    const p = profileFor(DEEP_FIELDS, 91, { clarity: "VS2" });
    assert.equal(p.purchasePersonality.label, "Architecture-Limited Candidate");
    assert.equal(p.overallRecommendation.band, "Strong Candidate");
    assert.match(p.purchasePersonality.summary, /strong candidate on paper/i);
    assert.match(p.purchasePersonality.summary, /depth and face-up presence/i);
  });

  it("O–P SI2 with fluorescence stays Value-Oriented with color-led copy", () => {
    const p = profileFor(STRONG_FIELDS, 96, {
      clarity: "SI2",
      color: "O",
    });
    assert.equal(p.purchasePersonality.label, "Value-Oriented Candidate");
    assert.match(p.purchasePersonality.summary, /body color/i);
    assert.match(p.purchasePersonality.why.join(" "), /body color|tradeoff/i);
  });
});
