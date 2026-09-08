import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { CANDIDATE_PARSER_GMAIL_V1, type ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { GMAIL_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/gmail/types";
import { proposeGmailCandidates } from "@/lib/continuum/gmail/candidates/propose";
import { TRANSACTIONAL_CUSTOMER_NOTICE_RULE, WAITING_ON_CLIENT_TOPIC } from "@/lib/continuum/gmail/candidates/new-project";
import { packGmailCandidateSourceRef } from "@/lib/continuum/gmail/candidates/source-ref";
import {
  intakeCurrentState,
  presentGmailNewProjectIntake,
  preferredNewProjectTitle,
  summarizeIntakeWaitingValue,
} from "./intake-present";

const NOW = "2026-09-08T20:00:00.000Z";
const NATE_EMAIL = "nate.pearl@example.test";
const CASTILLO_EMAIL = "serinitybloom@gmail.com";
const WAGNER_EMAIL = "abbey.wagner@example.test";
const RAW_NATE_EXCERPT =
  "Re: Featured Ring Nate!! Haha, man…… would you like to hop on a call sometime this week";

function evidence(input: {
  messageId: string;
  threadId: string;
  sentAt: string;
  fromEmail: string;
  toEmails?: readonly string[];
  direction: "inbound" | "outbound";
  plaintext: string;
  subject?: string;
  filenames?: readonly string[];
}) {
  const fromEmailHash = hashEmail(input.fromEmail);
  return {
    indexed: {
      messageId: input.messageId,
      threadId: input.threadId,
      sentAt: input.sentAt,
      indexedAt: NOW,
      subject: input.subject ?? "A new piece",
      fromEmailHash,
      toEmailHashes: (input.toEmails ?? [])
        .map((email) => hashEmail(email))
        .filter((row): row is string => Boolean(row)),
      ccEmailHashes: [],
      bccEmailHashes: [],
      direction: input.direction,
      labelIds: input.direction === "outbound" ? ["SENT"] : ["INBOX"],
      hasAttachments: Boolean(input.filenames?.length),
      sourceSystem: GMAIL_SOURCE_SYSTEM,
    },
    plaintext: input.plaintext,
    fromEmailHash,
    attachments: (input.filenames ?? []).map((filename, index) => ({
      attachmentId: `att-${input.messageId}-${index}`,
      filename,
    })),
  };
}

function dateCandidate(threadId: string, index: number): ContinuumCandidate {
  const packed = packGmailCandidateSourceRef({
    threadId,
    messageId: `date-${index}`,
  });
  assert.equal(packed.ok, true);
  if (!packed.ok) throw new Error("source-ref");
  return {
    candidateId: `date-${index}`,
    sourceSystem: "gmail",
    sourceRef: packed.sourceRef,
    sourceTimestamp: NOW,
    candidateType: "date",
    proposedTarget: { kind: "none" },
    payload: {
      kind: "date",
      raw: "next week",
      isoDate: null,
      precision: "unresolved",
      role: "mentioned",
      sourceTimestamp: NOW,
      resolutionCalendar: null,
    },
    confidence: "low",
    evidenceBasis: { ruleIds: ["mentioned_date"], matchedText: "next week" },
    candidateState: "active",
    reviewStatus: "pending",
    lastReviewAction: null,
    founderEditedPayload: null,
    founderEditedTarget: null,
    reviewedAt: null,
    createdAt: NOW,
    canonical: false,
    automaticApply: false,
    parserVersion: CANDIDATE_PARSER_GMAIL_V1,
    supersedesCandidateId: null,
    supersededByCandidateId: null,
  };
}

describe("Gmail new-project intake presentation", () => {
  it("prefers Matching Marquise Earrings over a generic Custom Earrings title on the same thread", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: { people: [], projects: [], internalEmailHashes: [] },
      evidence: [
        evidence({
          messageId: "abbey-in-generic",
          threadId: "1a07e70c9a7538be",
          sentAt: "2026-09-08T00:35:03.000Z",
          fromEmail: CASTILLO_EMAIL,
          direction: "inbound",
          plaintext:
            "I'm reaching back out to ask about a new piece I'd like designed. Matching earrings.",
        }),
        evidence({
          messageId: "abbey-in-marquise",
          threadId: "1a07e70c9a7538be",
          sentAt: "2026-09-08T19:41:25.000Z",
          fromEmail: CASTILLO_EMAIL,
          direction: "inbound",
          plaintext:
            "I'm reaching back out to ask about a new piece I'd like designed. Matching marquise dangle earrings, a pair of marquise lab-grown diamonds approximately 1 ct each, 14k yellow gold, locking/secure back, possible flower detail.",
          filenames: ["IMG_9760.png"],
        }),
      ],
    });
    const preferred = preferredNewProjectTitle(proposed.candidates);
    assert.equal(preferred?.title, "Matching Marquise Earrings");
    const cards = presentGmailNewProjectIntake(proposed.candidates, [
      {
        personId: "castillo",
        displayName: "Abbey Castillo",
        email: CASTILLO_EMAIL,
      },
      {
        personId: "wagner",
        displayName: "Abbey Wagner",
        email: WAGNER_EMAIL,
      },
    ]);
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.title, "Matching Marquise Earrings");
    assert.equal(cards[0]?.possiblePersonName, "Abbey Castillo");
    assert.notEqual(cards[0]?.possiblePersonName, "Abbey Wagner");
    assert.equal(cards[0]?.identityConfirmed, false);
    assert.ok(cards[0]?.proposedSpecs.some((spec) => /1 ct/i.test(spec)));
    assert.ok(
      cards[0]?.structuredSpecs.some(
        (spec) => spec.fieldName === "metal" && /14k yellow gold/i.test(spec.proposedValue),
      ),
    );
    assert.ok(cards[0]!.supportingObservationCount >= 1);
    assert.ok(cards[0]?.attachmentFilenames.includes("IMG_9760.png"));
  });

  it("lets the latest inbound after Justin's questions become founder turn even if a waiting Candidate exists", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: {
        people: [],
        projects: [],
        internalEmailHashes: [hashEmail("justin@hourglass.example")!],
      },
      evidence: [
        evidence({
          messageId: "1a07e70c9a7538be",
          threadId: "1a07e70c9a7538be",
          sentAt: "2026-09-08T00:35:03.000Z",
          fromEmail: CASTILLO_EMAIL,
          direction: "inbound",
          plaintext:
            "I'm reaching back out to ask about a new piece I'd like designed. Matching marquise earrings.",
        }),
        evidence({
          messageId: "1a0819915472b215",
          threadId: "1a07e70c9a7538be",
          sentAt: "2026-09-08T15:17:57.000Z",
          fromEmail: "justin@hourglass.example",
          direction: "outbound",
          plaintext:
            "Would you prefer a plain yellow-gold flower or a diamond center? Also modular huggie vs standard drop construction?",
        }),
      ],
    });
    const waiting = proposed.candidates.find(
      (row) =>
        row.payload.kind === "project_context" &&
        row.payload.topic === WAITING_ON_CLIENT_TOPIC,
    );
    assert.ok(waiting);
    const cards = presentGmailNewProjectIntake(
      proposed.candidates,
      [{ personId: "castillo", displayName: "Abbey Castillo", email: CASTILLO_EMAIL }],
      [
        {
          threadId: "1a07e70c9a7538be",
          latestSentAt: "2026-09-08T19:41:25.000Z",
          latestDirection: "inbound",
          latestMessageId: "1a0828a52c652d5a",
          latestOutboundAt: "2026-09-08T15:17:57.000Z",
          latestOutboundMessageId: "1a0819915472b215",
        },
      ],
    );
    assert.equal(cards[0]?.currentStateKind, "founder_turn");
    assert.match(cards[0]?.currentStateSummary ?? "", /Your turn/i);
    assert.equal(cards[0]?.waitingOnClient, null);
    assert.doesNotMatch(cards[0]?.currentStateSummary ?? "", /Hey Abbey|Re: A new piece/i);
  });

  it("summarizes Nate waiting as a founder sentence and never uses the raw quoted body", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: { people: [], projects: [], internalEmailHashes: [] },
      evidence: [
        evidence({
          messageId: "nate-in",
          threadId: "19a854e42f90344f",
          sentAt: "2026-09-07T15:00:00.000Z",
          fromEmail: NATE_EMAIL,
          direction: "inbound",
          plaintext:
            "I'd like to work together again to create another piece. I'd like a necklace/pendant based on the same dagger-draped-in-pearls artwork from the wedding ring. It's a gift for my wife.",
          filenames: ["dagger-front.jpg", "dagger-side.jpg"],
        }),
        evidence({
          messageId: "nate-out",
          threadId: "19a854e42f90344f",
          sentAt: "2026-09-08T16:00:00.000Z",
          fromEmail: "justin@hourglass.example",
          direction: "outbound",
          plaintext:
            "Would you like to discuss this on a call, or should I proceed to a first render?",
        }),
      ],
    });
    const extras = Array.from({ length: 12 }, (_, index) =>
      dateCandidate("19a854e42f90344f", index),
    );
    const cards = presentGmailNewProjectIntake(
      [...proposed.candidates, ...extras],
      [{ personId: "nate", displayName: "Nathan Pearl", email: NATE_EMAIL }],
      [
        {
          threadId: "19a854e42f90344f",
          latestSentAt: "2026-09-08T16:00:00.000Z",
          latestDirection: "outbound",
          latestMessageId: "nate-out",
          latestOutboundAt: "2026-09-08T16:00:00.000Z",
          latestOutboundMessageId: "nate-out",
        },
      ],
    );
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.title, "Dagger & Pearls Pendant / Necklace");
    assert.equal(
      cards[0]?.currentStateSummary,
      "Waiting on Nathan — Justin offered either a call or moving directly to a first render.",
    );
    assert.equal(cards[0]?.waitingOnClient, cards[0]?.currentStateSummary);
    assert.doesNotMatch(cards[0]?.currentStateSummary ?? "", /Haha|Nate!!/);
    assert.match(cards[0]?.giftContext ?? "", /wife/i);
    assert.equal(cards[0]?.attachmentFilenames.length, 2);
    assert.ok(cards[0]!.supportingObservationCount >= 12);
  });

  it("does not treat a persisted raw excerpt as the founder-facing waiting summary", () => {
    assert.equal(
      summarizeIntakeWaitingValue(RAW_NATE_EXCERPT, "Nathan Pearl"),
      "Waiting on Nathan — Justin asked a design question.",
    );
    assert.doesNotMatch(
      summarizeIntakeWaitingValue(RAW_NATE_EXCERPT, "Nathan Pearl"),
      /Haha|Nate!!/,
    );
    const state = intakeCurrentState({
      turn: {
        threadId: "t",
        latestSentAt: "2026-09-08T16:00:00.000Z",
        latestDirection: "outbound",
        latestMessageId: "out",
        latestOutboundAt: "2026-09-08T16:00:00.000Z",
        latestOutboundMessageId: "out",
      },
      waiting: null,
      waitingForLatestOutbound: {
        ...dateCandidate("t", 0),
        candidateId: "wait",
        candidateType: "project_context",
        payload: {
          kind: "project_context",
          topic: WAITING_ON_CLIENT_TOPIC,
          value: RAW_NATE_EXCERPT,
        },
      },
      clientName: "Nathan Pearl",
    });
    assert.equal(state.kind, "waiting_on_client");
    assert.doesNotMatch(state.summary ?? "", /Haha|Nate!!|Re: Featured/);
  });

  it("still surfaces Abbey when hundreds of older Candidates precede her new-project row", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: { people: [], projects: [], internalEmailHashes: [] },
      evidence: [
        evidence({
          messageId: "abbey-in",
          threadId: "1a07e70c9a7538be",
          sentAt: "2026-09-08T00:35:03.000Z",
          fromEmail: CASTILLO_EMAIL,
          direction: "inbound",
          plaintext:
            "I'm reaching back out to ask about a new piece I'd like designed. Matching marquise earrings.",
        }),
      ],
    });
    const noise = Array.from({ length: 1005 }, (_, index) =>
      dateCandidate(`noise-${index}`, index),
    );
    const cards = presentGmailNewProjectIntake([...noise, ...proposed.candidates], [
      { personId: "castillo", displayName: "Abbey Castillo", email: CASTILLO_EMAIL },
    ]);
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.title, "Matching Marquise Earrings");
  });

  it("does not fixture-code Thomas, Bailey, Lucas, or Kinnin in founder synthesis", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const files = [
      join(dir, "intake-present.ts"),
      join(dir, "../../gmail/candidates/new-project.ts"),
      join(dir, "../../gmail/candidates/thread-reconcile.ts"),
      join(dir, "../../gmail/intake-scan.ts"),
    ];
    for (const file of files) {
      assert.doesNotMatch(readFileSync(file, "utf8"), /Thomas|Bailey|Lucas|Kinnin/);
    }
  });

  it("presents reactivated work as one piece with two People and founder turn", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: { people: [], projects: [], internalEmailHashes: [] },
      evidence: [
        evidence({
          messageId: "orig-in",
          threadId: "t-reactivate",
          sentAt: "2026-07-27T15:00:00.000Z",
          fromEmail: "jordan.reed@example.test",
          direction: "inbound",
          subject: "Custom necklace",
          plaintext:
            "I've been working with you on a necklace. Lab grown, white gold.",
        }),
        evidence({
          messageId: "founder-out",
          threadId: "t-reactivate",
          sentAt: "2026-07-28T15:00:00.000Z",
          fromEmail: "justin@hourglass.example",
          direction: "outbound",
          subject: "Re: Custom necklace",
          plaintext: "Happy to keep going — I'll send a first look when ready.",
        }),
        evidence({
          messageId: "later-in",
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
    const cards = presentGmailNewProjectIntake(
      proposed.candidates,
      [
        {
          personId: "jordan",
          displayName: "Jordan Reed",
          email: "jordan.reed@example.test",
        },
        {
          personId: "alex",
          displayName: "Alex Reed",
          email: "alex.reed@example.test",
        },
      ],
      [
        {
          threadId: "t-reactivate",
          latestSentAt: NOW,
          latestDirection: "inbound",
          latestMessageId: "later-in",
          latestOutboundAt: "2026-07-28T15:00:00.000Z",
          latestOutboundMessageId: "founder-out",
        },
      ],
    );
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.workStatus, "opportunity_reactivated");
    assert.equal(cards[0]?.canonicalProjectFound, false);
    assert.equal(cards[0]?.currentStateKind, "founder_turn");
    assert.equal(cards[0]?.people.length, 2);
    assert.equal(cards[0]?.people[0]?.role, "original_inquiry");
    assert.equal(cards[0]?.people[0]?.displayName, "Jordan Reed");
    assert.equal(cards[0]?.people[1]?.role, "current_correspondent");
    assert.equal(cards[0]?.people[1]?.displayName, "Alex Reed");
    assert.equal(cards[0]?.possiblePersonName, "Alex Reed");
    assert.doesNotMatch(cards[0]?.whySurfaced ?? "", /Can you send the price/);
    assert.equal(cards[0]?.identityConfirmed, false);
  });

  it("presents a payment notice as founder attention without minting from payment alone", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: { people: [], projects: [], internalEmailHashes: [] },
      evidence: [
        evidence({
          messageId: "pay",
          threadId: "t-pay",
          sentAt: NOW,
          fromEmail: "notifications@intuit.com",
          direction: "inbound",
          subject: "Payment received Invoice 1215",
          plaintext:
            "Invoice #1215-(Morgan Ellis)\nCustomer: Morgan Ellis\nAmount: $3,183.90\nPayment received\nmorgan.ellis@example.test",
        }),
        evidence({
          messageId: "ring",
          threadId: "t-ring",
          sentAt: "2026-08-10T15:00:00.000Z",
          fromEmail: "morgan.ellis@example.test",
          direction: "inbound",
          subject: "Engagement Ring",
          plaintext:
            "I'm planning to propose and wanted to talk about an engagement ring.",
        }),
      ],
    });
    const cards = presentGmailNewProjectIntake(proposed.candidates, [
      {
        personId: "morgan",
        displayName: "Morgan Ellis",
        email: "morgan.ellis@example.test",
      },
    ]);
    const payment = cards.find((row) => row.workStatus === "payment_received");
    assert.ok(payment);
    assert.equal(payment?.canonicalProjectFound, false);
    assert.equal(payment?.title, "Custom Engagement Ring");
    assert.ok(
      payment?.whySurfaced.includes("no canonical Project"),
    );
    assert.equal(
      proposed.candidates.some(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === "new_project" &&
          row.evidenceBasis.ruleIds.includes(TRANSACTIONAL_CUSTOMER_NOTICE_RULE),
      ),
      true,
    );
  });

  it("does not offer a second Project when related jewelry mail already has an exact thread Project", () => {
    const ringThread = "abcdef0123456789";
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: {
        people: [],
        projects: [
          {
            projectId: "existing-ring",
            title: "Custom Engagement Ring",
            gmailThreadId: ringThread,
            cadJobNumber: null,
            orderNumber: null,
            fingerSize: null,
            metal: null,
            centerStone: null,
            diamondSupplyNotes: null,
            personIds: [],
            founderApprovedCurrent: true,
          },
        ],
        internalEmailHashes: [],
      },
      evidence: [
        evidence({
          messageId: "pay-linked",
          threadId: "fedcba9876543210",
          sentAt: NOW,
          fromEmail: "notifications@intuit.com",
          direction: "inbound",
          subject: "Payment received Invoice 1215",
          plaintext:
            "Invoice #1215-(Morgan Ellis)\nCustomer: Morgan Ellis\nAmount: $3,183.90\nPayment received\nmorgan.ellis@example.test",
        }),
        evidence({
          messageId: "ring-linked",
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
    const cards = presentGmailNewProjectIntake(proposed.candidates, [
      {
        personId: "morgan",
        displayName: "Morgan Ellis",
        email: "morgan.ellis@example.test",
      },
    ]);
    const payment = cards.find((row) => row.workStatus === "payment_received");
    assert.ok(payment);
    assert.equal(payment?.canonicalProjectFound, true);
    assert.equal(payment?.identityConfirmed, false);
    assert.match(payment?.whySurfaced ?? "", /already on a Project/);
  });
});
