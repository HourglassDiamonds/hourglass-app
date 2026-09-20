import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import {
  collapseTodayCandidateGroups,
  groupingKey,
  gmailThreadByMessageId,
  isMeaningfulTodayActionText,
  isNoiseOnlyCandidateText,
  type TodayGmailThreadContext,
} from "@/lib/continuum/candidates/founder-attention";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket } from "./docket";
import { selectFounderControls } from "./founder-actions";
import { fixtureCandidate } from "./fixtures";
import { resolveTodayGroupTruth } from "./group-truth";

const NOW = "2026-09-17T16:00:00.000Z";
const JEN_THREAD = "19fc9f4c3d36dbed";
const JEN_IN = "jen-in-19fc9f4c3d36dbed";
const JEN_OUT = "jen-out-19fc9f4c3d36dbed";
const UNKNOWN_THREAD = "19ffunknownhuman01";
const UNKNOWN_MSG = "unknown-human-msg-01";
const VLORA_THREAD = "1a0a0e97f4da2223";
const VLORA_MSG = "1a0a1f153add83b4";
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
  options?: {
    threadContext?: Map<string, TodayGmailThreadContext>;
    vendorDirectory?: readonly string[];
    knownPeople?: Parameters<typeof composeCosOperatingLoop>[0]["knownPeople"];
  },
) {
  const loop = composeCosOperatingLoop({
    jobs: [],
    candidates,
    projects: new Map(),
    nowIso: NOW,
    threadContext: options?.threadContext,
    vendorDirectory: options?.vendorDirectory,
    knownPeople: options?.knownPeople,
  });
  return { loop, docket: composeTodayDocket(loop) };
}

function jenThread(): TodayGmailThreadContext {
  return {
    subject: "Re: Cornflower Blue - Yogo Sapphire - Lee",
    fromDisplayName: "Jen Spiegel",
    fromEmail: "jen.spiegel@example.test",
    messages: [
      { messageId: JEN_IN, sentAt: "2026-09-15T16:00:00.000Z", direction: "inbound" },
      { messageId: JEN_OUT, sentAt: "2026-09-16T18:30:00.000Z", direction: "outbound" },
    ],
  };
}

describe("Today actionability text boundary", () => {
  it("fails noise-only filenames, dates, signatures, and spec nouns", () => {
    for (const text of [
      "image001.jpg",
      "image.png",
      "unnamed.jpg",
      "September 16, 2026",
      "2 Marquise",
      "Employee photo",
      "Best Regards",
      "704-555-0199",
      "Manage preferences",
    ]) {
      assert.equal(isNoiseOnlyCandidateText(text), true, text);
      assert.equal(isMeaningfulTodayActionText(text), false, text);
    }
  });

  it("passes current founder obligations", () => {
    for (const text of [
      "Send Nate chain options and pricing",
      "Review the updated CAD",
      "Reply to Sarah's sizing question",
      "Pick up the package at reception",
    ]) {
      assert.equal(isMeaningfulTodayActionText(text), true, text);
      assert.equal(isNoiseOnlyCandidateText(text), false, text);
    }
  });
});

describe("Today actionability gate", () => {
  it("IMAGE FILENAME: candidate text=image001.jpg is not a Today item", () => {
    const candidates = [
      gmailRow({
        candidateId: "img-assoc",
        sourceRef: "gc1||img-msg-1",
        sourceTimestamp: "2026-09-16T12:00:00.000Z",
        candidateType: "person_association",
        payload: {
          kind: "person_association",
          displayName: null,
          emailHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          mintPerson: false,
          mergePersons: false,
        },
        evidenceBasis: {
          ruleIds: ["unresolved_email_hash"],
          matchedText: null,
        },
      }),
      gmailRow({
        candidateId: "img-file",
        sourceRef: "gc1||img-msg-1",
        sourceTimestamp: "2026-09-16T12:00:00.000Z",
        candidateType: "project_context",
        confidence: "high",
        payload: {
          kind: "project_context",
          topic: "attachment_filename",
          value: "image001.jpg",
        },
        evidenceBasis: {
          ruleIds: ["attachment_filename_only"],
          matchedText: "image001.jpg",
        },
      }),
    ];
    const { docket, loop } = todayOf(candidates);
    assert.equal(
      docket.items.some((item) => /image001\.jpg/i.test(`${item.headline} ${item.context ?? ""}`)),
      false,
    );
    assert.equal(
      docket.items.some((item) => /Identify who this is from/i.test(item.headline)),
      false,
    );
    assert.equal(
      docket.items.some((item) => selectFounderControls(item).confirmPerson != null),
      false,
    );
    assert.equal(loop.brief.length, 0);
  });

  it("NAKED DATE: candidate text=September 16, 2026 is not a Today item", () => {
    const candidates = [
      gmailRow({
        candidateId: "date-only",
        sourceRef: "gc1||date-msg-1",
        sourceTimestamp: "2026-09-16T18:00:00.000Z",
        candidateType: "date",
        confidence: "high",
        payload: {
          kind: "date",
          raw: "September 16, 2026",
          isoDate: "2026-09-16",
          precision: "day",
          role: "mentioned",
          sourceTimestamp: "2026-09-16T18:00:00.000Z",
          resolutionCalendar: "source-timestamp-utc-date",
        },
        evidenceBasis: {
          ruleIds: ["explicit_named_date", "source_timestamp_year"],
          matchedText: "September 16, 2026",
        },
      }),
    ];
    const { docket, loop } = todayOf(candidates);
    assert.equal(
      docket.items.some((item) => /September 16, 2026/i.test(`${item.headline} ${item.context ?? ""}`)),
      false,
    );
    assert.equal(
      docket.items.some((item) => /Identify who this is from/i.test(item.headline)),
      false,
    );
    assert.equal(loop.brief.length, 0);
  });

  it("JEN: historical siblings collapse to one waiting-on-client group, not Up next", () => {
    const inboundText =
      "I like the rounded prongs more than the claw, but I think that I may like a rounded claw best for this design. Could we try that?";
    const candidates = [
      gmailRow({
        candidateId: "jen-assoc",
        sourceRef: `gc1||${JEN_IN}`,
        sourceTimestamp: "2026-09-15T16:00:00.000Z",
        candidateType: "person_association",
        payload: {
          kind: "person_association",
          displayName: "Jen Spiegel",
          emailHash: null,
          mintPerson: false,
          mergePersons: false,
        },
        evidenceBasis: {
          ruleIds: ["gmail_participant"],
          matchedText: "Jen Spiegel",
        },
      }),
      gmailRow({
        candidateId: "jen-claw",
        sourceRef: `gc1||${JEN_IN}`,
        sourceTimestamp: "2026-09-15T16:00:00.000Z",
        candidateType: "project_context",
        payload: {
          kind: "project_context",
          topic: "design_refinement",
          value: inboundText,
        },
        evidenceBasis: {
          ruleIds: ["explicit_design_refinement", "explicit_client_request"],
          matchedText: inboundText,
        },
      }),
      gmailRow({
        candidateId: "jen-older",
        sourceRef: `gc1||${JEN_IN}`,
        sourceTimestamp: "2026-09-14T16:00:00.000Z",
        candidateType: "project_context",
        payload: {
          kind: "project_context",
          topic: "design_refinement",
          value: "Could we also try a split shank?",
        },
        evidenceBasis: {
          ruleIds: ["explicit_design_refinement"],
          matchedText: "Could we also try a split shank?",
        },
      }),
    ];
    const threadContext = new Map([[JEN_THREAD, jenThread()]]);
    const threadByMessageId = gmailThreadByMessageId(threadContext);
    const groups = new Map<string, ContinuumCandidate[]>();
    for (const row of candidates) {
      const key = groupingKey(row, undefined, threadByMessageId);
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }
    const collapsed = collapseTodayCandidateGroups(groups, threadByMessageId);
    assert.equal(collapsed.size, 1);
    const key = [...collapsed.keys()][0]!;
    assert.equal(key, `thread:${JEN_THREAD}`);
    const truth = resolveTodayGroupTruth({
      key,
      rows: collapsed.get(key)!,
      threadContext,
    });
    assert.equal(truth.staleInboundSatisfied, true);
    assert.equal(truth.waitingState, "client");
    assert.equal(truth.noFounderAction, true);
    const { docket, loop } = todayOf(candidates, { threadContext });
    assert.equal(docket.items.some((item) => /Jen Spiegel/i.test(item.subject)), false);
    assert.equal(
      docket.items.some((item) => /recap|next step|Responded/i.test(`${item.headline} ${item.subject}`)),
      false,
    );
    assert.equal(
      docket.items.some((item) => selectFounderControls(item).actions.some((row) => row.verb === "responded")),
      false,
    );
    assert.ok(loop.watching.some((row) => /waiting on the client/i.test(row.detail)));
  });

  it("ORPHAN: unrecoverable Gmail + low-quality text is not a Today card", () => {
    const candidates = [
      gmailRow({
        candidateId: "orphan-noise",
        sourceRef: "gc1||",
        sourceTimestamp: "2026-09-16T12:00:00.000Z",
        candidateType: "project_context",
        confidence: "high",
        payload: {
          kind: "project_context",
          topic: "attachment_filename",
          value: "image001.jpg",
        },
        evidenceBasis: {
          ruleIds: ["attachment_filename_only"],
          matchedText: "image001.jpg",
        },
      }),
    ];
    const { docket, loop } = todayOf(candidates);
    assert.equal(docket.items.length, 0);
    assert.equal(loop.brief.length, 0);
    assert.equal(
      groupingKey(candidates[0]!),
      "candidate:orphan-noise",
    );
  });

  it("UNKNOWN HUMAN: recoverable external human + unanswered request keeps Confirm Person", () => {
    const candidates = [
      gmailRow({
        candidateId: "unknown-assoc",
        sourceRef: `gc1||${UNKNOWN_MSG}`,
        sourceTimestamp: "2026-09-16T18:20:00.000Z",
        candidateType: "person_association",
        proposedTarget: { kind: "person", personId: null },
        payload: {
          kind: "person_association",
          displayName: null,
          emailHash: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
          mintPerson: false,
          mergePersons: false,
        },
        evidenceBasis: {
          ruleIds: ["unresolved_email_hash"],
          matchedText: null,
          supportingSourceRefs: [`gc1|${UNKNOWN_THREAD}|${UNKNOWN_MSG}`],
        },
      }),
      gmailRow({
        candidateId: "unknown-ask",
        sourceRef: `gc1||${UNKNOWN_MSG}`,
        sourceTimestamp: "2026-09-16T18:20:00.000Z",
        candidateType: "open_job",
        payload: {
          kind: "open_job",
          jobKind: "request",
          subject: "Can you confirm the next step",
          detail: null,
          waitingOnActor: "founder",
          dueAt: null,
          createJob: false,
        },
        evidenceBasis: {
          ruleIds: ["explicit_client_request"],
          matchedText: "Can you confirm the next step for this design?",
          supportingSourceRefs: [`gc1|${UNKNOWN_THREAD}|${UNKNOWN_MSG}`],
        },
      }),
    ];
    const { docket } = todayOf(candidates, {
      threadContext: new Map([
        [
          UNKNOWN_THREAD,
          {
            subject: "New design question",
            fromDisplayName: "Alex Rivera",
            fromEmail: "alex.rivera@example.test",
            messages: [
              {
                messageId: UNKNOWN_MSG,
                sentAt: "2026-09-16T18:20:00.000Z",
                direction: "inbound",
              },
            ],
          },
        ],
      ]),
    });
    const card = docket.items.find((item) =>
      /Alex|confirm the next step|design/i.test(`${item.subject} ${item.headline}`),
    );
    assert.ok(card);
    assert.doesNotMatch(card?.headline ?? "", /Identify who this is from/i);
    assert.equal(selectFounderControls(card!).confirmPerson, null);
  });

  it("VENDOR: recoverable Vlora request is vendor context, not Confirm Person", () => {
    const candidates = [
      gmailRow({
        candidateId: "vlora-assoc",
        sourceRef: `gc1|${VLORA_THREAD}|${VLORA_MSG}`,
        sourceTimestamp: "2026-09-16T18:20:00.000Z",
        candidateType: "person_association",
        payload: {
          kind: "person_association",
          displayName: "Niurka Lulo",
          emailHash: NIURKA_HASH,
          mintPerson: false,
          mergePersons: false,
        },
        evidenceBasis: {
          ruleIds: ["gmail_participant"],
          matchedText: "Niurka Lulo",
        },
      }),
      gmailRow({
        candidateId: "vlora-ask",
        sourceRef: `gc1|${VLORA_THREAD}|${VLORA_MSG}`,
        sourceTimestamp: "2026-09-16T18:20:00.000Z",
        candidateType: "open_job",
        payload: {
          kind: "open_job",
          jobKind: "request",
          subject: "Can you send me the stl file for this one as well",
          detail: null,
          waitingOnActor: "founder",
          dueAt: null,
          createJob: false,
        },
        evidenceBasis: {
          ruleIds: ["explicit_vendor_waiting"],
          matchedText: "Can you send me the stl file for this one as well",
        },
      }),
    ];
    const { docket, loop } = todayOf(candidates, {
      threadContext: new Map([
        [
          VLORA_THREAD,
          {
            subject: "RE: HGD - Question (3 stone)",
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            messages: [
              {
                messageId: VLORA_MSG,
                sentAt: "2026-09-16T18:20:00.000Z",
                direction: "inbound",
              },
            ],
          },
        ],
      ]),
      vendorDirectory: ["Vlora"],
      knownPeople: [
        {
          personId: "niurka-vendor-contact",
          displayName: "Niurka Lulo",
          roles: ["vendor-contact"],
          organizationName: "Vlora",
          emailHash: NIURKA_HASH,
        },
      ],
    });
    assert.equal(
      docket.items.some((item) => selectFounderControls(item).confirmPerson != null),
      false,
    );
    assert.equal(
      loop.brief.some((row) => row.actions.some((action) => action.kind === "confirm_person")),
      false,
    );
    assert.ok(
      docket.items.some((item) => /Vlora|Sarah|Grant|STL/i.test(item.subject)) ||
        docket.watching.some((row) => /Vlora|Sarah|Grant/i.test(row.title)) ||
        loop.watching.some((row) => /Vlora/i.test(row.title)),
    );
  });
});
