import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail, hashPhone } from "@/lib/continuum/client-memory/hashes";
import {
  fillUpNextCapacity,
  COS_UP_NEXT_VISIBLE_LIMIT,
} from "@/lib/continuum/chief-of-staff/operating-loop/cos-priority";
import type { CosPriorityInput } from "@/lib/continuum/chief-of-staff/operating-loop/cos-priority";
import { projectGmailSourceEvents } from "@/lib/continuum/source-events/gmail";
import { isSmsObservationProvenance } from "@/lib/continuum/source-events/types";
import { normalizeSmsMessage } from "./normalize";
import { resolveSmsPersonIdentity } from "./identity";
import { projectSmsObservations, smsTodaySurface } from "./bridge";
import type { MessageAdapterInput, SmsIdentityWorld } from "./types";

const CLIENT_PHONE = "+1 (305) 555-0100";
const VENDOR_PHONE = "7045551212";
const UNKNOWN_PHONE = "+1 (305) 555-0199";
const INTERNAL_PHONE = "3055550140";
const FAMILY_PHONE = "3055550177";
const CLIENT_HASH = hashPhone(CLIENT_PHONE)!;
const VENDOR_HASH = hashPhone(VENDOR_PHONE)!;
const INTERNAL_HASH = hashPhone(INTERNAL_PHONE)!;
const FAMILY_HASH = hashPhone(FAMILY_PHONE)!;

const world: SmsIdentityWorld = {
  people: [
    {
      personId: "person-client",
      phoneHash: CLIENT_HASH,
      role: "client",
      displayName: "Ada Client",
    },
    {
      personId: "person-vendor",
      phoneHash: VENDOR_HASH,
      role: "vendor-contact",
      displayName: "Shop Contact",
    },
    {
      personId: "person-family-a",
      phoneHash: FAMILY_HASH,
      role: "family",
      displayName: "Alex",
    },
    {
      personId: "person-family-b",
      phoneHash: FAMILY_HASH,
      role: "family",
      displayName: "Blair",
    },
  ],
  internalPhoneHashes: [INTERNAL_HASH],
  sharedPhoneHashes: [FAMILY_HASH],
};

function input(overrides: Partial<MessageAdapterInput> & Pick<MessageAdapterInput, "body" | "direction">): MessageAdapterInput {
  return {
    sourceMessageId: "msg-1",
    sourceThreadId: "thread-1",
    sentAt: "2026-09-25T15:00:00.000Z",
    senderPhone: CLIENT_PHONE,
    provider: "adapter-export",
    ingestClass: "live",
    lineClass: "business",
    ...overrides,
  };
}

function loopKey(observations: ReturnType<typeof projectSmsObservations>): string {
  return observations[0]?.event.workLoopId ?? "thread:missing";
}

describe("sms normalization", () => {
  it("hashes phones and keeps attachment metadata without a media store", () => {
    const surface = normalizeSmsMessage(
      input({
        body: "Can you send me the updated CAD?",
        direction: "inbound",
        contactLabel: "Ada iPhone",
        attachments: [
          {
            attachmentId: "att-1",
            filename: "sketch.jpg",
            mimeType: "image/jpeg",
            byteSize: 1200,
          },
        ],
      }),
      "2026-09-25T16:00:00.000Z",
    );
    assert.equal(surface.message.sender.phoneHash, CLIENT_HASH);
    assert.equal(surface.message.attachments[0]?.filename, "sketch.jpg");
    assert.equal(surface.message.attachments[0]?.byteSize, 1200);
    assert.equal(JSON.stringify(surface).includes("555-0100"), false);
    assert.equal(JSON.stringify(surface).includes("Ada iPhone"), false);
  });

  it("uses a provider id when present and a content fingerprint when it is absent", () => {
    const withId = normalizeSmsMessage(
      input({
        body: "Can you send me the updated CAD?",
        direction: "inbound",
        sourceMessageId: "provider-99",
        contactLabel: "First Label",
      }),
      "2026-09-25T16:00:00.000Z",
    );
    const renamed = normalizeSmsMessage(
      input({
        body: "Completely different body",
        direction: "inbound",
        sourceMessageId: "provider-99",
        contactLabel: "Second Label",
      }),
      "2026-09-25T16:00:00.000Z",
    );
    assert.equal(withId.message.idempotencyKey, renamed.message.idempotencyKey);
    assert.equal(withId.message.messageIdWasSynthesized, false);

    const fallbackA = normalizeSmsMessage(
      input({
        body: "Can you send me the updated CAD?",
        direction: "inbound",
        sourceMessageId: null,
        contactLabel: "Mom",
      }),
      "2026-09-25T16:00:00.000Z",
    );
    const fallbackB = normalizeSmsMessage(
      input({
        body: "Can you send me the updated CAD?",
        direction: "inbound",
        sourceMessageId: "  ",
        contactLabel: "Workshop",
      }),
      "2026-09-25T16:00:00.000Z",
    );
    const fallbackChanged = normalizeSmsMessage(
      input({
        body: "Different historical text",
        direction: "inbound",
        sourceMessageId: null,
        contactLabel: "Mom",
      }),
      "2026-09-25T16:00:00.000Z",
    );
    assert.equal(fallbackA.message.messageIdWasSynthesized, true);
    assert.equal(fallbackA.message.idempotencyKey, fallbackB.message.idempotencyKey);
    assert.notEqual(fallbackA.message.idempotencyKey, fallbackChanged.message.idempotencyKey);
    assert.equal(fallbackA.message.idempotencyKey.includes("Mom"), false);
  });
});

describe("sms identity routing", () => {
  it("matches a unique existing person and does not mint one", () => {
    const decision = resolveSmsPersonIdentity(
      { phoneHash: CLIENT_HASH, classification: "us-compatible" },
      world,
    );
    assert.equal(decision.personId, "person-client");
    assert.equal(decision.ruleId, "unique_phone_hash");
    assert.equal(decision.mintPerson, false);
    assert.equal(world.people.length, 4);
  });

  it("keeps a shared number unresolved", () => {
    const decision = resolveSmsPersonIdentity(
      { phoneHash: FAMILY_HASH, classification: "us-compatible" },
      world,
    );
    assert.equal(decision.status, "review");
    assert.equal(decision.personId, null);
    assert.equal(decision.ruleId, "family_or_shared_unresolved");
    assert.deepEqual(decision.personIds, ["person-family-a", "person-family-b"]);
  });

  it("leaves an unknown number as evidence", () => {
    const decision = resolveSmsPersonIdentity(
      { phoneHash: hashPhone(UNKNOWN_PHONE), classification: "us-compatible" },
      world,
    );
    assert.equal(decision.status, "evidence");
    assert.equal(decision.personId, null);
    assert.equal(decision.ruleId, "unknown_number_evidence_first");
    assert.equal(decision.mintPerson, false);
  });

  it("treats an internal hash as non-canonical evidence", () => {
    const decision = resolveSmsPersonIdentity(
      { phoneHash: INTERNAL_HASH, classification: "us-compatible" },
      world,
    );
    assert.equal(decision.ruleId, "internal_number");
    assert.equal(decision.personId, null);
  });
});

describe("sms source events and Today eligibility", () => {
  it("historical SMS does not enter Up Next merely because it was imported", () => {
    const observations = projectSmsObservations(
      [
        input({
          body: "Can you send me the updated CAD?",
          direction: "inbound",
          ingestClass: "historical",
        }),
      ],
      world,
      "2026-09-25T16:00:00.000Z",
    );
    assert.equal(observations[0]?.event.semanticClass, "client_requests");
    assert.equal(observations[0]?.admission, "historical_evidence_only");
    const surface = smsTodaySurface({
      observations,
      loopKey: loopKey(observations),
    });
    assert.equal(surface.admittedEvents.length, 0);
    assert.equal(surface.entersUpNext, false);
    assert.equal(surface.reduced.founderOpen, false);
  });

  it("Thanks does not create founder work", () => {
    const observations = projectSmsObservations(
      [input({ body: "Thanks!", direction: "inbound" })],
      world,
      "2026-09-25T16:00:00.000Z",
    );
    assert.equal(observations[0]?.event.semanticClass, "client_replies_nonblocking");
    const surface = smsTodaySurface({
      observations,
      loopKey: loopKey(observations),
    });
    assert.equal(surface.entersUpNext, false);
    assert.equal(surface.reduced.founderOpen, false);
    assert.equal(surface.reduced.ballHolder === "founder", false);
  });

  it("a known business-line client request can become an unresolved founder obligation", () => {
    const observations = projectSmsObservations(
      [input({ body: "Can you send me the updated CAD?", direction: "inbound" })],
      world,
      "2026-09-25T16:00:00.000Z",
    );
    const event = observations[0]?.event;
    assert.equal(event?.sourceType, "sms");
    assert.equal(event?.actor, "client");
    assert.equal(event?.semanticClass, "client_requests");
    assert.equal(event?.personLabel, "Ada Client");
    assert.equal(observations[0]?.createsPerson, false);
    assert.equal(observations[0]?.createsProject, false);
    assert.equal(isSmsObservationProvenance(event!.provenance), true);
    if (isSmsObservationProvenance(event!.provenance)) {
      assert.equal(event?.provenance.channel, "sms");
      assert.notEqual(event?.provenance, "indexed_gmail");
    }
    const surface = smsTodaySurface({
      observations,
      loopKey: loopKey(observations),
    });
    assert.equal(surface.reduced.founderOpen, true);
    assert.equal(surface.reduced.ballHolder, "founder");
    assert.equal(surface.entersUpNext, true);
  });

  it("founder fulfillment can satisfy that obligation", () => {
    const observations = projectSmsObservations(
      [
        input({
          sourceMessageId: "ask",
          body: "Can you send me the updated CAD?",
          direction: "inbound",
          sentAt: "2026-09-25T15:00:00.000Z",
          senderPhone: CLIENT_PHONE,
        }),
        input({
          sourceMessageId: "sent",
          body: "I sent it over.",
          direction: "outbound",
          sentAt: "2026-09-25T18:00:00.000Z",
          senderPhone: "3055550101",
          participantPhones: [CLIENT_PHONE],
        }),
      ],
      world,
      "2026-09-25T18:30:00.000Z",
    );
    assert.equal(observations[1]?.event.semanticClass, "founder_fulfills_commitment");
    assert.equal(observations[1]?.event.actor, "founder");
    const surface = smsTodaySurface({
      observations,
      loopKey: loopKey(observations),
    });
    assert.equal(surface.admittedEvents.length, 2);
    assert.equal(surface.reduced.founderOpen, false);
    assert.notEqual(surface.reduced.ballHolder, "founder");
    assert.equal(surface.entersUpNext, false);
  });

  it("a vendor promise produces waiting-on-shop state", () => {
    const observations = projectSmsObservations(
      [
        input({
          body: "I'll have the CAD Friday.",
          direction: "inbound",
          senderPhone: VENDOR_PHONE,
          sourceThreadId: "vendor-thread",
        }),
      ],
      world,
      "2026-09-25T16:00:00.000Z",
    );
    assert.equal(observations[0]?.event.actor, "vendor_shop");
    assert.equal(observations[0]?.event.semanticClass, "vendor_promises");
    const surface = smsTodaySurface({
      observations,
      loopKey: loopKey(observations),
    });
    assert.equal(surface.reduced.ballHolder, "vendor_shop");
    assert.equal(surface.reduced.vendorOpen, true);
    assert.equal(surface.reduced.founderOpen, false);
    assert.equal(surface.reduced.briefingKind, "vendor_cad_wait");
    assert.equal(surface.isWait, true);
    assert.equal(surface.entersUpNext, false);
  });

  it("an unknown number does not create a Person or Project", () => {
    const before = world.people.length;
    const observations = projectSmsObservations(
      [
        input({
          body: "Can you send me the updated CAD?",
          direction: "inbound",
          senderPhone: UNKNOWN_PHONE,
          contactLabel: "Probably Ada",
          lineClass: "business",
        }),
      ],
      world,
      "2026-09-25T16:00:00.000Z",
    );
    const event = observations[0]?.event;
    assert.equal(world.people.length, before);
    assert.equal(observations[0]?.identity.personId, null);
    assert.equal(observations[0]?.createsPerson, false);
    assert.equal(observations[0]?.createsProject, false);
    assert.equal(event?.projectId, null);
    assert.equal(event?.personLabel, null);
    assert.equal(event?.actor, "unknown");
    assert.equal(JSON.stringify(event).includes("Probably Ada"), false);
    assert.equal(JSON.stringify(event).includes("555-0199"), false);
    const surface = smsTodaySurface({
      observations,
      loopKey: loopKey(observations),
    });
    assert.equal(surface.entersUpNext, false);
  });

  it("a personal unknown thread is not Today-eligible", () => {
    const observations = projectSmsObservations(
      [
        input({
          body: "Can you send me the updated CAD?",
          direction: "inbound",
          senderPhone: UNKNOWN_PHONE,
          lineClass: "personal",
          contactLabel: "Home",
        }),
      ],
      world,
      "2026-09-25T16:00:00.000Z",
    );
    assert.equal(observations[0]?.admission, "personal_unknown_withheld");
    const surface = smsTodaySurface({
      observations,
      loopKey: loopKey(observations),
    });
    assert.equal(surface.admittedEvents.length, 0);
    assert.equal(surface.entersUpNext, false);
  });

  it("manual routing to an existing client can admit a personal-line number", () => {
    const observations = projectSmsObservations(
      [
        input({
          body: "Can you send me the updated CAD?",
          direction: "inbound",
          senderPhone: UNKNOWN_PHONE,
          lineClass: "personal",
          manuallyRouted: true,
          routedPersonId: "person-client",
          contactLabel: "Saved as Mom",
        }),
      ],
      world,
      "2026-09-25T16:00:00.000Z",
    );
    assert.equal(observations[0]?.identity.ruleId, "routed_existing_person");
    assert.equal(observations[0]?.identity.personId, "person-client");
    assert.equal(observations[0]?.createsPerson, false);
    assert.equal(observations[0]?.event.personLabel, "Ada Client");
    assert.equal(JSON.stringify(observations[0]?.event).includes("Saved as Mom"), false);
    const surface = smsTodaySurface({
      observations,
      loopKey: loopKey(observations),
    });
    assert.equal(surface.entersUpNext, true);
  });

  it("selecting an unknown personal thread does not invent a person", () => {
    const observations = projectSmsObservations(
      [
        input({
          body: "Can you send me the updated CAD?",
          direction: "inbound",
          senderPhone: UNKNOWN_PHONE,
          lineClass: "personal",
          founderSelected: true,
        }),
      ],
      world,
      "2026-09-25T16:00:00.000Z",
    );
    assert.equal(observations[0]?.identity.personId, null);
    assert.equal(observations[0]?.createsPerson, false);
    assert.equal(observations[0]?.event.projectId, null);
    const surface = smsTodaySurface({
      observations,
      loopKey: loopKey(observations),
    });
    assert.equal(surface.entersUpNext, false);
  });

  it("a known personal-line client can become Today-eligible after interpretation", () => {
    const observations = projectSmsObservations(
      [
        input({
          body: "Can you send me the updated CAD?",
          direction: "inbound",
          lineClass: "personal",
        }),
      ],
      world,
      "2026-09-25T16:00:00.000Z",
    );
    assert.equal(observations[0]?.admission, "admitted");
    const surface = smsTodaySurface({
      observations,
      loopKey: loopKey(observations),
    });
    assert.equal(surface.entersUpNext, true);
    assert.equal(surface.reduced.ballHolder, "founder");
  });

  it("an internal number does not create founder work", () => {
    const observations = projectSmsObservations(
      [
        input({
          body: "Can you send me the updated CAD?",
          direction: "inbound",
          senderPhone: INTERNAL_PHONE,
          lineClass: "business",
        }),
      ],
      world,
      "2026-09-25T16:00:00.000Z",
    );
    assert.equal(observations[0]?.admission, "internal_withheld");
    assert.equal(observations[0]?.event.semanticClass, "unknown_communication");
    assert.equal(observations[0]?.event.actor, "unknown");
    assert.equal(observations[0]?.identity.personId, null);
    const surface = smsTodaySurface({
      observations,
      loopKey: loopKey(observations),
    });
    assert.equal(surface.entersUpNext, false);
    assert.equal(surface.reduced.founderOpen, false);
  });

  it("a duplicate SMS observation is idempotent", () => {
    const message = input({
      body: "Can you send me the updated CAD?",
      direction: "inbound",
      sourceMessageId: "same-id",
    });
    const once = projectSmsObservations([message], world, "2026-09-25T16:00:00.000Z");
    const twice = projectSmsObservations(
      [message, { ...message, contactLabel: "Changed Label", body: "Can you send me the updated CAD?" }],
      world,
      "2026-09-25T16:00:00.000Z",
    );
    assert.equal(twice.length, 1);
    assert.equal(twice[0]?.event.sourceRef, once[0]?.event.sourceRef);
    const surface = smsTodaySurface({
      observations: twice,
      loopKey: loopKey(twice),
    });
    assert.equal(surface.admittedEvents.length, 1);
    assert.equal(surface.entersUpNext, true);
  });

  it("an existing shop wait stays a wait when a thanks arrives", () => {
    const observations = projectSmsObservations(
      [input({ body: "Thanks!", direction: "inbound", sourceThreadId: "wait-thread" })],
      world,
      "2026-09-25T16:00:00.000Z",
    );
    const surface = smsTodaySurface({
      observations,
      loopKey: loopKey(observations),
      waitingState: "shop",
    });
    assert.equal(surface.reduced.ballHolder, "vendor_shop");
    assert.equal(surface.reduced.founderOpen, false);
    assert.equal(surface.isWait, true);
    assert.equal(surface.entersUpNext, false);
  });

  it("Up Next stays capped at 3 when more SMS obligations exist", () => {
    const observations = [1, 2, 3, 4].map((index) =>
      projectSmsObservations(
        [
          input({
            sourceMessageId: `ask-${index}`,
            sourceThreadId: `thread-${index}`,
            body: "Can you send me the updated CAD?",
            direction: "inbound",
          }),
        ],
        world,
        "2026-09-25T16:00:00.000Z",
      ),
    );
    const live = observations.flatMap((rows) => {
      const surface = smsTodaySurface({ observations: rows, loopKey: loopKey(rows) });
      if (!surface.entersUpNext) return [];
      const priority: CosPriorityInput = {
        origin: "sms",
        subject: rows[0]?.event.authorOwnedText ?? "",
        headline: "Send the updated CAD",
        context: rows[0]?.event.personLabel ?? null,
        projectId: rows[0]?.event.projectId ?? null,
        projectName: null,
        entityType: "client",
        briefingKind: surface.reduced.briefingKind,
        ballHolder: surface.reduced.ballHolder,
        timingLabel: null,
      };
      return [{ priority }];
    });
    assert.equal(live.length, 4);
    const filled = fillUpNextCapacity(live, []);
    assert.equal(COS_UP_NEXT_VISIBLE_LIMIT, 3);
    assert.equal(filled.visible.length, 3);
    assert.equal(filled.queuedLive.length, 1);
  });

  it("Gmail projection provenance and classes stay on the Gmail path", () => {
    const founderHash = hashEmail("justin@hourglassdiamonds.com")!;
    const events = projectGmailSourceEvents({
      threadContext: new Map([
        [
          "gmail-thread",
          {
            subject: "RE: HGD x Ada-C026143",
            messages: [
              {
                messageId: "gmail-msg",
                sentAt: "2026-09-21T18:13:04.000Z",
                direction: "inbound",
                fromEmailHash: hashEmail("ada@client.test")!,
                subject: "RE: HGD x Ada-C026143",
              },
            ],
          },
        ],
      ]),
      founderEmailHashes: new Set([founderHash]),
      knownPeople: [],
    });
    assert.equal(events[0]?.sourceType, "gmail");
    assert.equal(events[0]?.provenance, "indexed_gmail");
    assert.equal(isSmsObservationProvenance(events[0]!.provenance), false);
  });
});
