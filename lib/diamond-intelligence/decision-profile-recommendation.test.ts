import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReportFieldKey } from "@/lib/calibration-library/types";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";
import {
  applyRecommendationCeilings,
  deriveBaseRecommendation,
  mergeRiskBand,
} from "./decision-profile-recommendation";
import { buildDiamondInterpretationContext } from "./client-interpretation-context";

function fullCtx(rawScore = 90) {
  const fields = Object.fromEntries(
    REPORT_FIELD_KEYS.map((k) => [k, ""]),
  ) as Record<ReportFieldKey, string>;
  Object.assign(fields, {
    shape: "Round",
    carat: "1.00",
    measurements: "6.50 - 6.52 x 4.00",
    tablePercent: "57",
    depthPercent: "61.5",
    crownAngle: "34.5",
    pavilionAngle: "40.8",
    polish: "Excellent",
    symmetry: "Excellent",
    fluorescence: "None",
  });
  return buildDiamondInterpretationContext({ fields, rawScore });
}

describe("mergeRiskBand", () => {
  it("I2 never stays Low", () => {
    assert.equal(mergeRiskBand("Low", { clarity: "I2" }), "High");
  });
});

describe("applyRecommendationCeilings", () => {
  it("I2 cannot remain Strong Candidate", () => {
    const band = applyRecommendationCeilings("Strong Candidate", {
      risk: "High",
      ctx: fullCtx(),
      hints: { clarity: "I2" },
      confidenceBand: "High",
    });
    assert.notEqual(band, "Strong Candidate");
    assert.equal(band, "Compare Carefully");
  });
});

describe("deriveBaseRecommendation", () => {
  it("moderate optics with low risk can still be strong candidate", () => {
    const band = deriveBaseRecommendation({
      optical: "Moderate",
      visual: "Balanced presence",
      risk: "Low",
      ctx: fullCtx(),
      hints: { clarity: "VS1" },
      confidenceBand: "High",
    });
    assert.equal(band, "Strong Candidate");
  });

  it("SI2 with strong optics is worth reviewing not strong candidate", () => {
    const band = deriveBaseRecommendation({
      optical: "Strong",
      visual: "Balanced presence",
      risk: "Moderate",
      ctx: fullCtx(),
      hints: { clarity: "SI2" },
      confidenceBand: "High",
    });
    assert.equal(band, "Worth Reviewing");
  });
});
