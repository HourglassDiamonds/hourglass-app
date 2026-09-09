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
import { composeCurrentProjectCards } from "../open-projects/card";
import {
  groupCurrentProjects,
  operatingGroupForProject,
} from "../open-projects/operating-groups";
import type { ProjectDeskSummary } from "../project-desk/types";
import { composeCosOperatingLoop } from "../../chief-of-staff/operating-loop/compose";
import { warnDuplicateNewProject } from "./duplicate";
import { proposeGmailCandidates } from "../../gmail/candidates/propose";
import { hashEmail } from "../hashes";
import { NEW_PROJECT_CONTEXT_TOPIC } from "../../gmail/candidates/new-project";
import { GMAIL_SOURCE_SYSTEM } from "../gmail/types";
import { createInMemoryClientMemoryPersonWriter } from "../person/writer";

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

  it("stores a canonical Gmail thread id when creating from Gmail intake", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const writer = createInMemoryFounderProjectWriter(memory, jobs, () => NOW);
    const personId = await seedPerson(memory, {
      displayName: "Nathan Pearl",
      email: "nate@example.test",
    });
    const created = await writer.createProject({
      mutationId: randomUUID(),
      title: "Dagger & Pearls Pendant / Necklace",
      personId,
      projectKind: "custom_new_jewelry",
      lifecycleStage: "cad",
      gmailThreadId: "19a854e42f90344f",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const history = await memory.getProjectHistory(created.projectId);
    assert.equal(history?.gmailThreadId, "19a854e42f90344f");
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

  it("puts a founder-authorized production Project in IN PRODUCTION without an Open Job", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const people = createInMemoryClientMemoryPersonWriter(memory);
    const writer = createInMemoryFounderProjectWriter(memory, jobs, () => NOW);
    const firstPerson = await people.addManualClient({
      submissionId: randomUUID(),
      givenName: "Morgan",
      familyName: "Ellis",
      email: "morgan.ellis@example.test",
    });
    assert.equal(firstPerson.status, "created");
    if (firstPerson.status !== "created") return;
    const againPerson = await people.addManualClient({
      submissionId: randomUUID(),
      givenName: "Morgan",
      familyName: "Ellis",
      email: "morgan.ellis@example.test",
    });
    assert.deepEqual(againPerson, {
      status: "existing-person",
      personId: firstPerson.personId,
    });
    const nateId = await seedPerson(memory, {
      displayName: "Nathan Pearl",
      email: "nate@example.test",
    });
    const abbeyId = await seedPerson(memory, { displayName: "Abbey Castillo" });
    const pennockPerson = await seedPerson(memory, { displayName: "J. Pennock" });
    const nate = await writer.createProject({
      mutationId: randomUUID(),
      title: "Dagger & Pearls Pendant / Necklace",
      personId: nateId,
      projectKind: "custom_new_jewelry",
      lifecycleStage: "cad",
      actor: ACTOR,
    });
    const abbey = await writer.createProject({
      mutationId: randomUUID(),
      title: "Matching Marquise Earrings",
      personId: abbeyId,
      projectKind: "custom_new_jewelry",
      lifecycleStage: "cad",
      actor: ACTOR,
    });
    const pennock = await writer.createProject({
      mutationId: randomUUID(),
      title: "J. Pennock",
      personId: pennockPerson,
      projectKind: "custom_new_jewelry",
      lifecycleStage: "production",
      actor: ACTOR,
    });
    assert.equal(nate.ok && abbey.ok && pennock.ok, true);
    if (!nate.ok || !abbey.ok || !pennock.ok) return;

    const created = await writer.createProject({
      mutationId: randomUUID(),
      title: "Morgan Ellis — Engagement Ring",
      personId: firstPerson.personId,
      projectKind: "custom_new_jewelry",
      lifecycleStage: "production",
      gmailThreadId: "fedcba9876543210",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.status, "created");
    assert.equal(created.job, null);
    assert.equal(created.projectKind, "custom_new_jewelry");
    assert.equal(created.lifecycleStage, "production");
    const duplicate = await writer.createProject({
      mutationId: randomUUID(),
      title: "Morgan Ellis — Engagement Ring",
      personId: firstPerson.personId,
      projectKind: "custom_new_jewelry",
      lifecycleStage: "production",
      actor: ACTOR,
    });
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) {
      assert.equal(duplicate.reason, "duplicate-project");
      assert.equal(duplicate.existingProjectId, created.projectId);
    }

    const profile = await memory.getProjectProfile(created.projectId);
    const history = await memory.getProjectHistory(created.projectId);
    const state = await memory.getProjectLifecycleState(
      created.projectId,
      "custom_new_jewelry",
    );
    const events = memory.listProjectLifecycleEvents(created.projectId);
    assert.equal(profile?.projectKind, "custom_new_jewelry");
    assert.equal(history?.gmailThreadId, "fedcba9876543210");
    assert.equal(state?.stage, "production");
    assert.equal(events.some((row) => row.newStage === "production"), true);
    assert.equal(jobs.listJobs().length, 0);

    const vendorMail = proposeGmailCandidates({
      createdAt: NOW,
      world: {
        people: [],
        projects: [
          {
            projectId: created.projectId,
            title: created.title,
            gmailThreadId: "1111222233334444",
            cadJobNumber: "CR5000971",
            orderNumber: null,
            fingerSize: null,
            metal: null,
            centerStone: null,
            diamondSupplyNotes: null,
            personIds: [firstPerson.personId],
            founderApprovedCurrent: true,
            projectKind: "custom_new_jewelry",
            lifecycleStage: "cad",
          },
        ],
        internalEmailHashes: [],
      },
      evidence: [
        {
          indexed: {
            messageId: "m-vendor-forward",
            threadId: "1111222233334444",
            sentAt: NOW,
            indexedAt: NOW,
            subject: "HGD - moving forward",
            fromEmailHash: hashEmail("vendor@example.test"),
            toEmailHashes: [],
            ccEmailHashes: [],
            bccEmailHashes: [],
            direction: "outbound",
            labelIds: ["SENT"],
            hasAttachments: false,
            sourceSystem: GMAIL_SOURCE_SYSTEM,
          },
          plaintext:
            "Moving forward with the original version. The center stone is being sent today.",
          fromEmailHash: hashEmail("justin@example.test"),
        },
      ],
    });
    assert.equal(
      vendorMail.candidates.some(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
      ),
      false,
    );
    assert.equal(
      (await memory.getProjectLifecycleState(created.projectId, "custom_new_jewelry"))
        ?.stage,
      "production",
    );
    assert.equal(jobs.listJobs().length, 0);

    const summaries = [
      deskSummary({
        projectId: nate.projectId,
        title: nate.title,
        personId: nateId,
        personName: "Nathan Pearl",
        projectKind: "custom_new_jewelry",
        lifecycleStage: "cad",
        unresolvedCount: 0,
      }),
      deskSummary({
        projectId: abbey.projectId,
        title: abbey.title,
        personId: abbeyId,
        personName: "Abbey Castillo",
        projectKind: "custom_new_jewelry",
        lifecycleStage: "cad",
        unresolvedCount: 0,
      }),
      deskSummary({
        projectId: pennock.projectId,
        title: pennock.title,
        personId: pennockPerson,
        personName: "J. Pennock",
        projectKind: "custom_new_jewelry",
        lifecycleStage: "production",
        unresolvedCount: 0,
      }),
      deskSummary({
        projectId: created.projectId,
        title: created.title,
        personId: firstPerson.personId,
        personName: "Morgan Ellis",
        projectKind: "custom_new_jewelry",
        lifecycleStage: "production",
        unresolvedCount: 0,
      }),
    ];
    const current = selectOpenProjectWork(summaries);
    assert.deepEqual(
      current.map((row) => row.title),
      [
        "Dagger & Pearls Pendant / Necklace",
        "J. Pennock",
        "Matching Marquise Earrings",
        "Morgan Ellis — Engagement Ring",
      ],
    );
    const cards = composeCurrentProjectCards(summaries, new Map());
    assert.equal(
      operatingGroupForProject(cards.find((row) => row.projectId === created.projectId)!),
      "in_production",
    );
    assert.equal(
      operatingGroupForProject(cards.find((row) => row.projectId === pennock.projectId)!),
      "in_production",
    );
    assert.equal(
      operatingGroupForProject(cards.find((row) => row.projectId === nate.projectId)!),
      "cad_design",
    );
    assert.equal(
      operatingGroupForProject(cards.find((row) => row.projectId === abbey.projectId)!),
      "cad_design",
    );
    const grouped = groupCurrentProjects(cards, { nowIso: NOW, viewport: "desktop" });
    assert.deepEqual(
      grouped.find((group) => group.id === "in_production")?.projects.map((row) => row.title),
      ["J. Pennock", "Morgan Ellis — Engagement Ring"],
    );
    assert.equal(grouped.some((group) => group.id === "your_turn"), false);
    const loop = composeCosOperatingLoop({
      nowIso: NOW,
      jobs: jobs.listJobs(),
      projects: new Map(
        current.map((row) => [
          row.projectId,
          {
            projectId: row.projectId,
            title: row.title,
            personName: row.people[0]?.displayName ?? row.title,
            isCurrent: true,
          },
        ]),
      ),
      candidates: [],
      newMutationId: () => randomUUID(),
    });
    assert.equal(loop.top5.length, 0);
    const counts = await memory.inspectCounts();
    assert.equal(counts.persons, 4);
    assert.equal(counts.projects, 4);
  });
});
