import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { needsGcalSarineDiagramProportionOcrWait } from "./gcal-sarine-diagram-proportion-wait";
import { GCAL360796191_TEXT_LAYER } from "./fixtures/gcal360796191";

describe("needsGcalSarineDiagramProportionOcrWait", () => {
  it("returns true for GCAL Sarine text layer with grades but no core proportions", () => {
    assert.equal(
      needsGcalSarineDiagramProportionOcrWait({
        fields: {
          shape: "Round Brilliant",
          carat: "1.00",
          measurements: "6.43 - 6.46 x 3.94 mm",
          fluorescence: "None",
          tablePercent: "",
          depthPercent: "",
          crownAngle: "",
          pavilionAngle: "",
        },
        combinedText: GCAL360796191_TEXT_LAYER,
        parserType: "gcal-sarine-4cs",
        lab: "GCAL",
      }),
      true,
    );
  });

  it("returns false when core proportions already present", () => {
    assert.equal(
      needsGcalSarineDiagramProportionOcrWait({
        fields: {
          shape: "Round Brilliant",
          carat: "1.00",
          tablePercent: "57",
          depthPercent: "61.2",
          crownAngle: "34",
          pavilionAngle: "40.8",
        },
        combinedText: GCAL360796191_TEXT_LAYER,
        parserType: "gcal-sarine-4cs",
        lab: "GCAL",
      }),
      false,
    );
  });

  it("returns false for non-GCAL Sarine reports", () => {
    assert.equal(
      needsGcalSarineDiagramProportionOcrWait({
        fields: { shape: "Round", carat: "1.0" },
        combinedText: "GIA report text",
        parserType: "gia-modern",
        lab: "GIA",
      }),
      false,
    );
  });
});
