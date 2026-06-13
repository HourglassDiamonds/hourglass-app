import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";
import type { ReportFieldKey } from "@/lib/calibration-library/types";
import { shouldPresentScoredCoreRead } from "./client-presentation-gates";

function fields(overrides: Partial<Record<ReportFieldKey, string>>) {
  const base = Object.fromEntries(REPORT_FIELD_KEYS.map((k) => [k, ""]));
  return { ...base, ...overrides };
}

describe("shouldPresentScoredCoreRead", () => {
  it("returns true when core score fields and usable grades are present", () => {
    assert.equal(
      shouldPresentScoredCoreRead({
        fields: fields({
          tablePercent: "57",
          depthPercent: "62.3",
          crownAngle: "36",
          pavilionAngle: "40.8",
        }),
        gradeHints: { color: "Q to R Range", clarity: "VVS1" },
      }),
      true,
    );
  });

  it("returns false when crown angle is missing", () => {
    assert.equal(
      shouldPresentScoredCoreRead({
        fields: fields({
          tablePercent: "59",
          depthPercent: "60.8",
          pavilionAngle: "41",
        }),
        gradeHints: { color: "G", clarity: "VS1" },
      }),
      false,
    );
  });

  it("returns false when color is unusable", () => {
    assert.equal(
      shouldPresentScoredCoreRead({
        fields: fields({
          tablePercent: "57",
          depthPercent: "62.3",
          crownAngle: "36",
          pavilionAngle: "40.8",
        }),
        gradeHints: { color: "", clarity: "VVS1" },
      }),
      false,
    );
  });
});
