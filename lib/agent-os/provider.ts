/**
 * Model/provider interface for Agent OS.
 *
 * V1: no OpenAI/AI SDK dependency in this repository.
 * Deterministic synthesis is the production path.
 * A future LLM layer can implement AgentOsSynthesisProvider without
 * changing evidence, ranking, or permission boundaries.
 */

import type { FounderBrief } from "./types";

export type SynthesisContext = {
  /** Already redacted, approved aggregate context only */
  approvedContext: string;
  deterministicBrief: FounderBrief;
};

export type AgentOsSynthesisProvider = {
  id: string;
  synthesizeFounderBrief(ctx: SynthesisContext): Promise<FounderBrief>;
};

/** Default V1 provider — returns the deterministic brief unchanged. */
export const deterministicSynthesisProvider: AgentOsSynthesisProvider = {
  id: "deterministic-v1",
  async synthesizeFounderBrief(ctx) {
    return ctx.deterministicBrief;
  },
};

/**
 * Future hook: wrap an LLM that must:
 * - require structured output
 * - validate against FounderBrief fields
 * - never invent evidence
 * - receive only approved redacted context
 * - fall back to deterministicBrief on failure
 */
export function createPassthroughLlmStub(): AgentOsSynthesisProvider {
  return {
    id: "llm-stub-not-installed",
    async synthesizeFounderBrief(ctx) {
      return {
        ...ctx.deterministicBrief,
        markdown:
          ctx.deterministicBrief.markdown +
          "\n\n_Note: LLM synthesis is not installed; deterministic brief used._\n",
      };
    },
  };
}
