import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  applyFounderOperation,
  proposeFounderOperation,
  correctionEventsFromNotes,
} from "./founder-command";
import { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/types";
import { InMemoryProjectJobStore } from "@/lib/continuum/client-memory/project-jobs/store";
import { createInMemoryProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/writer";
import { createInMemoryClientMemoryNoteWriter } from "@/lib/continuum/client-memory/write/writer";
import { composeCosOperatingLoop } from "@/lib/continuum/chief-of-staff/operating-loop/compose";
import { composeTodayDocket } from "@/lib/continuum/chief-of-staff/operating-loop/docket";
import { fixtureJob } from "@/lib/continuum/chief-of-staff/operating-loop/fixtures";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";
const NOW = "2026-09-10T16:00:00Z";
async function world() {
  const memory = new InMemoryClientMemoryStore(),
    jobs = new InMemoryProjectJobStore();
  const entity = await memory.insertEntity({
    kind: "project",
    createdAt: NOW,
    createdBy: "founder",
  });
  const projectId = entity.record.id;
  await memory.insertProjectProfile({
    projectId,
    displayTitle: "Ben C ring",
    visibility: "internal-only",
    importRowKey: randomUUID(),
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
    projectKind: null,
  });
  const jobWriter = createInMemoryProjectJobWriter(memory, jobs, () => NOW);
  const job = fixtureJob({
    jobId: randomUUID(),
    projectId,
    subject: "Get finger size",
    associatedPersonId: null,
  });
  jobs.insertJob(job);
  const noteWriter = createInMemoryClientMemoryNoteWriter(memory);
  const projects = [
    { projectId, title: "Ben C ring", people: [] },
  ] as unknown as ProjectDeskSummary[];
  let refreshes = 0;
  const run = (
    query: string,
    overrides: Partial<Parameters<typeof applyFounderOperation>[0]> = {},
  ) =>
    applyFounderOperation({
      operation: proposeFounderOperation(query)!,
      projects,
      jobs: [jobs.getJob(job.jobId)!],
      jobWriter,
      noteWriter,
      actor: "founder",
      mutationId: randomUUID(),
      now: new Date(NOW),
      refresh: async () => {
        refreshes++;
      },
      ...overrides,
    });
  return {
    memory,
    jobs,
    job,
    jobWriter,
    noteWriter,
    projects,
    projectId,
    run,
    refreshes: () => refreshes,
  };
}
describe("explicit founder command canonical boundary", () => {
  it("C snooze writes canonical job, refreshes, suppresses until exact expiry and retains row", async () => {
    const w = await world();
    const result = await w.run("Snooze Ben for 3 days.");
    assert.equal(result.status, "applied");
    assert.equal(w.refreshes(), 1);
    const stored = w.jobs.getJob(w.job.jobId)!;
    assert.equal(stored.state, "snoozed");
    assert.equal(stored.deferredUntil, "2026-09-13T16:00:00.000Z");
    const docket = (nowIso: string) =>
      composeTodayDocket(
        composeCosOperatingLoop({
          jobs: [stored],
          projects: new Map([
            [
              w.projectId,
              {
                projectId: w.projectId,
                title: "Ben C ring",
                personName: "Ben C",
                isCurrent: true,
              },
            ],
          ]),
          nowIso,
        }),
      );
    assert.equal(docket(NOW).items.length, 0);
    assert.equal(docket(NOW).queuedCount, 0);
    assert.equal(docket("2026-09-13T16:00:00.000Z").items.length, 1);
  });
  it("D ambiguous project or multiple jobs never chooses the first", async () => {
    const w = await world();
    const result = await w.run("Snooze Ben.", {
      projects: [
        ...w.projects,
        { ...w.projects[0], projectId: randomUUID(), title: "Ben second ring" },
      ],
    });
    assert.equal(result.status, "clarify");
    assert.equal(w.jobs.getJob(w.job.jobId)?.state, "open");
    assert.equal(w.refreshes(), 0);
    const multiple = await w.run("Snooze Ben for 3 days.", {
      jobs: [
        w.job,
        { ...w.job, jobId: randomUUID(), subject: "Independent invoice" },
      ],
    });
    assert.equal(multiple.status, "clarify");
  });
  it("E failed mutation reports failure and does not refresh or claim success", async () => {
    const w = await world();
    const r = await w.run("Snooze Ben for 3 days.", {
      jobWriter: {
        ...w.jobWriter,
        mutateJob: async () => ({ ok: false, reason: "unavailable" }),
      },
    });
    assert.equal(r.status, "failed");
    assert.match(r.text, /failed/i);
    assert.equal(w.refreshes(), 0);
  });
  it("applies simultaneous commands to distinct canonical jobs without losing either", async () => {
    const w = await world();
    const secondEntity = await w.memory.insertEntity({
      kind: "project",
      createdAt: NOW,
      createdBy: "founder",
    });
    await w.memory.insertProjectProfile({
      projectId: secondEntity.record.id,
      displayTitle: "Alice pendant",
      visibility: "internal-only",
      importRowKey: randomUUID(),
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: NOW,
      updatedAt: NOW,
      projectKind: null,
    });
    const aliceJob = fixtureJob({
      jobId: randomUUID(),
      projectId: secondEntity.record.id,
      subject: "Send Alice invoice",
      associatedPersonId: null,
    });
    w.jobs.insertJob(aliceJob);
    const projects = [
      ...w.projects,
      {
        projectId: secondEntity.record.id,
        title: "Alice pendant",
        people: [],
      } as unknown as ProjectDeskSummary,
    ];
    const inputs = [
      ["Resolve Ben.", randomUUID()],
      ["Snooze Alice for 3 days.", randomUUID()],
    ] as const;
    const results = await Promise.all(
      inputs.map(([query, mutationId]) =>
        applyFounderOperation({
          operation: proposeFounderOperation(query)!,
          projects,
          jobs: [w.jobs.getJob(w.job.jobId)!, w.jobs.getJob(aliceJob.jobId)!],
          jobWriter: w.jobWriter,
          noteWriter: w.noteWriter,
          actor: "founder",
          mutationId,
          now: new Date(NOW),
          refresh: async () => {},
        }),
      ),
    );
    assert.deepEqual(results.map((row) => row.status), ["applied", "applied"]);
    assert.equal(w.jobs.getJob(w.job.jobId)?.state, "resolved");
    assert.equal(w.jobs.getJob(aliceJob.jobId)?.state, "snoozed");
  });
  it("A/B explicit corrections persist as inspectable source notes and typed source events", async () => {
    const w = await world();
    let noteId = "";
    const result = await w.run(
      "Ben C is waiting on him to reply, not in a hurry — I need to get his finger size.",
      {
        noteWriter: {
          addManualNote: async (input) => {
            const r = await w.noteWriter.addManualNote(input);
            if (r.ok) noteId = r.noteId;
            return r;
          },
        },
      },
    );
    assert.equal(result.status, "applied");
    const note = await w.noteWriter.getSourceNote(noteId);
    assert.ok(note);
    const events = correctionEventsFromNotes(w.projectId, [
      { ...note, personName: null },
    ]);
    assert.equal(events.length, 1);
    assert.equal(events[0].correction?.ballHolder, "client");
    assert.equal(
      events[0].correction?.dependency,
      "client reply / finger size",
    );
    assert.ok(events[0].timestamp);
    const production = proposeFounderOperation("Flora is in manufacturing.");
    assert.equal(production?.kind, "correct");
    if (production?.kind === "correct")
      assert.equal(production.truth.stage, "in_production");
  });
  it("resolve and cancel call existing canonical mutation; no arbitrary conversation writes", async () => {
    for (const command of ["Resolve Ben.", "Cancel Ben."]) {
      const w = await world();
      assert.equal((await w.run(command)).status, "applied");
      assert.equal(
        w.jobs.getJob(w.job.jobId)?.state,
        command.startsWith("Resolve") ? "resolved" : "cancelled",
      );
    }
    for (const text of [
      "Is Ben in manufacturing?",
      "Maybe Ben is in production.",
      "Ben is not in manufacturing.",
      "I think Ben might be waiting on a reply.",
      "Thanks",
      "Please delete all jobs",
    ])
      assert.equal(proposeFounderOperation(text), null);
  });
  it("F mutation route awaits recomposition and UI requests a refresh", () => {
    const action = readFileSync(
      "app/executive-dashboard/concierge/ask-actions.ts",
      "utf8",
    );
    assert.match(action, /executeAuthenticatedFounderOperation/);
    assert.match(action, /operation, refreshTodayAfterFounderMutation/);
    assert.match(action, /result\.refresh\) revalidatePath/);
    const shell = readFileSync(
      "app/executive-dashboard/concierge/components/ask-concierge-shell.tsx",
      "utf8",
    );
    assert.match(shell, /next\.refreshToday\) router\.refresh\(\)/);
    const loader = readFileSync(
      "lib/continuum/chief-of-staff/operating-loop/load.ts",
      "utf8",
    );
    assert.match(loader, /await waitForTodayRecompute/);
    assert.match(loader, /await rebuildTodayLoop/);
    assert.match(loader, /lastKnown\.watermark === watermark/);
  });
});

describe("explicit waiting actor", () => {
  it("a shop reply remains shop-owned and a founder reply remains founder-owned", () => {
    for (const [text, actor] of [
      ["Ben is waiting on shop to reply.", "vendor_shop"],
      ["Ben is waiting on me to reply.", "founder"],
    ]) {
      const op = proposeFounderOperation(text);
      assert.equal(op?.kind, "correct");
      if (op?.kind === "correct") assert.equal(op.truth.ballHolder, actor);
    }
  });

  it("requires clarification for contradictory or corrective multi-state language", () => {
    for (const text of [
      "Waiting on Ben to reply is wrong; he already replied.",
      "Ben is waiting on shop, but actually he is waiting on the client.",
      "I think it's with the shop... actually no, I need to reply.",
      "Ben is waiting on the shop, but Ben is also waiting on me.",
    ]) {
      const operation = proposeFounderOperation(text);
      assert.equal(operation?.kind, "clarify");
    }
  });

  it("clarification operations never invoke a canonical writer", async () => {
    const w = await world();
    let writes = 0;
    const result = await w.run(
      "Waiting on Ben to reply is wrong; he already replied.",
      {
        jobWriter: {
          ...w.jobWriter,
          mutateJob: async (...args) => {
            writes += 1;
            return w.jobWriter.mutateJob(...args);
          },
        },
        noteWriter: {
          addManualNote: async (...args) => {
            writes += 1;
            return w.noteWriter.addManualNote(...args);
          },
        },
      },
    );
    assert.equal(result.status, "clarify");
    assert.equal(result.refresh, false);
    assert.equal(writes, 0);
  });
});
