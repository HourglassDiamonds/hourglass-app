import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import { ChiefOfStaffToday } from "../../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket, isActionableTodayDocketItem } from "./docket";
import { inspectFinalizedTodayDocket, hasRealFounderOwnedObligation } from "./today-docket-boundary";
import { selectFounderControls } from "./founder-actions";
import { fixtureCandidate, fixtureJob, COS_LOOP_PROJECT_A } from "./fixtures";
import type { CosProjectContext } from "./types";

const NOW = "2026-09-19T16:00:00.000Z";
const FOUNDER_HASH = hashEmail("justin@hourglassdiamonds.com")!;
const NIURKA_EMAIL = "niurka@vlorajewelry.com";
const NIURKA_HASH = hashEmail(NIURKA_EMAIL)!;
const NIVODA_EMAIL = "supply@nivoda.com";
const SARAH_CLIENT_THREAD = "sarah-client-thread";
const SARAH_VENDOR_THREAD = "sarah-vendor-thread";
const ABBEY_THREAD = "abbey-thread";
const LISA_THREAD = "lisa-thread";
const TRAVIS_PROJECT = "travis-chicken-project";

function gmailRow(
  extra: Partial<ContinuumCandidate> & Pick<ContinuumCandidate, "candidateId">,
): ContinuumCandidate {
  return fixtureCandidate({
    sourceSystem: "gmail",
    proposedTarget: { kind: "none" },
    ...extra,
  });
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
  ];
}

function todayOf(
  candidates: ContinuumCandidate[],
  options?: {
    threadContext?: Map<string, TodayGmailThreadContext>;
    projects?: Map<string, CosProjectContext>;
    jobs?: Parameters<typeof composeCosOperatingLoop>[0]["jobs"];
    knownPeople?: Parameters<typeof composeCosOperatingLoop>[0]["knownPeople"];
    vendorDirectory?: readonly string[];
  },
) {
  const loop = composeCosOperatingLoop({
    jobs: options?.jobs ?? [],
    candidates,
    projects: options?.projects ?? new Map(),
    nowIso: NOW,
    threadContext: options?.threadContext,
    knownPeople: options?.knownPeople ?? niurkaPeople(),
    vendorDirectory: options?.vendorDirectory ?? ["vlora"],
  });
  return { loop, docket: composeTodayDocket(loop) };
}

function sarahDuplicateCandidates(): ContinuumCandidate[] {
  return [
    gmailRow({
      candidateId: "sarah-recap",
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
      candidateId: "sarah-out",
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
        fromDisplayName: "Sarah Leishman",
        fromEmail: "sarah@example.test",
        messages: [
          {
            messageId: "sarah-client-in",
            sentAt: "2026-09-16T14:00:00.000Z",
            direction: "inbound",
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

function docketHay(docket: ReturnType<typeof composeTodayDocket>): string {
  return [
    ...docket.items.map((item) => `${item.subject} ${item.headline} ${item.context ?? ""}`),
    ...docket.watching.map((row) => `${row.title} ${row.detail}`),
  ].join("\n");
}

describe("Today one authoritative docket boundary", () => {
  it("A: Sarah cannot appear in both Up Next and Watching", () => {
    const { docket } = todayOf(sarahDuplicateCandidates(), { threadContext: sarahThreads() });
    const up = docket.items.filter((item) => /Sarah/i.test(`${item.subject} ${item.headline}`));
    const watching = docket.watching.filter((row) => /Sarah/i.test(`${row.title} ${row.detail}`));
    assert.equal(up.length + watching.length <= 1, true);
    assert.equal(up.length, 0);
  });

  it("B: Sarah C026143 resolves vendor_shop / WAITING ON SHOP", () => {
    const { docket } = todayOf(sarahDuplicateCandidates(), { threadContext: sarahThreads() });
    const card = docket.watching.find((row) => /Sarah|C026143/i.test(row.title)) ??
      docket.items.find((item) => /Sarah|C026143/i.test(item.subject));
    assert.ok(card);
    const packet =
      "briefingPacket" in card
        ? (card as { briefingPacket?: { ballHolder?: string } }).briefingPacket
        : null;
    const watching = docket.watching.find((row) => /Sarah|C026143/i.test(row.title));
    assert.ok(watching);
    assert.equal(watching.briefingPacket?.ballHolder, "vendor_shop");
    assert.equal(watching.briefing?.stateChip, "WAITING ON SHOP");
    assert.match(watching.briefing?.nextLabel ?? "", /Nothing from you/i);
    assert.doesNotMatch(watching.title, /^Vlora$/i);
    void packet;
  });

  it("C: known vendor cannot produce Confirm Person", () => {
    const { docket, loop } = todayOf(
      [
        gmailRow({
          candidateId: "niurka-assoc",
          sourceRef: "gc1|grant-thread|grant-in",
          sourceTimestamp: "2026-09-16T18:20:00.000Z",
          candidateType: "person_association",
          proposedTarget: { kind: "person", personId: null },
          payload: {
            kind: "person_association",
            displayName: "Niurka",
            emailHash: NIURKA_HASH,
            mintPerson: false,
            mergePersons: false,
          },
          evidenceBasis: { ruleIds: ["unresolved_email_hash"], matchedText: "Niurka" },
        }),
        gmailRow({
          candidateId: "grant-stl",
          sourceRef: "gc1|grant-thread|grant-in",
          sourceTimestamp: "2026-09-16T18:20:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "STL attached",
            detail: "Mod 1 STL attached",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_waiting"],
            matchedText: "Mod 1 STL attached for F.Grant-C025885",
          },
        }),
      ],
      {
        threadContext: new Map([
          [
            "grant-thread",
            {
              subject: "RE: HGD x F.Grant-C025885",
              fromDisplayName: "Niurka",
              fromEmail: NIURKA_EMAIL,
              messages: [
                {
                  messageId: "grant-in",
                  sentAt: "2026-09-16T18:20:00.000Z",
                  direction: "inbound",
                  fromEmailHash: NIURKA_HASH,
                },
              ],
            },
          ],
        ]),
      },
    );
    assert.equal(
      docket.items.some((item) => selectFounderControls(item).confirmPerson != null),
      false,
    );
    assert.equal(
      loop.brief.some((row) => row.actions.some((action) => action.kind === "confirm_person")),
      false,
    );
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, { loop }));
    assert.doesNotMatch(html, /Confirm person/i);
  });

  it("D: known supplier/system cannot produce Confirm Person", () => {
    const { docket, loop } = todayOf(
      [
        gmailRow({
          candidateId: "nivoda-assoc",
          sourceRef: "gc1|nivoda-thread|nivoda-in",
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
          candidateId: "nivoda-note",
          sourceRef: "gc1|nivoda-thread|nivoda-in",
          sourceTimestamp: "2026-09-18T12:00:00.000Z",
          candidateType: "note",
          payload: { kind: "note", text: "Diamond memo available.", contextLayer: null },
          evidenceBasis: { ruleIds: ["gmail_participant"], matchedText: "Diamond memo available." },
        }),
      ],
      {
        threadContext: new Map([
          [
            "nivoda-thread",
            {
              subject: "Supply update",
              fromDisplayName: "Nivoda",
              fromEmail: NIVODA_EMAIL,
              messages: [
                {
                  messageId: "nivoda-in",
                  sentAt: "2026-09-18T12:00:00.000Z",
                  direction: "inbound",
                },
              ],
            },
          ],
        ]),
        knownPeople: [],
        vendorDirectory: [],
      },
    );
    assert.equal(docket.items.some((item) => selectFounderControls(item).confirmPerson != null), false);
    assert.equal(
      docket.items.some((item) => /Nivoda|supply@/i.test(`${item.subject} ${item.headline}`)),
      false,
    );
    assert.equal(
      loop.brief.some((row) => row.actions.some((action) => action.kind === "confirm_person")),
      false,
    );
  });

  it("E: founder decline is absent from both Up Next and Watching", () => {
    const inboundText = "I'll send the free signup link.";
    const outboundText = ["No thank you.", "", "On Fri, Lisa wrote:", inboundText].join("\n");
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "lisa-in",
          sourceRef: `gc1|${LISA_THREAD}|lisa-in`,
          sourceTimestamp: "2026-09-18T22:42:23.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "commitment",
            subject: inboundText,
            detail: inboundText,
            waitingOnActor: "client",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_external_commitment"],
            matchedText: inboundText,
          },
        }),
        gmailRow({
          candidateId: "lisa-out",
          sourceRef: `gc1|${LISA_THREAD}|lisa-out`,
          sourceTimestamp: "2026-09-19T11:40:01.000Z",
          candidateType: "project_context",
          payload: { kind: "project_context", topic: "client_approval", value: "No thank you." },
          evidenceBasis: { ruleIds: ["gmail_participant"], matchedText: outboundText },
        }),
      ],
      {
        threadContext: new Map([
          [
            LISA_THREAD,
            {
              subject: "INVENTORY PLANNING FOR HOURGLASS DIAMONDS",
              fromDisplayName: "Lisa",
              fromEmail: "lisa@vendor.test",
              messages: [
                {
                  messageId: "lisa-in",
                  sentAt: "2026-09-18T22:42:23.000Z",
                  direction: "inbound",
                },
                {
                  messageId: "lisa-out",
                  sentAt: "2026-09-19T11:40:01.000Z",
                  direction: "outbound",
                  fromEmailHash: FOUNDER_HASH,
                },
              ],
            },
          ],
        ]),
        knownPeople: [],
      },
    );
    assert.doesNotMatch(docketHay(docket), /Lisa|signup link|INVENTORY/i);
    assert.equal(docket.items.length, 0);
    assert.equal(docket.watching.length, 0);
  });

  it("F: quoted inbound commitment cannot survive as founder Watching state", () => {
    const inboundText = "I'll send the free signup link.";
    const outboundText = ["No thank you.", "", "On Fri, Lisa wrote:", inboundText].join("\n");
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "lisa-in",
          sourceRef: `gc1|${LISA_THREAD}|lisa-in`,
          sourceTimestamp: "2026-09-18T22:42:23.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "commitment",
            subject: inboundText,
            detail: inboundText,
            waitingOnActor: "client",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_external_commitment"],
            matchedText: inboundText,
          },
        }),
        gmailRow({
          candidateId: "lisa-out",
          sourceRef: `gc1|${LISA_THREAD}|lisa-out`,
          sourceTimestamp: "2026-09-19T11:40:01.000Z",
          candidateType: "project_context",
          payload: { kind: "project_context", topic: "client_approval", value: "No thank you." },
          evidenceBasis: { ruleIds: ["gmail_participant"], matchedText: outboundText },
        }),
      ],
      {
        threadContext: new Map([
          [
            LISA_THREAD,
            {
              subject: "INVENTORY PLANNING FOR HOURGLASS DIAMONDS",
              fromDisplayName: "Lisa",
              fromEmail: "lisa@vendor.test",
              messages: [
                { messageId: "lisa-in", sentAt: "2026-09-18T22:42:23.000Z", direction: "inbound" },
                {
                  messageId: "lisa-out",
                  sentAt: "2026-09-19T11:40:01.000Z",
                  direction: "outbound",
                  fromEmailHash: FOUNDER_HASH,
                },
              ],
            },
          ],
        ]),
        knownPeople: [],
      },
    );
    assert.doesNotMatch(docketHay(docket), /You already wrote.*signup|I'll send the free signup/i);
    assert.equal(
      docket.watching.some((row) => /signup/i.test(`${row.title} ${row.detail} ${row.briefing?.stand ?? ""}`)),
      false,
    );
  });

  it("G: one project has one active Today representation", () => {
    const projectId = "sarah-project";
    const { docket } = todayOf(sarahDuplicateCandidates(), {
      threadContext: sarahThreads(),
      projects: new Map([
        [
          projectId,
          {
            projectId,
            title: "Sarah / C026143",
            personName: "Sarah Leishman",
            people: [
              { personId: "sarah-person", displayName: "Sarah Leishman", role: "client" },
              {
                personId: "niurka-vendor-contact",
                displayName: "Niurka Lulo",
                role: "vendor-contact",
                organizationName: "Vlora",
              },
            ],
            isCurrent: true,
            specs: [{ fieldName: "cad_job_number", value: "C026143" }],
            gmailThreadId: SARAH_VENDOR_THREAD,
          },
        ],
      ]),
    });
    const cards = [
      ...docket.items.filter((item) => item.projectId === projectId || /Sarah|C026143/i.test(item.subject)),
      ...docket.watching.filter((row) => row.projectId === projectId || /Sarah|C026143/i.test(row.title)),
    ];
    assert.equal(cards.length, 1);
  });

  it("H: closed project cannot survive due solely to stale lifecycle evidence", () => {
    const { docket } = todayOf([], {
      jobs: [
        fixtureJob({
          jobId: "travis-job",
          projectId: TRAVIS_PROJECT,
          subject: "Chicken ring production",
          waitingOnActor: "vendor",
          kind: "required_action",
        }),
      ],
      projects: new Map([
        [
          TRAVIS_PROJECT,
          {
            projectId: TRAVIS_PROJECT,
            title: "Chicken ring",
            personName: "Travis Morse",
            people: [{ personId: "travis-person", displayName: "Travis Morse", role: "client" }],
            isCurrent: false,
            lifecycleStage: "production",
          },
        ],
      ]),
      knownPeople: [],
    });
    assert.doesNotMatch(docketHay(docket), /Travis|Chicken ring/i);
    assert.equal(
      docket.items.some((item) => /Travis|Chicken/i.test(`${item.subject} ${item.headline}`)),
      false,
    );
    assert.equal(
      docket.watching.some((row) => /Travis|Chicken/i.test(`${row.title} ${row.detail}`)),
      false,
    );
  });

  it("I: vendor organization does not become a contextless Today card when the project is known", () => {
    const { docket } = todayOf(sarahDuplicateCandidates(), {
      threadContext: sarahThreads(),
      projects: new Map([
        [
          "sarah-project",
          {
            projectId: "sarah-project",
            title: "Sarah / C026143",
            personName: "Sarah Leishman",
            people: [
              { personId: "sarah-person", displayName: "Sarah Leishman", role: "client" },
              {
                personId: "niurka-vendor-contact",
                displayName: "Niurka Lulo",
                role: "vendor-contact",
                organizationName: "Vlora",
              },
            ],
            isCurrent: true,
            specs: [{ fieldName: "cad_job_number", value: "C026143" }],
            gmailThreadId: SARAH_VENDOR_THREAD,
          },
        ],
      ]),
    });
    assert.equal(
      docket.watching.some((row) => /^Vlora$/i.test(row.title.trim()) && /waiting on the client/i.test(row.detail)),
      false,
    );
    assert.ok(docket.watching.some((row) => /Sarah/i.test(row.title) && /C026143/i.test(row.title)));
  });

  it("J: internal diagnostic language is not rendered to the founder", () => {
    const { loop, docket } = todayOf(
      [
        gmailRow({
          candidateId: "lucas-shop",
          sourceRef: "gc1|lucas-thread|lucas-in",
          sourceTimestamp: "2026-09-10T12:00:00.000Z",
          candidateType: "project_context",
          proposedTarget: { kind: "project", projectId: COS_LOOP_PROJECT_A },
          payload: { kind: "project_context", topic: "production", value: "Received and in production." },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_waiting"],
            matchedText: "Received and in production.",
          },
        }),
      ],
      {
        threadContext: new Map([
          [
            "lucas-thread",
            {
              subject: "Lucas Kinnin",
              fromDisplayName: "Shop",
              fromEmail: "shop@vlorajewelry.com",
              messages: [
                {
                  messageId: "lucas-in",
                  sentAt: "2026-09-10T12:00:00.000Z",
                  direction: "inbound",
                },
              ],
            },
          ],
        ]),
        projects: new Map([
          [
            COS_LOOP_PROJECT_A,
            {
              projectId: COS_LOOP_PROJECT_A,
              title: "Lucas Kinnin",
              personName: "Lucas Kinnin",
              people: [{ personId: "lucas-person", displayName: "Lucas Kinnin", role: "client" }],
              isCurrent: true,
              lifecycleStage: "production",
              gmailThreadId: "lucas-thread",
            },
          ],
        ]),
      },
    );
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, { loop }));
    assert.doesNotMatch(html, /shop evidence is already/i);
    assert.doesNotMatch(docketHay(docket), /shop evidence is already/i);
  });

  it("K: every final Today card has a normalized briefing packet", () => {
    const { docket } = todayOf(sarahDuplicateCandidates(), { threadContext: sarahThreads() });
    for (const item of docket.items) {
      if (item.origin === "master_sprint") continue;
      assert.ok(item.briefingPacket, `missing packet on ${item.id}`);
    }
    for (const row of docket.watching) {
      assert.ok(row.briefingPacket, `missing watching packet on ${row.id}`);
    }
  });

  it("L: Abbey current disposition remains evidence-driven", () => {
    const { docket } = todayOf(
      [
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
        ...sarahDuplicateCandidates(),
      ],
      {
        threadContext: new Map([
          [
            ABBEY_THREAD,
            {
              subject: "RE: HGD x Abbey-C026137",
              fromDisplayName: "Niurka Lulo",
              fromEmail: NIURKA_EMAIL,
              messages: [
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
          ...sarahThreads(),
        ]),
      },
    );
    const abbey = [...docket.items, ...docket.watching].find((row) =>
      /Abbey|C026137/i.test("subject" in row ? `${row.subject} ${row.headline}` : `${row.title} ${row.detail}`),
    );
    assert.ok(
      abbey,
      `Abbey should remain visible from print/check evidence. up=${docket.items.map((item) => item.subject).join("|")} watching=${docket.watching.map((row) => row.title).join("|")}`,
    );
    const packet =
      "briefingPacket" in abbey ? abbey.briefingPacket : null;
    assert.ok(packet);
    assert.equal(packet?.ballHolder, "founder");
    assert.doesNotMatch(`${packet?.displayName} ${docketHay(docket)}`, /RN07247|C021479/);
    const up = docket.items.find((item) => /Abbey|C026137/i.test(item.subject));
    assert.ok(up, "unresolved founder print/check should compete for Up Next");
  });
});

function abbeyPrintCandidates(): ContinuumCandidate[] {
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

function sarahClientWaitOverrideCandidates(): ContinuumCandidate[] {
  return [
    ...sarahDuplicateCandidates(),
    gmailRow({
      candidateId: "sarah-client-out",
      sourceRef: `gc1|${SARAH_CLIENT_THREAD}|sarah-client-out`,
      sourceTimestamp: "2026-09-16T16:00:00.000Z",
      candidateType: "project_context",
      payload: {
        kind: "project_context",
        topic: "design_refinement",
        value: "C026143",
      },
      evidenceBasis: {
        ruleIds: ["explicit_design_refinement"],
        matchedText: "C026143",
      },
    }),
  ];
}

function sarahClientWaitThreads(): Map<string, TodayGmailThreadContext> {
  const threads = sarahThreads();
  const client = threads.get(SARAH_CLIENT_THREAD)!;
  threads.set(SARAH_CLIENT_THREAD, {
    ...client,
    messages: [
      ...client.messages,
      {
        messageId: "sarah-client-out",
        sentAt: "2026-09-16T16:00:00.000Z",
        direction: "outbound",
        fromEmailHash: FOUNDER_HASH,
      },
    ],
  });
  return threads;
}

function founderJob(projectId: string, subject: string) {
  return fixtureJob({
    jobId: `${projectId}-job`,
    projectId,
    subject,
    waitingOnActor: "founder",
    kind: "required_action",
  });
}

describe("Today actionability gate and ball-holder precedence", () => {
  it("A unresolved identity without founder obligation creates no Today item", () => {
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "alex-assoc",
          sourceRef: "gc1|alex-thread|alex-in",
          sourceTimestamp: "2026-09-18T12:00:00.000Z",
          candidateType: "person_association",
          proposedTarget: { kind: "person", personId: null },
          payload: {
            kind: "person_association",
            displayName: "Alex Rivera",
            emailHash: hashEmail("alex@example.test"),
            mintPerson: false,
            mergePersons: false,
          },
          evidenceBasis: { ruleIds: ["unresolved_email_hash"], matchedText: "Alex Rivera" },
        }),
      ],
      {
        threadContext: new Map([
          [
            "alex-thread",
            {
              subject: "Introduction",
              fromDisplayName: "Alex Rivera",
              fromEmail: "alex@example.test",
              messages: [
                {
                  messageId: "alex-in",
                  sentAt: "2026-09-18T12:00:00.000Z",
                  direction: "inbound",
                },
              ],
            },
          ],
        ]),
        knownPeople: [],
      },
    );
    assert.equal(
      docket.items.some((item) => /Alex|Identify who this is from/i.test(`${item.subject} ${item.headline}`)),
      false,
    );
    assert.equal(
      docket.watching.some((row) => /Alex|Identify who this is from/i.test(`${row.title} ${row.detail}`)),
      false,
    );
  });

  it("B supplier/system message without founder obligation creates no Today item", () => {
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "nivoda-assoc",
          sourceRef: "gc1|nivoda-thread|nivoda-in",
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
          candidateId: "nivoda-note",
          sourceRef: "gc1|nivoda-thread|nivoda-in",
          sourceTimestamp: "2026-09-18T12:00:00.000Z",
          candidateType: "note",
          payload: { kind: "note", text: "1 item is sold out", contextLayer: null },
          evidenceBasis: { ruleIds: ["gmail_participant"], matchedText: "Nivoda - 1 item is sold out" },
        }),
      ],
      {
        threadContext: new Map([
          [
            "nivoda-thread",
            {
              subject: "Nivoda - 1 item is sold out",
              fromDisplayName: "Nivoda",
              fromEmail: NIVODA_EMAIL,
              messages: [
                {
                  messageId: "nivoda-in",
                  sentAt: "2026-09-18T12:00:00.000Z",
                  direction: "inbound",
                },
              ],
            },
          ],
        ]),
        knownPeople: [],
        vendorDirectory: [],
      },
    );
    assert.equal(
      docket.items.some((item) => /Nivoda|supply@|sold out|Identify who/i.test(`${item.subject} ${item.headline}`)),
      false,
    );
    assert.equal(
      docket.watching.some((row) => /Nivoda|sold out/i.test(`${row.title} ${row.detail}`)),
      false,
    );
  });

  it("C transactional/no-reply message creates no Today item", () => {
    const fadedEmail = "admin@shop-welcome.test";
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "welcome-assoc",
          sourceRef: "gc1|welcome-thread|welcome-in",
          sourceTimestamp: "2026-09-18T12:00:00.000Z",
          candidateType: "person_association",
          proposedTarget: { kind: "person", personId: null },
          payload: {
            kind: "person_association",
            displayName: "Welcome",
            emailHash: hashEmail(fadedEmail),
            mintPerson: false,
            mergePersons: false,
          },
          evidenceBasis: { ruleIds: ["unresolved_email_hash"], matchedText: "Welcome" },
        }),
        gmailRow({
          candidateId: "welcome-note",
          sourceRef: "gc1|welcome-thread|welcome-in",
          sourceTimestamp: "2026-09-18T12:00:00.000Z",
          candidateType: "note",
          payload: {
            kind: "note",
            text: "Welcome. Please do not reply to this email.",
            contextLayer: null,
          },
          evidenceBasis: {
            ruleIds: ["gmail_participant"],
            matchedText: "Welcome. Please do not reply to this email.",
          },
        }),
      ],
      {
        threadContext: new Map([
          [
            "welcome-thread",
            {
              subject: "Welcome",
              fromDisplayName: "getfadedwithangie",
              fromEmail: fadedEmail,
              messages: [
                {
                  messageId: "welcome-in",
                  sentAt: "2026-09-18T12:00:00.000Z",
                  direction: "inbound",
                },
              ],
            },
          ],
        ]),
        knownPeople: [],
      },
    );
    assert.equal(
      docket.items.some((item) => /Welcome|getfaded|Identify who|do not reply/i.test(`${item.subject} ${item.headline} ${item.context ?? ""}`)),
      false,
    );
    assert.equal(
      docket.watching.some((row) => /Welcome|getfaded|do not reply/i.test(`${row.title} ${row.detail}`)),
      false,
    );
  });

  it("D legitimate founder obligation requiring identity allows Confirm Person", () => {
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "unassigned-reply",
          sourceRef: "gc1|unassigned-thread|unassigned-in",
          sourceTimestamp: "2026-09-18T15:00:00.000Z",
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
      ],
      {
        threadContext: new Map([
          [
            "unassigned-thread",
            {
              subject: "Design thoughts",
              fromDisplayName: null,
              fromEmail: "guest.sender@example.test",
              messages: [
                {
                  messageId: "unassigned-in",
                  sentAt: "2026-09-18T15:00:00.000Z",
                  direction: "inbound",
                },
              ],
            },
          ],
        ]),
        knownPeople: [],
      },
    );
    assert.equal(docket.items.length > 0, true);
    assert.doesNotMatch(docket.items[0]?.headline ?? "", /Identify who this is from/i);
    assert.equal(selectFounderControls(docket.items[0]!).confirmPerson != null, true);
  });

  it("E legitimate founder obligation not requiring identity briefs the obligation, not Confirm Person", () => {
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "aurora-assoc",
          sourceRef: "gc1|aurora-thread|aurora-in",
          sourceTimestamp: "2026-09-18T14:00:00.000Z",
          candidateType: "person_association",
          proposedTarget: { kind: "person", personId: null },
          payload: {
            kind: "person_association",
            displayName: "Aurora Underwood",
            emailHash: hashEmail("aurora@acivmatrix.com"),
            mintPerson: false,
            mergePersons: false,
          },
          evidenceBasis: { ruleIds: ["unresolved_email_hash"], matchedText: "Aurora Underwood" },
        }),
        gmailRow({
          candidateId: "aurora-follow",
          sourceRef: "gc1|aurora-thread|aurora-in",
          sourceTimestamp: "2026-09-18T14:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "walk-ins this month",
            detail: "Can you follow up with me about walk-ins this month?",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request", "explicit_follow_up"],
            matchedText: "Can you follow up with me about walk-ins this month?",
          },
        }),
      ],
      {
        threadContext: new Map([
          [
            "aurora-thread",
            {
              subject: "walk-ins this month",
              fromDisplayName: "Aurora Underwood",
              fromEmail: "aurora@acivmatrix.com",
              messages: [
                {
                  messageId: "aurora-in",
                  sentAt: "2026-09-18T14:00:00.000Z",
                  direction: "inbound",
                },
              ],
            },
          ],
        ]),
        knownPeople: [],
      },
    );
    const card = docket.items.find((item) => /Aurora|walk-ins|follow up/i.test(`${item.subject} ${item.headline}`));
    assert.ok(card, `expected Aurora follow-up in Up Next, got ${docket.items.map((item) => item.subject).join("|")}`);
    assert.doesNotMatch(card?.headline ?? "", /Identify who this is from/i);
    assert.doesNotMatch(card?.briefingPacket?.unresolvedFounderObligation ?? "", /Send the recap/i);
    assert.match(
      card?.briefingPacket?.unresolvedFounderObligation ?? card?.headline ?? "",
      /follow up with me about walk-ins/i,
    );
    assert.match(card?.subject ?? "", /Aurora/i);
    assert.equal(selectFounderControls(card!).confirmPerson, null);
  });

  it("E2 fragment follow-up-with-you is not a current founder obligation", () => {
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "aurora-assoc",
          sourceRef: "gc1|aurora-thread|aurora-in",
          sourceTimestamp: "2026-09-18T14:00:00.000Z",
          candidateType: "person_association",
          proposedTarget: { kind: "person", personId: null },
          payload: {
            kind: "person_association",
            displayName: "Aurora U",
            emailHash: hashEmail("aurora@acivmatrix.com"),
            mintPerson: false,
            mergePersons: false,
          },
          evidenceBasis: { ruleIds: ["unresolved_email_hash"], matchedText: "Aurora U" },
        }),
        gmailRow({
          candidateId: "aurora-note",
          sourceRef: "gc1|aurora-thread|aurora-in",
          sourceTimestamp: "2026-09-18T14:00:00.000Z",
          candidateType: "note",
          payload: {
            kind: "note",
            text: "walk-ins this month / follow up with you",
            contextLayer: null,
          },
          evidenceBasis: {
            ruleIds: ["gmail_participant"],
            matchedText: "walk-ins this month / follow up with you",
          },
        }),
      ],
      {
        threadContext: new Map([
          [
            "aurora-thread",
            {
              subject: "walk-ins this month",
              fromDisplayName: "Aurora U",
              fromEmail: "aurora@acivmatrix.com",
              messages: [
                {
                  messageId: "aurora-in",
                  sentAt: "2026-09-18T14:00:00.000Z",
                  direction: "inbound",
                },
              ],
            },
          ],
        ]),
        knownPeople: [],
      },
    );
    assert.equal(
      docket.items.some((item) => /Aurora|walk-ins|follow up|recap/i.test(`${item.subject} ${item.headline}`)),
      false,
    );
  });

  it("F vendor commitment survives project/client grouping as vendor_shop", () => {
    const { docket } = todayOf(sarahDuplicateCandidates(), { threadContext: sarahThreads() });
    const watching = docket.watching.find((row) => /Sarah|C026143/i.test(row.title));
    assert.ok(watching);
    assert.equal(watching.briefingPacket?.ballHolder, "vendor_shop");
    assert.equal(watching.briefing?.stateChip, "WAITING ON SHOP");
  });

  it("G generic outbound→client wait cannot override unresolved vendor commitment", () => {
    const { docket } = todayOf(sarahClientWaitOverrideCandidates(), {
      threadContext: sarahClientWaitThreads(),
    });
    const watching = docket.watching.find((row) => /Sarah|C026143/i.test(row.title));
    assert.ok(watching, `expected Sarah watching, up=${docket.items.map((item) => item.subject).join("|")} watching=${docket.watching.map((row) => row.title).join("|")}`);
    assert.equal(watching.briefingPacket?.ballHolder, "vendor_shop");
    assert.equal(watching.briefing?.stateChip, "WAITING ON SHOP");
    assert.doesNotMatch(`${watching.detail} ${watching.briefing?.stand ?? ""}`, /Sarah has the next turn/i);
  });

  it("H identifiers never become standalone briefing prose", () => {
    const { docket } = todayOf(sarahClientWaitOverrideCandidates(), {
      threadContext: sarahClientWaitThreads(),
    });
    const hay = docketHay(docket);
    assert.doesNotMatch(hay, /You already wrote\.\s*C026143/i);
    const watching = docket.watching.find((row) => /Sarah|C026143/i.test(row.title));
    assert.ok(watching);
    assert.match(watching.title, /C026143/);
    assert.doesNotMatch(`${watching.detail} ${watching.briefing?.stand ?? ""} ${watching.briefing?.headline ?? ""}`, /^C026143\.?$/m);
  });

  it("I all Up Next cards have a non-null founder-owned current action", () => {
    const { docket } = todayOf([...abbeyPrintCandidates(), ...sarahDuplicateCandidates()], {
      threadContext: new Map([...abbeyThreads(), ...sarahThreads()]),
    });
    assert.equal(docket.items.length > 0, true);
    for (const item of docket.items) {
      if (item.origin === "master_sprint") continue;
      assert.equal(isActionableTodayDocketItem(item), true, item.subject);
      assert.equal(hasRealFounderOwnedObligation(item.briefingPacket), true, item.headline);
      assert.ok(item.briefingPacket?.unresolvedFounderObligation || item.briefingPacket?.candidateNextAction);
    }
  });

  it("J hidden queued cards obey the same actionability rules as the visible top 3", () => {
    const jobs = [
      founderJob("proj-one", "Send chain options and pricing."),
      founderJob("proj-two", "Call the setter about the next wax."),
      founderJob("proj-three", "Email the client the size update."),
      founderJob("proj-four", "Share the CAD recap with the client."),
    ];
    const projects = new Map(
      jobs.map((job, index) => [
        job.projectId,
        {
          projectId: job.projectId,
          title: `Work ${index + 1}`,
          personName: `Client ${index + 1}`,
          people: [{ personId: `person-${index + 1}`, displayName: `Client ${index + 1}`, role: "client" as const }],
          isCurrent: true,
        },
      ]),
    );
    const { loop, docket } = todayOf(
      [
        gmailRow({
          candidateId: "nivoda-noise",
          sourceRef: "gc1|nivoda-thread|nivoda-in",
          sourceTimestamp: "2026-09-18T12:00:00.000Z",
          candidateType: "note",
          payload: { kind: "note", text: "1 item is sold out", contextLayer: null },
          evidenceBasis: { ruleIds: ["gmail_participant"], matchedText: "1 item is sold out" },
        }),
      ],
      {
        jobs,
        projects,
        threadContext: new Map([
          [
            "nivoda-thread",
            {
              subject: "Nivoda - 1 item is sold out",
              fromDisplayName: "Nivoda",
              fromEmail: NIVODA_EMAIL,
              messages: [
                { messageId: "nivoda-in", sentAt: "2026-09-18T12:00:00.000Z", direction: "inbound" },
              ],
            },
          ],
        ]),
        knownPeople: [],
      },
    );
    const ranked = inspectFinalizedTodayDocket(loop);
    const queued = ranked.filter((row) => row.lane === "queued");
    assert.equal(docket.queuedCount > 0, true);
    assert.equal(queued.length, docket.queuedCount);
    for (const row of queued) {
      assert.equal(row.ballHolder, "founder");
      assert.ok(row.founderObligation);
      assert.doesNotMatch(row.displayName, /Nivoda|Identify who/i);
    }
    assert.equal(
      ranked.some((row) => /Nivoda|sold out/i.test(`${row.displayName} ${row.founderObligation ?? ""}`)),
      false,
    );
  });

  it("K Abbey disposition remains evidence-driven", () => {
    const { docket } = todayOf([...abbeyPrintCandidates(), ...sarahDuplicateCandidates()], {
      threadContext: new Map([...abbeyThreads(), ...sarahThreads()]),
    });
    const abbey = [...docket.items, ...docket.watching].find((row) =>
      /Abbey|C026137/i.test("subject" in row ? `${row.subject} ${row.headline}` : `${row.title} ${row.detail}`),
    );
    assert.ok(abbey);
    assert.equal(abbey.briefingPacket?.ballHolder, "founder");
    const up = docket.items.find((item) => /Abbey|C026137/i.test(item.subject));
    assert.ok(up);
  });

  it("complete ranked docket includes hidden queued items", () => {
    const { loop, docket } = todayOf(
      [
        ...abbeyPrintCandidates(),
        ...sarahClientWaitOverrideCandidates(),
        gmailRow({
          candidateId: "nivoda-note",
          sourceRef: "gc1|nivoda-thread|nivoda-in",
          sourceTimestamp: "2026-09-18T12:00:00.000Z",
          candidateType: "note",
          payload: { kind: "note", text: "1 item is sold out", contextLayer: null },
          evidenceBasis: { ruleIds: ["gmail_participant"], matchedText: "Nivoda - 1 item is sold out" },
        }),
        gmailRow({
          candidateId: "welcome-note",
          sourceRef: "gc1|welcome-thread|welcome-in",
          sourceTimestamp: "2026-09-18T12:05:00.000Z",
          candidateType: "note",
          payload: {
            kind: "note",
            text: "Welcome. Please do not reply to this email.",
            contextLayer: null,
          },
          evidenceBasis: {
            ruleIds: ["gmail_participant"],
            matchedText: "Welcome. Please do not reply to this email.",
          },
        }),
        gmailRow({
          candidateId: "aurora-follow",
          sourceRef: "gc1|aurora-thread|aurora-in",
          sourceTimestamp: "2026-09-18T14:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "walk-ins this month",
            detail: "Can you follow up with me about walk-ins this month?",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request", "explicit_follow_up"],
            matchedText: "Can you follow up with me about walk-ins this month?",
          },
        }),
      ],
      {
        threadContext: new Map([
          ...abbeyThreads(),
          ...sarahClientWaitThreads(),
          [
            "nivoda-thread",
            {
              subject: "Nivoda - 1 item is sold out",
              fromDisplayName: "Nivoda",
              fromEmail: NIVODA_EMAIL,
              messages: [
                { messageId: "nivoda-in", sentAt: "2026-09-18T12:00:00.000Z", direction: "inbound" },
              ],
            },
          ],
          [
            "welcome-thread",
            {
              subject: "Welcome",
              fromDisplayName: "getfadedwithangie",
              fromEmail: "admin@shop-welcome.test",
              messages: [
                { messageId: "welcome-in", sentAt: "2026-09-18T12:05:00.000Z", direction: "inbound" },
              ],
            },
          ],
          [
            "aurora-thread",
            {
              subject: "walk-ins this month",
              fromDisplayName: "Aurora Underwood",
              fromEmail: "aurora@acivmatrix.com",
              messages: [
                { messageId: "aurora-in", sentAt: "2026-09-18T14:00:00.000Z", direction: "inbound" },
              ],
            },
          ],
        ]),
        jobs: [
          founderJob("proj-one", "Send chain options and pricing."),
          founderJob("proj-two", "Call the setter about the next wax."),
          founderJob("proj-three", "Email the client the size update."),
        ],
        projects: new Map([
          ["proj-one", { projectId: "proj-one", title: "Chain options", personName: "Overflow One", people: [{ personId: "overflow-one-person", displayName: "Overflow One", role: "client" as const }], isCurrent: true }],
          ["proj-two", { projectId: "proj-two", title: "Setter wax", personName: "Overflow Two", people: [{ personId: "overflow-two-person", displayName: "Overflow Two", role: "client" as const }], isCurrent: true }],
          ["proj-three", { projectId: "proj-three", title: "Size update", personName: "Overflow Three", people: [{ personId: "overflow-three-person", displayName: "Overflow Three", role: "client" as const }], isCurrent: true }],
        ]),
      },
    );
    const ranked = inspectFinalizedTodayDocket(loop);
    assert.equal(ranked.length >= 2, true);
    assert.equal(ranked.some((row) => /Nivoda/i.test(row.displayName)), false);
    assert.equal(ranked.some((row) => /getfaded|Welcome/i.test(row.displayName)), false);
    const abbey = ranked.find((row) => /Abbey|C026137/i.test(`${row.displayName} ${row.projectOrCad ?? ""}`));
    assert.ok(abbey, `Abbey missing from ${JSON.stringify(ranked)}`);
    const sarah = ranked.find((row) => /Sarah|C026143/i.test(`${row.displayName} ${row.projectOrCad ?? ""}`));
    assert.ok(sarah);
    assert.equal(sarah.ballHolder, "vendor_shop");
    assert.equal(sarah.lane, "watching");
    for (const row of ranked.filter((item) => item.lane === "up_next" || item.lane === "queued")) {
      assert.equal(row.ballHolder, "founder");
      assert.ok(row.founderObligation);
    }
    assert.equal(docket.watching.some((row) => /Sarah/i.test(row.title)), true);
  });
});
