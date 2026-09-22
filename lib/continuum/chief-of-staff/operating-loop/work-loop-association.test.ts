import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket } from "./docket";
import { fixtureCandidate } from "./fixtures";
import { todayGroupKeysFor } from "./today-docket-boundary";

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
) {
  const loop = composeCosOperatingLoop({
    jobs: [],
    candidates,
    projects: new Map(),
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

function cardsFor(docket: ReturnType<typeof composeTodayDocket>, pattern: RegExp) {
  return {
    up: docket.items.filter((item) => pattern.test(`${item.subject} ${item.headline} ${item.context ?? ""}`)),
    watching: docket.watching.filter((row) => pattern.test(`${row.title} ${row.detail}`)),
  };
}

describe("production-shaped work-loop association", () => {
  it("discovers one founder loop from unassociated client filename + vendor HGD + print/check", () => {
    const clientThread = "1a07e70c9a7538be";
    const vendorThread = "1a08760c6837bb32";
    const cad = "C026137";
    const { docket, loop } = todayOf(
      [
        gmailRow({
          candidateId: "client-recap",
          sourceRef: `gc1|${clientThread}|client-recap`,
          sourceTimestamp: "2026-09-21T21:25:52.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Send the recap and next step",
            detail: "please change the email contact",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_follow_up"],
            matchedText: "please change the email contact",
          },
        }),
        gmailRow({
          candidateId: "client-print",
          sourceRef: `gc1|${clientThread}|client-print`,
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
          candidateId: "vendor-stl",
          sourceRef: `gc1|${vendorThread}|vendor-stl`,
          sourceTimestamp: "2026-09-17T19:08:23.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Mod 1 STL attached",
            detail: `Here is the ${cad} Mod 1 STL.`,
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_waiting"],
            matchedText: `Here is the ${cad} Mod 1 STL.`,
          },
        }),
        gmailRow({
          candidateId: "vendor-print-dup",
          sourceRef: `gc1|${vendorThread}|vendor-print-dup`,
          sourceTimestamp: "2026-09-17T19:22:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "I'll print/check the model and send the size update.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "I'll print/check the model and send the size update.",
          },
        }),
      ],
      new Map([
        [
          clientThread,
          {
            subject: "Re: A new piece",
            fromDisplayName: "Abbey",
            fromEmail: "abbey@example.test",
            attachmentFilenames: ["NL-H017-Abbey-C026137.jpg"],
            messages: [
              {
                messageId: "client-print",
                sentAt: "2026-09-17T19:20:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
              {
                messageId: "client-recap",
                sentAt: "2026-09-21T21:25:52.000Z",
                direction: "inbound",
              },
            ],
          },
        ],
        [
          vendorThread,
          {
            subject: `RE: HGD x Abbey-${cad}`,
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            messages: [
              {
                messageId: "vendor-stl",
                sentAt: "2026-09-17T19:08:23.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
              {
                messageId: "vendor-print-dup",
                sentAt: "2026-09-17T19:22:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
            ],
          },
        ],
      ]),
    );
    const named = cardsFor(docket, /Abbey|C026137|Vlora/i);
    assert.equal(named.up.length, 1, hay(docket));
    assert.equal(named.watching.length, 0, hay(docket));
    assert.match(named.up[0]?.subject ?? "", /Abbey/i);
    assert.match(named.up[0]?.subject ?? "", /C026137/i);
    assert.doesNotMatch(named.up[0]?.subject ?? "", /^Vlora$/i);
    assert.equal(named.up[0]?.briefingPacket?.ballHolder, "founder");
    assert.equal(
      loop.brief.filter((row) => /Abbey|C026137|Vlora/i.test(`${row.personLabel} ${row.projectTitle} ${row.organizationLabel}`)).length <= 1,
      true,
    );
    const keys = todayGroupKeysFor({
      id: named.up[0]!.id,
      origin: "brief",
      subject: named.up[0]!.subject,
      headline: named.up[0]!.headline,
      context: named.up[0]!.context,
      brief: named.up[0]!.brief,
      job: null,
      decision: null,
      anomaly: null,
      packet: named.up[0]!.briefingPacket,
      briefing: named.up[0]!.briefing,
      projectId: named.up[0]!.brief?.projectId ?? null,
      candidateIds: named.up[0]!.brief?.candidateIds ?? [],
      threadId: named.up[0]!.brief?.recoveredGmailThreadId ?? null,
      threadSubject: named.up[0]!.brief?.threadSubject ?? null,
      declined: false,
    });
    assert.ok(keys.includes("cad:C026137"));
    assert.doesNotMatch(hay(docket), /Unassigned/i);
  });

  it("does not inherit vendor CAD onto a client thread with no CAD identity", () => {
    const vendorThread = "1a09120d797337d9";
    const clientThread = "19a854e42f90344f";
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "client-wait",
          sourceRef: `gc1|${clientThread}|client-wait`,
          sourceTimestamp: "2026-09-21T14:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Featured Ring",
            detail: "Looking forward to the CAD breakdown.",
            waitingOnActor: "client",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request"],
            matchedText: "Looking forward to the CAD breakdown.",
          },
        }),
        gmailRow({
          candidateId: "vendor-cad",
          sourceRef: `gc1|${vendorThread}|vendor-cad`,
          sourceTimestamp: "2026-09-21T18:35:47.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Mod 1 attached",
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
      ],
      new Map([
        [
          clientThread,
          {
            subject: "Re: Featured Ring",
            fromDisplayName: "Nathan Pearl",
            fromEmail: "nathan@example.test",
            attachmentFilenames: ["featured-ring-concept.png"],
            messages: [
              {
                messageId: "client-wait",
                sentAt: "2026-09-21T14:00:00.000Z",
                direction: "inbound",
              },
            ],
          },
        ],
        [
          vendorThread,
          {
            subject: "RE: HGD x Nate P. (Dagger Ring)-C026176",
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            messages: [
              {
                messageId: "vendor-cad",
                sentAt: "2026-09-21T18:35:47.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
            ],
          },
        ],
      ]),
    );
    const vendor = cardsFor(docket, /C026176/);
    const client = cardsFor(docket, /Nathan Pearl|Featured Ring/);
    assert.equal(vendor.up.length + vendor.watching.length, 1, hay(docket));
    assert.equal(client.up.length + client.watching.length, 1, hay(docket));
    assert.equal(
      [...vendor.up, ...vendor.watching].some((row) =>
        "subject" in row ? /Nathan/i.test(row.subject) : /Nathan/i.test(row.title),
      ),
      false,
    );
  });

  it("associates a client thread when a current shop CAD filename is present", () => {
    const vendorThread = "1a09120d797337d9";
    const clientThread = "19a854e42f90344f";
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "client-wait",
          sourceRef: `gc1|${clientThread}|client-wait`,
          sourceTimestamp: "2026-09-21T14:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Featured Ring",
            detail: "Looking forward to the CAD breakdown.",
            waitingOnActor: "client",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request"],
            matchedText: "Looking forward to the CAD breakdown.",
          },
        }),
        gmailRow({
          candidateId: "vendor-cad",
          sourceRef: `gc1|${vendorThread}|vendor-cad`,
          sourceTimestamp: "2026-09-21T18:35:47.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Mod 1 attached",
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
          candidateId: "founder-chain",
          sourceRef: `gc1|${clientThread}|founder-chain`,
          sourceTimestamp: "2026-09-21T18:37:58.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "I'll order the chain separately. Let me know what you think.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "I'll order the chain separately. Let me know what you think.",
          },
        }),
      ],
      new Map([
        [
          clientThread,
          {
            subject: "Re: Featured Ring",
            fromDisplayName: "Nathan Pearl",
            fromEmail: "nathan@example.test",
            attachmentFilenames: ["NL-H017-Nate-C026176.jpg"],
            messages: [
              {
                messageId: "client-wait",
                sentAt: "2026-09-21T14:00:00.000Z",
                direction: "inbound",
              },
              {
                messageId: "founder-chain",
                sentAt: "2026-09-21T18:37:58.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
            ],
          },
        ],
        [
          vendorThread,
          {
            subject: "RE: HGD x Nate P. (Dagger Ring)-C026176",
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            messages: [
              {
                messageId: "vendor-cad",
                sentAt: "2026-09-21T18:35:47.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
            ],
          },
        ],
      ]),
    );
    const named = cardsFor(docket, /C026176|Nate|Nathan|Featured Ring/i);
    assert.equal(named.up.length, 1, hay(docket));
    assert.equal(named.watching.length, 0, hay(docket));
    const packet = named.up[0]?.briefingPacket;
    assert.equal(packet?.ballHolder, "founder");
    assert.notEqual(packet?.ballHolder, "client");
  });

  it("treats current CAD/STL delivery on a spaced HGD vendor thread as founder review", () => {
    const threadId = "19fed961d1371aaf";
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "dylon-delivery",
          sourceRef: `gc1|${threadId}|dylon-delivery`,
          sourceTimestamp: "2026-09-21T18:13:04.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Mod 4 CAD + STL",
            detail: "C025610 Mod 4 + STL attached.",
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
          candidateId: "dylon-recap",
          sourceRef: `gc1|${threadId}|dylon-recap`,
          sourceTimestamp: "2026-09-21T17:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Send the recap and next step",
            detail: "Send the recap and next step.",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_follow_up"],
            matchedText: "Send the recap and next step.",
          },
        }),
      ],
      new Map([
        [
          threadId,
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
      ]),
    );
    const named = cardsFor(docket, /Dylon|C025610|Vlora/i);
    assert.equal(named.up.length, 1, hay(docket));
    assert.equal(named.watching.length, 0, hay(docket));
    assert.match(named.up[0]?.subject ?? "", /Dylon/i);
    assert.match(named.up[0]?.subject ?? "", /C025610/i);
    assert.doesNotMatch(named.up[0]?.subject ?? "", /^Vlora$/i);
    assert.equal(named.up[0]?.briefingPacket?.ballHolder, "founder");
    assert.equal(named.up[0]?.briefingPacket?.authoritative, true);
    assert.equal(named.up[0]?.briefingPacket?.semanticNextActionClass, "founder_review");
    assert.doesNotMatch(
      `${named.up[0]?.headline ?? ""} ${named.up[0]?.briefing?.headline ?? ""} ${named.up[0]?.briefing?.nextBody ?? ""}`,
      /Send the recap/i,
    );
    assert.match(`${named.up[0]?.briefing?.headline ?? named.up[0]?.headline ?? ""}`, /CAD and STL are in/i);
  });

  it("keeps unassociated client + vendor packets with the same HGD CAD as one shop wait", () => {
    const clientThread = "1b026143client01";
    const vendorThread = "1a0881b53067a9e6";
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "sarah-client",
          sourceRef: `gc1|${clientThread}|sarah-client`,
          sourceTimestamp: "2026-09-16T14:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "design reply",
            detail: "I like the updated gallery.",
            waitingOnActor: "client",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request"],
            matchedText: "I like the updated gallery.",
          },
        }),
        gmailRow({
          candidateId: "sarah-mod1",
          sourceRef: `gc1|${vendorThread}|sarah-mod1`,
          sourceTimestamp: "2026-09-18T16:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Mod 1 attached",
            detail: "Here is the C026143 Mod 1 CAD.",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_waiting"],
            matchedText: "Here is the C026143 Mod 1 CAD.",
          },
        }),
        gmailRow({
          candidateId: "sarah-direction",
          sourceRef: `gc1|${vendorThread}|sarah-direction`,
          sourceTimestamp: "2026-09-18T18:26:23.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "Please send the updated CAD after this new direction.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_design_refinement"],
            matchedText: "Please send the updated CAD after this new direction.",
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
              {
                messageId: "sarah-client",
                sentAt: "2026-09-16T14:00:00.000Z",
                direction: "inbound",
              },
            ],
          },
        ],
        [
          vendorThread,
          {
            subject: "Re: HGD x Sarah-C026143",
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            messages: [
              {
                messageId: "sarah-mod1",
                sentAt: "2026-09-18T16:00:00.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
              {
                messageId: "sarah-direction",
                sentAt: "2026-09-18T18:26:23.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
            ],
          },
        ],
      ]),
    );
    const named = cardsFor(docket, /Sarah|C026143/i);
    assert.equal(named.up.length, 0, hay(docket));
    assert.equal(named.watching.length, 1, hay(docket));
    assert.equal(named.watching[0]?.briefingPacket?.ballHolder, "vendor_shop");
    assert.equal(named.watching[0]?.briefing?.stateChip, "WAITING ON SHOP");
    assert.match(named.watching[0]?.title ?? "", /Sarah/i);
  });

  it("keeps latest founder shop instruction plus thanks as waiting on shop", () => {
    const threadId = "1a03a3004b69ec27";
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "grant-proceed",
          sourceRef: `gc1|${threadId}|grant-proceed`,
          sourceTimestamp: "2026-09-21T18:00:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "Moving forward with all three bands, size 6.25, all platinum, all lab.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_design_refinement"],
            matchedText: "Moving forward with all three bands, size 6.25, all platinum, all lab.",
          },
        }),
        gmailRow({
          candidateId: "grant-ack",
          sourceRef: `gc1|${threadId}|grant-ack`,
          sourceTimestamp: "2026-09-21T20:40:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "commitment",
            subject: "order confirmation",
            detail: "I'll update the size, place the order, and send confirmation.",
            waitingOnActor: "vendor",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_commitment"],
            matchedText: "I'll update the size, place the order, and send confirmation.",
          },
        }),
        gmailRow({
          candidateId: "grant-thanks",
          sourceRef: `gc1|${threadId}|grant-thanks`,
          sourceTimestamp: "2026-09-21T20:46:12.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "client_approval",
            value: "Perfect:) Thank you!",
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_approval"],
            matchedText: "Perfect:) Thank you!",
          },
        }),
      ],
      new Map([
        [
          threadId,
          {
            subject: "Re: HGD x F.Grant-C025885",
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            messages: [
              {
                messageId: "grant-proceed",
                sentAt: "2026-09-21T18:00:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
              {
                messageId: "grant-ack",
                sentAt: "2026-09-21T20:40:00.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
              {
                messageId: "grant-thanks",
                sentAt: "2026-09-21T20:46:12.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
            ],
          },
        ],
      ]),
    );
    const named = cardsFor(docket, /Grant|C025885/i);
    assert.equal(named.up.length, 0, hay(docket));
    assert.equal(named.watching.length, 1, hay(docket));
    assert.equal(named.watching[0]?.briefingPacket?.ballHolder, "vendor_shop");
  });

  it("drops unknown generic watching with no current dependency", () => {
    const threadId = "aurora-generic-watch";
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "aurora-assoc",
          sourceRef: `gc1|${threadId}|aurora-in`,
          sourceTimestamp: "2026-09-10T14:00:00.000Z",
          candidateType: "person_association",
          proposedTarget: { kind: "person", personId: null },
          payload: {
            kind: "person_association",
            displayName: "Aurora Underwood",
            emailHash: hashEmail("aurora@example.test"),
            mintPerson: false,
            mergePersons: false,
          },
          evidenceBasis: { ruleIds: ["unresolved_email_hash"], matchedText: "Aurora Underwood" },
        }),
      ],
      new Map([
        [
          threadId,
          {
            subject: "checking in sometime later",
            fromDisplayName: "Aurora Underwood",
            fromEmail: "aurora@example.test",
            messages: [
              {
                messageId: "aurora-in",
                sentAt: "2026-09-10T14:00:00.000Z",
                direction: "inbound",
              },
            ],
          },
        ],
      ]),
    );
    const named = cardsFor(docket, /Aurora/i);
    assert.equal(named.up.length, 0, hay(docket));
    assert.equal(named.watching.length, 0, hay(docket));
  });

  it("does not classify an arbitrary external organization as vendor_shop CAD work", () => {
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
    const named = cardsFor(docket, /Meta|Hourglass Diamonds/i);
    assert.equal(
      named.watching.some((row) => row.briefingPacket?.ballHolder === "vendor_shop"),
      false,
      hay(docket),
    );
    assert.doesNotMatch(hay(docket), /Updated CAD is pending|WAITING ON SHOP/i);
  });
});
