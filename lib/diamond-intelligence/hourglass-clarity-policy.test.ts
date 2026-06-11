import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";
import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import { buildClientDiamondDecisionProfile } from "./client-decision-profile";
import { buildDiamondInterpretationContext } from "./client-interpretation-context";
import { assessReportCapability } from "./report-capability";
import { presentClientInterpretationScore } from "./client-score-present";
import {
  buildV3PercentilePresentation,
  resolveGcal8xVisualTier,
  resolveV3HeroVerdictLabel,
  resolveV3PublicTier,
} from "../../app/diamond-intelligence/components/v3-presentation";
import { editorialTierFromInternalLabel } from "./client-editorial-language";
import {
  HOURGLASS_EXCLUDED_CLARITY_CONSUMER_MESSAGE,
  resolveHourglassClarityPolicy,
} from "./hourglass-clarity-policy";

function emptyFields(): CalibrationReportFields {
  return Object.fromEntries(
    REPORT_FIELD_KEYS.map((k) => [k, ""]),
  ) as CalibrationReportFields;
}

function profileFor(input: {
  clarity: string;
  fields?: Partial<CalibrationReportFields>;
  color?: string;
}) {
  const fields = {
    ...emptyFields(),
    shape: "Round Brilliant",
    carat: "1.00",
    measurements: "6.50 - 6.52 x 4.00",
    tablePercent: "57",
    depthPercent: "61.5",
    crownAngle: "34.5",
    pavilionAngle: "40.8",
    polish: "Excellent",
    symmetry: "Excellent",
    cutGrade: "Excellent",
    fluorescence: "None",
    ...input.fields,
  };
  const cap = assessReportCapability({ fields });
  const { internalCalibrationEligible: _i, ...clientCap } = cap;
  const cs = presentClientInterpretationScore(fields, cap.interpretationLevel);
  const raw = cs.eligible && cs.overall != null ? cs.overall : null;
  return buildClientDiamondDecisionProfile({
    fields,
    metadata: { lab: "IGI", reportNumber: "TEST", stoneType: "lab-grown" },
    capability: clientCap,
    rawScore: raw,
    gradeHints: { clarity: input.clarity, color: input.color },
  });
}

describe("resolveHourglassClarityPolicy", () => {
  it("flags I1–I3 as excluded with suppressed percentile", () => {
    for (const clarity of ["I1", "I2", "I3"] as const) {
      const p = resolveHourglassClarityPolicy(clarity);
      assert.equal(p.isExcluded, true, clarity);
      assert.equal(p.suppressFavorablePercentile, true, clarity);
      assert.equal(p.heroVerdictLabel, "Outside Hourglass Standards", clarity);
    }
  });

  it("SI2 requires inspection but is not excluded", () => {
    const p = resolveHourglassClarityPolicy("SI2");
    assert.equal(p.isExcluded, false);
    assert.equal(p.isSi2, true);
    assert.equal(p.suppressFavorablePercentile, false);
    assert.equal(p.suppressPremiumTierLabels, true);
  });
});

describe("Hourglass clarity standards — consumer outputs", () => {
  it("1. I1 excellent optics → Not Recommended, Outside Standards, no percentile", () => {
    const profile = profileFor({
      clarity: "I1",
      fields: {
        polish: "Excellent",
        symmetry: "Excellent",
        cutGrade: "Excellent",
      },
    });
    const ctx = buildDiamondInterpretationContext({
      fields: {
        shape: "Round",
        tablePercent: "57",
        depthPercent: "61.5",
        crownAngle: "34.5",
        pavilionAngle: "40.8",
        polish: "Excellent",
        symmetry: "Excellent",
        cutGrade: "Excellent",
      },
      rawScore: profile.opticalPerformance.score ?? 90,
      clarity: "I1",
    });

    assert.equal(profile.overallRecommendation.band, "Not Recommended");
    assert.equal(profile.purchasePersonality.label, "Outside Hourglass Standards");
    assert.equal(buildV3PercentilePresentation(90, { clarity: "I1" }), null);
    assert.equal(
      resolveV3HeroVerdictLabel({
        clarity: "I1",
        lowInterpretationConfidence: false,
        opticalUnavailable: false,
        isGcal8x: false,
        gcal8xTier: "Exceptional",
        publicTier: "Strong",
      }),
      "Outside Hourglass Standards",
    );
    assert.match(profile.purchasePersonality.summary, /outside the quality range/i);
    assert.doesNotMatch(ctx.displayLabel, /Top %/);
  });

  it("2. I2 good optics → Not Recommended, no Top percentile language", () => {
    const profile = profileFor({
      clarity: "I2",
      fields: {
        polish: "Very Good",
        symmetry: "Very Good",
        cutGrade: "Very Good",
      },
    });

    assert.equal(profile.overallRecommendation.band, "Not Recommended");
    assert.equal(profile.purchasePersonality.label, "Outside Hourglass Standards");
    assert.equal(buildV3PercentilePresentation(71, { clarity: "I2" }), null);
    assert.equal(resolveV3PublicTier({
      editorialTier: "Distinctive",
      displayScore: 71,
      canShowScore: true,
      clarity: "I2",
    }), "Open");
    assert.doesNotMatch(
      editorialTierFromInternalLabel("Outside Hourglass Standards", {
        canShowScore: true,
      }),
      /Distinctive|Strong/,
    );
  });

  it("3. I3 any optics → Not Recommended, suppressed percentile", () => {
    const profile = profileFor({ clarity: "I3" });
    assert.equal(profile.overallRecommendation.band, "Not Recommended");
    assert.equal(buildV3PercentilePresentation(55, { clarity: "I3" }), null);
    assert.equal(resolveHourglassClarityPolicy("I3").harshPercentileTopPercent, 5);
  });

  it("4. SI2 excellent optics → inspection language, capped below Distinctive", () => {
    const profile = profileFor({ clarity: "SI2" });
    assert.notEqual(profile.overallRecommendation.band, "Not Recommended");
    assert.notEqual(profile.purchasePersonality.label, "Outside Hourglass Standards");
    assert.ok(
      ["Worth Reviewing", "Compare Carefully", "Strong Candidate"].includes(
        profile.overallRecommendation.band,
      ),
    );
    assert.equal(
      buildV3PercentilePresentation(92, { clarity: "SI2" })?.topLine,
      "Top 8%",
    );
    assert.equal(
      resolveV3PublicTier({
        editorialTier: "Distinctive",
        displayScore: 99,
        canShowScore: true,
        clarity: "SI2",
      }),
      "Strong",
    );
    assert.equal(resolveGcal8xVisualTier(99, "SI2"), null);
  });

  it("5. GCAL 8X VS1 strong report → still scores highly", () => {
    const profile = profileFor({
      clarity: "VS1",
      fields: {
        carat: "1.50",
        measurements: "7.40 - 7.42 x 4.58",
        tablePercent: "57",
        depthPercent: "61.5",
        polish: "Excellent",
        symmetry: "Excellent",
        cutGrade: "Excellent",
      },
    });
    assert.notEqual(profile.overallRecommendation.band, "Not Recommended");
    assert.notEqual(
      profile.purchasePersonality.label,
      "Outside Hourglass Standards",
    );
    assert.ok(profile.opticalPerformance.score != null && profile.opticalPerformance.score >= 70);
    assert.ok(
      buildV3PercentilePresentation(profile.opticalPerformance.score, {
        clarity: "VS1",
        color: "G",
        purchaseLabel: "Strong Candidate",
      }),
    );
  });

  it("IGI 674522816 regression — I2 Good cut deep stone", () => {
    const profile = profileFor({
      clarity: "I2",
      color: "G",
      fields: {
        carat: "1.03",
        measurements: "6.45 - 6.47 x 4.36",
        tablePercent: "57",
        depthPercent: "67.5",
        crownAngle: "36.0",
        pavilionAngle: "41.0",
        polish: "Good",
        symmetry: "Good",
        cutGrade: "Good",
        fluorescence: "None",
      },
    });
    const ctx = buildDiamondInterpretationContext({
      fields: {},
      rawScore: profile.opticalPerformance.score ?? 71,
      clarity: "I2",
    });

    assert.equal(profile.overallRecommendation.band, "Not Recommended");
    assert.equal(profile.purchasePersonality.label, "Outside Hourglass Standards");
    assert.equal(buildV3PercentilePresentation(71, { clarity: "I2" }), null);
    assert.equal(
      resolveV3HeroVerdictLabel({
        clarity: "I2",
        lowInterpretationConfidence: false,
        opticalUnavailable: false,
        isGcal8x: false,
        gcal8xTier: "Exceptional",
        publicTier: "Strong",
      }),
      "Outside Hourglass Standards",
    );
    assert.match(
      profile.overallRecommendation.explanation,
      /outside the quality range/i,
    );
    assert.equal(ctx.displayLabel, "Outside Hourglass Standards");
    assert.equal(ctx.canShowRareLanguage, false);
    assert.equal(
      profile.purchasePersonality.summary,
      HOURGLASS_EXCLUDED_CLARITY_CONSUMER_MESSAGE,
    );
  });
});
