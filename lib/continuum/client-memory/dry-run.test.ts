import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { findPiiViolation } from "../contracts/validation";
import { dryRunReconciliationWorkbook } from "./dry-run";
import { hashEmail, peopleImportRowKey } from "./hashes";
import {
  InMemoryClientMemoryStore,
  newExternalIdentity,
} from "./store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "./types";
import {
  buildSyntheticXlsx,
  emptyWorkbookSheets,
  personCells,
  projectCells,
} from "./synthetic-xlsx";

const NOW = "2026-08-22T00:00:00.000Z";

describe("Client Memory dry-run importer", () => {
  it("counts Exact local joins, Likely review, and unmatched projects without creating persons", async () => {
    const xlsx = buildSyntheticXlsx(
      emptyWorkbookSheets({
        people: [
          personCells({
            name: "Ada Lovelace",
            email: "ada@example.com",
            phone: "3055550100",
          }),
          personCells({ name: "Alan Turing", email: "alan@example.com" }),
          personCells({ name: "Madonna" }),
          personCells({
            name: "Grace Hopper",
            companyName: "Grace Hopper",
            email: "grace@example.com",
          }),
        ],
        projects: [
          projectCells({
            canonicalClient: "Ada Lovelace",
            match: "Exact",
            title: "Ada ring",
            cad: "CAD-1",
            finger: "6",
            metal: "platinum",
            stone: "oval 2ct",
            supply: "memo stone",
            notes: "nice",
            thread: "thread-1",
          }),
          projectCells({
            canonicalClient: "Unknown Person",
            match: "Likely",
            title: "Likely ring",
            cad: "CAD-2",
            confidence: "YES",
            reviewFlag: "Follow up with unknown person next week",
          }),
          projectCells({
            canonicalClient: "Ghost Client",
            match: "No exact client DB match",
            title: "Ghost",
            cad: "CAD-3",
          }),
          projectCells({
            canonicalClient: "Ambiguous Name",
            match: "Ambiguous",
            title: "Ambiguous",
            cad: "CAD-4",
          }),
        ],
        cad: [
          [
            "Ada Lovelace",
            "Ada ring",
            "CAD-1",
            "SO-1",
            "file://cad/ada.3dm",
            "3dm",
            "ready",
            "thread-1",
            "gmail",
          ],
          [
            "Ghost Client",
            "Ghost",
            "CAD-9",
            "",
            "file://cad/ghost.3dm",
            "3dm",
            "missing",
            "",
            "gmail",
          ],
        ],
        sales: [
          [
            44900,
            "Invoice",
            "1001",
            "Ada Lovelace",
            "ring",
            2000,
            "closed",
            "FL",
            "sale",
            0.07,
            0,
            140,
            1860,
            "exact",
          ],
          [
            44901,
            "Invoice",
            "1002",
            "Nobody",
            "unknown",
            10,
            "open",
            "FL",
            "sale",
            0,
            0,
            0,
            10,
            "unmatched",
          ],
        ],
        review: [
          ["high", "review-id", "CAD-2", "Likely match", "manual review", "low"],
        ],
        vlora: [
          ["Vendor Desk", "vendor@example.com", "vendor", "CAD", "skip"],
        ],
      }),
    );

    const result = await dryRunReconciliationWorkbook(xlsx);
    assert.equal(result.peopleRowsScanned, 4);
    assert.equal(result.personCandidates, 3);
    assert.equal(result.peopleNeedsReview, 1);
    assert.equal(result.organizationCandidates, 0);
    assert.equal(result.wouldCreatePersons, 3);
    assert.equal(result.wouldMatchPersons, 0);
    assert.equal(result.projectsExactEligible, 1);
    assert.equal(result.projectPersonExactLinks, 1);
    assert.equal(result.projectsReviewLink, 2);
    assert.equal(result.projectsUnresolved, 1);
    assert.equal(result.fingerSizeCandidates, 1);
    assert.equal(result.metalCandidates, 1);
    assert.equal(result.centerStoneCandidates, 1);
    assert.equal(result.supplyNoteCandidates, 1);
    assert.equal(result.relationshipCandidates, 0);
    assert.equal(result.wishCandidates, 0);
    assert.equal(result.vendorRowsSkipped, 1);
    assert.equal(result.cadPointersDiscovered, 2);
    assert.equal(result.cadLinkedNames, 1);
    assert.equal(result.cadUnresolvedNames, 1);
    assert.equal(result.salesRowsDiscovered, 2);
    assert.equal(result.salesExactNameLinks, 1);
    assert.equal(result.salesAnomalyCount, 1);
    assert.equal(result.reviewRowsDiscovered, 1);
    assert.ok(result.malformedCellWarnings >= 2);
    assert.ok(
      result.workbookDriftWarnings.includes(
        "rules-and-summary-ignored-as-authoritative-count",
      ),
    );
    assert.equal(findPiiViolation(result), null);
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes("ada@example.com"), false);
    assert.equal(serialized.includes("vendor@example.com"), false);
    assert.equal(serialized.includes("Ada Lovelace"), false);
  });

  it("matches an existing store person by email and keeps import_row_key idempotent", async () => {
    const store = new InMemoryClientMemoryStore();
    const person = await store.insertEntity({
      kind: "person",
      createdAt: NOW,
      createdBy: "test",
    });
    await store.insertExternalIdentity(
      newExternalIdentity({
        entityId: person.record.id,
        sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
        identityKind: "email_hash",
        identifier: hashEmail("ada@example.com")!,
        createdAt: NOW,
      }),
    );
    await store.insertExternalIdentity(
      newExternalIdentity({
        entityId: person.record.id,
        sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
        identityKind: "import_row_key",
        identifier: peopleImportRowKey(2),
        createdAt: NOW,
      }),
    );
    const xlsx = buildSyntheticXlsx(
      emptyWorkbookSheets({
        people: [
          personCells({ name: "Ada Lovelace", email: "ada@example.com" }),
        ],
      }),
    );
    const result = await dryRunReconciliationWorkbook(xlsx, { store });
    assert.equal(result.wouldCreatePersons, 0);
    assert.equal(result.wouldMatchPersons, 1);
  });

  it("fails closed when --apply is passed without confirmation gates", () => {
    const { writeFileSync, unlinkSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const { tmpdir } = require("node:os") as typeof import("node:os");
    const workbook = join(tmpdir(), "continuum-client-memory-apply-gate.xlsx");
    writeFileSync(
      workbook,
      buildSyntheticXlsx(
        emptyWorkbookSheets({
          people: [
            personCells({ name: "Ada Lovelace", email: "ada@example.com" }),
          ],
        }),
      ),
    );
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    const ran = spawnSync(
      npx,
      [
        "tsx",
        "scripts/continuum-client-memory-import.ts",
        `--workbook=${workbook}`,
        "--apply",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        shell: true,
        env: { ...process.env, CONTINUUM_CLIENT_MEMORY_IMPORT_ENABLED: "" },
      },
    );
    try {
      unlinkSync(workbook);
    } catch {
      /* ignore */
    }
    assert.notEqual(ran.status, 0);
    assert.match(
      `${ran.stdout}\n${ran.stderr}`,
      /APPLY_REQUIRES_CONFIRMATION/,
    );
  });
});
