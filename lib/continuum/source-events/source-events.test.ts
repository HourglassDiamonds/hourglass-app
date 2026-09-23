import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { classifySourceCommunication } from "./classify";
import { projectGmailSourceEvents } from "./gmail";
import { workLoopEventsFromSource } from "./work-loop";
import { reduceWorkLoop } from "@/lib/continuum/chief-of-staff/operating-loop/work-loop-state";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";

const FOUNDER_HASH = hashEmail("justin@hourglassdiamonds.com")!;
const VENDOR_HASH = hashEmail("niurka@vlorajewelry.com")!;

describe("source communication classification", () => {
  it("vendor CAD/Mod attachments are vendor_delivers_artifact without candidate text", () => {
    assert.equal(
      classifySourceCommunication({
        actor: "vendor_shop",
        direction: "inbound",
        subject: "RE: HGD x Dylon D.-C025610",
        authorOwnedText: "RE: HGD x Dylon D.-C025610",
        attachmentFilenames: ["NL-H017-Dylon D-C025610-Mod4.jpg"],
        hasAttachments: true,
      }),
      "vendor_delivers_artifact",
    );
  });

  it("promised order confirmation is not already-delivered", () => {
    assert.equal(
      classifySourceCommunication({
        actor: "vendor_shop",
        direction: "inbound",
        subject: "RE: HGD x F.Grant-C025885",
        authorOwnedText: "I'll update the size, place the order, and send the order confirmation.",
      }),
      "vendor_promises",
    );
  });

  it("order confirmation subject is vendor_order_confirmation", () => {
    assert.equal(
      classifySourceCommunication({
        actor: "vendor_shop",
        direction: "inbound",
        subject: "RE: HGD x F.Grant-C025885-SP13477",
        authorOwnedText: "RE: HGD x F.Grant-C025885-SP13477",
        hasAttachments: true,
      }),
      "vendor_order_confirmation",
    );
  });

  it("RN workshop subject is workshop_started even with files", () => {
    assert.equal(
      classifySourceCommunication({
        actor: "vendor_shop",
        direction: "inbound",
        subject: "RE: HGD x Tim/Jenn-C025964-RN08318",
        authorOwnedText: "RE: HGD x Tim/Jenn-C025964-RN08318",
        attachmentFilenames: ["NL-H017-Tim-C025964.jpg"],
        hasAttachments: true,
      }),
      "workshop_started",
    );
  });

  it("vendor thanks does not reopen founder", () => {
    assert.equal(
      classifySourceCommunication({
        actor: "vendor_shop",
        direction: "inbound",
        subject: "RE: HGD x Sarah-C026143",
        authorOwnedText: "Thank you so much!",
        hasAttachments: true,
      }),
      "vendor_acknowledges",
    );
  });

  it("founder HGD vendor-thread outbound is founder_requests_vendor", () => {
    assert.equal(
      classifySourceCommunication({
        actor: "founder",
        direction: "outbound",
        subject: "Re: HGD x Nate P. (Dagger Ring)-C026176",
        authorOwnedText: "Re: HGD x Nate P. (Dagger Ring)-C026176",
        hasAttachments: true,
      }),
      "founder_requests_vendor",
    );
  });

  it("headed to you fulfills a founder commitment", () => {
    assert.equal(
      classifySourceCommunication({
        actor: "founder",
        direction: "outbound",
        subject: "Re: A new piece",
        authorOwnedText: "Headed to you!!",
        hasAttachments: true,
      }),
      "founder_fulfills_commitment",
    );
  });

  it("founder CAD send asking for thoughts is founder_updates_client even on an HGD thread", () => {
    assert.equal(
      classifySourceCommunication({
        actor: "founder",
        direction: "outbound",
        subject: "RE: HGD x Madi-C026000",
        authorOwnedText: "Here's the latest CAD — let me know what you think.",
      }),
      "founder_updates_client",
    );
  });

  it("founder print/check plan is not a vendor request", () => {
    assert.equal(
      classifySourceCommunication({
        actor: "founder",
        direction: "outbound",
        subject: "A new piece",
        authorOwnedText: "I'll print the model to check the huggie proportions before moving forward.",
      }),
      "unknown_communication",
    );
  });

  it("client approval on an HGD-named thread is client_approves", () => {
    assert.equal(
      classifySourceCommunication({
        actor: "client",
        direction: "inbound",
        subject: "RE: HGD x Nate P. (Dagger Ring)-C026176",
        authorOwnedText: "I love the latest direction and want to move forward.",
      }),
      "client_approves",
    );
  });

  it("client shipping address is client_requests", () => {
    assert.equal(
      classifySourceCommunication({
        actor: "client",
        direction: "inbound",
        subject: "RE: HGD x Abbey-C026137",
        authorOwnedText: "Please use this updated shipping address: 123 Oak Street, Austin.",
      }),
      "client_requests",
    );
  });
});

describe("gmail source projection", () => {
  it("projects an indexed vendor delivery with no useful candidates", () => {
    const threadContext = new Map<string, TodayGmailThreadContext>([
      [
        "thread-dylon",
        {
          subject: "RE: HGD x Dylon D.-C025610",
          messages: [
            {
              messageId: "1a0c52c12690a0f5",
              sentAt: "2026-09-21T18:13:04.000Z",
              direction: "inbound",
              fromEmailHash: VENDOR_HASH,
              subject: "RE: HGD x Dylon D.-C025610",
              hasAttachments: true,
              attachmentFilenames: ["NL-H017-Dylon D-C025610-Mod4.jpg"],
            },
          ],
        },
      ],
    ]);
    const events = projectGmailSourceEvents({
      threadContext,
      founderEmailHashes: new Set([FOUNDER_HASH]),
      knownPeople: [
        {
          personId: "vendor",
          displayName: "Niurka",
          roles: ["vendor-contact"],
          organizationName: "Vlora",
          emailHash: VENDOR_HASH,
        },
      ],
    });
    assert.equal(events.length, 1);
    assert.equal(events[0]?.semanticClass, "vendor_delivers_artifact");
    assert.equal(events[0]?.actor, "vendor_shop");
    assert.deepEqual(events[0]?.cadIds, ["C025610"]);
  });

  it("inbound client hash on an HGD thread is not vendor_shop", () => {
    const clientHash = hashEmail("nathan@client.test")!;
    const events = projectGmailSourceEvents({
      threadContext: new Map([
        [
          "nathan-thread",
          {
            subject: "RE: HGD x Nate P. (Dagger Ring)-C026176",
            fromDisplayName: "Nathan",
            fromEmail: "nathan@client.test",
            messages: [
              {
                messageId: "1a0ca8e67de67c17",
                sentAt: "2026-09-22T19:18:25.000Z",
                direction: "inbound",
                fromEmailHash: clientHash,
              },
            ],
          },
        ],
      ]),
      founderEmailHashes: new Set([FOUNDER_HASH]),
      candidates: [],
      knownPeople: [
        {
          personId: "vendor",
          displayName: "Niurka",
          roles: ["vendor-contact"],
          organizationName: "Vlora",
          emailHash: VENDOR_HASH,
        },
      ],
    });
    assert.equal(events[0]?.actor, "client");
    assert.equal(events[0]?.semanticClass, "client_replies_nonblocking");
  });
});

describe("source events enter the work-loop reducer", () => {
  it("vendor delivery satisfies a prior STL request without a delivery candidate", () => {
    const events = projectGmailSourceEvents({
      threadContext: new Map([
        [
          "t",
          {
            subject: "RE: HGD x Dylon D.-C025610",
            messages: [
              {
                messageId: "ask",
                sentAt: "2026-09-18T17:24:22.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
                subject: "RE: HGD x Dylon D.-C025610",
              },
              {
                messageId: "del",
                sentAt: "2026-09-21T18:13:04.000Z",
                direction: "inbound",
                fromEmailHash: VENDOR_HASH,
                hasAttachments: true,
                attachmentFilenames: ["NL-H017-Dylon D-C025610-Mod4.jpg"],
              },
            ],
          },
        ],
      ]),
      founderEmailHashes: new Set([FOUNDER_HASH]),
      knownPeople: [
        {
          personId: "vendor",
          displayName: "Niurka",
          roles: ["vendor-contact"],
          emailHash: VENDOR_HASH,
        },
      ],
    });
    const reduced = reduceWorkLoop({
      evidence: [
        {
          at: "2026-09-18T17:24:22.000Z",
          label: "ask",
          summary: "can you send me the stl file for that one as well please",
          speaker: "founder",
          sourceHref: null,
          candidateId: "ask",
        },
      ],
      sourceEvents: events,
      remaining: {
        matchedText: "can you send me the stl file for that one as well please",
        headline: "can you send me the stl file for that one as well please",
        explanation: "send stl",
        recommended: "send stl",
      },
    });
    assert.equal(reduced.ballHolder, "founder");
    assert.equal(reduced.semanticClass, "founder_review");
    assert.ok(workLoopEventsFromSource(events).some((row) => row.eventType === "vendor_delivers"));
  });
});
