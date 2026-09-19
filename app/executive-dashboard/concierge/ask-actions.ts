"use server";

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
  readTodayBriefingPacket,
  type TodayBriefingPacket,
} from "@/lib/continuum/chief-of-staff/operating-loop/briefing-packet";

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
        };
      },
): Promise<AskConciergeAnswer | ConciergeSolAnswer> {
  const query = typeof input === "string" ? input : input.query;
  const mode = typeof input === "string" ? "conversation" : input.mode ?? "conversation";
  const history = typeof input === "string" ? [] : input.history ?? [];
  const todayContext = typeof input === "string" ? undefined : input.todayContext;
  if (todayContext?.packet) {
    const packet = readTodayBriefingPacket(todayContext.packet);
    if (!packet || packet.itemId !== todayContext.itemId) {
      return { kind: "error" };
    }
    const asked = answerTodayCardAsk({ query, packet });
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
