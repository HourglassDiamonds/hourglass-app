import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { GENERATED_FOUNDER_OPERATING_BRIEF_RULE } from "@/lib/continuum/gmail/candidates/generated-source";
import { extractOpenJobs } from "@/lib/continuum/gmail/candidates/parse";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket } from "./docket";
import { selectFounderControls } from "./founder-actions";
import { fixtureCandidate } from "./fixtures";
import {
  reconcileThreadTruthState,
  type ThreadTruthState,
} from "./thread-truth";
import type { CosProjectContext } from "./types";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";

const NOW = "2026-09-17T16:00:00.000Z";
const NATE_THREAD = "19a854e42f90344f";
const NATE_IN = "nate-in-19a854e42f90344f";
const NATE_OUT = "nate-out-19a854e42f90344f";
const SARAH_THREAD = "1a01c4ee4d198ef0";
const SARAH_IN = "sarah-in-1a01c4ee4d198ef0";
const SARAH_OUT = "sarah-out-1a01c4ee4d198ef0";
const SARAH_PROJECT = "sarah-leishman-cad-project";
const TIM_THREAD = "1a0a777131b641f1";
const TIM_IN = "1a0ac812e84639d5";
const TIM_OUT = "1a0ac6ad45444062";
const TIM_LEE_EMAIL = "timlee591@gmail.com";
const TIM_LEE_HASH = hashEmail(TIM_LEE_EMAIL)!;
const TIM_LEE_ID = "b1505a55-7296-4084-9574-7a4b327cb565";
const NATE_EMAIL = "nate.pearl@example.test";
const NATE_HASH = hashEmail(NATE_EMAIL)!;
const NATE_ID = "nate-pearl-person-id-000000000000000001";
const DIR = dirname(fileURLToPath(import.meta.url));

const NATE_INBOUND_AT = "2026-09-16T18:00:00.000Z";
const NATE_OUTBOUND_AT = "2026-09-16T21:10:00.000Z";
const SARAH_INBOUND_AT = "2026-09-17T02:40:00.000Z";
const SARAH_OUTBOUND_AT = "2026-09-17T12:55:00.000Z";
const TIM_INBOUND_AT = "2026-09-16T23:15:00.000Z";
const TIM_OUTBOUND_AT = "2026-09-16T23:33:00.000Z";

const NATE_INBOUND_TEXT =
  "How durable are pearls for daily wear? What metal should we use? Can you send chain options and pricing?";
const NATE_OUTBOUND_TEXT =
  "Pearl durability is excellent in daily wear. Yellow gold is the right call. I'll get a video of the chain options and check pricing and availability.";
const SARAH_INBOUND_TEXT = "I'm not feeling the ring design yet.";
const SARAH_OUTBOUND_TEXT =
  "Let's see what the CAD comes back looking like today and we'll go from there.";
const TIM_INBOUND_TEXT = "Sounds great to me. Perfect timetable.";
const TIM_OUTBOUND_TEXT =
  "I'll keep you posted as we get a little closer so I can give an exact.";

function gmailRow(
  extra: Partial<ContinuumCandidate> & Pick<ContinuumCandidate, "candidateId">,
): ContinuumCandidate {
  return fixtureCandidate({
    sourceSystem: "gmail",
    proposedTarget: { kind: "none" },
    ...extra,
  });
}

function threadMessages(
  threadId: string,
  inboundId: string,
  inboundAt: string,
  outboundId: string,
  outboundAt: string,
): TodayGmailThreadContext {
  void threadId;
  return {
    messages: [
      { messageId: inboundId, sentAt: inboundAt, direction: "inbound" },
      { messageId: outboundId, sentAt: outboundAt, direction: "outbound" },
    ],
  };
}

function nateCandidates(extra?: {
  laterInbound?: boolean;
  outboundText?: string;
}): ContinuumCandidate[] {
  const rows = [
    gmailRow({
      candidateId: "nate-request",
      sourceRef: `gc1|${NATE_THREAD}|${NATE_IN}`,
      sourceTimestamp: NATE_INBOUND_AT,
      candidateType: "open_job",
      proposedTarget: { kind: "open_job", projectId: null },
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
        matchedText: NATE_INBOUND_TEXT,
      },
    }),
    gmailRow({
      candidateId: "nate-commit",
      sourceRef: `gc1|${NATE_THREAD}|${NATE_OUT}`,
      sourceTimestamp: NATE_OUTBOUND_AT,
      candidateType: "open_job",
      proposedTarget: { kind: "open_job", projectId: null },
      payload: {
        kind: "open_job",
        jobKind: "commitment",
        subject: extra?.outboundText ?? NATE_OUTBOUND_TEXT,
        detail: null,
        waitingOnActor: "founder",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_founder_commitment"],
        matchedText: extra?.outboundText ?? NATE_OUTBOUND_TEXT,
      },
    }),
  ];
  if (!extra?.laterInbound) return rows;
  rows.push(
    gmailRow({
      candidateId: "nate-again",
      sourceRef: `gc1|${NATE_THREAD}|nate-again`,
      sourceTimestamp: "2026-09-17T14:00:00.000Z",
      candidateType: "open_job",
      proposedTarget: { kind: "open_job", projectId: null },
      payload: {
        kind: "open_job",
        jobKind: "request",
        subject: "Can you also send the bracelet option",
        detail: null,
        waitingOnActor: "founder",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_client_request"],
        matchedText: "Can you also send the bracelet option?",
      },
    }),
  );
  return rows;
}

function sarahCandidates(): ContinuumCandidate[] {
  return [
    gmailRow({
      candidateId: "sarah-design",
      sourceRef: `gc1|${SARAH_THREAD}|${SARAH_IN}`,
      sourceTimestamp: SARAH_INBOUND_AT,
      candidateType: "project_context",
      proposedTarget: { kind: "project", projectId: SARAH_PROJECT },
      payload: {
        kind: "project_context",
        topic: "design_refinement",
        value: SARAH_INBOUND_TEXT,
      },
      evidenceBasis: {
        ruleIds: ["explicit_design_refinement"],
        matchedText: SARAH_INBOUND_TEXT,
      },
    }),
    gmailRow({
      candidateId: "sarah-cad-wait",
      sourceRef: `gc1|${SARAH_THREAD}|${SARAH_OUT}`,
      sourceTimestamp: SARAH_OUTBOUND_AT,
      candidateType: "note",
      proposedTarget: { kind: "project", projectId: SARAH_PROJECT },
      payload: {
        kind: "note",
        text: SARAH_OUTBOUND_TEXT,
        contextLayer: null,
      },
      evidenceBasis: {
        ruleIds: ["explicit_founder_commitment"],
        matchedText: SARAH_OUTBOUND_TEXT,
      },
    }),
  ];
}

function timCandidates(): ContinuumCandidate[] {
  return [
    gmailRow({
      candidateId: "tim-assoc",
      sourceRef: `gc1|${TIM_THREAD}|${TIM_IN}`,
      sourceTimestamp: TIM_INBOUND_AT,
      candidateType: "person_association",
      proposedTarget: { kind: "person", personId: null },
      payload: {
        kind: "person_association",
        displayName: null,
        emailHash: TIM_LEE_HASH,
        mintPerson: false,
        mergePersons: false,
      },
      confidence: "low",
      evidenceBasis: {
        ruleIds: ["unresolved_email_hash"],
        matchedText: null,
      },
    }),
    gmailRow({
      candidateId: "tim-ok",
      sourceRef: `gc1|${TIM_THREAD}|${TIM_IN}`,
      sourceTimestamp: TIM_INBOUND_AT,
      candidateType: "open_job",
      proposedTarget: { kind: "open_job", projectId: null },
      payload: {
        kind: "open_job",
        jobKind: "request",
        subject: TIM_INBOUND_TEXT,
        detail: null,
        waitingOnActor: "founder",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_follow_up"],
        matchedText: TIM_INBOUND_TEXT,
      },
    }),
    gmailRow({
      candidateId: "tim-keep-posted",
      sourceRef: `gc1|${TIM_THREAD}|${TIM_OUT}`,
      sourceTimestamp: TIM_OUTBOUND_AT,
      candidateType: "open_job",
      proposedTarget: { kind: "open_job", projectId: null },
      payload: {
        kind: "open_job",
        jobKind: "commitment",
        subject: TIM_OUTBOUND_TEXT,
        detail: null,
        waitingOnActor: "founder",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_founder_commitment"],
        matchedText: TIM_OUTBOUND_TEXT,
      },
    }),
  ];
}

function sarahProject(): Map<string, CosProjectContext> {
  return new Map([
    [
      SARAH_PROJECT,
      {
        projectId: SARAH_PROJECT,
        title: "Leishman ring",
        personName: "Sarah Leishman",
        people: [
          {
            personId: "sarah-person-id-000000000000000000000001",
            displayName: "Sarah Leishman",
            role: "client",
          },
        ],
        isCurrent: true,
        lifecycleStage: "cad",
        gmailThreadId: SARAH_THREAD,
      },
    ],
  ]);
}

function timPeople() {
  return [
    {
      personId: TIM_LEE_ID,
      displayName: "Tim Lee",
      roles: ["client"] as const,
      emailHash: TIM_LEE_HASH,
    },
  ];
}

function todayOf(
  candidates: ContinuumCandidate[],
  extra?: {
    threadContext?: Map<string, TodayGmailThreadContext>;
    projects?: Map<string, CosProjectContext>;
    knownPeople?: Parameters<typeof composeCosOperatingLoop>[0]["knownPeople"];
  },
) {
  const loop = composeCosOperatingLoop({
    jobs: [],
    candidates,
    projects: extra?.projects ?? new Map(),
    nowIso: NOW,
    threadContext: extra?.threadContext,
    knownPeople: extra?.knownPeople,
  });
  return { loop, docket: composeTodayDocket(loop) };
}

function natePeople() {
  return [
    {
      personId: NATE_ID,
      displayName: "Nate Pearl",
      roles: ["client"] as const,
      emailHash: NATE_HASH,
    },
  ];
}

function nateContext(): Map<string, TodayGmailThreadContext> {
  return new Map([
    [
      NATE_THREAD,
      {
        subject: "Re: Pearl pendant",
        fromDisplayName: "Nate Pearl",
        fromEmail: NATE_EMAIL,
        ...threadMessages(NATE_THREAD, NATE_IN, NATE_INBOUND_AT, NATE_OUT, NATE_OUTBOUND_AT),
      },
    ],
  ]);
}

describe("Today thread truth-state reconciliation", () => {
  it("Nate: later founder outbound replaces recap with chain video/options/pricing", () => {
    const candidates = nateCandidates();
    const truth = reconcileThreadTruthState({
      rows: candidates,
      thread: nateContext().get(NATE_THREAD),
    });
    assert.equal(truth.staleInboundSatisfied, true);
    assert.equal(truth.clientRepliedAfterOutbound, false);
    assert.match(truth.remainingCommitment?.recommended ?? "", /chain video, options, and pricing/i);
    const { docket, loop } = todayOf(candidates, {
      threadContext: nateContext(),
      knownPeople: natePeople(),
    });
    const card = docket.items.find((item) => /Nate|Pearl|chain/i.test(`${item.subject} ${item.headline}`));
    assert.ok(card);
    assert.doesNotMatch(card?.headline ?? "", /Send the recap/i);
    assert.match(card?.headline ?? "", /chain video, options, and pricing/i);
    assert.equal(
      loop.watching.some((row) => /waiting on client/i.test(row.detail)),
      false,
    );
    assert.equal(candidates.some((row) => row.candidateId === "nate-request"), true);
  });

  it("Sarah: founder CAD wait is Watching, not recap or Up next", () => {
    const candidates = sarahCandidates();
    const threadContext = new Map([
      [
        SARAH_THREAD,
        {
          subject: "Re: CAD",
          fromDisplayName: "Sarah Leishman",
          fromEmail: "sarah.leishman@example.test",
          ...threadMessages(
            SARAH_THREAD,
            SARAH_IN,
            SARAH_INBOUND_AT,
            SARAH_OUT,
            SARAH_OUTBOUND_AT,
          ),
        },
      ],
    ]);
    const truth = reconcileThreadTruthState({
      rows: candidates,
      thread: threadContext.get(SARAH_THREAD),
      project: sarahProject().get(SARAH_PROJECT),
    });
    assert.equal(truth.staleInboundSatisfied, true);
    assert.equal(truth.remainingCommitment, null);
    assert.equal(truth.waiting, "cad");
    const { docket, loop } = todayOf(candidates, {
      threadContext,
      projects: sarahProject(),
    });
    assert.equal(
      docket.items.some((item) => /recap/i.test(item.headline)),
      false,
    );
    assert.equal(
      docket.items.some((item) => /Sarah/i.test(item.subject)),
      false,
    );
    assert.ok(loop.watching.some((row) => /CAD/i.test(row.detail)));
    assert.equal(loop.needsYourDecision.some((row) => /Your turn/i.test(row.headline)), false);
  });

  it("Tim: identity resolves, no Confirm Person, no project auto-link, no immediate action", () => {
    const candidates = timCandidates();
    const threadContext = new Map([
      [
        TIM_THREAD,
        {
          subject: "Re: Cornflower Blue - Yogo Sapphire - Lee",
          fromDisplayName: "Tim Lee",
          fromEmail: TIM_LEE_EMAIL,
          ...threadMessages(TIM_THREAD, TIM_IN, TIM_INBOUND_AT, TIM_OUT, TIM_OUTBOUND_AT),
        },
      ],
    ]);
    const truth = reconcileThreadTruthState({
      rows: candidates,
      thread: threadContext.get(TIM_THREAD),
    });
    assert.equal(truth.staleInboundSatisfied, true);
    assert.equal(truth.remainingCommitment, null);
    assert.equal(truth.waiting, "production");
    const { docket, loop } = todayOf(candidates, {
      threadContext,
      knownPeople: timPeople(),
    });
    assert.equal(
      docket.items.some((item) => /recap|Identify who this is from/i.test(item.headline)),
      false,
    );
    assert.equal(
      docket.items.some((item) => item.subject === "Tim Lee"),
      false,
    );
    const watching = loop.watching.find((row) => /production|shop/i.test(`${row.title} ${row.detail}`));
    assert.ok(watching);
    assert.equal(watching?.projectId ?? null, null);
    for (const item of docket.items) {
      assert.equal(selectFounderControls(item).confirmPerson, null);
      assert.equal(item.brief?.projectId ?? null, null);
    }
  });

  it("unanswered inbound remains actionable", () => {
    const inbound = nateCandidates()[0]!;
    const threadContext = new Map([
      [
        NATE_THREAD,
        {
          subject: "Re: Pearl pendant",
          fromDisplayName: "Nate Pearl",
          fromEmail: NATE_EMAIL,
          messages: [
            { messageId: NATE_IN, sentAt: NATE_INBOUND_AT, direction: "inbound" as const },
          ],
        },
      ],
    ]);
    const { docket } = todayOf([inbound], {
      threadContext,
      knownPeople: natePeople(),
    });
    const card = docket.items[0];
    assert.ok(card);
    assert.match(card?.headline ?? "", /recap|next step/i);
  });

  it("founder reply with no new commitment becomes a waiting state", () => {
    const candidates = [
      nateCandidates()[0]!,
      gmailRow({
        candidateId: "nate-thanks",
        sourceRef: `gc1|${NATE_THREAD}|${NATE_OUT}`,
        sourceTimestamp: NATE_OUTBOUND_AT,
        candidateType: "note",
        payload: {
          kind: "note",
          text: "Thanks — those answers are on the way in the note above.",
          contextLayer: null,
        },
        evidenceBasis: {
          ruleIds: ["explicit_founder_commitment"],
          matchedText: "Those questions are covered. I'll wait to hear what you prefer.",
        },
      }),
    ];
    const { docket, loop } = todayOf(candidates, { threadContext: nateContext() });
    assert.equal(
      docket.items.some((item) => /recap/i.test(item.headline)),
      false,
    );
    assert.ok(loop.watching.length > 0);
  });

  it("client reply after founder response is actionable again", () => {
    const candidates = nateCandidates({ laterInbound: true });
    const threadContext = new Map([
      [
        NATE_THREAD,
        {
          subject: "Re: Pearl pendant",
          fromDisplayName: "Nate Pearl",
          fromEmail: NATE_EMAIL,
          messages: [
            { messageId: NATE_IN, sentAt: NATE_INBOUND_AT, direction: "inbound" },
            { messageId: NATE_OUT, sentAt: NATE_OUTBOUND_AT, direction: "outbound" },
            {
              messageId: "nate-again",
              sentAt: "2026-09-17T14:00:00.000Z",
              direction: "inbound",
            },
          ],
        },
      ],
    ]);
    const truth = reconcileThreadTruthState({
      rows: candidates,
      thread: threadContext.get(NATE_THREAD),
    });
    assert.equal(truth.clientRepliedAfterOutbound, true);
    assert.equal(truth.staleInboundSatisfied, false);
    const { docket } = todayOf(candidates, {
      threadContext,
      knownPeople: natePeople(),
    });
    assert.ok(docket.items.some((item) => /recap|next step|bracelet/i.test(item.headline)));
  });

  it("internally generated Morning Brief stays suppressed", () => {
    const briefThread = "1a085d41ae9efcf6";
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "brief-job",
          sourceRef: `gc1|${briefThread}|${briefThread}`,
          sourceTimestamp: NATE_INBOUND_AT,
          candidateType: "open_job",
          proposedTarget: { kind: "open_job", projectId: null },
          payload: {
            kind: "open_job",
            jobKind: "required_action",
            subject: "follow-up window",
            detail: null,
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_follow_up", GENERATED_FOUNDER_OPERATING_BRIEF_RULE],
            matchedText: "follow-up window",
          },
        }),
      ],
      {
        threadContext: new Map([
          [
            briefThread,
            {
              subject: "Hourglass Morning Brief · September 4, 2026",
              messages: [
                {
                  messageId: briefThread,
                  sentAt: NATE_INBOUND_AT,
                  direction: "inbound",
                },
              ],
            },
          ],
        ]),
      },
    );
    assert.equal(docket.items.length, 0);
  });

  it("does not change × Dismiss persistence wiring", () => {
    const disposition = readFileSync(join(DIR, "disposition.ts"), "utf8");
    assert.match(disposition, /applyReview/);
    assert.doesNotMatch(disposition, /createProjectJob|mintPerson|mergePerson/);
    const today = readFileSync(
      join(DIR, "../../../../app/executive-dashboard/concierge/components/cos-docket-actions.tsx"),
      "utf8",
    );
    assert.match(today, /Dismiss from Today/);
  });

  it("expands founder commitment detection for get/show/check without minting jobs", () => {
    const hits = extractOpenJobs(
      "I'll get a video of the chain options and check pricing.",
      "outbound",
      "founder",
    );
    assert.ok(hits.some((row) => row.ruleIds.includes("explicit_founder_commitment")));
    assert.equal(
      hits.every((row) => row.waitingOnActor === "founder"),
      true,
    );
  });

  it("does not treat keep-you-posted production follow-up as an immediate Today commitment", () => {
    const truth: ThreadTruthState = reconcileThreadTruthState({
      rows: timCandidates(),
      thread: {
        messages: [
          { messageId: TIM_IN, sentAt: TIM_INBOUND_AT, direction: "inbound" },
          { messageId: TIM_OUT, sentAt: TIM_OUTBOUND_AT, direction: "outbound" },
        ],
      },
    });
    assert.equal(truth.remainingCommitment, null);
    assert.equal(truth.waiting, "production");
  });
});
