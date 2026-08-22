import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { CONTINUUM_SCHEMA_VERSION } from "../contracts/types";
import { assertNoPii, findPiiViolation, validateIdentityKind } from "../contracts/validation";
import { InMemoryContinuumStore } from "../persistence/memory";
import { hashEmail, hashPhone } from "./hashes";
import { InMemoryClientMemoryStore } from "./store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "./types";
import { dryRunReconciliationWorkbook } from "./dry-run";
import {
  buildSyntheticXlsx,
  emptyWorkbookSheets,
  personCells,
  projectCells,
} from "./synthetic-xlsx";

const NOW = "2026-08-22T00:00:00.000Z";

describe("Client Memory PII boundary", () => {
  it("accepts raw email/name/phone only on protected profile and note structures", async () => {
    const memory = new InMemoryClientMemoryStore();
    const person = await memory.insertEntity({
      kind: "person",
      createdAt: NOW,
      createdBy: "test",
    });
    const profile = await memory.insertPersonProfile({
      personId: person.record.id,
      displayName: "Ada Lovelace",
      givenName: "Ada",
      familyName: "Lovelace",
      organizationName: null,
      email: "ada@example.com",
      phone: "305-555-0100",
      streetAddress: "1 Test Street",
      city: "Miami",
      state: "FL",
      country: "US",
      postalCode: "33101",
      roles: ["client"],
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: NOW,
      updatedAt: NOW,
    });
    assert.equal(profile.status, "inserted");
    assert.equal(assertNoPii(profile.record, "person-profile").ok, false);

    const note = await memory.insertSourceNote({
      id: randomUUID(),
      personId: person.record.id,
      projectId: null,
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      sourceArtifact: "synthetic",
      sourceSheet: "People",
      importRowKey: "continuum-reconciliation-v3:People:2",
      gmailThreadId: null,
      noteText: "Call Ada Lovelace at ada@example.com",
      createdAt: NOW,
    });
    assert.equal(note.status, "inserted");
    assert.equal(assertNoPii(note.record, "source-note").ok, false);
  });

  it("keeps generic Continuum Event/Evidence/Observation guards unchanged", async () => {
    const store = new InMemoryContinuumStore();
    await assert.rejects(
      () =>
        store.insertEvent({
          id: randomUUID(),
          schemaVersion: CONTINUUM_SCHEMA_VERSION,
          eventType: "studio.view_emailed",
          occurredAt: NOW,
          ingestedAt: NOW,
          producer: "diamond-studio-email-view",
          sourceSystem: "studio-identified",
          sourceRecordId: "rec-1",
          subjectEntityId: null,
          idempotencyKey: "studio.view_emailed:identified:rec-1",
          payload: {
            identifiedRecordId: "rec-1",
            sharePath: "/diamond-studio?shape=oval",
            configuration: {
              shape: "oval",
              carat: 2.5,
              ringSize: 6,
              bandWidth: 2,
              skinTone: "light",
              orientation: "ns",
              metal: "yellow-gold",
            },
            email: "ada@example.com",
          } as never,
        }),
      /PII rejected/,
    );
    await assert.rejects(
      () =>
        store.insertEvidence({
          id: randomUUID(),
          schemaVersion: CONTINUUM_SCHEMA_VERSION,
          sourceSystem: "studio-identified",
          sourceKind: "source-record",
          sourceRecordId: "rec-1",
          eventId: null,
          observationId: null,
          collectedAt: NOW,
          reportingPeriod: null,
          freshness: "fresh",
          reliability: "reliable",
          redactionStatus: "clean",
          summary: "Emailed ada@example.com",
          supportingPointer: "diamond_studio_identified_events:rec-1",
          idempotencyKey: "studio-record:rec-1",
          claimFingerprint: null,
        }),
      /PII rejected/,
    );
    await assert.rejects(
      () =>
        store.insertObservation({
          id: randomUUID(),
          schemaVersion: CONTINUUM_SCHEMA_VERSION,
          observationType: "studio.shape_share",
          subjectEntityId: null,
          statement: "Contact ada@example.com",
          value: { kind: "shape-share" },
          epistemicClass: "derived",
          confidence: 1,
          producedBy: "test",
          createdAt: NOW,
          validFrom: NOW,
          validUntil: null,
          supersedesId: null,
          materiality: "monitor",
          urgency: "low",
        }),
      /PII rejected/,
    );
  });

  it("keeps hashed identity values free of raw email and phone", () => {
    const email = "ada@example.com";
    const phone = "305-555-0100";
    const emailHash = hashEmail(email);
    const phoneHash = hashPhone(phone);
    assert.ok(emailHash);
    assert.ok(phoneHash);
    assert.notEqual(emailHash, email);
    assert.notEqual(phoneHash, phone);
    assert.equal(emailHash.includes("@"), false);
    assert.equal(emailHash.includes(email), false);
    assert.equal(phoneHash.includes(phone), false);
    assert.equal(phoneHash.includes("-"), false);
    assert.match(emailHash, /^[a-f0-9]{64}$/);
    assert.match(phoneHash, /^[a-f0-9]{64}$/);
    assert.equal(findPiiViolation({ identifier: emailHash }), null);
    assert.equal(findPiiViolation({ identifier: phoneHash }), null);
  });

  it("does not put raw workbook rows into generic Event payloads", async () => {
    const kernel = new InMemoryContinuumStore();
    const xlsx = buildSyntheticXlsx(
      emptyWorkbookSheets({
        people: [
          personCells({
            name: "Ada Lovelace",
            email: "ada@example.com",
            phone: "3055550100",
          }),
        ],
        projects: [
          projectCells({
            canonicalClient: "Ada Lovelace",
            match: "Exact",
            title: "Oval ring",
            cad: "CAD-1",
            notes: "Call Ada Lovelace",
          }),
        ],
      }),
    );
    const result = await dryRunReconciliationWorkbook(xlsx, {
      continuumStore: kernel,
    });
    assert.equal(result.mode, "dry-run");
    assert.equal(findPiiViolation(result), null);
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes("ada@example.com"), false);
    assert.equal(serialized.includes("Ada Lovelace"), false);
    assert.equal(serialized.includes("3055550100"), false);
    assert.equal(kernel.listEvents().length, 0);
    assert.equal(kernel.listEvidence().length, 0);
  });

  it("schema SQL stays unapplied, RLS-only, and free of hubspot_deal_id", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "lib/supabase/continuum-client-memory-schema.sql"),
      "utf8",
    );
    assert.match(sql, /UNAPPLIED DRAFT\. DO NOT APPLY TO PRODUCTION/);
    assert.match(sql, /continuum_person_profiles/);
    assert.match(sql, /continuum_relationships/);
    assert.match(sql, /continuum_person_facts/);
    assert.match(sql, /continuum_source_notes/);
    assert.match(sql, /continuum_wishes/);
    assert.match(sql, /continuum_project_profiles/);
    assert.match(sql, /continuum_identity_reviews/);
    assert.match(sql, /continuum_fact_evidence/);
    assert.match(sql, /continuum_wish_evidence/);
    assert.doesNotMatch(
      sql,
      /identity_kind in \([^)]*hubspot_deal_id/,
    );
    assert.match(sql, /Do not add hubspot_deal_id/);
    assert.doesNotMatch(sql, /create policy/i);
    assert.equal((sql.match(/enable row level security/g) ?? []).length, 9);
    assert.equal(validateIdentityKind("import_row_key").ok, true);
  });
});
