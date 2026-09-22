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
