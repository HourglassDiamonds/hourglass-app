import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import { ChiefOfStaffToday } from "../../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import { composeTodayBriefingPacket } from "./briefing-packet";
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

  it("Jesse 115 vs lab-grown diamond supply remains a founder Up Next decision", () => {
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
    const jesse = docket.items.find((item) => /Jesse/i.test(`${item.subject} ${item.headline}`));
    assert.ok(jesse, hay(docket));
    assert.ok(jesse.brief?.specConflict);
    assert.match(
      `${jesse.headline} ${jesse.brief?.specConflict?.canonicalValue ?? ""} ${jesse.brief?.specConflict?.proposedValue ?? ""}`,
      /115|lab-grown|diamond supply/i,
    );
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
