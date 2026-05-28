import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildBalanceProfileAxes, spreadProfileValue } from "./client-balance-profile";

describe("buildBalanceProfileAxes", () => {
  it("marks diagram-sensitive traits uncertain when fill is zero", () => {
    const axes = buildBalanceProfileAxes({
      clientScore: {
        eligible: true,
        overall: 89,
        bandLabel: "",
        summaryLine: "",
        lightTraits: [
          { label: "Brightness", level: "Strong", fillPercent: 88 },
          { label: "Fire", level: "Strong", fillPercent: 90 },
          { label: "Contrast", level: "Balanced", fillPercent: 84 },
          { label: "Scintillation", level: "Needs review", fillPercent: 0 },
          { label: "Leakage control", level: "Needs review", fillPercent: 0 },
        ],
      },
      overallScore: 89,
      spread: { value: 78, uncertain: false },
    });
    const leakage = axes.find((a) => a.key === "leakage");
    assert.equal(leakage?.uncertain, true);
    assert.equal(leakage?.value, null);
  });
});

describe("spreadProfileValue", () => {
  it("does not use percentile language", () => {
    const r = spreadProfileValue({ avgDiameterMm: 8.1, carat: "2.0" });
    assert.ok(r.value === null || r.value <= 100);
  });
});
