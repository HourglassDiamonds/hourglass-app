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
import type { CaptureProposal, CaptureProposedItem } from "./types";
import { runAuthenticatedSterlingQuery } from "../sterling/server";
import { partitionConditionalHoldCapture } from "../sterling/holds/capture";

export async function interpretCaptureAuthenticated(request: CaptureRequest) {
  const partition = partitionConditionalHoldCapture(request.text);
  let ordinary: CaptureProposal = { version: 1, captureId: request.captureId, canonical: false, items: [] };
  if (partition.ordinary.trim()) {
    const apiKey = getConciergeOpenAiApiKey();
    const loaded = await loadConciergeSolWorld();
    if (!apiKey || !loaded.ok) throw new Error(loaded.ok ? "openai-unavailable" : loaded.reason);
    ordinary = await interpretCapture({
      brain: new OpenAiSolBrain(apiKey, request.requestedModel ?? conciergeForegroundModel()),
      world: loaded.world,
    }, { ...request, text: partition.ordinary });
  }
  const holdItems: CaptureProposedItem[] = [];
  for (const [index, clause] of partition.holds.entries()) {
    const response = await runAuthenticatedSterlingQuery(clause, new Date(request.referenceTime));
    const proposal = response?.proposals.find((row) => row.kind === "conditional_hold") ?? null;
    const clarification = response?.findings.find((row) => row.kind === "uncertainty")?.whyItMatters ?? null;
    holdItems.push({
      itemId: `${request.captureId}_hold_${index + 1}`,
      kind: "hold",
      sourceExcerpt: clause,
      title: proposal ? response?.findings[0]?.title ?? "Conditional hold" : "Conditional hold needs review",
      content: proposal?.proposedState ?? clarification ?? "Open Sterling and specify the canonical work and observable resume condition.",
      confidence: proposal ? 1 : 0.5,
      ...(proposal ? { sterlingProposal: proposal } : { clarification: { question: clarification ?? "Which work and observable condition should this hold use?" } }),
    });
  }
  return { ...ordinary, items: [...holdItems, ...ordinary.items] } satisfies CaptureProposal;
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
