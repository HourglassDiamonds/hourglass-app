import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { GMAIL_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/gmail/types";
import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import { isExactStructuredSpecGmailSource } from "@/lib/continuum/candidates/spec-provenance";
import { proposeGmailCandidates } from "./propose";
import {
  splitOwnAndQuotedText,
  specValueEstablishedInText,
} from "./spec-provenance";
import type {
  GmailCandidateEvidence,
  GmailCandidateProject,
  GmailCandidateWorld,
} from "./types";

const NOW = "2026-09-10T12:00:00.000Z";
const SIZE_THREAD = "19aabbccddeeff01";
const SIZE_MSG = "1a08c4df80601111";
const SHIP_THREAD = "19ffcce49298efeb";
const SHIP_MSG = "1a08c4df80609947";
const OTHER_THREAD = "18c9f0a1b2c3d4e5";

function indexed(input: {
  messageId: string;
  threadId: string;
  sentAt: string;
  subject?: string;
  fromEmail?: string;
}): GmailIndexedMessage {
  return {
    messageId: input.messageId,
    threadId: input.threadId,
    sentAt: input.sentAt,
    indexedAt: NOW,
    subject: input.subject ?? null,
    fromEmailHash: hashEmail(input.fromEmail ?? "travis@client.test"),
    toEmailHashes: [],
    ccEmailHashes: [],
    bccEmailHashes: [],
    direction: "inbound",
    labelIds: ["INBOX"],
    hasAttachments: false,
    sourceSystem: GMAIL_SOURCE_SYSTEM,
  };
}

function evidence(
  input: Parameters<typeof indexed>[0] & {
    plaintext?: string;
    reconstructed?: boolean;
  },
): GmailCandidateEvidence {
  const row = indexed(input);
  return {
    indexed: row,
    plaintext: input.plaintext ?? null,
    fromEmailHash: row.fromEmailHash,
    attachments: [],
    reconstructed: input.reconstructed,
  };
}

function project(): GmailCandidateProject {
  return {
    projectId: "proj-travis",
    title: "Chicken ring",
    gmailThreadId: SHIP_THREAD,
    cadJobNumber: null,
    orderNumber: null,
    fingerSize: "12.5",
    metal: null,
    centerStone: null,
    diamondSupplyNotes: null,
    personIds: ["person-travis"],
    founderApprovedCurrent: true,
  };
}

function world(): GmailCandidateWorld {
  return {
    people: [],
    projects: [project()],
    internalEmailHashes: [],
  };
}

function fingerSpecs(rows: ReturnType<typeof proposeGmailCandidates>["candidates"]) {
  return rows.filter(
    (row) =>
      row.payload.kind === "structured_spec" && row.payload.fieldName === "finger_size",
  );
}

describe("structured_spec Gmail provenance", () => {
  it("keeps EXACT sourceRef when finger size appears in this message", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world(),
      evidence: [
        evidence({
          messageId: SIZE_MSG,
          threadId: SIZE_THREAD,
          sentAt: "2026-09-08T15:00:00.000Z",
          fromEmail: "travis@client.test",
          subject: "Chicken ring",
          plaintext: "Please use finger size 11 for the chicken ring.",
        }),
      ],
    });
    const specs = fingerSpecs(proposed.candidates);
    assert.equal(specs.length, 1);
    assert.equal(specs[0]?.payload.kind, "structured_spec");
    if (specs[0]?.payload.kind !== "structured_spec") return;
    assert.equal(specs[0].payload.proposedValue, "11");
    assert.equal(specs[0].payload.sourceProvenance, "EXACT");
    assert.equal(specs[0].sourceRef, `gc1|${SIZE_THREAD}|${SIZE_MSG}`);
    assert.equal(isExactStructuredSpecGmailSource(specs[0]), true);
    assert.match(specs[0].evidenceBasis.matchedText ?? "", /finger size 11/i);
  });

  it("does not stamp a shipping/admin message as EXACT when the value is in another message", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world(),
      evidence: [
        evidence({
          messageId: SIZE_MSG,
          threadId: SHIP_THREAD,
          sentAt: "2026-09-08T15:00:00.000Z",
          fromEmail: "travis@client.test",
          plaintext: "Please use finger size 11.",
        }),
        evidence({
          messageId: SHIP_MSG,
          threadId: SHIP_THREAD,
          sentAt: NOW,
          fromEmail: "vlora@vendor.test",
          subject: "RE: HGD - Chicken ring shipping",
          plaintext: [
            "FedEx tracking 123456. Package is out for delivery.",
            "",
            "On Sep 8, 2026, Travis Morse wrote:",
            "> Please use finger size 11.",
          ].join("\n"),
        }),
      ],
    });
    const specs = fingerSpecs(proposed.candidates);
    assert.ok(specs.length >= 1);
    const shipping = specs.find((row) => row.sourceRef === `gc1|${SHIP_THREAD}|${SHIP_MSG}`);
    const exact = specs.find((row) => row.sourceRef === `gc1|${SHIP_THREAD}|${SIZE_MSG}`);
    assert.ok(exact);
    if (exact?.payload.kind === "structured_spec") {
      assert.equal(exact.payload.proposedValue, "11");
      assert.equal(exact.payload.sourceProvenance, "EXACT");
    }
    assert.equal(isExactStructuredSpecGmailSource(exact!), true);
    if (shipping) {
      if (shipping.payload.kind === "structured_spec") {
        assert.notEqual(shipping.payload.sourceProvenance, "EXACT");
      }
      assert.equal(isExactStructuredSpecGmailSource(shipping), false);
    }
  });

  it("marks multi-message reconstruction as DERIVED, not EXACT", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world(),
      evidence: [
        evidence({
          messageId: SHIP_MSG,
          threadId: SHIP_THREAD,
          sentAt: NOW,
          fromEmail: "vlora@vendor.test",
          subject: "Chicken ring shipping",
          plaintext: "FedEx shipping update.\nPlease use finger size 11.",
          reconstructed: true,
        }),
      ],
    });
    const specs = fingerSpecs(proposed.candidates);
    assert.equal(specs.length, 1);
    if (specs[0]?.payload.kind === "structured_spec") {
      assert.equal(specs[0].payload.proposedValue, "11");
      assert.equal(specs[0].payload.sourceProvenance, "DERIVED");
    }
    assert.equal(isExactStructuredSpecGmailSource(specs[0]!), false);
  });

  it("does not let an unrelated project thread replace the source", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world(),
      evidence: [
        evidence({
          messageId: "other-size",
          threadId: OTHER_THREAD,
          sentAt: "2026-09-07T12:00:00.000Z",
          fromEmail: "other@client.test",
          subject: "Unrelated band",
          plaintext: "finger size 11 for the other ring",
        }),
        evidence({
          messageId: SHIP_MSG,
          threadId: SHIP_THREAD,
          sentAt: NOW,
          fromEmail: "vlora@vendor.test",
          subject: "RE: HGD - Chicken ring shipping",
          plaintext: [
            "Vlora / FedEx shipping update for the chicken ring.",
            "On Sep 8 Travis wrote:",
            "> finger size 11",
          ].join("\n"),
        }),
      ],
    });
    const specs = fingerSpecs(proposed.candidates);
    const shipping = specs.find((row) => row.sourceRef.includes(SHIP_THREAD));
    const other = specs.find((row) => row.sourceRef.includes(OTHER_THREAD));
    assert.ok(other);
    if (other?.payload.kind === "structured_spec") {
      assert.equal(other.payload.sourceProvenance, "EXACT");
    }
    assert.ok(shipping);
    if (shipping?.payload.kind === "structured_spec") {
      assert.equal(shipping.payload.proposedValue, "11");
      assert.equal(shipping.payload.sourceProvenance, "THREAD_SUPPORT");
      assert.notEqual(shipping.sourceRef, `gc1|${OTHER_THREAD}|other-size`);
    }
    assert.equal(isExactStructuredSpecGmailSource(shipping!), false);
  });

  it("marks quoted-only evidence as non-exact when the establishing message is unavailable", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world(),
      evidence: [
        evidence({
          messageId: SHIP_MSG,
          threadId: SHIP_THREAD,
          sentAt: NOW,
          fromEmail: "vlora@vendor.test",
          subject: "RE: HGD - Chicken ring shipping",
          plaintext: [
            "Your package left the Vlora workshop via FedEx.",
            "On Sep 8, 2026 at 3:00 PM Travis Morse wrote:",
            "> Please use finger size 11 for the chicken ring.",
          ].join("\n"),
        }),
      ],
    });
    const specs = fingerSpecs(proposed.candidates);
    assert.equal(specs.length, 1);
    if (specs[0]?.payload.kind === "structured_spec") {
      assert.equal(specs[0].payload.proposedValue, "11");
      assert.equal(specs[0].payload.sourceProvenance, "THREAD_SUPPORT");
    }
    assert.equal(specs[0]?.sourceRef, `gc1|${SHIP_THREAD}|${SHIP_MSG}`);
    assert.equal(isExactStructuredSpecGmailSource(specs[0]!), false);
  });

  it("never treats generated operating mail as EXACT", () => {
    const cadence = hashEmail("cadence@hourglass.test")!;
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: {
        ...world(),
        generatedEmailHashes: [cadence],
      },
      evidence: [
        evidence({
          messageId: "19fff00011122233",
          threadId: "19abcdef01234567",
          sentAt: NOW,
          fromEmail: "cadence@hourglass.test",
          subject: "Hourglass Morning Brief",
          plaintext: "Travis Morse chicken ring finger size 11",
        }),
      ],
    });
    const specs = fingerSpecs(proposed.candidates);
    assert.ok(specs.length >= 1);
    for (const row of specs) {
      if (row.payload.kind !== "structured_spec") continue;
      assert.equal(row.payload.sourceProvenance, "DERIVED");
      assert.equal(isExactStructuredSpecGmailSource(row), false);
    }
  });

  it("splits quoted Gmail history from the sender's own text", () => {
    const split = splitOwnAndQuotedText(
      [
        "Package is out for delivery.",
        "On Sep 8, 2026, Travis Morse wrote:",
        "> Please use finger size 11.",
      ].join("\n"),
    );
    assert.match(split.own, /Package is out for delivery/);
    assert.doesNotMatch(split.own, /finger size 11/);
    assert.match(split.quoted, /finger size 11/);
    assert.equal(
      specValueEstablishedInText(split.own, "finger_size", "11"),
      false,
    );
    assert.equal(
      specValueEstablishedInText(split.quoted, "finger_size", "11"),
      true,
    );
  });
});
