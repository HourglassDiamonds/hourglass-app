import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";
import {
  CONTINUUM_SOURCE_SYSTEMS,
  PERSON_IDENTITY_KINDS,
  type ContinuumEvent,
  type ContinuumEvidence,
  type ContinuumException,
} from "./types";
import {
  assertNoPii,
  isContinuumJsonValue,
  isContinuumSourceSystem,
  validateConfidence,
  validateEvidenceSourceRefs,
  validateIdentityKind,
  validateObservation,
} from "./validation";

describe("Continuum contracts", () => {
  it("does not treat hubspot_deal_id as a person identity", () => {
    assert.equal(
      (PERSON_IDENTITY_KINDS as readonly string[]).includes("hubspot_deal_id"),
      false,
    );
    const rejected = validateIdentityKind("hubspot_deal_id");
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.match(rejected.reason, /source-record reference/);
    }
    assert.equal(validateIdentityKind("hubspot_contact_id").ok, true);
    assert.equal(validateIdentityKind("email_hash").ok, true);
    assert.equal(validateIdentityKind("import_row_key").ok, true);
  });

  it("accepts gmail as a Continuum source system for protected source records", () => {
    assert.equal(
      (CONTINUUM_SOURCE_SYSTEMS as readonly string[]).includes("gmail"),
      true,
    );
    assert.equal(
      (CONTINUUM_SOURCE_SYSTEMS as readonly string[]).includes("google-contacts"),
      false,
    );
    assert.equal(isContinuumSourceSystem("gmail"), true);
    assert.equal(isContinuumSourceSystem("google-contacts"), false);
  });

  it("accepts recursive JSON-safe observation values and rejects Date", () => {
    assert.equal(
      isContinuumJsonValue({
        shape: "oval",
        metrics: { share: 0.42, count: 4 },
        samples: [1, 2, 3],
      }),
      true,
    );
    assert.equal(isContinuumJsonValue(["oval", "round"]), true);
    assert.equal(isContinuumJsonValue(null), true);
    assert.equal(
      isContinuumJsonValue({ when: new Date("2026-08-22T00:00:00.000Z") }),
      false,
    );
    assert.equal(
      validateObservation({
        confidence: 1,
        epistemicClass: "derived",
        value: { when: new Date("2026-08-22T00:00:00.000Z") } as never,
      }).ok,
      false,
    );
  });

  it("rejects confidence outside 0–1", () => {
    assert.equal(validateConfidence(0).ok, true);
    assert.equal(validateConfidence(1).ok, true);
    assert.equal(validateConfidence(0.42).ok, true);
    assert.equal(validateConfidence(-0.01).ok, false);
    assert.equal(validateConfidence(1.01).ok, false);
    assert.equal(validateConfidence(Number.NaN).ok, false);
  });

  it("enforces evidence source-kind reference invariants", () => {
    assert.equal(
      validateEvidenceSourceRefs({
        sourceKind: "source-record",
        sourceRecordId: "abc",
        eventId: null,
        observationId: null,
      }).ok,
      true,
    );
    assert.equal(
      validateEvidenceSourceRefs({
        sourceKind: "source-record",
        sourceRecordId: "abc",
        eventId: "evt",
        observationId: null,
      }).ok,
      false,
    );
    assert.equal(
      validateEvidenceSourceRefs({
        sourceKind: "event",
        sourceRecordId: null,
        eventId: "evt",
        observationId: null,
      }).ok,
      true,
    );
    assert.equal(
      validateEvidenceSourceRefs({
        sourceKind: "event",
        sourceRecordId: null,
        eventId: "evt",
        observationId: "obs",
      }).ok,
      false,
    );
    assert.equal(
      validateEvidenceSourceRefs({
        sourceKind: "observation",
        sourceRecordId: null,
        eventId: null,
        observationId: "obs",
      }).ok,
      true,
    );
    assert.equal(
      validateEvidenceSourceRefs({
        sourceKind: "analytics-query",
        sourceRecordId: "ga4:q",
        eventId: "evt",
        observationId: null,
      }).ok,
      false,
    );
  });

  it("has no raw email field on generic event/evidence/exception contracts", () => {
    const eventKeys: Array<keyof ContinuumEvent> = [
      "id",
      "schemaVersion",
      "eventType",
      "occurredAt",
      "ingestedAt",
      "producer",
      "sourceSystem",
      "sourceRecordId",
      "subjectEntityId",
      "idempotencyKey",
      "payload",
    ];
    assert.equal(eventKeys.includes("email" as keyof ContinuumEvent), false);
    const evidenceKeys: Array<keyof ContinuumEvidence> = [
      "id",
      "schemaVersion",
      "sourceSystem",
      "sourceKind",
      "sourceRecordId",
      "eventId",
      "observationId",
      "collectedAt",
      "reportingPeriod",
      "freshness",
      "reliability",
      "redactionStatus",
      "summary",
      "supportingPointer",
      "idempotencyKey",
      "claimFingerprint",
    ];
    assert.equal(
      evidenceKeys.includes("email" as keyof ContinuumEvidence),
      false,
    );
    const exceptionKeys: Array<keyof ContinuumException> = [
      "id",
      "exceptionType",
      "subjectKey",
      "subjectEntityId",
      "status",
      "openedAt",
      "lastSeenAt",
      "resolvedAt",
      "detector",
      "evidenceId",
      "payload",
    ];
    assert.equal(
      exceptionKeys.includes("email" as keyof ContinuumException),
      false,
    );
    assert.equal(
      assertNoPii({ payload: { emailsSent: 1 } }, "exception").ok,
      true,
    );
    assert.equal(
      assertNoPii({ email: "visitor@example.com" }, "event").ok,
      false,
    );
    assert.equal(assertNoPii({ recipient: "Ada" }, "event").ok, false);
    assert.equal(assertNoPii({ phone: "555-123-4567" }, "event").ok, false);
  });

  it("schema SQL forbids hubspot_deal_id identity and enables RLS without anon policies", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "lib/supabase/continuum-schema.sql"),
      "utf8",
    );
    assert.match(sql, /identity_kind in \(/);
    assert.doesNotMatch(
      sql,
      /identity_kind in \([^)]*hubspot_deal_id/,
    );
    assert.match(sql, /create table if not exists continuum_entities/);
    assert.match(sql, /create table if not exists continuum_external_identities/);
    assert.match(sql, /create table if not exists continuum_events/);
    assert.match(sql, /create table if not exists continuum_evidence/);
    assert.match(sql, /create table if not exists continuum_observations/);
    assert.match(sql, /create table if not exists continuum_observation_evidence/);
    assert.match(sql, /create table if not exists continuum_exceptions/);
    assert.equal((sql.match(/enable row level security/g) ?? []).length, 7);
    assert.doesNotMatch(sql, /create policy/i);
    assert.match(sql, /PHASE 1B\.1: DO NOT APPLY TO PRODUCTION/);
  });
});
