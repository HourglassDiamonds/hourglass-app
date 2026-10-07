import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { assessLegacyConciergePromotion, promoteLegacyConciergeLead, type LegacyConciergeEvidence } from "./promotion";

const strong: LegacyConciergeEvidence = {
  provenance: "legacy_hubspot_concierge",
  hubspotDealId: "351053742818",
  hubspotContactId: "contact-1",
  fullName: "Example Client",
  email: "example.client@example.test",
  gmailThreadId: "thread-legacy-concierge",
  firstEvidenceAt: "2026-09-29T15:18:13Z",
  latestEvidenceAt: "2026-10-07T17:07:29Z",
  inboundMessageCount: 14,
  outboundMessageCount: 19,
  identityEvidence: ["hubspot_contact_email", "repeated_gmail_participant"],
  explicitJewelryProject: true,
  projectTitle: "Example Client — Engagement Ring",
  cadJobNumber: "C026510",
  metal: "platinum",
  centerStone: "radiant",
  diamondSupplyNotes: "Stones ordered for in-person review.",
  progressSignals: ["cad_or_design", "stones_or_materials_ordered", "in_person_review", "scheduled_consultation", "active_current_communication"],
};

describe("legacy Concierge canonical promotion", () => {
  it("rejects ordinary email chatter without strong project progression", () => {
    const assessment = assessLegacyConciergePromotion({
      ...strong,
      hubspotContactId: null,
      identityEvidence: ["repeated_gmail_participant"],
      explicitJewelryProject: false,
      inboundMessageCount: 1,
      outboundMessageCount: 1,
      progressSignals: [],
    });
    assert.equal(assessment.qualified, false);
    assert.match(assessment.reasons.join(" "), /identity|project|two-way|progression/);
  });

  it("creates one canonical Person, Project, exact history, relationship, kind, and lifecycle", async () => {
    const store = new InMemoryClientMemoryStore();
    const result = await promoteLegacyConciergeLead(store, strong);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const person = await store.getPersonProfile(result.personId);
    const project = await store.getProjectProfile(result.projectId);
    const history = await store.getProjectHistory(result.projectId);
    assert.deepEqual(person?.roles, ["client"]);
    assert.equal(project?.sourceSystem, "hubspot");
    assert.equal(project?.projectKind, "custom_new_jewelry");
    assert.equal(history?.gmailThreadId, strong.gmailThreadId);
    assert.equal(history?.cadJobNumber, "C026510");
    assert.equal(history?.metal, "platinum");
    assert.equal(history?.centerStone, "radiant");
    assert.equal(await store.hasActiveClientProjectLink(result.personId, result.projectId), true);
    assert.equal((await store.getProjectLifecycleState(result.projectId, "custom_new_jewelry"))?.stage, "cad");
  });

  it("is convergent and idempotent on replay", async () => {
    const store = new InMemoryClientMemoryStore();
    const first = await promoteLegacyConciergeLead(store, strong);
    const second = await promoteLegacyConciergeLead(store, strong);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok && second.ok) {
      assert.equal(second.status, "already-present");
      assert.equal(second.personId, first.personId);
      assert.equal(second.projectId, first.projectId);
    }
    const counts = await store.inspectCounts();
    assert.equal(counts.persons, 1);
    assert.equal(counts.projects, 1);
    assert.equal(counts.relationships, 1);
  });
});
