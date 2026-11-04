import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  acceptConciergeIntake,
  addSuppression,
  admitCapacity,
  confirmProviderBooking,
  dispatchAcknowledgement,
  maySendFollowUp,
  offerBooking,
  rescheduleProviderBooking,
} from "./kernel";
import { FakeAcknowledgementTransport } from "./fake-providers";
import { APPROVED_PREVIEW_COPY, FIXTURE_NOW, PENDING_COPY, fixtureInput, fixtureInquiry } from "./fixtures";
import { InMemoryConciergeFunnelStore } from "./memory";
import type { BookingRequest, CapacityAdmission, FollowUpPolicy } from "./types";

describe("Concierge funnel Preview acceptance", () => {
  it("atomically deduplicates intake, lead, candidate, and acknowledgement while retaining attribution", async () => {
    const store = new InMemoryConciergeFunnelStore();
    const first = await acceptConciergeIntake(store, fixtureInput());
    const replay = await acceptConciergeIntake(store, fixtureInput({ intakeId: "a-different-retry-id" }));

    assert.equal(first.status, "created");
    assert.equal(replay.status, "duplicate");
    assert.equal(store.snapshot().length, 1);
    if (first.status === "idempotency_conflict" || replay.status === "idempotency_conflict") return;
    assert.equal(first.record.lead.leadId, replay.record.lead.leadId);
    assert.equal(first.record.acknowledgement.outboxId, replay.record.acknowledgement.outboxId);
    assert.deepEqual(first.record.lead.attribution, {
      utm_source: "editorial",
      utm_campaign: "heirloom",
      landing_path: "/diamond-guide",
    });
  });

  it("rejects a replay that reuses an idempotency key with changed payload", async () => {
    const store = new InMemoryConciergeFunnelStore();
    await acceptConciergeIntake(store, fixtureInput());
    const conflict = await acceptConciergeIntake(store, fixtureInput({
      inquiry: fixtureInquiry({ inspirationNotes: "Changed after submit" }),
    }));
    assert.deepEqual(conflict, { status: "idempotency_conflict" });
    assert.equal(store.snapshot().length, 1);
  });

  it("protects matched and ambiguous identities and never creates a canonical Project", async () => {
    const store = new InMemoryConciergeFunnelStore();
    const matched = await acceptConciergeIntake(store, fixtureInput({ identity: { status: "matched", personId: "existing-person-7" } }));
    const ambiguous = await acceptConciergeIntake(store, fixtureInput({
      intakeId: "intake-fixture-002",
      inquiry: fixtureInquiry({ submissionId: "22222222-2222-4222-8222-222222222222", email: "other@example.test" }),
      identity: { status: "needs_review", personId: null },
    }));
    assert.notEqual(matched.status, "idempotency_conflict");
    assert.notEqual(ambiguous.status, "idempotency_conflict");
    if (matched.status === "idempotency_conflict" || ambiguous.status === "idempotency_conflict") return;
    assert.equal(matched.record.lead.personId, "existing-person-7");
    assert.equal(matched.record.lead.canonicalProjectId, null);
    assert.equal(matched.record.nextAction.writesCanonicalProject, false);
    assert.equal(ambiguous.record.lead.personId, null);
    assert.equal(ambiguous.record.lead.qualification, "needs_review");
    assert.match(ambiguous.record.nextAction.subject, /Resolve identity/);
  });

  it("routes a qualified inquiry to a pending founder-reviewed Candidate/Open Job proposal", async () => {
    const result = await acceptConciergeIntake(new InMemoryConciergeFunnelStore(), fixtureInput());
    assert.notEqual(result.status, "idempotency_conflict");
    if (result.status === "idempotency_conflict") return;
    assert.equal(result.record.lead.qualification, "qualified");
    assert.equal(result.record.nextAction.reviewStatus, "pending");
    assert.equal(result.record.nextAction.candidate.candidateType, "open_job");
    assert.equal(result.record.nextAction.candidate.canonical, false);
    assert.equal(result.record.nextAction.candidate.payload.kind, "open_job");
    if (result.record.nextAction.candidate.payload.kind === "open_job") {
      assert.equal(result.record.nextAction.candidate.payload.createJob, false);
    }
  });

  it("requires founder-approved copy and sends only through the fake Preview transport", async () => {
    const store = new InMemoryConciergeFunnelStore();
    await acceptConciergeIntake(store, fixtureInput({ acknowledgementCopy: PENDING_COPY }));
    await assert.rejects(
      dispatchAcknowledgement(store, fixtureInquiry().submissionId, new FakeAcknowledgementTransport(), FIXTURE_NOW),
      /acknowledgement-not-ready/,
    );

    const approvedStore = new InMemoryConciergeFunnelStore();
    await acceptConciergeIntake(approvedStore, fixtureInput({ acknowledgementCopy: APPROVED_PREVIEW_COPY }));
    const fake = new FakeAcknowledgementTransport();
    const sent = await dispatchAcknowledgement(approvedStore, fixtureInquiry().submissionId, fake, FIXTURE_NOW);
    const replay = await dispatchAcknowledgement(approvedStore, fixtureInquiry().submissionId, fake, FIXTURE_NOW);
    assert.equal(sent.state, "sent");
    assert.equal(replay.state, "sent");
    assert.equal(fake.sent.length, 1);
    assert.match(sent.providerMessageId ?? "", /^fake-/);
  });

  it("quarantines uncertain delivery and never blindly retries", async () => {
    const store = new InMemoryConciergeFunnelStore();
    await acceptConciergeIntake(store, fixtureInput());
    const fake = new FakeAcknowledgementTransport("unknown");
    const uncertain = await dispatchAcknowledgement(store, fixtureInquiry().submissionId, fake, FIXTURE_NOW);
    const replay = await dispatchAcknowledgement(store, fixtureInquiry().submissionId, fake, FIXTURE_NOW);
    assert.equal(uncertain.state, "delivery_unknown");
    assert.equal(uncertain.reconciliationRequired, true);
    assert.equal(replay.state, "delivery_unknown");
    assert.equal(fake.sent.length, 1);
  });

  it("detects conflicts, requires provider confirmation, and preserves event identity on reschedule", () => {
    const requested: BookingRequest = {
      bookingId: "booking-1",
      leadId: "lead-1",
      state: "requested",
      requestedWindow: { start: "2026-11-10T15:00:00Z", end: "2026-11-10T16:00:00Z" },
      offeredWindow: null,
      providerEventId: null,
      providerSyncReceipt: null,
      transitions: [{ from: null, to: "requested", occurredAt: FIXTURE_NOW, note: "Client requested a conversation." }],
    };
    const slot = { start: "2026-11-10T15:00:00Z", end: "2026-11-10T16:00:00Z" };
    assert.throws(() => offerBooking(requested, slot, [slot], FIXTURE_NOW), /booking-conflict/);
    const offered = offerBooking(requested, slot, [], FIXTURE_NOW);
    assert.throws(() => confirmProviderBooking(offered, "", "", FIXTURE_NOW), /provider-confirmation-required/);
    const confirmed = confirmProviderBooking(offered, "google-event-7", "sync-1", FIXTURE_NOW);
    const rescheduled = rescheduleProviderBooking(
      confirmed,
      { start: "2026-11-12T18:00:00Z", end: "2026-11-12T19:00:00Z" },
      "sync-2",
      [],
      "2026-11-05T15:00:00Z",
    );
    assert.equal(rescheduled.state, "rescheduled");
    assert.equal(rescheduled.providerEventId, "google-event-7");
    assert.equal(rescheduled.transitions.length, 4);
  });

  it("waitlists beyond configured founder capacity without promising a slot", () => {
    const config = { capacityId: "november", periodStart: "2026-11-01", periodEnd: "2026-11-30", commissionLimit: 1 };
    const active: CapacityAdmission[] = [
      { leadId: "lead-existing", capacityId: "november", state: "admitted", position: null, promisedCapacity: false },
    ];
    const result = admitCapacity(config, active, "lead-new");
    assert.deepEqual(result, {
      leadId: "lead-new",
      capacityId: "november",
      state: "waitlisted",
      position: 1,
      promisedCapacity: false,
    });
  });

  it("stops follow-ups on reply, booking, opt-out, or lead status change", () => {
    const base: FollowUpPolicy = {
      consent: { serviceAcknowledgement: true, followUp: "granted", textReply: "not_granted", capturedAt: FIXTURE_NOW, source: "concierge_form" },
      suppressions: [],
    };
    assert.equal(maySendFollowUp(base), true);
    for (const reason of ["reply_received", "booking_confirmed", "opted_out", "lead_status_changed"] as const) {
      assert.equal(maySendFollowUp(addSuppression(base, reason, FIXTURE_NOW)), false);
    }
    assert.equal(maySendFollowUp({ ...base, consent: { ...base.consent, followUp: "not_granted" } }), false);
  });
});
