import { runConciergeSol } from "../concierge-sol/runtime";
import type { ConciergeSolAnswer } from "../concierge-sol/types";
import { answerShapeIsValid, emptyHumanReview, type EvalCaseResult, type EvalDependencies, type EvalFixture, type EvalReport } from "./types";

export async function runContinuumModelEval(input: { fixtures: readonly EvalFixture[]; models: readonly string[]; dependencies: EvalDependencies }): Promise<EvalReport> {
  const results: EvalCaseResult[] = [];
  for (const fixture of input.fixtures) {
    for (const model of input.models) results.push(await runCase(fixture, model, input.dependencies));
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    models: [...input.models],
    fixtureCount: input.fixtures.length,
    categories: [...new Set(input.fixtures.map((row) => row.category))].sort(),
    safety: { canonicalWritesAllowed: false, fixtureWorldOnly: true },
    results,
  };
}

async function runCase(fixture: EvalFixture, model: string, dependencies: EvalDependencies): Promise<EvalCaseResult> {
  try {
    const answer = await runConciergeSol({ query: fixture.query, mode: fixture.mode, world: dependencies.worldFactory(), brain: dependencies.brainFactory(model), now: dependencies.now });
    return resultFromAnswer(fixture, model, answer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown-error";
    return { fixtureId: fixture.id, category: fixture.category, description: fixture.description, query: fixture.query, model, modelUsed: model, brain: "none", response: "", latencyMs: 0, inputTokens: null, outputTokens: null, toolCount: 0, toolNames: [], checks: { inferenceSucceeded: false, groundedCorrect: false, expectedTools: false, unsupportedClaim: false, structuredOutputValid: false, noCanonicalWrites: false, passed: false }, humanReview: emptyHumanReview(), error: message };
  }
}

export function resultFromAnswer(fixture: EvalFixture, requestedModel: string, answer: ConciergeSolAnswer): EvalCaseResult {
  const names = answer.telemetry.toolNames;
  const expectedTools = (fixture.expected.anyTools?.length ? fixture.expected.anyTools.some((name) => names.includes(name)) : true) && (fixture.expected.allTools ?? []).every((name) => names.includes(name)) && !(fixture.expected.forbiddenTools ?? []).some((name) => names.includes(name));
  const lower = answer.text.toLowerCase();
  const groundedCorrect = (fixture.expected.textIncludes ?? []).every((text) => lower.includes(text.toLowerCase()));
  const unsupportedClaim = !(fixture.expected.textExcludes ?? []).some((text) => lower.includes(text.toLowerCase()));
  const structuredOutputValid = answerShapeIsValid(answer) && (!fixture.expected.structuredCapture || Boolean(answer.brainDump && answer.brainDump.persist === false && answer.brainDump.note));
  const noCanonicalWrites = answer.writesCanonical === false && (!answer.brainDump || answer.brainDump.persist === false);
  const inferenceSucceeded = answer.telemetry.brain === "sol";
  const checks = { inferenceSucceeded, groundedCorrect, expectedTools, unsupportedClaim, structuredOutputValid, noCanonicalWrites, passed: inferenceSucceeded && groundedCorrect && expectedTools && unsupportedClaim && structuredOutputValid && noCanonicalWrites };
  return { fixtureId: fixture.id, category: fixture.category, description: fixture.description, query: fixture.query, model: requestedModel, modelUsed: answer.telemetry.requestModel || requestedModel, brain: answer.telemetry.brain, response: answer.text, latencyMs: answer.telemetry.latencyMs, inputTokens: answer.telemetry.promptTokens, outputTokens: answer.telemetry.completionTokens, toolCount: answer.telemetry.toolCount, toolNames: [...names], checks, humanReview: emptyHumanReview(), error: inferenceSucceeded ? null : "model-inference-fell-back" };
}
