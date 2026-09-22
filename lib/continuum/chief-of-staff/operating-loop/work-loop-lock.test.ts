import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import { ChiefOfStaffToday } from "../../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import { composeTodayBriefingPacket } from "./briefing-packet";
import { renderDeterministicBriefing } from "./briefing-copy";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket, COS_DOCKET_VISIBLE_LIMIT } from "./docket";
import { fixtureCandidate } from "./fixtures";
import {
  equivalentPacketFromBrief,
  inspectFinalizedTodayDocket,
} from "./today-docket-boundary";
import type { CosBriefItem, CosProjectContext } from "./types";
import { eventsFromInput, reduceWorkLoop } from "./work-loop-state";

const NOW = "2026-09-21T22:00:00.000Z";
const FOUNDER_HASH = hashEmail("justin@hourglassdiamonds.com")!;
const NIURKA_EMAIL = "niurka@vlorajewelry.com";
const NIURKA_HASH = hashEmail(NIURKA_EMAIL)!;

function gmailRow(
  extra: Partial<ContinuumCandidate> & Pick<ContinuumCandidate, "candidateId">,
): ContinuumCandidate {
  return fixtureCandidate({
    sourceSystem: "gmail",
    proposedTarget: { kind: "none" },
    ...extra,
  });
}

function todayOf(
  candidates: ContinuumCandidate[],
  threadContext: Map<string, TodayGmailThreadContext>,
  projects?: Map<string, CosProjectContext>,
  extraPeople?: Parameters<typeof composeCosOperatingLoop>[0]["knownPeople"],
) {
  const loop = composeCosOperatingLoop({
    jobs: [],
    candidates,
    projects: projects ?? new Map(),
    nowIso: NOW,
    threadContext,
    knownPeople: [
      {
        personId: "niurka-vendor-contact",
        displayName: "Niurka Lulo",
        roles: ["vendor-contact"] as const,
        organizationName: "Vlora",
        emailHash: NIURKA_HASH,
      },
      ...(extraPeople ?? []),
    ],
    vendorDirectory: ["vlora"],
  });
  return { loop, docket: composeTodayDocket(loop) };
}

function hay(docket: ReturnType<typeof composeTodayDocket>): string {
  return [
    ...docket.items.map((item) => `${item.subject} ${item.headline} ${item.context ?? ""}`),
    ...docket.watching.map((row) => `${row.title} ${row.detail}`),
  ].join("\n");
}

function vendorBeat(at: string, summary: string) {
  return {
    at,
    label: "Shop",
    summary,
    speaker: "vendor" as const,
    sourceHref: `https://mail.google.com/mail/u/0/#all/${at}`,
    candidateId: `vendor-${at}`,
    timestamp: at,
  };
}

function founderBeat(at: string, summary: string) {
  return {
    at,
    label: "You",
    summary,
    speaker: "founder" as const,
    sourceHref: `https://mail.google.com/mail/u/0/#all/${at}`,
    candidateId: `founder-${at}`,
    timestamp: at,
  };
}

function clientBeat(at: string, summary: string) {
  return {
    at,
    label: "Client",
    summary,
    speaker: "client" as const,
    sourceHref: `https://mail.google.com/mail/u/0/#all/${at}`,
    candidateId: `client-${at}`,
    timestamp: at,
  };
}

describe("reduced work-loop state is locked through render", () => {
  it("Dylon recap remaining cannot replace founder CAD/STL review after reduceWorkLoop", () => {
    const evidence = [
      founderBeat("2026-09-17T15:00:00.000Z", "Please send the updated CAD and STL."),
      vendorBeat("2026-09-21T18:13:04.000Z", "Here is the C025610 Mod 4 CAD + STL."),
    ];
    const events = eventsFromInput({ evidence });
    const reduced = reduceWorkLoop({
      evidence,
      remaining: {
        matchedText: "Send the recap and next step.",
        headline: "Send the recap and next step.",
        explanation: "Send the recap and next step.",
        recommended: "Send the recap and next step.",
      },
      communication: "vendor",
    });
    const packet = composeTodayBriefingPacket({
      itemId: "dylon",
      displayNameHint: "Dylon",
      organizationLabel: "Vlora",
      communication: "vendor",
      projectName: "C025610",
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x Dylon D.-C025610",
      lifecycle: null,
      remainingFounderCommitment: {
        matchedText: "Send the recap and next step.",
        headline: "Send the recap and next step.",
        explanation: "Send the recap and next step.",
        recommended: "Send the recap and next step.",
      },
      waitingState: null,
      noFounderAction: false,
      staleInboundSatisfied: false,
      evidence,
      founderOwnTexts: ["Please send the updated CAD and STL."],
      vendorOwnTexts: ["Here is the C025610 Mod 4 CAD + STL."],
      sourceRefs: ["gc1|19fed961d1371aaf|dylon-delivery"],
    });
    assert.ok(packet);
    assert.equal(events.some((row) => row.eventType === "vendor_delivers"), true);
    assert.equal(reduced.ballHolder, "founder");
    assert.equal(reduced.semanticClass, "founder_review");
    assert.equal(packet.ballHolder, reduced.ballHolder);
    assert.equal(packet.semanticNextActionClass, reduced.semanticClass);
    assert.equal(packet.authoritative, true);
    assert.doesNotMatch(packet.unresolvedFounderObligation ?? "", /recap/i);
    assert.doesNotMatch(packet.candidateNextAction ?? "", /recap/i);
    assert.match(packet.candidateNextAction ?? "", /Review them/i);
    assert.doesNotMatch(`${packet.candidateNextAction ?? ""} ${packet.unresolvedFounderObligation ?? ""}`, /shank/i);

    const brief: CosBriefItem = {
      id: "dylon",
      rank: 1,
      rankClass: "client_reply",
      personLabel: "Dylon",
      projectTitle: "C025610",
      projectId: null,
      headline: "Your turn",
      explanation: "Latest turn.",
      recommended: "Send the recap / next step.",
      stateLabel: null,
      urgencyLabel: null,
      actions: [],
      evidence,
      openJobLabel: null,
      projectStateLabel: null,
      candidateIds: ["dylon-delivery"],
      proposedAction: null,
      specConflict: null,
      briefingPacket: packet,
    };
    const recomposed = equivalentPacketFromBrief(brief);
    assert.equal(recomposed?.ballHolder, packet.ballHolder);
    assert.equal(recomposed?.semanticNextActionClass, packet.semanticNextActionClass);
    assert.doesNotMatch(recomposed?.candidateNextAction ?? "", /recap/i);
  });

  it("authoritative reduced state cannot change ballHolder, dependency, lane, or semantic class downstream", () => {
    const evidence = [
      vendorBeat("2026-09-21T18:13:04.000Z", "Here is the C025610 Mod 4 CAD + STL."),
    ];
    const reduced = reduceWorkLoop({ evidence, communication: "vendor" });
    const packet = composeTodayBriefingPacket({
      itemId: "dylon-lock",
      displayNameHint: "Dylon",
      organizationLabel: "Vlora",
      communication: "vendor",
      projectName: "C025610",
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x Dylon D.-C025610",
      lifecycle: null,
      remainingFounderCommitment: {
        matchedText: "Send the recap / next step.",
        headline: "Send the recap / next step.",
        explanation: "Your turn",
        recommended: "Send the recap / next step.",
      },
      waitingState: null,
      noFounderAction: false,
      staleInboundSatisfied: false,
      evidence,
      vendorOwnTexts: ["Here is the C025610 Mod 4 CAD + STL."],
    });
    assert.equal(reduced.authoritative, true);
    assert.equal(reduced.ballHolder, "founder");
    assert.equal(reduced.semanticClass, "founder_review");
    assert.equal(packet?.authoritative, true);
    assert.equal(packet?.ballHolder, reduced.ballHolder);
    assert.equal(packet?.semanticNextActionClass, reduced.semanticClass);
    const recomposed = equivalentPacketFromBrief({
      id: "dylon-lock",
      rank: 1,
      rankClass: "client_reply",
      personLabel: "Dylon",
      projectTitle: "C025610",
      projectId: null,
      headline: "Send the recap / next step.",
      explanation: "Your turn",
      recommended: "Send the recap / next step.",
      stateLabel: null,
      urgencyLabel: null,
      actions: [],
      evidence,
      openJobLabel: null,
      projectStateLabel: null,
      candidateIds: ["dylon-lock"],
      proposedAction: null,
      specConflict: null,
      briefingPacket: packet,
    });
    assert.equal(recomposed?.ballHolder, reduced.ballHolder);
    assert.equal(recomposed?.semanticNextActionClass, reduced.semanticClass);
    assert.equal(recomposed?.authoritative, true);
  });

  it("unanswered inbound keeps founder_communication remaining through docket render", () => {
    const nateThread = "19a854e42f90344f";
    const { docket, loop } = todayOf(
      [
        gmailRow({
          candidateId: "nate-request",
          sourceRef: `gc1|${nateThread}|nate-in`,
          sourceTimestamp: "2026-09-16T18:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Can you send chain options and pricing",
            detail: null,
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request"],
            matchedText:
              "How durable are pearls for daily wear? What metal should we use? Can you send chain options and pricing?",
          },
        }),
      ],
      new Map([
        [
          nateThread,
          {
            subject: "Re: Pearl pendant",
            fromDisplayName: "Nate Pearl",
            fromEmail: "nate.pearl@example.test",
            messages: [
              {
                messageId: "nate-in",
                sentAt: "2026-09-16T18:00:00.000Z",
                direction: "inbound",
              },
            ],
          },
        ],
      ]),
      undefined,
      [
        {
          personId: "nate-pearl-person-id",
          displayName: "Nate Pearl",
          roles: ["client"] as const,
          emailHash: hashEmail("nate.pearl@example.test")!,
        },
      ],
    );
    const packet = loop.brief[0]?.briefingPacket;
    assert.equal(packet?.ballHolder, "founder");
    assert.equal(packet?.semanticNextActionClass, "founder_communication");
    assert.equal(packet?.authoritative, true);
    assert.match(
      `${packet?.unresolvedFounderObligation ?? ""} ${packet?.candidateNextAction ?? ""}`,
      /chain options/i,
    );
    const card = docket.items.find((item) => /Nate|Pearl|chain/i.test(`${item.subject} ${item.headline}`));
    assert.ok(card, hay(docket));
    assert.match(card?.headline ?? "", /chain options|recap|next step/i);
    assert.doesNotMatch(card?.headline ?? "", /Print\/check/i);
  });

  it("Hourglass Diamonds + Meta is not vendor_shop without jewelry shop evidence", () => {
    const threadId = "meta-ads-thread";
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "meta-update",
          sourceRef: `gc1|${threadId}|meta-update`,
          sourceTimestamp: "2026-09-21T16:00:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "note",
            value: "Your ad account has an update ready to review.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_follow_up"],
            matchedText: "Your ad account has an update ready to review.",
          },
        }),
        gmailRow({
          candidateId: "studio-assoc",
          sourceRef: `gc1|${threadId}|studio-assoc`,
          sourceTimestamp: "2026-09-21T16:00:00.000Z",
          candidateType: "person_association",
          proposedTarget: { kind: "person", personId: null },
          payload: {
            kind: "person_association",
            displayName: "Hourglass Diamonds",
            emailHash: hashEmail("ads@hourglassdiamonds.com"),
            mintPerson: false,
            mergePersons: false,
          },
          evidenceBasis: { ruleIds: ["gmail_participant"], matchedText: "Hourglass Diamonds" },
        }),
      ],
      new Map([
        [
          threadId,
          {
            subject: "Your Meta ad account",
            fromDisplayName: "Meta",
            fromEmail: "updates@meta.com",
            messages: [
              {
                messageId: "meta-update",
                sentAt: "2026-09-21T16:00:00.000Z",
                direction: "inbound",
              },
            ],
          },
        ],
      ]),
    );
    const named = docket.watching.filter((row) => /Meta|Hourglass Diamonds/i.test(`${row.title} ${row.detail}`));
    assert.equal(
      named.some((row) => row.briefingPacket?.ballHolder === "vendor_shop"),
      false,
      hay(docket),
    );
    assert.doesNotMatch(hay(docket), /WAITING ON SHOP|Updated CAD/i);
  });

  it("Duane recap survives only when the reduced loop proves a founder communication obligation", () => {
    const owed = composeTodayBriefingPacket({
      itemId: "duane-owed",
      displayNameHint: "Duane",
      organizationLabel: null,
      communication: "client",
      projectName: "C026350",
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x Duane-C026350",
      lifecycle: null,
      remainingFounderCommitment: null,
      waitingState: null,
      noFounderAction: false,
      staleInboundSatisfied: false,
      evidence: [
        founderBeat("2026-09-20T15:00:00.000Z", "Here is the current design direction."),
        clientBeat("2026-09-21T18:00:00.000Z", "What should we do next?"),
      ],
    });
    assert.equal(owed?.ballHolder, "founder");
    assert.equal(owed?.semanticNextActionClass, "founder_communication");

    const notOwed = composeTodayBriefingPacket({
      itemId: "duane-cad",
      displayNameHint: "Duane",
      organizationLabel: "Vlora",
      communication: "vendor",
      projectName: "C026350",
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x Duane-C026350",
      lifecycle: null,
      remainingFounderCommitment: {
        matchedText: "Send the recap and next step.",
        headline: "Send the recap and next step.",
        explanation: "Send the recap and next step.",
        recommended: "Send the recap and next step.",
      },
      waitingState: "client",
      noFounderAction: false,
      staleInboundSatisfied: false,
      evidence: [
        vendorBeat("2026-09-21T18:00:00.000Z", "Here is the C026350 Mod 2 CAD + STL."),
      ],
      vendorOwnTexts: ["Here is the C026350 Mod 2 CAD + STL."],
    });
    assert.equal(notOwed?.ballHolder, "founder");
    assert.equal(notOwed?.semanticNextActionClass, "founder_review");
    assert.doesNotMatch(notOwed?.candidateNextAction ?? "", /recap/i);
  });

  it("stale diamond-supply canonical mismatch is not a morning docket item", () => {
    const projectId = "jesse-r-project";
    const threadId = "jesse-supply-thread";
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "jesse-supply",
          sourceRef: `gc1|${threadId}|jesse-supply`,
          sourceTimestamp: "2026-09-21T17:00:00.000Z",
          candidateType: "structured_spec",
          proposedTarget: { kind: "project_spec", projectId, fieldName: "diamond_supply_notes" },
          payload: {
            kind: "structured_spec",
            fieldName: "diamond_supply_notes",
            proposedValue: "lab-grown",
            currentValue: "115",
            conflict: true,
          },
          candidateState: "conflict",
          evidenceBasis: {
            ruleIds: ["spec_conflict_review_required"],
            matchedText: "lab-grown",
          },
        }),
      ],
      new Map([
        [
          threadId,
          {
            subject: "Jesse R. diamond supply",
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            messages: [
              {
                messageId: "jesse-supply",
                sentAt: "2026-09-21T17:00:00.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
            ],
          },
        ],
      ]),
      new Map([
        [
          projectId,
          {
            projectId,
            title: "Jesse R.",
            personName: "Jesse R.",
            people: [{ personId: "jesse-person", displayName: "Jesse R.", role: "client" }],
            isCurrent: true,
            specs: [{ fieldName: "diamond_supply_notes", value: "115" }],
            gmailThreadId: threadId,
          },
        ],
      ]),
    );
    const jesse = [...docket.items, ...docket.watching].find((row) =>
      /Jesse|115|lab-grown|diamond supply/i.test(
        "subject" in row ? `${row.subject} ${row.headline}` : `${row.title} ${row.detail}`,
      ),
    );
    assert.equal(jesse, undefined, hay(docket));
  });

  it("Abbey print/check is a visible Up Next card, not a hidden queued recap", () => {
    const abbeyVendor = "1a08760c6837bb32";
    const abbeyClient = "1a07e70c9a7538be";
    const dylonThread = "19fed961d1371aaf";
    const duaneThread = "duane-c026350";
    const { loop, docket } = todayOf(
      [
        gmailRow({
          candidateId: "abbey-stl",
          sourceRef: `gc1|${abbeyVendor}|abbey-stl`,
          sourceTimestamp: "2026-09-17T19:08:23.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Mod 1 STL attached",
            detail: "Here is the C026137 Mod 1 STL.",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_waiting"],
            matchedText: "Here is the C026137 Mod 1 STL.",
          },
        }),
        gmailRow({
          candidateId: "abbey-print",
          sourceRef: `gc1|${abbeyClient}|abbey-print`,
          sourceTimestamp: "2026-09-17T19:20:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "I'll print the model to check the huggie proportions before moving forward.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "I'll print the model to check the huggie proportions before moving forward.",
          },
        }),
        gmailRow({
          candidateId: "dylon-delivery",
          sourceRef: `gc1|${dylonThread}|dylon-delivery`,
          sourceTimestamp: "2026-09-21T18:13:04.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Mod 4 CAD + STL",
            detail: "Here is the C025610 Mod 4 CAD + STL.",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_waiting"],
            matchedText: "Here is the C025610 Mod 4 CAD + STL.",
          },
        }),
        gmailRow({
          candidateId: "duane-ask",
          sourceRef: `gc1|${duaneThread}|duane-ask`,
          sourceTimestamp: "2026-09-21T19:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "what's next",
            detail: "What should we do next?",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request"],
            matchedText: "What should we do next?",
          },
        }),
      ],
      new Map([
        [
          abbeyVendor,
          {
            subject: "RE: HGD x Abbey-C026137",
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            messages: [
              {
                messageId: "abbey-stl",
                sentAt: "2026-09-17T19:08:23.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
            ],
          },
        ],
        [
          abbeyClient,
          {
            subject: "A new piece",
            fromDisplayName: "Abbey",
            fromEmail: "abbey@example.test",
            attachmentFilenames: ["NL-H017-Abbey-C026137.jpg"],
            messages: [
              {
                messageId: "abbey-print",
                sentAt: "2026-09-17T19:20:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
            ],
          },
        ],
        [
          dylonThread,
          {
            subject: "RE: HGD x Dylon D.-C025610",
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            messages: [
              {
                messageId: "dylon-delivery",
                sentAt: "2026-09-21T18:13:04.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
            ],
          },
        ],
        [
          duaneThread,
          {
            subject: "RE: HGD x Duane-C026350",
            fromDisplayName: "Duane",
            fromEmail: "duane@example.test",
            messages: [
              {
                messageId: "duane-ask",
                sentAt: "2026-09-21T19:00:00.000Z",
                direction: "inbound",
              },
            ],
          },
        ],
      ]),
    );
    const ranks = inspectFinalizedTodayDocket(loop, COS_DOCKET_VISIBLE_LIMIT);
    const abbey = ranks.find((row) => /Abbey|C026137/i.test(`${row.displayName} ${row.projectOrCad ?? ""}`));
    assert.ok(abbey, JSON.stringify(ranks));
    assert.notEqual(abbey.lane, "watching");
    assert.equal(abbey.ballHolder, "founder");
    const abbeyCard = [...docket.items, ...docket.watching].find((row) =>
      /Abbey|C026137/i.test("subject" in row ? `${row.subject}` : `${row.title}`),
    );
    assert.ok(abbeyCard);
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, { docket }));
    if (abbey.lane === "up_next") {
      assert.match(html, /Abbey \/ C026137|Abbey/);
    } else {
      assert.equal(abbey.lane, "queued");
    }
  });
});

describe("inbox currentness replaces stale founder actions", () => {
  it("newer CAD/STL delivery supersedes an older shank-width instruction", () => {
    const packet = composeTodayBriefingPacket({
      itemId: "dylon-current",
      displayNameHint: "Dylon",
      organizationLabel: "Vlora",
      communication: "vendor",
      projectName: "C025610",
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x Dylon D.-C025610",
      lifecycle: null,
      remainingFounderCommitment: {
        matchedText: "Please make the shank width 2.0mm.",
        headline: "Please make the shank width 2.0mm.",
        explanation: "Please make the shank width 2.0mm.",
        recommended: "Please make the shank width 2.0mm.",
      },
      waitingState: null,
      noFounderAction: false,
      staleInboundSatisfied: false,
      evidence: [
        founderBeat("2026-09-10T15:00:00.000Z", "Please make the shank width 2.0mm."),
        vendorBeat("2026-09-21T18:13:04.000Z", "Here is the C025610 Mod 4 CAD + STL."),
      ],
      founderOwnTexts: ["Please make the shank width 2.0mm."],
      vendorOwnTexts: ["Here is the C025610 Mod 4 CAD + STL."],
    });
    assert.equal(packet?.ballHolder, "founder");
    assert.equal(packet?.semanticNextActionClass, "founder_review");
    const briefing = renderDeterministicBriefing(packet!);
    assert.match(briefing.headline, /Mod 4 CAD and STL are in/i);
    assert.match(briefing.nextBody, /Review them and send approval/i);
    assert.doesNotMatch(`${briefing.headline} ${briefing.nextBody} ${packet?.unresolvedFounderObligation ?? ""}`, /shank/i);
  });

  it("later shop production/CAD promise supersedes an older prong-change founder action", () => {
    const reduced = reduceWorkLoop({
      evidence: [
        founderBeat("2026-09-12T12:00:00.000Z", "Please soften the double-prong change."),
        founderBeat("2026-09-18T12:00:00.000Z", "Approved — moving forward. Finger size is 9.5. Stone sent."),
        vendorBeat(
          "2026-09-19T15:00:00.000Z",
          "The stone is going to the workshop via RN08318. Final CAD expected in approximately 10 business days.",
        ),
      ],
      remaining: {
        matchedText: "Please soften the double-prong change.",
        headline: "Please soften the double-prong change.",
        explanation: "Please soften the double-prong change.",
        recommended: "Please soften the double-prong change.",
      },
      waitingState: "client",
    });
    assert.equal(reduced.ballHolder, "vendor_shop");
    assert.equal(reduced.semanticClass, "vendor_shop_wait");
  });

  it("founder acknowledgement after a shop order promise stays vendor_shop, not client", () => {
    const reduced = reduceWorkLoop({
      evidence: [
        founderBeat("2026-09-20T12:00:00.000Z", "Moving forward with all three bands, size 6.25, all platinum, all lab."),
        vendorBeat("2026-09-20T16:00:00.000Z", "I'll update the size, place the order, and send the order confirmation."),
        founderBeat("2026-09-20T16:10:00.000Z", "Perfect:) Thank you!"),
      ],
      waitingState: "client",
    });
    assert.equal(reduced.ballHolder, "vendor_shop");
    assert.notEqual(reduced.ballHolder, "client");
  });

  it("undelivered CAD with a client waiting on the breakdown is founder review, not client wait", () => {
    const packet = composeTodayBriefingPacket({
      itemId: "nate-current",
      displayNameHint: "Nate",
      organizationLabel: "Vlora",
      communication: "vendor",
      projectName: "C026176",
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x Nate P. (Dagger Ring)-C026176",
      lifecycle: null,
      remainingFounderCommitment: null,
      waitingState: "client",
      noFounderAction: false,
      staleInboundSatisfied: false,
      evidence: [
        clientBeat("2026-09-21T14:00:00.000Z", "Looking forward to the CAD breakdown."),
        vendorBeat("2026-09-21T18:35:00.000Z", "Here is the C026176 Mod 1 CAD."),
        founderBeat("2026-09-21T18:37:00.000Z", "I'll order the chain separately. Let me know what you think."),
      ],
    });
    assert.equal(packet?.ballHolder, "founder");
    assert.equal(packet?.semanticNextActionClass, "founder_review");
    const briefing = renderDeterministicBriefing(packet!);
    assert.match(briefing.headline, /Mod 1 is in and Nate is waiting to see the CAD breakdown/i);
    assert.match(briefing.nextBody, /Review the CAD and send Nate the update/i);
    assert.doesNotMatch(briefing.nextBody, /Let me know what you think/i);
  });

  it("print/check is replaced by shipping after models are printed and a new address arrives", () => {
    const packet = composeTodayBriefingPacket({
      itemId: "abbey-current",
      displayNameHint: "Abbey",
      organizationLabel: null,
      communication: "client",
      projectName: "C026137",
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x Abbey-C026137",
      lifecycle: null,
      remainingFounderCommitment: {
        matchedText: "I'll print the model to check the huggie proportions before moving forward.",
        headline: "I'll print the model to check the huggie proportions before moving forward.",
        explanation: "I'll print the model to check the huggie proportions before moving forward.",
        recommended: "I'll print the model to check the huggie proportions before moving forward.",
      },
      waitingState: null,
      noFounderAction: false,
      staleInboundSatisfied: false,
      evidence: [
        vendorBeat("2026-09-15T18:00:00.000Z", "Here is the C026137 Mod 1 STL."),
        founderBeat(
          "2026-09-15T18:30:00.000Z",
          "I'll print the model to check the huggie proportions before moving forward.",
        ),
        founderBeat(
          "2026-09-21T15:00:00.000Z",
          "The models are already printed. Dry/cure next. I expect to mail them next day.",
        ),
        clientBeat("2026-09-21T18:00:00.000Z", "Please use this new shipping address: 123 Oak Street, Austin."),
      ],
    });
    assert.equal(packet?.ballHolder, "founder");
    assert.equal(packet?.semanticNextActionClass, "founder_communication");
    assert.notEqual(packet?.briefingKind, "founder_print_check");
    const briefing = renderDeterministicBriefing(packet!);
    assert.match(briefing.headline, /models are printed and ready to go/i);
    assert.match(briefing.nextBody, /Ship them using the updated address and send confirmation/i);
    assert.doesNotMatch(`${briefing.headline} ${briefing.nextBody} ${briefing.stand}`, /123 Oak|Austin/i);
  });

  it("project brief plus forthcoming CAD is watching shop with no recap owed", () => {
    const packet = composeTodayBriefingPacket({
      itemId: "duane-current",
      displayNameHint: "Duane",
      organizationLabel: "Vlora",
      communication: "vendor",
      projectName: "C026350",
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x Duane-C026350",
      lifecycle: null,
      remainingFounderCommitment: {
        matchedText: "Send the recap and next step.",
        headline: "Send the recap and next step.",
        explanation: "Send the recap and next step.",
        recommended: "Send the recap and next step.",
      },
      waitingState: null,
      noFounderAction: false,
      staleInboundSatisfied: false,
      evidence: [
        founderBeat("2026-09-21T12:00:00.000Z", "Here is the project brief for C026350."),
        vendorBeat("2026-09-21T15:00:00.000Z", "I'll send you cad C026350 as soon as it's available."),
      ],
    });
    assert.equal(packet?.ballHolder, "vendor_shop");
    assert.doesNotMatch(packet?.candidateNextAction ?? "", /recap/i);
  });
});

function briefItem(
  extra: Partial<CosBriefItem> & Pick<CosBriefItem, "id" | "personLabel" | "projectTitle" | "evidence">,
): CosBriefItem {
  return {
    rank: 1,
    rankClass: "client_reply",
    headline: extra.recommended ?? extra.headline ?? "Your turn",
    explanation: extra.explanation ?? "Latest turn.",
    recommended: extra.recommended ?? extra.headline ?? "Your turn",
    stateLabel: null,
    urgencyLabel: null,
    actions: [],
    openJobLabel: null,
    projectStateLabel: null,
    candidateIds: extra.candidateIds ?? [extra.id],
    proposedAction: null,
    specConflict: null,
    ...extra,
  };
}

function cardHay(
  docket: ReturnType<typeof composeTodayDocket>,
  needle: RegExp,
): string {
  const rows = [
    ...docket.items.map((item) => `${item.subject} ${item.headline} ${item.context ?? ""} ${item.briefing?.nextBody ?? ""} ${item.briefingPacket?.semanticNextActionClass ?? ""}`),
    ...docket.watching.map(
      (row) => `${row.title} ${row.detail} ${row.briefing?.nextBody ?? ""} ${row.briefingPacket?.semanticNextActionClass ?? ""}`,
    ),
  ].filter((row) => needle.test(row));
  return rows.join("\n");
}

describe("stale seed lock waits for supersession / currentness", () => {
  it("A old founder design-change plus newer Mod delivery is founder_review, not the old action", () => {
    const evidence = [
      founderBeat("2026-09-10T15:00:00.000Z", "Can we change the shank width to 1"),
      vendorBeat("2026-09-21T18:13:04.000Z", "Here is the C025610 Mod 4 CAD + STL."),
    ];
    const beforeLock = reduceWorkLoop({
      evidence,
      remaining: {
        matchedText: "Can we change the shank width to 1",
        headline: "Can we change the shank width to 1",
        explanation: "Can we change the shank width to 1",
        recommended: "Can we change the shank width to 1",
      },
      communication: "vendor",
    });
    assert.equal(beforeLock.semanticClass, "founder_review");
    assert.equal(beforeLock.ballHolder, "founder");
    const packet = composeTodayBriefingPacket({
      itemId: "dylon-a",
      displayNameHint: "Dylon",
      organizationLabel: "Vlora",
      communication: "vendor",
      projectName: "C025610",
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x Dylon D.-C025610",
      lifecycle: null,
      remainingFounderCommitment: {
        matchedText: "Can we change the shank width to 1",
        headline: "Can we change the shank width to 1",
        explanation: "Can we change the shank width to 1",
        recommended: "Can we change the shank width to 1",
      },
      waitingState: null,
      noFounderAction: false,
      staleInboundSatisfied: false,
      evidence,
      founderOwnTexts: ["Can we change the shank width to 1"],
      vendorOwnTexts: ["Here is the C025610 Mod 4 CAD + STL."],
    });
    assert.equal(packet?.authoritative, true);
    assert.equal(packet?.semanticNextActionClass, "founder_review");
    const briefing = renderDeterministicBriefing(packet!);
    assert.match(briefing.headline, /Mod 4 CAD and STL are in/i);
    assert.match(briefing.nextBody, /Review them and send approval/i);
    assert.doesNotMatch(`${briefing.headline} ${briefing.nextBody} ${packet?.unresolvedFounderObligation ?? ""}`, /shank/i);

    const dylonThread = "19fed961d1371aaf";
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "dylon-shank",
          sourceRef: `gc1|${dylonThread}|dylon-shank`,
          sourceTimestamp: "2026-09-10T15:00:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "Can we change the shank width to 1",
          },
          evidenceBasis: {
            ruleIds: ["explicit_design_refinement"],
            matchedText: "Can we change the shank width to 1",
          },
        }),
        gmailRow({
          candidateId: "1a0c52c12690a0f5",
          sourceRef: `gc1|${dylonThread}|1a0c52c12690a0f5`,
          sourceTimestamp: "2026-09-21T18:13:04.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Mod 4 CAD + STL",
            detail: "Here is the C025610 Mod 4 CAD + STL.",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_waiting"],
            matchedText: "Here is the C025610 Mod 4 CAD + STL.",
          },
        }),
      ],
      new Map([
        [
          dylonThread,
          {
            subject: "RE: HGD x Dylon D.-C025610",
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            messages: [
              {
                messageId: "dylon-shank",
                sentAt: "2026-09-10T15:00:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
              {
                messageId: "1a0c52c12690a0f5",
                sentAt: "2026-09-21T18:13:04.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
            ],
          },
        ],
      ]),
    );
    const hayA = cardHay(docket, /Dylon|C025610/i);
    assert.match(hayA, /founder_review|Mod 4/i);
    assert.doesNotMatch(hayA, /shank width/i);
  });

  it("B old founder design-change plus move-forward and workshop is vendor_shop", () => {
    const evidence = [
      founderBeat("2026-09-12T12:00:00.000Z", "Please soften the double-prong change."),
      founderBeat("2026-09-18T12:00:00.000Z", "Approved — moving forward. Finger size is 9.5. Stone sent."),
      vendorBeat(
        "2026-09-19T15:00:00.000Z",
        "The stone is going to the workshop via RN08318. Final CAD expected in approximately 10 business days.",
      ),
    ];
    const beforeLock = reduceWorkLoop({
      evidence,
      remaining: {
        matchedText: "Please soften the double-prong change.",
        headline: "Please soften the double-prong change.",
        explanation: "Please soften the double-prong change.",
        recommended: "Please soften the double-prong change.",
      },
      waitingState: "client",
    });
    assert.equal(beforeLock.ballHolder, "vendor_shop");
    assert.equal(beforeLock.semanticClass, "vendor_shop_wait");
    assert.equal(beforeLock.authoritative, true);
    const packet = composeTodayBriefingPacket({
      itemId: "tim-jenn-b",
      displayNameHint: "Tim",
      organizationLabel: "Vlora",
      communication: "vendor",
      projectName: "C025964",
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x Tim/Jenn-C025964",
      lifecycle: null,
      remainingFounderCommitment: {
        matchedText: "Please soften the double-prong change.",
        headline: "Please soften the double-prong change.",
        explanation: "Please soften the double-prong change.",
        recommended: "Please soften the double-prong change.",
      },
      waitingState: "client",
      noFounderAction: false,
      staleInboundSatisfied: false,
      evidence,
    });
    assert.equal(packet?.ballHolder, "vendor_shop");
    const briefing = renderDeterministicBriefing(packet!);
    assert.equal(briefing.stateChip, "WAITING ON SHOP");
    assert.doesNotMatch(`${briefing.headline} ${briefing.nextBody}`, /prong/i);

    const threadId = "1a0b18dcd27676a1";
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "tim-prong",
          sourceRef: `gc1|${threadId}|tim-prong`,
          sourceTimestamp: "2026-09-12T12:00:00.000Z",
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
          candidateId: "tim-forward",
          sourceRef: `gc1|${threadId}|tim-forward`,
          sourceTimestamp: "2026-09-18T12:00:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "production_instruction",
            value: "Approved — moving forward. Finger size is 9.5. Stone sent.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "Approved — moving forward. Finger size is 9.5. Stone sent.",
          },
        }),
        gmailRow({
          candidateId: "1a0b18dcd27676a1",
          sourceRef: `gc1|${threadId}|1a0b18dcd27676a1`,
          sourceTimestamp: "2026-09-19T15:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "commitment",
            subject: "Workshop / final CAD",
            detail:
              "The stone is going to the workshop via RN08318. Final CAD expected in approximately 10 business days.",
            waitingOnActor: "vendor",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_commitment"],
            matchedText:
              "The stone is going to the workshop via RN08318. Final CAD expected in approximately 10 business days.",
          },
        }),
      ],
      new Map([
        [
          threadId,
          {
            subject: "RE: HGD x Tim/Jenn-C025964",
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            messages: [
              {
                messageId: "tim-prong",
                sentAt: "2026-09-12T12:00:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
              {
                messageId: "tim-forward",
                sentAt: "2026-09-18T12:00:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
              {
                messageId: "1a0b18dcd27676a1",
                sentAt: "2026-09-19T15:00:00.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
            ],
          },
        ],
      ]),
    );
    const hayB = cardHay(docket, /Tim|Jenn|C025964/i);
    assert.match(hayB, /vendor_shop_wait|WAITING ON SHOP/i);
    assert.doesNotMatch(hayB, /prong-change|soften the double-prong/i);
    assert.equal(
      docket.items.filter((item) => /Tim|Jenn|C025964/i.test(`${item.subject} ${item.headline}`)).length,
      0,
    );
  });

  it("C founder print promise plus finished printing and a new address becomes shipping", () => {
    const evidence = [
      vendorBeat("2026-09-15T18:00:00.000Z", "Here is the C026137 Mod 1 STL."),
      founderBeat(
        "2026-09-15T18:30:00.000Z",
        "I'll print the model to check the huggie proportions before moving forward.",
      ),
      founderBeat(
        "2026-09-21T15:00:00.000Z",
        "The models are finished printing; dry/cure; expected mail next day.",
      ),
      clientBeat("2026-09-21T18:00:00.000Z", "Please use this updated shipping address: 123 Oak Street, Austin."),
    ];
    const beforeLock = reduceWorkLoop({
      evidence,
      remaining: {
        matchedText: "Lab Grown) would be 1 carat each of",
        headline: "Lab Grown) would be 1 carat each of",
        explanation: "Lab Grown) would be 1 carat each of",
        recommended: "Lab Grown) would be 1 carat each of",
      },
    });
    assert.equal(beforeLock.ballHolder, "founder");
    assert.notEqual(beforeLock.briefingKind, "founder_print_check");
    assert.equal(beforeLock.semanticClass, "founder_communication");
    const packet = composeTodayBriefingPacket({
      itemId: "abbey-c",
      displayNameHint: "Abbey",
      organizationLabel: null,
      communication: "client",
      projectName: "C026137",
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x Abbey-C026137",
      lifecycle: null,
      remainingFounderCommitment: {
        matchedText: "Lab Grown) would be 1 carat each of",
        headline: "Lab Grown) would be 1 carat each of",
        explanation: "Lab Grown) would be 1 carat each of",
        recommended: "Lab Grown) would be 1 carat each of",
      },
      waitingState: null,
      noFounderAction: false,
      staleInboundSatisfied: false,
      evidence,
    });
    assert.equal(packet?.authoritative, true);
    assert.equal(packet?.semanticNextActionClass, "founder_communication");
    const briefing = renderDeterministicBriefing(packet!);
    assert.match(briefing.headline, /models are printed and ready to go/i);
    assert.match(briefing.nextBody, /Ship them using the updated address and send confirmation/i);
    assert.doesNotMatch(`${briefing.headline} ${briefing.nextBody}`, /Lab Grown|1 carat each|print the model to check/i);

    const vendorThread = "1a08760c6837bb32";
    const clientThread = "1a0c63dae07e07f9";
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "abbey-spec",
          sourceRef: `gc1|${clientThread}|abbey-spec`,
          sourceTimestamp: "2026-09-10T12:00:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "Lab Grown) would be 1 carat each of",
          },
          evidenceBasis: {
            ruleIds: ["explicit_design_refinement"],
            matchedText: "Lab Grown) would be 1 carat each of",
          },
        }),
        gmailRow({
          candidateId: "abbey-print",
          sourceRef: `gc1|${clientThread}|abbey-print`,
          sourceTimestamp: "2026-09-17T19:20:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "I'll print the model to check the huggie proportions before moving forward.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "I'll print the model to check the huggie proportions before moving forward.",
          },
        }),
        gmailRow({
          candidateId: "1a0c5dc99d6a59e2",
          sourceRef: `gc1|${clientThread}|1a0c5dc99d6a59e2`,
          sourceTimestamp: "2026-09-21T15:00:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "The models are finished printing; dry/cure; expected mail next day.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "The models are finished printing; dry/cure; expected mail next day.",
          },
        }),
        gmailRow({
          candidateId: "1a0c63dae07e07f9",
          sourceRef: `gc1|${clientThread}|1a0c63dae07e07f9`,
          sourceTimestamp: "2026-09-21T18:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "updated shipping address",
            detail: "Please use this updated shipping address: 123 Oak Street, Austin.",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request"],
            matchedText: "Please use this updated shipping address: 123 Oak Street, Austin.",
          },
        }),
        gmailRow({
          candidateId: "abbey-stl",
          sourceRef: `gc1|${vendorThread}|abbey-stl`,
          sourceTimestamp: "2026-09-17T19:08:23.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Mod 1 STL attached",
            detail: "Here is the C026137 Mod 1 STL.",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_waiting"],
            matchedText: "Here is the C026137 Mod 1 STL.",
          },
        }),
      ],
      new Map([
        [
          vendorThread,
          {
            subject: "RE: HGD x Abbey-C026137",
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            messages: [
              {
                messageId: "abbey-stl",
                sentAt: "2026-09-17T19:08:23.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
            ],
          },
        ],
        [
          clientThread,
          {
            subject: "RE: HGD x Abbey-C026137",
            fromDisplayName: "Abbey",
            fromEmail: "abbey@example.test",
            messages: [
              {
                messageId: "abbey-spec",
                sentAt: "2026-09-10T12:00:00.000Z",
                direction: "inbound",
              },
              {
                messageId: "abbey-print",
                sentAt: "2026-09-17T19:20:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
              {
                messageId: "1a0c5dc99d6a59e2",
                sentAt: "2026-09-21T15:00:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
              {
                messageId: "1a0c63dae07e07f9",
                sentAt: "2026-09-21T18:00:00.000Z",
                direction: "inbound",
              },
            ],
          },
        ],
      ]),
    );
    const hayC = cardHay(docket, /Abbey|C026137/i);
    assert.match(hayC, /Ship them using the updated address|printed and ready/i);
    assert.doesNotMatch(hayC, /Lab Grown\) would be 1 carat each of|print the model to check the huggie/i);
  });

  it("D vendor blocking reference ask after a CAD promise makes founder the current ball-holder", () => {
    const evidence = [
      clientBeat("2026-09-21T12:00:00.000Z", "When is the CAD expected?"),
      founderBeat("2026-09-21T12:30:00.000Z", "I'm checking with the team and will let you know."),
      vendorBeat(
        "2026-09-21T16:00:00.000Z",
        "Could you send a higher-resolution prong reference so I can continue the CAD?",
      ),
      founderBeat(
        "2026-09-21T16:20:00.000Z",
        "Let me see if I can sleuth it... I'll report back if I can find it later today.",
      ),
    ];
    const beforeLock = reduceWorkLoop({
      evidence,
      waitingState: "cad",
      communication: "client",
    });
    assert.equal(beforeLock.ballHolder, "founder");
    assert.notEqual(beforeLock.ballHolder, "client");
    assert.notEqual(beforeLock.ballHolder, "vendor_shop");
    const packet = composeTodayBriefingPacket({
      itemId: "sarah-d",
      displayNameHint: "Sarah",
      organizationLabel: "Vlora",
      communication: "vendor",
      projectName: "C026143",
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x Sarah-C026143",
      lifecycle: null,
      remainingFounderCommitment: null,
      waitingState: "cad",
      noFounderAction: false,
      staleInboundSatisfied: false,
      evidence,
    });
    assert.equal(packet?.ballHolder, "founder");
    assert.notEqual(packet?.briefingKind, "client_wait");
    assert.notEqual(packet?.briefingKind, "vendor_cad_wait");
    const briefing = renderDeterministicBriefing(packet!);
    assert.equal(briefing.stateChip, "YOUR MOVE");
    assert.match(`${briefing.headline} ${briefing.nextBody} ${packet?.unresolvedFounderObligation ?? ""}`, /prong|reference/i);

    const clientThread = "1b026143client01";
    const vendorThread = "1b026143vendor01";
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "sarah-when",
          sourceRef: `gc1|${clientThread}|sarah-when`,
          sourceTimestamp: "2026-09-21T12:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "when CAD",
            detail: "When is the CAD expected?",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request"],
            matchedText: "When is the CAD expected?",
          },
        }),
        gmailRow({
          candidateId: "sarah-checking",
          sourceRef: `gc1|${clientThread}|sarah-checking`,
          sourceTimestamp: "2026-09-21T12:30:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "client_update",
            value: "I'm checking with the team and will let you know.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "I'm checking with the team and will let you know.",
          },
        }),
        gmailRow({
          candidateId: "1a0c97a05a456939",
          sourceRef: `gc1|${vendorThread}|1a0c97a05a456939`,
          sourceTimestamp: "2026-09-21T16:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "higher-resolution prong reference",
            detail: "Could you send a higher-resolution prong reference so I can continue the CAD?",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_waiting"],
            matchedText: "Could you send a higher-resolution prong reference so I can continue the CAD?",
          },
        }),
        gmailRow({
          candidateId: "1a0c98c3d485f534",
          sourceRef: `gc1|${vendorThread}|1a0c98c3d485f534`,
          sourceTimestamp: "2026-09-21T16:20:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "Let me see if I can sleuth it... I'll report back if I can find it later today.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "Let me see if I can sleuth it... I'll report back if I can find it later today.",
          },
        }),
      ],
      new Map([
        [
          clientThread,
          {
            subject: "RE: HGD x Sarah-C026143",
            fromDisplayName: "Sarah",
            fromEmail: "sarah@example.test",
            messages: [
              { messageId: "sarah-when", sentAt: "2026-09-21T12:00:00.000Z", direction: "inbound" },
              {
                messageId: "sarah-checking",
                sentAt: "2026-09-21T12:30:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
            ],
          },
        ],
        [
          vendorThread,
          {
            subject: "RE: HGD x Sarah-C026143",
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            messages: [
              {
                messageId: "1a0c97a05a456939",
                sentAt: "2026-09-21T16:00:00.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
              {
                messageId: "1a0c98c3d485f534",
                sentAt: "2026-09-21T16:20:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
            ],
          },
        ],
      ]),
    );
    const hayD = cardHay(docket, /Sarah|C026143/i);
    assert.match(hayD, /founder_communication|YOUR MOVE|prong|reference/i);
    assert.doesNotMatch(hayD, /WAITING ON CLIENT|Sarah has the next turn/i);
  });

  it("E vendor order-confirmation promise plus founder acknowledgement stays vendor_shop", () => {
    const evidence = [
      founderBeat("2026-09-20T12:00:00.000Z", "Moving forward with all three bands, size 6.25, all platinum, all lab."),
      vendorBeat("2026-09-20T16:00:00.000Z", "I'll update the size, place the order, and send the order confirmation."),
      founderBeat("2026-09-20T16:10:00.000Z", "Perfect:) Thank you!"),
    ];
    const beforeLock = reduceWorkLoop({
      evidence,
      waitingState: "client",
      communication: "vendor",
    });
    assert.equal(beforeLock.ballHolder, "vendor_shop");
    assert.equal(beforeLock.authoritative, true);
    const packet = composeTodayBriefingPacket({
      itemId: "grant-e",
      displayNameHint: "F. Grant",
      organizationLabel: "Vlora",
      communication: "vendor",
      projectName: "C025885",
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x F. Grant-C025885",
      lifecycle: null,
      remainingFounderCommitment: null,
      waitingState: "client",
      noFounderAction: false,
      staleInboundSatisfied: true,
      evidence,
    });
    assert.equal(packet?.ballHolder, "vendor_shop");
    assert.equal(renderDeterministicBriefing(packet!).stateChip, "WAITING ON SHOP");

    const threadId = "1a03a300vendor001";
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "grant-forward",
          sourceRef: `gc1|${threadId}|grant-forward`,
          sourceTimestamp: "2026-09-20T12:00:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "production_instruction",
            value: "Moving forward with all three bands, size 6.25, all platinum, all lab.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "Moving forward with all three bands, size 6.25, all platinum, all lab.",
          },
        }),
        gmailRow({
          candidateId: "1a0c5b1d1a91ebcf",
          sourceRef: `gc1|${threadId}|1a0c5b1d1a91ebcf`,
          sourceTimestamp: "2026-09-20T16:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "commitment",
            subject: "order confirmation",
            detail: "I'll update the size, place the order, and send the order confirmation.",
            waitingOnActor: "vendor",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_commitment"],
            matchedText: "I'll update the size, place the order, and send the order confirmation.",
          },
        }),
        gmailRow({
          candidateId: "1a0c5b8416992cbf",
          sourceRef: `gc1|${threadId}|1a0c5b8416992cbf`,
          sourceTimestamp: "2026-09-20T16:10:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "client_update",
            value: "Perfect:) Thank you!",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "Perfect:) Thank you!",
          },
        }),
      ],
      new Map([
        [
          threadId,
          {
            subject: "RE: HGD x F. Grant-C025885",
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            messages: [
              {
                messageId: "grant-forward",
                sentAt: "2026-09-20T12:00:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
              {
                messageId: "1a0c5b1d1a91ebcf",
                sentAt: "2026-09-20T16:00:00.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
              {
                messageId: "1a0c5b8416992cbf",
                sentAt: "2026-09-20T16:10:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
            ],
          },
        ],
      ]),
    );
    const hayE = cardHay(docket, /Grant|C025885/i);
    assert.match(hayE, /vendor_shop_wait|WAITING ON SHOP/i);
    assert.doesNotMatch(hayE, /WAITING ON CLIENT|Grant has the next turn/i);
  });

  it("F client CAD wait plus vendor Mod 1 plus an unrelated founder reply stays founder_review", () => {
    const evidence = [
      clientBeat("2026-09-21T14:00:00.000Z", "Looking forward to seeing the CAD breakdown."),
      vendorBeat("2026-09-21T18:35:00.000Z", "Here is the C026176 Mod 1 CAD."),
      founderBeat("2026-09-21T18:37:00.000Z", "The chain question is separate — I'll order it on my side."),
    ];
    const beforeLock = reduceWorkLoop({
      evidence,
      waitingState: "client",
    });
    assert.equal(beforeLock.ballHolder, "founder");
    assert.equal(beforeLock.semanticClass, "founder_review");
    const packet = composeTodayBriefingPacket({
      itemId: "nathan-f",
      displayNameHint: "Nate",
      organizationLabel: "Vlora",
      communication: "vendor",
      projectName: "C026176",
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x Nate P. (Dagger Ring)-C026176",
      lifecycle: null,
      remainingFounderCommitment: null,
      waitingState: "client",
      noFounderAction: false,
      staleInboundSatisfied: false,
      evidence,
    });
    assert.equal(packet?.semanticNextActionClass, "founder_review");
    const briefing = renderDeterministicBriefing(packet!);
    assert.match(briefing.headline, /Mod 1 is in and Nate is waiting to see the CAD breakdown/i);
    assert.match(briefing.nextBody, /Review the CAD and send Nate the update/i);
    assert.doesNotMatch(briefing.nextBody, /chain question|order it on my side/i);

    const threadId = "1a09120d797337d9";
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "1a0c52a779c5fb66",
          sourceRef: `gc1|${threadId}|1a0c52a779c5fb66`,
          sourceTimestamp: "2026-09-21T14:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "CAD breakdown",
            detail: "Looking forward to seeing the CAD breakdown.",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request"],
            matchedText: "Looking forward to seeing the CAD breakdown.",
          },
        }),
        gmailRow({
          candidateId: "1a0c540f4e1e0582",
          sourceRef: `gc1|${threadId}|1a0c540f4e1e0582`,
          sourceTimestamp: "2026-09-21T18:35:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Mod 1 CAD",
            detail: "Here is the C026176 Mod 1 CAD.",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_waiting"],
            matchedText: "Here is the C026176 Mod 1 CAD.",
          },
        }),
        gmailRow({
          candidateId: "1a0c542e08ea05e5",
          sourceRef: `gc1|${threadId}|1a0c542e08ea05e5`,
          sourceTimestamp: "2026-09-21T18:37:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "client_update",
            value: "The chain question is separate — I'll order it on my side.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "The chain question is separate — I'll order it on my side.",
          },
        }),
      ],
      new Map([
        [
          threadId,
          {
            subject: "RE: HGD x Nate P. (Dagger Ring)-C026176",
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            messages: [
              { messageId: "1a0c52a779c5fb66", sentAt: "2026-09-21T14:00:00.000Z", direction: "inbound" },
              {
                messageId: "1a0c540f4e1e0582",
                sentAt: "2026-09-21T18:35:00.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
              {
                messageId: "1a0c542e08ea05e5",
                sentAt: "2026-09-21T18:37:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
            ],
          },
        ],
      ]),
    );
    const hayF = cardHay(docket, /Nate|Nathan|C026176/i);
    assert.match(hayF, /founder_review|Mod 1/i);
    assert.doesNotMatch(hayF, /WAITING ON CLIENT|Nate has the next turn/i);
  });

  it("G authoritative lock is assigned only after supersession has resolved current work", () => {
    const staleEvidence = [founderBeat("2026-09-10T15:00:00.000Z", "Can we change the shank width to 1")];
    const staleReduced = reduceWorkLoop({
      evidence: staleEvidence,
      remaining: {
        matchedText: "Can we change the shank width to 1",
        headline: "Can we change the shank width to 1",
        explanation: "Can we change the shank width to 1",
        recommended: "Can we change the shank width to 1",
      },
    });
    const stalePacket = composeTodayBriefingPacket({
      itemId: "dylon-lock-order",
      displayNameHint: "Dylon",
      organizationLabel: "Vlora",
      communication: "vendor",
      projectName: "C025610",
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x Dylon D.-C025610",
      lifecycle: null,
      remainingFounderCommitment: {
        matchedText: "Can we change the shank width to 1",
        headline: "Can we change the shank width to 1",
        explanation: "Can we change the shank width to 1",
        recommended: "Can we change the shank width to 1",
      },
      waitingState: null,
      noFounderAction: false,
      staleInboundSatisfied: false,
      evidence: staleEvidence,
    });
    assert.equal(staleReduced.authoritative, true);
    assert.equal(stalePacket?.authoritative, true);
    assert.notEqual(stalePacket?.semanticNextActionClass, "founder_review");

    const combined = [
      ...staleEvidence,
      vendorBeat("2026-09-21T18:13:04.000Z", "Here is the C025610 Mod 4 CAD + STL."),
    ];
    const currentReduced = reduceWorkLoop({
      evidence: combined,
      remaining: {
        matchedText: "Can we change the shank width to 1",
        headline: "Can we change the shank width to 1",
        explanation: "Can we change the shank width to 1",
        recommended: "Can we change the shank width to 1",
      },
      communication: "vendor",
    });
    assert.equal(currentReduced.semanticClass, "founder_review");
    assert.equal(currentReduced.authoritative, true);

    const recomposed = equivalentPacketFromBrief(
      briefItem({
        id: "dylon-lock-order",
        personLabel: "Dylon",
        projectTitle: "C025610",
        headline: "Can we change the shank width to 1",
        recommended: "Can we change the shank width to 1",
        explanation: "Can we change the shank width to 1",
        evidence: combined,
        briefingPacket: stalePacket,
        sourceClass: "vendor",
      }),
    );
    assert.equal(recomposed?.authoritative, true);
    assert.equal(recomposed?.semanticNextActionClass, "founder_review");
    assert.equal(recomposed?.ballHolder, "founder");
    const briefing = renderDeterministicBriefing(recomposed!);
    assert.match(briefing.headline, /Mod 4 CAD and STL are in/i);
    assert.doesNotMatch(`${briefing.headline} ${briefing.nextBody} ${recomposed?.unresolvedFounderObligation ?? ""}`, /shank/i);
  });
});
