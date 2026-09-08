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
  REACTIVATED_COMMERCIAL_WORK_RULE,
  RELATED_CUSTOMER_JEWELRY_THREAD_RULE,
  TRANSACTIONAL_CUSTOMER_NOTICE_RULE,
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
  toEmails?: readonly string[];
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
    toEmailHashes: (input.toEmails ?? [])
      .map((email) => hashEmail(email))
      .filter((row): row is string => Boolean(row)),
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
  gmailThreadId?: string | null;
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
    assert.equal(personHit?.canonical, false);
    assert.equal(personHit?.automaticApply, false);
    assert.equal(personHit?.proposedTarget.kind, "person");
    if (personHit?.proposedTarget.kind === "person") {
      assert.equal(personHit.proposedTarget.personId, null);
    }
    assert.ok(
      personHit?.evidenceBasis.ruleIds.includes("email_hash_supporting_not_identity"),
    );
    if (personHit?.payload.kind === "person_association") {
      assert.equal(personHit.payload.displayName, "Nathan Pearl");
      assert.equal(personHit.payload.mintPerson, false);
      assert.equal(personHit.payload.mergePersons, false);
    }
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
    assert.equal(
      waiting && waiting.payload.kind === "project_context" ? waiting.payload.value : "",
      "call or first render",
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
    assert.equal(personHit?.canonical, false);
    assert.equal(personHit?.automaticApply, false);
    assert.equal(personHit?.proposedTarget.kind, "person");
    if (personHit?.proposedTarget.kind === "person") {
      assert.equal(personHit.proposedTarget.personId, null);
    }
    assert.ok(
      personHit?.evidenceBasis.ruleIds.includes("email_hash_supporting_not_identity"),
    );
    if (personHit?.payload.kind === "person_association") {
      assert.equal(personHit.payload.displayName, "Abbey Castillo");
      assert.equal(personHit.payload.mintPerson, false);
      assert.equal(personHit.payload.mergePersons, false);
    }
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
    assert.equal(
      waiting && waiting.payload.kind === "project_context" ? waiting.payload.value : "",
      "design question",
    );
    assert.equal(waiting?.evidenceBasis.matchedText, "design question");
    assert.equal(
      proposed.candidates.some((row) => row.candidateType === "open_job"),
      false,
    );
  });

  it("does not keep waiting_on_client when Abbey's latest turn is inbound after Justin's questions", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: {
        people: [],
        projects: [],
        internalEmailHashes: [hashEmail("justin@hourglass.example")!],
      },
      evidence: [
        evidence({
          messageId: "m-abbey-in",
          threadId: "t-abbey-later",
          sentAt: "2026-09-08T00:35:03.000Z",
          fromEmail: ABBEY_CASTILLO_EMAIL,
          direction: "inbound",
          plaintext: ABBEY_INBOUND,
        }),
        evidence({
          messageId: "m-abbey-out",
          threadId: "t-abbey-later",
          sentAt: "2026-09-08T15:17:57.000Z",
          fromEmail: "justin@hourglass.example",
          direction: "outbound",
          plaintext: ABBEY_OUTBOUND,
        }),
        evidence({
          messageId: "m-abbey-later",
          threadId: "t-abbey-later",
          sentAt: "2026-09-08T19:41:25.000Z",
          fromEmail: ABBEY_CASTILLO_EMAIL,
          direction: "inbound",
          plaintext:
            "I'd prefer the flower detail and the locking back. Happy to answer the rest whenever you are ready.",
        }),
      ],
    });
    assert.equal(
      proposed.candidates.some(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === WAITING_ON_CLIENT_TOPIC,
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

  it("does not treat a display-name exact match as Person identity", () => {
    const castillo = person({
      personId: "abbey-castillo",
      displayName: "Abbey Castillo",
      email: ABBEY_CASTILLO_EMAIL,
      projectIds: [],
    });
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: {
        people: [castillo],
        projects: [],
        internalEmailHashes: [],
      },
      evidence: [
        evidence({
          messageId: "m-name",
          threadId: "t-name",
          sentAt: NOW,
          fromEmail: "unknown.sender@example.test",
          direction: "inbound",
          plaintext: `Hello, this is Abbey Castillo. ${ABBEY_INBOUND}`,
        }),
      ],
    });
    const personHit = proposed.candidates.find(
      (row) => row.candidateType === "person_association",
    );
    assert.equal(personHit?.proposedTarget.kind, "person");
    if (personHit?.proposedTarget.kind === "person") {
      assert.equal(personHit.proposedTarget.personId, null);
    }
    if (personHit?.payload.kind === "person_association") {
      assert.equal(personHit.payload.displayName, null);
    }
    assert.equal(
      proposed.candidates.some(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
      ),
      true,
    );
  });

  it("does not bind Abbey Wagner from a similar name when the hash is Castillo", () => {
    const castillo = person({
      personId: "abbey-castillo",
      displayName: "Abbey Castillo",
      email: ABBEY_CASTILLO_EMAIL,
      projectIds: [],
    });
    const wagner = person({
      personId: "abbey-wagner",
      displayName: "Abbey Wagner",
      email: ABBEY_WAGNER_EMAIL,
      projectIds: [],
    });
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: {
        people: [castillo, wagner],
        projects: [],
        internalEmailHashes: [],
      },
      evidence: [
        evidence({
          messageId: "m-similar",
          threadId: "t-similar",
          sentAt: NOW,
          fromEmail: ABBEY_CASTILLO_EMAIL,
          direction: "inbound",
          plaintext: `Hi, it's Abbey. ${ABBEY_INBOUND}`,
        }),
      ],
    });
    assert.equal(
      proposed.candidates.some(
        (row) =>
          row.proposedTarget.kind === "person" &&
          row.proposedTarget.personId === wagner.personId,
      ),
      false,
    );
    const personHit = proposed.candidates.find(
      (row) => row.candidateType === "person_association",
    );
    if (personHit?.proposedTarget.kind === "person") {
      assert.equal(personHit.proposedTarget.personId, null);
    }
    if (personHit?.payload.kind === "person_association") {
      assert.equal(personHit.payload.displayName, "Abbey Castillo");
      assert.notEqual(personHit.payload.displayName, "Abbey Wagner");
    }
  });

  it("targets a Person when a founder-confirmed participant mapping already exists", () => {
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
        internalEmailHashes: [],
        confirmedParticipantMappings: [
          { emailHash: hashEmail(NATE_EMAIL)!, personId: nate.personId },
        ],
      },
      evidence: [
        evidence({
          messageId: "m-mapped",
          threadId: "t-mapped",
          sentAt: NOW,
          fromEmail: NATE_EMAIL,
          direction: "inbound",
          plaintext: NATE_INBOUND,
        }),
      ],
    });
    const personHit = proposed.candidates.find(
      (row) => row.candidateType === "person_association",
    );
    assert.equal(personHit?.proposedTarget.kind, "person");
    if (personHit?.proposedTarget.kind === "person") {
      assert.equal(personHit.proposedTarget.personId, nate.personId);
    }
    assert.ok(
      personHit?.evidenceBasis.ruleIds.includes("founder_confirmed_participant_mapping"),
    );
  });

  it("targets a Person when a founder-confirmed address identity already exists", () => {
    const castillo = person({
      personId: "abbey-castillo",
      displayName: "Abbey Castillo",
      email: ABBEY_CASTILLO_EMAIL,
      projectIds: [],
    });
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: {
        people: [castillo],
        projects: [],
        internalEmailHashes: [],
        founderConfirmedEmailIdentities: [
          {
            emailHash: hashEmail(ABBEY_CASTILLO_EMAIL)!,
            personId: castillo.personId,
          },
        ],
      },
      evidence: [
        evidence({
          messageId: "m-id",
          threadId: "t-id",
          sentAt: NOW,
          fromEmail: ABBEY_CASTILLO_EMAIL,
          direction: "inbound",
          plaintext: ABBEY_INBOUND,
        }),
      ],
    });
    const personHit = proposed.candidates.find(
      (row) => row.candidateType === "person_association",
    );
    if (personHit?.proposedTarget.kind === "person") {
      assert.equal(personHit.proposedTarget.personId, castillo.personId);
    }
    assert.ok(
      personHit?.evidenceBasis.ruleIds.includes("founder_confirmed_address_identity"),
    );
  });

  it("targets a Person from a confirmed Gmail source link", () => {
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
        internalEmailHashes: [],
        confirmedSourceLinks: [{ threadId: "t-link", personId: nate.personId }],
      },
      evidence: [
        evidence({
          messageId: "m-link",
          threadId: "t-link",
          sentAt: NOW,
          fromEmail: NATE_EMAIL,
          direction: "inbound",
          plaintext: NATE_INBOUND,
        }),
      ],
    });
    const personHit = proposed.candidates.find(
      (row) => row.candidateType === "person_association",
    );
    if (personHit?.proposedTarget.kind === "person") {
      assert.equal(personHit.proposedTarget.personId, nate.personId);
    }
    assert.ok(
      personHit?.evidenceBasis.ruleIds.includes("founder_confirmed_gmail_source_link"),
    );
  });

  it("surfaces reactivated commercial work when a later correspondent asks price and timeline", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: { people: [], projects: [], internalEmailHashes: [] },
      evidence: [
        evidence({
          messageId: "m-orig",
          threadId: "t-reactivate",
          sentAt: "2026-07-27T15:00:00.000Z",
          fromEmail: "jordan.reed@example.test",
          direction: "inbound",
          subject: "Custom necklace",
          plaintext:
            "I've been working with you on a necklace. Lab grown, white gold.",
        }),
        evidence({
          messageId: "m-later",
          threadId: "t-reactivate",
          sentAt: NOW,
          fromEmail: "alex.reed@example.test",
          direction: "inbound",
          subject: "Re: Custom necklace",
          plaintext:
            "Can you send the price and timeline? What are the next steps? I'm available for a call.",
        }),
      ],
    });
    const neu = proposed.candidates.find(
      (row) =>
        row.payload.kind === "project_context" &&
        row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
    );
    assert.ok(neu);
    assert.ok(neu?.evidenceBasis.ruleIds.includes(REACTIVATED_COMMERCIAL_WORK_RULE));
    const people = proposed.candidates.filter(
      (row) => row.candidateType === "person_association",
    );
    assert.equal(people.length, 2);
    const hashes = new Set(
      people.flatMap((row) =>
        row.payload.kind === "person_association" && row.payload.emailHash
          ? [row.payload.emailHash]
          : [],
      ),
    );
    assert.equal(hashes.has(hashEmail("jordan.reed@example.test")!), true);
    assert.equal(hashes.has(hashEmail("alex.reed@example.test")!), true);
  });

  it("does not attach a later correspondent's new work to an older Person-linked Project", () => {
    const original = person({
      personId: "jordan-person",
      displayName: "Jordan Reed",
      email: "jordan.reed@example.test",
      projectIds: ["old-necklace"],
    });
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: {
        people: [original],
        projects: [
          project({
            projectId: "old-necklace",
            title: "Older necklace",
            personIds: [original.personId],
          }),
        ],
        internalEmailHashes: [],
        founderConfirmedEmailIdentities: [
          {
            emailHash: hashEmail("jordan.reed@example.test")!,
            personId: original.personId,
          },
        ],
      },
      evidence: [
        evidence({
          messageId: "m-orig-2",
          threadId: "t-reactivate-2",
          sentAt: "2026-07-27T15:00:00.000Z",
          fromEmail: "jordan.reed@example.test",
          direction: "inbound",
          subject: "Custom necklace",
          plaintext: "I've been working with you on a necklace.",
        }),
        evidence({
          messageId: "m-later-2",
          threadId: "t-reactivate-2",
          sentAt: NOW,
          fromEmail: "alex.reed@example.test",
          direction: "inbound",
          subject: "Re: Custom necklace",
          plaintext:
            "I'd like to work together again to create another piece. What's the price and timeline?",
        }),
      ],
    });
    const neu = proposed.candidates.find(
      (row) =>
        row.payload.kind === "project_context" &&
        row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
    );
    assert.ok(neu);
    if (neu?.proposedTarget.kind === "project") {
      assert.equal(neu.proposedTarget.projectId, null);
    }
  });

  it("does not mint a Project from a transactional notice without related jewelry mail", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: { people: [], projects: [], internalEmailHashes: [] },
      evidence: [
        evidence({
          messageId: "m-pay-only",
          threadId: "t-pay-only",
          sentAt: NOW,
          fromEmail: "notifications@intuit.com",
          direction: "inbound",
          subject: "Payment received Invoice 1215",
          plaintext:
            "Invoice #1215-(Morgan Ellis)\nCustomer: Morgan Ellis\nAmount: $3,183.90\nPayment received\nmorgan.ellis@example.test",
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
    const people = proposed.candidates.filter(
      (row) => row.candidateType === "person_association",
    );
    assert.equal(people.length, 1);
    if (people[0]?.payload.kind === "person_association") {
      assert.equal(people[0].payload.emailHash, hashEmail("morgan.ellis@example.test"));
      assert.equal(people[0].payload.displayName, "Morgan Ellis");
    }
    assert.equal(
      people.some(
        (row) =>
          row.payload.kind === "person_association" &&
          row.payload.emailHash === hashEmail("notifications@intuit.com"),
      ),
      false,
    );
  });

  it("reconciles a transactional customer notice to related jewelry mail across threads", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: { people: [], projects: [], internalEmailHashes: [] },
      evidence: [
        evidence({
          messageId: "m-pay",
          threadId: "t-pay",
          sentAt: NOW,
          fromEmail: "notifications@intuit.com",
          direction: "inbound",
          subject: "Payment received Invoice 1215",
          plaintext:
            "Invoice #1215-(Morgan Ellis)\nCustomer: Morgan Ellis\nAmount: $3,183.90\nPayment received\nmorgan.ellis@example.test",
        }),
        evidence({
          messageId: "m-ring",
          threadId: "t-ring",
          sentAt: "2026-08-10T15:00:00.000Z",
          fromEmail: "morgan.ellis@example.test",
          direction: "inbound",
          subject: "Engagement Ring",
          plaintext:
            "I'm planning to propose and wanted to talk about an engagement ring.",
        }),
        evidence({
          messageId: "m-recap",
          threadId: "t-recap",
          sentAt: "2026-08-17T15:00:00.000Z",
          fromEmail: "justin@hourglass.example",
          toEmails: ["morgan.ellis@example.test"],
          direction: "outbound",
          subject: "HGD x Eng Ring",
          plaintext: "Recap of the engagement ring design and next steps.",
        }),
      ],
    });
    const payment = proposed.candidates.find(
      (row) =>
        row.payload.kind === "project_context" &&
        row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC &&
        row.evidenceBasis.ruleIds.includes(TRANSACTIONAL_CUSTOMER_NOTICE_RULE),
    );
    assert.ok(payment);
    if (payment?.payload.kind === "project_context") {
      assert.equal(payment.payload.value, "Custom Engagement Ring");
    }
  });

  it("links a transactional notice to an existing exact-thread Project instead of proposing a duplicate", () => {
    const ringThread = "abcdef0123456789";
    const existing = project({
      projectId: "existing-ring",
      title: "Custom Engagement Ring",
      personIds: [],
      gmailThreadId: ringThread,
    });
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: { people: [], projects: [existing], internalEmailHashes: [] },
      evidence: [
        evidence({
          messageId: "m-pay-linked",
          threadId: "fedcba9876543210",
          sentAt: NOW,
          fromEmail: "notifications@intuit.com",
          direction: "inbound",
          subject: "Payment received Invoice 1215",
          plaintext:
            "Invoice #1215-(Morgan Ellis)\nCustomer: Morgan Ellis\nAmount: $3,183.90\nPayment received\nmorgan.ellis@example.test",
        }),
        evidence({
          messageId: "m-ring-linked",
          threadId: ringThread,
          sentAt: "2026-08-10T15:00:00.000Z",
          fromEmail: "morgan.ellis@example.test",
          direction: "inbound",
          subject: "Engagement Ring",
          plaintext:
            "I'm planning to propose and wanted to talk about an engagement ring.",
        }),
      ],
    });
    const payment = proposed.candidates.find(
      (row) =>
        row.payload.kind === "project_context" &&
        row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC &&
        row.evidenceBasis.ruleIds.includes(TRANSACTIONAL_CUSTOMER_NOTICE_RULE),
    );
    assert.ok(payment);
    assert.equal(payment?.automaticApply, false);
    if (payment?.proposedTarget.kind === "project") {
      assert.equal(payment.proposedTarget.projectId, null);
    }
    const linked = proposed.candidates.find(
      (row) =>
        row.candidateType === "project_association" &&
        row.evidenceBasis.ruleIds.includes(RELATED_CUSTOMER_JEWELRY_THREAD_RULE),
    );
    assert.ok(linked);
    if (linked?.proposedTarget.kind === "project") {
      assert.equal(linked.proposedTarget.projectId, existing.projectId);
    }
    assert.equal(
      proposed.candidates.filter(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
      ).length,
      1,
    );
    const personHit = proposed.candidates.find(
      (row) =>
        row.candidateType === "person_association" &&
        row.payload.kind === "person_association" &&
        row.payload.emailHash === hashEmail("morgan.ellis@example.test"),
    );
    if (personHit?.proposedTarget.kind === "person") {
      assert.equal(personHit.proposedTarget.personId, null);
    }
  });

  it("does not emit a new-project proposal for a thread already linked to a canonical Project", () => {
    const threadId = "19a854e42f90344f";
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: {
        people: [],
        projects: [],
        internalEmailHashes: [],
        linkedGmailThreadIds: [threadId],
      },
      evidence: [
        evidence({
          messageId: "m-again",
          threadId,
          sentAt: NOW,
          fromEmail: "alex.reed@example.test",
          direction: "inbound",
          plaintext:
            "I'd like to work together again to create another piece. A dagger and pearls necklace.",
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
});

