import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HOURGLASS_CLARITY_STANDARDS,
  hourglassClarityStandardsNote,
  isBelowHourglassClarityStandard,
} from "./hourglass-clarity-standards";

describe("hourglass clarity standards", () => {
  it("identifies I1, I2, and I3 as below standard", () => {
    assert.equal(isBelowHourglassClarityStandard("I1"), true);
    assert.equal(isBelowHourglassClarityStandard("I2"), true);
    assert.equal(isBelowHourglassClarityStandard("I3"), true);
    assert.equal(isBelowHourglassClarityStandard("SI2"), false);
  });

  it("includes advisory that this is not a lab grade dispute", () => {
    const note = hourglassClarityStandardsNote("I2");
    assert.ok(note);
    assert.match(note!, /Hourglass clarity standards/i);
    assert.match(note!, /not a dispute of the laboratory grade/i);
    assert.equal(note, HOURGLASS_CLARITY_STANDARDS.advisory);
  });
});
