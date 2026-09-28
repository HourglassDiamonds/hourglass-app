import type { ConciergeSolMode, ConciergeSolAnswer, ReasoningBrain } from "../concierge-sol/types";
import type { ConciergeSolWorld } from "../concierge-sol/world";

export const CONTINUUM_EVAL_MODELS = ["gpt-5.6-sol", "gpt-6-sol"] as const;
export type ContinuumEvalModel = (typeof CONTINUUM_EVAL_MODELS)[number];

export type EvalFixture = {
  id: string;
  category: string;
  description: string;
  query: string;
  mode?: ConciergeSolMode;
  expected: {
    anyTools?: readonly string[];
    allTools?: readonly string[];
    forbiddenTools?: readonly string[];
    textIncludes?: readonly string[];
    textExcludes?: readonly string[];
    structuredCapture?: boolean;
  };
};

export type EvalChecks = {
  inferenceSucceeded: boolean;
  groundedCorrect: boolean;
  expectedTools: boolean;
  unsupportedClaim: boolean;
  structuredOutputValid: boolean;
  noCanonicalWrites: boolean;
  passed: boolean;
};

export type HumanReview = {
  correctness: number | null;
  judgment: number | null;
  usefulness: number | null;
  trustworthiness: number | null;
  notes: string | null;
};

export type EvalCaseResult = {
  fixtureId: string;
  category: string;
  description: string;
  query: string;
  model: string;
  modelUsed: string;
  brain: "sol" | "fallback" | "none";
  response: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  toolCount: number;
  toolNames: readonly string[];
  checks: EvalChecks;
  humanReview: HumanReview;
  error: string | null;
};

export type EvalReport = {
  schemaVersion: 1;
  generatedAt: string;
  models: readonly string[];
  fixtureCount: number;
  categories: readonly string[];
  safety: { canonicalWritesAllowed: false; fixtureWorldOnly: true };
  results: EvalCaseResult[];
};

export type EvalDependencies = {
  worldFactory: () => ConciergeSolWorld;
  brainFactory: (model: string) => ReasoningBrain;
  now?: Date;
};

export function emptyHumanReview(): HumanReview {
  return { correctness: null, judgment: null, usefulness: null, trustworthiness: null, notes: null };
}

export function answerShapeIsValid(answer: ConciergeSolAnswer): boolean {
  return answer.kind === "conversation" && typeof answer.text === "string" && answer.text.length > 0;
}
