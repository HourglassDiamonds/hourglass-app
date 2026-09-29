import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import { composeCosOperatingLoop } from "@/lib/continuum/chief-of-staff/operating-loop/compose";
import { fixtureCandidate } from "@/lib/continuum/chief-of-staff/operating-loop/fixtures";
import { projectGmailSourceEvents, sourceEventsForWorkLoop } from "./gmail";
import { isOperationalSourceEvent } from "./types";
import { extractCurrentMessageOperationalFacts } from "./operational-facts";

const VENDOR_HASH = hashEmail("shop@example.test")!;
const PEOPLE = [
  {
    personId: "vendor",
    displayName: "Shop Contact",
    roles: ["vendor-contact"] as const,
    organizationName: "Example Shop",
    emailHash: VENDOR_HASH,
  },
];

function events(threadId: string, context: TodayGmailThreadContext) {
  return projectGmailSourceEvents({
    threadContext: new Map([[threadId, context]]),
    knownPeople: PEOPLE,
    candidates: [],
  });
}

describe("Phase 1 production-shaped evidence integrity", () => {
  it("A: preserves Duane SP13530 once and does not inherit it into a later reply", () => {
    const rows = events("duane-thread", {
      subject: "RE: HGD x Duane-C026350-SP13530",
      messages: [
        {
          messageId: "1a00000000000001",
          sentAt: "2026-09-20T14:00:00.000Z",
          direction: "inbound",
          fromEmailHash: VENDOR_HASH,
          operationalText: "Order confirmation # SP13530 is attached.",
        },
        {
          messageId: "1a00000000000002",
          sentAt: "2026-09-20T15:00:00.000Z",
          direction: "inbound",
          fromEmailHash: VENDOR_HASH,
          operationalText: "Thank you!",
        },
      ],
    });
    assert.equal(rows[0]?.semanticClass, "vendor_order_confirmation");
    assert.equal(rows[0]?.evidenceExcerpt, "Order confirmation # SP13530 is attached.");
    assert.deepEqual(rows[0]?.orderIds, ["SP13530"]);
    assert.equal(rows[1]?.semanticClass, "vendor_acknowledges");
    assert.equal(isOperationalSourceEvent(rows[1]!), false);
  });

  it("B: preserves Sarah's flooding-delay commitment wording and source time", () => {
    const row = events("sarah-thread", {
      subject: "RE: HGD x Sarah-C026143",
      messages: [
        {
          messageId: "1a00000000000003",
          sentAt: "2026-09-22T22:00:00.000Z",
          direction: "inbound",
          fromEmailHash: VENDOR_HASH,
          operationalText: "We had a flooding delay. I should have it tomorrow.",
        },
      ],
    })[0]!;
    assert.equal(row.semanticClass, "vendor_promises");
    assert.equal(row.timestamp, "2026-09-22T22:00:00.000Z");
    assert.match(row.evidenceExcerpt, /flooding delay.*tomorrow/i);
    assert.equal(isOperationalSourceEvent(row), true);
  });

  it("C: preserves Tim/Jenn workshop receipt and exact final-CAD commitment", () => {
    const row = events("tim-thread", {
      subject: "RE: HGD x Tim/Jenn-C025964-RN08318",
      messages: [
        {
          messageId: "1a00000000000004",
          sentAt: "2026-09-17T22:47:16.000Z",
          direction: "inbound",
          fromEmailHash: VENDOR_HASH,
          operationalText:
            "Stone sent to workshop RN08318. Final CAD in approximately 10 +/- business days.",
        },
      ],
    })[0]!;
    assert.equal(row.semanticClass, "workshop_started");
    assert.deepEqual(row.productionJobIds, ["RN08318"]);
    assert.match(row.evidenceExcerpt, /10 \+\/- business days/i);
  });

  it("D: preserves Nate's changed pearl-delivery dependency after STL receipt", () => {
    const rows = events("nate-thread", {
      subject: "RE: HGD x Nate-C026176",
      messages: [
        {
          messageId: "1a00000000000005",
          sentAt: "2026-09-18T12:00:00.000Z",
          direction: "inbound",
          fromEmailHash: VENDOR_HASH,
          hasAttachments: true,
          attachmentFilenames: ["Nate-C026176-Mod1.stl"],
        },
        {
          messageId: "1a00000000000006",
          sentAt: "2026-09-22T12:00:00.000Z",
          direction: "inbound",
          fromEmailHash: VENDOR_HASH,
          operationalText: "We are waiting on pearl delivery before the next step.",
        },
      ],
    });
    assert.equal(rows[0]?.semanticClass, "vendor_delivers_artifact");
    assert.equal(rows[1]?.semanticClass, "vendor_promises");
    assert.match(rows[1]?.evidenceExcerpt ?? "", /waiting on pearl delivery/i);
  });

  it("E: marketing contamination produces no operational Today item", () => {
    const threadContext = new Map<string, TodayGmailThreadContext>([
      [
        "1a0000000000000d",
        {
          subject: "Growth Support for Independent Jewelers",
          messages: [
            {
              messageId: "1a00000000000007",
              sentAt: "2026-09-22T13:00:00.000Z",
              direction: "inbound",
              fromEmailHash: VENDOR_HASH,
              labelIds: ["IMPORTANT", "STARRED"],
              operationalText: null,
            },
          ],
        },
      ],
    ]);
    const projected = projectGmailSourceEvents({ threadContext, knownPeople: PEOPLE });
    assert.equal(projected.some(isOperationalSourceEvent), false);
    const loop = composeCosOperatingLoop({
      jobs: [],
      candidates: [fixtureCandidate({
        candidateId: "marketing-candidate",
        sourceSystem: "gmail",
        sourceRef: "gc1|1a0000000000000d|1a00000000000007",
        candidateType: "project_context",
        proposedTarget: { kind: "none" },
        payload: {
          kind: "project_context",
          topic: "note",
          value: "Growth support review update for independent jewelers",
        },
        evidenceBasis: {
          ruleIds: ["explicit_follow_up"],
          matchedText: "Growth support review update for independent jewelers",
        },
      })],
      projects: new Map(),
      nowIso: "2026-09-22T18:00:00.000Z",
      threadContext,
      knownPeople: PEOPLE,
    });
    assert.deepEqual(loop.brief, []);
    assert.deepEqual(loop.watching, []);

    const identityOnly = events("generic-vendor-thread", {
      subject: "Support review update",
      messages: [{
        messageId: "1a0000000000000c",
        sentAt: "2026-09-22T13:05:00.000Z",
        direction: "inbound",
        fromEmailHash: VENDOR_HASH,
        operationalText: "I should have it tomorrow.",
      }],
    })[0]!;
    assert.equal(identityOnly.semanticClass, "vendor_promises");
    assert.equal(identityOnly.workIdentityBasis, null);
    assert.equal(isOperationalSourceEvent(identityOnly), false);
  });

  it("F: same first name never bridges distinct CAD identities", () => {
    const all = [
      ...events("sarah-one", {
        subject: "RE: HGD x Sarah-C026143",
        messages: [{
          messageId: "1a00000000000008",
          sentAt: "2026-09-22T14:00:00.000Z",
          direction: "inbound",
          fromEmailHash: VENDOR_HASH,
          operationalText: "I should have the CAD tomorrow.",
        }],
      }),
      ...events("sarah-two", {
        subject: "RE: HGD x Sarah-C026999",
        messages: [{
          messageId: "1a00000000000009",
          sentAt: "2026-09-22T14:01:00.000Z",
          direction: "inbound",
          fromEmailHash: VENDOR_HASH,
          operationalText: "I should have the CAD tomorrow.",
        }],
      }),
    ];
    const matched = sourceEventsForWorkLoop(all, {
      key: "cad:C026143",
      cadIds: ["C026143"],
      personLabel: "Sarah",
    });
    assert.deepEqual(matched.map((row) => row.cadIds[0]), ["C026143"]);
    assert.deepEqual(
      sourceEventsForWorkLoop(all, {
        key: "project:project-one",
        projectId: "project-one",
        cadIds: ["C026143"],
      }),
      [],
    );

    const conflicting = projectGmailSourceEvents({
      threadContext: new Map([
        ["conflict-thread", {
          subject: "RE: HGD x Sarah-C026143",
          messages: [{
            messageId: "1a0000000000000e",
            sentAt: "2026-09-22T14:02:00.000Z",
            direction: "inbound",
            fromEmailHash: VENDOR_HASH,
            operationalText: "I should have the CAD tomorrow.",
          }],
        }],
      ]),
      knownPeople: PEOPLE,
      projectIdByThread: new Map([["conflict-thread", "project-two"]]),
    });
    assert.deepEqual(
      sourceEventsForWorkLoop(conflicting, {
        key: "project:project-one",
        projectId: "project-one",
        threadIds: ["conflict-thread"],
      }),
      [],
    );
  });

  it("G: a new acknowledgment cannot promote a quoted old CAD request", () => {
    const own = extractCurrentMessageOperationalFacts(
      "Sounds good, thank you.\n\nOn Sep 10, Shop wrote:\nPlease send the revised CAD.",
    );
    assert.equal(own, null);
    const row = events("quoted-thread", {
      subject: "RE: HGD x Sarah-C026143",
      messages: [{
        messageId: "1a0000000000000a",
        sentAt: "2026-09-22T15:00:00.000Z",
        direction: "inbound",
        fromEmailHash: VENDOR_HASH,
        plaintext: "Sounds good, thank you.\n\nOn Sep 10, Shop wrote:\nPlease send the revised CAD.",
      }],
    })[0]!;
    assert.equal(row.semanticClass, "vendor_acknowledges");
    assert.equal(isOperationalSourceEvent(row), false);
  });

  it("H: an inherited RN/SP/CAD subject does not reclassify an acknowledgment", () => {
    const row = events("inherited-thread", {
      subject: "RE: HGD x Duane-C026350-SP13530-RN08318",
      messages: [{
        messageId: "1a0000000000000b",
        sentAt: "2026-09-22T16:00:00.000Z",
        direction: "inbound",
        fromEmailHash: VENDOR_HASH,
        operationalText: "Thank you!",
      }],
    })[0]!;
    assert.equal(row.semanticClass, "vendor_acknowledges");
    assert.equal(isOperationalSourceEvent(row), false);
  });
});
