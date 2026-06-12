import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";
import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import {
  buildV3HeroPresentation,
  buildV3PercentilePresentation,
  needsPartialGradeReview,
  resolveUncappedOpticalTier,
  resolveV3PublicTier,
  shouldShowHourglassPerspective,
} from "@/app/diamond-intelligence/components/v3-presentation";
import { buildClientDiamondDecisionProfile } from "./client-decision-profile";
import { buildDiamondInterpretationContext } from "./client-interpretation-context";
import { presentEditorialLightPerformance } from "./client-editorial-language";
import { presentClientInterpretationScore } from "./client-score-present";
import { resolveHourglassClarityPolicy } from "./hourglass-clarity-policy";
import {
  hasInPersonReviewRecommendationCeiling,
  resolvePurchaseRecommendationLabel,
  type PurchaseRecommendationLabel,
} from "./purchase-recommendation-presentation";
import { V3_UNABLE_TO_VERIFY } from "@/app/diamond-intelligence/components/consumer-display-labels";
import {
  colorPreferenceImpact,
  suppressesBroadPercentileForColor,
} from "./color-grade-policy";
import { assessReportCapability } from "./report-capability";
import { buildV3ReportSummaryParagraphs } from "./v3-editorial-narrative";

function emptyFields(): CalibrationReportFields {
  return Object.fromEntries(
    REPORT_FIELD_KEYS.map((k) => [k, ""]),
  ) as CalibrationReportFields;
}

function assessProfile(input: {
  clarity: string;
  color?: string;
  reportNumber: string;
  fields?: Partial<CalibrationReportFields>;
}) {
  const fields = {
    ...emptyFields(),
    shape: "Round Brilliant",
    carat: input.fields?.carat ?? "1.00",
    measurements: input.fields?.measurements ?? "6.50 - 6.52 x 4.00",
    tablePercent: input.fields?.tablePercent ?? "57",
    depthPercent: input.fields?.depthPercent ?? "61.5",
    crownAngle: input.fields?.crownAngle ?? "34.5",
    pavilionAngle: input.fields?.pavilionAngle ?? "40.8",
    polish: input.fields?.polish ?? "Excellent",
    symmetry: input.fields?.symmetry ?? "Excellent",
    cutGrade: input.fields?.cutGrade ?? "Excellent",
    fluorescence: input.fields?.fluorescence ?? "None",
    ...input.fields,
  };
  const cap = assessReportCapability({ fields });
  const { internalCalibrationEligible: _i, ...clientCap } = cap;
  const cs = presentClientInterpretationScore(fields, cap.interpretationLevel);
  const raw = cs.eligible && cs.overall != null ? cs.overall : null;
  const ctx = buildDiamondInterpretationContext({
    fields,
    rawScore: raw,
    clarity: input.clarity,
  });
  const editorial = presentEditorialLightPerformance({
    internalLabel: ctx.displayLabel,
    displayBand: ctx.displayBand,
    canShowScore: ctx.canShowScore,
    canShowRareLanguage: ctx.canShowRareLanguage,
  });
  const clarityPolicy = resolveHourglassClarityPolicy(input.clarity);
  const publicTier = resolveV3PublicTier({
    editorialTier: editorial.tier,
    displayScore: ctx.displayScore,
    canShowScore: ctx.canShowScore,
    clarity: input.clarity,
  });
  const uncappedOpticalTier = resolveUncappedOpticalTier({
    editorialTier: editorial.tier,
    displayScore: ctx.displayScore,
    canShowScore: ctx.canShowScore,
  });
  const profile = buildClientDiamondDecisionProfile({
    fields,
    metadata: {
      lab: "GIA",
      reportNumber: input.reportNumber,
      stoneType: "natural",
    },
    capability: clientCap,
    rawScore: raw,
    gradeHints: { clarity: input.clarity, color: input.color },
  });
  const purchase = resolvePurchaseRecommendationLabel({
    internalBand: profile.overallRecommendation.band,
    clarityPolicy,
    color: input.color,
    clarity: input.clarity,
    uncappedOpticalTierLabel:
      uncappedOpticalTier === "Open" ? "Needs Review" : uncappedOpticalTier,
    fluorescence: fields.fluorescence,
    cutGrade: fields.cutGrade,
    polish: fields.polish,
    symmetry: fields.symmetry,
  });
  const hero = buildV3HeroPresentation({
    purchaseRecommendation: purchase,
    publicTier,
    uncappedOpticalTier,
    displayScore: ctx.displayScore,
    clarityPolicy,
    color: input.color,
    clarity: input.clarity,
    canShowScore: ctx.canShowScore,
    lowInterpretationConfidence: false,
    opticalUnavailable: false,
    isGcal8x: false,
    gcal8xTier: null,
  });
  const percentile = buildV3PercentilePresentation(ctx.displayScore, {
    clarity: input.clarity,
    color: input.color,
    purchaseLabel: purchase,
  });
  return {
    fields,
    profile,
    ctx,
    clarityPolicy,
    publicTier,
    uncappedOpticalTier,
    purchase,
    hero,
    percentile,
  };
}

function assertNotBroadPercentile(
  percentile: ReturnType<typeof buildV3PercentilePresentation>,
) {
  if (!percentile) return;
  assert.notEqual(percentile.scope, "broad");
  assert.equal(percentile.topSubline, "for reported optical proportions");
}

describe("validation A — 6237893522 O-P SI2 strong proportions", () => {
  const result = assessProfile({
    reportNumber: "6237893522",
    clarity: "SI2",
    color: "O to P Range",
    fields: {
      cutGrade: "Very Good",
      tablePercent: "58",
      depthPercent: "62",
      crownAngle: "36",
      pavilionAngle: "40.8",
    },
  });

  it("hero is not Exceptional and caps at Justin Inspection Required", () => {
    assert.notEqual(result.hero.purchaseHeadline, "Exceptional");
    assert.notEqual(result.hero.purchaseHeadline, "Rare");
    const allowed: PurchaseRecommendationLabel[] = [
      "Justin Inspection Required",
      "Worth Reviewing After Additional Information",
    ];
    assert.ok(allowed.includes(result.purchase));
    assert.equal(result.hero.purchaseHeadline, result.purchase);
  });

  it("optical read is secondary and broad percentile is suppressed", () => {
    assert.ok(result.hero.opticalPerformanceLine);
    assert.match(result.hero.opticalPerformanceLine ?? "", /Performance read:/i);
    assertNotBroadPercentile(result.percentile);
    if (result.percentile) {
      assert.doesNotMatch(
        `${result.percentile.topLine} ${result.percentile.topSubline}`,
        /diamonds we typically evaluate/i,
      );
    }
    assert.equal(result.hero.percentile, null);
  });

  it("report summary separates optics from purchase recommendation", () => {
    const summary = buildV3ReportSummaryParagraphs({
      clarityPolicy: result.clarityPolicy,
      isGcal8x: false,
      fields: result.fields,
      gradeHints: result.profile.gradeHints,
      purchaseRecommendation: result.purchase,
      uncappedOpticalTier: result.uncappedOpticalTier,
      interpretationSummary: "Strong optical indicators on paper.",
    });
    const text = summary.join(" ");
    assert.match(text, /strong optical proportions/i);
    assert.match(text, /human review/i);
    assert.doesNotMatch(text, /better than approximately/i);
  });
});

describe("validation B — 6482285473 F I1 Very Good", () => {
  const result = assessProfile({
    reportNumber: "6482285473",
    clarity: "I1",
    color: "F",
    fields: {
      cutGrade: "Very Good",
      polish: "Very Good",
      symmetry: "Very Good",
    },
  });

  it("is Outside Hourglass Standards and Not Recommended", () => {
    assert.equal(result.purchase, "Outside Hourglass Standards");
    assert.equal(result.hero.purchaseHeadline, "Outside Hourglass Standards");
    assert.equal(result.hero.purchaseSubline, "Not Recommended");
    assert.equal(result.percentile, null);
    assert.equal(result.hero.opticalPerformanceLine, null);
  });

  it("does not use Exceptional as primary language", () => {
    assert.notEqual(result.hero.purchaseHeadline, "Exceptional");
    assert.notEqual(result.hero.purchaseHeadline, "Rare");
  });
});

describe("validation C — 6535401257 F VVS1 VS Blue fluorescence", () => {
  const result = assessProfile({
    reportNumber: "6535401257",
    clarity: "VVS1",
    color: "F",
    fields: {
      cutGrade: "Excellent",
      polish: "Excellent",
      symmetry: "Excellent",
      fluorescence: "Very Strong Blue",
      crownAngle: "36.5",
      pavilionAngle: "41.0",
    },
  });

  it("caps hero at Worth Reviewing for very strong fluorescence on triple excellent", () => {
    assert.equal(result.purchase, "Worth Reviewing After Additional Information");
    assert.equal(
      result.hero.purchaseHeadline,
      "Worth Reviewing After Additional Information",
    );
    assert.notEqual(result.hero.purchaseHeadline, "Recommended");
    assert.notEqual(result.hero.purchaseHeadline, "Exceptional");
    assert.notEqual(result.hero.purchaseHeadline, "Rare");
    assert.equal(
      shouldShowHourglassPerspective({
        cutGrade: "Excellent",
        polish: "Excellent",
        symmetry: "Excellent",
      }),
      false,
    );
  });
});

describe("recommendation label in-person review ceiling", () => {
  it("triple excellent without strong caveat can remain recommended", () => {
    const result = assessProfile({
      reportNumber: "2231749659",
      clarity: "VVS1",
      color: "F",
      fields: {
        carat: "7.33",
        cutGrade: "Excellent",
        polish: "Excellent",
        symmetry: "Excellent",
        fluorescence: "None",
        crownAngle: "36",
        pavilionAngle: "40.8",
      },
    });
    assert.ok(
      result.purchase === "Recommended" ||
        result.purchase === "Strong Candidate",
    );
    assert.equal(
      shouldShowHourglassPerspective({
        cutGrade: "Excellent",
        polish: "Excellent",
        symmetry: "Excellent",
      }),
      false,
    );
  });

  it("excellent / very good / excellent shows hourglass perspective and caps purchase label", () => {
    const finishFields = {
      cutGrade: "Excellent",
      polish: "Very Good",
      symmetry: "Excellent",
      fluorescence: "None",
    };
    assert.equal(shouldShowHourglassPerspective(finishFields), true);
    const result = assessProfile({
      reportNumber: "vg-polish",
      clarity: "VS1",
      color: "G",
      fields: finishFields,
    });
    assert.equal(result.purchase, "Worth Reviewing After Additional Information");
    assert.notEqual(result.purchase, "Recommended");
  });

  it("missing finish grades alone do not trigger hourglass perspective", () => {
    assert.equal(
      shouldShowHourglassPerspective({
        cutGrade: "",
        polish: undefined,
        symmetry: "Excellent",
      }),
      false,
    );
  });

  it("strong fluorescence triggers recommendation ceiling helper", () => {
    const policy = resolveHourglassClarityPolicy("VVS1");
    assert.equal(
      hasInPersonReviewRecommendationCeiling({
        clarityPolicy: policy,
        fluorescence: "Strong Blue",
        cutGrade: "Excellent",
        polish: "Excellent",
        symmetry: "Excellent",
      }),
      true,
    );
    assert.equal(
      hasInPersonReviewRecommendationCeiling({
        clarityPolicy: policy,
        fluorescence: "Extremely Strong Blue",
        cutGrade: "Excellent",
        polish: "Excellent",
        symmetry: "Excellent",
      }),
      true,
    );
    assert.equal(
      hasInPersonReviewRecommendationCeiling({
        clarityPolicy: policy,
        fluorescence: "Faint",
        cutGrade: "Excellent",
        polish: "Excellent",
        symmetry: "Excellent",
      }),
      false,
    );
  });
});

describe("validation D — 2231749659 7.33ct F VVS1 Excellent", () => {
  const result = assessProfile({
    reportNumber: "2231749659",
    clarity: "VVS1",
    color: "F",
    fields: {
      carat: "7.33",
      cutGrade: "Excellent",
      crownAngle: "36",
      pavilionAngle: "40.8",
    },
  });

  it("does not auto-promote to Rare/Exceptional hero due to size", () => {
    assert.ok(
      result.purchase === "Strong Candidate" ||
        result.purchase === "Recommended",
    );
    assert.notEqual(result.hero.purchaseHeadline, "Exceptional");
    assert.notEqual(result.hero.purchaseHeadline, "Rare");
  });
});

describe("validation E — missing color/clarity", () => {
  it("enters partial review when grades are absent", () => {
    assert.equal(
      needsPartialGradeReview({
        gradeHints: {},
        canShowScore: false,
      }),
      true,
    );
  });
});

describe("validation F — total read failure copy", () => {
  it("uses shared unable-to-verify headline constant", () => {
    assert.equal(
      V3_UNABLE_TO_VERIFY.headline,
      "We Couldn't Read This Report",
    );
  });
});

describe("validation G — warm color preference context", () => {
  it("treats O-P as significant preference without automatic rejection", () => {
    assert.equal(colorPreferenceImpact("O to P Range"), "Significant");
    assert.equal(suppressesBroadPercentileForColor("O to P Range"), true);
  });

  it("O-P alone with strong optics is not Outside Hourglass Standards", () => {
    const result = assessProfile({
      reportNumber: "warm-only",
      clarity: "VS1",
      color: "O to P Range",
      fields: {
        cutGrade: "Excellent",
        crownAngle: "36",
        pavilionAngle: "40.8",
      },
    });
    assert.notEqual(result.purchase, "Outside Hourglass Standards");
    assert.notEqual(result.purchase, "Not Recommended");
    assert.notEqual(result.hero.purchaseHeadline, "Exceptional");
    assert.notEqual(result.hero.purchaseHeadline, "Rare");
    assertNotBroadPercentile(result.percentile);
  });
});
