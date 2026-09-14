/**
 * Sol-powered Concierge V1 contracts.
 * Continuum owns memory, canonical state, permissions, provenance, and tools.
 * Sol is the interchangeable foreground reasoning brain.
 */

import type { ConciergeAskMode } from "@/lib/continuum/client-memory/read/presentation";

export const CONCIERGE_SOL_QUERY_MAX_LENGTH = 4000;
export const CONCIERGE_SOL_HISTORY_MAX_TURNS = 8;
export const CONCIERGE_SOL_TURN_MAX_LENGTH = 2000;
export const CONCIERGE_SOL_MAX_TOOL_ROUNDS = 6;
export const CONCIERGE_SOL_MAX_TOOL_RESULT_CHARS = 4000;

export const CONCIERGE_SOL_PENDING_MESSAGE = "Looking…" as const;
export const CONCIERGE_SOL_ERROR_MESSAGE =
  "I couldn't reach Continuum just now." as const;
export const CONCIERGE_SOL_UNAVAILABLE_MESSAGE =
  "I couldn't answer from Continuum just now." as const;
export const CONCIERGE_SOL_UNKNOWN_PERSON =
  "I don't have a Person in Continuum that matches that name." as const;
export const CONCIERGE_SOL_UNKNOWN_PROJECT =
  "I don't have a Project in Continuum that matches that." as const;
export const CONCIERGE_SOL_TOOL_FAILURE_MESSAGE =
  "Continuum couldn't read that just now." as const;
export const CONCIERGE_SOL_WRITE_BLOCKED_MESSAGE =
  "I can propose that, but Continuum will not change canonical records until you approve it." as const;

export type ConciergeSolMode = ConciergeAskMode;

export type ConciergeSolRole = "founder" | "concierge";

export type ConciergeSolHistoryTurn = {
  role: ConciergeSolRole;
  text: string;
};

export type ConciergeEvidenceAction = {
  kind: "view-email" | "open-person" | "open-project";
  label: string;
  href: string;
  provenanceLimited?: boolean;
  provenanceLabel?: string | null;
};

export type BrainDumpProposal = {
  personContext: string | null;
  projectContext: string | null;
  action: string | null;
  personalItem: string | null;
  note: string | null;
  followUp: string | null;
  persist: false;
};

export type ConciergeSolTelemetry = {
  requestModel: string;
  brain: "sol" | "fallback" | "none";
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
  toolCount: number;
  toolNames: readonly string[];
};

export type ConciergeSolAnswer = {
  kind: "conversation";
  mode: ConciergeSolMode;
  text: string;
  actions: ConciergeEvidenceAction[];
  brainDump: BrainDumpProposal | null;
  writesCanonical: false;
  telemetry: ConciergeSolTelemetry;
};

export type ConciergeSolRequest = {
  query: string;
  mode?: ConciergeSolMode | null;
  history?: readonly ConciergeSolHistoryTurn[] | null;
};

export type ConciergeToolJson = Record<string, unknown>;

export type ConciergeToolCall = {
  id: string;
  name: string;
  arguments: ConciergeToolJson;
};

export type ConciergeToolResult = {
  name: string;
  ok: boolean;
  data: ConciergeToolJson;
};

export type ReasoningBrainTurn =
  | { kind: "tool_calls"; calls: ConciergeToolCall[] }
  | { kind: "message"; text: string };

export type ReasoningBrainInput = {
  mode: ConciergeSolMode;
  system: string;
  messages: readonly {
    role: "user" | "assistant" | "tool";
    name?: string;
    callId?: string;
    content: string;
  }[];
  tools: readonly ConciergeToolDefinition[];
};

export type ConciergeToolDefinition = {
  name: string;
  description: string;
  parameters: ConciergeToolJson;
  write: false;
  proposal: boolean;
};

export type ReasoningBrainUsage = {
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
};

export type ReasoningBrain = {
  id: string;
  model: string;
  complete(input: ReasoningBrainInput): Promise<{
    turn: ReasoningBrainTurn;
    usage: ReasoningBrainUsage;
  }>;
};
