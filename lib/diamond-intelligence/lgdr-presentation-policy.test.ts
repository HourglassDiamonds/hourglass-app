import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyReportFields } from "@/lib/calibration-library/fields";
import {
  buildV3HeroPresentation,
  buildV3PercentilePresentation,
  resolveUncappedOpticalTier,
  shouldShowHourglassPerspective,
} from "@/app/diamond-intelligence/components/v3-presentation";
import { presentEditorialLightPerformance } from "./client-editorial-language";
import { buildClientDiamondDecisionProfile } from "./client-decision-profile";
import { buildDiamondInterpretationContext } from "./client-interpretation-context";
import { presentClientInterpretationScore } from "./client-score-present";
import { resolveHourglassClarityPolicy } from "./hourglass-clarity-policy";
import {
  isPurchaseRecommendationEligibleForBroadPercentile,
  resolvePurchaseRecommendationLabel,
} from "./purchase-recommendation-presentation";
import { buildJustinPerspectiveParagraphs } from "./v3-editorial-narrative";
import {
  detectLgdrPostGrowthTreatmentDisclosure,
  extractFinishGradesFromReportTextHint,
  isLgdrPresentationContext,
  resolveLgdrFinishGradesForPresentation,
  resolveLgdrPresentationFlags,
} from "./lgdr-presentation-policy";

const LGDR_METADATA = {
  lab: "GIA" as const,
  stoneType: "lab-grown" as const,
  reportNumber: "TEST",
};

const NATURAL_GIA_METADATA = {
  lab: "GIA" as const,
  stoneType: "natural" as const,
  reportNumber: "TEST",
};

function lgdrHint(input: {
  cut?: string;
  polish?: string;
  symmetry?: string;
  treatment?: boolean;
}): string {
  const lines = [
    "LGDR",
    "LABORATORY-GROWN DIAMOND REPORT - DOSSIER",
    `Cut ................................................................ ${input.cut ?? "Excellent"}`,
    `Polish ............................................................ ${input.polish ?? "Excellent"}`,
    `Symmetry ........................................................ ${input.symmetry ?? "Excellent"}`,
  ];
  if (input.treatment) {
    lines.push(
      "Comments: evidence of post-growth treatments to change the color",
    );
  }
  return lines.join("\n");
}

function fieldsForLgdr(input: {
  cutGrade?: string;
  polish?: string;
  symmetry?: string;
}) {
  const fields = emptyReportFields();
  fields.shape = "Round Brilliant";
  fields.carat = "1.50";
  fields.measurements = "7.40 - 7.44 x 4.50 mm";
  fields.tablePercent = "58";
  fields.depthPercent = "61.0";
  fields.crownAngle = "34.5";
  fields.pavilionAngle = "40.8";
  fields.fluorescence = "None";
  fields.cutGrade = input.cutGrade ?? "";
  fields.polish = input.polish ?? "";
  fields.symmetry = input.symmetry ?? "";
  return fields;
}

function presentationForLgdrAnchor(input: {
  reportId: string;
  color: string;
  clarity: string;
  reportTextHint: string;
  cutGrade?: string;
  polish?: string;
  symmetry?: string;
  rawScore?: number;
}) {
  const fields = fieldsForLgdr({
    cutGrade: input.cutGrade,
    polish: input.polish,
    symmetry: input.symmetry,
  });
  const lgdrFlags = resolveLgdrPresentationFlags({
    metadata: { ...LGDR_METADATA, reportNumber: input.reportId },
    reportTextHint: input.reportTextHint,
    fields,
  });
  const finish = lgdrFlags.effectiveFinish;
  const capability = {
    interpretationLevel: "deep" as const,
    scoreEligible: true,
    canShowScore: true,
    canShowRareLanguage: true,
    needsExpertDiagramReview: false,
    guidedCompletionFields: [] as never[],
    missingFields: [] as never[],
    extractionState: "COMPLETE" as const,
    readState: "full" as const,
    confidenceLevel: "high" as const,
  };
  const rawScore = input.rawScore ?? 96;
  const context = buildDiamondInterpretationContext({
    fields,
    rawScore,
    clarity: input.clarity,
  });
  const profile = buildClientDiamondDecisionProfile({
    fields,
    metadata: { ...LGDR_METADATA, reportNumber: input.reportId },
    capability,
    rawScore,
    gradeHints: { color: input.color, clarity: input.clarity },
    reportTextHint: input.reportTextHint,
  });
  const clarityPolicy = resolveHourglassClarityPolicy(input.clarity);
  const editorial = presentEditorialLightPerformance({
    internalLabel: context.displayLabel,
    displayBand: context.displayBand,
    canShowScore: context.canShowScore,
    canShowRareLanguage: context.canShowRareLanguage,
  });
  const uncappedOpticalTier = resolveUncappedOpticalTier({
    editorialTier: editorial.tier,
    displayScore: context.displayScore,
    canShowScore: context.canShowScore,
  });
  const purchaseLabel = resolvePurchaseRecommendationLabel({
    internalBand: profile.overallRecommendation.band,
    clarityPolicy,
    color: input.color,
    clarity: input.clarity,
    uncappedOpticalTierLabel:
      uncappedOpticalTier === "Open" ? "Needs Review" : uncappedOpticalTier,
    fluorescence: fields.fluorescence,
    cutGrade: finish.cutGrade,
    polish: finish.polish,
    symmetry: finish.symmetry,
  });
  const percentile = buildV3PercentilePresentation(context.displayScore, {
    clarity: input.clarity,
    color: input.color,
    purchaseLabel,
    lgdrPercentileCaution: lgdrFlags.percentileCaution,
  });
  const hero = buildV3HeroPresentation({
    purchaseRecommendation: purchaseLabel,
    publicTier: "Exceptional",
    uncappedOpticalTier,
    displayScore: context.displayScore,
    clarityPolicy,
    color: input.color,
    clarity: input.clarity,
    canShowScore: context.canShowScore,
    lowInterpretationConfidence: false,
    opticalUnavailable: false,
    isGcal8x: false,
    gcal8xTier: null,
    lgdrPercentileCaution: lgdrFlags.percentileCaution,
  });
  const justin = buildJustinPerspectiveParagraphs({
    clarityPolicy,
    isGcal8x: false,
    decisionProfile: profile,
    fields,
    metadata: { ...LGDR_METADATA, reportNumber: input.reportId },
    reportTextHint: input.reportTextHint,
  });
  const broadEligible = isPurchaseRecommendationEligibleForBroadPercentile({
    purchaseLabel,
    clarityPolicy,
    color: input.color,
  });

  return {
    lgdrFlags,
    finish,
    purchaseLabel,
    percentile,
    hero,
    justin,
    broadEligible,
    showHourglassPerspective: shouldShowHourglassPerspective(
      fields,
      finish,
    ),
  };
}

describe("LGDR presentation policy gate", () => {
  it("activates for GIA lab-grown / LGDR only", () => {
    assert.equal(
      isLgdrPresentationContext(LGDR_METADATA, "LGDR dossier"),
      true,
    );
    assert.equal(
      isLgdrPresentationContext(NATURAL_GIA_METADATA, "GIA natural report"),
      false,
    );
    assert.equal(
      isLgdrPresentationContext({ lab: "IGI", stoneType: "lab-grown" }),
      false,
    );
  });

  it("extracts finish grades from LGDR dossier hint text", () => {
    const hint = lgdrHint({
      cut: "Excellent",
      polish: "Very Good",
      symmetry: "Excellent",
    });
    assert.deepEqual(extractFinishGradesFromReportTextHint(hint), {
      cutGrade: "Excellent",
      polish: "Very Good",
      symmetry: "Excellent",
    });
    assert.deepEqual(
      resolveLgdrFinishGradesForPresentation({}, hint),
      {
        cutGrade: "Excellent",
        polish: "Very Good",
        symmetry: "Excellent",
      },
    );
  });

  it("detects post-growth treatment language", () => {
    assert.equal(
      detectLgdrPostGrowthTreatmentDisclosure(
        "evidence of post-growth treatments to change the color",
      ),
      true,
    );
    assert.equal(
      detectLgdrPostGrowthTreatmentDisclosure("No evidence of treatment"),
      false,
    );
  });
});

describe("LGDR change anchors", () => {
  it("7501664699 — Very Good polish caps purchase and softens percentile", () => {
    const hint = lgdrHint({
      cut: "Excellent",
      polish: "Very Good",
      symmetry: "Excellent",
    });
    const result = presentationForLgdrAnchor({
      reportId: "7501664699",
      color: "G",
      clarity: "VS2",
      reportTextHint: hint,
      rawScore: 96,
    });
    assert.equal(result.lgdrFlags.active, true);
    assert.equal(result.lgdrFlags.percentileCaution, true);
    assert.equal(
      result.purchaseLabel,
      "Worth Reviewing After Additional Information",
    );
    assert.equal(result.broadEligible, false);
    assert.equal(result.hero.percentile, null);
    assert.ok(result.percentile);
    assert.doesNotMatch(result.percentile!.topLine, /^Top \d+%$/);
    assert.match(result.justin.join(" "), /polish below Excellent/i);
    assert.equal(result.showHourglassPerspective, true);
  });

  it("6535655472 — Very Good polish blocks Recommended elevation", () => {
    const hint = lgdrHint({
      cut: "Excellent",
      polish: "Very Good",
      symmetry: "Excellent",
    });
    const result = presentationForLgdrAnchor({
      reportId: "6535655472",
      color: "D",
      clarity: "VS1",
      reportTextHint: hint,
      rawScore: 96,
    });
    assert.equal(
      result.purchaseLabel,
      "Worth Reviewing After Additional Information",
    );
    assert.notEqual(result.purchaseLabel, "Recommended");
    assert.notEqual(result.purchaseLabel, "Strong Candidate");
    assert.equal(result.broadEligible, false);
    assert.equal(result.lgdrFlags.percentileCaution, true);
    assert.match(result.justin.join(" "), /polish below Excellent/i);
  });

  it("2507821439 — Very Good cut caps purchase and softens percentile", () => {
    const hint = lgdrHint({
      cut: "Very Good",
      polish: "Excellent",
      symmetry: "Excellent",
    });
    const result = presentationForLgdrAnchor({
      reportId: "2507821439",
      color: "D",
      clarity: "VS1",
      reportTextHint: hint,
      rawScore: 92,
    });
    assert.equal(
      result.purchaseLabel,
      "Worth Reviewing After Additional Information",
    );
    assert.equal(result.lgdrFlags.percentileCaution, true);
    assert.ok(result.percentile);
    assert.doesNotMatch(result.percentile!.topLine, /^Top \d+%$/);
    assert.match(result.justin.join(" "), /cut below Excellent/i);
    assert.equal(result.showHourglassPerspective, true);
  });

  it("3455448751 — post-growth treatment disclosed in Justin's perspective", () => {
    const hint = lgdrHint({
      cut: "Excellent",
      polish: "Excellent",
      symmetry: "Excellent",
      treatment: true,
    });
    const result = presentationForLgdrAnchor({
      reportId: "3455448751",
      color: "F",
      clarity: "VS1",
      reportTextHint: hint,
      rawScore: 88,
    });
    assert.equal(result.lgdrFlags.treatmentDisclosure, true);
    assert.equal(result.lgdrFlags.percentileCaution, true);
    assert.match(result.justin.join(" "), /post-growth treatment/i);
    assert.match(result.justin.join(" "), /treated color/i);
  });
});

describe("LGDR control anchors — triple excellent unchanged", () => {
  for (const id of [
    "7538426153",
    "6502262027",
    "2504691249",
    "7496507350",
  ] as const) {
    it(`${id} — triple excellent keeps strong read and broad percentile`, () => {
      const hint = lgdrHint({
        cut: "Excellent",
        polish: "Excellent",
        symmetry: "Excellent",
      });
      const result = presentationForLgdrAnchor({
        reportId: id,
        color: "D",
        clarity: "VS1",
        reportTextHint: hint,
        rawScore: 96,
      });
      assert.equal(result.lgdrFlags.percentileCaution, false);
      assert.equal(result.lgdrFlags.treatmentDisclosure, false);
      assert.ok(
        result.purchaseLabel === "Strong Candidate" ||
          result.purchaseLabel === "Recommended",
      );
      assert.equal(result.broadEligible, true);
      assert.ok(result.percentile);
      assert.match(result.percentile!.topLine, /^Top \d+%$/);
      assert.equal(result.percentile!.scope, "broad");
      assert.equal(result.showHourglassPerspective, false);
      assert.doesNotMatch(result.justin.join(" "), /post-growth treatment/i);
      assert.doesNotMatch(result.justin.join(" "), /below Excellent/i);
    });
  }
});
