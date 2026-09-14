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
import { conciergeForegroundModel } from "@/lib/continuum/concierge-sol/models";

export async function askConcierge(
  input:
    | string
    | {
        query: string;
        mode?: ConciergeAskMode;
        history?: ConciergeSolHistoryTurn[];
      },
): Promise<AskConciergeAnswer | ConciergeSolAnswer> {
  const query = typeof input === "string" ? input : input.query;
  const mode = typeof input === "string" ? "conversation" : input.mode ?? "conversation";
  const history = typeof input === "string" ? [] : input.history ?? [];
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
