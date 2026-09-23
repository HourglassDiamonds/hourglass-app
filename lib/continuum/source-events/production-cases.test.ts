/**
 * Production-shaped source-event compose cases.
 * Uses indexed metadata (subject/direction/files), not raw email bodies.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import { composeCosOperatingLoop } from "@/lib/continuum/chief-of-staff/operating-loop/compose";
import { composeTodayDocket } from "@/lib/continuum/chief-of-staff/operating-loop/docket";
import { fixtureCandidate } from "@/lib/continuum/chief-of-staff/operating-loop/fixtures";

const NOW = "2026-09-23T12:00:00.000Z";
const FOUNDER_HASH = hashEmail("justin@hourglassdiamonds.com")!;
const NIURKA_HASH = hashEmail("niurka@vlorajewelry.com")!;
const CLIENT_HASH = hashEmail("client@example.test")!;

function specRow(
  extra: Partial<ContinuumCandidate> & Pick<ContinuumCandidate, "candidateId" | "sourceRef">,
): ContinuumCandidate {
  return fixtureCandidate({
    sourceSystem: "gmail",
    candidateType: "structured_spec",
    proposedTarget: { kind: "none" },
    payload: { kind: "structured_spec", fieldName: "cad_job_number", value: "C000000" },
    evidenceBasis: { ruleIds: [], matchedText: "C000000" },
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
  const item = docket.items.find((row) => needle.test(hay(row)));
  const watching = docket.watching.find((row) => needle.test(hay(row)));
  return { item, watching };
}

describe("source-event production-shaped compose", () => {
  it("Dylon CAD/Mod files open founder_review and drop the old STL ask", () => {
    const docket = todayOf(
      [
        specRow({
          candidateId: "dylon-old-ask",
          sourceRef: "gc1|19fed961d1371aaf|1a0b58c8f6aba78d",
          sourceTimestamp: "2026-09-18T17:24:22.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "stl",
            detail: "can you send me the stl file for that one as well please",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_follow_up"],
            matchedText: "can you send me the stl file for that one as well please",
          },
        }),
        specRow({
          candidateId: "dylon-spec",
          sourceRef: "gc1|19fed961d1371aaf|1a0c52c12690a0f5",
          sourceTimestamp: "2026-09-21T18:13:04.000Z",
          payload: { kind: "structured_spec", fieldName: "cad_job_number", value: "C025610" },
          evidenceBasis: { ruleIds: [], matchedText: "C025610" },
        }),
      ],
      new Map([
        [
          "19fed961d1371aaf",
          {
            subject: "RE: HGD x Dylon D.-C025610",
            messages: [
              {
                messageId: "1a0b58c8f6aba78d",
                sentAt: "2026-09-18T17:24:22.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
              {
                messageId: "1a0c52c12690a0f5",
                sentAt: "2026-09-21T18:13:04.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
                hasAttachments: true,
                attachmentFilenames: [
                  "NL-H017-Dylon D-C025610-Mod4.jpg",
                  "NL-H017-Dylon D-C025610-Mod4.stl",
                ],
              },
            ],
          },
        ],
      ]),
    );
    const found = card(docket, /Dylon|C025610/i);
    assert.ok(found.item);
    assert.equal(found.item?.briefingPacket?.ballHolder, "founder");
    assert.equal(found.item?.briefingPacket?.semanticNextActionClass, "founder_review");
    assert.doesNotMatch(
      `${found.item?.headline} ${found.item?.context}`,
      /send me the stl/i,
    );
  });

  it("Tim RN workshop source event is vendor_shop waiting on final CAD", () => {
    const docket = todayOf(
      [
        specRow({
          candidateId: "tim-prong",
          sourceRef: "gc1|1a0b18dcd27676a1|1a0b18dcd27676a1",
          sourceTimestamp: "2026-09-17T22:47:16.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "prongs",
            detail: 'Can we change the prongs to this style below (more of a rounded "almost" claw)',
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_change_request"],
            matchedText: 'Can we change the prongs to this style below (more of a rounded "almost" claw)',
          },
        }),
      ],
      new Map([
        [
          "1a0b18dcd27676a1",
          {
            subject: "RE: HGD x Tim/Jenn-C025964-RN08318",
            messages: [
              {
                messageId: "1a0b18dcd27676a1",
                sentAt: "2026-09-17T22:47:16.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
                subject: "RE: HGD x Tim/Jenn-C025964-RN08318",
                hasAttachments: true,
              },
            ],
          },
        ],
      ]),
    );
    const found = card(docket, /Tim|C025964/i);
    assert.ok(found.watching);
    assert.equal(found.item, undefined);
    assert.equal(found.watching?.briefingPacket?.ballHolder, "vendor_shop");
    assert.match(`${found.watching?.title} ${found.watching?.detail} ${found.watching?.briefing?.headline}`, /CAD|shop|workshop/i);
  });

  it("Duane CAD delivery is founder_review from files even with only spec candidates", () => {
    const docket = todayOf(
      [
        specRow({
          candidateId: "duane-spec",
          sourceRef: "gc1|1a0c61585502b4fb|1a0ca88c2aa0bd2f",
          sourceTimestamp: "2026-09-22T19:11:17.000Z",
          payload: { kind: "structured_spec", fieldName: "cad_job_number", value: "C026350" },
          evidenceBasis: { ruleIds: [], matchedText: "C026350" },
        }),
      ],
      new Map([
        [
          "1a0c61585502b4fb",
          {
            subject: "RE: HGD x Duane-C026350",
            messages: [
              {
                messageId: "1a0ca88c2aa0bd2f",
                sentAt: "2026-09-22T19:11:17.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
                hasAttachments: true,
                attachmentFilenames: ["NL-H017-Duane-C026350.jpg"],
              },
            ],
          },
        ],
      ]),
    );
    const found = card(docket, /Duane|C026350/i);
    assert.ok(found.item);
    assert.equal(found.item?.briefingPacket?.ballHolder, "founder");
    assert.equal(found.item?.briefingPacket?.semanticNextActionClass, "founder_review");
  });

  it("Abbey headed-to-you source event removes the shipping card", () => {
    const docket = todayOf(
      [
        specRow({
          candidateId: "abbey-spec",
          sourceRef: "gc1|1a07e70c9a7538be|1a0caff66376da79",
          sourceTimestamp: "2026-09-22T21:21:59.000Z",
          payload: { kind: "structured_spec", fieldName: "metal", value: "14k yellow gold" },
          evidenceBasis: { ruleIds: [], matchedText: "14k yellow gold" },
        }),
      ],
      new Map([
        [
          "1a07e70c9a7538be",
          {
            subject: "Re: A new piece",
            messages: [
              {
                messageId: "1a0caff66376da79",
                sentAt: "2026-09-22T21:21:59.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
                hasAttachments: true,
                plaintext: "Headed to you!!",
              },
            ],
          },
        ],
      ]),
    );
    const found = card(docket, /Abbey|C026137|new piece/i);
    assert.equal(found.item, undefined);
    assert.equal(found.watching, undefined);
  });

  it("Abbey headed-to-you on the client thread closes leftover shop wait on the same CAD", () => {
    const docket = todayOf(
      [
        specRow({
          candidateId: "abbey-cad",
          sourceRef: "gc1|1a07e70c9a7538be|1a08da6b298aa40e",
          sourceTimestamp: "2026-09-10T23:28:26.000Z",
          payload: { kind: "structured_spec", fieldName: "cad_job_number", value: "C026137" },
          evidenceBasis: { ruleIds: [], matchedText: "C026137" },
        }),
        specRow({
          candidateId: "abbey-shop",
          sourceRef: "gc1|abbey-vendor|1a0b0c55eac8d9b5",
          sourceTimestamp: "2026-09-17T19:08:23.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "workshop",
            detail: "stone is going to workshop",
            waitingOnActor: "vendor",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_follow_up"],
            matchedText: "stone is going to workshop RN07247",
          },
        }),
        specRow({
          candidateId: "abbey-ship",
          sourceRef: "gc1|1a07e70c9a7538be|1a0caff66376da79",
          sourceTimestamp: "2026-09-22T21:21:59.000Z",
          payload: { kind: "structured_spec", fieldName: "metal", value: "14k yellow gold" },
          evidenceBasis: { ruleIds: [], matchedText: "Headed to you!!" },
        }),
      ],
      new Map([
        [
          "1a07e70c9a7538be",
          {
            subject: "Re: A new piece",
            messages: [
              {
                messageId: "1a08da6b298aa40e",
                sentAt: "2026-09-10T23:28:26.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
                subject: "Re: A new piece",
              },
              {
                messageId: "1a0caff66376da79",
                sentAt: "2026-09-22T21:21:59.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
                hasAttachments: true,
                plaintext: "Headed to you!!",
              },
            ],
          },
        ],
        [
          "abbey-vendor",
          {
            subject: "RE: HGD x Abbey-C026137",
            messages: [
              {
                messageId: "1a0b0c55eac8d9b5",
                sentAt: "2026-09-17T19:08:23.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
                hasAttachments: true,
                attachmentFilenames: ["image001.jpg"],
              },
            ],
          },
        ],
      ]),
    );
    const found = card(docket, /Abbey|C026137|new piece/i);
    assert.equal(found.item, undefined);
    assert.equal(found.watching, undefined);
  });

  it("Nathan client reply then founder vendor-thread outbound is vendor_shop", () => {
    const docket = todayOf(
      [
        specRow({
          candidateId: "nate-client",
          sourceRef: "gc1|19a854e42f90344f|1a0ca8e67de67c17",
          sourceTimestamp: "2026-09-22T19:18:25.000Z",
          payload: {
            kind: "project_context",
            topic: "historical_quoted_note",
            value: "durability",
          },
          evidenceBasis: {
            ruleIds: ["quoted_historical_evidence"],
            matchedText: "durability since I want this to be a piece my wife",
          },
        }),
        specRow({
          candidateId: "nate-vendor",
          sourceRef: "gc1|1a09120d797337d9|1a0caed66950d9f3",
          sourceTimestamp: "2026-09-22T21:02:28.000Z",
          payload: {
            kind: "project_context",
            topic: "historical_quoted_cad_job_number",
            value: "C026176",
          },
          evidenceBasis: {
            ruleIds: ["historical_quoted_identifier"],
            matchedText: "C026176",
          },
        }),
        specRow({
          candidateId: "nate-spec",
          sourceRef: "gc1|1a09120d797337d9|1a0caed66950d9f3",
          sourceTimestamp: "2026-09-22T21:02:28.000Z",
          payload: { kind: "structured_spec", fieldName: "cad_job_number", value: "C026176" },
          evidenceBasis: { ruleIds: [], matchedText: "C026176" },
        }),
      ],
      new Map([
        [
          "19a854e42f90344f",
          {
            subject: "Re: Featured Ring",
            messages: [
              {
                messageId: "1a0ca8e67de67c17",
                sentAt: "2026-09-22T19:18:25.000Z",
                direction: "inbound",
                fromEmailHash: CLIENT_HASH,
              },
            ],
          },
        ],
        [
          "1a09120d797337d9",
          {
            subject: "Re: HGD x Nate P. (Dagger Ring)-C026176",
            messages: [
              {
                messageId: "1a0caed66950d9f3",
                sentAt: "2026-09-22T21:02:28.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
                hasAttachments: true,
              },
            ],
          },
        ],
      ]),
    );
    const found = card(docket, /Nate|C026176|Dagger/i);
    assert.equal(found.item, undefined);
    assert.ok(found.watching);
    assert.equal(found.watching?.briefingPacket?.ballHolder, "vendor_shop");
  });

  it("Sarah vendor acknowledgement stays vendor_shop and does not reopen founder", () => {
    const docket = todayOf(
      [
        specRow({
          candidateId: "sarah-founder",
          sourceRef: "gc1|sarah-thread|sarah-founder",
          sourceTimestamp: "2026-09-22T16:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "prong reference",
            detail: "use this for the CAD update",
            waitingOnActor: "vendor",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_follow_up"],
            matchedText: "Here's the higher-resolution prong reference — use this for the CAD update.",
          },
        }),
        specRow({
          candidateId: "sarah-ack",
          sourceRef: "gc1|sarah-thread|1a0cb2ce180a3f78",
          sourceTimestamp: "2026-09-22T22:00:00.000Z",
          payload: { kind: "structured_spec", fieldName: "cad_job_number", value: "C026143" },
          evidenceBasis: { ruleIds: [], matchedText: "C026143" },
        }),
      ],
      new Map([
        [
          "sarah-thread",
          {
            subject: "RE: HGD x Sarah-C026143",
            messages: [
              {
                messageId: "sarah-founder",
                sentAt: "2026-09-22T16:00:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
                hasAttachments: true,
              },
              {
                messageId: "1a0cb2ce180a3f78",
                sentAt: "2026-09-22T22:00:00.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
                hasAttachments: true,
                plaintext: "Thank you so much!",
              },
            ],
          },
        ],
      ]),
    );
    const found = card(docket, /Sarah|C026143/i);
    assert.equal(found.item, undefined);
    assert.ok(found.watching);
    assert.equal(found.watching?.briefingPacket?.ballHolder, "vendor_shop");
    assert.doesNotMatch(
      `${found.watching?.title} ${found.watching?.detail} ${found.watching?.briefing?.headline} ${found.watching?.briefing?.stand}`,
      /price|timeline|next steps/i,
    );
  });

  it("F. Grant order confirmation is founder_review not client_wait", () => {
    const docket = todayOf(
      [
        specRow({
          candidateId: "grant-spec",
          sourceRef: "gc1|grant-thread|1a0ca7810946b8fe",
          sourceTimestamp: "2026-09-22T18:54:15.000Z",
          payload: { kind: "structured_spec", fieldName: "cad_job_number", value: "C025885" },
          evidenceBasis: { ruleIds: [], matchedText: "C025885" },
        }),
      ],
      new Map([
        [
          "grant-thread",
          {
            subject: "RE: HGD x F.Grant-C025885-SP13477",
            messages: [
              {
                messageId: "1a0ca7810946b8fe",
                sentAt: "2026-09-22T18:54:15.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
                hasAttachments: true,
              },
            ],
          },
        ],
      ]),
    );
    const found = card(docket, /Grant|C025885|SP13477/i);
    assert.ok(found.item);
    assert.equal(found.item?.briefingPacket?.ballHolder, "founder");
    assert.equal(found.item?.briefingPacket?.semanticNextActionClass, "founder_review");
    assert.doesNotMatch(
      `${found.item?.headline} ${found.item?.context} ${found.item?.briefingPacket?.briefingKind}`,
      /client_wait|WAITING ON CLIENT/i,
    );
  });

  it("Madi founder CAD send with no new reply is client_wait", () => {
    const docket = todayOf(
      [
        specRow({
          candidateId: "madi-cad",
          sourceRef: "gc1|madi-thread|madi-cad",
          sourceTimestamp: "2026-09-21T16:00:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "client_update",
            value: "Here's the latest CAD — let me know what you think.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "Here's the latest CAD — let me know what you think.",
          },
        }),
      ],
      new Map([
        [
          "madi-thread",
          {
            subject: "RE: HGD x Madi-C026000",
            messages: [
              {
                messageId: "madi-cad",
                sentAt: "2026-09-21T16:00:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
            ],
          },
        ],
      ]),
    );
    const found = card(docket, /Madi|C026000/i);
    assert.equal(found.item, undefined);
    assert.ok(found.watching);
    assert.equal(found.watching?.briefingPacket?.ballHolder, "client");
  });
});
