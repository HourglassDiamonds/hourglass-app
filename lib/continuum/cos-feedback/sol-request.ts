/**
 * One bounded Sol completion for Chief of Staff feedback.
 * Structured Outputs enforce the JSON shape. Semantic checks stay downstream.
 * The packet is the only model input. No tools. No retries. No fence repair.
 */

import {
  CONCIERGE_SOL_RESPONSES_ENDPOINT,
} from "@/lib/continuum/concierge-sol/models";
import type { CosFeedbackPacket } from "./feedback";

export const COS_FEEDBACK_SOL_TIMEOUT_MS = 12_000;
export const COS_FEEDBACK_RESPONSE_FORMAT = "json_schema" as const;

const INSTRUCTIONS = [
  "You are the Hourglass chief of staff.",
  "Interpret the packet. Recommend focus, timing, and what can wait.",
  "Facts in the packet stay facts. Recommendations stay recommendations.",
  "Do not invent dates, people, client actions, or vendor actions.",
  "Do not say anything was scheduled.",
  "Observed calendar commitments are day facts. Use them only to time a recommendation.",
  "Do not hide founder work because of a commitment, and do not attach a commitment to a project.",
  "Do not mark due or overdue founder work as safe to ignore.",
  "Do not rank internal or SEO work ahead of a client or project founder obligation.",
  "When basis is evidence, copy the packet timing statement exactly.",
  "Use only itemIds from the packet.",
].join(" ");

const STRING_OBJECT = {
  type: "object",
  additionalProperties: false,
} as const;

export const COS_FEEDBACK_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    portfolioSummary: { type: "string" },
    founderGuidance: { type: "string" },
    focusOrder: {
      type: "array",
      items: {
        ...STRING_OBJECT,
        properties: {
          itemId: { type: "string" },
          why: { type: "string" },
        },
        required: ["itemId", "why"],
      },
    },
    risks: {
      type: "array",
      items: {
        ...STRING_OBJECT,
        properties: {
          itemId: { type: "string" },
          statement: { type: "string" },
          basis: { type: "string", enum: ["evidence", "recommendation"] },
        },
        required: ["itemId", "statement", "basis"],
      },
    },
    safeToIgnore: {
      type: "array",
      items: {
        ...STRING_OBJECT,
        properties: {
          itemId: { type: "string" },
          why: { type: "string" },
        },
        required: ["itemId", "why"],
      },
    },
  },
  required: ["portfolioSummary", "founderGuidance", "focusOrder", "risks", "safeToIgnore"],
} as const;

type ResponseContent = {
  type?: string;
  text?: string;
  refusal?: string;
};

type ResponseOutputItem = {
  type?: string;
  status?: string;
  content?: ResponseContent[];
};

export type CosFeedbackResponsesBody = {
  status?: string;
  error?: unknown;
  output_text?: string;
  output?: ResponseOutputItem[];
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
        text: {
          format: {
            type: COS_FEEDBACK_RESPONSE_FORMAT,
            name: "cos_feedback_v1",
            strict: true,
            schema: COS_FEEDBACK_OUTPUT_SCHEMA,
          },
        },
      }),
    });
    if (!response.ok) throw new Error("cos-feedback-unavailable");
    let json: CosFeedbackResponsesBody;
    try {
      json = (await response.json()) as CosFeedbackResponsesBody;
    } catch {
      throw new SyntaxError("cos-feedback-malformed");
    }
    return parseStructuredFeedback(json);
  } finally {
    clearTimeout(timer);
  }
}

export function parseStructuredFeedback(json: CosFeedbackResponsesBody): unknown {
  if (json.error) throw new Error("cos-feedback-unavailable");
  if (json.status === "incomplete" || json.status === "failed") {
    throw new Error("cos-feedback-unavailable");
  }
  for (const item of json.output ?? []) {
    if (item.type !== "message") continue;
    if (item.status === "incomplete" || item.status === "failed") {
      throw new Error("cos-feedback-unavailable");
    }
    for (const part of item.content ?? []) {
      if (part?.type === "refusal") throw new Error("cos-feedback-unavailable");
    }
  }
  const text = structuredText(json);
  if (!text) throw new SyntaxError("cos-feedback-malformed");
  try {
    return JSON.parse(text);
  } catch {
    throw new SyntaxError("cos-feedback-malformed");
  }
}

function structuredText(json: CosFeedbackResponsesBody): string {
  const chunks: string[] = [];
  for (const item of json.output ?? []) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (!part || (part.type !== "output_text" && part.type !== "text")) continue;
      if (part.text?.trim()) chunks.push(part.text.trim());
    }
  }
  if (chunks.length > 0) return chunks.join("\n");
  return json.output_text?.trim() ?? "";
}
