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
    assert.match(html, /Unresolved — no supported non-fixture canonical target/);
    assert.match(html, /C026937/);
    assert.match(html, /Founder-reviewable canonical proposal/);
    assert.match(html, /Open Add Client/);
    assert.match(html, /No Job or Today ownership is proposed from subject text alone/);
    assert.match(html, />Confirm</);
    assert.match(html, />Reject</);
    assert.match(html, />Leave unresolved</);
    assert.match(html, /disabled=""/);
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
    assert.match(html, /Leave unresolved/);
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
    assert.match(html, /Exact provider participant: Morgan Jines/);
    assert.match(html, /received a founder response/);
    assert.match(html, /No additional Today action is supported/);
    assert.match(html, /Open founder-controlled bounded Gmail refresh/);
    assert.match(html, /Create Morgan Jines as a real Person/);
    assert.match(html, /Create the Marquise\/custom engagement Project/);
    assert.match(html, /Select lifecycle — required before creation/);
    assert.match(html, /No lifecycle is preselected/);
    assert.match(html, /Confirm as the CAD job number/);
    assert.doesNotMatch(html, /name="morgan-person-decision"[^>]*checked/);
    assert.doesNotMatch(html, /name="morgan-project-decision"[^>]*checked/);
    assert.doesNotMatch(html, /name="morgan-cad-number-decision"[^>]*checked/);
  });
});
