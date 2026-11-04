import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail, hashPhone } from "../client-memory/hashes";
import { classifyWebsiteInquiry, validateWebsiteInquiryFormData } from "../website-intake/validation";
import type { WebsiteInquiry } from "../website-intake/types";
import { addSuppression, maySendFollowUp } from "./kernel";
import { FakeAcknowledgementTransport } from "./fake-providers";
import { APPROVED_PREVIEW_COPY, FIXTURE_NOW, PENDING_COPY, SERVICE_ONLY_CONSENT } from "./fixtures";
import { InMemoryConciergeFunnelStore } from "./memory";
import {
  PreviewWebsiteIntakeStore,
  runPreviewConciergeAcceptance,
} from "./preview-acceptance";
import { toSupabaseConciergeAcceptanceParams } from "./persistence-contract";

const REQUESTED_WINDOW = {
  start: "2026-11-12T18:00:00.000Z",
  end: "2026-11-12T19:00:00.000Z",
};

function websiteInquiry(overrides: Partial<WebsiteInquiry> = {}): WebsiteInquiry {
  const form = new FormData();
  const values = {
    submissionId: "11111111-1111-4111-8111-111111111111",
    fullName: "Avery Client",
    email: "avery@example.test",
    phone: "+1 212 555 0199",
    preferredContactMethod: "Email",
    projectType: "Engagement Ring",
    shapeInterest: "Round",
    designDirection: "Classic Timeless",
    ringPresence: "Understated",
    timeline: "3–4 months",
    budgetRange: "10–20k",
    inspirationNotes: "A restrained, timeless design.",
  };
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  const validated = validateWebsiteInquiryFormData(form);
  if (!validated.ok) throw new Error(validated.message);
  return {
    ...validated.value,
    category: classifyWebsiteInquiry(validated.value.projectType),
    attribution: {
      utm_source: "editorial",
      utm_campaign: "heirloom",
      landing_path: "/diamond-guide",
      last_cta_location: "article-footer",
    },
    source: "hourglassdiamonds.com/concierge",
    acknowledgementExpected: true,
    synthetic: false,
    ...overrides,
  };
}

function input(options: {
  inquiry?: WebsiteInquiry;
  websiteStore?: PreviewWebsiteIntakeStore;
  funnelStore?: InMemoryConciergeFunnelStore;
  transport?: FakeAcknowledgementTransport;
  copy?: typeof APPROVED_PREVIEW_COPY | typeof PENDING_COPY;
} = {}) {
  return {
    inquiry: options.inquiry ?? websiteInquiry(),
    websiteStore: options.websiteStore ?? new PreviewWebsiteIntakeStore(),
    funnelStore: options.funnelStore ?? new InMemoryConciergeFunnelStore(),
    emailVerification: "verified" as const,
    acknowledgementCopy: options.copy ?? APPROVED_PREVIEW_COPY,
    consent: SERVICE_ONLY_CONSENT,
    acknowledgementTransport: options.transport ?? new FakeAcknowledgementTransport(),
    requestedWindow: REQUESTED_WINDOW,
    now: FIXTURE_NOW,
  };
}

describe("website intake → Concierge Preview integration", () => {
  it("carries a validated inquiry end to end without HubSpot or invented availability", async () => {
    const websiteStore = new PreviewWebsiteIntakeStore();
    const transport = new FakeAcknowledgementTransport();
    const result = await runPreviewConciergeAcceptance(input({ websiteStore, transport }));

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.intake.hubspotStatus, "skipped");
    assert.equal(websiteStore.hubSpotOutcomes.length, 0);
    assert.deepEqual(result.record.lead.attribution, {
      utm_source: "editorial",
      utm_campaign: "heirloom",
      landing_path: "/diamond-guide",
      last_cta_location: "article-footer",
    });
    assert.equal(result.record.lead.qualification, "qualified");
    assert.match(result.record.nextAction.candidate.candidateId, /^[a-f0-9]{64}$/);
    assert.equal(result.record.nextAction.candidate.payload.kind, "open_job");
    assert.equal(result.todayAction.lane, "decision");
    assert.deepEqual(result.todayAction.candidateIds, [result.record.nextAction.candidate.candidateId]);
    assert.equal(result.acknowledgement.state, "sent");
    assert.equal(transport.sent.length, 1);
    assert.equal(result.booking.state, "requested");
    assert.equal(result.booking.offeredWindow, null);
    assert.equal(result.booking.providerEventId, null);
  });

  it("replays without duplicating the intake, lead, Candidate, Person, or fake message", async () => {
    const websiteStore = new PreviewWebsiteIntakeStore();
    const funnelStore = new InMemoryConciergeFunnelStore();
    const transport = new FakeAcknowledgementTransport();
    const args = input({ websiteStore, funnelStore, transport });
    const first = await runPreviewConciergeAcceptance(args);
    const replay = await runPreviewConciergeAcceptance(args);

    assert.equal(first.ok, true);
    assert.equal(replay.ok, true);
    if (!first.ok || !replay.ok) return;
    assert.equal(replay.intake.status, "already-present");
    assert.equal(replay.funnelStatus, "duplicate");
    assert.equal(websiteStore.intakeCount, 1);
    assert.equal(websiteStore.personCount, 1);
    assert.equal(funnelStore.snapshot().length, 1);
    assert.equal(transport.sent.length, 1);
    assert.equal(first.record.lead.leadId, replay.record.lead.leadId);
    assert.equal(first.record.nextAction.candidate.candidateId, replay.record.nextAction.candidate.candidateId);
  });

  it("reuses an existing Person and flags conflicting identities for founder review", async () => {
    const inquiry = websiteInquiry();
    const existingPersonId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const matchedStore = new PreviewWebsiteIntakeStore(
      new Map([[hashEmail(inquiry.email)!, [existingPersonId]]]),
    );
    const matched = await runPreviewConciergeAcceptance(input({ inquiry, websiteStore: matchedStore }));
    assert.equal(matched.ok, true);
    if (!matched.ok) return;
    assert.equal(matched.intake.identityStatus, "matched");
    assert.equal(matched.record.lead.personId, existingPersonId);
    assert.equal(matchedStore.personCount, 1);

    const secondPersonId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const conflictingStore = new PreviewWebsiteIntakeStore(
      new Map([
        [hashEmail(inquiry.email)!, [existingPersonId]],
        [hashPhone(inquiry.phone)!, [secondPersonId]],
      ]),
    );
    const conflict = await runPreviewConciergeAcceptance(
      input({ inquiry, websiteStore: conflictingStore }),
    );
    assert.equal(conflict.ok, true);
    if (!conflict.ok) return;
    assert.equal(conflict.intake.identityStatus, "needs_review");
    assert.equal(conflict.record.lead.personId, null);
    assert.equal(conflict.record.lead.qualification, "needs_review");
    assert.match(conflict.todayAction.headline, /Resolve identity/);
  });

  it("fails closed before downstream work when the website intake is unavailable", async () => {
    const websiteStore = new PreviewWebsiteIntakeStore(new Map(), false);
    const funnelStore = new InMemoryConciergeFunnelStore();
    const transport = new FakeAcknowledgementTransport();
    const result = await runPreviewConciergeAcceptance(
      input({ websiteStore, funnelStore, transport }),
    );
    assert.deepEqual(result, { ok: false, stage: "website-intake", reason: "unavailable" });
    assert.equal(funnelStore.snapshot().length, 0);
    assert.equal(transport.sent.length, 0);
  });

  it("quarantines uncertain acknowledgment delivery and blocks blind replay", async () => {
    const websiteStore = new PreviewWebsiteIntakeStore();
    const funnelStore = new InMemoryConciergeFunnelStore();
    const transport = new FakeAcknowledgementTransport("unknown");
    const args = input({ websiteStore, funnelStore, transport });
    const first = await runPreviewConciergeAcceptance(args);
    const replay = await runPreviewConciergeAcceptance(args);
    assert.equal(first.ok, true);
    assert.equal(replay.ok, true);
    if (!first.ok || !replay.ok) return;
    assert.equal(first.acknowledgement.state, "delivery_unknown");
    assert.equal(first.acknowledgement.reconciliationRequired, true);
    assert.equal(replay.acknowledgement.state, "delivery_unknown");
    assert.equal(transport.sent.length, 1);
  });

  it("enforces copy approval and follow-up consent/suppression", async () => {
    const transport = new FakeAcknowledgementTransport();
    await assert.rejects(
      runPreviewConciergeAcceptance(input({ transport, copy: PENDING_COPY })),
      /acknowledgement-not-ready/,
    );
    assert.equal(transport.sent.length, 0);

    const result = await runPreviewConciergeAcceptance(input());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(maySendFollowUp(result.record.followUp), false);
    const consented = {
      ...result.record.followUp,
      consent: { ...result.record.followUp.consent, followUp: "granted" as const },
    };
    assert.equal(maySendFollowUp(consented), true);
    for (const reason of ["reply_received", "booking_confirmed", "opted_out", "lead_status_changed"] as const) {
      assert.equal(maySendFollowUp(addSuppression(consented, reason, FIXTURE_NOW)), false);
    }
  });

  it("builds the exact future Supabase RPC payload without performing I/O", async () => {
    const result = await runPreviewConciergeAcceptance(input());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const params = toSupabaseConciergeAcceptanceParams(result.record);
    assert.equal(params.p_intake_id, result.intake.intakeId);
    assert.equal(params.p_candidate.canonical, false);
    assert.equal(params.p_candidate.automaticApply, false);
    assert.equal(params.p_acknowledgement.idempotencyKey, result.record.acknowledgement.idempotencyKey);
  });
});
