import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPreviewConciergeAcceptanceHandler } from "./acceptance-endpoint";
import { preparePersistentConciergeAcceptance } from "./application";
import { InMemoryConciergeFunnelStore } from "./memory";
import { PreviewWebsiteIntakeStore } from "./preview-acceptance";

const BODY = {
  acceptancePurpose: "controlled-preview-acceptance",
  submissionId: "11111111-1111-4111-8111-111111111111",
  fullName: "Preview Fixture",
  email: "concierge-acceptance@example.test",
  phone: "",
  preferredContactMethod: "Email",
  projectType: "Engagement Ring",
  shapeInterest: "Round",
  designDirection: "Classic Timeless",
  ringPresence: "Understated",
  timeline: "3–4 months",
  budgetRange: "10–20k",
  inspirationNotes: "Controlled Preview acceptance fixture.",
  attribution: {
    utm_source: "preview_acceptance",
    landing_path: "/concierge",
  },
  requestedWindow: {
    start: "2026-11-12T18:00:00.000Z",
    end: "2026-11-12T19:00:00.000Z",
  },
};

function request(body: object = BODY, origin = "https://preview.example.test") {
  return new Request("https://preview.example.test/executive-dashboard/concierge/preview-acceptance", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

describe("authenticated Preview Concierge acceptance endpoint", () => {
  it("prepares and replays one persisted fixture with no message dispatch", async () => {
    const websiteStore = new PreviewWebsiteIntakeStore();
    const funnelStore = new InMemoryConciergeFunnelStore();
    const handler = createPreviewConciergeAcceptanceHandler({
      enabled: () => true,
      authorize: async () => true,
      prepare: (input) => preparePersistentConciergeAcceptance({
        ...input,
        websiteStore,
        funnelStore,
      }),
      now: () => "2026-11-04T15:00:00.000Z",
    });

    const first = await handler(request());
    const replay = await handler(request());
    assert.equal(first.status, 200);
    assert.equal(replay.status, 200);
    const firstBody = await first.json();
    const replayBody = await replay.json();
    assert.equal(firstBody.funnelStatus, "created");
    assert.equal(replayBody.funnelStatus, "duplicate");
    assert.equal(firstBody.candidateId, replayBody.candidateId);
    assert.equal(firstBody.identityStatus, "new");
    assert.equal(firstBody.qualification, "needs_review");
    assert.equal(firstBody.founderAction.sourceLabel, "Website Concierge");
    assert.equal(firstBody.founderAction.reviewStatus, "pending");
    assert.match(firstBody.founderAction.headline, /SYNTHETIC ACCEPTANCE/);
    assert.equal(firstBody.personId, replayBody.personId);
    assert.equal(firstBody.jobId, replayBody.jobId);
    assert.deepEqual(firstBody.acknowledgement, {
      outboxId: firstBody.acknowledgement.outboxId,
      state: "ready",
      attemptCount: 0,
      reconciliationRequired: false,
      providerMessageId: null,
    });
    assert.equal(firstBody.deliveryMode, "preview-fake-not-dispatched");
    assert.equal(firstBody.booking.state, "requested");
    assert.equal(firstBody.booking.offeredWindow, null);
    assert.equal(websiteStore.intakeCount, 1);
    assert.equal(funnelStore.snapshot().length, 1);
  });

  it("fails closed on disabled, unauthenticated, cross-origin, or non-fixture requests", async () => {
    const base = {
      prepare: async () => { throw new Error("must-not-run"); },
      now: () => "2026-11-04T15:00:00.000Z",
    };
    const disabled = createPreviewConciergeAcceptanceHandler({
      ...base, enabled: () => false, authorize: async () => true,
    });
    assert.equal((await disabled(request())).status, 404);

    const unauthorized = createPreviewConciergeAcceptanceHandler({
      ...base, enabled: () => true, authorize: async () => false,
    });
    assert.equal((await unauthorized(request())).status, 401);
    assert.equal((await unauthorized(request(BODY, "https://evil.example"))).status, 403);

    const authorized = createPreviewConciergeAcceptanceHandler({
      ...base, enabled: () => true, authorize: async () => true,
    });
    assert.equal((await authorized(request({ ...BODY, email: "real@example.com" }))).status, 400);
  });
});
