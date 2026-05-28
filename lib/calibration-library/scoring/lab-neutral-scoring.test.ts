import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyReportFields } from "../fields";
import { scoreRoundBrilliant } from "./round-brilliant";
import {
  buildProportionDesignFingerprint,
  buildScoringDriverFingerprint,
  SCORING_METADATA_ONLY_KEYS,
} from "./scoring-inputs";

const BASE_PROPORTIONS = emptyReportFields({
  shape: "Round Brilliant",
  tablePercent: "57",
  depthPercent: "61",
  crownAngle: "34.5",
  pavilionAngle: "40.8",
  lowerHalfPercent: "77",
  starLengthPercent: "50",
  girdle: "Medium, Faceted",
  culet: "None",
  polish: "Excellent",
  symmetry: "Excellent",
  fluorescence: "None",
});

function scoreOverall(fields: ReturnType<typeof emptyReportFields>) {
  const result = scoreRoundBrilliant(fields);
  assert.equal(result.eligible, true, result.ineligibleReason);
  return result.overall;
}

test("cutGrade is metadata-only and not a scoring driver key", () => {
  assert.ok(SCORING_METADATA_ONLY_KEYS.includes("cutGrade"));
  const withCut = { ...BASE_PROPORTIONS, cutGrade: "Excellent" };
  const without = { ...BASE_PROPORTIONS, cutGrade: "" };
  const tripleEx = {
    ...BASE_PROPORTIONS,
    cutGrade: "Triple Excellent",
    polish: "Excellent",
    symmetry: "Excellent",
  };
  const eightX = { ...BASE_PROPORTIONS, cutGrade: "GCAL 8X Excellent" };

  const base = scoreOverall(BASE_PROPORTIONS);
  assert.equal(scoreOverall(withCut), base);
  assert.equal(scoreOverall(without), base);
  assert.equal(scoreOverall(tripleEx), base);
  assert.equal(scoreOverall(eightX), base);
});

test("same scoring drivers produce same LP score regardless of lab metadata context", () => {
  const gia = scoreOverall(BASE_PROPORTIONS);
  const gcal = scoreOverall({ ...BASE_PROPORTIONS });
  const igi = scoreOverall({ ...BASE_PROPORTIONS });
  assert.equal(gia, gcal);
  assert.equal(gcal, igi);
});

test("matching proportion design inputs match when all scoring drivers match", () => {
  const a = BASE_PROPORTIONS;
  const b = {
    ...BASE_PROPORTIONS,
    cutGrade: "Ideal",
    carat: "2.01",
    measurements: "8.00 x 8.02 x 4.90 mm",
  };
  assert.equal(
    buildProportionDesignFingerprint(a),
    buildProportionDesignFingerprint(b),
  );
  assert.equal(
    buildScoringDriverFingerprint(a),
    buildScoringDriverFingerprint(b),
  );
  assert.equal(scoreOverall(a), scoreOverall(b));
});

test("triple excellent wording in cutGrade alone does not boost score", () => {
  const baseline = scoreOverall(BASE_PROPORTIONS);
  const tripleExCutOnly = scoreOverall({
    ...BASE_PROPORTIONS,
    cutGrade: "Triple Excellent",
  });
  assert.equal(tripleExCutOnly, baseline);
});

test("missing cutGrade does not lower score vs excellent cutGrade", () => {
  const withGrade = scoreOverall({
    ...BASE_PROPORTIONS,
    cutGrade: "Excellent",
  });
  const missing = scoreOverall({
    ...BASE_PROPORTIONS,
    cutGrade: "",
  });
  assert.equal(withGrade, missing);
});

test("finish driver differences can change score — surfaced as note not lab identity", () => {
  const full = scoreOverall(BASE_PROPORTIONS);
  const noPolish = scoreOverall({
    ...BASE_PROPORTIONS,
    polish: "",
    symmetry: "",
  });
  assert.notEqual(
    buildScoringDriverFingerprint(BASE_PROPORTIONS),
    buildScoringDriverFingerprint({
      ...BASE_PROPORTIONS,
      polish: "",
      symmetry: "",
    }),
  );
  assert.ok(
    full !== noPolish,
    "reported finish lines affect finish component; lab identity does not",
  );
});
