import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { effectiveCandidateTarget } from "@/lib/continuum/candidates/review";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";
import { CANDIDATE_PARSER_GMAIL_V1, type ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { proposeGmailCandidates } from "@/lib/continuum/gmail/candidates/propose";
import { ingestGmailCandidates } from "@/lib/continuum/gmail/candidates/ingest";
import { NEW_PROJECT_CONTEXT_TOPIC } from "@/lib/continuum/gmail/candidates/new-project";
import { packGmailCandidateSourceRef } from "@/lib/continuum/gmail/candidates/source-ref";
import type { GmailCandidateProject } from "@/lib/continuum/gmail/candidates/types";
import { hashEmail } from "../hashes";
import { GMAIL_SOURCE_SYSTEM } from "../gmail/types";
import { InMemoryProjectJobStore } from "../project-jobs/store";
import { InMemoryClientMemoryStore } from "../store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "../types";
import { applyGmailNewProjectCandidate } from "./apply-candidate";
import {
  canonicalProjectForGmailThread,
  knownGmailProjectThreadIds,
} from "./gmail-project-link";
import { confirmGmailPersonAssociation } from "./identity-gate";
import { presentGmailNewProjectIntake } from "./intake-present";
import { createInMemoryFounderProjectWriter } from "./writer";

const NOW = "2026-09-08T21:00:00.000Z";
const NATE_EMAIL = "alex.reed@example.test";
const ABBEY_EMAIL = "jordan.reed@example.test";
const NATE_THREAD = "19a854e42f90344f";
const ABBEY_THREAD = "1a07e70c9a7538be";
const ABBEY_STALE_THREAD = "1a07e70c9a7538bf";

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
  sentAt?: string;
  subject?: string;
}) {
  return {
    indexed: {
      messageId: input.messageId,
      threadId: input.threadId,
      sentAt: input.sentAt ?? NOW,
      indexedAt: NOW,
      subject: input.subject ?? "A new piece",
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
    fromEmailHash: hashEmail(input.fromEmail),
  };
}

function gmailProject(input: {
  projectId: string;
  title: string;
  personIds: readonly string[];
  gmailThreadId?: string | null;
  lifecycleStage?: string | null;
}): GmailCandidateProject {
  return {
    projectId: input.projectId,
    title: input.title,
    gmailThreadId: input.gmailThreadId ?? null,
    cadJobNumber: null,
    orderNumber: null,
    fingerSize: null,
    metal: null,
    centerStone: null,
    diamondSupplyNotes: null,
    personIds: input.personIds,
    founderApprovedCurrent: true,
    projectKind: "custom_new_jewelry",
    lifecycleStage: input.lifecycleStage ?? "cad",
  };
}

function packedSource(threadId: string, messageId: string): string {
  const packed = packGmailCandidateSourceRef({ threadId, messageId });
  assert.equal(packed.ok, true);
  if (!packed.ok) throw new Error("source-ref");
  return packed.sourceRef;
}

function newProjectCandidate(input: {
  threadId: string;
  messageId: string;
  title: string;
  reviewStatus: ContinuumCandidate["reviewStatus"];
  projectId?: string | null;
  candidateState?: ContinuumCandidate["candidateState"];
}): ContinuumCandidate {
  return {
    candidateId: `${input.threadId}-${input.messageId}`,
    sourceSystem: "gmail",
    sourceRef: packedSource(input.threadId, input.messageId),
    sourceTimestamp: NOW,
    candidateType: "project_context",
    proposedTarget: { kind: "project", projectId: input.projectId ?? null },
    payload: {
      kind: "project_context",
      topic: NEW_PROJECT_CONTEXT_TOPIC,
      value: input.title,
    },
    confidence: "high",
    evidenceBasis: { ruleIds: ["explicit_new_project_request"], matchedText: input.title },
    candidateState: input.candidateState ?? "active",
    reviewStatus: input.reviewStatus,
    lastReviewAction: input.reviewStatus === "approved" ? "approve" : null,
    founderEditedPayload: null,
    founderEditedTarget:
      input.projectId
        ? { kind: "project", projectId: input.projectId }
        : null,
    reviewedAt: input.reviewStatus === "approved" ? NOW : null,
    createdAt: NOW,
    canonical: false,
    automaticApply: false,
    parserVersion: CANDIDATE_PARSER_GMAIL_V1,
    supersedesCandidateId: null,
    supersededByCandidateId: null,
  };
}

function personCandidate(input: {
  threadId: string;
  messageId: string;
  personId: string | null;
  email: string;
  displayName: string;
  reviewStatus: ContinuumCandidate["reviewStatus"];
}): ContinuumCandidate {
  return {
    candidateId: `person-${input.threadId}-${input.messageId}`,
    sourceSystem: "gmail",
    sourceRef: packedSource(input.threadId, input.messageId),
    sourceTimestamp: NOW,
    candidateType: "person_association",
    proposedTarget: { kind: "person", personId: input.personId },
    payload: {
      kind: "person_association",
      displayName: input.displayName,
      emailHash: hashEmail(input.email),
      mintPerson: false,
      mergePersons: false,
    },
    confidence: "high",
    evidenceBasis: {
      ruleIds: input.personId ? ["founder_confirmed_gmail_source_link"] : ["email_hash"],
      matchedText: input.email,
    },
    candidateState: "active",
    reviewStatus: input.reviewStatus,
    lastReviewAction: input.reviewStatus === "approved" ? "approve" : null,
    founderEditedPayload: null,
    founderEditedTarget:
      input.personId ? { kind: "person", personId: input.personId } : null,
    reviewedAt: input.reviewStatus === "approved" ? NOW : null,
    createdAt: NOW,
    canonical: false,
    automaticApply: false,
    parserVersion: CANDIDATE_PARSER_GMAIL_V1,
    supersedesCandidateId: null,
    supersededByCandidateId: null,
  };
}

describe("Gmail ↔ canonical Project reconciliation", () => {
  it("create from Gmail then later scan finds that Project and never offers Create again", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const writer = createInMemoryFounderProjectWriter(memory, jobs, () => NOW);
    const store = new InMemoryCandidateStore();
    const personId = await seedPerson(memory, "Alex Reed", NATE_EMAIL);
    const world = {
      people: [
        {
          personId,
          displayName: "Alex Reed",
          emailHash: hashEmail(NATE_EMAIL),
          role: "client" as const,
          projectIds: [] as string[],
        },
      ],
      projects: [] as GmailCandidateProject[],
      internalEmailHashes: [],
    };
    const first = await ingestGmailCandidates(store, {
      createdAt: NOW,
      world,
      evidence: [
        inboundEvidence({
          messageId: "m-nate-1",
          threadId: NATE_THREAD,
          fromEmail: NATE_EMAIL,
          plaintext:
            "I'd like to work together again to create another piece. A dagger and pearls necklace.",
        }),
      ],
    });
    const cards = presentGmailNewProjectIntake(first.candidates, [
      { personId, displayName: "Alex Reed", email: NATE_EMAIL },
    ]);
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.presentation, "proposal");
    const confirmed = await confirmGmailPersonAssociation({
      store,
      personExists: async (id) => Boolean(await memory.getPersonProfile(id)),
      body: {
        candidateId: cards[0]!.personAssociationCandidateId!,
        personId,
        actor: "justin",
      },
      nowIso: NOW,
    });
    assert.equal(confirmed.ok, true);
    const afterConfirm = presentGmailNewProjectIntake(await store.list(), [
      { personId, displayName: "Alex Reed", email: NATE_EMAIL },
    ]);
    const applied = await applyGmailNewProjectCandidate({
      store,
      writer,
      body: {
        candidateId: afterConfirm[0]!.candidateId,
        personId,
        title: afterConfirm[0]!.title,
        projectKind: "custom_new_jewelry",
        lifecycleStage: "cad",
        actor: "justin",
        mutationId: randomUUID(),
      },
    });
    assert.equal(applied.ok, true);
    if (!applied.ok) return;
    const history = await memory.getProjectHistory(applied.projectId);
    assert.equal(history?.gmailThreadId, NATE_THREAD);
    const target = effectiveCandidateTarget(applied.candidate);
    assert.equal(target.kind, "project");
    if (target.kind === "project") {
      assert.equal(target.projectId, applied.projectId);
    }
    const project = gmailProject({
      projectId: applied.projectId,
      title: applied.create.title,
      personIds: [personId],
      gmailThreadId: NATE_THREAD,
      lifecycleStage: "cad",
    });
    const linked = knownGmailProjectThreadIds(await store.list(), [project]);
    assert.equal(linked.includes(NATE_THREAD), true);
    const second = await ingestGmailCandidates(store, {
      createdAt: "2026-09-08T22:00:00.000Z",
      world: {
        ...world,
        projects: [project],
        linkedGmailThreadIds: linked,
      },
      evidence: [
        inboundEvidence({
          messageId: "m-nate-2",
          threadId: NATE_THREAD,
          fromEmail: NATE_EMAIL,
          sentAt: "2026-09-08T22:00:00.000Z",
          plaintext:
            "I'd like to work together again to create another piece. A dagger and pearls necklace.",
        }),
      ],
    });
    assert.equal(
      second.candidates.some(
        (row) =>
          row.reviewStatus === "pending" &&
          row.payload.kind === "project_context" &&
          row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
      ),
      false,
    );
    const afterCards = presentGmailNewProjectIntake(
      await store.list(),
      [{ personId, displayName: "Alex Reed", email: NATE_EMAIL }],
      [],
      [project],
    );
    assert.equal(afterCards.length, 1);
    assert.equal(afterCards[0]?.presentation, "current_project");
    assert.equal(afterCards[0]?.canonicalProjectId, applied.projectId);
    assert.equal(afterCards[0]?.title, "Dagger & Pearls Pendant / Necklace");
    assert.equal(afterCards[0]?.lifecycleLabel, "CAD");
    assert.equal(afterCards[0]?.lifecycleStage, "cad");
    assert.equal(
      (await store.list()).some(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
      ),
      true,
    );
  });

  it("reconstructs Nate-like historical approved Candidate → existing Project without recreating", () => {
    const personId = "person-nate";
    const projectId = "41281e54-0639-4183-82d5-17028b313681";
    const rows = [
      personCandidate({
        threadId: NATE_THREAD,
        messageId: "m-person",
        personId,
        email: NATE_EMAIL,
        displayName: "Alex Reed",
        reviewStatus: "approved",
      }),
      newProjectCandidate({
        threadId: NATE_THREAD,
        messageId: "m-approved",
        title: "Dagger & Pearls Pendant / Necklace",
        reviewStatus: "approved",
      }),
      newProjectCandidate({
        threadId: NATE_THREAD,
        messageId: "m-later",
        title: "Dagger & Pearls Pendant / Necklace",
        reviewStatus: "pending",
      }),
    ];
    const project = gmailProject({
      projectId,
      title: "Dagger & Pearls Pendant / Necklace",
      personIds: [personId],
      gmailThreadId: null,
      lifecycleStage: "cad",
    });
    const linked = canonicalProjectForGmailThread({
      threadId: NATE_THREAD,
      candidates: rows,
      projects: [project],
    });
    assert.equal(linked?.projectId, projectId);
    assert.equal(linked?.link, "approved_title_and_person");
    const cards = presentGmailNewProjectIntake(
      rows,
      [{ personId, displayName: "Alex Reed", email: NATE_EMAIL }],
      [],
      [project],
    );
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.presentation, "current_project");
    assert.equal(cards[0]?.canonicalProjectId, projectId);
    assert.equal(cards[0]?.canonicalProjectFound, true);
  });

  it("does not attach a same-folded title belonging to a different person", () => {
    const rows = [
      personCandidate({
        threadId: NATE_THREAD,
        messageId: "m-person",
        personId: "person-nate",
        email: NATE_EMAIL,
        displayName: "Alex Reed",
        reviewStatus: "approved",
      }),
      newProjectCandidate({
        threadId: NATE_THREAD,
        messageId: "m-approved",
        title: "Dagger & Pearls Pendant / Necklace",
        reviewStatus: "approved",
      }),
    ];
    const other = gmailProject({
      projectId: "other-project",
      title: "Dagger & Pearls Pendant / Necklace",
      personIds: ["someone-else"],
      gmailThreadId: null,
    });
    assert.equal(
      canonicalProjectForGmailThread({
        threadId: NATE_THREAD,
        candidates: rows,
        projects: [other],
      }),
      null,
    );
  });

  it("rolls Abbey-like multiple Candidates into one current-project card", () => {
    const personId = "person-abbey";
    const projectId = "dc873337-5493-4e8e-be67-42f078a8c2e7";
    const rows = [
      personCandidate({
        threadId: ABBEY_THREAD,
        messageId: "m-abbey-person",
        personId,
        email: ABBEY_EMAIL,
        displayName: "Jordan Reed",
        reviewStatus: "approved",
      }),
      newProjectCandidate({
        threadId: ABBEY_THREAD,
        messageId: "m-abbey-approved",
        title: "Matching Marquise Earrings",
        reviewStatus: "approved",
      }),
      personCandidate({
        threadId: ABBEY_STALE_THREAD,
        messageId: "m-stale-person",
        personId: null,
        email: ABBEY_EMAIL,
        displayName: "Jordan Reed",
        reviewStatus: "pending",
      }),
      newProjectCandidate({
        threadId: ABBEY_STALE_THREAD,
        messageId: "m-stale-pending",
        title: "Matching Marquise Earrings",
        reviewStatus: "pending",
      }),
    ];
    const project = gmailProject({
      projectId,
      title: "Matching Marquise Earrings",
      personIds: [personId],
      gmailThreadId: null,
      lifecycleStage: "cad",
    });
    const cards = presentGmailNewProjectIntake(
      rows,
      [{ personId, displayName: "Jordan Reed", email: ABBEY_EMAIL }],
      [],
      [project],
    );
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.title, "Matching Marquise Earrings");
    assert.equal(cards[0]?.presentation, "current_project");
    assert.equal(cards[0]?.canonicalProjectId, projectId);
    assert.equal(
      rows.filter(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
      ).length,
      2,
    );
  });

  it("does not mutate Project lifecycle when presenting Gmail evidence", () => {
    const personId = "person-nate";
    const project = gmailProject({
      projectId: "proj-cad",
      title: "Dagger & Pearls Pendant / Necklace",
      personIds: [personId],
      gmailThreadId: NATE_THREAD,
      lifecycleStage: "cad",
    });
    const rows = [
      personCandidate({
        threadId: NATE_THREAD,
        messageId: "m-person",
        personId,
        email: NATE_EMAIL,
        displayName: "Alex Reed",
        reviewStatus: "approved",
      }),
      newProjectCandidate({
        threadId: NATE_THREAD,
        messageId: "m-approved",
        title: "Dagger & Pearls Pendant / Necklace",
        reviewStatus: "approved",
        projectId: project.projectId,
      }),
    ];
    const cards = presentGmailNewProjectIntake(
      rows,
      [{ personId, displayName: "Alex Reed", email: NATE_EMAIL }],
      [],
      [project],
    );
    assert.equal(cards[0]?.lifecycleStage, "cad");
    assert.equal(project.lifecycleStage, "cad");
  });

  it("attaches Create Project retries to the existing unique person+title Project", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const writer = createInMemoryFounderProjectWriter(memory, jobs, () => NOW);
    const store = new InMemoryCandidateStore();
    const personId = await seedPerson(memory, "Alex Reed", NATE_EMAIL);
    const existing = await writer.createProject({
      mutationId: randomUUID(),
      title: "Dagger & Pearls Pendant / Necklace",
      personId,
      projectKind: "custom_new_jewelry",
      lifecycleStage: "cad",
      actor: "justin",
    });
    assert.equal(existing.ok, true);
    if (!existing.ok) return;
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: {
        people: [
          {
            personId,
            displayName: "Alex Reed",
            emailHash: hashEmail(NATE_EMAIL),
            role: "client",
            projectIds: [existing.projectId],
          },
        ],
        projects: [],
        internalEmailHashes: [],
      },
      evidence: [
        inboundEvidence({
          messageId: "m-retry",
          threadId: NATE_THREAD,
          fromEmail: NATE_EMAIL,
          plaintext:
            "I'd like to work together again to create another piece. A dagger and pearls necklace.",
        }),
      ],
    });
    for (const row of proposed.candidates) await store.put(row);
    const cards = presentGmailNewProjectIntake(await store.list(), [
      { personId, displayName: "Alex Reed", email: NATE_EMAIL },
    ]);
    const confirmed = await confirmGmailPersonAssociation({
      store,
      personExists: async (id) => Boolean(await memory.getPersonProfile(id)),
      body: {
        candidateId: cards[0]!.personAssociationCandidateId!,
        personId,
        actor: "justin",
      },
      nowIso: NOW,
    });
    assert.equal(confirmed.ok, true);
    const afterConfirm = presentGmailNewProjectIntake(await store.list(), [
      { personId, displayName: "Alex Reed", email: NATE_EMAIL },
    ]);
    const applied = await applyGmailNewProjectCandidate({
      store,
      writer,
      body: {
        candidateId: afterConfirm[0]!.candidateId,
        personId,
        title: "Dagger & Pearls Pendant / Necklace",
        projectKind: "custom_new_jewelry",
        lifecycleStage: "cad",
        actor: "justin",
        mutationId: randomUUID(),
      },
    });
    assert.equal(applied.ok, true);
    if (!applied.ok) return;
    assert.equal(applied.projectId, existing.projectId);
    assert.equal(applied.create.status, "already-present");
    const counts = await memory.inspectCounts();
    assert.equal(counts.projects, 1);
  });
});
