import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { GMAIL_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/gmail/types";
import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { proposeGmailCandidates } from "@/lib/continuum/gmail/candidates/propose";
import {
  isQuotedHistoricalCandidate,
  QUOTED_HISTORICAL_EVIDENCE_RULE,
  splitOwnAndQuotedText,
} from "@/lib/continuum/gmail/candidates/spec-provenance";
import type {
  GmailCandidateEvidence,
  GmailCandidateProject,
  GmailCandidateWorld,
} from "@/lib/continuum/gmail/candidates/types";
import { composeTodayBriefingPacket } from "./briefing-packet";
import { renderDeterministicBriefing } from "./briefing-copy";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket } from "./docket";
import { eventsFromInput, reduceWorkLoop } from "./work-loop-state";
import type { CosProjectContext } from "./types";

const NOW = "2026-09-21T22:00:00.000Z";
const FOUNDER_HASH = hashEmail("justin@hourglassdiamonds.com")!;
const SARAH_THREAD = "1a0881b53067a9e6";
const SARAH_MSG = "1a0c97a05a456939";
const DYLON_THREAD = "1a0c52c12690a0f5";

function indexed(input: {
  messageId: string;
  threadId: string;
  sentAt: string;
  direction?: GmailIndexedMessage["direction"];
  subject?: string;
  fromEmail?: string;
}): GmailIndexedMessage {
  return {
    messageId: input.messageId,
    threadId: input.threadId,
    sentAt: input.sentAt,
    indexedAt: NOW,
    subject: input.subject ?? null,
    fromEmailHash: hashEmail(input.fromEmail ?? "justin@hourglassdiamonds.com"),
    toEmailHashes: [],
    ccEmailHashes: [],
    bccEmailHashes: [],
    direction: input.direction ?? "outbound",
    labelIds: (input.direction ?? "outbound") === "outbound" ? ["SENT"] : ["INBOX"],
    hasAttachments: false,
    sourceSystem: GMAIL_SOURCE_SYSTEM,
  };
}

function evidence(
  input: Parameters<typeof indexed>[0] & { plaintext?: string },
): GmailCandidateEvidence {
  const row = indexed(input);
  return {
    indexed: row,
    plaintext: input.plaintext ?? null,
    fromEmailHash: row.fromEmailHash,
    attachments: [],
  };
}

function project(input: {
  projectId: string;
  title: string;
  thread: string;
  cad: string;
}): GmailCandidateProject {
  return {
    projectId: input.projectId,
    title: input.title,
    gmailThreadId: input.thread,
    cadJobNumber: input.cad,
    orderNumber: null,
    fingerSize: null,
    metal: null,
    centerStone: null,
    diamondSupplyNotes: null,
    personIds: [],
    founderApprovedCurrent: true,
  };
}

function world(projects: GmailCandidateProject[]): GmailCandidateWorld {
  return {
    people: [],
    projects,
    internalEmailHashes: [FOUNDER_HASH],
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

function todayOf(candidates: ContinuumCandidate[], projects?: Map<string, CosProjectContext>) {
  const loop = composeCosOperatingLoop({
    jobs: [],
    candidates,
    projects: projects ?? new Map(),
    nowIso: NOW,
    knownPeople: [
      {
        personId: "founder-justin",
        displayName: "Justin Smith",
        roles: ["owner"],
        organizationName: "Hourglass Diamonds",
        emailHash: FOUNDER_HASH,
      },
    ],
  });
  return { loop, docket: composeTodayDocket(loop) };
}

function docketHay(docket: ReturnType<typeof composeTodayDocket>): string {
  return [
    ...docket.items.map((item) => `${item.subject} ${item.headline} ${item.context ?? ""}`),
    ...docket.watching.map((row) => `${row.title} ${row.detail}`),
  ].join("\n");
}

describe("quoted historical content cannot become current action", () => {
  it("wrapper timestamp does not make quoted finger size / supply / dates current harvest", () => {
    const quotedHistory = [
      "On Tue, Sep 1, 2026 at 2:14 PM Sarah Smith <sarah@client.test>",
      "wrote:",
      "Finger size is 6.5",
      "Customer center diamond supply confirmed.",
      "Let's plan for September 12.",
      "Previously we made engagement (C021479-RN07247) for her.",
    ].join("\n");
    const plaintext = [
      "I'll look for a higher-resolution prong reference or give Niurka a fallback.",
      "",
      quotedHistory,
    ].join("\n");
    const split = splitOwnAndQuotedText(plaintext);
    assert.match(split.own, /higher-resolution prong reference/);
    assert.doesNotMatch(split.own, /Finger size is 6\.5/);
    assert.doesNotMatch(split.own, /September 12/);
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world([
        project({
          projectId: "sarah-c026143",
          title: "Sarah",
          thread: SARAH_THREAD,
          cad: "C026143",
        }),
      ]),
      evidence: [
        evidence({
          messageId: SARAH_MSG,
          threadId: SARAH_THREAD,
          sentAt: "2026-09-21T16:20:00.000Z",
          direction: "outbound",
          fromEmail: "justin@hourglassdiamonds.com",
          subject: "RE: HGD x Sarah-C026143",
          plaintext,
        }),
      ],
    });
    const currentSpecs = proposed.candidates.filter((row) => row.candidateType === "structured_spec");
    assert.equal(
      currentSpecs.some(
        (row) => row.payload.kind === "structured_spec" && row.payload.fieldName === "finger_size",
      ),
      false,
    );
    assert.equal(
      currentSpecs.some(
        (row) =>
          row.payload.kind === "structured_spec" && row.payload.fieldName === "diamond_supply_notes",
      ),
      false,
    );
    assert.equal(
      proposed.candidates.some((row) => row.candidateType === "date"),
      false,
    );
    const historical = proposed.candidates.filter(isQuotedHistoricalCandidate);
    assert.ok(historical.length >= 1);
    assert.ok(
      historical.every(
        (row) =>
          row.evidenceBasis.ruleIds.includes(QUOTED_HISTORICAL_EVIDENCE_RULE) ||
          row.evidenceBasis.ruleIds.includes("historical_quoted_identifier") ||
          (row.payload.kind === "project_context" && row.payload.topic.startsWith("historical_")),
      ),
    );
    const { docket } = todayOf(proposed.candidates);
    const hay = docketHay(docket);
    assert.doesNotMatch(hay, /finger size 6\.5/i);
    assert.doesNotMatch(hay, /September 12/);
    assert.doesNotMatch(hay, /C021479 is current/i);
  });

  it("quoted shank / prong instructions do not reopen founder action from a newer wrapper", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world([
        project({
          projectId: "dylon-c025610",
          title: "Dylon",
          thread: DYLON_THREAD,
          cad: "C025610",
        }),
      ]),
      evidence: [
        evidence({
          messageId: "1a0c52c12690a0f5",
          threadId: DYLON_THREAD,
          sentAt: "2026-09-21T18:13:04.000Z",
          direction: "inbound",
          fromEmail: "niurka@vlorajewelry.com",
          subject: "RE: HGD x Dylon-C025610",
          plaintext: [
            "Here is the C025610 Mod 4 CAD + STL.",
            "",
            "On Sep 10 Justin wrote:",
            "> Can we change the shank width to 1",
          ].join("\n"),
        }),
      ],
    });
    assert.equal(
      proposed.candidates.some(
        (row) =>
          row.candidateType === "open_job" &&
          /shank/i.test(row.evidenceBasis.matchedText ?? ""),
      ),
      false,
    );
    const { docket } = todayOf(proposed.candidates);
    assert.doesNotMatch(docketHay(docket), /shank width/i);
  });

  it("quoted inbound ask cannot become current via wrapper timestamp in the reducer", () => {
    const quoted = "Can we change the shank width to 1";
    const own = "Here is the C025610 Mod 4 CAD + STL.";
    const events = eventsFromInput({
      evidence: [
        founderBeat("2026-09-10T15:00:00.000Z", quoted),
        vendorBeat("2026-09-21T18:13:04.000Z", own),
      ],
      founderOwnTexts: [],
      vendorOwnTexts: [own],
      quotedTexts: [`> ${quoted}`],
    });
    assert.equal(
      events.some((row) => /shank/i.test(row.text) && row.sortMs >= Date.parse("2026-09-21T18:13:04.000Z")),
      false,
    );
    const reduced = reduceWorkLoop({
      evidence: [
        founderBeat("2026-09-10T15:00:00.000Z", quoted),
        vendorBeat("2026-09-21T18:13:04.000Z", own),
      ],
      vendorOwnTexts: [own],
      quotedTexts: [`> ${quoted}`],
      communication: "vendor",
    });
    assert.equal(reduced.ballHolder, "founder");
    assert.equal(reduced.semanticClass, "founder_review");
    const packet = composeTodayBriefingPacket({
      itemId: "dylon-quoted",
      displayNameHint: "Dylon",
      organizationLabel: "Vlora",
      communication: "vendor",
      projectName: "C025610",
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x Dylon-C025610",
      lifecycle: null,
      remainingFounderCommitment: {
        matchedText: quoted,
        headline: quoted,
        explanation: quoted,
        recommended: quoted,
      },
      waitingState: null,
      evidence: [
        founderBeat("2026-09-10T15:00:00.000Z", quoted),
        vendorBeat("2026-09-21T18:13:04.000Z", own),
      ],
      founderOwnTexts: [],
      vendorOwnTexts: [own],
      quotedTexts: [`> ${quoted}`],
    });
    assert.equal(packet?.ballHolder, "founder");
    const briefing = renderDeterministicBriefing(packet!);
    assert.doesNotMatch(`${briefing.headline} ${briefing.nextBody}`, /shank/i);
  });
});
