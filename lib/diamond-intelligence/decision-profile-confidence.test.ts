import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";
import type { ReportFieldKey } from "@/lib/calibration-library/types";
import { buildDecisionConfidence } from "./decision-profile-confidence";
import { buildDiamondInterpretationContext } from "./client-interpretation-context";
import { assessReportCapability } from "./report-capability";

function fields(overrides: Partial<Record<ReportFieldKey, string>>) {
  const base = Object.fromEntries(REPORT_FIELD_KEYS.map((k) => [k, ""]));
  return { ...base, ...overrides };
}

describe("buildDecisionConfidence", () => {
  it("full proportions yield High confidence", () => {
    const f = fields({
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
    const ctx = buildDiamondInterpretationContext({ fields: f, rawScore: 92 });
    const cap = assessReportCapability({ fields: f });
    const { internalCalibrationEligible: _i, ...clientCap } = cap;
    const c = buildDecisionConfidence({ context: ctx, capability: clientCap });
    assert.equal(c.band, "High");
  });
});
