/**
 * Source-event-aware Today refresh invalidation.
 * A newly indexed Gmail message can change Today with zero new candidates.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import { composeCosOperatingLoop } from "@/lib/continuum/chief-of-staff/operating-loop/compose";
import { composeTodayDocket } from "@/lib/continuum/chief-of-staff/operating-loop/docket";
import { fixtureCandidate } from "@/lib/continuum/chief-of-staff/operating-loop/fixtures";
import {
  shouldPollTodayFreshness,
  shouldRefreshTodaySurface,
} from "@/lib/continuum/chief-of-staff/operating-loop/today-refresh";
import { projectGmailSourceEvents } from "@/lib/continuum/source-events/gmail";
import { deriveTodayFreshnessInvalidation } from "./freshness-cycle";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const NOW = "2026-09-23T12:00:00.000Z";
const FOUNDER_HASH = hashEmail("justin@hourglassdiamonds.com")!;
const NIURKA_HASH = hashEmail("niurka@vlorajewelry.com")!;

function specRow(
  extra: Partial<ContinuumCandidate> & Pick<ContinuumCandidate, "candidateId" | "sourceRef">,
): ContinuumCandidate {
  return fixtureCandidate({
    sourceSystem: "gmail",
    candidateType: "structured_spec",
    proposedTarget: { kind: "none" },
    payload: { kind: "structured_spec", fieldName: "cad_job_number", value: "C026350" },
    evidenceBasis: { ruleIds: [], matchedText: "C026350" },
    ...extra,
  });
}

function todayOf(
  candidates: ContinuumCandidate[],
  threadContext: Map<string, TodayGmailThreadContext>,
  nowIso = NOW,
) {
  const loop = composeCosOperatingLoop({
    jobs: [],
    candidates,
    projects: new Map(),
    nowIso,
    threadContext,
    knownPeople: [
      {
        personId: "niurka",
        displayName: "Niurka Lulo",
        roles: ["vendor-contact"],
        organizationName: "Vlora",
        emailHash: NIURKA_HASH,
      },
    ],
    vendorDirectory: ["vlora"],
  });
  return composeTodayDocket(loop);
}

function card(
  docket: ReturnType<typeof composeTodayDocket>,
  needle: RegExp,
) {
  const hay = (row: {
    subject?: string;
    headline?: string;
    title?: string;
    detail?: string;
    briefingPacket?: { displayName?: string | null; projectName?: string | null } | null;
  }) =>
    `${row.subject ?? ""} ${row.headline ?? ""} ${row.title ?? ""} ${row.detail ?? ""} ${row.briefingPacket?.displayName ?? ""} ${row.briefingPacket?.projectName ?? ""}`;
  return {
    item: docket.items.find((row) => needle.test(hay(row))),
    watching: docket.watching.find((row) => needle.test(hay(row))),
  };
}

const DUANE_SPEC = specRow({
  candidateId: "duane-spec",
  sourceRef: "gc1|duane-thread|shop-wait",
  sourceTimestamp: "2026-09-17T22:47:16.000Z",
});

function duaneThread(withCad: boolean): Map<string, TodayGmailThreadContext> {
  return new Map([
    [
      "duane-thread",
      {
        subject: "RE: HGD x Duane-C026350",
        messages: [
          {
            messageId: "shop-wait",
            sentAt: "2026-09-17T22:47:16.000Z",
            direction: "inbound",
            fromEmailHash: NIURKA_HASH,
            plaintext: "I'll send the updated CAD as soon as it's available.",
          },
          ...(withCad
            ? [
                {
                  messageId: "cad-in",
                  sentAt: "2026-09-22T19:11:17.000Z",
                  direction: "inbound" as const,
                  fromEmailHash: NIURKA_HASH,
                  hasAttachments: true,
                  attachmentFilenames: ["NL-H017-Duane-C026350.jpg"],
                },
              ]
            : []),
        ],
      },
    ],
  ]);
}

const ABBEY_CLIENT_THREAD = "1a0c63dae07e07f9";

function abbeyRow(
  extra: Partial<ContinuumCandidate> & Pick<ContinuumCandidate, "candidateId">,
): ContinuumCandidate {
  return fixtureCandidate({
    sourceSystem: "gmail",
    proposedTarget: { kind: "none" },
    ...extra,
  });
}

const ABBEY_CANDIDATES: ContinuumCandidate[] = [
  abbeyRow({
    candidateId: "abbey-spec",
    sourceRef: `gc1|${ABBEY_CLIENT_THREAD}|abbey-spec`,
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
  abbeyRow({
    candidateId: "abbey-print",
    sourceRef: `gc1|${ABBEY_CLIENT_THREAD}|abbey-print`,
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
  abbeyRow({
    candidateId: "1a0c5dc99d6a59e2",
    sourceRef: `gc1|${ABBEY_CLIENT_THREAD}|1a0c5dc99d6a59e2`,
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
  abbeyRow({
    candidateId: "1a0c63dae07e07f9",
    sourceRef: `gc1|${ABBEY_CLIENT_THREAD}|1a0c63dae07e07f9`,
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
];

function abbeyThread(headed: boolean): Map<string, TodayGmailThreadContext> {
  return new Map([
    [
      ABBEY_CLIENT_THREAD,
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
          ...(headed
            ? [
                {
                  messageId: "headed",
                  sentAt: "2026-09-22T21:21:59.000Z",
                  direction: "outbound" as const,
                  fromEmailHash: FOUNDER_HASH,
                  plaintext: "Headed to you!!",
                },
              ]
            : []),
        ],
      },
    ],
  ]);
}

describe("source-event-aware Today refresh invalidation", () => {
  it("new indexed source event and zero candidates invalidate Today", () => {
    const flags = deriveTodayFreshnessInvalidation({
      indexedThisCycle: 1,
      inboundMessageIdBefore: "shop-wait",
      outboundMessageIdBefore: null,
      inboundMessageIdAfter: "cad-in",
      outboundMessageIdAfter: null,
      insertedCount: 0,
    });
    assert.equal(flags.sourceEventsChanged, true);
    assert.equal(flags.candidatesChanged, false);
    assert.equal(flags.docketMayHaveChanged, true);
    assert.equal(shouldRefreshTodaySurface(flags.docketMayHaveChanged), true);
  });

  it("a quiet tick with no new Gmail row and zero candidates does not refresh", () => {
    const flags = deriveTodayFreshnessInvalidation({
      indexedThisCycle: 0,
      inboundMessageIdBefore: "shop-wait",
      outboundMessageIdBefore: null,
      inboundMessageIdAfter: "shop-wait",
      outboundMessageIdAfter: null,
      insertedCount: 0,
    });
    assert.equal(flags.sourceEventsChanged, false);
    assert.equal(flags.candidatesChanged, false);
    assert.equal(flags.docketMayHaveChanged, false);
    assert.equal(shouldRefreshTodaySurface(flags.docketMayHaveChanged), false);
  });

  it("new candidates invalidate Today", () => {
    const flags = deriveTodayFreshnessInvalidation({
      indexedThisCycle: 0,
      inboundMessageIdBefore: "shop-wait",
      outboundMessageIdBefore: null,
      inboundMessageIdAfter: "shop-wait",
      outboundMessageIdAfter: null,
      insertedCount: 2,
    });
    assert.equal(flags.sourceEventsChanged, false);
    assert.equal(flags.candidatesChanged, true);
    assert.equal(flags.docketMayHaveChanged, true);
    assert.equal(shouldRefreshTodaySurface(flags.docketMayHaveChanged), true);
  });

  it("a hidden tab still does not poll and an in-flight check is unchanged", () => {
    assert.equal(shouldPollTodayFreshness({ documentHidden: true, inFlight: false }), false);
    assert.equal(shouldPollTodayFreshness({ documentHidden: false, inFlight: false }), true);
    assert.equal(shouldPollTodayFreshness({ documentHidden: false, inFlight: true }), false);
    assert.equal(shouldPollTodayFreshness({ documentHidden: true, inFlight: true }), false);
  });

  it("vendor CAD with zero new candidates refreshes shop wait into founder review", () => {
    const before = todayOf([DUANE_SPEC], duaneThread(false));
    const waiting = card(before, /Duane|C026350/i);
    assert.equal(waiting.item, undefined);
    assert.ok(waiting.watching);
    assert.equal(waiting.watching?.briefingPacket?.ballHolder, "vendor_shop");

    const sameCandidates = [DUANE_SPEC];
    const afterThreads = duaneThread(true);
    const events = projectGmailSourceEvents({
      threadContext: afterThreads,
      knownPeople: [
        {
          personId: "niurka",
          displayName: "Niurka Lulo",
          roles: ["vendor-contact"],
          organizationName: "Vlora",
          emailHash: NIURKA_HASH,
        },
      ],
      founderEmailHashes: new Set([FOUNDER_HASH]),
      candidates: sameCandidates,
    });
    assert.equal(
      events.find((event) => event.messageId === "cad-in")?.semanticClass,
      "vendor_delivers_artifact",
    );

    const after = todayOf(sameCandidates, afterThreads);
    const delivered = card(after, /Duane|C026350/i);
    assert.ok(delivered.item);
    assert.equal(delivered.item?.briefingPacket?.ballHolder, "founder");
    assert.equal(delivered.item?.briefingPacket?.semanticNextActionClass, "founder_review");

    const flags = deriveTodayFreshnessInvalidation({
      indexedThisCycle: 1,
      inboundMessageIdBefore: "shop-wait",
      outboundMessageIdBefore: null,
      inboundMessageIdAfter: "cad-in",
      outboundMessageIdAfter: null,
      insertedCount: 0,
    });
    assert.equal(flags.sourceEventsChanged, true);
    assert.equal(flags.candidatesChanged, false);
    assert.equal(flags.docketMayHaveChanged, true);
    assert.equal(shouldRefreshTodaySurface(flags.docketMayHaveChanged), true);
  });

  it("founder headed-to-you with zero new candidates refreshes the shipping action away", () => {
    const abbeyNow = "2026-09-21T22:00:00.000Z";
    const before = todayOf(ABBEY_CANDIDATES, abbeyThread(false), abbeyNow);
    const shipping = card(before, /Abbey|C026137/i);
    assert.ok(shipping.item ?? shipping.watching);
    assert.equal(
      (shipping.item ?? shipping.watching)?.briefingPacket?.semanticNextActionClass,
      "founder_communication",
    );
    assert.match(
      `${shipping.item?.headline ?? ""} ${shipping.item?.context ?? ""} ${shipping.item?.briefing?.nextBody ?? ""} ${shipping.watching?.title ?? ""} ${shipping.watching?.detail ?? ""} ${shipping.watching?.briefing?.nextBody ?? ""}`,
      /ship/i,
    );

    const sameCandidates = ABBEY_CANDIDATES;
    const afterThreads = abbeyThread(true);
    const events = projectGmailSourceEvents({
      threadContext: afterThreads,
      founderEmailHashes: new Set([FOUNDER_HASH]),
      candidates: sameCandidates,
    });
    assert.equal(
      events.find((event) => event.messageId === "headed")?.semanticClass,
      "founder_fulfills_commitment",
    );

    const after = todayOf(sameCandidates, afterThreads, abbeyNow);
    const gone = card(after, /Abbey|C026137/i);
    assert.equal(gone.item, undefined);
    assert.equal(gone.watching, undefined);

    const flags = deriveTodayFreshnessInvalidation({
      indexedThisCycle: 1,
      inboundMessageIdBefore: "1a0c63dae07e07f9",
      outboundMessageIdBefore: "1a0c5dc99d6a59e2",
      inboundMessageIdAfter: "1a0c63dae07e07f9",
      outboundMessageIdAfter: "headed",
      insertedCount: 0,
    });
    assert.equal(flags.sourceEventsChanged, true);
    assert.equal(flags.candidatesChanged, false);
    assert.equal(flags.docketMayHaveChanged, true);
    assert.equal(shouldRefreshTodaySurface(flags.docketMayHaveChanged), true);
  });

  it("Today refreshes from the source-event flag and does not reload the page", () => {
    const ui = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/gmail-operating-freshness.tsx"),
      "utf8",
    );
    assert.match(ui, /shouldRefreshTodaySurface\(result\.docketMayHaveChanged\)/);
    assert.match(ui, /router\.refresh\(\)/);
    assert.doesNotMatch(ui, /location\.reload/);
    assert.match(ui, /visibilitychange/);
    assert.match(ui, /document\.hidden/);
  });
});
