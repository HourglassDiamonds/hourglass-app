import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { candidateToRow } from "../candidates/rows";
import { buildFunnelRecord } from "./kernel";
import { APPROVED_PREVIEW_COPY, FIXTURE_NOW, SERVICE_ONLY_CONSENT, fixtureInquiry } from "./fixtures";
import {
  conciergeAcceptancePayloadHash,
  toSupabaseConciergeAcceptanceParams,
} from "./persistence-contract";
import { WEBSITE_CONCIERGE_SOURCE_LABEL } from "./preview-acceptance";
import { SupabaseConciergeFunnelStore } from "./supabase";

type Row = Record<string, unknown>;

class Query {
  private filtered: Row[];

  constructor(rows: Row[]) {
    this.filtered = rows;
  }

  select(): this { return this; }
  eq(column: string, value: unknown): this {
    this.filtered = this.filtered.filter((row) => row[column] === value);
    return this;
  }
  order(): this { return this; }
  limit(value: number): this { this.filtered = this.filtered.slice(0, value); return this; }
  async maybeSingle() { return { data: this.filtered[0] ?? null, error: null }; }
  then(resolve: (value: { data: Row[]; error: null }) => unknown) {
    return Promise.resolve({ data: this.filtered, error: null }).then(resolve);
  }
}

class FakeSupabase {
  readonly tables: Record<string, Row[]>;
  rpcCalls = 0;

  constructor(tables: Record<string, Row[]>) {
    this.tables = tables;
  }

  from(table: string): Query {
    return new Query(this.tables[table] ?? []);
  }

  async rpc(name: string, params: Row) {
    this.rpcCalls += 1;
    if (name === "continuum_accept_concierge_funnel_v1") {
      return { data: { status: "created", intake_id: params.p_intake_id,
        candidate_id: (params.p_candidate as Row).candidateId,
        outbox_id: (params.p_acknowledgement as Row).outboxId }, error: null };
    }
    if (name === "continuum_transition_concierge_ack_v1") {
      const row = this.tables.continuum_concierge_ack_outbox?.find(
        (item) => item.outbox_id === params.p_outbox_id,
      );
      if (!row) return { data: null, error: { message: "acknowledgement-not-found" } };
      row.state = params.p_state;
      row.attempt_count = params.p_attempt_count;
      row.provider_message_id = params.p_provider_message_id;
      row.last_attempt_at = params.p_last_attempt_at;
      row.reconciliation_required = params.p_reconciliation_required;
      return { data: { status: "updated", state: params.p_state }, error: null };
    }
    return { data: null, error: { message: "unexpected-rpc" } };
  }
}

function fixture() {
  const intakeId = "55555555-5555-4555-8555-555555555555";
  const personId = "77777777-7777-4777-8777-777777777777";
  const inquiry = fixtureInquiry();
  const record = buildFunnelRecord({ intakeId, inquiry,
    identity: { status: "matched", personId }, emailVerification: "verified",
    acknowledgementCopy: APPROVED_PREVIEW_COPY, consent: SERVICE_ONLY_CONSENT, now: FIXTURE_NOW });
  const params = toSupabaseConciergeAcceptanceParams(record);
  const intake: Row = {
    intake_id: intakeId, idempotency_key_hash: params.p_expected_website_idempotency_key_hash,
    payload_hash: "f".repeat(64), source: inquiry.source, identity_status: "matched",
    person_id: personId, full_name: inquiry.fullName, email: inquiry.email, phone: inquiry.phone,
    preferred_contact_method: inquiry.preferredContactMethod, category: inquiry.category,
    project_type: inquiry.projectType, shape_interest: inquiry.shapeInterest,
    design_direction: inquiry.designDirection, ring_presence: inquiry.ringPresence,
    timeline: inquiry.timeline, budget_range: inquiry.budgetRange,
    inspiration_notes: inquiry.inspirationNotes, attribution: inquiry.attribution,
    synthetic: false, acknowledgement_state: "pending", submitted_at: FIXTURE_NOW,
  };
  const acknowledgement = params.p_acknowledgement;
  const outbox: Row = {
    outbox_id: acknowledgement.outboxId, intake_id: intakeId,
    candidate_id: record.nextAction.candidate.candidateId, event_id: acknowledgement.eventId,
    lead_id: acknowledgement.leadId, action_id: acknowledgement.actionId,
    concierge_idempotency_key: acknowledgement.conciergeIdempotencyKey,
    concierge_payload_hash: acknowledgement.conciergePayloadHash,
    recipient_email: acknowledgement.to, email_verification: acknowledgement.emailVerification,
    qualification: acknowledgement.qualification, source_label: WEBSITE_CONCIERGE_SOURCE_LABEL,
    copy_version: acknowledgement.copy.copyVersion,
    copy_approval_status: acknowledgement.copy.approvalStatus,
    copy_subject: acknowledgement.copy.subject, copy_text: acknowledgement.copy.text,
    acknowledgement_idempotency_key: acknowledgement.idempotencyKey,
    state: acknowledgement.state, attempt_count: 0, provider_message_id: null,
    last_attempt_at: null, reconciliation_required: false,
    follow_up_policy: record.followUp, created_at: FIXTURE_NOW,
  };
  return { record, client: new FakeSupabase({
    continuum_website_intakes: [intake],
    continuum_concierge_ack_outbox: [outbox],
    continuum_candidates: [candidateToRow(record.nextAction.candidate) as unknown as Row],
  }) };
}

describe("Supabase Concierge persistence adapter", () => {
  it("reloads the authoritative client identity, Candidate, and founder action", async () => {
    const { record, client } = fixture();
    const store = new SupabaseConciergeFunnelStore(client as unknown as SupabaseClient);
    const accepted = await store.accept(record);
    assert.equal(accepted.status, "duplicate");
    assert.equal(client.rpcCalls, 0);
    assert.equal(accepted.record.intake.identity.status, "matched");
    assert.equal(accepted.record.lead.personId, "77777777-7777-4777-8777-777777777777");
    assert.equal(accepted.record.nextAction.candidate.candidateId, record.nextAction.candidate.candidateId);
    const actions = await store.listFounderActions();
    assert.equal(actions.length, 1);
    assert.equal(actions[0]?.sourceLabel, WEBSITE_CONCIERGE_SOURCE_LABEL);
    assert.equal(actions[0]?.candidateIds[0], record.nextAction.candidate.candidateId);
  });

  it("treats request-time timestamps as replay metadata but rejects changed intent", async () => {
    const { record, client } = fixture();
    const replay = buildFunnelRecord({
      intakeId: record.intake.intakeId,
      inquiry: record.intake.inquiry,
      identity: record.intake.identity,
      emailVerification: record.intake.emailVerification,
      acknowledgementCopy: record.acknowledgement.copy,
      consent: {
        ...record.followUp.consent,
        capturedAt: "2026-11-04T15:05:00.000Z",
      },
      now: "2026-11-04T15:05:00.000Z",
    });

    assert.equal(
      conciergeAcceptancePayloadHash(replay),
      conciergeAcceptancePayloadHash(record),
    );
    const store = new SupabaseConciergeFunnelStore(
      client as unknown as SupabaseClient,
    );
    const duplicate = await store.accept(replay);
    assert.equal(duplicate.status, "duplicate");
    assert.equal(duplicate.record.intake.intakeId, record.intake.intakeId);
    assert.equal(
      duplicate.record.nextAction.candidate.candidateId,
      record.nextAction.candidate.candidateId,
    );
    assert.equal(
      duplicate.record.acknowledgement.outboxId,
      record.acknowledgement.outboxId,
    );
    assert.equal(client.rpcCalls, 0);

    const changedCopy = {
      ...replay,
      acknowledgement: {
        ...replay.acknowledgement,
        copy: {
          ...replay.acknowledgement.copy,
          text: `${replay.acknowledgement.copy.text} Changed.`,
        },
      },
    };
    assert.notEqual(
      conciergeAcceptancePayloadHash(changedCopy),
      conciergeAcceptancePayloadHash(record),
    );
    assert.deepEqual(await store.accept(changedCopy), {
      status: "idempotency_conflict",
    });
    assert.equal(client.rpcCalls, 0);
  });

  it("reloads quarantined unknown delivery state through a fresh adapter", async () => {
    const { record, client } = fixture();
    const first = new SupabaseConciergeFunnelStore(client as unknown as SupabaseClient);
    const sending = { ...record.acknowledgement, state: "sending" as const,
      attemptCount: 1, lastAttemptAt: FIXTURE_NOW };
    await first.updateAcknowledgement(sending);
    await first.updateAcknowledgement({ ...sending, state: "delivery_unknown",
      reconciliationRequired: true });
    const restarted = new SupabaseConciergeFunnelStore(client as unknown as SupabaseClient);
    const loaded = await restarted.getBySubmissionId(record.intake.submissionId);
    assert.equal(loaded?.acknowledgement.state, "delivery_unknown");
    assert.equal(loaded?.acknowledgement.reconciliationRequired, true);
    assert.equal(loaded?.acknowledgement.providerMessageId, null);
  });

  it("keeps the adapter server-only and the migration deny-by-default", () => {
    const server = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
    const migration = readFileSync(new URL(
      "../../../supabase/migrations/20261104201449_continuum_concierge_funnel_persistence.sql",
      import.meta.url,
    ), "utf8");
    assert.match(server, /import "server-only"/);
    assert.match(server, /getSupabaseAdmin/);
    assert.doesNotMatch(server, /NEXT_PUBLIC_/);
    assert.match(migration, /force row level security/i);
    assert.match(migration, /security invoker/gi);
    assert.doesNotMatch(migration, /security definer/i);
    assert.match(migration, /revoke all on function[\s\S]+from public, anon, authenticated/i);
    assert.doesNotMatch(migration, /grant execute[\s\S]+to (anon|authenticated)/i);
  });
});
