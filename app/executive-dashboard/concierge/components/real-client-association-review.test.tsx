import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildRealClientAssociationBatch } from "@/lib/continuum/today-sterling/real-client-association";
import { RealClientAssociationReview } from "./real-client-association-review";

describe("real-client association review presentation", () => {
  it("shows exact provider identity, truthful evidence limits, and safe founder choices", () => {
    const batch = buildRealClientAssociationBatch({
      messages: [{
        messageId: "m1", threadId: "abc123def456", subject: "Morgan ring", sentAt: "2026-11-05T14:32:22.000Z",
        indexedAt: "2026-11-05T14:34:48.000Z", direction: "inbound", participantHashes: [],
      }],
      people: [], projects: [], jobs: [], relationships: [],
      attachments: [{ messageId: "m1", threadId: "abc123def456", filename: "NL-H017-Morgan-C026937-Mod1.jpg" }],
      authorizationAt: "2026-11-04T15:00:50.223Z", associationPersistence: "missing", nowIso: "2026-11-05T15:00:00.000Z",
    });
    const html = renderToStaticMarkup(createElement(RealClientAssociationReview, { batch }));
    assert.match(html, /abc123def456/);
    assert.match(html, /Subject discovery only — not identity proof/);
    assert.match(html, /C026937/);
    assert.match(html, /Evidence and technical provenance/);
    assert.match(html, /data-client-review="morgan"/);
    assert.match(html, /Choose client review/);
    assert.match(html, /No association decision can be saved/);
    assert.doesNotMatch(html, /name="reviewKey"/);
    assert.doesNotMatch(html, /Sterling verified/);
  });

  it("renders durable Confirm and Reject forms only for an exact supported target", () => {
    const batch = buildRealClientAssociationBatch({
      messages: [{
        messageId: "m1", threadId: "abc123def456", subject: "Morgan ring", sentAt: "2026-11-05T14:32:22.000Z",
        indexedAt: "2026-11-05T14:34:48.000Z", direction: "inbound", participantHashes: ["exact-hash"],
      }],
      people: [{ personId: "11111111-1111-4111-8111-111111111111", label: "Morgan", emailHash: "exact-hash", sourceSystem: "continuum" }],
      projects: [{ projectId: "22222222-2222-4222-8222-222222222222", label: "Morgan ring", sourceSystem: "continuum" }],
      jobs: [],
      relationships: [{ personId: "11111111-1111-4111-8111-111111111111", projectId: "22222222-2222-4222-8222-222222222222" }],
      authorizationAt: "2026-11-04T15:00:50.223Z", associationPersistence: "available", nowIso: "2026-11-05T15:00:00.000Z",
    });
    const html = renderToStaticMarkup(createElement(RealClientAssociationReview, { batch, reviewAction: async () => {} }));
    assert.match(html, /name="reviewKey"/);
    assert.match(html, /name="decision" value="confirm"/);
    assert.match(html, /name="decision" value="reject"/);
    assert.match(html, /Or leave unresolved — no write/);
  });

  it("renders Morgan's verified response state without obsolete creation worksheet controls", () => {
    const batch = buildRealClientAssociationBatch({
      messages: [{
        messageId: "m1", threadId: "1a15fb0c9b520621", subject: "Justin x Morgan - Marquise",
        sentAt: "2026-11-05T14:32:22.000Z", indexedAt: "2026-11-05T14:34:48.000Z",
        direction: "inbound", participantHashes: [],
      }],
      attachments: [{ messageId: "m1", threadId: "1a15fb0c9b520621", filename: "NL-H017-Morgan-C026937-Mod1.jpg" }],
      people: [], projects: [], jobs: [], relationships: [],
      authorizationAt: "2026-11-04T15:00:50.223Z", associationPersistence: "missing", nowIso: "2026-11-05T15:00:00.000Z",
    });
    const html = renderToStaticMarkup(createElement(RealClientAssociationReview, { batch }));
    assert.match(html, /Founder responded to the latest verified client message/);
    assert.match(html, /Founder-supplied evidence · November 5/);
    assert.match(html, /Morgan approved his marquise center stone/);
    assert.match(html, /Current lifecycle: Design \/ pre-production/);
    assert.match(html, /In Production stays blocked until founder-confirmed shipment or handoff evidence/);
    assert.match(html, /Open bounded Gmail refresh/);
    assert.match(html, /Saved association decision: <strong[^>]*>None/);
    assert.doesNotMatch(html, /Create Morgan Jines as a real Person/);
    assert.doesNotMatch(html, /Create the Marquise\/custom engagement Project/);
    assert.doesNotMatch(html, /name="morgan-/);
  });

  it("shows Morgan's exact project-level association write set without assigning either open Job", () => {
    const personId = "2cd354da-9c7b-4f71-84c3-4bdf0945dcc4";
    const projectId = "17ef9d5b-39d2-48bf-85f6-93209a4c4e38";
    const batch = buildRealClientAssociationBatch({
      messages: [{
        messageId: "m1", threadId: "1a15fb0c9b520621", subject: "Justin x Morgan - Marquise",
        sentAt: "2026-11-05T14:58:46.000Z", indexedAt: "2026-11-06T15:21:33.000Z",
        direction: "outbound", participantHashes: ["exact-hash"],
      }],
      attachments: [{ messageId: "m1", threadId: "1a15fb0c9b520621", filename: "NL-H017-Morgan-C026937-Mod1.jpg" }],
      people: [{ personId, label: "Morgan Jines", emailHash: "exact-hash", sourceSystem: "concierge-manual" }],
      projects: [{ projectId, label: "Morgan Jines — Marquise", sourceSystem: "concierge-manual", lifecycleStage: "design" }],
      jobs: [
        { jobId: "f37af8a7-1659-4a83-bdaa-45ae5983604d", projectId, label: "Send Morgan's invoice", state: "open", waitingOn: "founder", sourceSystem: "concierge-manual" },
        { jobId: "94e2373e-3257-4ada-8592-1c574349e11f", projectId, label: "Ship Morgan's approved marquise", state: "open", waitingOn: "founder", sourceSystem: "concierge-manual" },
      ],
      relationships: [{ personId, projectId }],
      authorizationAt: "2026-11-04T15:00:50.223Z", associationPersistence: "available", nowIso: "2026-11-06T15:22:00.000Z",
    });
    const html = renderToStaticMarkup(createElement(RealClientAssociationReview, { batch, reviewAction: async () => {} }));
    assert.match(html, /Exact association write set/);
    assert.match(html, /Persisted canonical records · read only/);
    assert.match(html, new RegExp(personId));
    assert.match(html, new RegExp(projectId));
    assert.match(html, /Design \/ pre-production/);
    assert.match(html, /f37af8a7-1659-4a83-bdaa-45ae5983604d/);
    assert.match(html, /94e2373e-3257-4ada-8592-1c574349e11f/);
    assert.match(html, /Incomplete · waiting on founder/);
    assert.match(html, /Project-level association; target Job remains null/);
    assert.match(html, /C026937[\s\S]*remains an unresolved attachment identifier/);
    assert.match(html, /name="decision" value="confirm"/);
    assert.doesNotMatch(html, /name="morgan-/);
    assert.doesNotMatch(html, /<button[^>]*disabled[^>]*>confirm<\/button>/);
    assert.doesNotMatch(html, /Add Morgan as client|Open Project intake/);
    assert.match(html, /name="jobId" value=""/);
    assert.doesNotMatch(html, /more than one open Job/);
  });

  it("shows one selected client while keeping the rest individually selectable", () => {
    const batch = buildRealClientAssociationBatch({
      messages: [
        { messageId: "m1", threadId: "thread-morgan", subject: "Morgan ring", sentAt: "2026-11-05T14:00:00.000Z", indexedAt: "2026-11-05T14:01:00.000Z", direction: "inbound", participantHashes: [] },
        { messageId: "a1", threadId: "thread-audrey", subject: "Audrey ring", sentAt: "2026-11-05T15:00:00.000Z", indexedAt: "2026-11-05T15:01:00.000Z", direction: "outbound", participantHashes: [] },
      ],
      people: [], projects: [], jobs: [], relationships: [],
      authorizationAt: "2026-11-04T15:00:50.223Z", associationPersistence: "missing", nowIso: "2026-11-05T16:00:00.000Z",
    });
    const html = renderToStaticMarkup(createElement(RealClientAssociationReview, { batch, selectedKey: "audrey" }));
    assert.match(html, /data-client-review="audrey"/);
    assert.doesNotMatch(html, /data-client-review="morgan"/);
    assert.match(html, /\?client=morgan/);
    assert.match(html, /\?client=audrey/);
    assert.match(html, /Founder responded after the latest indexed inbound|No indexed inbound message/);
  });

  it("shows only unresolved Zane founder decisions and does not expose association controls", () => {
    const batch = buildRealClientAssociationBatch({
      messages: [
        { messageId: "z1", threadId: "1a1212396a8ac111", subject: "Hourglass Diamonds x Zane - Wedding Band", sentAt: "2026-10-13T16:56:38.000Z", indexedAt: "2026-11-05T13:39:15.630Z", direction: "inbound", participantHashes: [] },
        { messageId: "z2", threadId: "1a1212396a8ac111", subject: "Hourglass Diamonds x Zane - Wedding Band", sentAt: "2026-10-13T17:02:40.000Z", indexedAt: "2026-11-05T13:39:14.130Z", direction: "outbound", participantHashes: [] },
      ],
      people: [], projects: [], jobs: [], relationships: [],
      authorizationAt: "2026-11-04T15:00:50.223Z", associationPersistence: "available", nowIso: "2026-11-06T18:00:00.000Z",
    });
    const html = renderToStaticMarkup(createElement(RealClientAssociationReview, { batch, selectedKey: "zane" }));
    assert.match(html, /Founder decision packet/);
    assert.match(html, /Only unresolved founder decisions/);
    assert.match(html, /no email-reply obligation is supported/);
    assert.match(html, /this exact real Zane Kennedy wedding-band workflow is In Production/);
    assert.match(html, /zanemkennedy88@gmail\.com/);
    assert.match(html, /Jobs: none/);
    assert.match(html, /not confirmed that the call occurred/);
    assert.doesNotMatch(html, /name="decision"/);
  });

  it("exposes the authenticated association controls once Zane's canonical target exists", () => {
    const personId = "80c1f967-72b8-4de3-9b9c-ba43aa4d4f05";
    const projectId = "6224731b-1c13-4eb1-8907-feb3e904b57f";
    const batch = buildRealClientAssociationBatch({
      messages: [{ messageId: "z1", threadId: "1a1212396a8ac111", subject: "Hourglass Diamonds x Zane - Wedding Band", sentAt: "2026-10-13T17:02:40.000Z", indexedAt: "2026-11-05T13:39:14.130Z", direction: "outbound", participantHashes: ["zane-hash"] }],
      people: [{ personId, label: "Zane Kennedy", emailHash: "zane-hash", sourceSystem: "concierge-manual" }],
      projects: [{ projectId, label: "Zane Kennedy — Wedding Band", sourceSystem: "concierge-manual", lifecycleStage: "production" }],
      jobs: [], relationships: [{ personId, projectId }], authorizationAt: "2026-11-04T15:00:50.223Z",
      associationPersistence: "available", nowIso: "2026-11-06T18:00:00.000Z",
    });
    const html = renderToStaticMarkup(createElement(RealClientAssociationReview, { batch, selectedKey: "zane", reviewAction: async () => {} }));
    assert.match(html, /Exact association write set/);
    assert.match(html, /name="decision" value="confirm"/);
    assert.match(html, /Target Job remains null/);
    assert.match(html, /exact non-fixture canonical Person and Project are linked/);
    assert.match(html, /name="jobId" value=""/);
  });

  it("renders Pennock as delivered and closed without reviving shipping or mixing the Tim/Jenn thread", () => {
    const batch = buildRealClientAssociationBatch({
      messages: [
        { messageId: "p1", threadId: "1a08d1c1443a8ede", subject: "HGD- J.Pennock-C025519-RN08286", sentAt: "2026-09-24T21:56:22.000Z", indexedAt: "2026-11-05T13:39:15.630Z", direction: "inbound", participantHashes: [] },
        { messageId: "p2", threadId: "1a10c5b8e4a52db7", subject: "HGD - Tim/Jenn C025964 & J. Pennock C025519 status", sentAt: "2026-10-05T18:47:53.000Z", indexedAt: "2026-11-05T13:39:14.130Z", direction: "inbound", participantHashes: [] },
      ],
      people: [], projects: [], jobs: [], relationships: [],
      authorizationAt: "2026-11-04T15:00:50.223Z", associationPersistence: "available", nowIso: "2026-11-06T18:00:00.000Z",
    });
    const html = renderToStaticMarkup(createElement(RealClientAssociationReview, { batch, selectedKey: "pennock" }));
    assert.match(html, /John Pennock.*pennock3@gmail\.com/);
    assert.match(html, /delivered and the Project is closed/);
    assert.match(html, /lifecycle is completed/);
    assert.match(html, /Jobs: none/);
    assert.match(html, /do not exclusively trust mixed thread 1a10c5b8e4a52db7/);
    assert.doesNotMatch(html, /Create tracking|new shipping action/);
    assert.doesNotMatch(html, /name="decision"/);
  });
});
