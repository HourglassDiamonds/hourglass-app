import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateProjectSpecCorrection } from "./validate";

describe("project spec field validation", () => {
  it("accepts realistic jewelry sizes including uncommon large and quarter sizes", () => {
    for (const value of ["1", "6.5", "6.25", "6.75", "6.50", "16", "20", "24", "30"]) {
      const result = validateProjectSpecCorrection("finger_size", value);
      assert.equal(result.ok, true, value);
      if (result.ok) assert.equal(result.value, value);
    }
  });

  it("rejects 141 and other order-like finger sizes without transforming them", () => {
    for (const value of ["141", "140", "14.1", "14.10", "6.2", "0", "31", "80", "6,5"]) {
      const result = validateProjectSpecCorrection("finger_size", value);
      assert.equal(result.ok, false, value);
      if (!result.ok) assert.equal(result.reason, "implausible-finger-size");
    }
  });

  it("treats order and CAD values as identifiers, not arithmetic", () => {
    const order = validateProjectSpecCorrection("order_number", "140");
    assert.equal(order.ok, true);
    if (order.ok) assert.equal(order.value, "140");
    const cad = validateProjectSpecCorrection("cad_job_number", "  CAD-140  ");
    assert.equal(cad.ok, true);
    if (cad.ok) assert.equal(cad.value, "CAD-140");
  });

  it("preserves metal and stone vocabulary without normalizing case", () => {
    const metal = validateProjectSpecCorrection("metal", "Platinum");
    assert.equal(metal.ok, true);
    if (metal.ok) assert.equal(metal.value, "Platinum");
    const stone = validateProjectSpecCorrection("center_stone", "oval");
    assert.equal(stone.ok, true);
    if (stone.ok) assert.equal(stone.value, "oval");
  });

  it("rejects unknown fields and empty values", () => {
    const unknown = validateProjectSpecCorrection("gmail_thread_id", "thread");
    assert.equal(unknown.ok, false);
    if (!unknown.ok) assert.equal(unknown.reason, "invalid-field");
    const empty = validateProjectSpecCorrection("finger_size", "  ");
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.equal(empty.reason, "invalid-value");
  });
});
