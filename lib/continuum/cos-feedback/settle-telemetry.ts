/**
 * One privacy-safe settle event. Hashes and sizes only.
 * No names, prose, source refs, dates, or model text.
 */

import { createHash } from "node:crypto";

export const COS_FEEDBACK_SETTLE_EVENT = "continuum.cos_feedback.settle" as const;

export const COS_FEEDBACK_SETTLE_FIELDS = [
  "event",
  "feedbackContract",
  "provider",
  "model",
  "outcome",
  "cache",
  "modelInvoked",
  "toolsSent",
  "latencyMs",
  "inputBytes",
  "outputBytes",
  "validationResult",
  "responseFormat",
  "sourceWatermarkDigest",
  "portfolioDigest",
] as const;

export type CosFeedbackSettleOutcome =
  | "model_accepted"
  | "deterministic_fallback"
  | "cache_hit"
  | "model_unavailable";

export type CosFeedbackValidationResult =
  | "accepted"
  | "invented_date"
  | "scheduled_claim"
  | "hidden_due_work"
  | "priority_violation"
  | "parse_failure"
  | "provider_error"
  | "timeout"
  | "missing_key";

export type CosFeedbackSettleRoute = {
  provider: "openai";
  model: string;
};

export type CosFeedbackSettleEvent = {
  event: typeof COS_FEEDBACK_SETTLE_EVENT;
  feedbackContract: "cos-feedback-v1";
  provider: "openai" | null;
  model: string | null;
  outcome: CosFeedbackSettleOutcome;
  cache: "hit" | "miss";
  modelInvoked: boolean;
  toolsSent: false;
  latencyMs: number | null;
  inputBytes: number | null;
  outputBytes: number | null;
  validationResult: CosFeedbackValidationResult | null;
  responseFormat: "json_schema" | null;
  sourceWatermarkDigest: string;
  portfolioDigest: string;
};

export function shortDigest(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function emitCosFeedbackSettle(event: CosFeedbackSettleEvent): void {
  const line: Record<string, string | number | boolean | null> = {};
  for (const key of COS_FEEDBACK_SETTLE_FIELDS) {
    line[key] = key === "toolsSent" ? false : event[key] ?? null;
  }
  console.info(JSON.stringify(line));
}
