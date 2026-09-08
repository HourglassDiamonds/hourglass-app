import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { GMAIL_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/gmail/types";
import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import { proposeGmailCandidates } from "./propose";
import {
  ATTACHMENT_FILENAME_TOPIC,
  DESIGN_BASIS_TOPIC,
  GIFT_CONTEXT_TOPIC,
  looksExplicitNewProjectRequest,
  NEW_PROJECT_CONTEXT_TOPIC,
  PROPOSED_SPEC_TOPIC,
  WAITING_ON_CLIENT_TOPIC,
} from "./new-project";
import type {
  GmailCandidateEvidence,
  GmailCandidatePerson,
  GmailCandidateProject,
  GmailCandidateWorld,
} from "./types";

const NOW = "2026-09-08T12:00:00.000Z";
const NATE_EMAIL = "nate.pearl@example.test";
const ABBEY_CASTILLO_EMAIL = "serinitybloom@gmail.com";
const ABBEY_WAGNER_EMAIL = "abbey.wagner@example.test";
const NATE_BODY_NONCE = "UNIQUE_BODY_NONCE_NATE_98765";
const ABBEY_BODY_NONCE = "UNIQUE_BODY_NONCE_ABBEY_54321";

const NATE_INBOUND = `I'd like to work together again to create another piece. I'd like a necklace/pendant based on the same dagger-draped-in-pearls artwork from the wedding ring. It's a gift for my wife. ${NATE_BODY_NONCE}`;
const NATE_OUTBOUND = `Would you like to discuss this on a call, or should I proceed to a first render?`;
const ABBEY_INBOUND = `I'm reaching back out to ask about a new piece I'd like designed. Matching marquise dangle/hoop earrings, a pair of marquise lab-grown diamonds approximately 1 ct each, similar quality/brightness, 14k yellow gold, locking/secure back, possible flower detail. ${ABBEY_BODY_NONCE}`;
const ABBEY_OUTBOUND = `Would you prefer a plain yellow-gold flower or a diamond center? Also modular huggie vs standard drop construction?`;

function indexed(input: {
  messageId: string;
  threadId: string;
  sentAt: string;
  subject?: string;
  fromEmail?: string;
  direction: GmailIndexedMessage["direction"];
  hasAttachments?: boolean;
}): GmailIndexedMessage {
  return {
    messageId: input.messageId,
    threadId: input.threadId,
    sentAt: input.sentAt,
    indexedAt: NOW,
    subject: input.subject ?? null,
    fromEmailHash: hashEmail(input.fromEmail ?? null),
    toEmailHashes: [],
    ccEmailHashes: [],
    bccEmailHashes: [],
    direction: input.direction,
    labelIds: input.direction === "outbound" ? ["SENT"] : ["INBOX"],
    hasAttachments: Boolean(input.hasAttachments),
    sourceSystem: GMAIL_SOURCE_SYSTEM,
  };
}

function evidence(
  input: Parameters<typeof indexed>[0] & {
    plaintext?: string;
    filenames?: readonly string[];
  },
): GmailCandidateEvidence {
  const row = indexed(input);
  return {
    indexed: row,
    plaintext: input.plaintext ?? null,
    fromEmailHash: row.fromEmailHash,
    attachments: (input.filenames ?? []).map((filename, index) => ({
      attachmentId: `att-${row.messageId}-${index}`,
      filename,
    })),
  };
}

function person(input: {
  personId: string;
  displayName: string;
  email: string;
  projectIds: readonly string[];
}): GmailCandidatePerson {
  return {
    personId: input.personId,
    displayName: input.displayName,
    emailHash: hashEmail(input.email),
    role: "client",
    projectIds: input.projectIds,
  };
}

function project(input: {
  projectId: string;
  title: string;
  personIds: readonly string[];
}): GmailCandidateProject {
  return {
    projectId: input.projectId,
    title: input.title,
    gmailThreadId: null,
    cadJobNumber: null,
    orderNumber: null,
    fingerSize: null,
    metal: null,
    centerStone: null,
    diamondSupplyNotes: null,
    personIds: input.personIds,
    founderApprovedCurrent: true,
  };
}

describe("explicit new-project Gmail proposals", () => {
  it("does not treat generic conversation as a new Project", () => {
    assert.equal(
      looksExplicitNewProjectRequest("Thanks for the update on the ring. CAD looks great."),
      false,
    );
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: { people: [], projects: [], internalEmailHashes: [] },
      evidence: [
        evidence({
          messageId: "m-generic",
          threadId: "t-generic",
          sentAt: NOW,
          direction: "inbound",
          plaintext: "Thanks for the update. How is production going?",
        }),
      ],
    });
    assert.equal(
      proposed.candidates.some(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
      ),
      false,
    );
  });

  it("proposes Nathan Pearl's dagger/pearl pendant without attaching the old wedding ring or a reply job", () => {
    const nate = person({
      personId: "nate-person",
      displayName: "Nathan Pearl",
      email: NATE_EMAIL,
      projectIds: ["old-ring"],
    });
    const wagner = person({
      personId: "abbey-wagner",
      displayName: "Abbey Wagner",
      email: ABBEY_WAGNER_EMAIL,
      projectIds: ["wagner-project"],
    });
    const oldRing = project({
      projectId: "old-ring",
      title: "Dagger wedding ring",
      personIds: [nate.personId],
    });
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: {
        people: [nate, wagner],
        projects: [oldRing],
        internalEmailHashes: [hashEmail("justin@hourglass.example")!],
      } satisfies GmailCandidateWorld,
      evidence: [
        evidence({
          messageId: "m-nate-in",
          threadId: "t-nate",
          sentAt: "2026-09-07T15:00:00.000Z",
          fromEmail: NATE_EMAIL,
          direction: "inbound",
          hasAttachments: true,
          filenames: ["original-painting.jpg", "ai-necklace-concept.png"],
          plaintext: NATE_INBOUND,
        }),
        evidence({
          messageId: "m-nate-out",
          threadId: "t-nate",
          sentAt: "2026-09-07T18:00:00.000Z",
          fromEmail: "justin@hourglass.example",
          direction: "outbound",
          plaintext: NATE_OUTBOUND,
        }),
      ],
    });
    const serialized = JSON.stringify(proposed.candidates);
    assert.equal(serialized.includes(NATE_BODY_NONCE), false);
    const personHit = proposed.candidates.find(
      (row) => row.candidateType === "person_association",
    );
    assert.equal(personHit?.proposedTarget.kind === "person" && personHit.proposedTarget.personId, nate.personId);
    assert.equal(
      proposed.candidates.some(
        (row) =>
          row.candidateType === "project_association" &&
          row.proposedTarget.kind === "project" &&
          row.proposedTarget.projectId === "old-ring",
      ),
      false,
    );
    const neu = proposed.candidates.find(
      (row) =>
        row.payload.kind === "project_context" &&
        row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
    );
    assert.equal(neu?.payload.kind === "project_context" && neu.payload.value, "Dagger & Pearls Pendant / Necklace");
    assert.equal(neu?.proposedTarget.kind === "project" && neu.proposedTarget.projectId, null);
    assert.equal(
      proposed.candidates.some(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === GIFT_CONTEXT_TOPIC &&
          row.payload.value.includes("wife"),
      ),
      true,
    );
    assert.equal(
      proposed.candidates.some(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === DESIGN_BASIS_TOPIC,
      ),
      true,
    );
    assert.equal(
      proposed.candidates.some(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === ATTACHMENT_FILENAME_TOPIC &&
          row.payload.value === "original-painting.jpg",
      ),
      true,
    );
    const waiting = proposed.candidates.find(
      (row) =>
        row.payload.kind === "project_context" &&
        row.payload.topic === WAITING_ON_CLIENT_TOPIC,
    );
    assert.ok(waiting);
    assert.match(
      waiting && waiting.payload.kind === "project_context" ? waiting.payload.value : "",
      /call|render/i,
    );
    assert.equal(
      proposed.candidates.some((row) => row.candidateType === "open_job"),
      false,
    );
    assert.equal(proposed.mutationBoundary.createsOpenJobs, false);
    assert.equal(proposed.mutationBoundary.canonical, false);
  });

  it("proposes Abbey Castillo matching earrings and never confuses her with Abbey Wagner", () => {
    const castillo = person({
      personId: "abbey-castillo",
      displayName: "Abbey Castillo",
      email: ABBEY_CASTILLO_EMAIL,
      projectIds: ["engagement-ring"],
    });
    const wagner = person({
      personId: "abbey-wagner",
      displayName: "Abbey Wagner",
      email: ABBEY_WAGNER_EMAIL,
      projectIds: ["wagner-project"],
    });
    const ring = project({
      projectId: "engagement-ring",
      title: "Castillo engagement ring",
      personIds: [castillo.personId],
    });
    const wagnerProject = project({
      projectId: "wagner-project",
      title: "Wagner repair",
      personIds: [wagner.personId],
    });
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: {
        people: [castillo, wagner],
        projects: [ring, wagnerProject],
        internalEmailHashes: [hashEmail("justin@hourglass.example")!],
      },
      evidence: [
        evidence({
          messageId: "m-abbey-in",
          threadId: "t-abbey",
          sentAt: "2026-09-06T14:00:00.000Z",
          fromEmail: ABBEY_CASTILLO_EMAIL,
          direction: "inbound",
          plaintext: ABBEY_INBOUND,
        }),
        evidence({
          messageId: "m-abbey-out",
          threadId: "t-abbey",
          sentAt: "2026-09-06T17:00:00.000Z",
          fromEmail: "justin@hourglass.example",
          direction: "outbound",
          plaintext: ABBEY_OUTBOUND,
        }),
      ],
    });
    const serialized = JSON.stringify(proposed.candidates);
    assert.equal(serialized.includes(ABBEY_BODY_NONCE), false);
    const personHit = proposed.candidates.find(
      (row) => row.candidateType === "person_association",
    );
    assert.equal(
      personHit?.proposedTarget.kind === "person" && personHit.proposedTarget.personId,
      castillo.personId,
    );
    assert.equal(
      proposed.candidates.some(
        (row) =>
          row.proposedTarget.kind === "person" &&
          row.proposedTarget.personId === wagner.personId,
      ),
      false,
    );
    const neu = proposed.candidates.find(
      (row) =>
        row.payload.kind === "project_context" &&
        row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
    );
    assert.equal(
      neu?.payload.kind === "project_context" && neu.payload.value,
      "Matching Marquise Earrings",
    );
    assert.equal(
      proposed.candidates.some(
        (row) =>
          row.candidateType === "project_association" &&
          row.proposedTarget.kind === "project" &&
          row.proposedTarget.projectId === "engagement-ring",
      ),
      false,
    );
    assert.equal(
      proposed.candidates.some(
        (row) =>
          row.payload.kind === "structured_spec" &&
          row.payload.fieldName === "metal" &&
          /14k yellow gold/i.test(row.payload.proposedValue),
      ),
      true,
    );
    assert.equal(
      proposed.candidates.some(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === PROPOSED_SPEC_TOPIC &&
          row.payload.value.includes("marquise"),
      ),
      true,
    );
    const waiting = proposed.candidates.find(
      (row) =>
        row.payload.kind === "project_context" &&
        row.payload.topic === WAITING_ON_CLIENT_TOPIC,
    );
    assert.ok(waiting);
    assert.match(
      waiting && waiting.payload.kind === "project_context" ? waiting.payload.value : "",
      /flower|huggie|drop/i,
    );
    assert.equal(
      proposed.candidates.some((row) => row.candidateType === "open_job"),
      false,
    );
  });

  it("does not propose a new Project from repair, status, or CAD approval language", () => {
    const texts = [
      "Can you repair the prong on the engagement ring?",
      "Status update: still waiting on the same CAD revision.",
      "CAD looks great — please proceed.",
      "Unsubscribe from this newsletter.",
    ];
    for (const plaintext of texts) {
      assert.equal(looksExplicitNewProjectRequest(plaintext), false);
      const proposed = proposeGmailCandidates({
        createdAt: NOW,
        world: { people: [], projects: [], internalEmailHashes: [] },
        evidence: [
          evidence({
            messageId: "m-generic-2",
            threadId: "t-generic-2",
            sentAt: NOW,
            direction: "inbound",
            plaintext,
          }),
        ],
      });
      assert.equal(
        proposed.candidates.some(
          (row) =>
            row.payload.kind === "project_context" &&
            row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
        ),
        false,
        plaintext,
      );
    }
  });

  it("drops a stale reply request after the founder already answered with a client choice", () => {
    const nate = person({
      personId: "nate-person",
      displayName: "Nathan Pearl",
      email: NATE_EMAIL,
      projectIds: [],
    });
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: {
        people: [nate],
        projects: [],
        internalEmailHashes: [hashEmail("justin@hourglass.example")!],
      },
      evidence: [
        evidence({
          messageId: "m-in",
          threadId: "t-choice",
          sentAt: "2026-09-07T15:00:00.000Z",
          fromEmail: NATE_EMAIL,
          direction: "inbound",
          plaintext:
            "I'd like to work together again to create another piece. Can you send a first look?",
        }),
        evidence({
          messageId: "m-out",
          threadId: "t-choice",
          sentAt: "2026-09-07T18:00:00.000Z",
          fromEmail: "justin@hourglass.example",
          direction: "outbound",
          plaintext: "Would you like a call, or should I proceed to a first render?",
        }),
      ],
    });
    assert.equal(
      proposed.candidates.some((row) => row.candidateType === "open_job"),
      false,
    );
    assert.equal(
      proposed.candidates.some(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === WAITING_ON_CLIENT_TOPIC,
      ),
      true,
    );
  });
});
