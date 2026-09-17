import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { groupingKey } from "@/lib/continuum/candidates/founder-attention";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket } from "./docket";
import { selectFounderControls } from "./founder-actions";
import { fixtureCandidate } from "./fixtures";
import { resolveTodayGroupTruth } from "./group-truth";
import type { CosProjectContext } from "./types";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";

const NOW = "2026-09-17T16:00:00.000Z";
const NIURKA_EMAIL = "niurka@vlorajewelry.com";
const NIURKA_HASH = hashEmail(NIURKA_EMAIL)!;
const FOUNDER_EMAIL = "justin@hourglassdiamonds.com";
const FOUNDER_HASH = hashEmail(FOUNDER_EMAIL)!;
const ABBEY_THREAD = "1a08760c6837bb32";
const ABBEY_STL = "abbey-stl-1a08760c6837bb32";
const ABBEY_WILL_SEND = "abbey-send-1a08760c6837bb32";
const ABBEY_ROCKSTAR = "abbey-rock-1a08760c6837bb32";
const ABBEY_EMOJI = "abbey-emoji-1a08760c6837bb32";
const SARAH_VENDOR_THREAD = "1a0881b53067a9e6";
const SARAH_VENDOR_OUT = "sarah-vendor-out-1a0881b53067a9e6";
const SARAH_VENDOR_IN = "sarah-vendor-in-1a0881b53067a9e6";
const JEN_THREAD = "19fc9f4c3d36dbed";
const JEN_IN = "jen-in-19fc9f4c3d36dbed";
const JEN_OUT = "jen-out-19fc9f4c3d36dbed";

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
    evidenceTexts?: readonly string[];
    projects?: Map<string, CosProjectContext>;
    knownPeople?: Parameters<typeof composeCosOperatingLoop>[0]["knownPeople"];
  },
) {
  const loop = composeCosOperatingLoop({
    jobs: [],
    candidates,
    projects: options?.projects ?? new Map(),
    nowIso: NOW,
    threadContext: options?.threadContext,
    vendorDirectory: options?.vendorDirectory,
    evidenceTexts: options?.evidenceTexts,
    knownPeople: options?.knownPeople,
  });
  return { loop, docket: composeTodayDocket(loop) };
}

function niurkaPeople() {
  return [
    {
      personId: "niurka-vendor-contact",
      displayName: "Niurka Lulo",
      roles: ["vendor-contact"] as const,
      organizationName: "Vlora",
      emailHash: NIURKA_HASH,
    },
    {
      personId: "founder-justin",
      displayName: "Justin Smith",
      roles: ["client"] as const,
      organizationName: null,
      emailHash: FOUNDER_HASH,
    },
  ];
}

function vloraEvidenceProject(): Map<string, CosProjectContext> {
  return new Map([
    [
      "unrelated-mounting",
      {
        projectId: "unrelated-mounting",
        title: "Unrelated mounting",
        personName: "Client Hale",
        people: [],
        isCurrent: true,
        specs: [
          {
            fieldName: "diamond_supply_notes",
            value: "Vlora lab-grown on mounting",
          },
        ],
        gmailThreadId: "other-thread-not-this-one",
      },
    ],
  ]);
}

function abbeyCandidates(): ContinuumCandidate[] {
  return [
    gmailRow({
      candidateId: "abbey-assoc",
      sourceRef: `gc1||${ABBEY_WILL_SEND}`,
      sourceTimestamp: "2026-09-15T15:10:00.000Z",
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
        supportingSourceRefs: [`gc1|${ABBEY_THREAD}|${ABBEY_WILL_SEND}`],
      },
    }),
    gmailRow({
      candidateId: "abbey-spec",
      sourceRef: `gc1||${ABBEY_WILL_SEND}`,
      sourceTimestamp: "2026-09-15T15:10:00.000Z",
      candidateType: "structured_spec",
      proposedTarget: { kind: "none" },
      payload: {
        kind: "structured_spec",
        fieldName: "center_stone",
        proposedValue: "2 Marquise",
        currentValue: null,
        conflict: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_spec"],
        matchedText: "2 Marquise",
        supportingSourceRefs: [`gc1|${ABBEY_THREAD}|${ABBEY_WILL_SEND}`],
      },
    }),
    gmailRow({
      candidateId: "abbey-stl",
      sourceRef: `gc1||${ABBEY_STL}`,
      sourceTimestamp: "2026-09-15T14:40:00.000Z",
      candidateType: "open_job",
      payload: {
        kind: "open_job",
        jobKind: "request",
        subject: "Can you send me the STL",
        detail: null,
        waitingOnActor: "vendor",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_client_request"],
        matchedText: "Can you send me the STL for Abbey-C026137",
        supportingSourceRefs: [`gc1|${ABBEY_THREAD}|${ABBEY_STL}`],
      },
    }),
    gmailRow({
      candidateId: "abbey-will-send",
      sourceRef: `gc1||${ABBEY_WILL_SEND}`,
      sourceTimestamp: "2026-09-15T15:10:00.000Z",
      candidateType: "open_job",
      payload: {
        kind: "open_job",
        jobKind: "commitment",
        subject: "I'll send the STL",
        detail: null,
        waitingOnActor: "vendor",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_vendor_commitment"],
        matchedText: "I'll send it",
        supportingSourceRefs: [`gc1|${ABBEY_THREAD}|${ABBEY_WILL_SEND}`],
      },
    }),
    gmailRow({
      candidateId: "abbey-rockstar",
      sourceRef: `gc1||${ABBEY_ROCKSTAR}`,
      sourceTimestamp: "2026-09-15T15:40:00.000Z",
      candidateType: "note",
      payload: {
        kind: "note",
        text: "You're a rockstar as usual!",
        contextLayer: null,
      },
      evidenceBasis: {
        ruleIds: ["explicit_follow_up"],
        matchedText: "You're a rockstar as usual!",
        supportingSourceRefs: [`gc1|${ABBEY_THREAD}|${ABBEY_ROCKSTAR}`],
      },
    }),
  ];
}

function abbeyThread(): TodayGmailThreadContext {
  return {
    subject: "RE: HGD x Abbey-C026137",
    fromDisplayName: null,
    fromEmail: null,
    messages: [
      {
        messageId: ABBEY_STL,
        sentAt: "2026-09-15T14:40:00.000Z",
        direction: "outbound",
        fromEmailHash: FOUNDER_HASH,
      },
      {
        messageId: ABBEY_WILL_SEND,
        sentAt: "2026-09-15T15:10:00.000Z",
        direction: "inbound",
        fromEmailHash: NIURKA_HASH,
      },
      {
        messageId: ABBEY_ROCKSTAR,
        sentAt: "2026-09-15T15:40:00.000Z",
        direction: "outbound",
        fromEmailHash: FOUNDER_HASH,
      },
      {
        messageId: ABBEY_EMOJI,
        sentAt: "2026-09-15T15:55:00.000Z",
        direction: "inbound",
        fromEmailHash: NIURKA_HASH,
      },
    ],
  };
}

function sarahVendorCandidates(): ContinuumCandidate[] {
  return [
    gmailRow({
      candidateId: "sarah-vendor-assoc",
      sourceRef: `gc1|${SARAH_VENDOR_THREAD}|${SARAH_VENDOR_IN}`,
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
      candidateId: "sarah-vendor-date",
      sourceRef: `gc1|${SARAH_VENDOR_THREAD}|${SARAH_VENDOR_IN}`,
      sourceTimestamp: "2026-09-16T18:20:00.000Z",
      candidateType: "date",
      payload: {
        kind: "date",
        raw: "September 16, 2026",
        isoDate: "2026-09-16",
        precision: "day",
        role: "mentioned",
        sourceTimestamp: "2026-09-16T18:20:00.000Z",
        resolutionCalendar: "source-timestamp-utc-date",
      },
      evidenceBasis: {
        ruleIds: ["explicit_date"],
        matchedText: "September 16, 2026",
      },
    }),
    gmailRow({
      candidateId: "sarah-vendor-out",
      sourceRef: `gc1|${SARAH_VENDOR_THREAD}|${SARAH_VENDOR_OUT}`,
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
      candidateId: "sarah-vendor-cad",
      sourceRef: `gc1|${SARAH_VENDOR_THREAD}|${SARAH_VENDOR_IN}`,
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
}

function sarahVendorThread(fromEmail: string | null = null): TodayGmailThreadContext {
  return {
    subject: "RE: HGD x Sarah-C026143",
    fromDisplayName: null,
    fromEmail,
    messages: [
      {
        messageId: SARAH_VENDOR_OUT,
        sentAt: "2026-09-16T17:40:00.000Z",
        direction: "outbound",
        fromEmailHash: FOUNDER_HASH,
      },
      {
        messageId: SARAH_VENDOR_IN,
        sentAt: "2026-09-16T18:20:00.000Z",
        direction: "inbound",
        fromEmailHash: NIURKA_HASH,
      },
    ],
  };
}

function jenCandidates(): ContinuumCandidate[] {
  const inboundText =
    "I like the rounded prongs more than the claw, but I think that I may like a rounded claw best for this design. Could we try that?";
  return [
    gmailRow({
      candidateId: "jen-assoc",
      sourceRef: `gc1||${JEN_IN}`,
      sourceTimestamp: "2026-09-15T16:00:00.000Z",
      candidateType: "person_association",
      proposedTarget: { kind: "person", personId: null },
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
        supportingSourceRefs: [`gc1|${JEN_THREAD}|${JEN_IN}`],
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
        supportingSourceRefs: [`gc1|${JEN_THREAD}|${JEN_IN}`],
      },
    }),
  ];
}

function jenThread(): TodayGmailThreadContext {
  return {
    subject: "Re: Cornflower Blue - Yogo Sapphire - Lee",
    fromDisplayName: "Jen Spiegel",
    fromEmail: "jen.spiegel@example.test",
    messages: [
      { messageId: JEN_IN, sentAt: "2026-09-15T16:00:00.000Z", direction: "inbound" },
      {
        messageId: JEN_OUT,
        sentAt: "2026-09-16T18:30:00.000Z",
        direction: "outbound",
      },
    ],
  };
}

describe("Today Gmail group truth", () => {
  it("Abbey: recovers Niurka/Vlora from exact thread evidence and drops Confirm Person / Up next", () => {
    const candidates = abbeyCandidates();
    const threadContext = new Map([[ABBEY_THREAD, abbeyThread()]]);
    const key = groupingKey(candidates[0]!);
    const truth = resolveTodayGroupTruth({
      key,
      rows: candidates,
      threadContext,
      knownPeople: niurkaPeople(),
    });
    assert.equal(key, `thread:${ABBEY_THREAD}`);
    assert.equal(truth.gmailThreadId, ABBEY_THREAD);
    assert.equal(truth.latestMeaningfulInbound?.messageId, ABBEY_EMOJI);
    assert.equal(truth.latestMeaningfulOutbound?.messageId, ABBEY_ROCKSTAR);
    assert.equal(truth.externalSenderHash, NIURKA_HASH);
    assert.equal(truth.organizationLabel, "Vlora");
    assert.equal(truth.personLabel, null);
    assert.equal(truth.sourceClass, "vendor");
    assert.equal(truth.identityKind, "vendor");
    assert.equal(truth.noFounderAction, true);
    assert.equal(truth.remainingFounderCommitment, null);
    const { docket, loop } = todayOf(candidates, {
      threadContext,
      knownPeople: niurkaPeople(),
    });
    assert.equal(
      docket.items.some((item) => /Abbey|Unassigned|Vlora/i.test(item.subject)),
      false,
    );
    assert.equal(
      docket.items.some((item) =>
        item.brief?.actions.some((action) => action.kind === "confirm_person"),
      ),
      false,
    );
    assert.equal(
      loop.brief.some((row) => row.actions.some((action) => action.kind === "confirm_person")),
      false,
    );
  });

  it("Sarah vendor: Vlora waiting on shop/CAD, not Confirm Person or Up next", () => {
    const candidates = sarahVendorCandidates();
    const threadContext = new Map([[SARAH_VENDOR_THREAD, sarahVendorThread()]]);
    const key = groupingKey(candidates[0]!);
    const truth = resolveTodayGroupTruth({
      key,
      rows: candidates,
      threadContext,
      knownPeople: niurkaPeople(),
    });
    assert.equal(truth.gmailThreadId, SARAH_VENDOR_THREAD);
    assert.equal(truth.latestMeaningfulInbound?.messageId, SARAH_VENDOR_IN);
    assert.equal(truth.externalSenderHash, NIURKA_HASH);
    assert.equal(truth.organizationLabel, "Vlora");
    assert.equal(truth.personLabel, null);
    assert.equal(truth.sourceClass, "vendor");
    assert.equal(truth.waitingState, "cad");
    assert.equal(truth.noFounderAction, true);
    assert.equal(truth.staleInboundSatisfied, false);
    const { docket, loop } = todayOf(candidates, {
      threadContext,
      knownPeople: niurkaPeople(),
    });
    assert.equal(
      docket.items.some((item) => /Sarah|Unassigned|Vlora/i.test(item.subject)),
      false,
    );
    assert.equal(
      docket.items.some((item) => /September 16, 2026/i.test(`${item.headline} ${item.context}`)),
      false,
    );
    const watching = loop.watching.find((row) => /Vlora/i.test(row.title));
    assert.ok(watching);
    assert.match(watching?.detail ?? "", /CAD|shop/i);
    assert.equal(
      docket.items.some((item) => selectFounderControls(item).confirmPerson != null),
      false,
    );
  });

  it("Sarah vendor: live fromEmail plus durable Vlora evidence without a stored Niurka Person", () => {
    const candidates = sarahVendorCandidates();
    const { docket, loop } = todayOf(candidates, {
      threadContext: new Map([[SARAH_VENDOR_THREAD, sarahVendorThread(NIURKA_EMAIL)]]),
      projects: vloraEvidenceProject(),
    });
    assert.equal(
      docket.items.some((item) => /Unassigned|Sarah/i.test(item.subject)),
      false,
    );
    assert.ok(loop.watching.some((row) => /Vlora/i.test(row.title)));
    assert.equal(
      loop.brief.some((row) => row.actions.some((action) => action.kind === "confirm_person")),
      false,
    );
  });

  it("Jen: later founder rounded-claw outbound satisfies stale inbound recap", () => {
    const candidates = jenCandidates();
    const threadContext = new Map([[JEN_THREAD, jenThread()]]);
    const key = groupingKey(candidates[0]!);
    const truth = resolveTodayGroupTruth({
      key,
      rows: candidates,
      threadContext,
    });
    assert.equal(key, `thread:${JEN_THREAD}`);
    assert.equal(truth.gmailThreadId, JEN_THREAD);
    assert.equal(truth.latestMeaningfulInbound?.messageId, JEN_IN);
    assert.equal(truth.latestMeaningfulOutbound?.messageId, JEN_OUT);
    assert.equal(truth.staleInboundSatisfied, true);
    assert.equal(truth.remainingFounderCommitment, null);
    assert.equal(truth.waitingState, "client");
    assert.equal(truth.staleInboundSatisfied, true);
    const { docket, loop } = todayOf(candidates, { threadContext });
    assert.equal(
      docket.items.some((item) => /recap|next step/i.test(item.headline)),
      false,
    );
    assert.equal(
      docket.items.some((item) => /Jen Spiegel/i.test(item.subject)),
      false,
    );
    assert.ok(loop.watching.length > 0);
  });

  it("founder outbound hashes do not make a unique vendor-contact ambiguous", () => {
    const candidates = sarahVendorCandidates();
    const truth = resolveTodayGroupTruth({
      key: `thread:${SARAH_VENDOR_THREAD}`,
      rows: candidates,
      threadContext: new Map([[SARAH_VENDOR_THREAD, sarahVendorThread()]]),
      knownPeople: niurkaPeople(),
    });
    assert.equal(truth.identityKind, "vendor");
    assert.notEqual(truth.identityKind, "ambiguous");
    assert.equal(truth.organizationLabel, "Vlora");
  });

  it("Unassigned legacy groups still expose the recovered Gmail thread id for live fetch", () => {
    const candidates = [
      gmailRow({
        candidateId: "unknown-human",
        sourceRef: `gc1||${SARAH_VENDOR_IN}`,
        sourceTimestamp: "2026-09-16T18:20:00.000Z",
        candidateType: "person_association",
        proposedTarget: { kind: "person", personId: null },
        payload: {
          kind: "person_association",
          displayName: null,
          emailHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          mintPerson: false,
          mergePersons: false,
        },
        evidenceBasis: {
          ruleIds: ["unresolved_email_hash"],
          matchedText: null,
          supportingSourceRefs: [`gc1|${SARAH_VENDOR_THREAD}|${SARAH_VENDOR_IN}`],
        },
      }),
      gmailRow({
        candidateId: "unknown-ask",
        sourceRef: `gc1||${SARAH_VENDOR_IN}`,
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
          supportingSourceRefs: [`gc1|${SARAH_VENDOR_THREAD}|${SARAH_VENDOR_IN}`],
        },
      }),
    ];
    const { docket } = todayOf(candidates, {
      threadContext: new Map([
        [
          SARAH_VENDOR_THREAD,
          {
            subject: "RE: HGD x unknown",
            fromDisplayName: null,
            fromEmail: null,
            messages: [
              {
                messageId: SARAH_VENDOR_IN,
                sentAt: "2026-09-16T18:20:00.000Z",
                direction: "inbound",
                fromEmailHash:
                  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              },
            ],
          },
        ],
      ]),
    });
    const card = docket.items[0];
    assert.ok(card);
    assert.equal(card?.subject, "Unassigned");
    assert.ok(selectFounderControls(card!).confirmPerson);
    assert.equal(card?.brief?.recoveredGmailThreadId, SARAH_VENDOR_THREAD);
    assert.equal(card?.brief?.canonicalGmailThreadId ?? null, null);
  });

  it("genuine vendor request needing a founder answer can still surface as Vlora", () => {
    const candidates = [
      gmailRow({
        candidateId: "vendor-ask-assoc",
        sourceRef: `gc1|${SARAH_VENDOR_THREAD}|${SARAH_VENDOR_IN}`,
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
        evidenceBasis: { ruleIds: ["unresolved_email_hash"], matchedText: null },
      }),
      gmailRow({
        candidateId: "vendor-ask",
        sourceRef: `gc1|${SARAH_VENDOR_THREAD}|${SARAH_VENDOR_IN}`,
        sourceTimestamp: "2026-09-16T18:20:00.000Z",
        candidateType: "open_job",
        payload: {
          kind: "open_job",
          jobKind: "request",
          subject: "Can you confirm the prong count",
          detail: null,
          waitingOnActor: "founder",
          dueAt: null,
          createJob: false,
        },
        evidenceBasis: {
          ruleIds: ["explicit_follow_up"],
          matchedText: "Can you confirm the prong count before we proceed?",
        },
      }),
    ];
    const { docket } = todayOf(candidates, {
      threadContext: new Map([
        [
          SARAH_VENDOR_THREAD,
          {
            subject: "RE: HGD x Sarah-C026143",
            fromEmail: null,
            messages: [
              {
                messageId: SARAH_VENDOR_IN,
                sentAt: "2026-09-16T18:20:00.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
            ],
          },
        ],
      ]),
      knownPeople: niurkaPeople(),
    });
    const card = docket.items.find((item) => item.subject === "Vlora");
    assert.ok(card);
    assert.equal(selectFounderControls(card!).confirmPerson, null);
    assert.notEqual(card?.subject, "Unassigned");
  });
});
