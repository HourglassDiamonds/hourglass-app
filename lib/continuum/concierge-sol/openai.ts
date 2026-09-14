/**
 * OpenAI Sol client. Foreground Concierge reasoning only.
 * Continuum still owns tools, memory, and writes.
 * Responses API is the durable tool-calling seam for Sol.
 */

import {
  CONCIERGE_FOREGROUND_BRAIN,
  CONCIERGE_SOL_RESPONSES_ENDPOINT,
  conciergeForegroundModel,
} from "./models";
import { openaiResponsesToolPayloads } from "./tools";
import type {
  ReasoningBrain,
  ReasoningBrainInput,
  ReasoningBrainTurn,
} from "./types";

type ResponsesItem = {
  type?: string;
  id?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  role?: string;
  content?: unknown;
};

export type SolApiFailure = {
  httpStatus: number | null;
  errorType: string | null;
  errorCode: string | null;
  errorParam: string | null;
};

export class OpenAiSolBrain implements ReasoningBrain {
  readonly id = CONCIERGE_FOREGROUND_BRAIN;
  readonly model: string;
  readonly endpoint = CONCIERGE_SOL_RESPONSES_ENDPOINT;
  lastApiFailure: SolApiFailure | null = null;
  private sessionInput: unknown[] = [];
  private lastOutput: ResponsesItem[] = [];
  private started = false;
  private toolsConsumed = 0;

  constructor(
    private readonly apiKey: string,
    model = conciergeForegroundModel(),
  ) {
    this.model = model;
  }

  async complete(input: ReasoningBrainInput): Promise<{
    turn: ReasoningBrainTurn;
    usage: { model: string; promptTokens: number | null; completionTokens: number | null };
  }> {
    if (!this.started) {
      this.sessionInput = conversationItems(input);
      this.started = true;
    } else {
      this.sessionInput.push(...this.lastOutput);
      const tools = input.messages.filter((row) => row.role === "tool");
      const fresh = tools.slice(this.toolsConsumed);
      for (const row of fresh) {
        this.sessionInput.push({
          type: "function_call_output",
          call_id: row.callId || row.name || "call",
          output: row.content,
        });
      }
      this.toolsConsumed = tools.length;
    }

    const body = {
      model: this.model,
      instructions: input.system,
      input: this.sessionInput,
      tools: openaiResponsesToolPayloads(),
      tool_choice: "auto",
      store: false,
      parallel_tool_calls: true,
    };
    const payload = JSON.stringify(body);
    type ResponsesJson = {
      model?: string;
      output?: ResponsesItem[];
      output_text?: string;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        prompt_tokens?: number;
        completion_tokens?: number;
      };
    };
    let json: ResponsesJson | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: payload,
      });
      if (response.ok) {
        this.lastApiFailure = null;
        json = (await response.json()) as ResponsesJson;
        break;
      }
      this.lastApiFailure = await readFailure(response);
      if (!shouldRetryRateLimit(this.lastApiFailure, attempt)) {
        throw new Error("openai-unavailable");
      }
      await sleep(retryWaitMs(response));
    }
    if (!json) {
      throw new Error("openai-unavailable");
    }
    const output = Array.isArray(json.output) ? json.output : [];
    this.lastOutput = output;
    const usage = {
      model: json.model ?? this.model,
      promptTokens: json.usage?.input_tokens ?? json.usage?.prompt_tokens ?? null,
      completionTokens: json.usage?.output_tokens ?? json.usage?.completion_tokens ?? null,
    };
    const calls = output.filter((row) => row.type === "function_call");
    if (calls.length > 0) {
      return {
        usage,
        turn: {
          kind: "tool_calls",
          calls: calls.map((call, index) => ({
            id: call.call_id ?? call.id ?? `call_${index}`,
            name: call.name ?? "",
            arguments: parseArgs(call.arguments),
          })),
        },
      };
    }
    return {
      usage,
      turn: { kind: "message", text: outputText(json.output_text, output) },
    };
  }
}

async function readFailure(response: Response): Promise<SolApiFailure> {
  const failure: SolApiFailure = {
    httpStatus: response.status,
    errorType: null,
    errorCode: null,
    errorParam: null,
  };
  try {
    const json = (await response.json()) as {
      error?: { type?: string; code?: string; param?: string };
    };
    failure.errorType = json.error?.type ?? null;
    failure.errorCode = json.error?.code ?? null;
    failure.errorParam = json.error?.param ?? null;
  } catch {
    // Status only. Never log response bodies or keys.
  }
  return failure;
}

function shouldRetryRateLimit(failure: SolApiFailure, attempt: number): boolean {
  return (
    attempt < 3 &&
    failure.httpStatus === 429 &&
    failure.errorCode === "rate_limit_exceeded"
  );
}

function retryWaitMs(response: Response): number {
  const header = response.headers.get("retry-after");
  const seconds = header ? Number(header) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 60_000);
  }
  return 20_000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function conversationItems(input: ReasoningBrainInput): unknown[] {
  const items: unknown[] = [];
  for (const row of input.messages) {
    if (row.role === "tool") continue;
    items.push({
      role: row.role === "assistant" ? "assistant" : "user",
      content: row.content,
    });
  }
  return items;
}

function outputText(direct: string | undefined, output: ResponsesItem[]): string {
  if (direct?.trim()) return direct.trim();
  const chunks: string[] = [];
  for (const item of output) {
    if (item.type !== "message") continue;
    const content = item.content;
    if (typeof content === "string" && content.trim()) {
      chunks.push(content.trim());
      continue;
    }
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const rec = part as { type?: string; text?: string };
      if ((rec.type === "output_text" || rec.type === "text") && rec.text?.trim()) {
        chunks.push(rec.text.trim());
      }
    }
  }
  return chunks.join("\n").trim();
}

function parseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
