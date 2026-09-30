import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { HubSpotIntakeOutcome, WebsiteInquiry, WebsiteIntakeCommand, WebsiteIntakeResult, WebsiteIntakeStore } from "./types";
import { ingestWebsiteInquiry } from "./ingest";
import {
  decideWebsiteIntakeHubSpotAction,
  websiteIntakeHubSpotCorrelationLine,
} from "./hubspot-replay";
import { classifyWebsiteInquiry, validateWebsiteInquiryFormData } from "./validation";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const migration = readFileSync(join(root, "supabase", "migrations", "20260930020000_website_inquiry_intake.sql"), "utf8");
const route = readFileSync(join(root, "app", "api", "concierge", "route.ts"), "utf8");

function inquiry(extra: Partial<WebsiteInquiry> = {}): WebsiteInquiry {
  return {
    submissionId: "11111111-1111-4111-8111-111111111111",
    fullName: "Alex Example",
    email: "alex@example.com",
    phone: "2125550100",
    preferredContactMethod: "email",
    projectType: "Engagement Ring",
    shapeInterest: "Oval",
    designDirection: "Quiet Elegance",
    ringPresence: "Balanced",
    timeline: "Flexible",
    budgetRange: "Prefer to Discuss",
    inspirationNotes: "A private, bounded note.",
    category: "engagement_ring",
    attribution: { utm_source: "organic" },
    source: "hourglassdiamonds.com/concierge",
    acknowledgementExpected: false,
    synthetic: false,
    ...extra,
  };
}

function form(extra: Record<string, string> = {}): FormData {
  const values = {
    submissionId: "11111111-1111-4111-8111-111111111111",
    fullName: "Alex Example",
    email: "alex@example.com",
    phone: "",
    preferredContactMethod: "email",
    projectType: "Engagement Ring",
    shapeInterest: "Oval",
    designDirection: "Quiet Elegance",
    ringPresence: "Balanced",
    timeline: "Flexible",
    budgetRange: "Prefer to Discuss",
    inspirationNotes: "Hello",
    ...extra,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

class MemoryStore implements WebsiteIntakeStore {
  readonly people = new Set<string>();
  readonly jobs = new Map<string, WebsiteIntakeCommand>();
  readonly history: Array<{ mutationId: string; sourceRef: string }> = [];
  readonly intakes = new Map<string, { payloadHash: string; result: Extract<WebsiteIntakeResult, { ok: true }> }>();
  readonly identities = new Map<string, Set<string>>();

  seedIdentity(hash: string, personId: string) {
    this.people.add(personId);
    const ids = this.identities.get(hash) ?? new Set<string>();
    ids.add(personId);
    this.identities.set(hash, ids);
  }

  async ingest(command: WebsiteIntakeCommand): Promise<WebsiteIntakeResult> {
    const prior = this.intakes.get(command.idempotencyKeyHash);
    if (prior) {
      if (prior.payloadHash !== command.payloadHash) return { ok: false, reason: "idempotency-conflict" };
      return { ...prior.result, status: "already-present" };
    }
    if (command.synthetic) {
      const result = {
        ok: true as const, status: "created" as const, intakeId: command.intakeId,
        identityStatus: "synthetic" as const, personId: null, jobId: null,
        hubspotStatus: "skipped" as const,
      };
      this.intakes.set(command.idempotencyKeyHash, { payloadHash: command.payloadHash, result });
      return result;
    }
    const matches = new Set<string>();
    for (const hash of [command.emailHash, command.phoneHash]) {
      if (!hash) continue;
      for (const id of this.identities.get(hash) ?? []) matches.add(id);
    }
    let identityStatus: "matched" | "new" | "needs_review";
    let personId: string | null;
    if (matches.size > 1) {
      identityStatus = "needs_review";
      personId = null;
    } else if (matches.size === 1) {
      identityStatus = "matched";
      personId = [...matches][0]!;
    } else {
      identityStatus = "new";
      personId = command.personId;
      this.seedIdentity(command.emailHash, personId);
      if (command.phoneHash) this.seedIdentity(command.phoneHash, personId);
    }
    this.jobs.set(command.jobId, command);
    this.history.push({ mutationId: command.jobMutationId, sourceRef: `website-intake:${command.intakeId}` });
    const result = {
      ok: true as const, status: "created" as const, intakeId: command.intakeId,
      identityStatus, personId, jobId: command.jobId, hubspotStatus: "pending" as const,
    };
    this.intakes.set(command.idempotencyKeyHash, { payloadHash: command.payloadHash, result });
    return result;
  }

  async recordHubSpotOutcome(outcome: HubSpotIntakeOutcome): Promise<void> {
    for (const row of this.intakes.values()) {
      if (row.result.intakeId === outcome.intakeId) row.result.hubspotStatus = outcome.status;
    }
  }
}

describe("website inquiry validation and classification", () => {
  it("accepts the current public form shape and maps its real categories", () => {
    assert.equal(validateWebsiteInquiryFormData(form()).ok, true);
    const opaque = validateWebsiteInquiryFormData(form({ submissionId: "c-1727700000000-a1b2c3d4" }));
    assert.equal(opaque.ok, true);
    if (opaque.ok) assert.equal(opaque.value.submissionId, "c-1727700000000-a1b2c3d4");
    assert.equal(classifyWebsiteInquiry("Engagement Ring"), "engagement_ring");
    assert.equal(classifyWebsiteInquiry("Custom Jewelry"), "custom_design");
    assert.equal(classifyWebsiteInquiry("Wedding Band"), "wedding_bands");
    assert.equal(classifyWebsiteInquiry("Still Exploring"), "other");
  });

  it("rejects malformed, hostile, oversized, and invented selection input", () => {
    assert.equal(validateWebsiteInquiryFormData(form({ email: "not-an-email" })).ok, false);
    assert.equal(validateWebsiteInquiryFormData(form({ fullName: "x".repeat(121) })).ok, false);
    assert.equal(validateWebsiteInquiryFormData(form({ inspirationNotes: `ok\0bad` })).ok, false);
    assert.equal(validateWebsiteInquiryFormData(form({ projectType: "client-controlled-admin" })).ok, false);
  });
});

describe("website inquiry persistence", () => {
  it("creates a new prospect and a projectless founder Job with provenance/history", async () => {
    const store = new MemoryStore();
    const result = await ingestWebsiteInquiry(store, inquiry());
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.equal(result.identityStatus, "new");
    assert.ok(result.personId && store.people.has(result.personId));
    assert.ok(result.jobId && store.jobs.has(result.jobId));
    assert.equal(store.jobs.get(result.jobId!)?.category, "engagement_ring");
    assert.match(store.history[0]!.sourceRef, /^website-intake:/);
  });

  it("safe-matches one exact existing Person without minting another", async () => {
    const store = new MemoryStore();
    const first = await ingestWebsiteInquiry(store, inquiry());
    assert.ok(first.ok && first.personId);
    const peopleBefore = store.people.size;
    const second = await ingestWebsiteInquiry(store, inquiry({ submissionId: "22222222-2222-4222-8222-222222222222" }));
    assert.ok(second.ok);
    if (!second.ok) return;
    assert.equal(second.identityStatus, "matched");
    assert.equal(second.personId, first.ok ? first.personId : null);
    assert.equal(store.people.size, peopleBefore);
  });

  it("preserves an ambiguous inquiry as needs-review without attaching a Person", async () => {
    const store = new MemoryStore();
    await ingestWebsiteInquiry(store, inquiry({ phone: "" }));
    const emailHash = [...store.identities.keys()][0]!;
    store.seedIdentity(emailHash, "33333333-3333-4333-8333-333333333333");
    const result = await ingestWebsiteInquiry(store, inquiry({
      submissionId: "44444444-4444-4444-8444-444444444444", phone: "",
    }));
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.equal(result.identityStatus, "needs_review");
    assert.equal(result.personId, null);
    assert.ok(result.jobId);
  });

  it("deduplicates exact replays and rejects reuse with a different payload", async () => {
    const store = new MemoryStore();
    const first = await ingestWebsiteInquiry(store, inquiry());
    const replay = await ingestWebsiteInquiry(store, inquiry());
    assert.ok(first.ok && replay.ok);
    if (!first.ok || !replay.ok) return;
    assert.equal(replay.status, "already-present");
    assert.equal(replay.jobId, first.jobId);
    assert.equal(store.jobs.size, 1);
    const conflict = await ingestWebsiteInquiry(store, inquiry({ inspirationNotes: "changed replay" }));
    assert.deepEqual(conflict, { ok: false, reason: "idempotency-conflict" });
  });

  it("persists HubSpot state so replays can skip duplicate CRM work", async () => {
    const store = new MemoryStore();
    const first = await ingestWebsiteInquiry(store, inquiry());
    assert.ok(first.ok);
    if (!first.ok) return;
    await store.recordHubSpotOutcome({ intakeId: first.intakeId, status: "succeeded", contactId: "c1", dealId: "d1" });
    const replay = await ingestWebsiteInquiry(store, inquiry());
    assert.ok(replay.ok);
    if (!replay.ok) return;
    assert.equal(replay.hubspotStatus, "succeeded");
    assert.equal(store.jobs.size, 1);
  });

  it("isolates synthetic health checks from People and Jobs", async () => {
    const store = new MemoryStore();
    const result = await ingestWebsiteInquiry(store, inquiry({
      submissionId: "55555555-5555-4555-8555-555555555555",
      email: "continuum-health@healthcheck.invalid", synthetic: true,
    }));
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.equal(result.identityStatus, "synthetic");
    assert.equal(result.personId, null);
    assert.equal(result.jobId, null);
    assert.equal(store.people.size, 0);
    assert.equal(store.jobs.size, 0);
  });
});

describe("website inquiry HubSpot replay boundary", () => {
  it("delivers only a newly-created intake and fails closed on uncertain replays", () => {
    const base = {
      ok: true as const,
      intakeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      identityStatus: "new" as const,
      personId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      jobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    };
    assert.equal(decideWebsiteIntakeHubSpotAction({
      ...base, status: "created", hubspotStatus: "pending",
    }), "deliver");
    assert.equal(decideWebsiteIntakeHubSpotAction({
      ...base, status: "already-present", hubspotStatus: "pending",
    }), "recovery_required");
    assert.equal(decideWebsiteIntakeHubSpotAction({
      ...base, status: "already-present", hubspotStatus: "failed",
    }), "recovery_required");
    assert.equal(decideWebsiteIntakeHubSpotAction({
      ...base, status: "already-present", hubspotStatus: "succeeded",
    }), "skip_succeeded");
    assert.equal(
      websiteIntakeHubSpotCorrelationLine(base.intakeId),
      `Continuum Intake ID: ${base.intakeId}`,
    );
  });

  it("keeps acknowledgement evidence independent from HubSpot outcome", () => {
    const migrationStart = migration.indexOf("create or replace function public.continuum_record_website_intake_hubspot");
    const migrationEnd = migration.indexOf("commit;", migrationStart);
    const hubspotOutcomeFunction = migration.slice(migrationStart, migrationEnd);
    assert.doesNotMatch(hubspotOutcomeFunction, /acknowledgement_state\s*=/i);
    assert.match(route, /acknowledgementExpected: false/);
    assert.doesNotMatch(route, /acknowledgement(?:State|_state).*sent/i);
  });
});

describe("website intake security boundary", () => {
  it("keeps the ledger and RPC service-role-only with RLS and atomic Job history", () => {
    assert.match(migration, /enable row level security/i);
    assert.match(migration, /revoke all[\s\S]+from public, anon, authenticated/i);
    assert.match(migration, /grant execute[\s\S]+to service_role/i);
    assert.match(migration, /security invoker/i);
    assert.match(migration, /continuum_write_project_job/);
    assert.match(migration, /synthetic_isolation_check/);
  });

  it("accepts no client-controlled Person, Job, Project, role, or acknowledgement authority", () => {
    assert.doesNotMatch(route, /formData\.get\(["'](?:personId|jobId|projectId|role|acknowledgementState)["']\)/);
    assert.match(route, /source: "hourglassdiamonds\.com\/concierge"/);
    assert.match(route, /acknowledgementExpected: false/);
  });
});
