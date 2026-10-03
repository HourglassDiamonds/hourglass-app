"use server";

import { executeAuthenticatedFounderOperation } from "@/lib/continuum/concierge-sol/founder-command-server";
import { revalidatePath } from "next/cache";
import { proposeFounderOperation } from "@/lib/continuum/concierge-sol/founder-command";
import { refreshTodayAfterFounderMutation } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import { answerAskConciergeQuery } from "@/lib/continuum/client-memory/ask/query";
import { parseAskConciergeIntent } from "@/lib/continuum/client-memory/ask/intent";
import type { AskConciergeAnswer } from "@/lib/continuum/client-memory/ask/types";
import { getAuthenticatedClientMemoryReader } from "@/lib/continuum/client-memory/read/load";
import type { ConciergeAskMode } from "@/lib/continuum/client-memory/read/presentation";
import {
  getConciergeForegroundModelOverride,
  getConciergeOpenAiApiKey,
  loadConciergeSolWorld,
  OpenAiSolBrain,
  runConciergeSol,
  type ConciergeSolAnswer,
  type ConciergeSolHistoryTurn,
} from "@/lib/continuum/concierge-sol";
import { interpretBrainDump } from "@/lib/continuum/concierge-sol/brain-dump";
import { conciergeForegroundModel } from "@/lib/continuum/concierge-sol/models";
import { answerTodayCardAsk } from "@/lib/continuum/chief-of-staff/operating-loop/briefing-ask";
import {
  deriveCosBriefingV1,
  readCosBriefingV1,
  type CosBriefingV1,
} from "@/lib/continuum/chief-of-staff/operating-loop/cos-briefing-v1";
import {
  readTodayBriefingPacket,
  type TodayBriefingPacket,
} from "@/lib/continuum/chief-of-staff/operating-loop/briefing-packet";
import { runAuthenticatedSterlingQuery } from "@/lib/continuum/sterling/server";
import { parseSterlingIntent } from "@/lib/continuum/sterling/engine";
import type { SterlingResponse } from "@/lib/continuum/sterling/types";

export async function askConcierge(
  input:
    | string
    | {
        query: string;
        mode?: ConciergeAskMode;
        history?: ConciergeSolHistoryTurn[];
        todayContext?: {
          itemId: string;
          packet: TodayBriefingPacket;
          briefing?: CosBriefingV1 | null;
        };
      },
): Promise<AskConciergeAnswer | ConciergeSolAnswer> {
  const query = typeof input === "string" ? input : input.query;
  const mode = typeof input === "string" ? "conversation" : input.mode ?? "conversation";
  const history = typeof input === "string" ? [] : input.history ?? [];
  const todayContext = typeof input === "string" ? undefined : input.todayContext;
  const conditionalHoldIntent = mode === "conversation"
    && !todayContext
    && parseSterlingIntent(query) === "conditional-hold";
  if (conditionalHoldIntent) {
    const sterling = await runAuthenticatedSterlingQuery(query, new Date(), conditionalHoldContext(query, history));
    if (sterling) return presentSterling(sterling);
  }
  const operation = mode === "conversation" || todayContext ? proposeFounderOperation(query) : null;
  if (operation) {
    const result = await executeAuthenticatedFounderOperation(operation, refreshTodayAfterFounderMutation);
    if (result.refresh) revalidatePath(CONCIERGE_HOME_PATH);
    return { kind: "conversation", mode: "conversation", text: result.text, actions: [], brainDump: null, writesCanonical: result.status === "applied", refreshToday: result.refresh, telemetry: { requestModel: conciergeForegroundModel(), brain: "fallback", promptTokens: null, completionTokens: null, latencyMs: 0, toolCount: 1, toolNames: ["apply_founder_operation"] } };
  }
  if (todayContext?.packet) {
    const packet = readTodayBriefingPacket(todayContext.packet);
    if (!packet || packet.itemId !== todayContext.itemId) {
      return { kind: "error" };
    }
    const supplied = todayContext.briefing ? readCosBriefingV1(todayContext.briefing) : null;
    if (todayContext.briefing != null && !supplied) {
      return { kind: "error" };
    }
    const briefing = deriveCosBriefingV1({
      packet,
      nowIso: new Date().toISOString(),
    });
    const asked = answerTodayCardAsk({ query, packet, briefing });
    return {
      kind: "conversation",
      mode: "brain-dump",
      text: asked.text,
      actions: [],
      brainDump: interpretBrainDump(query),
      writesCanonical: false,
      telemetry: {
        requestModel: conciergeForegroundModel(),
        brain: "fallback",
        promptTokens: null,
        completionTokens: null,
        latencyMs: 0,
        toolCount: 0,
        toolNames: [],
      },
    };
  }
  if (mode === "conversation" && !conditionalHoldIntent) {
    const sterling = await runAuthenticatedSterlingQuery(query);
    if (sterling) return presentSterling(sterling);
  }
  const birthdayIntent = parseAskConciergeIntent(query);
  if (history.length === 0 && birthdayIntent.kind !== "unsupported") {
    const auth = await getAuthenticatedClientMemoryReader();
    if (!auth.ok) return { kind: "error" };
    return answerAskConciergeQuery(auth.reader, query);
  }

  const loaded = await loadConciergeSolWorld();
  if (!loaded.ok) return { kind: "error" };
  const apiKey = getConciergeOpenAiApiKey();
  const brain = apiKey
    ? new OpenAiSolBrain(apiKey, conciergeForegroundModel(getConciergeForegroundModelOverride()))
    : null;
  return runConciergeSol({
    query,
    mode,
    history,
    world: loaded.world,
    brain,
  });
}

function conditionalHoldContext(query: string, history: readonly ConciergeSolHistoryTurn[]): string {
  if (!/\b(?:it|this|that|him|her|them)\b/i.test(query)) return "";
  return [...history].reverse().find((turn) =>
    turn.role === "founder" && parseSterlingIntent(turn.text) === "conditional-hold"
  )?.text ?? "";
}

function presentSterling(sterling: SterlingResponse): ConciergeSolAnswer {
  return {
    kind: "conversation",
    mode: "conversation",
    text: sterling.summary,
    actions: [],
    brainDump: null,
    sterling,
    writesCanonical: false,
    telemetry: {
      requestModel: sterling.telemetry.model,
      brain: "fallback",
      promptTokens: sterling.telemetry.promptTokens,
      completionTokens: sterling.telemetry.completionTokens,
      latencyMs: sterling.telemetry.latencyMs,
      toolCount: sterling.telemetry.toolsInvoked.length,
      toolNames: sterling.telemetry.toolsInvoked,
    },
  };
}
