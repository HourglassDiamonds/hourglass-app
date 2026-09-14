/**
 * Concierge Sol runtime. Tool-grounded reasoning with read-first safety.
 */

import { brainDumpCopy, interpretBrainDump } from "./brain-dump";
import { clipHistory, resolveConversationSlots } from "./conversation";
import { collectEvidenceActions, composeFromTools } from "./compose";
import { deterministicToolPlan } from "./fallback";
import { CONCIERGE_FOREGROUND_BRAIN, conciergeForegroundModel } from "./models";
import { conciergeSystemPrompt } from "./prompts";
import { clipToolJson, sanitizeFounderText } from "./sanitize";
import { executeConciergeTool } from "./tool-runtime";
import { CONCIERGE_TOOL_DEFINITIONS } from "./tools";
import type {
  ConciergeSolAnswer,
  ConciergeSolRequest,
  ConciergeToolCall,
  ConciergeToolResult,
  ReasoningBrain,
  ReasoningBrainUsage,
} from "./types";
import {
  CONCIERGE_SOL_ERROR_MESSAGE,
  CONCIERGE_SOL_MAX_TOOL_RESULT_CHARS,
  CONCIERGE_SOL_MAX_TOOL_ROUNDS,
  CONCIERGE_SOL_QUERY_MAX_LENGTH,
  CONCIERGE_SOL_UNAVAILABLE_MESSAGE,
} from "./types";
import type { ConciergeSolWorld } from "./world";

export type RunConciergeSolInput = ConciergeSolRequest & {
  world: ConciergeSolWorld;
  brain?: ReasoningBrain | null;
  now?: Date;
};

export async function runConciergeSol(input: RunConciergeSolInput): Promise<ConciergeSolAnswer> {
  const started = Date.now();
  const mode = input.mode === "brain-dump" || input.mode === "design" ? input.mode : "conversation";
  const query = String(input.query ?? "").trim().slice(0, CONCIERGE_SOL_QUERY_MAX_LENGTH);
  const history = clipHistory(input.history);
  const now = input.now ?? new Date();

  if (!query) {
    return answer({
      mode,
      text: CONCIERGE_SOL_UNAVAILABLE_MESSAGE,
      results: [],
      brain: "none",
      model: conciergeForegroundModel(),
      started,
      usage: emptyUsage(),
    });
  }

  if (mode === "brain-dump") {
    const proposal = interpretBrainDump(query);
    let solText: string | null = null;
    let usage = emptyUsage();
    let brain: ConciergeSolAnswer["telemetry"]["brain"] = "fallback";
    if (input.brain) {
      try {
        const completed = await input.brain.complete({
          mode,
          system: conciergeSystemPrompt(mode),
          tools: [...CONCIERGE_TOOL_DEFINITIONS],
          messages: [{ role: "user", content: query }],
        });
        usage = completed.usage;
        if (completed.turn.kind === "message" && completed.turn.text.trim()) {
          solText = completed.turn.text.trim();
          brain = "sol";
        }
      } catch {
        brain = "fallback";
      }
    }
    return answer({
      mode,
      text: solText ? `${sanitizeFounderText(solText)}\n\n${brainDumpCopy(proposal)}` : brainDumpCopy(proposal),
      results: [],
      brain,
      model: usage.model || input.brain?.model || conciergeForegroundModel(),
      started,
      usage,
      brainDump: proposal,
    });
  }

  const collected: ConciergeToolResult[] = [];
  let usage = emptyUsage();
  let brainUsed: ConciergeSolAnswer["telemetry"]["brain"] = "fallback";
  let solText = "";

  if (input.brain) {
    try {
      const loop = await runBrainLoop({
        brain: input.brain,
        world: input.world,
        mode,
        query,
        history,
        now,
      });
      collected.push(...loop.results);
      usage = loop.usage;
      solText = loop.text;
      brainUsed = "sol";
    } catch {
      brainUsed = "fallback";
    }
  }

  if (collected.length === 0 && brainUsed !== "sol") {
    const plan = deterministicToolPlan({ query, mode, history });
    const ran = await runCalls(input.world, plan, now);
    collected.push(...ran);
    brainUsed = collected.length > 0 ? "fallback" : brainUsed;
  }

  const grounded = composeFromTools(collected);
  const mustGround = collected.some(
    (row) =>
      row.name === "get_repair_quote" ||
      row.name === "get_provenance_summary" ||
      row.name === "get_source_evidence" ||
      row.name === "get_birthdays",
  );
  const text = sanitizeFounderText(
    (mustGround && grounded) || solText || grounded || CONCIERGE_SOL_UNAVAILABLE_MESSAGE,
  );
  return answer({
    mode,
    text,
    results: collected,
    brain: brainUsed,
    model: usage.model || input.brain?.model || conciergeForegroundModel(),
    started,
    usage,
  });
}

async function runBrainLoop(input: {
  brain: ReasoningBrain;
  world: ConciergeSolWorld;
  mode: "conversation" | "design";
  query: string;
  history: ReturnType<typeof clipHistory>;
  now: Date;
}): Promise<{ results: ConciergeToolResult[]; text: string; usage: ReturnType<typeof emptyUsage> }> {
  const messages: ReasoningBrainInputMessages = [];
  for (const turn of input.history) {
    messages.push({
      role: turn.role === "founder" ? "user" : "assistant",
      content: turn.text,
    });
  }
  messages.push({ role: "user", content: input.query });
  const slots = resolveConversationSlots({ query: input.query, history: input.history });
  const contextQuery = slots.personName || input.query;

  const results: ConciergeToolResult[] = [];
  let usage = emptyUsage();
  for (let round = 0; round < CONCIERGE_SOL_MAX_TOOL_ROUNDS; round += 1) {
    const completed = await input.brain.complete({
      mode: input.mode,
      system: conciergeSystemPrompt(input.mode),
      tools: [...CONCIERGE_TOOL_DEFINITIONS],
      messages,
    });
    usage = mergeUsage(usage, completed.usage);
    if (completed.turn.kind === "message") {
      return { results, text: completed.turn.text, usage };
    }
    const ran = await runCalls(input.world, completed.turn.calls, input.now, contextQuery);
    results.push(...ran);
    for (let index = 0; index < completed.turn.calls.length; index += 1) {
      const call = completed.turn.calls[index]!;
      const result = ran[index]!;
      messages.push({
        role: "tool",
        name: call.name,
        callId: call.id,
        content: clipToolJson(result.data, CONCIERGE_SOL_MAX_TOOL_RESULT_CHARS),
      });
    }
  }
  return { results, text: "", usage };
}

type ReasoningBrainInputMessages = Array<{
  role: "user" | "assistant" | "tool";
  name?: string;
  callId?: string;
  content: string;
}>;

async function runCalls(
  world: ConciergeSolWorld,
  calls: readonly ConciergeToolCall[],
  now: Date,
  contextQuery = "",
): Promise<ConciergeToolResult[]> {
  const out: ConciergeToolResult[] = [];
  for (const call of calls) {
    out.push(
      await executeConciergeTool(world, call.name, fillMissingToolQuery(call.arguments, contextQuery), now),
    );
  }
  return out;
}

function fillMissingToolQuery(
  args: ConciergeToolCall["arguments"],
  contextQuery: string,
): ConciergeToolCall["arguments"] {
  const personName = contextQuery.trim();
  if (!personName) return args;
  const personId = typeof args.personId === "string" ? args.personId.trim() : "";
  const projectId = typeof args.projectId === "string" ? args.projectId.trim() : "";
  if (personId || projectId) return args;
  const existing = typeof args.query === "string" ? args.query.trim() : "";
  if (!existing) return { ...args, query: personName };
  if (existing.toLowerCase().includes(personName.toLowerCase())) return args;
  return { ...args, query: `${personName} ${existing}` };
}

function emptyUsage(): ReasoningBrainUsage {
  return { model: conciergeForegroundModel(), promptTokens: null, completionTokens: null };
}

function mergeUsage(
  left: ReturnType<typeof emptyUsage>,
  right: { model: string; promptTokens: number | null; completionTokens: number | null },
) {
  return {
    model: right.model || left.model,
    promptTokens: addNullable(left.promptTokens, right.promptTokens),
    completionTokens: addNullable(left.completionTokens, right.completionTokens),
  };
}

function addNullable(left: number | null, right: number | null): number | null {
  if (left == null && right == null) return null;
  return (left ?? 0) + (right ?? 0);
}

function answer(input: {
  mode: ConciergeSolAnswer["mode"];
  text: string;
  results: ConciergeToolResult[];
  brain: ConciergeSolAnswer["telemetry"]["brain"];
  model: string;
  started: number;
  usage: ReturnType<typeof emptyUsage>;
  brainDump?: ConciergeSolAnswer["brainDump"];
}): ConciergeSolAnswer {
  return {
    kind: "conversation",
    mode: input.mode,
    text: input.text || CONCIERGE_SOL_ERROR_MESSAGE,
    actions: collectEvidenceActions(input.results),
    brainDump: input.brainDump ?? null,
    writesCanonical: false,
    telemetry: {
      requestModel: input.model,
      brain: input.brain === "sol" ? CONCIERGE_FOREGROUND_BRAIN : input.brain,
      promptTokens: input.usage.promptTokens,
      completionTokens: input.usage.completionTokens,
      latencyMs: Math.max(0, Date.now() - input.started),
      toolCount: input.results.length,
      toolNames: input.results.map((row) => row.name),
    },
  };
}
