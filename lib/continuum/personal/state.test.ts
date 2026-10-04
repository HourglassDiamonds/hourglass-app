import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePersonalState } from "./state";

describe("personal browser persistence", () => {
  it("falls back safely for corrupt state", () => { const state = parsePersonalState("not-json"); assert.equal(state.version, 1); assert.equal(state.plans.length, 7); });
  it("does not discard valid saved logs", () => { const saved = parsePersonalState(JSON.stringify({ version: 1, foodEntries: [{ id: "meal" }], sessions: [], proposals: [], bodyMeasurements: [] })); assert.equal(saved.foodEntries[0]?.id, "meal"); assert.equal(saved.plans.length, 7); });
});
