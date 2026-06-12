import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildV3PercentilePresentation,
  buildV3IncompleteTechnicalItems,
  capV3PublicTier,
  hasUsableDisplayClarity,
  hasUsableDisplayColor,
  isGcal8xReport,
  isListedPartialColor,
  looksLikeGcal8xDisplayText,
  needsPartialGradeReview,
  partialColorSelectOptions,
  PARTIAL_COLOR_SINGLE_GRADES,
  resolveGcal8xVisualTier,
  resolveV3HeroVerdictLabel,
  resolveV3IncompleteAssessmentCopy,
  resolveV3IncompleteMissingDataValue,
  resolveV3PublicTier,
  resolveV3RenderPhase,
  shouldShowHourglassPerspective,
} from "./v3-presentation";

describe("needsPartialGradeReview", () => {
  it("does not trigger when score is already eligible", () => {
    assert.equal(
      needsPartialGradeReview({
        gradeHints: {},
        canShowScore: true,
      }),
      false,
    );
  });

  it("does not trigger when parsed color and clarity are present even without score", () => {
    assert.equal(
      needsPartialGradeReview({
        gradeHints: { color: "F", clarity: "I1" },
        canShowScore: false,
      }),
      false,
    );
  });

  it("triggers when 4Cs are missing and score is not eligible", () => {
    assert.equal(
      needsPartialGradeReview({
        gradeHints: { color: "G" },
        canShowScore: false,
      }),
      true,
    );
  });

  it("accepts usable color ranges and clarity grades", () => {
    assert.equal(
      needsPartialGradeReview({
        gradeHints: { color: "O to P Range", clarity: "SI2" },
        canShowScore: false,
      }),
      false,
    );
  });
});

describe("resolveV3RenderPhase", () => {
  it("returns partial before full when grades are incomplete", () => {
    assert.equal(
      resolveV3RenderPhase({
        hasReport: true,
        partialGradeReview: true,
        canRenderFullResult: true,
      }),
      "partial",
    );
  });

  it("returns full only after partial gate clears", () => {
    assert.equal(
      resolveV3RenderPhase({
        hasReport: true,
        partialGradeReview: false,
        canRenderFullResult: true,
      }),
      "full",
    );
  });

  it("returns empty when no report is loaded", () => {
    assert.equal(
      resolveV3RenderPhase({
        hasReport: false,
        partialGradeReview: false,
        canRenderFullResult: false,
      }),
      "empty",
    );
  });
});

describe("hasUsableDisplayColor", () => {
  it("rejects placeholders", () => {
    assert.equal(hasUsableDisplayColor("unknown"), false);
    assert.equal(hasUsableDisplayColor("—"), false);
  });

  it("accepts standard and range phrasing", () => {
    assert.equal(hasUsableDisplayColor("G"), true);
    assert.equal(hasUsableDisplayColor("O to P Range"), true);
  });
});

describe("hasUsableDisplayClarity", () => {
  it("accepts normalized clarity grades", () => {
    assert.equal(hasUsableDisplayClarity("VVS1"), true);
    assert.equal(hasUsableDisplayClarity("SI2"), true);
  });
});

describe("partialColorSelectOptions", () => {
  it("includes D through Z single grades", () => {
    const options = partialColorSelectOptions();
    assert.ok(options.includes("D"));
    assert.ok(options.includes("M"));
    assert.ok(options.includes("Z"));
    assert.ok(!options.includes("C"));
  });

  it("includes common GIA range phrasing", () => {
    const options = partialColorSelectOptions();
    assert.ok(options.includes("O to P Range"));
    assert.ok(options.includes("K to L Range"));
    assert.ok(options.includes("M to N Range"));
  });

  it("prepends extracted colors not already listed", () => {
    const options = partialColorSelectOptions("O-P Range");
    assert.equal(options[0], "O-P Range");
  });
});

describe("isListedPartialColor", () => {
  it("recognizes singles and ranges", () => {
    assert.equal(isListedPartialColor("M"), true);
    assert.equal(isListedPartialColor("O to P Range"), true);
    assert.equal(isListedPartialColor("O-P Range"), false);
  });

  it("covers every D–Z single grade", () => {
    for (const grade of PARTIAL_COLOR_SINGLE_GRADES) {
      assert.equal(isListedPartialColor(grade), true);
    }
  });
});

describe("looksLikeGcal8xDisplayText", () => {
  it("detects explicit GCAL 8X marks", () => {
    assert.equal(
      looksLikeGcal8xDisplayText("GCAL 8X Ultimate Diamond Cut Grade"),
      true,
    );
  });

  it("detects Ultimate Cut Grade + eight aspects copy", () => {
    assert.equal(
      looksLikeGcal8xDisplayText(
        "GCAL Ultimate Diamond Cut Grade Excellent grades in all EIGHT aspects of CUT quality assessment",
      ),
      true,
    );
  });

  it("rejects plain GCAL Sarine 4Cs without 8X markers", () => {
    assert.equal(
      looksLikeGcal8xDisplayText(
        "GCAL BY SARINE certificate no 4Cs GRADING Round Brilliant",
      ),
      false,
    );
  });
});

describe("isGcal8xReport", () => {
  it("uses reportFormat when parser routes to gcal-8x", () => {
    assert.equal(
      isGcal8xReport({
        lab: "GCAL",
        reportFormat: "gcal-8x",
      }),
      true,
    );
  });

  it("detects 8X when parserFamily is gcal-sarine-4cs but text is 8X-class", () => {
    assert.equal(
      isGcal8xReport({
        lab: "GCAL",
        reportFormat: "gcal-sarine-4cs",
        parserFamily: "gcal-sarine-4cs",
        reportTextHint:
          "GCAL 8X Ultimate Diamond Cut Grade Excellent grades in all EIGHT aspects of CUT quality assessment Optical Brilliance Fire Scintillation Hearts & Arrows",
      }),
      true,
    );
  });

  it("does not treat standard GIA reports as 8X", () => {
    assert.equal(
      isGcal8xReport({
        lab: "GIA",
        reportFormat: undefined,
        parserFamily: "gia-modern",
        reportTextHint: "GIA diamond grading report",
      }),
      false,
    );
  });

  it("detects 8X from proportion diagram + Excellent finish cluster when text is Sarine-only", () => {
    assert.equal(
      isGcal8xReport(
        {
          lab: "GCAL",
          reportFormat: "gcal-sarine-4cs",
          parserFamily: "gcal-sarine-4cs",
          reportTextHint: "GCAL BY SARINE certificate specifications",
        },
        {
          tablePercent: "58",
          depthPercent: "61.1",
          crownAngle: "34.5",
          pavilionAngle: "40.8",
          starLengthPercent: "48",
          lowerHalfPercent: "77",
          polish: "Excellent",
          symmetry: "Excellent",
          cutGrade: "Excellent",
        },
      ),
      true,
    );
  });
});

describe("clarity standards in V3 presentation", () => {
  it("suppresses percentile for I2 regardless of optical score", () => {
    assert.equal(buildV3PercentilePresentation(71, { clarity: "I2" }), null);
  });

  it("scopes percentile optically for SI2 warm color", () => {
    const p = buildV3PercentilePresentation(96, {
      clarity: "SI2",
      color: "O to P Range",
      purchaseLabel: "Justin Inspection Required",
    });
    assert.ok(p);
    assert.equal(p?.scope, "optical");
    assert.match(p?.topSubline ?? "", /optical proportions/i);
    assert.equal(p?.betterThanPercent, undefined);
  });

  it("allows broad percentile for clean strong candidate", () => {
    const p = buildV3PercentilePresentation(96, {
      clarity: "VVS1",
      color: "F",
      purchaseLabel: "Strong Candidate",
    });
    assert.ok(p);
    assert.equal(p?.scope, "broad");
    assert.equal(p?.betterThanPercent, 96);
  });

  it("caps SI2 below Distinctive even with elite score", () => {
    assert.equal(
      resolveV3PublicTier({
        editorialTier: "Distinctive",
        displayScore: 99,
        canShowScore: true,
        clarity: "SI2",
      }),
      "Strong",
    );
    assert.equal(capV3PublicTier("Rare", "Strong"), "Strong");
  });

  it("allows VS1 Rare at high score", () => {
    assert.equal(
      resolveV3PublicTier({
        editorialTier: "Distinctive",
        displayScore: 99,
        canShowScore: true,
        clarity: "VS1",
      }),
      "Rare",
    );
    assert.equal(resolveGcal8xVisualTier(99, "VS1"), "Rare");
  });

  it("forces Outside Hourglass Standards hero for I2", () => {
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
  });
});

describe("resolveV3IncompleteAssessmentCopy", () => {
  it("uses proportion copy when usable color and clarity are present", () => {
    const copy = resolveV3IncompleteAssessmentCopy({
      color: "O to P Range",
      clarity: "SI2",
    });
    assert.equal(copy.kind, "proportion");
    assert.equal(copy.headline, "Proportion Detail Needed");
    assert.equal(copy.nextStep, "Confirm Missing Proportions");
    assert.equal(copy.missingDataLabel, "Outstanding Detail");
    assert.equal(copy.gradesConfirmed, "O to P Range color · SI2 clarity");
    assert.match(copy.subhead, /O to P Range color and SI2 clarity are confirmed/i);
    assert.doesNotMatch(copy.subhead, /color and clarity are needed/i);
    assert.match(copy.sectionBody, /proportion gap/i);
    assert.match(copy.technicalAppendixNote, /not 4Cs/i);
  });

  it("uses grade copy when color or clarity is missing", () => {
    const copy = resolveV3IncompleteAssessmentCopy({ color: "G" });
    assert.equal(copy.kind, "grade");
    assert.equal(copy.headline, "Clarity Grade Still Needed");
    assert.equal(copy.nextStep, "Confirm Clarity Grade");
    assert.equal(copy.missingDataLabel, "Missing Grades");
    assert.equal(copy.gradesConfirmed, null);
    assert.match(copy.subhead, /clarity grade/i);
    assert.doesNotMatch(copy.subhead, /color grade/i);
    assert.equal(
      resolveV3IncompleteMissingDataValue({ color: "G" }),
      "Clarity Grade",
    );
  });

  it("names both missing grades without implying parsed grades are absent", () => {
    const copy = resolveV3IncompleteAssessmentCopy({});
    assert.equal(copy.kind, "grade");
    assert.match(copy.subhead, /color grade and clarity grade/i);
    assert.equal(copy.missingDataValue, "Color Grade, Clarity Grade");
  });

  it("maps low confidence to proportion-specific confidence labels", () => {
    const copy = resolveV3IncompleteAssessmentCopy(
      { color: "G", clarity: "VS1" },
      { confidenceBand: "Low" },
    );
    assert.equal(copy.kind, "proportion");
    assert.equal(copy.confidenceLevel, "Limited Proportion Data");
    assert.equal(copy.opticalRead, "Preliminary");
    assert.equal(copy.recommendationStatus, "Partial Read — Proportion Detail Limited");
  });

  it("buildV3IncompleteTechnicalItems includes grades confirmed for proportion gaps", () => {
    const copy = resolveV3IncompleteAssessmentCopy({
      color: "G",
      clarity: "VS1",
    });
    const items = buildV3IncompleteTechnicalItems(copy);
    assert.equal(items[1]?.label, "Grades Confirmed");
    assert.equal(items[1]?.value, "G color · VS1 clarity");
    assert.equal(items[2]?.label, "Outstanding Detail");
  });
});

describe("resolveV3RenderPhase stranded report", () => {
  it("falls back to full when a report is loaded but full gates fail", () => {
    assert.equal(
      resolveV3RenderPhase({
        hasReport: true,
        partialGradeReview: false,
        canRenderFullResult: false,
      }),
      "full",
    );
  });
});

describe("shouldShowHourglassPerspective", () => {
  it("does not render for triple Excellent", () => {
    assert.equal(
      shouldShowHourglassPerspective({
        cutGrade: "Excellent",
        polish: "Excellent",
        symmetry: "Excellent",
      }),
      false,
    );
    assert.equal(
      shouldShowHourglassPerspective({
        cutGrade: "EX",
        polish: "EX",
        symmetry: "Excellent",
      }),
      false,
    );
  });

  it("renders when any present finish grade is below Excellent", () => {
    assert.equal(
      shouldShowHourglassPerspective({
        cutGrade: "Excellent",
        polish: "Very Good",
        symmetry: "Excellent",
      }),
      true,
    );
    assert.equal(
      shouldShowHourglassPerspective({
        cutGrade: "VG",
        polish: "Excellent",
        symmetry: "Excellent",
      }),
      true,
    );
    assert.equal(
      shouldShowHourglassPerspective({
        cutGrade: "Excellent",
        polish: "Excellent",
        symmetry: "Fair",
      }),
      true,
    );
  });

  it("does not render when grades are missing", () => {
    assert.equal(
      shouldShowHourglassPerspective({
        cutGrade: "",
        polish: undefined,
        symmetry: "Excellent",
      }),
      false,
    );
  });
});
