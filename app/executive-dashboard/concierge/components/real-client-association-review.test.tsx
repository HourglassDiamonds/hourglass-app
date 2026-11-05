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
      authorizationAt: "2026-11-04T15:00:50.223Z", associationPersistence: "missing", nowIso: "2026-11-05T15:00:00.000Z",
    });
    const html = renderToStaticMarkup(createElement(RealClientAssociationReview, { batch }));
    assert.match(html, /abc123def456/);
    assert.match(html, /Subject discovery only — not identity proof/);
    assert.match(html, /Unresolved — no supported non-fixture canonical target/);
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
});
