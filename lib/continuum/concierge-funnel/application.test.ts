import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail, hashPhone } from "../client-memory/hashes";
import { sourceLabelFor } from "../chief-of-staff/operating-loop/evidence";
import { FakeAcknowledgementTransport } from "./fake-providers";
import {
  APPROVED_PREVIEW_COPY,
  FIXTURE_NOW,
  SERVICE_ONLY_CONSENT,
  fixtureInquiry,
} from "./fixtures";
import { dispatchAcknowledgement, maySendFollowUp } from "./kernel";
import { InMemoryConciergeFunnelStore } from "./memory";
import { PreviewWebsiteIntakeStore } from "./preview-acceptance";
import { preparePersistentConciergeAcceptance } from "./application";
import type {
  AcceptIntakeResult,
  ConciergeFunnelRecord,
  ConciergeFunnelStore,
} from "./types";

const WINDOW = {
  start: "2026-11-12T18:00:00.000Z",
  end: "2026-11-12T19:00:00.000Z",
};

function args(options: {
  websiteStore?: PreviewWebsiteIntakeStore;
  funnelStore?: ConciergeFunnelStore;
  inquiry?: ReturnType<typeof fixtureInquiry>;
  verified?: boolean;
} = {}) {
  return {
    inquiry: options.inquiry ?? fixtureInquiry(),
    websiteStore: options.websiteStore ?? new PreviewWebsiteIntakeStore(),
    funnelStore: options.funnelStore ?? new InMemoryConciergeFunnelStore(),
    emailVerificationEvidence: options.verified
      ? ({
          status: "verified",
          source: "authoritative_existing_identity",
          reference: "local-fixture-evidence",
        } as const)
      : undefined,
    acknowledgementCopy: APPROVED_PREVIEW_COPY,
    consent: SERVICE_ONLY_CONSENT,
    requestedWindow: WINDOW,
    now: FIXTURE_NOW,
  };
}

describe("persistent Concierge application integration", () => {
  it("persists, reloads, and exposes a qualified Website Concierge founder action without dispatch", async () => {
    const inquiry = fixtureInquiry();
    const personId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const websiteStore = new PreviewWebsiteIntakeStore(
      new Map([[hashEmail(inquiry.email)!, [personId]]]),
    );
    const funnelStore = new InMemoryConciergeFunnelStore();
    const result = await preparePersistentConciergeAcceptance(
      args({ inquiry, websiteStore, funnelStore, verified: true }),
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.record.lead.personId, personId);
    assert.equal(result.record.lead.qualification, "qualified");
    assert.equal(result.todayAction.sourceLabel, "Website Concierge");
    assert.equal(sourceLabelFor(result.record.nextAction.candidate), "Website Concierge");
    assert.equal(result.acknowledgement.state, "ready");
    assert.equal(result.acknowledgement.attemptCount, 0);
    assert.equal(result.deliveryMode, "preview-fake-not-dispatched");
    assert.deepEqual(result.record.lead.attribution, inquiry.attribution);
    assert.equal(result.booking.state, "requested");
    assert.equal(result.booking.offeredWindow, null);
    assert.equal(result.booking.providerEventId, null);
    assert.equal(maySendFollowUp(result.record.followUp), false);
    const reloaded = await funnelStore.getBySubmissionId(inquiry.submissionId);
    assert.equal(reloaded?.nextAction.candidate.candidateId, result.record.nextAction.candidate.candidateId);
    assert.equal(reloaded?.acknowledgement.state, "ready");
  });

  it("defaults new email identities to unverified and preserves ambiguous identity review", async () => {
    const unverified = await preparePersistentConciergeAcceptance(args());
    assert.equal(unverified.ok, true);
    if (!unverified.ok) return;
    assert.equal(unverified.record.intake.emailVerification, "unverified");
    assert.equal(unverified.record.lead.qualification, "needs_review");
    assert.match(unverified.todayAction.headline, /Verify contact identity/);

    const inquiry = fixtureInquiry({ submissionId: "22222222-2222-4222-8222-222222222222" });
    const ambiguousStore = new PreviewWebsiteIntakeStore(
      new Map([
        [hashEmail(inquiry.email)!, ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]],
        [hashPhone("+1 212 555 0199")!, ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]],
      ]),
    );
    const ambiguous = await preparePersistentConciergeAcceptance(
      args({
        inquiry: { ...inquiry, phone: "+1 212 555 0199" },
        websiteStore: ambiguousStore,
        verified: true,
      }),
    );
    assert.equal(ambiguous.ok, true);
    if (!ambiguous.ok) return;
    assert.equal(ambiguous.record.intake.identity.status, "needs_review");
    assert.equal(ambiguous.record.lead.personId, null);
    assert.equal(ambiguous.record.lead.qualification, "needs_review");
  });

  it("is replay/concurrency safe and never dispatches implicitly", async () => {
    const websiteStore = new PreviewWebsiteIntakeStore();
    const funnelStore = new InMemoryConciergeFunnelStore();
    const input = args({ websiteStore, funnelStore, verified: true });
    const [first, second] = await Promise.all([
      preparePersistentConciergeAcceptance(input),
      preparePersistentConciergeAcceptance(input),
    ]);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(websiteStore.intakeCount, 1);
    assert.equal(funnelStore.snapshot().length, 1);
    assert.deepEqual(
      [first.funnelStatus, second.funnelStatus].sort(),
      ["created", "duplicate"],
    );
    assert.equal(first.record.nextAction.candidate.candidateId, second.record.nextAction.candidate.candidateId);
    assert.equal(first.acknowledgement.attemptCount, 0);
    assert.equal(second.acknowledgement.attemptCount, 0);
  });

  it("fails closed for conflicting replays and not-expected acknowledgements", async () => {
    const websiteStore = new PreviewWebsiteIntakeStore();
    const funnelStore = new InMemoryConciergeFunnelStore();
    const first = await preparePersistentConciergeAcceptance(args({ websiteStore, funnelStore }));
    assert.equal(first.ok, true);
    const conflict = await preparePersistentConciergeAcceptance(
      args({
        websiteStore,
        funnelStore,
        inquiry: fixtureInquiry({ fullName: "Changed Replay" }),
      }),
    );
    assert.deepEqual(conflict, {
      ok: false,
      stage: "website-intake",
      reason: "idempotency-conflict",
    });

    class NotExpectedStore implements ConciergeFunnelStore {
      async accept(): Promise<AcceptIntakeResult> {
        throw new Error("website-acknowledgement-not-pending");
      }
      async getBySubmissionId(): Promise<ConciergeFunnelRecord | null> { return null; }
      async updateAcknowledgement(): Promise<void> {}
    }
    const notExpected = await preparePersistentConciergeAcceptance(
      args({ funnelStore: new NotExpectedStore() }),
    );
    assert.deepEqual(notExpected, {
      ok: false,
      stage: "concierge-funnel",
      reason: "acknowledgement-not-expected",
    });
  });

  it("quarantines an explicitly exercised unknown fake delivery across reload", async () => {
    const funnelStore = new InMemoryConciergeFunnelStore();
    const result = await preparePersistentConciergeAcceptance(args({ funnelStore, verified: true }));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const transport = new FakeAcknowledgementTransport("unknown");
    const delivered = await dispatchAcknowledgement(
      funnelStore,
      result.record.intake.submissionId,
      transport,
      FIXTURE_NOW,
    );
    assert.equal(delivered.state, "delivery_unknown");
    assert.equal(delivered.reconciliationRequired, true);
    const restarted = await funnelStore.getBySubmissionId(result.record.intake.submissionId);
    assert.equal(restarted?.acknowledgement.state, "delivery_unknown");
    assert.equal(transport.sent.length, 1);
    await dispatchAcknowledgement(
      funnelStore,
      result.record.intake.submissionId,
      transport,
      FIXTURE_NOW,
    );
    assert.equal(transport.sent.length, 1);
  });
});
