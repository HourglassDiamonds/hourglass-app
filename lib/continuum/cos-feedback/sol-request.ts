/**
 * One bounded Sol completion for Chief of Staff feedback.
 * The packet is the only model input. No tools. No retries.
 */

import {
  CONCIERGE_SOL_RESPONSES_ENDPOINT,
} from "@/lib/continuum/concierge-sol/models";
import type { CosFeedbackPacket } from "./feedback";

export const COS_FEEDBACK_SOL_TIMEOUT_MS = 12_000;

const INSTRUCTIONS = [
  "You are the Hourglass chief of staff.",
  "Return one JSON object and no other text.",
  "Interpret the packet. Recommend focus, timing, and what can wait.",
  "Facts in the packet stay facts. Recommendations stay recommendations.",
  "Do not invent dates, people, client actions, or vendor actions.",
  "Do not say anything was scheduled.",
  "Do not mark due or overdue founder work as safe to ignore.",
  "Do not rank internal or SEO work ahead of a client or project founder obligation.",
  "When basis is evidence, copy the packet timing statement exactly.",
  "Use only itemIds from the packet.",
  "Shape: {\"portfolioSummary\":string,\"founderGuidance\":string,\"focusOrder\":[{\"itemId\":string,\"why\":string}],\"risks\":[{\"itemId\":string,\"statement\":string,\"basis\":\"evidence\"|\"recommendation\"}],\"safeToIgnore\":[{\"itemId\":string,\"why\":string}]}",
].join(" ");

type ResponsesJson = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: unknown;
  }>;
};

export async function requestCosFeedbackCompletion(input: {
  apiKey: string;
  model: string;
  packet: CosFeedbackPacket;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<unknown> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? COS_FEEDBACK_SOL_TIMEOUT_MS);
  try {
    const response = await fetchImpl(CONCIERGE_SOL_RESPONSES_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        store: false,
        max_output_tokens: 700,
        instructions: INSTRUCTIONS,
        input: JSON.stringify(input.packet),
      }),
    });
    if (!response.ok) throw new Error("cos-feedback-unavailable");
    const json = (await response.json()) as ResponsesJson;
    return JSON.parse(extractJson(outputText(json)));
  } finally {
    clearTimeout(timer);
  }
}

function outputText(json: ResponsesJson): string {
  if (json.output_text?.trim()) return json.output_text.trim();
  const chunks: string[] = [];
  for (const item of json.output ?? []) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (!part || typeof part !== "object") continue;
      const row = part as { type?: string; text?: string };
      if ((row.type === "output_text" || row.type === "text") && row.text?.trim()) {
        chunks.push(row.text.trim());
      }
    }
  }
  return chunks.join("\n").trim();
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() || trimmed;
}
