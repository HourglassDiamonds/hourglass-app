import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyReportFields } from "@/lib/calibration-library/fields";
import { presentClientInterpretationScore } from "./client-score-present";

describe("presentClientInterpretationScore", () => {
  it("uses client-safe summary without calibration wording", () => {
    const result = presentClientInterpretationScore(
      emptyReportFields({
        shape: "Round Brilliant",
        tablePercent: "58",
        depthPercent: "61",
        crownAngle: "34.5",
        pavilionAngle: "40.8",
        polish: "Excellent",
        symmetry: "Excellent",
        fluorescence: "None",
      }),
      "proportion",
    );
    assert.equal(result.eligible, true);
    assert.doesNotMatch(result.summaryLine, /calibration|corpus|parser/i);
    assert.match(result.summaryLine, /not an official lab grade/i);
  });
});
