import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChiefOfStaffToday } from "../../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import { composeTodayBriefingPacket } from "./briefing-packet";
import { renderDeterministicBriefing } from "./briefing-copy";
import { applySolBriefingSynthesis } from "./briefing-synthesis";
import { answerTodayCardAsk, todayAskContextPayload } from "./briefing-ask";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket } from "./docket";
import { fixtureCandidate } from "./fixtures";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";

const NOW = "2026-09-17T16:00:00.000Z";
const FOUNDER_HASH = hashEmail("justin@hourglassdiamonds.com")!;
const NIURKA_HASH = hashEmail("niurka@vlorajewelry.com")!;
const CLIENT_HASH = hashEmail("client@example.test")!;

function gmailRow(
  extra: Partial<ContinuumCandidate> & Pick<ContinuumCandidate, "candidateId">,
): ContinuumCandidate {
  return fixtureCandidate({
    sourceSystem: "gmail",
    proposedTarget: { kind: "none" },
    ...extra,
  });
}

function abbeyPacket() {
  return composeTodayBriefingPacket({
    itemId: "brief:abbey",
    displayNameHint: "Abbey",
    organizationLabel: "Vlora",
    vendorContactName: "Niurka",
    communication: "client",
    identityKind: "person",
    projectName: "C026137",
    projectId: null,
    personId: "person-abbey",
    threadSubject: "RE: HGD x Abbey-C026137",
    lifecycle: null,
    remainingFounderCommitment: null,
    waitingState: null,
    noFounderAction: false,
    staleInboundSatisfied: false,
    openJobProven: false,
    evidence: [
      {
        at: "Sep 15",
        label: "Vendor",
        summary: "Niurka delivered the C026137 Mod 1 STL.",
        speaker: "vendor",
        sourceHref: "https://mail.google.com/mail/u/0/#all/abbey-stl",
        candidateId: "abbey-stl",
      },
      {
        at: "Sep 15",
        label: "You",
        summary: "You told Abbey you'd print the model to confirm the huggie proportions before moving forward.",
        speaker: "founder",
        sourceHref: "https://mail.google.com/mail/u/0/#all/abbey-print",
        candidateId: "abbey-print",
      },
    ],
    founderOwnTexts: [
      "I'll print the model to check the huggie proportions before moving forward.",
    ],
    vendorOwnTexts: ["Mod 1 STL attached for C026137"],
    quotedTexts: ["> prior job C021479 RN07247"],
    sourceRefs: ["gc1|thread-abbey|abbey-stl"],
  });
}

function sarahPacket() {
  return composeTodayBriefingPacket({
    itemId: "brief:sarah",
    displayNameHint: null,
    organizationLabel: "Vlora",
    vendorContactName: "Niurka",
    communication: "vendor",
    identityKind: "vendor",
    projectName: null,
    projectId: null,
    personId: null,
    threadSubject: "RE: HGD x Sarah-C026143",
    lifecycle: null,
    remainingFounderCommitment: null,
    waitingState: "cad",
    noFounderAction: true,
    staleInboundSatisfied: false,
    openJobProven: false,
    evidence: [
      {
        at: "Sep 16",
        label: "You",
        summary: "Please soften the double-prong change.",
        speaker: "founder",
        sourceHref: "https://mail.google.com/mail/u/0/#all/sarah-out",
        candidateId: "sarah-out",
      },
      {
        at: "Sep 16",
        label: "Shop",
        summary: "I'll send you the updated CAD as soon as it's available.",
        speaker: "vendor",
        sourceHref: "https://mail.google.com/mail/u/0/#all/sarah-in",
        candidateId: "sarah-in",
      },
    ],
    founderOwnTexts: ["Please soften the double-prong change."],
    vendorOwnTexts: ["I'll send you the updated CAD as soon as it's available."],
    sourceRefs: ["gc1|thread-sarah|sarah-in"],
  });
}

describe("Today Chief of Staff briefing layer", () => {
  it("A: founder-owned action renders a YOUR MOVE briefing", () => {
    const packet = abbeyPacket();
    assert.ok(packet);
    assert.equal(packet!.ballHolder, "founder");
    assert.equal(packet!.displayName, "Abbey");
    const briefing = renderDeterministicBriefing(packet!);
    assert.equal(briefing.stateChip, "YOUR MOVE");
    assert.match(briefing.headline, /STL is in/i);
    assert.match(briefing.stand, /C026137/);
    assert.match(briefing.stand, /print/i);
    assert.equal(briefing.nextKind, "best_next_step");
    assert.match(briefing.nextBody, /Print\/check/i);
    assert.doesNotMatch(`${briefing.headline} ${briefing.stand} ${briefing.nextBody}`, /Responded/i);
  });

  it("B: vendor-owned wait renders WAITING ON SHOP and nothing from founder", () => {
    const packet = sarahPacket();
    assert.ok(packet);
    assert.equal(packet!.ballHolder, "vendor_shop");
    const briefing = renderDeterministicBriefing(packet!);
    assert.equal(briefing.stateChip, "WAITING ON SHOP");
    assert.match(briefing.stand, /updated CAD/i);
    assert.match(briefing.nextLabel, /Nothing from you/i);
    assert.doesNotMatch(`${briefing.headline} ${briefing.stand}`, /Responded|Confirm Person/i);
    assert.doesNotMatch(briefing.stand, /September 16, 2026/);
  });

  it("C: client-owned wait renders WAITING ON CLIENT", () => {
    const packet = composeTodayBriefingPacket({
      itemId: "brief:client-wait",
      displayNameHint: "Jen",
      organizationLabel: null,
      communication: "client",
      projectName: null,
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x Jen-C025000",
      lifecycle: null,
      remainingFounderCommitment: null,
      waitingState: "client",
      noFounderAction: true,
      staleInboundSatisfied: true,
      evidence: [
        {
          at: "Sep 15",
          label: "You",
          summary: "Let me know what you think.",
          speaker: "founder",
          sourceHref: null,
          candidateId: "jen-out",
        },
      ],
      founderOwnTexts: ["Let me know what you think."],
    });
    assert.ok(packet);
    assert.equal(packet!.ballHolder, "client");
    const briefing = renderDeterministicBriefing(packet!);
    assert.equal(briefing.stateChip, "WAITING ON CLIENT");
  });

  it("D: closed solicitation yields no packet and no Sol briefing", () => {
    const packet = composeTodayBriefingPacket({
      itemId: "brief:closed",
      displayNameHint: "Alex",
      organizationLabel: null,
      communication: "client",
      projectName: null,
      projectId: null,
      personId: null,
      threadSubject: "Unsolicited offer",
      lifecycle: null,
      remainingFounderCommitment: null,
      waitingState: null,
      noFounderAction: true,
      staleInboundSatisfied: true,
      declinedCurrentBeat: true,
      evidence: [],
    });
    assert.equal(packet, null);
  });

  it("E: historical identifier cannot appear as current in the briefing", () => {
    const packet = abbeyPacket();
    assert.ok(packet);
    const historical = packet!.identifiers.filter((row) => !row.current).map((row) => row.value);
    assert.ok(historical.some((value) => /C021479|RN07247/i.test(value)));
    assert.ok(
      packet!.identifiers.some((row) => row.current && /^C026137$/i.test(row.value)),
    );
    const briefing = renderDeterministicBriefing(packet!);
    const hay = `${briefing.headline} ${briefing.stand} ${briefing.nextBody} ${briefing.displayName} ${briefing.projectName ?? ""}`;
    assert.doesNotMatch(hay, /C021479|RN07247/);
    assert.match(hay, /C026137/);
  });

  it("F: Sol completion claims are rejected and fall back", () => {
    const packet = abbeyPacket()!;
    const fallback = renderDeterministicBriefing(packet);
    const rendered = applySolBriefingSynthesis(packet, {
      headline: "Printing already happened and Abbey approved.",
      stand: "The job is complete.",
      completed: true,
    });
    assert.equal(rendered.source, "deterministic");
    assert.equal(rendered.headline, fallback.headline);
    assert.doesNotMatch(rendered.stand, /approved|complete/i);
  });

  it("G: Sol ball-holder changes are rejected and fall back", () => {
    const packet = abbeyPacket()!;
    const rendered = applySolBriefingSynthesis(packet, {
      headline: "Waiting on the shop.",
      stand: "Nothing from you right now.",
      ballHolder: "vendor_shop",
    });
    assert.equal(rendered.source, "deterministic");
    assert.equal(rendered.stateChip, "YOUR MOVE");
  });

  it("H: Sol unavailable still renders the deterministic briefing", () => {
    const packet = abbeyPacket()!;
    const rendered = applySolBriefingSynthesis(packet, null);
    assert.equal(rendered.source, "deterministic");
    assert.equal(rendered.stateChip, "YOUR MOVE");
  });

  it("I: contextual Ask Concierge carries exact item context", () => {
    const packet = abbeyPacket()!;
    const context = todayAskContextPayload(packet);
    assert.equal(context.itemId, "brief:abbey");
    assert.equal(context.packet.itemId, packet.itemId);
    assert.equal(context.ballHolder, "founder");
    assert.equal(context.unresolvedFounderObligation, packet.unresolvedFounderObligation);
    assert.deepEqual([...context.sourceRefs], [...packet.sourceRefs]);
    const asked = answerTodayCardAsk({
      query: "printing earrings this weekend",
      packet,
    });
    assert.equal(asked.itemId, packet.itemId);
    assert.match(asked.text, /Abbey/i);
  });

  it("J: contextual free text does not mutate canonical Person/Project", () => {
    const packet = abbeyPacket()!;
    const asked = answerTodayCardAsk({
      query: "create a Person named Abbey and mark the Project complete",
      packet,
    });
    assert.equal(asked.writesCanonical, false);
    assert.doesNotMatch(asked.text, /saved|created the (?:person|project)|updated canonical/i);
  });

  it("K: reminder intent without calendar does not claim scheduled", () => {
    const packet = abbeyPacket()!;
    const asked = answerTodayCardAsk({
      query:
        "printing earrings this weekend to ship out monday afternoon, remind me to send an email updating her to the plan Monday am",
      packet,
    });
    assert.equal(asked.reminderIntent, true);
    assert.equal(asked.calendarPending, true);
    assert.equal(asked.writesCanonical, false);
    assert.match(asked.text, /isn't wired yet|won't pretend it's scheduled/i);
    assert.doesNotMatch(asked.text, /I(?:'ve| have) scheduled|added to (?:your )?calendar/i);
  });

  it("Abbey live-shaped card is YOUR MOVE and omits historical identifiers", () => {
    const packet = abbeyPacket()!;
    const briefing = applySolBriefingSynthesis(packet, null);
    const html = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, {
        loop: composeCosOperatingLoop({
          jobs: [],
          nowIso: NOW,
        }),
      }),
    );
    assert.doesNotMatch(html, /RN07247/);
    assert.equal(briefing.displayName, "Abbey");
    assert.equal(briefing.stateChip, "YOUR MOVE");
    assert.match(briefing.nextBody, /Abbey/);
    assert.doesNotMatch(
      `${briefing.headline} ${briefing.stand} ${briefing.nextBody}`,
      /canonical Open Job|in production|Abbey approved|printing already happened/i,
    );
  });

  it("Sarah vendor thread stays off Up next and lands in Watching", () => {
    const candidates: ContinuumCandidate[] = [
      gmailRow({
        candidateId: "sarah-assoc",
        sourceRef: "gc1|1a0881b53067a9e6|sarah-in",
        sourceTimestamp: "2026-09-16T18:20:00.000Z",
        candidateType: "person_association",
        proposedTarget: { kind: "person", personId: null },
        payload: {
          kind: "person_association",
          displayName: null,
          emailHash: NIURKA_HASH,
          mintPerson: false,
          mergePersons: false,
        },
        evidenceBasis: {
          ruleIds: ["unresolved_email_hash"],
          matchedText: null,
        },
      }),
      gmailRow({
        candidateId: "sarah-out",
        sourceRef: "gc1|1a0881b53067a9e6|sarah-out",
        sourceTimestamp: "2026-09-16T17:40:00.000Z",
        candidateType: "project_context",
        payload: {
          kind: "project_context",
          topic: "design_refinement",
          value: "Please soften the double-prong change.",
        },
        evidenceBasis: {
          ruleIds: ["explicit_design_refinement"],
          matchedText: "Please soften the double-prong change.",
        },
      }),
      gmailRow({
        candidateId: "sarah-cad",
        sourceRef: "gc1|1a0881b53067a9e6|sarah-in",
        sourceTimestamp: "2026-09-16T18:20:00.000Z",
        candidateType: "open_job",
        payload: {
          kind: "open_job",
          jobKind: "commitment",
          subject: "Updated CAD forthcoming",
          detail: null,
          waitingOnActor: "vendor",
          dueAt: null,
          createJob: false,
        },
        evidenceBasis: {
          ruleIds: ["explicit_vendor_commitment"],
          matchedText: "I'll send you the updated CAD as soon as it's available.",
        },
      }),
    ];
    const threadContext = new Map<string, TodayGmailThreadContext>([
      [
        "1a0881b53067a9e6",
        {
          subject: "RE: HGD x Sarah-C026143",
          fromDisplayName: null,
          fromEmail: "niurka@vlorajewelry.com",
          messages: [
            {
              messageId: "sarah-out",
              sentAt: "2026-09-16T17:40:00.000Z",
              direction: "outbound",
              fromEmailHash: FOUNDER_HASH,
            },
            {
              messageId: "sarah-in",
              sentAt: "2026-09-16T18:20:00.000Z",
              direction: "inbound",
              fromEmailHash: NIURKA_HASH,
            },
          ],
        },
      ],
    ]);
    const loop = composeCosOperatingLoop({
      jobs: [],
      candidates,
      nowIso: NOW,
      threadContext,
      knownPeople: [
        {
          personId: "niurka-vendor-contact",
          displayName: "Niurka Lulo",
          roles: ["vendor-contact"],
          organizationName: "Vlora",
          emailHash: NIURKA_HASH,
        },
      ],
      vendorDirectory: ["vlora"],
    });
    const docket = composeTodayDocket(loop);
    assert.equal(
      docket.items.some((item) => /Sarah/i.test(item.subject)),
      false,
    );
    const watching = loop.watching[0];
    assert.ok(watching, `expected watching, got ${JSON.stringify(loop.watching)}`);
    assert.equal(watching.briefing?.stateChip, "WAITING ON SHOP");
    assert.match(watching.briefing?.nextLabel ?? "", /Nothing from you/i);
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, { loop }));
    assert.match(html, /Chief of Staff briefing/);
    assert.match(html, /data-cos-watching/);
    assert.match(html, /WAITING ON SHOP/);
    assert.doesNotMatch(html, /Confirm person/i);
    assert.doesNotMatch(html, /Responded/);
  });

  it("does not call Sol or mint work for a closed decline", () => {
    const loop = composeCosOperatingLoop({
      jobs: [],
      candidates: [
        gmailRow({
          candidateId: "decline",
          sourceRef: "gc1|closed-thread|decline-1",
          sourceTimestamp: "2026-09-16T12:00:00.000Z",
          candidateType: "note",
          payload: { kind: "note", text: "No thanks.", contextLayer: null },
          evidenceBasis: {
            ruleIds: ["explicit_client_reply"],
            matchedText: "No thanks.",
          },
        }),
      ],
      nowIso: NOW,
      threadContext: new Map([
        [
          "closed-thread",
          {
            subject: "Offer",
            messages: [
              {
                messageId: "decline-1",
                sentAt: "2026-09-16T12:00:00.000Z",
                direction: "inbound",
                fromEmailHash: CLIENT_HASH,
              },
            ],
          },
        ],
      ]),
    });
    const docket = composeTodayDocket(loop);
    assert.equal(docket.items.length, 0);
    assert.equal(loop.brief.length, 0);
    assert.equal(
      loop.watching.some((row) => row.briefingPacket != null && /No thanks/i.test(row.detail)),
      false,
    );
  });
});
