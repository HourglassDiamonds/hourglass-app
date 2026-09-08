import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";
import { InMemoryClientMemoryStore } from "../store";
import { InMemoryProjectJobStore } from "../project-jobs/store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "../types";
import { createInMemoryFounderProjectWriter } from "./writer";
import { applyGmailNewProjectCandidate } from "./apply-candidate";
import { confirmGmailPersonAssociation } from "./identity-gate";
import { presentGmailNewProjectIntake } from "./intake-present";
import { proposeGmailCandidates } from "../../gmail/candidates/propose";
import { hashEmail } from "../hashes";
import { GMAIL_SOURCE_SYSTEM } from "../gmail/types";
import { selectOpenProjectWork } from "../open-projects/select";
import type { ProjectDeskSummary } from "../project-desk/types";
import { composeCosOperatingLoop } from "../../chief-of-staff/operating-loop/compose";

const NOW = "2026-09-08T16:00:00.000Z";
const NATE_EMAIL = "nate@example.test";
const CASTILLO_EMAIL = "serinitybloom@gmail.com";
const WAGNER_EMAIL = "abbey.wagner@example.test";

async function seedPerson(
  store: InMemoryClientMemoryStore,
  displayName: string,
  email: string,
) {
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

function inboundEvidence(input: {
  messageId: string;
  threadId: string;
  fromEmail: string;
  plaintext: string;
}) {
  return {
    indexed: {
      messageId: input.messageId,
      threadId: input.threadId,
      sentAt: NOW,
      indexedAt: NOW,
      subject: "Another piece",
      fromEmailHash: hashEmail(input.fromEmail),
      toEmailHashes: [],
      ccEmailHashes: [],
      bccEmailHashes: [],
      direction: "inbound" as const,
      labelIds: ["INBOX"],
      hasAttachments: false,
      sourceSystem: GMAIL_SOURCE_SYSTEM,
    },
    plaintext: input.plaintext,
  };
}

describe("Founder-approved Gmail new-project Candidate", () => {
  it("blocks Project create on raw email hash until Person confirmation", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const writer = createInMemoryFounderProjectWriter(memory, jobs, () => NOW);
    const candidates = new InMemoryCandidateStore();
    const personId = await seedPerson(memory, "Nathan Pearl", NATE_EMAIL);
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: {
        people: [
          {
            personId,
            displayName: "Nathan Pearl",
            emailHash: hashEmail(NATE_EMAIL),
            role: "client",
            projectIds: [],
          },
        ],
        projects: [],
        internalEmailHashes: [],
      },
      evidence: [
        inboundEvidence({
          messageId: "m-nate",
          threadId: "t-nate",
          fromEmail: NATE_EMAIL,
          plaintext:
            "I'd like to work together again to create another piece. A dagger and pearls necklace.",
        }),
      ],
    });
    for (const row of proposed.candidates) {
      await candidates.put(row);
    }
    const personHit = proposed.candidates.find(
      (row) => row.candidateType === "person_association",
    );
    assert.equal(personHit?.proposedTarget.kind, "person");
    if (personHit?.proposedTarget.kind === "person") {
      assert.equal(personHit.proposedTarget.personId, null);
    }
    const cards = presentGmailNewProjectIntake(await candidates.list(), [
      { personId, displayName: "Nathan Pearl", email: NATE_EMAIL },
    ]);
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.title, "Dagger & Pearls Pendant / Necklace");
    assert.equal(cards[0]?.identityConfirmed, false);
    assert.equal(cards[0]?.personId, null);
    assert.equal(cards[0]?.possiblePersonId, personId);
    const blocked = await applyGmailNewProjectCandidate({
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
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.reason, "identity-unconfirmed");
    const confirmed = await confirmGmailPersonAssociation({
      store: candidates,
      personExists: async (id) => Boolean(await memory.getPersonProfile(id)),
      body: {
        candidateId: cards[0]!.personAssociationCandidateId!,
        personId,
        actor: "justin",
      },
      nowIso: NOW,
    });
    assert.equal(confirmed.ok, true);
    if (confirmed.ok) {
      assert.equal(confirmed.candidate.payload.kind === "person_association" && confirmed.candidate.payload.mintPerson, false);
      assert.equal(confirmed.candidate.payload.kind === "person_association" && confirmed.candidate.payload.mergePersons, false);
    }
    const afterConfirm = presentGmailNewProjectIntake(await candidates.list(), [
      { personId, displayName: "Nathan Pearl", email: NATE_EMAIL },
    ]);
    assert.equal(afterConfirm[0]?.identityConfirmed, true);
    assert.equal(afterConfirm[0]?.personId, personId);
    const applied = await applyGmailNewProjectCandidate({
      store: candidates,
      writer,
      body: {
        candidateId: afterConfirm[0]!.candidateId,
        personId,
        title: afterConfirm[0]!.title,
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
    const reviewed = await candidates.get(afterConfirm[0]!.candidateId);
    assert.equal(reviewed?.reviewStatus, "approved");
  });

  it("lets a confirmed mapping target the proposal without minting a Person", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const writer = createInMemoryFounderProjectWriter(memory, jobs, () => NOW);
    const candidates = new InMemoryCandidateStore();
    const personId = await seedPerson(memory, "Nathan Pearl", NATE_EMAIL);
    const beforePeople = (await memory.inspectCounts()).persons;
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: {
        people: [
          {
            personId,
            displayName: "Nathan Pearl",
            emailHash: hashEmail(NATE_EMAIL),
            role: "client",
            projectIds: [],
          },
        ],
        projects: [],
        internalEmailHashes: [],
        confirmedParticipantMappings: [
          { emailHash: hashEmail(NATE_EMAIL)!, personId },
        ],
      },
      evidence: [
        inboundEvidence({
          messageId: "m-mapped",
          threadId: "t-mapped",
          fromEmail: NATE_EMAIL,
          plaintext:
            "I'd like to work together again to create another piece. A dagger and pearls necklace.",
        }),
      ],
    });
    for (const row of proposed.candidates) {
      await candidates.put(row);
    }
    const cards = presentGmailNewProjectIntake(await candidates.list(), [
      { personId, displayName: "Nathan Pearl", email: NATE_EMAIL },
    ]);
    assert.equal(cards[0]?.identityConfirmed, true);
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
    assert.equal((await memory.inspectCounts()).persons, beforePeople);
  });

  it("keeps Abbey's proposal unresolved until Castillo is confirmed, never Wagner", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const writer = createInMemoryFounderProjectWriter(memory, jobs, () => NOW);
    const candidates = new InMemoryCandidateStore();
    const castillo = await seedPerson(memory, "Abbey Castillo", CASTILLO_EMAIL);
    const wagner = await seedPerson(memory, "Abbey Wagner", WAGNER_EMAIL);
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: {
        people: [
          {
            personId: castillo,
            displayName: "Abbey Castillo",
            emailHash: hashEmail(CASTILLO_EMAIL),
            role: "client",
            projectIds: [],
          },
          {
            personId: wagner,
            displayName: "Abbey Wagner",
            emailHash: hashEmail(WAGNER_EMAIL),
            role: "client",
            projectIds: [],
          },
        ],
        projects: [],
        internalEmailHashes: [],
      },
      evidence: [
        inboundEvidence({
          messageId: "m-abbey",
          threadId: "t-abbey",
          fromEmail: CASTILLO_EMAIL,
          plaintext:
            "I'm reaching back out to ask about a new piece I'd like designed. Matching marquise earrings.",
        }),
      ],
    });
    for (const row of proposed.candidates) {
      await candidates.put(row);
    }
    const cards = presentGmailNewProjectIntake(await candidates.list(), [
      { personId: castillo, displayName: "Abbey Castillo", email: CASTILLO_EMAIL },
      { personId: wagner, displayName: "Abbey Wagner", email: WAGNER_EMAIL },
    ]);
    assert.equal(cards[0]?.title, "Matching Marquise Earrings");
    assert.equal(cards[0]?.identityConfirmed, false);
    assert.equal(cards[0]?.possiblePersonId, castillo);
    assert.notEqual(cards[0]?.possiblePersonId, wagner);
    const mismatch = await applyGmailNewProjectCandidate({
      store: candidates,
      writer,
      body: {
        candidateId: cards[0]!.candidateId,
        personId: wagner,
        title: cards[0]!.title,
        projectKind: "custom_new_jewelry",
        actor: "justin",
        mutationId: randomUUID(),
      },
    });
    assert.equal(mismatch.ok, false);
    if (!mismatch.ok) assert.equal(mismatch.reason, "identity-unconfirmed");
    const confirmed = await confirmGmailPersonAssociation({
      store: candidates,
      personExists: async (id) => Boolean(await memory.getPersonProfile(id)),
      body: {
        candidateId: cards[0]!.personAssociationCandidateId!,
        personId: castillo,
        actor: "justin",
      },
      nowIso: NOW,
    });
    assert.equal(confirmed.ok, true);
    const wagnerApply = await applyGmailNewProjectCandidate({
      store: candidates,
      writer,
      body: {
        candidateId: cards[0]!.candidateId,
        personId: wagner,
        title: cards[0]!.title,
        projectKind: "custom_new_jewelry",
        actor: "justin",
        mutationId: randomUUID(),
      },
    });
    assert.equal(wagnerApply.ok, false);
    if (!wagnerApply.ok) assert.equal(wagnerApply.reason, "person-mismatch");
    const applied = await applyGmailNewProjectCandidate({
      store: candidates,
      writer,
      body: {
        candidateId: cards[0]!.candidateId,
        personId: castillo,
        title: cards[0]!.title,
        projectKind: "custom_new_jewelry",
        lifecycleStage: "discovery",
        actor: "justin",
        mutationId: randomUUID(),
      },
    });
    assert.equal(applied.ok, true);
    if (!applied.ok) return;
    const linked = await writer.listActiveClientProjects(castillo);
    assert.equal(linked.some((row) => row.projectId === applied.projectId), true);
    const wagnerProjects = await writer.listActiveClientProjects(wagner);
    assert.equal(wagnerProjects.length, 0);
  });

  it("requires explicit confirmation before creating a semantic duplicate with a different title", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const writer = createInMemoryFounderProjectWriter(memory, jobs, () => NOW);
    const candidates = new InMemoryCandidateStore();
    const personId = await seedPerson(memory, "Nathan Pearl", NATE_EMAIL);
    const first = await writer.createProject({
      mutationId: randomUUID(),
      title: "Dagger pearls necklace",
      personId,
      projectKind: "custom_new_jewelry",
      lifecycleStage: "discovery",
      actor: "justin",
    });
    assert.equal(first.ok, true);
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: {
        people: [
          {
            personId,
            displayName: "Nathan Pearl",
            emailHash: hashEmail(NATE_EMAIL),
            role: "client",
            projectIds: first.ok ? [first.projectId] : [],
          },
        ],
        projects: [],
        internalEmailHashes: [],
        confirmedParticipantMappings: [
          { emailHash: hashEmail(NATE_EMAIL)!, personId },
        ],
      },
      evidence: [
        inboundEvidence({
          messageId: "m-dup",
          threadId: "t-dup",
          fromEmail: NATE_EMAIL,
          plaintext:
            "I'd like to work together again to create another piece. A dagger and pearls necklace.",
        }),
      ],
    });
    for (const row of proposed.candidates) {
      await candidates.put(row);
    }
    const cards = presentGmailNewProjectIntake(await candidates.list());
    const warned = await applyGmailNewProjectCandidate({
      store: candidates,
      writer,
      body: {
        candidateId: cards[0]!.candidateId,
        personId,
        title: "Dagger & Pearls Pendant / Necklace",
        projectKind: "custom_new_jewelry",
        lifecycleStage: "discovery",
        actor: "justin",
        mutationId: randomUUID(),
      },
    });
    assert.equal(warned.ok, false);
    if (!warned.ok) {
      assert.equal(warned.reason, "possible-existing");
      assert.equal(warned.existingTitle, "Dagger pearls necklace");
    }
    const created = await applyGmailNewProjectCandidate({
      store: candidates,
      writer,
      body: {
        candidateId: cards[0]!.candidateId,
        personId,
        title: "Dagger & Pearls Pendant / Necklace",
        projectKind: "custom_new_jewelry",
        lifecycleStage: "discovery",
        actor: "justin",
        mutationId: randomUUID(),
        confirmPossibleExisting: true,
      },
    });
    assert.equal(created.ok, true);
  });

  it("preserves unresolved Nate evidence when People are unavailable, then unlocks after confirmation", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const writer = createInMemoryFounderProjectWriter(memory, jobs, () => NOW);
    const candidates = new InMemoryCandidateStore();
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: { people: [], projects: [], internalEmailHashes: [] },
      evidence: [
        inboundEvidence({
          messageId: "m-nate-unresolved",
          threadId: "t-nate-unresolved",
          fromEmail: NATE_EMAIL,
          plaintext:
            "I'd like to work together again to create another piece. A dagger and pearls necklace.",
        }),
      ],
    });
    for (const row of proposed.candidates) {
      await candidates.put(row);
    }
    const emptyCards = presentGmailNewProjectIntake(await candidates.list(), []);
    assert.equal(emptyCards[0]?.title, "Dagger & Pearls Pendant / Necklace");
    assert.equal(emptyCards[0]?.identityConfirmed, false);
    assert.equal(emptyCards[0]?.personId, null);
    const blocked = await applyGmailNewProjectCandidate({
      store: candidates,
      writer,
      body: {
        candidateId: emptyCards[0]!.candidateId,
        personId: "",
        title: emptyCards[0]!.title,
        projectKind: "custom_new_jewelry",
        actor: "justin",
        mutationId: randomUUID(),
      },
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.reason, "identity-unconfirmed");
    const personId = await seedPerson(memory, "Nathan Pearl", NATE_EMAIL);
    const laterCards = presentGmailNewProjectIntake(await candidates.list(), [
      { personId, displayName: "Nathan Pearl", email: NATE_EMAIL },
    ]);
    const confirmed = await confirmGmailPersonAssociation({
      store: candidates,
      personExists: async (id) => Boolean(await memory.getPersonProfile(id)),
      body: {
        candidateId: laterCards[0]!.personAssociationCandidateId!,
        personId,
        actor: "justin",
      },
      nowIso: NOW,
    });
    assert.equal(confirmed.ok, true);
    const applied = await applyGmailNewProjectCandidate({
      store: candidates,
      writer,
      body: {
        candidateId: laterCards[0]!.candidateId,
        personId,
        title: laterCards[0]!.title,
        projectKind: "custom_new_jewelry",
        lifecycleStage: "discovery",
        actor: "justin",
        mutationId: randomUUID(),
      },
    });
    assert.equal(applied.ok, true);
  });
});
