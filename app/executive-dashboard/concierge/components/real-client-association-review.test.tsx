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

  it("renders Morgan's verified response state and an unselected founder decision worksheet", () => {
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
    assert.match(html, /Planned — not sent/);
    assert.match(html, /Planned — not shipped/);
    assert.match(html, /Propose In Production only after founder-confirmed shipment or handoff evidence/);
    assert.match(html, /Open bounded Gmail refresh/);
    assert.match(html, /Create Morgan Jines as a real Person/);
    assert.match(html, /Create the Marquise\/custom engagement Project/);
    assert.match(html, /Approve lifecycle — none saved/);
    assert.match(html, /Confirm as the CAD job number/);
    assert.match(html, /Unsaved worksheet/);
    assert.match(html, /Saved association decision: <strong[^>]*>None/);
    assert.doesNotMatch(html, /name="morgan-person-decision"[^>]*checked/);
    assert.doesNotMatch(html, /name="morgan-project-decision"[^>]*checked/);
    assert.doesNotMatch(html, /name="morgan-cad-number-decision"[^>]*checked/);
    assert.doesNotMatch(html, /value="design" selected/);
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
});
