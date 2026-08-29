import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import {
  GMAIL_SOURCE_SYSTEM,
  type GmailIndexedMessage,
} from "@/lib/continuum/client-memory/gmail/types";
import { extractOrderIdentifiers } from "./order-identifier";
import {
  discoverRelatedThreadCandidates,
  extractStrongProjectIdentifiers,
  INTERNAL_HOURGLASS_ADDRESSES,
  type StrongProjectIdentifier,
} from "./project-reconstruction";

const PERSON = "client@example.com";
const FOUNDER = "founder@hourglass.example";
const PERSON_HASH = hashEmail(PERSON)!;
const FOUNDER_HASH = hashEmail(FOUNDER)!;
const PROJECT_ID = "proj-routing-hardening";
const ANCHOR = "19anchorthread000001";

function indexed(input: {
  messageId: string;
  threadId: string;
  subject: string;
  fromEmail: string;
  toEmail: string;
  sentAt?: string;
}): GmailIndexedMessage {
  return {
    messageId: input.messageId,
    threadId: input.threadId,
    sentAt: input.sentAt ?? "2024-04-04T10:00:00.000Z",
    indexedAt: "2026-08-28T00:00:00.000Z",
    subject: input.subject,
    fromEmailHash: hashEmail(input.fromEmail),
    toEmailHashes: [hashEmail(input.toEmail)!],
    ccEmailHashes: [],
    bccEmailHashes: [],
    direction: "unknown",
    labelIds: [],
    hasAttachments: false,
    sourceSystem: GMAIL_SOURCE_SYSTEM,
  };
}

function ids(
  rows: StrongProjectIdentifier[],
): StrongProjectIdentifier[] {
  return [
    { kind: "anchor_thread", value: ANCHOR, strength: "strong_structured" },
    ...rows,
  ];
}

function discover(
  identifiers: StrongProjectIdentifier[],
  messages: GmailIndexedMessage[],
) {
  return discoverRelatedThreadCandidates({
    anchorThreadId: ANCHOR,
    identifiers: ids(identifiers),
    indexedMessages: messages,
    candidateProjectId: PROJECT_ID,
  });
}

describe("related-thread discovery scoring", () => {
  it("excludes generic Re: from the same Person", () => {
    const handoff = discover(
      [
        {
          kind: "person_email_hash",
          value: PERSON_HASH,
          strength: "supporting",
        },
        {
          kind: "subject_term",
          value: "bracelet",
          strength: "supporting",
        },
      ],
      [
        indexed({
          messageId: "idx-re",
          threadId: "19genericre00000001",
          subject: "Re:",
          fromEmail: PERSON,
          toEmail: FOUNDER,
        }),
      ],
    );
    assert.equal(
      handoff.candidates.some((row) => row.threadId === "19genericre00000001"),
      false,
    );
  });

  it("excludes same Person + same vendor", () => {
    const handoff = discover(
      [
        {
          kind: "person_email_hash",
          value: PERSON_HASH,
          strength: "supporting",
        },
        { kind: "vendor", value: "Vendor North", strength: "supporting" },
      ],
      [
        indexed({
          messageId: "idx-vendor-person",
          threadId: "19vendorperson00001",
          subject: "Vendor North workshop note",
          fromEmail: PERSON,
          toEmail: FOUNDER,
        }),
      ],
    );
    assert.equal(handoff.candidates.length, 0);
  });

  it("excludes same Person + date proximity only", () => {
    const handoff = discover(
      [
        {
          kind: "person_email_hash",
          value: PERSON_HASH,
          strength: "supporting",
        },
        {
          kind: "project_date",
          value: "2024-04-04T10:00:00.000Z",
          strength: "supporting",
        },
      ],
      [
        indexed({
          messageId: "idx-date",
          threadId: "19dateonly000000001",
          subject: "Checking in",
          fromEmail: PERSON,
          toEmail: FOUNDER,
          sentAt: "2024-04-05T10:00:00.000Z",
        }),
      ],
    );
    assert.equal(handoff.candidates.length, 0);
  });

  it("excludes vendor-only matches", () => {
    const handoff = discover(
      [{ kind: "vendor", value: "Vendor North", strength: "supporting" }],
      [
        indexed({
          messageId: "idx-vendor",
          threadId: "19vendoronly0000001",
          subject: "Vendor North invoice",
          fromEmail: "workshop@example.com",
          toEmail: FOUNDER,
        }),
      ],
    );
    assert.equal(handoff.candidates.length, 0);
  });

  it("excludes weak numeric CAD only, including Invoice 141", () => {
    const handoff = discover(
      [
        { kind: "cad_job_number", value: "141", strength: "weak_numeric" },
        { kind: "cad_job_number", value: "18", strength: "weak_numeric" },
        { kind: "cad_job_number", value: "2024", strength: "weak_numeric" },
        { kind: "cad_job_number", value: "555", strength: "weak_numeric" },
      ],
      [
        indexed({
          messageId: "idx-invoice-141",
          threadId: "19invoice1410000001",
          subject: "Invoice 141 reminder",
          fromEmail: PERSON,
          toEmail: FOUNDER,
        }),
        indexed({
          messageId: "idx-cad-18",
          threadId: "19cad18only00000001",
          subject: "CAD 18",
          fromEmail: PERSON,
          toEmail: FOUNDER,
        }),
        indexed({
          messageId: "idx-cad-2024",
          threadId: "19cad2024only000001",
          subject: "CAD 2024",
          fromEmail: PERSON,
          toEmail: FOUNDER,
        }),
      ],
    );
    assert.equal(handoff.candidates.length, 0);
    assert.equal(
      handoff.candidates.some((row) => row.score >= 100),
      false,
    );
  });

  it("allows a strong structured CAD as a candidate", () => {
    const handoff = discover(
      [
        {
          kind: "cad_job_number",
          value: "CAD-8821",
          strength: "strong_structured",
        },
      ],
      [
        indexed({
          messageId: "idx-cad",
          threadId: "19strongcad00000001",
          subject: "CAD-8821 follow-up",
          fromEmail: FOUNDER,
          toEmail: PERSON,
        }),
      ],
    );
    const row = handoff.candidates.find(
      (candidate) => candidate.threadId === "19strongcad00000001",
    );
    assert.ok(row);
    assert.equal(row.score >= 100, true);
    assert.equal(row.requiresFounderReview, true);
    assert.equal(row.candidateProjectId, PROJECT_ID);
    assert.equal(row.fetchApproved, false);
    assert.equal(
      row.reasons.some((reason) => reason.kind === "cad_identifier_strong"),
      true,
    );
  });

  it("allows a strong order identifier as a candidate", () => {
    const handoff = discover(
      [
        {
          kind: "order_number",
          value: "AB-555",
          strength: "strong_structured",
        },
      ],
      [
        indexed({
          messageId: "idx-order",
          threadId: "19strongorder000001",
          subject: "Order AB-555 shipped",
          fromEmail: PERSON,
          toEmail: FOUNDER,
        }),
      ],
    );
    const row = handoff.candidates.find(
      (candidate) => candidate.threadId === "19strongorder000001",
    );
    assert.ok(row);
    assert.equal(row.score >= 100, true);
    assert.equal(
      row.reasons.some((reason) => reason.kind === "order_number"),
      true,
    );
  });

  it("adds vendor/date as supporting strength on top of a strong identifier", () => {
    const cadOnly = discover(
      [
        {
          kind: "cad_job_number",
          value: "CBR2000037",
          strength: "strong_structured",
        },
      ],
      [
        indexed({
          messageId: "idx-cad-only",
          threadId: "19strongplus0000001",
          subject: "CBR2000037 from Vendor North",
          fromEmail: PERSON,
          toEmail: FOUNDER,
          sentAt: "2024-04-05T10:00:00.000Z",
        }),
      ],
    );
    const supported = discover(
      [
        {
          kind: "cad_job_number",
          value: "CBR2000037",
          strength: "strong_structured",
        },
        { kind: "vendor", value: "Vendor North", strength: "supporting" },
        {
          kind: "project_date",
          value: "2024-04-04T10:00:00.000Z",
          strength: "supporting",
        },
      ],
      [
        indexed({
          messageId: "idx-cad-supported",
          threadId: "19strongplus0000001",
          subject: "CBR2000037 from Vendor North",
          fromEmail: PERSON,
          toEmail: FOUNDER,
          sentAt: "2024-04-05T10:00:00.000Z",
        }),
      ],
    );
    const cadRow = cadOnly.candidates[0];
    const supportedRow = supported.candidates[0];
    assert.ok(cadRow);
    assert.ok(supportedRow);
    assert.equal(supportedRow.score > cadRow.score, true);
    assert.equal(
      supportedRow.reasons.some((row) => row.kind === "vendor_supporting_only"),
      true,
    );
    assert.equal(supportedRow.requiresFounderReview, true);
    assert.equal(typeof supportedRow.score, "number");
    assert.equal(supportedRow.candidateProjectId, PROJECT_ID);
  });

  it("never treats internal Hourglass addresses as person identity evidence", () => {
    assert.equal(INTERNAL_HOURGLASS_ADDRESSES.includes(FOUNDER), true);
    const handoff = discover(
      [
        {
          kind: "person_email_hash",
          value: FOUNDER_HASH,
          strength: "supporting",
        },
        { kind: "vendor", value: "Vendor North", strength: "supporting" },
        {
          kind: "subject_term",
          value: "bracelet",
          strength: "supporting",
        },
      ],
      [
        indexed({
          messageId: "idx-internal",
          threadId: "19internalonly00001",
          subject: "Re: bracelet Vendor North",
          fromEmail: FOUNDER,
          toEmail: "studio@hourglass.example",
        }),
      ],
    );
    assert.equal(handoff.candidates.length, 0);
  });

  it("stays dormant: no auto-fetch and every candidate needs founder review", () => {
    const handoff = discover(
      [
        {
          kind: "cad_job_number",
          value: "J-4491",
          strength: "strong_structured",
        },
      ],
      [
        indexed({
          messageId: "idx-j",
          threadId: "19j4491thread000001",
          subject: "J-4491 ready",
          fromEmail: PERSON,
          toEmail: FOUNDER,
        }),
      ],
    );
    assert.equal(handoff.autoFetch, false);
    assert.equal(handoff.mailboxWideBodySearch, false);
    assert.equal(handoff.requiresFounderApprovalToFetch, true);
    assert.equal(
      handoff.candidates.every(
        (row) => row.fetchApproved === false && row.requiresFounderReview,
      ),
      true,
    );
  });

  it("aggregates one thread without multiplying the same identifier", () => {
    const handoff = discover(
      [
        {
          kind: "cad_job_number",
          value: "CBR2000037",
          strength: "strong_structured",
        },
      ],
      [
        indexed({
          messageId: "idx-cbr-1",
          threadId: "19cbr2000037thread01",
          subject: "CBR2000037 start",
          fromEmail: PERSON,
          toEmail: FOUNDER,
        }),
        indexed({
          messageId: "idx-cbr-2",
          threadId: "19cbr2000037thread01",
          subject: "Re: CBR2000037 files",
          fromEmail: FOUNDER,
          toEmail: PERSON,
        }),
        indexed({
          messageId: "idx-cbr-3",
          threadId: "19cbr2000037thread01",
          subject: "CBR2000037 Vendor North",
          fromEmail: PERSON,
          toEmail: FOUNDER,
        }),
      ],
    );
    const rows = handoff.candidates.filter(
      (row) => row.threadId === "19cbr2000037thread01",
    );
    assert.equal(rows.length, 1);
    const row = rows[0]!;
    assert.equal(row.score, 100);
    assert.equal(row.messageCount, 3);
    assert.equal(
      row.reasons.filter((reason) => reason.kind === "cad_identifier_strong").length,
      3,
    );
    assert.equal(row.fetchApproved, false);
    assert.equal(row.requiresFounderReview, true);
  });
});

describe("order identifier extraction used by discovery identifiers", () => {
  it("parses Order #555 and rejects the word order", () => {
    assert.deepEqual(extractOrderIdentifiers("Order #555"), ["555"]);
    assert.deepEqual(extractOrderIdentifiers("order"), []);
    const identifiers = extractStrongProjectIdentifiers({
      thread: {
        threadId: ANCHOR,
        messages: [
          {
            messageId: "msg-order",
            internalDate: "2024-04-04T10:00:00.000Z",
            direction: "inbound",
            from: PERSON,
            to: [FOUNDER],
            cc: [],
            bcc: [],
            subject: "order",
            plainText: "Order #555",
            mimeParts: [],
            attachments: [],
          },
        ],
      },
      currentSpecs: {
        fingerSize: null,
        orderNumber: null,
        cadJobNumber: null,
        metal: null,
        centerStone: null,
      },
      personEmailHash: PERSON_HASH,
    });
    assert.equal(
      identifiers.some(
        (row) =>
          row.kind === "order_number" &&
          row.value === "555" &&
          row.strength === "weak_numeric" &&
          row.contextRequired === true,
      ),
      true,
    );
    assert.equal(
      identifiers.some(
        (row) =>
          row.kind === "order_number" && row.value.toLowerCase() === "order",
      ),
      false,
    );
  });
});

describe("identifier specificity discovery false positives", () => {
  it("does not give numeric order 555 identity from generic subjects", () => {
    const subjects = [
      "Invoice 555",
      "Payment 555",
      "Re: 555",
      "Job 555",
      "555 reminder",
      "Invoice AB-555",
    ];
    for (const subject of subjects) {
      const handoff = discover(
        [
          {
            kind: "order_number",
            value: "555",
            strength: "weak_numeric",
            contextRequired: true,
          },
        ],
        [
          indexed({
            messageId: `idx-${subject}`,
            threadId: `19generic555${subject.length}`,
            subject,
            fromEmail: PERSON,
            toEmail: FOUNDER,
          }),
        ],
      );
      assert.equal(handoff.candidates.length, 0, subject);
      assert.equal(
        handoff.candidates.some((row) => row.score >= 100),
        false,
        subject,
      );
    }
  });

  it("recognizes typed order context without making 555 strong identity", () => {
    const handoff = discover(
      [
        {
          kind: "order_number",
          value: "555",
          strength: "weak_numeric",
          contextRequired: true,
        },
      ],
      [
        indexed({
          messageId: "idx-order-hash",
          threadId: "19orderhash55500001",
          subject: "Order #555",
          fromEmail: PERSON,
          toEmail: FOUNDER,
        }),
        indexed({
          messageId: "idx-order-number",
          threadId: "19ordernumber555001",
          subject: "Order number 555",
          fromEmail: PERSON,
          toEmail: FOUNDER,
        }),
      ],
    );
    assert.equal(handoff.candidates.length, 0);
    assert.equal(
      handoff.candidates.some((row) => row.score >= 100),
      false,
    );
  });

  it("may surface a weak order only as review when supporting context also matches", () => {
    const handoff = discover(
      [
        {
          kind: "order_number",
          value: "555",
          strength: "weak_numeric",
          contextRequired: true,
        },
        {
          kind: "person_email_hash",
          value: PERSON_HASH,
          strength: "supporting",
        },
        { kind: "vendor", value: "Vendor North", strength: "supporting" },
        {
          kind: "project_date",
          value: "2024-04-04T10:00:00.000Z",
          strength: "supporting",
        },
      ],
      [
        indexed({
          messageId: "idx-order-review",
          threadId: "19orderreview555001",
          subject: "Order #555 Vendor North",
          fromEmail: PERSON,
          toEmail: FOUNDER,
          sentAt: "2024-04-05T10:00:00.000Z",
        }),
      ],
    );
    const row = handoff.candidates.find(
      (candidate) => candidate.threadId === "19orderreview555001",
    );
    assert.ok(row);
    assert.equal(row.score >= 100, false);
    assert.equal(row.strength === "exact" || row.strength === "strong", false);
    assert.equal(row.requiresFounderReview, true);
    assert.equal(
      row.reasons.some((reason) => reason.kind === "order_identifier_weak_numeric"),
      true,
    );
    assert.equal(
      row.reasons.some((reason) => reason.kind === "vendor_supporting_only"),
      true,
    );
  });

  it("does not treat CAD-1, J-1, J-12, or A-1 as high-confidence needles", () => {
    for (const token of ["CAD-1", "J-1", "J-12", "A-1"]) {
      const handoff = discover(
        [
          {
            kind: "cad_job_number",
            value: token,
            strength: "weak_short_structured",
            contextRequired: true,
          },
        ],
        [
          indexed({
            messageId: `idx-bare-${token}`,
            threadId: `19bare${token.replace("-", "")}0001`,
            subject: `Apartment ${token} notice`,
            fromEmail: PERSON,
            toEmail: FOUNDER,
          }),
        ],
      );
      assert.equal(handoff.candidates.length, 0, token);
      assert.equal(
        handoff.candidates.some((row) => row.score >= 100),
        false,
        token,
      );
    }
  });

  it("excludes CAD A-1 vs Apartment A-1 and keeps CAD A-1 revision as review-level", () => {
    const identifiers: StrongProjectIdentifier[] = [
      {
        kind: "cad_job_number",
        value: "A-1",
        strength: "weak_short_structured",
        contextRequired: true,
      },
    ];
    const excluded = discover(identifiers, [
      indexed({
        messageId: "idx-apt",
        threadId: "19apartmenta1000001",
        subject: "Apartment A-1 notice",
        fromEmail: PERSON,
        toEmail: FOUNDER,
      }),
    ]);
    assert.equal(excluded.candidates.length, 0);

    const alone = discover(identifiers, [
      indexed({
        messageId: "idx-cad-a1",
        threadId: "19cada1revision00001",
        subject: "CAD A-1 revision",
        fromEmail: PERSON,
        toEmail: FOUNDER,
      }),
    ]);
    assert.equal(alone.candidates.length, 0);

    const supported = discover(
      [
        ...identifiers,
        {
          kind: "person_email_hash",
          value: PERSON_HASH,
          strength: "supporting",
        },
        { kind: "vendor", value: "Vendor North", strength: "supporting" },
        {
          kind: "project_date",
          value: "2024-04-04T10:00:00.000Z",
          strength: "supporting",
        },
      ],
      [
        indexed({
          messageId: "idx-cad-a1-supported",
          threadId: "19cada1supported0001",
          subject: "CAD A-1 revision Vendor North",
          fromEmail: PERSON,
          toEmail: FOUNDER,
          sentAt: "2024-04-05T10:00:00.000Z",
        }),
      ],
    );
    const row = supported.candidates.find(
      (candidate) => candidate.threadId === "19cada1supported0001",
    );
    assert.ok(row);
    assert.equal(row.score >= 100, false);
    assert.equal(
      row.reasons.some(
        (reason) => reason.kind === "cad_identifier_weak_short_structured",
      ),
      true,
    );
  });

  it("still treats CBR2000037, CAD-8821, and J-4491 as strong identity", () => {
    for (const token of ["CBR2000037", "CAD-8821", "J-4491"]) {
      const handoff = discover(
        [
          {
            kind: "cad_job_number",
            value: token,
            strength: "strong_structured",
          },
        ],
        [
          indexed({
            messageId: `idx-strong-${token}`,
            threadId: `19strong${token.replace("-", "")}01`,
            subject: `${token} follow-up`,
            fromEmail: PERSON,
            toEmail: FOUNDER,
          }),
        ],
      );
      const row = handoff.candidates[0];
      assert.ok(row, token);
      assert.equal(row.score >= 100, true, token);
      assert.equal(
        row.reasons.some((reason) => reason.kind === "cad_identifier_strong"),
        true,
        token,
      );
    }
  });

  it("does not match longer superstrings of strong identifiers", () => {
    const cases = [
      ["CBR2000037", "CBR20000370 follow-up"],
      ["CAD-8821", "CAD-88210 follow-up"],
      ["J-4491", "J-44910 ready"],
    ] as const;
    for (const [token, subject] of cases) {
      const handoff = discover(
        [
          {
            kind: "cad_job_number",
            value: token,
            strength: "strong_structured",
          },
        ],
        [
          indexed({
            messageId: `idx-super-${token}`,
            threadId: `19super${token.replace("-", "")}01`,
            subject,
            fromEmail: PERSON,
            toEmail: FOUNDER,
          }),
        ],
      );
      assert.equal(handoff.candidates.length, 0, subject);
    }
  });

  it("keeps vendor as supporting only even beside a weak order", () => {
    const handoff = discover(
      [
        {
          kind: "order_number",
          value: "555",
          strength: "weak_numeric",
          contextRequired: true,
        },
        { kind: "vendor", value: "Vendor North", strength: "supporting" },
      ],
      [
        indexed({
          messageId: "idx-vendor-weak-order",
          threadId: "19vendorweakorder001",
          subject: "Vendor North invoice",
          fromEmail: PERSON,
          toEmail: FOUNDER,
        }),
      ],
    );
    assert.equal(handoff.candidates.length, 0);
  });
});
