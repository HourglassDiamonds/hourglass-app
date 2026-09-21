import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import { ChiefOfStaffToday } from "../../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import { composeCosOperatingLoop } from "./compose";
import {
  authoritativeTodayDocket,
  composeTodayDocket,
  TODAY_DOCKET_VERSION,
  type CosTodayDocketView,
} from "./docket";
import { selectFounderControls } from "./founder-actions";
import { fixtureCandidate } from "./fixtures";
import type {
  CosFounderAttentionItem,
  CosOperatingLoopView,
  CosProjectContext,
  CosProposedAction,
} from "./types";

const NOW = "2026-09-19T16:00:00.000Z";
const FOUNDER_HASH = hashEmail("justin@hourglassdiamonds.com")!;
const NIURKA_EMAIL = "niurka@vlorajewelry.com";
const NIURKA_HASH = hashEmail(NIURKA_EMAIL)!;
const NIVODA_EMAIL = "supply@nivoda.com";
const SARAH_CLIENT_THREAD = "sarah-client-thread";
const SARAH_VENDOR_THREAD = "sarah-vendor-thread";
const ABBEY_THREAD = "abbey-thread";
const NIVODA_SOLD_THREAD = "nivoda-sold-thread";
const NIVODA_SUPPORT_THREAD = "nivoda-support-thread";
const GMAIL = "https://mail.google.com/mail/u/0/#all";

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
    projects?: Map<string, CosProjectContext>;
    knownPeople?: Parameters<typeof composeCosOperatingLoop>[0]["knownPeople"];
    vendorDirectory?: readonly string[];
  },
) {
  const loop = composeCosOperatingLoop({
    jobs: [],
    candidates,
    projects: options?.projects ?? new Map(),
    nowIso: NOW,
    threadContext: options?.threadContext,
    knownPeople: options?.knownPeople ?? [
      {
        personId: "niurka-vendor-contact",
        displayName: "Niurka Lulo",
        roles: ["vendor-contact"],
        organizationName: "Vlora",
        emailHash: NIURKA_HASH,
      },
    ],
    vendorDirectory: options?.vendorDirectory ?? ["vlora"],
  });
  return { loop, docket: composeTodayDocket(loop) };
}

function nivodaCandidates(): ContinuumCandidate[] {
  return [
    gmailRow({
      candidateId: "nivoda-assoc",
      sourceRef: `gc1|${NIVODA_SOLD_THREAD}|nivoda-sold`,
      sourceTimestamp: "2026-09-18T12:00:00.000Z",
      candidateType: "person_association",
      proposedTarget: { kind: "person", personId: null },
      payload: {
        kind: "person_association",
        displayName: "Nivoda",
        emailHash: hashEmail(NIVODA_EMAIL),
        mintPerson: false,
        mergePersons: false,
      },
      evidenceBasis: { ruleIds: ["unresolved_email_hash"], matchedText: "Nivoda" },
    }),
    gmailRow({
      candidateId: "nivoda-sold-note",
      sourceRef: `gc1|${NIVODA_SOLD_THREAD}|nivoda-sold`,
      sourceTimestamp: "2026-09-18T12:00:00.000Z",
      candidateType: "note",
      payload: { kind: "note", text: "1 item is sold out", contextLayer: null },
      evidenceBasis: {
        ruleIds: ["gmail_participant"],
        matchedText: "Nivoda - 1 item is sold out",
      },
    }),
    gmailRow({
      candidateId: "nivoda-support-note",
      sourceRef: `gc1|${NIVODA_SUPPORT_THREAD}|nivoda-support`,
      sourceTimestamp: "2026-09-18T12:05:00.000Z",
      candidateType: "note",
      payload: {
        kind: "note",
        text: "please do not hesitate to get in touch by emailing support@nivoda",
        contextLayer: null,
      },
      evidenceBasis: {
        ruleIds: ["gmail_participant"],
        matchedText: "please do not hesitate to get in touch by emailing support@nivoda",
      },
    }),
  ];
}

function nivodaThreads(): Map<string, TodayGmailThreadContext> {
  return new Map([
    [
      NIVODA_SOLD_THREAD,
      {
        subject: "Nivoda - 1 item is sold out",
        fromDisplayName: "Nivoda",
        fromEmail: NIVODA_EMAIL,
        messages: [
          {
            messageId: "nivoda-sold",
            sentAt: "2026-09-18T12:00:00.000Z",
            direction: "inbound",
          },
        ],
      },
    ],
    [
      NIVODA_SUPPORT_THREAD,
      {
        subject: "Nivoda order update",
        fromDisplayName: "Nivoda",
        messages: [
          {
            messageId: "nivoda-support",
            sentAt: "2026-09-18T12:05:00.000Z",
            direction: "inbound",
          },
        ],
      },
    ],
  ]);
}

function abbeyCandidates(): ContinuumCandidate[] {
  return [
    gmailRow({
      candidateId: "abbey-stl",
      sourceRef: `gc1|${ABBEY_THREAD}|abbey-stl`,
      sourceTimestamp: "2026-09-15T18:00:00.000Z",
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
      sourceRef: `gc1|${ABBEY_THREAD}|abbey-print`,
      sourceTimestamp: "2026-09-15T18:30:00.000Z",
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
      candidateId: "abbey-new-project",
      sourceRef: `gc1|${ABBEY_THREAD}|abbey-new`,
      sourceTimestamp: "2026-09-14T16:00:00.000Z",
      candidateType: "open_job",
      payload: {
        kind: "open_job",
        jobKind: "request",
        subject: "New earrings",
        detail: "Can we start a new earrings project?",
        waitingOnActor: "founder",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_new_project_request"],
        matchedText: "Can we start a new earrings project?",
      },
    }),
  ];
}

function abbeyThreads(): Map<string, TodayGmailThreadContext> {
  return new Map([
    [
      ABBEY_THREAD,
      {
        subject: "RE: HGD x Abbey-C026137",
        fromDisplayName: "Niurka Lulo",
        fromEmail: NIURKA_EMAIL,
        messages: [
          {
            messageId: "abbey-new",
            sentAt: "2026-09-14T16:00:00.000Z",
            direction: "inbound",
          },
          {
            messageId: "abbey-stl",
            sentAt: "2026-09-15T18:00:00.000Z",
            direction: "inbound",
            fromEmailHash: NIURKA_HASH,
          },
          {
            messageId: "abbey-print",
            sentAt: "2026-09-15T18:30:00.000Z",
            direction: "outbound",
            fromEmailHash: FOUNDER_HASH,
          },
        ],
      },
    ],
  ]);
}

function sarahCandidates(): ContinuumCandidate[] {
  return [
    gmailRow({
      candidateId: "sarah-client-in",
      sourceRef: `gc1|${SARAH_CLIENT_THREAD}|sarah-client-in`,
      sourceTimestamp: "2026-09-16T14:00:00.000Z",
      candidateType: "open_job",
      payload: {
        kind: "open_job",
        jobKind: "request",
        subject: "design reply",
        detail: "I like the updated gallery. What do you think we should do next?",
        waitingOnActor: "founder",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_cad_feedback", "explicit_client_request"],
        matchedText: "I like the updated gallery. What do you think we should do next?",
      },
    }),
    gmailRow({
      candidateId: "sarah-lab-grown",
      sourceRef: `gc1|${SARAH_CLIENT_THREAD}|sarah-lab-out`,
      sourceTimestamp: "2026-09-16T16:10:00.000Z",
      candidateType: "project_context",
      payload: {
        kind: "project_context",
        topic: "design_refinement",
        value: "Lab Grown diamonds with C026143",
      },
      evidenceBasis: {
        ruleIds: ["explicit_design_refinement"],
        matchedText: "Lab Grown diamonds with C026143",
      },
    }),
    gmailRow({
      candidateId: "sarah-vendor-out",
      sourceRef: `gc1|${SARAH_VENDOR_THREAD}|sarah-vendor-out`,
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
      sourceRef: `gc1|${SARAH_VENDOR_THREAD}|sarah-vendor-in`,
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

function sarahThreads(): Map<string, TodayGmailThreadContext> {
  return new Map([
    [
      SARAH_CLIENT_THREAD,
      {
        subject: "RE: HGD x Sarah CAD",
        fromDisplayName: "S. Leishman",
        fromEmail: "sarah@example.test",
        messages: [
          {
            messageId: "sarah-client-in",
            sentAt: "2026-09-16T14:00:00.000Z",
            direction: "inbound",
          },
          {
            messageId: "sarah-lab-out",
            sentAt: "2026-09-16T16:10:00.000Z",
            direction: "outbound",
            fromEmailHash: FOUNDER_HASH,
          },
        ],
      },
    ],
    [
      SARAH_VENDOR_THREAD,
      {
        subject: "RE: HGD x Sarah-C026143",
        fromDisplayName: "Niurka Lulo",
        fromEmail: NIURKA_EMAIL,
        messages: [
          {
            messageId: "sarah-vendor-out",
            sentAt: "2026-09-16T17:40:00.000Z",
            direction: "outbound",
            fromEmailHash: FOUNDER_HASH,
          },
          {
            messageId: "sarah-vendor-in",
            sentAt: "2026-09-16T18:20:00.000Z",
            direction: "inbound",
            fromEmailHash: NIURKA_HASH,
          },
        ],
      },
    ],
  ]);
}

function overflowCandidates(): ContinuumCandidate[] {
  return Array.from({ length: 8 }, (_, index) =>
    gmailRow({
      candidateId: `overflow-${index}`,
      sourceRef: `gc1|overflow-thread-${index}|overflow-msg-${index}`,
      sourceTimestamp: `2026-09-18T1${index}:00:00.000Z`,
      candidateType: "open_job",
      payload: {
        kind: "open_job",
        jobKind: "commitment",
        subject: `Send chain options ${index}`,
        detail: `I'll send the chain options and pricing today ${index}.`,
        waitingOnActor: "founder",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_founder_commitment"],
        matchedText: `I'll send the chain options and pricing today ${index}.`,
      },
    }),
  );
}

function overflowThreads(): Map<string, TodayGmailThreadContext> {
  return new Map(
    Array.from({ length: 8 }, (_, index) => [
      `overflow-thread-${index}`,
      {
        subject: `RE: HGD x Overflow${index}-C02990${index}`,
        fromDisplayName: `Overflow ${index}`,
        fromEmail: `overflow${index}@example.test`,
        messages: [
          {
            messageId: `overflow-msg-${index}`,
            sentAt: `2026-09-18T1${index}:00:00.000Z`,
            direction: "outbound",
            fromEmailHash: FOUNDER_HASH,
          },
        ],
      } satisfies TodayGmailThreadContext,
    ]),
  );
}

function liveShape() {
  return todayOf(
    [
      ...overflowCandidates(),
      ...nivodaCandidates(),
      ...abbeyCandidates(),
      ...sarahCandidates(),
    ],
    {
      threadContext: new Map([
        ...overflowThreads(),
        ...nivodaThreads(),
        ...abbeyThreads(),
        ...sarahThreads(),
      ]),
    },
  );
}

function proposedAction(candidateId: string, sourceHref: string, sourceLabel: string): CosProposedAction {
  return {
    id: `proposed:${candidateId}`,
    candidateId,
    sourceId: candidateId,
    headline: "Review this",
    sourceLabel,
    sourceHref,
    projectId: null,
    projectTitle: null,
    canAddToActions: true,
    canDismiss: true,
    mutationId: "mutation-test",
  };
}

function poisonParallelProducers(loop: CosOperatingLoopView): CosOperatingLoopView {
  const nivodaDecision: CosFounderAttentionItem = {
    id: "attention:nivoda-sold",
    lane: "decision",
    title: "Unassigned",
    headline: "Send the recap and next step.",
    detail: "please do not hesitate to get in touch by emailing support@nivoda",
    projectId: null,
    projectTitle: null,
    sourceLabel: "Nivoda - 1 item is sold out",
    sourceHref: `${GMAIL}/${NIVODA_SOLD_THREAD}/nivoda-sold`,
    candidateIds: ["nivoda-assoc", "nivoda-sold-note"],
    recap: null,
    proposedAction: proposedAction(
      "nivoda-sold-note",
      `${GMAIL}/${NIVODA_SOLD_THREAD}/nivoda-sold`,
      "Nivoda - 1 item is sold out",
    ),
    specConflict: null,
  };
  const nivodaDuplicate: CosFounderAttentionItem = {
    ...nivodaDecision,
    id: "attention:nivoda-support",
    sourceLabel: "Nivoda order update",
    sourceHref: `${GMAIL}/${NIVODA_SUPPORT_THREAD}/nivoda-support`,
    candidateIds: ["nivoda-support-note"],
    proposedAction: proposedAction(
      "nivoda-support-note",
      `${GMAIL}/${NIVODA_SUPPORT_THREAD}/nivoda-support`,
      "Nivoda order update",
    ),
  };
  const abbeyDecision: CosFounderAttentionItem = {
    id: "attention:abbey-new-project",
    lane: "decision",
    title: "Unassigned",
    headline: "New Project confirmation.",
    detail: null,
    projectId: null,
    projectTitle: null,
    sourceLabel: "RE: HGD x Abbey-C026137",
    sourceHref: `${GMAIL}/${ABBEY_THREAD}/abbey-new`,
    candidateIds: ["abbey-new-project"],
    recap: null,
    proposedAction: proposedAction(
      "abbey-new-project",
      `${GMAIL}/${ABBEY_THREAD}/abbey-new`,
      "RE: HGD x Abbey-C026137",
    ),
    specConflict: null,
  };
  return {
    ...loop,
    needsYourDecision: [...loop.needsYourDecision, nivodaDecision, nivodaDuplicate, abbeyDecision],
  };
}

function renderedHay(docket: CosTodayDocketView): string {
  return [
    ...docket.items.map((item) => `${item.subject} ${item.headline} ${item.context ?? ""}`),
    ...docket.watching.map((row) => `${row.title} ${row.detail} ${row.briefing?.stand ?? ""} ${row.briefing?.headline ?? ""}`),
  ].join("\n");
}

describe("authenticated Today render path consumes the final docket only", () => {
  it("command-center passes the finalized docket, not the raw operating loop", () => {
    const command = readFileSync(
      join(
        process.cwd(),
        "app",
        "executive-dashboard",
        "concierge",
        "components",
        "command-center-home.tsx",
      ),
      "utf8",
    );
    assert.match(command, /composeTodayDocket\(operatingLoop\)/);
    assert.match(command, /docket=\{composeTodayDocket\(operatingLoop\)\}/);
    assert.doesNotMatch(command, /loop=\{operatingLoop\}/);
  });

  it("every rendered live-shaped card carries the final-docket marker", () => {
    const { docket, loop } = liveShape();
    assert.equal(docket.todayDocketVersion, TODAY_DOCKET_VERSION);
    for (const item of docket.items) {
      assert.equal(item.todayDocketVersion, TODAY_DOCKET_VERSION, item.id);
      if (item.origin !== "master_sprint") {
        assert.ok(item.briefingPacket, item.id);
      }
    }
    for (const row of docket.watching) {
      assert.equal(row.todayDocketVersion, TODAY_DOCKET_VERSION, row.id);
      assert.ok(row.briefingPacket, row.id);
    }
    const html = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, { docket: composeTodayDocket(loop) }),
    );
    assert.doesNotMatch(html, /authoritative_v1|todayDocketVersion/i);
  });

  it("legacy cards without the final packet fail closed", () => {
    const { docket } = liveShape();
    const forged = {
      ...docket,
      todayDocketVersion: "pre_final_loop_brief",
      items: [
        {
          id: "legacy-nivoda",
          lane: "live_work" as const,
          origin: "decision" as const,
          subject: "Unassigned",
          headline: "Send the recap and next step.",
          context: "Nivoda - 1 item is sold out",
          job: null,
          brief: null,
          decision: null,
          anomaly: null,
        },
      ],
      watching: [
        {
          id: "legacy-sarah",
          title: "Sarah / S. Leishman",
          detail: "You already wrote. Lab Grown diamonds with.",
          projectId: null,
        },
      ],
    } as unknown as CosTodayDocketView;
    const closed = authoritativeTodayDocket(forged);
    assert.equal(closed.items.length, 0);
    assert.equal(closed.watching.length, 0);
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, { docket: forged }));
    assert.doesNotMatch(html, /Send the recap and next step/i);
    assert.doesNotMatch(html, /Confirm person/i);
    assert.doesNotMatch(html, /Lab Grown diamonds with/i);
    assert.doesNotMatch(html, /New Project confirmation/i);
  });

  it("Nivoda is absent even when parallel decision seeds try to reconstitute it", () => {
    const { loop } = liveShape();
    const poisoned = poisonParallelProducers(loop);
    const docket = composeTodayDocket(poisoned);
    const hay = renderedHay(docket);
    assert.doesNotMatch(hay, /Nivoda|sold out|support@nivoda|Send the recap/i);
    assert.equal(
      docket.items.some((item) =>
        /Nivoda|sold out|support@/i.test(`${item.subject} ${item.headline} ${item.context ?? ""}`) &&
        selectFounderControls(item).confirmPerson != null,
      ),
      false,
    );
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, { docket }));
    assert.doesNotMatch(html, /Nivoda/i);
    assert.doesNotMatch(html, /support@nivoda/i);
  });

  it("duplicate Nivoda producers collapse to zero rendered cards, not two Unassigned recaps", () => {
    const { loop } = liveShape();
    const poisoned = poisonParallelProducers(loop);
    const docket = composeTodayDocket(poisoned);
    const nivodaCards = [
      ...docket.items.filter((item) => /Nivoda|sold out|support@/i.test(`${item.subject} ${item.headline} ${item.context ?? ""}`)),
      ...docket.watching.filter((row) => /Nivoda|sold out|support@/i.test(`${row.title} ${row.detail}`)),
    ];
    assert.equal(nivodaCards.length, 0);
    const ids = docket.items.map((item) => item.id);
    assert.equal(ids.length, new Set(ids).size);
  });

  it("Abbey C026137 keeps the print/check packet over Unassigned New Project confirmation", () => {
    const { loop, docket } = liveShape();
    const poisoned = composeTodayDocket(poisonParallelProducers(loop));
    const hay = `${renderedHay(docket)}\n${renderedHay(poisoned)}`;
    const abbey =
      [...poisoned.items, ...poisoned.watching].find((row) =>
        /Abbey|C026137/i.test("subject" in row ? `${row.subject} ${row.headline}` : `${row.title} ${row.detail}`),
      ) ??
      [...docket.items, ...docket.watching].find((row) =>
        /Abbey|C026137/i.test("subject" in row ? `${row.subject} ${row.headline}` : `${row.title} ${row.detail}`),
      );
    assert.ok(abbey, `Abbey missing from ${hay}`);
    assert.notEqual("subject" in abbey ? abbey.subject : abbey.title, "Unassigned");
    assert.doesNotMatch(hay, /New Project confirmation/i);
    assert.equal(abbey.briefingPacket?.ballHolder, "founder");
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, { docket: poisoned }));
    assert.doesNotMatch(html, /New Project confirmation/i);
    assert.match(html, /Abbey \/ C026137/);
  });

  it("Sarah C026143 is one Watching vendor_shop card with natural CoS copy", () => {
    const { docket } = liveShape();
    const sarahItems = docket.items.filter((item) => /Sarah|Leishman|C026143/i.test(`${item.subject} ${item.headline}`));
    const sarahWatching = docket.watching.filter((row) => /Sarah|Leishman|C026143/i.test(`${row.title} ${row.detail}`));
    assert.equal(sarahItems.length, 0);
    assert.equal(sarahWatching.length, 1);
    const card = sarahWatching[0]!;
    assert.equal(card.briefingPacket?.ballHolder, "vendor_shop");
    assert.equal(card.briefing?.stateChip, "WAITING ON SHOP");
    assert.match(card.briefing?.nextLabel ?? "", /Nothing from you/i);
    assert.doesNotMatch(
      `${card.detail} ${card.briefing?.stand ?? ""} ${card.briefing?.headline ?? ""}`,
      /WAITING ON CLIENT|Sarah has the next turn|You already wrote\. Lab Grown diamonds with/i,
    );
  });

  it("pre-finalization brief cap cannot hide Abbey/Sarah behind overflow work", () => {
    const { loop, docket } = liveShape();
    assert.equal(loop.brief.length > 5, true);
    const abbey = [...docket.items, ...docket.watching].find((row) =>
      /Abbey|C026137/i.test("subject" in row ? `${row.subject} ${row.headline}` : `${row.title} ${row.detail}`),
    );
    const sarah = docket.watching.find((row) => /Sarah|C026143/i.test(row.title));
    assert.ok(abbey);
    assert.ok(sarah);
    assert.equal(sarah.briefingPacket?.ballHolder, "vendor_shop");
  });
});
