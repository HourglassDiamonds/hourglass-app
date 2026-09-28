import assert from "node:assert/strict";
import test from "node:test";
import type { ConciergeSolAnswer } from "../concierge-sol/types";
import { resultFromAnswer } from "./runner";
import type { EvalFixture } from "./types";

const fixture: EvalFixture = { id: "known-spec", category: "project-recall", description: "Known spec", query: "size?", expected: { allTools: ["get_project_specs"], textIncludes: ["12.5"], textExcludes: ["definitely 11"] } };

function answer(overrides: Partial<ConciergeSolAnswer> = {}): ConciergeSolAnswer {
  return { kind: "conversation", mode: "conversation", text: "Canonical size is 12.5; 11 is pending.", actions: [], brainDump: null, writesCanonical: false, telemetry: { requestModel: "gpt-6-sol", brain: "sol", promptTokens: 10, completionTokens: 8, latencyMs: 42, toolCount: 1, toolNames: ["get_project_specs"] }, ...overrides };
}

test("result plumbing preserves telemetry and explicit checks", () => {
  const result = resultFromAnswer(fixture, "gpt-6-sol", answer());
  assert.equal(result.checks.passed, true);
  assert.equal(result.inputTokens, 10);
  assert.equal(result.model, "gpt-6-sol");
  assert.equal(result.modelUsed, "gpt-6-sol");
  assert.deepEqual(result.toolNames, ["get_project_specs"]);
  assert.deepEqual(result.humanReview, { correctness: null, judgment: null, usefulness: null, trustworthiness: null, notes: null });
});

test("a production fallback cannot pass as model output", () => {
  const base = answer();
  const fallback = answer({ telemetry: { ...base.telemetry, brain: "fallback" } });
  const result = resultFromAnswer(fixture, "gpt-6-sol", fallback);
  assert.equal(result.checks.inferenceSucceeded, false);
  assert.equal(result.checks.passed, false);
  assert.equal(result.error, "model-inference-fell-back");
});

test("unsupported claims and canonical writes fail independently", () => {
  const unsafe = { ...answer({ text: "Definitely 11" }), writesCanonical: true } as unknown as ConciergeSolAnswer;
  const result = resultFromAnswer(fixture, "gpt-6-sol", unsafe);
  assert.equal(result.checks.unsupportedClaim, false);
  assert.equal(result.checks.noCanonicalWrites, false);
  assert.equal(result.checks.passed, false);
});
