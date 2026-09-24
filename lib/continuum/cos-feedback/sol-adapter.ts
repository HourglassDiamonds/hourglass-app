/**
 * Server-only Sol adapter for Chief of Staff feedback.
 * Uses the existing Concierge key and gpt-5.6-sol route.
 * No tools. No client bundle.
 */

import "server-only";

import {
  getConciergeForegroundModelOverride,
  getConciergeOpenAiApiKey,
} from "@/lib/continuum/concierge-sol/env";
import { conciergeForegroundModel } from "@/lib/continuum/concierge-sol/models";
import type { CosFeedbackModel } from "./feedback";
import { requestCosFeedbackCompletion } from "./sol-request";

export function cosFeedbackSolRoute(): { provider: "openai"; model: string } | null {
  if (!getConciergeOpenAiApiKey()) return null;
  return {
    provider: "openai",
    model: conciergeForegroundModel(getConciergeForegroundModelOverride()),
  };
}

export function cosFeedbackSolModel(): CosFeedbackModel | null {
  const apiKey = getConciergeOpenAiApiKey();
  if (!apiKey) return null;
  const model = conciergeForegroundModel(getConciergeForegroundModelOverride());
  return (packet) => requestCosFeedbackCompletion({ apiKey, model, packet });
}
