import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import type { ReasoningBrain } from "../concierge-sol/types";
import type { ConciergeSolWorld } from "../concierge-sol/world";
import type { ClientMemoryNoteWriter } from "../client-memory/write/writer";
import type { ProjectJobWriter } from "../client-memory/project-jobs/writer";
import { commitCapture, type CaptureCommitAuthority } from "./commit";
import { interpretCapture } from "./interpret";
import type { CaptureProposal, CaptureRequest } from "./types";

const PERSON = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const JOB = "33333333-3333-4333-8333-333333333333";
const NOTE = "44444444-4444-4444-8444-444444444444";
const MUTATION = "55555555-5555-4555-8555-555555555555";
const request: CaptureRequest = {
  captureId: "capture-1", text: "Call Sam about Oval and note that she prefers platinum.", provenance: "text",
  referenceTime: "2026-09-28T12:00:00-04:00", timezone: "America/New_York",
};

function brain(output: unknown): ReasoningBrain {
  return { id: "fake", model: "gpt-5.6-sol", async complete() { return { turn: { kind: "message" as const, text: typeof output === "string" ? output : JSON.stringify(output) }, usage: { model: "gpt-5.6-sol", promptTokens: null, completionTokens: null } }; } };
}

function proposal(items: CaptureProposal["items"]): CaptureProposal {
  return { version: 1, captureId: request.captureId, canonical: false, items };
}

function item(itemId: string, kind: "action" | "note" = "action") {
  return { itemId, kind, sourceExcerpt: "source", title: kind === "action" ? "Call Sam" : "Preference", content: kind === "action" ? "Call Sam about the design" : "Sam prefers platinum", confidence: 0.9 } as const;
}

function world(people: Array<{ personId: string; displayName: string }> = [], projects: Array<{ projectId: string; title: string }> = []) {
  return {
    async searchPeople() { return people.map((row) => ({ ...row, organizationName: null, email: null, phone: null, roles: [], linkedProjectCount: 0, relationshipContext: null })); },
    async listProjects() { return projects; },
  } as unknown as Pick<ConciergeSolWorld, "searchPeople" | "listProjects">;
}

describe("Quick Capture engine", () => {
  it("extracts multiple independent items", async () => {
    const result = await interpretCapture({ brain: brain(proposal([item("action-1"), item("note-1", "note")])), world: world() }, request);
    assert.deepEqual(result.items.map((row) => row.kind), ["action", "note"]);
    assert.equal(result.canonical, false);
  });

  it("keeps ambiguous identity candidates for review", async () => {
    const proposed = { ...item("action-1"), entityResolution: { status: "unresolved" as const, mention: "Sam" } };
    const result = await interpretCapture({ brain: brain(proposal([proposed])), world: world([{ personId: PERSON, displayName: "Sam" }, { personId: NOTE, displayName: "Sam" }]) }, request);
    assert.equal(result.items[0].entityResolution?.status, "ambiguous");
    if (result.items[0].entityResolution?.status === "ambiguous") assert.equal(result.items[0].entityResolution.candidates.length, 2);
  });

  it("represents unresolved identity without inventing an ID", async () => {
    const proposed = { ...item("action-1"), entityResolution: { status: "unresolved" as const, mention: "Sam" } };
    const result = await interpretCapture({ brain: brain(proposal([proposed])), world: world() }, request);
    assert.deepEqual(result.items[0].entityResolution, { status: "unresolved", mention: "Sam" });
  });

  it("falls back to a noncanonical review note for invalid model output", async () => {
    const result = await interpretCapture({ brain: brain("not json"), world: world() }, request);
    assert.equal(result.canonical, false);
    assert.equal(result.items[0].kind, "note");
    assert.equal(result.items[0].confidence, 0);
    assert.ok(result.items[0].clarification);
  });

  it("does not write canonical state before explicit confirmation", async () => {
    let reads = 0;
    const readWorld = { async searchPeople() { reads += 1; return []; }, async listProjects() { reads += 1; return []; } } as unknown as Pick<ConciergeSolWorld, "searchPeople" | "listProjects">;
    await interpretCapture({ brain: brain(proposal([item("action-1")])), world: readWorld }, request);
    assert.equal(reads, 0);
    let authorityLoads = 0;
    const result = await commitCapture({ async loadAuthority() { authorityLoads += 1; return { ok: true, authority: fakeAuthority() }; } }, {
      version: 1, captureId: request.captureId, items: [{ itemId: "action-1", selected: false }],
    });
    assert.equal(authorityLoads, 0);
    assert.deepEqual(result.items, []);
  });

  it("saves a confirmed project-linked action and linked note", async () => {
    const authority = fakeAuthority();
    const action = { ...item("action-1"), entityResolution: { status: "resolved" as const, personId: PERSON, projectId: PROJECT, evidence: "confirmed existing records" } };
    const note = { ...item("note-1", "note"), entityResolution: action.entityResolution };
    const result = await commitCapture({ async loadAuthority() { return { ok: true, authority }; } }, {
      version: 1, captureId: request.captureId, items: [
        { itemId: action.itemId, selected: true, mutationId: MUTATION, confirmedItem: action },
        { itemId: note.itemId, selected: true, mutationId: randomUUID(), confirmedItem: note },
      ],
    });
    assert.deepEqual(result.items.map((row) => row.status), ["saved", "saved"]);
    assert.deepEqual(result.items.map((row) => row.status === "saved" ? row.target.kind : null), ["open_job", "source_note"]);
  });

  it("reports duplicate retries as already-present", async () => {
    const authority = fakeAuthority();
    const action = { ...item("action-1"), entityResolution: { status: "resolved" as const, projectId: PROJECT, evidence: "confirmed" } };
    const input = { version: 1 as const, captureId: request.captureId, items: [{ itemId: action.itemId, selected: true as const, mutationId: MUTATION, confirmedItem: action }] };
    const deps = { async loadAuthority() { return { ok: true as const, authority }; } };
    assert.equal((await commitCapture(deps, input)).items[0].status, "saved");
    assert.equal((await commitCapture(deps, input)).items[0].status, "already-present");
  });

  it("reports partial success item by item without claiming atomicity", async () => {
    const authority = fakeAuthority();
    const action = { ...item("action-1"), entityResolution: { status: "resolved" as const, projectId: PROJECT, evidence: "confirmed" } };
    const reminder = { ...item("reminder-1"), kind: "reminder" as const, entityResolution: action.entityResolution,
      timing: { kind: "exact-instant" as const, originalWording: "at 3", instantAt: "2026-09-29T15:00:00-04:00", timezone: "America/New_York" } };
    const result = await commitCapture({ async loadAuthority() { return { ok: true, authority }; } }, {
      version: 1, captureId: request.captureId, items: [
        { itemId: action.itemId, selected: true, mutationId: MUTATION, confirmedItem: action },
        { itemId: reminder.itemId, selected: true, mutationId: randomUUID(), confirmedItem: reminder },
      ],
    });
    assert.deepEqual(result.items.map((row) => row.status), ["saved", "needs-review"]);
  });
});

function fakeAuthority(): CaptureCommitAuthority {
  const mutations = new Set<string>();
  const jobs = { async createJob(input: { mutationId: string }) { const duplicate = mutations.has(input.mutationId); mutations.add(input.mutationId); return { ok: true as const, status: duplicate ? "already-present" as const : "created" as const, job: { jobId: JOB } }; } } as unknown as ProjectJobWriter;
  const notes = { async addManualNote() { return { ok: true as const, status: "inserted" as const, noteId: NOTE }; } } as unknown as ClientMemoryNoteWriter;
  const readWorld = {
    async getPersonProfile(id: string) { return id === PERSON ? { ok: true as const, profile: {} } : { ok: false as const, reason: "not-found" as const }; },
    async getProjectDesk(id: string) { return id === PROJECT ? { ok: true as const, desk: { people: [{ personId: PERSON }] } } : { ok: false as const, reason: "not-found" as const }; },
  } as unknown as Pick<ConciergeSolWorld, "getPersonProfile" | "getProjectDesk">;
  return { actor: "founder", world: readWorld, jobs, notes };
}
import { captureApplication } from "./application";
import { startReview, prepareConfirmation, applyConfirmation, reviewIssue } from "../../../app/executive-dashboard/concierge/components/quick-capture-state";

describe("Quick Capture application integration", () => {
  it("authenticates, proposes multiple cards read-only, confirms, and preserves partial results and retry IDs", async () => {
    const authority = fakeAuthority();
    let writes = 0;
    let auth = 0;
    const createJob = authority.jobs.createJob.bind(authority.jobs);
    authority.jobs.createJob = async input => { writes++; return createJob(input); };
    const items: CaptureProposal["items"] = [
      { ...item("action"), entityResolution: { status: "unresolved", mention: "person: Sam | project: Oval" } },
      { ...item("note", "note"), entityResolution: { status: "unresolved", mention: "Sam" } },
      { ...item("reminder"), kind: "reminder", entityResolution: { status: "unresolved", mention: "Sam" } },
    ];
    const actions = captureApplication({
      async authenticate() { auth++; },
      interpret: input => interpretCapture({ brain: brain(proposal(items)), world: world([{ personId: PERSON, displayName: "Sam" }], [{ projectId: PROJECT, title: "Oval" }]) }, input),
      commit: input => commitCapture({ async loadAuthority() { return { ok: true, authority }; } }, input),
    });
    const proposed = await actions.proposeAction(request);
    const rows = startReview(proposed, request.captureId);
    assert.equal(rows.length, 3);
    assert.equal(writes, 0);
    await actions.saveAction({ version: 1, captureId: request.captureId, items: rows.map(row => ({ itemId: row.item.itemId, selected: false })) });
    assert.equal(writes, 0);
    const prepared = prepareConfirmation(request.captureId, rows, randomUUID);
    const retry = prepareConfirmation(request.captureId, prepared.rows, () => { throw new Error("Must reuse IDs"); });
    assert.deepEqual(retry.input, prepared.input);
    const result = await actions.saveAction(retry.input);
    assert.deepEqual(result.items.map(row => row.status), ["saved", "saved", "needs-review"]);
    const rendered = applyConfirmation(prepared.rows, prepared.input, result);
    assert.deepEqual(rendered.map(row => row.selected), [false, false, false]);
    assert.match(reviewIssue(rendered[2]) ?? "", /Reminder persistence/);
    assert.equal(writes, 1);
    assert.equal(auth, 3);
  });

  it("rejects unauthorized and malformed application requests before invoking the engine", async () => {
    let calls = 0;
    const deps = {
      async authenticate() {},
      async interpret() { calls++; return proposal([]); },
      async commit() { calls++; return { version: 1 as const, captureId: request.captureId, items: [] }; },
    };
    const actions = captureApplication(deps);
    await assert.rejects(actions.proposeAction({ ...request, text: "" }), /Invalid capture request/);
    await assert.rejects(actions.saveAction({ version: 1, captureId: request.captureId, items: [{ itemId: "bad", selected: true }] } as never), /Invalid capture confirmation/);
    const denied = captureApplication({ ...deps, async authenticate() { throw new Error("Unauthorized"); } });
    await assert.rejects(denied.proposeAction(request), /Unauthorized/);
    await assert.rejects(denied.saveAction({ version: 1, captureId: request.captureId, items: [] }), /Unauthorized/);
    assert.equal(calls, 0);
  });

  it("keeps unsupported persistence and unresolved interpretation review-gated", async () => {
    const authority = fakeAuthority();
    authority.jobs.createJob = async () => { throw new Error("Unexpected write"); };
    authority.notes.addManualNote = async () => { throw new Error("Unexpected write"); };
    const linked = { status: "resolved" as const, personId: PERSON, projectId: PROJECT, evidence: "Existing records" };
    const items = [
      { ...item("unassigned"), entityResolution: { ...linked, projectId: undefined } },
      { ...item("reminder"), kind: "reminder" as const, entityResolution: linked },
      { ...item("watching"), kind: "watching" as const, entityResolution: linked },
      { ...item("project-note", "note"), entityResolution: { status: "resolved" as const, projectId: PROJECT, evidence: "Existing project" } },
      { ...item("ambiguous"), entityResolution: { status: "ambiguous" as const, candidates: [{ kind: "person" as const, id: PERSON, evidence: "Ambiguous" }] } },
      { ...item("clarify", "note"), entityResolution: linked, clarification: { question: "Interpretation failed" }, confidence: 0 },
      { ...item("exact"), entityResolution: linked, timing: { kind: "exact-instant" as const, originalWording: "at 3", instantAt: "2026-09-29T15:00:00-04:00", timezone: "America/New_York" } },
    ];
    delete items[0].entityResolution.projectId;
    const result = await commitCapture({ async loadAuthority() { return { ok: true, authority }; } }, {
      version: 1, captureId: request.captureId,
      items: items.map(confirmedItem => ({ itemId: confirmedItem.itemId, selected: true, mutationId: randomUUID(), confirmedItem })),
    });
    assert.equal(result.items.length, items.length);
    assert.ok(result.items.every(row => row.status === "needs-review"));
  });

  it("does not turn invalid or failed interpretation into a Note card", async () => {
    for (const model of [brain("invalid json"), { ...brain(""), async complete(): Promise<never> { throw new Error("Model unavailable"); } }]) {
      const proposed = await interpretCapture({ brain: model, world: world() }, request);
      assert.throws(() => startReview(proposed, request.captureId), /interpretation needs review/);
    }
  });
});

import { OpenAiSolBrain } from "../concierge-sol/openai";
import { conciergeForegroundModel } from "../concierge-sol/models";

it("uses the production Responses path with no tools, no Calendar writes, and explicit model selection", async () => {
  const original = globalThis.fetch;
  const models: string[] = [];
  globalThis.fetch = (async (url, init) => {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.tools, []);
    assert.match(body.instructions, /sourceExcerpt/);
    models.push(body.model);
    return new Response(JSON.stringify({ output_text: JSON.stringify(proposal([item("action")])), model: body.model }));
  }) as typeof fetch;
  try {
    for (const model of [conciergeForegroundModel(), conciergeForegroundModel("gpt-6-sol")]) {
      const result = await interpretCapture({ brain: new OpenAiSolBrain("test-only", model), world: world() }, request);
      assert.equal(result.items[0].confidence, 0.9);
    }
    assert.deepEqual(models, ["gpt-5.6-sol", "gpt-6-sol"]);
  } finally {
    globalThis.fetch = original;
  }
});
