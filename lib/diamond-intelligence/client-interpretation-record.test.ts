import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyReportFields } from "@/lib/calibration-library/fields";
import { buildClientInterpretationSnapshot } from "./client-interpretation-record";

describe("buildClientInterpretationSnapshot", () => {
  it("preserves extracted fields when client adds missing values", () => {
    const extracted = emptyReportFields({
      shape: "Round Brilliant",
      tablePercent: "58",
    });
    const snap = buildClientInterpretationSnapshot({
      extractedFields: extracted,
      clientCompletedFields: { depthPercent: "61.1" },
    });
    assert.equal(snap.extractedFields.depthPercent, "");
    assert.equal(snap.clientCompletedFields.depthPercent, "61.1");
    assert.equal(snap.interpretationFields.depthPercent, "61.1");
    assert.equal(snap.fieldAttribution.depthPercent?.source, "client-entered");
    assert.equal(snap.excludedFromCalibrationStats, true);
  });

  it("does not overwrite extracted values without confirmation", () => {
    const extracted = emptyReportFields({ tablePercent: "58" });
    const snap = buildClientInterpretationSnapshot({
      extractedFields: extracted,
      clientCompletedFields: { tablePercent: "60" },
    });
    assert.equal(snap.interpretationFields.tablePercent, "58");
    assert.equal(snap.clientCompletedFields.tablePercent, "60");
  });

  it("allows overwrite when explicitly confirmed", () => {
    const extracted = emptyReportFields({ tablePercent: "58" });
    const snap = buildClientInterpretationSnapshot({
      extractedFields: extracted,
      clientCompletedFields: { tablePercent: "60" },
      confirmedOverwrites: { tablePercent: true },
    });
    assert.equal(snap.interpretationFields.tablePercent, "60");
  });
});
