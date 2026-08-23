import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { applyReconciliationWorkbook } from "./apply";
import { AUDITED_RECONCILIATION_V3, fingerprintWorkbook } from "./artifact";
import { dryRunReconciliationWorkbook } from "./dry-run";
import { hashEmail, hashPhone } from "./hashes";
import { InMemoryClientMemoryStore } from "./store";
import { parseReconciliationWorkbook } from "./workbook";

const WORKBOOK = resolve(process.cwd(), AUDITED_RECONCILIATION_V3.relativePath);

describe("Client Memory frozen workbook activation simulation", () => {
  it("dry-runs and memory-applies the audited workbook without production mutation", async () => {
    if (!existsSync(WORKBOOK)) {
      return;
    }
    const buffer = new Uint8Array(readFileSync(WORKBOOK));
    assert.equal(fingerprintWorkbook(buffer), AUDITED_RECONCILIATION_V3.sha256);

    const dry = await dryRunReconciliationWorkbook(buffer);
    assert.equal(dry.mode, "dry-run");
    assert.equal(dry.factsWouldCreate, 0);
    assert.equal(dry.wishesWouldCreate, 0);
    assert.equal(dry.wouldCreatePersons, dry.manifest.personsEligible);
    assert.equal(dry.peopleNeedsReview, dry.manifest.personsNeedsReview);
    assert.equal(dry.projectsExactEligible, dry.manifest.projectsExactEligible);
    assert.equal(dry.reviewsWouldOpen, dry.manifest.reviewsWouldOpen);

    const parsed = parseReconciliationWorkbook(buffer);
    const emailHashes = new Set<string>();
    const phoneHashes = new Set<string>();
    for (const row of parsed.people) {
      if (row.classification !== "person-candidate") continue;
      const emailHash = hashEmail(row.email);
      const phoneHash = hashPhone(row.phone);
      if (emailHash) emailHashes.add(emailHash);
      if (phoneHash) phoneHashes.add(phoneHash);
    }

    const store = new InMemoryClientMemoryStore();
    const first = await applyReconciliationWorkbook(buffer, {
      apply: true,
      confirmProductionClientImport: true,
      envEnabled: true,
      target: "memory",
      store,
      expectedFingerprint: AUDITED_RECONCILIATION_V3.sha256,
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.personsCreated, dry.wouldCreatePersons);
    assert.equal(first.personsMatched, dry.wouldMatchPersons);
    assert.equal(first.projectsExactLinked, dry.projectsExactEligible);
    assert.equal(first.reviewsOpened, dry.reviewsWouldOpen);
    assert.equal(first.sourceNotesInserted, dry.manifest.sourceNotesWouldCreate);
    assert.equal(first.factsCreated, 0);
    assert.equal(first.wishesCreated, 0);
    assert.equal(first.manifest.factsWouldCreate, 0);
    assert.equal(first.manifest.wishesWouldCreate, 0);
    assert.ok(store.listSourceNotes().length > 0);
    assert.ok(
      store.listSourceNotes().every((row) => row.contextLayer === "client"),
    );

    const counts = await store.inspectCounts();
    assert.equal(counts.persons, first.personsCreated);
    assert.equal(counts.facts, 0);
    assert.equal(counts.wishes, 0);
    assert.equal(counts.identitiesByKind.import_row_key, dry.personsEligible);
    assert.equal(counts.identitiesByKind.email_hash ?? 0, emailHashes.size);
    assert.equal(counts.identitiesByKind.phone_hash ?? 0, phoneHashes.size);
    assert.equal(
      counts.identities,
      (counts.identitiesByKind.import_row_key ?? 0) +
        (counts.identitiesByKind.email_hash ?? 0) +
        (counts.identitiesByKind.phone_hash ?? 0),
    );
    assert.equal(counts.reviews, first.reviewsOpened);

    const second = await applyReconciliationWorkbook(buffer, {
      apply: true,
      confirmProductionClientImport: true,
      envEnabled: true,
      target: "memory",
      store,
      expectedFingerprint: AUDITED_RECONCILIATION_V3.sha256,
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.personsCreated, 0);
    assert.equal(second.projectsCreated, 0);
    assert.equal(second.reviewsOpened, 0);
    assert.equal(second.sourceNotesInserted, 0);
    assert.equal(second.projectPersonLinks, 0);

    const again = await store.inspectCounts();
    assert.equal(again.persons, counts.persons);
    assert.equal(again.profiles, counts.profiles);
    assert.equal(again.identities, counts.identities);
    assert.equal(again.notes, counts.notes);
    assert.equal(again.reviews, counts.reviews);
    assert.equal(again.relationships, counts.relationships);
    assert.equal(again.projects, counts.projects);
    assert.equal(again.facts, 0);
    assert.equal(again.wishes, 0);

    console.log(
      JSON.stringify({
        workbookSimulation: "memory-only",
        dryRun: {
          peopleRows: dry.peopleRowsScanned,
          personCandidates: dry.personCandidates,
          personsEligible: dry.personsEligible,
          peopleNeedsReview: dry.peopleNeedsReview,
          identityWarnings: dry.identityWarnings,
          identityConflicts: dry.identityConflicts,
          projectsExactEligible: dry.projectsExactEligible,
          projectsReviewLink: dry.projectsReviewLink,
          projectsUnresolved: dry.projectsUnresolved,
          reviewsWouldOpen: dry.reviewsWouldOpen,
          sourceNotesWouldCreate: dry.manifest.sourceNotesWouldCreate,
          relationshipsWouldCreate: dry.manifest.relationshipsWouldCreate,
          projectsWouldCreate: dry.manifest.projectsWouldCreate,
          factsWouldCreate: dry.factsWouldCreate,
          wishesWouldCreate: dry.wishesWouldCreate,
        },
        firstApply: {
          persons: counts.persons,
          profiles: counts.profiles,
          identities: counts.identities,
          identitiesByKind: counts.identitiesByKind,
          projects: counts.projects,
          histories: counts.histories,
          relationships: counts.relationships,
          notes: counts.notes,
          reviews: counts.reviews,
          facts: counts.facts,
          wishes: counts.wishes,
          personsCreated: first.personsCreated,
          projectsExactLinked: first.projectsExactLinked,
          reviewsOpened: first.reviewsOpened,
        },
        secondApply: {
          personsCreated: second.personsCreated,
          projectsCreated: second.projectsCreated,
          reviewsOpened: second.reviewsOpened,
          sourceNotesInserted: second.sourceNotesInserted,
          projectPersonLinks: second.projectPersonLinks,
        },
      }),
    );
  });
});
