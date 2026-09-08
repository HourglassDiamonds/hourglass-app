import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryClientMemoryStore } from "../store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "../types";
import { InMemoryProjectJobStore } from "../project-jobs/store";
import { createInMemoryFounderProjectWriter, founderProjectDeps } from "./writer";
import { createFounderProject } from "./create";
import { createInMemoryProjectJobWriter } from "../project-jobs/writer";
import { selectOpenProjectWork } from "../open-projects/select";
import type { ProjectDeskSummary } from "../project-desk/types";
import { composeCosOperatingLoop } from "../../chief-of-staff/operating-loop/compose";
import { warnDuplicateNewProject } from "./duplicate";
import { proposeGmailCandidates } from "../../gmail/candidates/propose";
import { hashEmail } from "../hashes";
import { NEW_PROJECT_CONTEXT_TOPIC } from "../../gmail/candidates/new-project";
import { GMAIL_SOURCE_SYSTEM } from "../gmail/types";

const NOW = "2026-09-08T16:00:00.000Z";
const ACTOR = "justin";

async function seedPerson(
  store: InMemoryClientMemoryStore,
  extra: {
    displayName: string;
    email?: string | null;
    givenName?: string;
    familyName?: string;
  },
) {
  const person = await store.insertEntity({
    kind: "person",
    createdAt: NOW,
    createdBy: "test",
  });
  await store.insertPersonProfile({
    personId: person.record.id,
    displayName: extra.displayName,
    givenName: extra.givenName ?? extra.displayName.split(" ")[0] ?? extra.displayName,
    familyName: extra.familyName ?? extra.displayName.split(" ").slice(1).join(" "),
    organizationName: null,
    email: extra.email ?? null,
    phone: null,
    streetAddress: null,
    city: null,
    state: null,
    country: null,
    postalCode: null,
    roles: ["client"],
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  });
  return person.record.id;
}

function deskSummary(input: {
  projectId: string;
  title: string;
  personId: string;
  personName: string;
  projectKind: "custom_new_jewelry";
  lifecycleStage: string;
  unresolvedCount: number;
}): ProjectDeskSummary {
  return {
    projectId: input.projectId,
    title: input.title,
    projectKind: input.projectKind,
    people: [{ personId: input.personId, displayName: input.personName }],
    latestNoteAt: null,
    latestNotePreview: null,
    coverage: {
      people: "available",
      specs: "sparse",
      notes: "none",
      jobs: input.unresolvedCount > 0 ? "available" : "none",
      files: "none",
      email: "not-connected",
    },
    recordCreatedAt: NOW,
    projectWork:
      input.unresolvedCount > 0
        ? {
            connected: true,
            unresolvedCount: input.unresolvedCount,
            activeCount: input.unresolvedCount,
            deferredCount: 0,
            waitingOn: {
              founder: input.unresolvedCount,
              hourglass: 0,
              client: 0,
              vendor: 0,
              unknown: 0,
            },
            blocked: false,
            dueSoonCount: 0,
            pastDueCount: 0,
            forgottenRiskCount: 0,
            nextDueAt: null,
          }
        : { connected: true, unresolvedCount: 0, activeCount: 0, deferredCount: 0, waitingOn: { founder: 0, hourglass: 0, client: 0, vendor: 0, unknown: 0 }, blocked: false, dueSoonCount: 0, pastDueCount: 0, forgottenRiskCount: 0, nextDueAt: null },
    lifecycleStage: input.lifecycleStage,
    lifecycleLabel: "Discovery",
  };
}

describe("Founder-created Project", () => {
  it("creates a client-first Project that qualifies for Current Projects without a hidden general project", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const writer = createInMemoryFounderProjectWriter(memory, jobs, () => NOW);
    const personId = await seedPerson(memory, {
      displayName: "Nathan Pearl",
      email: "nate@example.test",
    });
    const mutationId = randomUUID();
    const created = await writer.createProject({
      mutationId,
      title: "Dagger & Pearls Pendant / Necklace",
      personId,
      projectKind: "custom_new_jewelry",
      lifecycleStage: "discovery",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.status, "created");
    assert.equal(created.job, null);
    const profile = await memory.getProjectProfile(created.projectId);
    assert.equal(profile?.displayTitle, "Dagger & Pearls Pendant / Necklace");
    assert.equal(profile?.projectKind, "custom_new_jewelry");
    assert.equal(profile?.sourceSystem, "concierge-manual");
    const linked = await memory.hasActiveClientProjectLink(personId, created.projectId);
    assert.equal(linked, true);
    const current = selectOpenProjectWork([
      deskSummary({
        projectId: created.projectId,
        title: created.title,
        personId,
        personName: "Nathan Pearl",
        projectKind: "custom_new_jewelry",
        lifecycleStage: "discovery",
        unresolvedCount: 0,
      }),
    ]);
    assert.equal(current.length, 1);
    assert.equal(current[0]?.projectId, created.projectId);
    const loop = composeCosOperatingLoop({
      nowIso: NOW,
      jobs: jobs.listJobs(),
      projects: new Map([
        [
          created.projectId,
          {
            projectId: created.projectId,
            title: created.title,
            personName: "Nathan Pearl",
            isCurrent: true,
          },
        ],
      ]),
      candidates: [],
      newMutationId: () => randomUUID(),
    });
    assert.equal(loop.top5.length, 0);
  });

  it("creates an Open Job only when the founder enters an action", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const writer = createInMemoryFounderProjectWriter(memory, jobs, () => NOW);
    const personId = await seedPerson(memory, { displayName: "Abbey Castillo" });
    const created = await writer.createProject({
      mutationId: randomUUID(),
      title: "Matching Marquise Earrings",
      personId,
      projectKind: "custom_new_jewelry",
      lifecycleStage: "discovery",
      subject: "Confirm flower vs diamond center",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.job?.ok, true);
    if (!created.job?.ok) return;
    assert.equal(created.job.job.subject, "Confirm flower vs diamond center");
    assert.equal(created.job.job.waitingOnActor, "founder");
    const loop = composeCosOperatingLoop({
      nowIso: NOW,
      jobs: jobs.listJobs(),
      projects: new Map([
        [
          created.projectId,
          {
            projectId: created.projectId,
            title: created.title,
            personName: "Abbey Castillo",
            isCurrent: true,
          },
        ],
      ]),
      candidates: [],
      newMutationId: () => randomUUID(),
    });
    assert.equal(loop.top5.length, 1);
    assert.equal(loop.top5[0]?.action.includes("Confirm flower"), true);
  });

  it("refuses duplicate Project titles for the same Person and does not invent a general project", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const writer = createInMemoryFounderProjectWriter(memory, jobs, () => NOW);
    const personId = await seedPerson(memory, { displayName: "Nathan Pearl" });
    const first = await writer.createProject({
      mutationId: randomUUID(),
      title: "Dagger & Pearls Pendant / Necklace",
      personId,
      projectKind: "custom_new_jewelry",
      lifecycleStage: "discovery",
      actor: ACTOR,
    });
    assert.equal(first.ok, true);
    const again = await writer.createProject({
      mutationId: randomUUID(),
      title: "Dagger & Pearls Pendant / Necklace",
      personId,
      projectKind: "custom_new_jewelry",
      lifecycleStage: "discovery",
      actor: ACTOR,
    });
    assert.equal(again.ok, false);
    if (again.ok) return;
    assert.equal(again.reason, "duplicate-project");
    const linked = await writer.listActiveClientProjects(personId);
    assert.equal(linked.length, 1);
  });

  it("warns when CoS already proposed the same new Project", () => {
    const personId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const pending = proposeGmailCandidates({
      createdAt: NOW,
      world: {
        people: [
          {
            personId,
            displayName: "Nathan Pearl",
            emailHash: hashEmail("nate@example.test"),
            role: "client",
            projectIds: [],
          },
        ],
        projects: [],
        internalEmailHashes: [],
      },
      evidence: [
        {
          indexed: {
            messageId: "m-nate",
            threadId: "t-nate",
            sentAt: NOW,
            indexedAt: NOW,
            subject: "New piece",
            fromEmailHash: hashEmail("nate@example.test"),
            toEmailHashes: [],
            ccEmailHashes: [],
            bccEmailHashes: [],
            direction: "inbound",
            labelIds: ["INBOX"],
            hasAttachments: false,
            sourceSystem: GMAIL_SOURCE_SYSTEM,
          },
          plaintext:
            "I'd like to work together again to create another piece. A dagger and pearls necklace.",
        },
      ],
    }).candidates;
    const warning = warnDuplicateNewProject({
      title: "Dagger & Pearls Pendant / Necklace",
      personId,
      existing: [],
      pendingCandidates: pending,
    });
    assert.equal(warning?.kind, "pending-candidate");
    assert.equal(
      pending.some(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
      ),
      true,
    );
  });

  it("rejects Gmail waiting_on_client as a persisted lifecycle enum", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const writer = createInMemoryFounderProjectWriter(memory, jobs, () => NOW);
    const personId = await seedPerson(memory, { displayName: "Nathan Pearl" });
    const created = await writer.createProject({
      mutationId: randomUUID(),
      title: "Dagger & Pearls Pendant / Necklace",
      personId,
      projectKind: "custom_new_jewelry",
      lifecycleStage: "waiting_on_client",
      actor: ACTOR,
    });
    assert.equal(created.ok, false);
    if (!created.ok) assert.equal(created.code, "invalid-lifecycle");
  });

  it("fails visibly without a lifecycle stage, profile, or Person link", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const writer = createInMemoryFounderProjectWriter(memory, jobs, () => NOW);
    const personId = await seedPerson(memory, { displayName: "Abbey Castillo" });
    const missingStage = await writer.createProject({
      mutationId: randomUUID(),
      title: "Matching Marquise Earrings",
      personId,
      projectKind: "custom_new_jewelry",
      actor: ACTOR,
    });
    assert.equal(missingStage.ok, false);
    if (!missingStage.ok) assert.equal(missingStage.code, "lifecycle-required");

    const jobWriter = createInMemoryProjectJobWriter(memory, jobs, () => NOW);
    const deps = founderProjectDeps(memory, jobWriter, () => NOW);
    const missingLink = await createFounderProject(
      {
        ...deps,
        insertRelationship: async () => {
          throw new Error("link-failed");
        },
      },
      {
        mutationId: randomUUID(),
        title: "Matching Marquise Earrings",
        personId,
        projectKind: "custom_new_jewelry",
        lifecycleStage: "cad",
        actor: ACTOR,
      },
    );
    assert.equal(missingLink.ok, false);
    if (!missingLink.ok) assert.equal(missingLink.reason, "unavailable");
  });

  it("does not report success when lifecycle write fails, then completes on retry", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const jobWriter = createInMemoryProjectJobWriter(memory, jobs, () => NOW);
    const deps = founderProjectDeps(memory, jobWriter, () => NOW);
    const personId = await seedPerson(memory, { displayName: "Nathan Pearl" });
    const mutationId = randomUUID();
    let failLifecycle = true;
    const wrapped = {
      ...deps,
      setProjectLifecycle: async (
        input: Parameters<typeof deps.setProjectLifecycle>[0],
      ) => {
        if (failLifecycle) {
          failLifecycle = false;
          return { ok: false as const, reason: "unavailable" as const };
        }
        return deps.setProjectLifecycle(input);
      },
    };
    const first = await createFounderProject(wrapped, {
      mutationId,
      title: "Dagger & Pearls Pendant / Necklace",
      personId,
      projectKind: "custom_new_jewelry",
      lifecycleStage: "cad",
      actor: ACTOR,
    });
    assert.equal(first.ok, false);
    if (!first.ok) assert.equal(first.reason, "unavailable");
    const counts = await memory.inspectCounts();
    assert.equal(counts.projects, 1);
    const linked = await deps.listActiveClientProjects(personId);
    assert.equal(linked.length, 1);
    const before = await memory.getProjectLifecycleState(
      linked[0]!.projectId,
      "custom_new_jewelry",
    );
    assert.equal(before, null);

    const retry = await createFounderProject(wrapped, {
      mutationId,
      title: "Dagger & Pearls Pendant / Necklace",
      personId,
      projectKind: "custom_new_jewelry",
      lifecycleStage: "cad",
      actor: ACTOR,
    });
    assert.equal(retry.ok, true);
    if (!retry.ok) return;
    assert.equal(retry.status, "already-present");
    assert.equal(retry.projectId, linked[0]?.projectId);
    const state = await memory.getProjectLifecycleState(
      retry.projectId,
      "custom_new_jewelry",
    );
    assert.equal(state?.stage, "cad");
    const current = selectOpenProjectWork([
      deskSummary({
        projectId: retry.projectId,
        title: retry.title,
        personId,
        personName: "Nathan Pearl",
        projectKind: "custom_new_jewelry",
        lifecycleStage: "cad",
        unresolvedCount: 0,
      }),
    ]);
    assert.equal(current.length, 1);
  });
});
