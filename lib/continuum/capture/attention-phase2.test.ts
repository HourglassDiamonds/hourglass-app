import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import type { ProjectJobWriter } from "../client-memory/project-jobs/writer";
import type { ClientMemoryNoteWriter } from "../client-memory/write/writer";
import type { ConciergeSolWorld } from "../concierge-sol/world";
import type { ReasoningBrain } from "../concierge-sol/types";
import { commitCapture, type CaptureCommitAuthority } from "./commit";
import { interpretCapture } from "./interpret";
import type { CaptureProposal, CaptureRequest } from "./types";

const PERSON = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const request: CaptureRequest = { captureId: "capture-phase2", text: "Remind me tomorrow at 1 PM to call Dylan.",
  provenance: "text", referenceTime: "2026-09-30T14:00:00-04:00", timezone: "America/New_York" };

function brain(proposal: CaptureProposal): ReasoningBrain {
  return { id: "fake", model: "gpt-5.6-sol", async complete() { return { turn: { kind: "message" as const,
    text: JSON.stringify(proposal) }, usage: { model: "gpt-5.6-sol", promptTokens: null, completionTokens: null } }; } };
}
const world = { async searchPeople() { return []; }, async listProjects() { return []; } } as unknown as
  Pick<ConciergeSolWorld, "searchPeople" | "listProjects">;

test("explicit Reminder and Watching language is represented with trusted capture time provenance", async () => {
  const reminder = await interpretCapture({ brain: brain({ version: 1, captureId: request.captureId, canonical: false, items: [{
    itemId: "r1", kind: "action", sourceExcerpt: request.text, title: "Call Dylan", content: "Call Dylan", confidence: 0.9,
    timing: { kind: "exact-instant", originalWording: "tomorrow at 1 PM", instantAt: "2026-10-01T13:00:00-04:00", timezone: "America/New_York" },
  }] }), world }, request);
  assert.equal(reminder.items[0].kind, "reminder");
  assert.equal(reminder.items[0].timing?.referenceInstant, request.referenceTime);

  const watchRequest = { ...request, text: "Watch for Dylan to approve the revision; check Friday if we're still waiting." };
  const watching = await interpretCapture({ brain: brain({ version: 1, captureId: request.captureId, canonical: false, items: [{
    itemId: "w1", kind: "action", sourceExcerpt: watchRequest.text, title: "Dylan revision approval",
    content: "Watch for Dylan to approve the revision", confidence: 0.9,
    timing: { kind: "checkpoint", originalWording: "check Friday", condition: "Approval observed",
      checkAt: { kind: "date-only", originalWording: "Friday", date: "2026-10-02" } },
  }] }), world }, watchRequest);
  assert.equal(watching.items[0].kind, "watching");
  assert.equal(watching.items[0].timing?.kind, "checkpoint");
  if (watching.items[0].timing?.kind === "checkpoint") {
    assert.equal(watching.items[0].timing.checkAt?.referenceInstant, request.referenceTime);
  }
});

test("vague Reminder dayparts and unresolved identities remain clarification-gated", async () => {
  const vague = { ...request, text: "Remind me Friday morning to check Sarah's CAD." };
  const proposal = await interpretCapture({ brain: brain({ version: 1, captureId: request.captureId, canonical: false, items: [{
    itemId: "r1", kind: "reminder", sourceExcerpt: vague.text, title: "Check Sarah's CAD", content: "Check Sarah's CAD",
    confidence: 0.8, entityResolution: { status: "unresolved", mention: "Sarah" },
    timing: { kind: "date-only", originalWording: "Friday morning", date: "2026-10-02" },
  }] }), world }, vague);
  assert.match(proposal.items[0].clarification?.question ?? "", /exact time/i);
  assert.deepEqual(proposal.items[0].entityResolution, { status: "unresolved", mention: "Sarah" });
});

test("confirmed Reminder and projectless Watching proposals use the canonical ProjectJob writer", async () => {
  const writes: Array<Record<string, unknown>> = [];
  const seen = new Map<string, string>();
  const jobs = { async createJob(input: Record<string, unknown>) {
    writes.push(input); const prior = seen.get(String(input.mutationId)); const id = prior ?? randomUUID(); seen.set(String(input.mutationId), id);
    return { ok: true as const, status: prior ? "already-present" as const : "created" as const, job: { jobId: id } };
  } } as unknown as ProjectJobWriter;
  const authority: CaptureCommitAuthority = {
    actor: "founder", jobs, notes: {} as ClientMemoryNoteWriter,
    world: { async getPersonProfile() { return { ok: true as const, profile: { person: { roles: ["client"] } } }; },
      async getProjectDesk() { return { ok: true as const, desk: { people: [{ personId: PERSON }] } }; } } as unknown as
      Pick<ConciergeSolWorld, "getPersonProfile" | "getProjectDesk">,
  };
  const reminder = { itemId: "r1", kind: "reminder" as const, sourceExcerpt: "Remind me tomorrow at 1 PM",
    title: "Call Dylan", content: "Call Dylan", confidence: 1,
    entityResolution: { status: "resolved" as const, personId: PERSON, projectId: PROJECT, evidence: "Founder confirmed" },
    timing: { kind: "exact-instant" as const, originalWording: "tomorrow at 1 PM",
      instantAt: "2026-10-01T13:00:00-04:00", timezone: "America/New_York", referenceInstant: request.referenceTime } };
  const watching = { itemId: "w1", kind: "watching" as const, sourceExcerpt: "Watch Malakan for Sarah's CAD",
    title: "Sarah CAD", content: "Watch Malakan for Sarah's CAD", confidence: 1,
    timing: { kind: "checkpoint" as const, originalWording: "Watch Malakan", condition: "Sarah's CAD is received",
      timezone: "America/New_York", referenceInstant: request.referenceTime } };
  const input = { version: 1 as const, captureId: request.captureId, items: [
    { itemId: "r1", selected: true as const, mutationId: randomUUID(), confirmedItem: reminder },
    { itemId: "w1", selected: true as const, mutationId: randomUUID(), confirmedItem: watching },
  ] };
  const first = await commitCapture({ async loadAuthority() { return { ok: true, authority }; } }, input);
  const retry = await commitCapture({ async loadAuthority() { return { ok: true, authority }; } }, input);
  assert.deepEqual(first.items.map((row) => row.status), ["saved", "saved"]);
  assert.deepEqual(retry.items.map((row) => row.status), ["already-present", "already-present"]);
  assert.equal(writes[0].attentionMode, "reminder");
  assert.equal(writes[0].activationAt, "2026-10-01T17:00:00.000Z");
  assert.equal(writes[0].projectId, PROJECT);
  assert.equal(writes[1].attentionMode, "watching");
  assert.equal(writes[1].checkpointAt, null);
  assert.equal(writes[1].projectId, null);
  assert.equal((writes[1].attentionMetadata as { unscheduledConfirmed?: boolean }).unscheduledConfirmed, true);
});
