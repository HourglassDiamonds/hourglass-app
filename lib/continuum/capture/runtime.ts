import "server-only";

import { getAuthenticatedProjectJobWriter } from "../client-memory/project-jobs/load-writer";
import { getAuthenticatedClientMemoryNoteWriter } from "../client-memory/write/load";
import { getConciergeOpenAiApiKey } from "../concierge-sol/env";
import { loadConciergeSolWorld } from "../concierge-sol/load";
import { conciergeForegroundModel } from "../concierge-sol/models";
import { OpenAiSolBrain } from "../concierge-sol/openai";
import { commitCapture } from "./commit";
import { interpretCapture } from "./interpret";
import type { CaptureCommitInput, CaptureRequest } from "./types";

export async function interpretCaptureAuthenticated(request: CaptureRequest) {
  const apiKey = getConciergeOpenAiApiKey();
  const loaded = await loadConciergeSolWorld();
  if (!apiKey || !loaded.ok) throw new Error(loaded.ok ? "openai-unavailable" : loaded.reason);
  return interpretCapture({
    brain: new OpenAiSolBrain(apiKey, request.requestedModel ?? conciergeForegroundModel()),
    world: loaded.world,
  }, request);
}

export async function commitCaptureAuthenticated(input: CaptureCommitInput) {
  return commitCapture({
    async loadAuthority() {
      const [world, jobs, notes] = await Promise.all([
        loadConciergeSolWorld(),
        getAuthenticatedProjectJobWriter(),
        getAuthenticatedClientMemoryNoteWriter(),
      ]);
      if (!world.ok) return { ok: false as const, reason: world.reason };
      if (!jobs.ok) return { ok: false as const, reason: jobs.reason };
      if (!notes.ok) return { ok: false as const, reason: notes.reason };
      if (jobs.username !== notes.username) return { ok: false as const, reason: "unauthorized" };
      return { ok: true as const, authority: { actor: jobs.username, world: world.world, jobs: jobs.writer, notes: notes.writer } };
    },
  }, input);
}
