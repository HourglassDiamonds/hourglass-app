import assert from "node:assert/strict";
import test from "node:test";
import { CONTINUUM_MODEL_EVAL_FIXTURES, validateEvalFixtures } from "./fixtures";

test("fixture catalog is complete, unique, and valid", () => {
  assert.equal(CONTINUUM_MODEL_EVAL_FIXTURES.length, 28);
  assert.deepEqual(validateEvalFixtures(CONTINUUM_MODEL_EVAL_FIXTURES), []);
  assert.ok(new Set(CONTINUUM_MODEL_EVAL_FIXTURES.map((row) => row.category)).size >= 13);
});

test("fixture catalog includes the canonical messy founder example", () => {
  assert.ok(CONTINUUM_MODEL_EVAL_FIXTURES.some((row) => row.query.includes("Vincent") && row.query.includes("curing Nate's resin")));
});

test("validation rejects unknown tools and invalid capture modes", () => {
  const fixture = { ...CONTINUUM_MODEL_EVAL_FIXTURES[0]!, id: "bad id", mode: "conversation" as const, expected: { allTools: ["write_everything"], structuredCapture: true } };
  assert.equal(validateEvalFixtures([fixture]).length, 3);
});
