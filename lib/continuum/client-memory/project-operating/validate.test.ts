import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OPERATING_DETAIL_MAX_LENGTH } from "./fields";
import { validateOperatingDetailCorrection } from "./validate";

describe("operating-detail validation", () => {
  it("accepts allowlisted fields and trims blank to null", () => {
    const brief = validateOperatingDetailCorrection(
      "custom_design_brief",
      "  Three-stone engagement ring  ",
    );
    assert.deepEqual(brief, {
      ok: true,
      field: "custom_design_brief",
      value: "Three-stone engagement ring",
    });
    const cleared = validateOperatingDetailCorrection(
      "repair_condition_notes",
      "   ",
    );
    assert.deepEqual(cleared, {
      ok: true,
      field: "repair_condition_notes",
      value: null,
    });
    const missing = validateOperatingDetailCorrection(
      "repair_requested_service",
      null,
    );
    assert.deepEqual(missing, {
      ok: true,
      field: "repair_requested_service",
      value: null,
    });
  });

  it("rejects arbitrary field names and pathological input", () => {
    assert.equal(
      validateOperatingDetailCorrection("design_brief", "ok").ok,
      false,
    );
    assert.equal(
      validateOperatingDetailCorrection("finger_size", "6.5").ok,
      false,
    );
    assert.equal(
      validateOperatingDetailCorrection("project_kind", "custom_new_jewelry").ok,
      false,
    );
    assert.equal(
      validateOperatingDetailCorrection("custom_design_brief", 1).ok,
      false,
    );
    assert.equal(
      validateOperatingDetailCorrection(
        "custom_design_brief",
        "x".repeat(OPERATING_DETAIL_MAX_LENGTH + 1),
      ).ok,
      false,
    );
    assert.equal(
      validateOperatingDetailCorrection("repair_technical_notes", "ok\u0000no")
        .ok,
      false,
    );
  });
});
