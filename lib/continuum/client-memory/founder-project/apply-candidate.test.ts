import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";
import { InMemoryClientMemoryStore } from "../store";
import { InMemoryProjectJobStore } from "../project-jobs/store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "../types";
import { createInMemoryFounderProjectWriter } from "./writer";
import { applyGmailNewProjectCandidate } from "./apply-candidate";
import { presentGmailNewProjectIntake } from "./intake-present";
import { proposeGmailCandidates } from "../../gmail/candidates/propose";
import { hashEmail } from "../hashes";
import { GMAIL_SOURCE_SYSTEM } from "../gmail/types";
import { selectOpenProjectWork } from "../open-projects/select";
import type { ProjectDeskSummary } from "../project-desk/types";
import { composeCosOperatingLoop } from "../../chief-of-staff/operating-loop/compose";

const NOW = "2026-09-08T16:00:00.000Z";

async function seedPerson(store: InMemoryClientMemoryStore, displayName: string, email: string) {
  const person = await store.insertEntity({
    kind: "person",
    createdAt: NOW,
    createdBy: "test",
  });
  await store.insertPersonProfile({
    personId: person.record.id,
    displayName,
    givenName: displayName.split(" ")[0] ?? displayName,
    familyName: displayName.split(" ").slice(1).join(" "),
    organizationName: null,
    email,
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

describe("Founder-approved Gmail new-project Candidate", () => {
  it("creates the Project only after founder approval and does not mint a waiting Open Job", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const writer = createInMemoryFounderProjectWriter(memory, jobs, () => NOW);
    const candidates = new InMemoryCandidateStore();
    const personId = await seedPerson(memory, "Nathan Pearl", "nate@example.test");
    const proposed = proposeGmailCandidates({
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
            subject: "Another piece",
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
    });
    for (const row of proposed.candidates) {
      await candidates.put(row);
    }
    const cards = presentGmailNewProjectIntake(await candidates.list());
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.title, "Dagger & Pearls Pendant / Necklace");
    assert.equal(cards[0]?.personId, personId);
    const applied = await applyGmailNewProjectCandidate({
      store: candidates,
      writer,
      body: {
        candidateId: cards[0]!.candidateId,
        personId,
        title: cards[0]!.title,
        projectKind: "custom_new_jewelry",
        lifecycleStage: "discovery",
        actor: "justin",
        mutationId: randomUUID(),
      },
    });
    assert.equal(applied.ok, true);
    if (!applied.ok) return;
    const current = selectOpenProjectWork([
      {
        projectId: applied.projectId,
        title: applied.create.title,
        projectKind: "custom_new_jewelry",
        people: [{ personId, displayName: "Nathan Pearl" }],
        latestNoteAt: null,
        latestNotePreview: null,
        coverage: {
          people: "available",
          specs: "sparse",
          notes: "none",
          jobs: "none",
          files: "none",
          email: "not-connected",
        },
        recordCreatedAt: NOW,
        projectWork: {
          connected: true,
          unresolvedCount: 0,
          activeCount: 0,
          deferredCount: 0,
          waitingOn: { founder: 0, hourglass: 0, client: 0, vendor: 0, unknown: 0 },
          blocked: false,
          dueSoonCount: 0,
          pastDueCount: 0,
          forgottenRiskCount: 0,
          nextDueAt: null,
        },
        lifecycleStage: "discovery",
        lifecycleLabel: "Discovery",
      } satisfies ProjectDeskSummary,
    ]);
    assert.equal(current.length, 1);
    const loop = composeCosOperatingLoop({
      nowIso: NOW,
      jobs: jobs.listJobs(),
      projects: new Map([
        [
          applied.projectId,
          {
            projectId: applied.projectId,
            title: applied.create.title,
            personName: "Nathan Pearl",
            isCurrent: true,
          },
        ],
      ]),
      candidates: [],
      newMutationId: () => randomUUID(),
    });
    assert.equal(loop.top5.length, 0);
    const reviewed = await candidates.get(cards[0]!.candidateId);
    assert.equal(reviewed?.reviewStatus, "approved");
  });
});
