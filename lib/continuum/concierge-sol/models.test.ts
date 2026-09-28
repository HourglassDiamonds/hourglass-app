import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { conciergeForegroundModel, isConciergeForegroundModel, isApprovedSolModel } from "./models";
import { getConciergeForegroundModelOverride } from "./env";

describe("foreground Sol model routing", () => {
  it("keeps GPT-5.6 Sol as the default and preserves the legacy alias", () => {
    for (const input of [undefined, null, "", "  ", "gpt-5.6", "gpt-5.6-sol"]) {
      assert.equal(conciergeForegroundModel(input), "gpt-5.6-sol");
    }
  });
  it("accepts GPT-6 Sol through the environment override path", () => {
    const previous = process.env.CONTINUUM_CONCIERGE_MODEL;
    try {
      process.env.CONTINUUM_CONCIERGE_MODEL = " gpt-6-sol ";
      assert.equal(conciergeForegroundModel(getConciergeForegroundModelOverride()), "gpt-6-sol");
    } finally {
      if (previous === undefined) delete process.env.CONTINUUM_CONCIERGE_MODEL;
      else process.env.CONTINUUM_CONCIERGE_MODEL = previous;
    }
  });
  it("blocks Astra and arbitrary models", () => {
    for (const model of ["gpt-6-astra", "GPT-ASTRA-mini", "gpt-6-sol-astra", "other", "gpt-6", "gpt-5.6-sol-unapproved"]) {
      assert.equal(conciergeForegroundModel(model), "gpt-5.6-sol");
      assert.equal(isConciergeForegroundModel(model), false);
      assert.equal(isApprovedSolModel(model), false);
    }
    assert.equal(isConciergeForegroundModel("gpt-6-sol"), true);
    assert.equal(isApprovedSolModel("gpt-6-sol"), true);
    assert.equal(isApprovedSolModel("gpt-5.6"), true);
    assert.equal(isConciergeForegroundModel(" gpt-6-sol "), false);
  });
});
