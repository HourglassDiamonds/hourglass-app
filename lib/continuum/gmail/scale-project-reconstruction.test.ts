/**
 * Generic multi-Project reconstruction regressions for Cohort 1.
 * Synthetic fixtures only. Does not write canonical records.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import {
  GMAIL_SOURCE_SYSTEM,
  type GmailIndexedMessage,
} from "@/lib/continuum/client-memory/gmail/types";
import { ACHEDEKAL_PROJECT_ID } from "./achedekal-acceptance";
import {
  executeAchedekalCandidateDiscovery,
  executeProjectCandidateDiscovery,
  type AchedekalDiscoveryCatalog,
  type AchedekalDiscoveryIndex,
  type AchedekalDiscoveryProject,
} from "./achedekal-candidate-discovery";
import { executeProjectArtifactHunt } from "./artifact-hunt";
import { InMemoryGmailAttachmentStore } from "./attachments";
import {
  ALEA_CHEDEKAL_FIXTURE_PERSON_ID,
  ALEA_CHEDEKAL_FIXTURE_PROJECT_B_ID,
  ALEA_CHEDEKAL_FIXTURE_THREAD_ID,
  ALEA_CHEDEKAL_PROJECT_A_CAD,
  ALEA_CHEDEKAL_PROJECT_A_ORDER,
  ALEA_CHEDEKAL_PROJECT_B_CAD,
  ALEA_CHEDEKAL_PROJECT_B_ORDER,
  ALEA_CHEDEKAL_PROJECT_B_THREAD_ID,
  ALEA_DISCOVERY_RELATED_CAD_THREAD_ID,
  ALEA_DISCOVERY_WEAK_ORDER_THREAD_ID,
  aleaChedekalDiscoveryIndexedMessages,
  aleaChedekalProjectBProtectedThread,
  aleaChedekalReconstructionInput,
} from "./alea-chedekal-fixture";
import {
  composeCohortProjectReview,
  isSuspiciousFingerSize,
  isWeakOrSuspiciousOrder,
  summarizeCohortProject,
} from "./cohort-reconstruction-compose";
import {
  COHORT_SYNTHESIS_PROJECT_A,
  COHORT_SYNTHESIS_PROJECT_A_ID,
  COHORT_SYNTHESIS_PROJECT_B,
  COHORT_SYNTHESIS_PROJECT_B_ID,
  COHORT_SYNTHESIS_PROJECT_C,
  COHORT_SYNTHESIS_PROJECT_C_ID,
  COHORT_SYNTHESIS_PROJECT_D,
  COHORT_SYNTHESIS_PROJECT_D_ID,
  COHORT_SYNTHESIS_PROJECT_E,
  COHORT_SYNTHESIS_PROJECT_E_ID,
} from "./cohort-evidence-synthesis-fixtures";
import { routeProjectEvidence } from "./project-book-containment";
import {
  reconstructProjectBook,
  type ReconstructionPerson,
} from "./project-reconstruction";
import {
  presentIndexedProjectReconstructionProposal,
} from "./reconstruction-proposal";
import {
  RECONSTRUCTION_COHORT_1_PROJECT_IDS,
  isAleaRegressionProjectId,
  isPermittedCohort1ProjectId,
} from "./reconstruction-cohort";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const PERSON_HASH = hashEmail("chedekal@example.com")!;
const PROJECT_A_ID = "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const PROJECT_B_ID = "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const PROJECT_UNLINKED_ID = "33333333-cccc-4ccc-8ccc-ccccccccccc3";
const PERSON: ReconstructionPerson = {
  personId: ALEA_CHEDEKAL_FIXTURE_PERSON_ID,
  displayName: "Canonical Person",
  emailHash: PERSON_HASH,
};

function catalogOf(
  project: AchedekalDiscoveryProject,
  books: readonly {
    projectId: string;
    personId: string;
    cadJobNumbers: string[];
    orderNumbers: string[];
    gmailThreadIds: string[];
  }[],
): AchedekalDiscoveryCatalog {
  return {
    async getTargetProject() {
      return project;
    },
    async listProjectBooks() {
      return books.map((book) => ({
        projectId: book.projectId,
        personId: book.personId,
        title: book.projectId,
        lifecycle: "unknown" as const,
        items: [],
        cadJobNumbers: book.cadJobNumbers,
        orderNumbers: book.orderNumbers,
        gmailThreadIds: book.gmailThreadIds,
        artifactRefs: [],
        vendors: [],
        subjectTerms: [],
        dateRange: null,
      }));
    },
  };
}

function indexOf(messages: readonly GmailIndexedMessage[]): AchedekalDiscoveryIndex {
  return {
    async listMessagesByThread(threadId: string) {
      return messages.filter((row) => row.threadId === threadId);
    },
    async listMessagesMatchingSubjectTokens(tokens: readonly string[]) {
      const needles = tokens.map((token) => token.trim().toLowerCase()).filter(Boolean);
      if (needles.length === 0) return [];
      return messages.filter((row) => {
        const subject = (row.subject ?? "").toLowerCase();
        return needles.some((needle) => subject.includes(needle));
      });
    },
    async listMessagesTouchingEmailHash(emailHash: string) {
      const hash = emailHash.trim();
      return messages.filter(
        (row) =>
          row.fromEmailHash === hash ||
          row.toEmailHashes.includes(hash) ||
          row.ccEmailHashes.includes(hash) ||
          row.bccEmailHashes.includes(hash),
      );
    },
  };
}

function projectA(): AchedekalDiscoveryProject {
  return {
    projectId: PROJECT_A_ID,
    gmailThreadId: ALEA_CHEDEKAL_FIXTURE_THREAD_ID,
    cadJobNumber: ALEA_CHEDEKAL_PROJECT_A_CAD,
    orderNumber: ALEA_CHEDEKAL_PROJECT_A_ORDER,
    fingerSize: "141",
    metal: null,
    centerStone: null,
    personId: PERSON.personId,
    personEmailHash: PERSON_HASH,
    personEmailHashes: [PERSON_HASH],
  };
}

function booksAB() {
  return [
    {
      projectId: PROJECT_A_ID,
      personId: PERSON.personId,
      cadJobNumbers: [ALEA_CHEDEKAL_PROJECT_A_CAD],
      orderNumbers: [ALEA_CHEDEKAL_PROJECT_A_ORDER],
      gmailThreadIds: [ALEA_CHEDEKAL_FIXTURE_THREAD_ID],
    },
    {
      projectId: PROJECT_B_ID,
      personId: PERSON.personId,
      cadJobNumbers: [ALEA_CHEDEKAL_PROJECT_B_CAD],
      orderNumbers: [ALEA_CHEDEKAL_PROJECT_B_ORDER],
      gmailThreadIds: [ALEA_CHEDEKAL_PROJECT_B_THREAD_ID],
    },
  ];
}

describe("Cohort 1 adapter boundary", () => {
  it("does not include Alea as a Cohort 1 Project", () => {
    assert.equal(isAleaRegressionProjectId(ACHEDEKAL_PROJECT_ID), true);
    assert.equal(isPermittedCohort1ProjectId(ACHEDEKAL_PROJECT_ID), false);
    assert.equal(RECONSTRUCTION_COHORT_1_PROJECT_IDS.includes(ACHEDEKAL_PROJECT_ID), false);
    assert.equal(RECONSTRUCTION_COHORT_1_PROJECT_IDS.length, 5);
    assert.equal(
      new Set(RECONSTRUCTION_COHORT_1_PROJECT_IDS).size,
      RECONSTRUCTION_COHORT_1_PROJECT_IDS.length,
    );
  });
});

describe("generic multi-Project reconstruction", () => {
  it("runs exact stored-thread candidate discovery for a non-Alea Project Book", async () => {
    const aleaDenied = await executeAchedekalCandidateDiscovery({
      founderSessionOk: true,
      requestedProjectId: PROJECT_A_ID,
      catalog: catalogOf(projectA(), booksAB()),
      index: indexOf(aleaChedekalDiscoveryIndexedMessages()),
      attachments: new InMemoryGmailAttachmentStore(),
    });
    assert.equal(aleaDenied.ok, false);

    const result = await executeProjectCandidateDiscovery({
      founderSessionOk: true,
      requestedProjectId: PROJECT_A_ID,
      projectName: "Project A",
      catalog: catalogOf(projectA(), booksAB()),
      index: indexOf(aleaChedekalDiscoveryIndexedMessages()),
      attachments: new InMemoryGmailAttachmentStore(),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.projectId, PROJECT_A_ID);
    assert.equal(result.knownThread?.threadId, ALEA_CHEDEKAL_FIXTURE_THREAD_ID);
    assert.equal(
      result.related.some((row) => row.threadId === ALEA_DISCOVERY_RELATED_CAD_THREAD_ID),
      true,
    );
    assert.equal(
      result.related.some((row) => row.threadId === ALEA_CHEDEKAL_PROJECT_B_THREAD_ID),
      false,
    );
    assert.equal(result.automaticApply, false);
    assert.equal(result.fetchesGmail, false);
  });

  it("keeps Project A evidence out of Project B for the same Person", () => {
    const reconstructedA = reconstructProjectBook(aleaChedekalReconstructionInput());
    const reconstructedB = reconstructProjectBook({
      ...aleaChedekalReconstructionInput(),
      projectId: PROJECT_B_ID,
      thread: aleaChedekalProjectBProtectedThread(),
      currentSpecs: {
        fingerSize: null,
        orderNumber: ALEA_CHEDEKAL_PROJECT_B_ORDER,
        cadJobNumber: ALEA_CHEDEKAL_PROJECT_B_CAD,
        metal: null,
        centerStone: null,
      },
    });
    assert.equal(reconstructedA.projectId !== reconstructedB.projectId, true);
    assert.equal(
      reconstructedA.items.some((item) => item.itemType === "necklace"),
      false,
    );
    assert.equal(
      reconstructedB.items.some((item) =>
        item.cadJobNumbers.some((row) => row.proposedValue === ALEA_CHEDEKAL_PROJECT_A_CAD),
      ),
      false,
    );
    const routed = routeProjectEvidence({
      person: {
        personId: PERSON.personId,
        displayName: PERSON.displayName,
      },
      projectBooks: booksAB().map((book) => ({
        projectId: book.projectId,
        personId: book.personId,
        title: book.projectId,
        lifecycle: "unknown" as const,
        items: [],
        cadJobNumbers: book.cadJobNumbers,
        orderNumbers: book.orderNumbers,
        gmailThreadIds: book.gmailThreadIds,
        artifactRefs: [],
        vendors: [],
        subjectTerms: [],
        dateRange: null,
      })),
      evidence: [
        {
          evidenceId: "a-cad",
          kind: "email",
          personId: PERSON.personId,
          text: `Please see ${ALEA_CHEDEKAL_PROJECT_A_CAD} and Order #${ALEA_CHEDEKAL_PROJECT_A_ORDER}.`,
          subject: ALEA_CHEDEKAL_PROJECT_A_CAD,
          sentAt: "2024-03-12T15:04:00.000Z",
          threadId: ALEA_CHEDEKAL_FIXTURE_THREAD_ID,
          messageId: "msg-a",
          vendorMentions: [],
          artifact: null,
        },
        {
          evidenceId: "b-cad",
          kind: "email",
          personId: PERSON.personId,
          text: `Anniversary necklace ${ALEA_CHEDEKAL_PROJECT_B_CAD}. Order #${ALEA_CHEDEKAL_PROJECT_B_ORDER}.`,
          subject: ALEA_CHEDEKAL_PROJECT_B_CAD,
          sentAt: "2025-01-09T16:22:00.000Z",
          threadId: ALEA_CHEDEKAL_PROJECT_B_THREAD_ID,
          messageId: "msg-b",
          vendorMentions: [],
          artifact: null,
        },
      ],
    });
    assert.equal(
      routed.attributions.find((row) => row.evidenceId === "a-cad")?.attachedProjectId,
      PROJECT_A_ID,
    );
    assert.equal(
      routed.attributions.find((row) => row.evidenceId === "b-cad")?.attachedProjectId,
      PROJECT_B_ID,
    );
  });

  it("treats an unlinked Person Project Book as a valid reconstruction target", () => {
    const proposal = presentIndexedProjectReconstructionProposal({
      projectId: PROJECT_UNLINKED_ID,
      currentStored: {
        fingerSize: "5.25",
        orderNumber: "SP12883",
        cadJobNumber: "H017123",
        metal: "platinum",
        centerStone: null,
      },
      existingPerson: null,
      indexedMessages: [],
      storedThreadId: "19unlinkedthread0001",
    });
    assert.equal(proposal.projectId, PROJECT_UNLINKED_ID);
    assert.equal(proposal.status, "review_only");
    assert.equal(proposal.automaticApply, false);
    assert.deepEqual(proposal.proposedCanonicalWrites, []);
    assert.equal(proposal.sold, false);
    assert.equal(proposal.completed, false);
    assert.equal(proposal.projectState, "unknown");
  });

  it("does not attach a weak numeric order-only thread", async () => {
    const project = {
      ...projectA(),
      orderNumber: "33",
    };
    const result = await executeProjectCandidateDiscovery({
      founderSessionOk: true,
      requestedProjectId: PROJECT_A_ID,
      catalog: catalogOf(project, [
        {
          ...booksAB()[0]!,
          orderNumbers: ["33"],
        },
        booksAB()[1]!,
      ]),
      index: indexOf(aleaChedekalDiscoveryIndexedMessages()),
      attachments: new InMemoryGmailAttachmentStore(),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(
      result.related.some((row) => row.threadId === ALEA_DISCOVERY_WEAK_ORDER_THREAD_ID),
      false,
    );
  });

  it("keeps duplicate strong-identifier ownership ambiguous", async () => {
    const colliding = [
      booksAB()[0]!,
      {
        ...booksAB()[1]!,
        cadJobNumbers: [ALEA_CHEDEKAL_PROJECT_A_CAD],
      },
    ];
    const result = await executeProjectCandidateDiscovery({
      founderSessionOk: true,
      requestedProjectId: PROJECT_A_ID,
      catalog: catalogOf(projectA(), colliding),
      index: indexOf(aleaChedekalDiscoveryIndexedMessages()),
      attachments: new InMemoryGmailAttachmentStore(),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const relatedCad = result.related.find(
      (row) => row.threadId === ALEA_DISCOVERY_RELATED_CAD_THREAD_ID,
    );
    const ambiguousCad = result.ambiguous.find(
      (row) => row.threadId === ALEA_DISCOVERY_RELATED_CAD_THREAD_ID,
    );
    assert.equal(relatedCad == null, true);
    assert.ok(ambiguousCad);
    assert.equal(ambiguousCad?.attachedProjectId, null);
  });

  it("does not auto-correct malformed stored data or activate the Project", () => {
    const proposal = presentIndexedProjectReconstructionProposal({
      projectId: PROJECT_A_ID,
      currentStored: {
        fingerSize: "141",
        orderNumber: "140",
        cadJobNumber: ALEA_CHEDEKAL_PROJECT_A_CAD,
        metal: null,
        centerStone: null,
      },
      existingPerson: PERSON,
      indexedMessages: [],
      storedThreadId: ALEA_CHEDEKAL_FIXTURE_THREAD_ID,
    });
    assert.equal(
      proposal.conflictingStoredData.some((row) => row.storedValue === "141"),
      true,
    );
    assert.equal(
      proposal.conflictingStoredData.some((row) => row.corrected || row.deleted),
      false,
    );
    assert.equal(proposal.sold, false);
    assert.equal(proposal.completed, false);
    assert.equal(proposal.approvedInProduction, false);
    assert.deepEqual(proposal.proposedCanonicalWrites, []);
    assert.equal(proposal.automaticApply, false);
    assert.equal(proposal.mutationBoundary.createsOpenJobs, false);
    assert.equal(proposal.mutationBoundary.writesChiefOfStaff, false);
    assert.equal(proposal.mutationBoundary.fetchesAttachmentBytes, false);
    const reconstructed = reconstructProjectBook({
      ...aleaChedekalReconstructionInput(),
      projectId: PROJECT_A_ID,
      currentLifecycle: "historical_closed",
    });
    assert.equal(reconstructed.historicalSafety.remainsHistorical, true);
    assert.equal(reconstructed.historicalSafety.lifecycleMutated, false);
    assert.deepEqual(reconstructed.openJobs, []);
  });

  it("runs Artifact Hunt against an arbitrary Project Book without attaching bytes", async () => {
    const attachments = new InMemoryGmailAttachmentStore();
    await attachments.putAttachment({
      attachmentId: "att-generic-cad",
      messageId: "msg-generic-cad",
      threadId: ALEA_CHEDEKAL_FIXTURE_THREAD_ID,
      filename: `${ALEA_CHEDEKAL_PROJECT_A_CAD}.jpg`,
      mimeType: "image/jpeg",
      sizeBytes: 2048,
      indexedAt: "2026-08-30T00:00:00.000Z",
    });
    const messages = aleaChedekalDiscoveryIndexedMessages();
    const state = await executeProjectArtifactHunt({
      founderSessionOk: true,
      projectId: PROJECT_A_ID,
      catalog: {
        async getProject(projectId: string) {
          if (projectId !== PROJECT_A_ID) return null;
          return {
            projectId: PROJECT_A_ID,
            title: "Project A",
            gmailThreadId: ALEA_CHEDEKAL_FIXTURE_THREAD_ID,
            cadJobNumber: ALEA_CHEDEKAL_PROJECT_A_CAD,
            orderNumber: ALEA_CHEDEKAL_PROJECT_A_ORDER,
            fingerSize: null,
            metal: null,
            centerStone: null,
            personId: PERSON.personId,
            personEmailHash: PERSON_HASH,
            personEmailHashes: [PERSON_HASH],
            lifecycle: "unknown",
          };
        },
        async listProjectBooks() {
          return catalogOf(projectA(), booksAB()).listProjectBooks();
        },
      },
      index: indexOf(messages),
      attachments,
    });
    assert.equal(state.ok, true);
    if (!state.ok) return;
    assert.equal(state.projectId, PROJECT_A_ID);
    assert.equal(state.automaticAttach, false);
    assert.equal(state.canonical, false);
    assert.equal(state.fetchesAttachmentBytes, false);
    assert.equal(state.likely.length > 0, true);
  });
});

describe("cohort compose and stored-data flags", () => {
  it("flags malformed finger size and weak order without using names", () => {
    assert.equal(isSuspiciousFingerSize("141"), true);
    assert.equal(isSuspiciousFingerSize("6.5"), false);
    assert.equal(isWeakOrSuspiciousOrder("140"), true);
    assert.equal(isWeakOrSuspiciousOrder("SP13040"), false);
    const summary = summarizeCohortProject({
      projectId: PROJECT_A_ID,
      title: "Stored title",
      personCount: 0,
      gmailThreadId: ALEA_CHEDEKAL_FIXTURE_THREAD_ID,
      cadJobNumber: ALEA_CHEDEKAL_PROJECT_A_CAD,
      orderNumber: "33",
      fingerSize: "69",
      indexedMessageCount: 2,
      attachmentMetadataCount: 3,
    });
    assert.equal(summary.personLinked, false);
    assert.equal(summary.storedThreadIndexStatus, "indexed");
    assert.equal(summary.suspiciousStored.includes("finger_size"), true);
    assert.equal(summary.suspiciousStored.includes("order_number"), true);
    assert.equal(summary.automaticApply, false);
  });

  it("composes a review-only proposal without Gmail or canonical writes", async () => {
    const review = await composeCohortProjectReview({
      founderSessionOk: true,
      projectId: PROJECT_A_ID,
      title: "Project A",
      personCount: 1,
      existingPerson: PERSON,
      history: {
        projectId: PROJECT_A_ID,
        cadJobNumber: ALEA_CHEDEKAL_PROJECT_A_CAD,
        orderNumber: ALEA_CHEDEKAL_PROJECT_A_ORDER,
        gmailThreadId: ALEA_CHEDEKAL_FIXTURE_THREAD_ID,
        matchJudgment: null,
        matchJudgmentRaw: null,
        fingerSize: "141",
        metal: null,
        centerStone: null,
        diamondSupplyNotes: null,
        sourceSystem: "continuum-reconciliation-v3",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      catalog: {
        getDiscoveryProject: async () => projectA(),
        getHuntProject: async (id) =>
          id === PROJECT_A_ID
            ? {
                projectId: PROJECT_A_ID,
                title: "Project A",
                gmailThreadId: ALEA_CHEDEKAL_FIXTURE_THREAD_ID,
                cadJobNumber: ALEA_CHEDEKAL_PROJECT_A_CAD,
                orderNumber: ALEA_CHEDEKAL_PROJECT_A_ORDER,
                fingerSize: "141",
                metal: null,
                centerStone: null,
                personId: PERSON.personId,
                personEmailHash: PERSON_HASH,
                personEmailHashes: [PERSON_HASH],
                lifecycle: "unknown",
              }
            : null,
        listProjectBooks: () => catalogOf(projectA(), booksAB()).listProjectBooks(),
      },
      index: indexOf(aleaChedekalDiscoveryIndexedMessages()),
      attachments: new InMemoryGmailAttachmentStore(),
    });
    assert.equal(review.reviewOnly, true);
    assert.equal(review.automaticApply, false);
    assert.deepEqual(review.proposedCanonicalWrites, []);
    assert.equal(review.proposal.sold, false);
    assert.equal(review.queryBounds.fullMailboxScan, false);
    assert.equal(review.discovery.ok, true);
  });
});

function synthesisMessage(input: {
  messageId: string;
  threadId: string;
  subject: string;
  hasAttachments?: boolean;
}): GmailIndexedMessage {
  return {
    messageId: input.messageId,
    threadId: input.threadId,
    sentAt: "2024-06-01T00:00:00.000Z",
    indexedAt: "2026-08-30T00:00:00.000Z",
    subject: input.subject,
    fromEmailHash: PERSON_HASH,
    toEmailHashes: [],
    ccEmailHashes: [],
    bccEmailHashes: [],
    direction: "inbound",
    labelIds: [],
    hasAttachments: input.hasAttachments ?? false,
    sourceSystem: GMAIL_SOURCE_SYSTEM,
  };
}

function historyOf(
  projectId: string,
  cad: string,
  order: string,
  finger: string,
  threadId: string | null,
) {
  return {
    projectId,
    cadJobNumber: cad,
    orderNumber: order,
    gmailThreadId: threadId,
    matchJudgment: null,
    matchJudgmentRaw: null,
    fingerSize: finger,
    metal: null,
    centerStone: null,
    diamondSupplyNotes: null,
    sourceSystem: "continuum-reconciliation-v3" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("cohort recovered-evidence synthesis compose", () => {
  it("supports Project A SP13040 from the exact stored-thread subject", async () => {
    const messages = [
      synthesisMessage({
        messageId: "msg-a",
        threadId: COHORT_SYNTHESIS_PROJECT_A.storedThreadId,
        subject: COHORT_SYNTHESIS_PROJECT_A.recoveredSubject,
      }),
    ];
    const review = await composeCohortProjectReview({
      founderSessionOk: true,
      projectId: COHORT_SYNTHESIS_PROJECT_A_ID,
      title: "Chicken ring (his)",
      personCount: 1,
      existingPerson: PERSON,
      history: historyOf(
        COHORT_SYNTHESIS_PROJECT_A_ID,
        COHORT_SYNTHESIS_PROJECT_A.cad,
        COHORT_SYNTHESIS_PROJECT_A.order,
        COHORT_SYNTHESIS_PROJECT_A.fingerSize,
        COHORT_SYNTHESIS_PROJECT_A.storedThreadId,
      ),
      catalog: {
        getDiscoveryProject: async () => ({
          projectId: COHORT_SYNTHESIS_PROJECT_A_ID,
          gmailThreadId: COHORT_SYNTHESIS_PROJECT_A.storedThreadId,
          cadJobNumber: COHORT_SYNTHESIS_PROJECT_A.cad,
          orderNumber: COHORT_SYNTHESIS_PROJECT_A.order,
          fingerSize: COHORT_SYNTHESIS_PROJECT_A.fingerSize,
          metal: null,
          centerStone: null,
          personId: PERSON.personId,
          personEmailHash: PERSON_HASH,
          personEmailHashes: [PERSON_HASH],
        }),
        getHuntProject: async (id) =>
          id === COHORT_SYNTHESIS_PROJECT_A_ID
            ? {
                projectId: COHORT_SYNTHESIS_PROJECT_A_ID,
                title: "Chicken ring (his)",
                gmailThreadId: COHORT_SYNTHESIS_PROJECT_A.storedThreadId,
                cadJobNumber: COHORT_SYNTHESIS_PROJECT_A.cad,
                orderNumber: COHORT_SYNTHESIS_PROJECT_A.order,
                fingerSize: COHORT_SYNTHESIS_PROJECT_A.fingerSize,
                metal: null,
                centerStone: null,
                personId: PERSON.personId,
                personEmailHash: PERSON_HASH,
                personEmailHashes: [PERSON_HASH],
                lifecycle: "unknown",
              }
            : null,
        listProjectBooks: async () => [],
      },
      index: indexOf(messages),
      attachments: new InMemoryGmailAttachmentStore(),
    });
    const order = review.proposal.conflictingStoredData.find(
      (row) => row.field === "order_number",
    );
    const finger = review.proposal.conflictingStoredData.find(
      (row) => row.field === "finger_size",
    );
    assert.equal(order?.status, "supported");
    assert.equal(order?.storedValue, "SP13040");
    assert.match(review.proposalView.conflictingStoredData.find((row) => row.label === "Order")?.note ?? "", /SUPPORTED BY RECOVERED INDEXED EVIDENCE/);
    assert.equal(finger?.status, "unsupported");
    assert.equal(review.proposal.itemTypeCandidate, "unknown");
    assert.equal(review.automaticApply, false);
    assert.deepEqual(review.proposedCanonicalWrites, []);
  });

  it("keeps Project B multi-identifier recovered evidence conflicting", async () => {
    const messages = [
      synthesisMessage({
        messageId: "msg-b-1",
        threadId: "thread-b-sp6934",
        subject: COHORT_SYNTHESIS_PROJECT_B.recoveredSubjects[0]!,
      }),
      synthesisMessage({
        messageId: "msg-b-2",
        threadId: "thread-b-sp12882",
        subject: COHORT_SYNTHESIS_PROJECT_B.recoveredSubjects[1]!,
      }),
      synthesisMessage({
        messageId: "msg-b-3",
        threadId: "thread-b-artifact",
        subject: "Henry files",
        hasAttachments: true,
      }),
    ];
    const attachments = new InMemoryGmailAttachmentStore();
    await attachments.putAttachment({
      attachmentId: "att-b-xlsx",
      messageId: "msg-b-3",
      threadId: "thread-b-artifact",
      filename: COHORT_SYNTHESIS_PROJECT_B.recoveredArtifact,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sizeBytes: 4096,
      indexedAt: "2026-08-30T00:00:00.000Z",
    });
    const review = await composeCohortProjectReview({
      founderSessionOk: true,
      projectId: COHORT_SYNTHESIS_PROJECT_B_ID,
      title: "Henry",
      personCount: 1,
      existingPerson: PERSON,
      history: historyOf(
        COHORT_SYNTHESIS_PROJECT_B_ID,
        COHORT_SYNTHESIS_PROJECT_B.cad,
        COHORT_SYNTHESIS_PROJECT_B.order,
        COHORT_SYNTHESIS_PROJECT_B.fingerSize,
        null,
      ),
      catalog: {
        getDiscoveryProject: async () => ({
          projectId: COHORT_SYNTHESIS_PROJECT_B_ID,
          gmailThreadId: null,
          cadJobNumber: COHORT_SYNTHESIS_PROJECT_B.cad,
          orderNumber: COHORT_SYNTHESIS_PROJECT_B.order,
          fingerSize: COHORT_SYNTHESIS_PROJECT_B.fingerSize,
          metal: null,
          centerStone: null,
          personId: PERSON.personId,
          personEmailHash: PERSON_HASH,
          personEmailHashes: [PERSON_HASH],
        }),
        getHuntProject: async (id) =>
          id === COHORT_SYNTHESIS_PROJECT_B_ID
            ? {
                projectId: COHORT_SYNTHESIS_PROJECT_B_ID,
                title: "Henry",
                gmailThreadId: null,
                cadJobNumber: COHORT_SYNTHESIS_PROJECT_B.cad,
                orderNumber: COHORT_SYNTHESIS_PROJECT_B.order,
                fingerSize: COHORT_SYNTHESIS_PROJECT_B.fingerSize,
                metal: null,
                centerStone: null,
                personId: PERSON.personId,
                personEmailHash: PERSON_HASH,
                personEmailHashes: [PERSON_HASH],
                lifecycle: "unknown",
              }
            : null,
        listProjectBooks: async () => [
          {
            projectId: COHORT_SYNTHESIS_PROJECT_B_ID,
            personId: PERSON.personId,
            title: "Henry",
            lifecycle: "unknown" as const,
            items: [],
            cadJobNumbers: [COHORT_SYNTHESIS_PROJECT_B.cad],
            orderNumbers: ["SP12318", "SP12882"],
            gmailThreadIds: [],
            artifactRefs: [],
            vendors: [],
            subjectTerms: [],
            dateRange: null,
          },
        ],
      },
      index: indexOf(messages),
      attachments,
    });
    const order = review.proposal.conflictingStoredData.find(
      (row) => row.field === "order_number",
    );
    assert.equal(order?.status, "conflicting");
    assert.equal(order?.supportedStoredIdentifiers.includes("SP12318"), true);
    assert.equal(order?.supportedStoredIdentifiers.includes("SP12882"), true);
    assert.deepEqual(order?.additionalRecoveredIdentifiers, ["SP6934"]);
    assert.equal(order?.corrected, false);
    assert.equal(review.proposal.automaticApply, false);
  });

  it("supports unlinked Project C SP12883 without creating a Person", async () => {
    const messages = [
      synthesisMessage({
        messageId: "msg-c",
        threadId: COHORT_SYNTHESIS_PROJECT_C.storedThreadId,
        subject: COHORT_SYNTHESIS_PROJECT_C.recoveredSubject,
        hasAttachments: true,
      }),
    ];
    const attachments = new InMemoryGmailAttachmentStore();
    await attachments.putAttachment({
      attachmentId: "att-c-pdf",
      messageId: "msg-c",
      threadId: COHORT_SYNTHESIS_PROJECT_C.storedThreadId,
      filename: COHORT_SYNTHESIS_PROJECT_C.recoveredArtifact,
      mimeType: "application/pdf",
      sizeBytes: 1024,
      indexedAt: "2026-08-30T00:00:00.000Z",
    });
    const review = await composeCohortProjectReview({
      founderSessionOk: true,
      projectId: COHORT_SYNTHESIS_PROJECT_C_ID,
      title: "Kaleb H.",
      personCount: 0,
      existingPerson: null,
      history: historyOf(
        COHORT_SYNTHESIS_PROJECT_C_ID,
        COHORT_SYNTHESIS_PROJECT_C.cad,
        COHORT_SYNTHESIS_PROJECT_C.order,
        COHORT_SYNTHESIS_PROJECT_C.fingerSize,
        COHORT_SYNTHESIS_PROJECT_C.storedThreadId,
      ),
      catalog: {
        getDiscoveryProject: async () => ({
          projectId: COHORT_SYNTHESIS_PROJECT_C_ID,
          gmailThreadId: COHORT_SYNTHESIS_PROJECT_C.storedThreadId,
          cadJobNumber: COHORT_SYNTHESIS_PROJECT_C.cad,
          orderNumber: COHORT_SYNTHESIS_PROJECT_C.order,
          fingerSize: COHORT_SYNTHESIS_PROJECT_C.fingerSize,
          metal: null,
          centerStone: null,
          personId: null,
          personEmailHash: null,
          personEmailHashes: [],
        }),
        getHuntProject: async (id) =>
          id === COHORT_SYNTHESIS_PROJECT_C_ID
            ? {
                projectId: COHORT_SYNTHESIS_PROJECT_C_ID,
                title: "Kaleb H.",
                gmailThreadId: COHORT_SYNTHESIS_PROJECT_C.storedThreadId,
                cadJobNumber: COHORT_SYNTHESIS_PROJECT_C.cad,
                orderNumber: COHORT_SYNTHESIS_PROJECT_C.order,
                fingerSize: COHORT_SYNTHESIS_PROJECT_C.fingerSize,
                metal: null,
                centerStone: null,
                personId: null,
                personEmailHash: null,
                personEmailHashes: [],
                lifecycle: "unknown",
              }
            : null,
        listProjectBooks: async () => [],
      },
      index: indexOf(messages),
      attachments,
    });
    const order = review.proposal.conflictingStoredData.find(
      (row) => row.field === "order_number",
    );
    assert.equal(review.personLinked, false);
    assert.equal(review.personCount, 0);
    assert.equal(order?.status, "supported");
    assert.equal(order?.storedValue, "SP12883");
    assert.equal(review.automaticApply, false);
  });

  it("keeps sparse sibling Projects D and E unsupported", async () => {
    const books = [
      {
        projectId: COHORT_SYNTHESIS_PROJECT_D_ID,
        personId: PERSON.personId,
        title: "STUART",
        lifecycle: "unknown" as const,
        items: [],
        cadJobNumbers: [COHORT_SYNTHESIS_PROJECT_D.cad],
        orderNumbers: [COHORT_SYNTHESIS_PROJECT_D.order],
        gmailThreadIds: [COHORT_SYNTHESIS_PROJECT_D.storedThreadId],
        artifactRefs: [],
        vendors: [],
        subjectTerms: [],
        dateRange: null,
      },
      {
        projectId: COHORT_SYNTHESIS_PROJECT_E_ID,
        personId: PERSON.personId,
        title: "MR-STUART",
        lifecycle: "unknown" as const,
        items: [],
        cadJobNumbers: [COHORT_SYNTHESIS_PROJECT_E.cad],
        orderNumbers: [COHORT_SYNTHESIS_PROJECT_E.order],
        gmailThreadIds: [COHORT_SYNTHESIS_PROJECT_E.storedThreadId],
        artifactRefs: [],
        vendors: [],
        subjectTerms: [],
        dateRange: null,
      },
    ];
    const reviewD = await composeCohortProjectReview({
      founderSessionOk: true,
      projectId: COHORT_SYNTHESIS_PROJECT_D_ID,
      title: "STUART",
      personCount: 1,
      existingPerson: PERSON,
      history: historyOf(
        COHORT_SYNTHESIS_PROJECT_D_ID,
        COHORT_SYNTHESIS_PROJECT_D.cad,
        COHORT_SYNTHESIS_PROJECT_D.order,
        COHORT_SYNTHESIS_PROJECT_D.fingerSize,
        COHORT_SYNTHESIS_PROJECT_D.storedThreadId,
      ),
      catalog: {
        getDiscoveryProject: async () => ({
          projectId: COHORT_SYNTHESIS_PROJECT_D_ID,
          gmailThreadId: COHORT_SYNTHESIS_PROJECT_D.storedThreadId,
          cadJobNumber: COHORT_SYNTHESIS_PROJECT_D.cad,
          orderNumber: COHORT_SYNTHESIS_PROJECT_D.order,
          fingerSize: COHORT_SYNTHESIS_PROJECT_D.fingerSize,
          metal: null,
          centerStone: null,
          personId: PERSON.personId,
          personEmailHash: PERSON_HASH,
          personEmailHashes: [PERSON_HASH],
        }),
        getHuntProject: async (id) =>
          id === COHORT_SYNTHESIS_PROJECT_D_ID
            ? {
                projectId: COHORT_SYNTHESIS_PROJECT_D_ID,
                title: "STUART",
                gmailThreadId: COHORT_SYNTHESIS_PROJECT_D.storedThreadId,
                cadJobNumber: COHORT_SYNTHESIS_PROJECT_D.cad,
                orderNumber: COHORT_SYNTHESIS_PROJECT_D.order,
                fingerSize: COHORT_SYNTHESIS_PROJECT_D.fingerSize,
                metal: null,
                centerStone: null,
                personId: PERSON.personId,
                personEmailHash: PERSON_HASH,
                personEmailHashes: [PERSON_HASH],
                lifecycle: "unknown",
              }
            : null,
        listProjectBooks: async () => books,
      },
      index: indexOf([]),
      attachments: new InMemoryGmailAttachmentStore(),
    });
    const orderD = reviewD.proposal.conflictingStoredData.find(
      (row) => row.field === "order_number",
    );
    const fingerD = reviewD.proposal.conflictingStoredData.find(
      (row) => row.field === "finger_size",
    );
    assert.equal(orderD?.status, "unsupported");
    assert.equal(orderD?.storedValue, "SP3066");
    assert.equal(fingerD?.status, "unsupported");
    assert.equal(reviewD.discovery.ok ? reviewD.discovery.related.length : 0, 0);
    assert.match(
      reviewD.proposalView.conflictingStoredData.find((row) => row.label === "Order")
        ?.note ?? "",
      /NOT INDEPENDENTLY SUPPORTED/,
    );

    const reviewE = await composeCohortProjectReview({
      founderSessionOk: true,
      projectId: COHORT_SYNTHESIS_PROJECT_E_ID,
      title: "MR-STUART",
      personCount: 1,
      existingPerson: PERSON,
      history: historyOf(
        COHORT_SYNTHESIS_PROJECT_E_ID,
        COHORT_SYNTHESIS_PROJECT_E.cad,
        COHORT_SYNTHESIS_PROJECT_E.order,
        COHORT_SYNTHESIS_PROJECT_E.fingerSize,
        COHORT_SYNTHESIS_PROJECT_E.storedThreadId,
      ),
      catalog: {
        getDiscoveryProject: async () => ({
          projectId: COHORT_SYNTHESIS_PROJECT_E_ID,
          gmailThreadId: COHORT_SYNTHESIS_PROJECT_E.storedThreadId,
          cadJobNumber: COHORT_SYNTHESIS_PROJECT_E.cad,
          orderNumber: COHORT_SYNTHESIS_PROJECT_E.order,
          fingerSize: COHORT_SYNTHESIS_PROJECT_E.fingerSize,
          metal: null,
          centerStone: null,
          personId: PERSON.personId,
          personEmailHash: PERSON_HASH,
          personEmailHashes: [PERSON_HASH],
        }),
        getHuntProject: async (id) =>
          id === COHORT_SYNTHESIS_PROJECT_E_ID
            ? {
                projectId: COHORT_SYNTHESIS_PROJECT_E_ID,
                title: "MR-STUART",
                gmailThreadId: COHORT_SYNTHESIS_PROJECT_E.storedThreadId,
                cadJobNumber: COHORT_SYNTHESIS_PROJECT_E.cad,
                orderNumber: COHORT_SYNTHESIS_PROJECT_E.order,
                fingerSize: COHORT_SYNTHESIS_PROJECT_E.fingerSize,
                metal: null,
                centerStone: null,
                personId: PERSON.personId,
                personEmailHash: PERSON_HASH,
                personEmailHashes: [PERSON_HASH],
                lifecycle: "unknown",
              }
            : null,
        listProjectBooks: async () => books,
      },
      index: indexOf([]),
      attachments: new InMemoryGmailAttachmentStore(),
    });
    const orderE = reviewE.proposal.conflictingStoredData.find(
      (row) => row.field === "order_number",
    );
    const fingerE = reviewE.proposal.conflictingStoredData.find(
      (row) => row.field === "finger_size",
    );
    assert.equal(orderE?.status, "unsupported");
    assert.equal(orderE?.storedValue, "SP2976");
    assert.equal(fingerE?.status, "unsupported");
    assert.equal(reviewE.discovery.ok ? reviewE.discovery.related.length : 0, 0);
    assert.equal(
      reviewE.proposal.conflictingStoredData.some((row) =>
        /SP3066|C007157/.test(row.storedValue),
      ),
      false,
    );
  });
});

describe("cohort reconstruction privacy and mutation boundary", () => {
  it("keeps Cohort 1 routes founder-only, review-only, and off public APIs", () => {
    const sourceOf = (file: string) => readFileSync(join(ROOT, file), "utf8");
    const page = sourceOf(
      "app/executive-dashboard/concierge/project-reconstruction/cohort-1/page.tsx",
    );
    const detail = sourceOf(
      "app/executive-dashboard/concierge/project-reconstruction/cohort-1/[projectId]/page.tsx",
    );
    const actions = sourceOf(
      "app/executive-dashboard/concierge/cohort-reconstruction-actions.ts",
    );
    const engine = sourceOf("lib/continuum/gmail/achedekal-candidate-discovery.ts");
    const compose = sourceOf("lib/continuum/gmail/cohort-reconstruction-compose.ts");
    const support = sourceOf("lib/continuum/gmail/reconstruction-evidence-support.ts");
    const proposal = sourceOf("lib/continuum/gmail/reconstruction-proposal.ts");
    const ui = sourceOf(
      "app/executive-dashboard/concierge/components/cohort-reconstruction.tsx",
    );
    const cohort = sourceOf("lib/continuum/gmail/reconstruction-cohort.ts");
    const barrel = sourceOf("lib/continuum/gmail/index.ts");
    const server = sourceOf("lib/continuum/gmail/server.ts");
    for (const source of [page, detail, actions, compose, cohort, support, proposal, ui]) {
      assert.doesNotMatch(source, /correctProjectSpec|applyProjectSpecCorrection|correctProjectKind|saveProjectKindCorrection/);
      assert.doesNotMatch(source, /editPersonProfile|createPersonAtomic/);
      assert.doesNotMatch(source, /createOpenJob|writeHumanIntake|chief-of-staff|today-5/);
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /gtag|analytics|localStorage/);
    }
    assert.match(page, /index: false/);
    assert.match(detail, /index: false/);
    assert.match(actions, /"use server"/);
    assert.match(actions, /isPermittedCohort1ProjectId/);
    assert.doesNotMatch(actions, /formData\.get\(/);
    assert.doesNotMatch(actions, /getAttachment|users\.threads\.list/);
    assert.match(engine, /executeProjectCandidateDiscovery/);
    assert.doesNotMatch(barrel, /from "\.\/reconstruction-cohort"/);
    assert.doesNotMatch(server, /from "\.\/cohort-reconstruction-compose"/);
    assert.match(cohort, /isAleaRegressionProjectId/);
    assert.match(detail, /isPermittedCohort1ProjectId/);
    assert.doesNotMatch(detail, /accordion|project_kind/);
  });
});
