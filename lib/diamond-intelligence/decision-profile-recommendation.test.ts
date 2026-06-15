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
  it("I1, I2, and I3 cannot remain Strong Candidate", () => {
    for (const clarity of ["I1", "I2", "I3"] as const) {
      const band = applyRecommendationCeilings("Strong Candidate", {
        risk: clarity === "I1" ? "Elevated" : "High",
        ctx: fullCtx(),
        hints: { clarity },
        confidenceBand: "High",
      });
      assert.equal(band, "Not Recommended", clarity);
    }
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

  it("I1 returns Not Recommended even when confidence is Low", () => {
    const band = deriveBaseRecommendation({
      optical: "Strong",
      visual: "Balanced presence",
      risk: "Elevated",
      ctx: fullCtx(95),
      hints: { clarity: "I1" },
      confidenceBand: "Low",
    });
    assert.equal(band, "Not Recommended");
  });
});
