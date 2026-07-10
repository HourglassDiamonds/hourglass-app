import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { migrateLegacyCalibration } from "./card-calibration";
import { normalizeGuidedStep } from "./types";

describe("shape-studio scaled preview journey steps", () => {
  it("normalizes legacy confirm-card and mark-finger into the public flow", () => {
    assert.equal(normalizeGuidedStep("confirm-card"), "mark-seat");
    assert.equal(normalizeGuidedStep("mark-finger"), "mark-seat");
    assert.equal(normalizeGuidedStep("photo-ready"), "mark-card");
  });

  it("preserves the live Scaled Preview steps", () => {
    assert.equal(normalizeGuidedStep("mark-card"), "mark-card");
    assert.equal(normalizeGuidedStep("mark-seat"), "mark-seat");
    assert.equal(normalizeGuidedStep("frame"), "frame");
    assert.equal(normalizeGuidedStep("calibrated-preview"), "calibrated-preview");
  });

  it("never leaves confirm-card as a public renderable step name", () => {
    assert.equal(normalizeGuidedStep("confirm-card"), "mark-seat");
    assert.notEqual(normalizeGuidedStep("confirm-card"), "confirm-card");
  });

  it("migrates legacy confirm-card state to mark-seat with seat seeds", () => {
    const migrated = migrateLegacyCalibration({
      step: "confirm-card",
      cardA: { u: 0.2, v: 0.7 },
      cardB: { u: 0.5, v: 0.7 },
      fingerL: null,
      fingerR: null,
      framing: { centerU: 0.5, centerV: 0.5, cropWidthU: 0.4 },
      cardStillInFrame: true,
    });
    assert.equal(migrated.step, "mark-seat");
    assert.ok(migrated.fingerL);
    assert.ok(migrated.fingerR);
    assert.equal(migrated.framing, null);
    assert.equal(migrated.cardStillInFrame, undefined);
  });
});
