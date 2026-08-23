import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composePersonProfile } from "./profile";
import { createInMemoryClientMemoryReader } from "./reader";
import {
  CLIENT_MEMORY_FINANCIAL_FIELD_NAMES,
  CLIENT_MEMORY_NOTE_LIMIT,
} from "./types";
import {
  emptyReadSnapshot,
  fact,
  note,
  personProfile,
  projectHistory,
  projectProfile,
  relationship,
  review,
  wish,
} from "./fixtures";

function collectKeys(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const child of value) collectKeys(child, found);
    return found;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      found.add(key);
      collectKeys(child, found);
    }
  }
  return found;
}

describe("Client Memory person profile composition", () => {
  it("composes identity, contact, and roles without merging", async () => {
    const person = personProfile({
      displayName: "Ada Lovelace",
      givenName: "Ada",
      familyName: "Lovelace",
      organizationName: "Analytical Engines",
      email: "ada@example.com",
      phone: "3055550100",
      streetAddress: "1 Test Street",
      roles: ["client", "prospect"],
    });
    const reader = createInMemoryClientMemoryReader({
      ...emptyReadSnapshot(),
      profiles: [person],
    });
    const result = await reader.getPersonProfile(person.personId);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.profile.person.displayName, "Ada Lovelace");
    assert.equal(result.profile.person.email, "ada@example.com");
    assert.deepEqual(result.profile.person.roles, ["client", "prospect"]);
    assert.equal(result.profile.facts.current.length, 0);
    assert.equal(result.profile.wishes.length, 0);
  });

  it("links client-project relationships and keeps history separate", async () => {
    const person = personProfile({ displayName: "Ada Lovelace" });
    const project = projectProfile({
      displayTitle: "Oval ring",
      importRowKey: "continuum-reconciliation-v3:ReconciledProjects:2",
    });
    const history = projectHistory({
      projectId: project.projectId,
      cadJobNumber: "CAD-77",
      metal: "yellow-gold",
    });
    const snapshot = {
      ...emptyReadSnapshot(),
      profiles: [person],
      relationships: [
        relationship({
          fromEntityId: person.personId,
          toEntityId: project.projectId,
        }),
      ],
      projectProfiles: [project],
      projectHistories: [history],
    };
    const composed = composePersonProfile(snapshot, person.personId);
    assert.equal(composed.ok, true);
    if (!composed.ok) return;
    assert.equal(composed.profile.relationships.length, 1);
    assert.equal(composed.profile.relationships[0]?.kind, "client-project");
    assert.equal(composed.profile.projects.length, 1);
    assert.equal(composed.profile.projects[0]?.profile.displayTitle, "Oval ring");
    assert.equal(composed.profile.projects[0]?.profile.visibility, "internal-only");
    assert.equal(composed.profile.projects[0]?.internalHistory?.cadJobNumber, "CAD-77");
    assert.equal(composed.profile.projects[0]?.internalHistory?.metal, "yellow-gold");
    assert.equal(
      "profile" in (composed.profile.projects[0] ?? {}),
      true,
    );
    assert.equal(
      "internalHistory" in (composed.profile.projects[0] ?? {}),
      true,
    );
    assert.equal("cost" in (composed.profile.projects[0]?.profile ?? {}), false);
    assert.equal("cost" in (composed.profile.projects[0]?.internalHistory ?? {}), false);
  });

  it("returns source notes newest first and respects the V1 limit", async () => {
    const person = personProfile({ displayName: "Ada Lovelace" });
    const notes = Array.from({ length: CLIENT_MEMORY_NOTE_LIMIT + 3 }, (_, i) =>
      note({
        personId: person.personId,
        createdAt: `2026-08-${String(10 + (i % 20)).padStart(2, "0")}T00:00:00.000Z`,
        text: `note-${i}`,
      }),
    );
    const composed = composePersonProfile(
      { ...emptyReadSnapshot(), profiles: [person], sourceNotes: notes },
      person.personId,
    );
    assert.equal(composed.ok, true);
    if (!composed.ok) return;
    assert.equal(composed.profile.sourceNotes.length, CLIENT_MEMORY_NOTE_LIMIT);
    const created = composed.profile.sourceNotes.map((row) => row.createdAt);
    const sorted = [...created].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    assert.deepEqual(created, sorted);
  });

  it("keeps only current facts in the truth section", async () => {
    const person = personProfile({ displayName: "Ada Lovelace" });
    const composed = composePersonProfile(
      {
        ...emptyReadSnapshot(),
        profiles: [person],
        facts: [
          fact({ personId: person.personId, factType: "ring-size", status: "current" }),
          fact({ personId: person.personId, factType: "metal", status: "candidate" }),
          fact({ personId: person.personId, factType: "stone", status: "conflicting" }),
          fact({ personId: person.personId, factType: "old", status: "superseded" }),
        ],
      },
      person.personId,
    );
    assert.equal(composed.ok, true);
    if (!composed.ok) return;
    assert.equal(composed.profile.facts.current.length, 1);
    assert.equal(composed.profile.facts.current[0]?.status, "current");
    assert.equal(composed.profile.facts.candidateCount, 1);
    assert.equal(composed.profile.facts.conflictingCount, 1);
    assert.equal(
      composed.profile.facts.current.some((row) => row.status !== "current"),
      false,
    );
  });

  it("returns active and considering wishes only", async () => {
    const person = personProfile({ displayName: "Ada Lovelace" });
    const composed = composePersonProfile(
      {
        ...emptyReadSnapshot(),
        profiles: [person],
        wishes: [
          wish({ personId: person.personId, description: "keep", status: "active" }),
          wish({ personId: person.personId, description: "maybe", status: "considering" }),
          wish({ personId: person.personId, description: "done", status: "fulfilled" }),
        ],
      },
      person.personId,
    );
    assert.equal(composed.ok, true);
    if (!composed.ok) return;
    assert.deepEqual(
      composed.profile.wishes.map((row) => row.status).sort(),
      ["active", "considering"],
    );
  });

  it("summarizes open reviews as a reason histogram", async () => {
    const person = personProfile({ displayName: "Ada Lovelace" });
    const importRowKey = "continuum-reconciliation-v3:People:2";
    const composed = composePersonProfile(
      {
        ...emptyReadSnapshot(),
        profiles: [person],
        identities: [
          {
            entityId: person.personId,
            identityKind: "import_row_key",
            identifier: importRowKey,
            revokedAt: null,
          },
        ],
        reviews: [
          review({ reasonCode: "REVIEW_MALFORMED_PHONE", importRowKey }),
          review({ reasonCode: "REVIEW_MALFORMED_PHONE", importRowKey: `${importRowKey}-b` }),
          review({
            reasonCode: "REVIEW_MALFORMED_EMAIL",
            importRowKey,
            status: "resolved",
          }),
          review({ reasonCode: "REVIEW_MALFORMED_EMAIL", leftPersonId: person.personId }),
        ],
      },
      person.personId,
    );
    assert.equal(composed.ok, true);
    if (!composed.ok) return;
    assert.equal(composed.profile.reviews.openCount, 2);
    assert.equal(composed.profile.reviews.reasonHistogram.REVIEW_MALFORMED_PHONE, 1);
    assert.equal(composed.profile.reviews.reasonHistogram.REVIEW_MALFORMED_EMAIL, 1);
    assert.equal(
      JSON.stringify(composed.profile.reviews).includes("issueText"),
      false,
    );
  });

  it("returns a clean not-found result for a missing Person", async () => {
    const result = composePersonProfile(emptyReadSnapshot(), "missing-person");
    assert.deepEqual(result, { ok: false, reason: "not-found" });
    const blank = composePersonProfile(emptyReadSnapshot(), "  ");
    assert.deepEqual(blank, { ok: false, reason: "not-found" });
  });

  it("does not include financial fields in the composed contract", async () => {
    const person = personProfile({ displayName: "Ada Lovelace" });
    const project = projectProfile({ displayTitle: "Oval ring" });
    const composed = composePersonProfile(
      {
        ...emptyReadSnapshot(),
        profiles: [person],
        relationships: [
          relationship({
            fromEntityId: person.personId,
            toEntityId: project.projectId,
          }),
        ],
        projectProfiles: [project],
        projectHistories: [projectHistory({ projectId: project.projectId })],
      },
      person.personId,
    );
    assert.equal(composed.ok, true);
    if (!composed.ok) return;
    const keys = [...collectKeys(composed.profile)].map((key) => key.toLowerCase());
    for (const field of CLIENT_MEMORY_FINANCIAL_FIELD_NAMES) {
      assert.equal(keys.includes(field), false, field);
    }
  });
});
