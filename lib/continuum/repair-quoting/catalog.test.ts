import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseXlsxWorkbook } from "@/lib/continuum/client-memory/xlsx";
import { GELLER_BLUE_BOOK } from "./contract";
import {
  gellerCatalogArtifact,
  lookupCatalogSku,
} from "./catalog";
import {
  parseGellerRepairSkuSheet,
  rejectionCounts,
} from "./parse-export";

const XLSX_CANDIDATES = [
  process.env.GELLER_REPAIR_SKU_XLSX,
  "C:/Users/justi/OneDrive/Desktop/RepairTaskSKUs.2026-08-26-17-29-10.xlsx",
  "C:/Users/justi/OneDrive/Desktop/RepairTaskSKUs.2026-08-26-17-29-10(1).xlsx",
].filter((path): path is string => Boolean(path));

describe("Geller source catalog", () => {
  const artifact = gellerCatalogArtifact();

  it("is a deterministic V5.0 R6.50 source artifact, not a live database catalog", () => {
    assert.equal(artifact.source.family, "geller_blue_book");
    assert.equal(artifact.source.version, GELLER_BLUE_BOOK.version);
    assert.equal(artifact.source.release, GELLER_BLUE_BOOK.release);
    assert.equal(artifact.source.editionLabel, GELLER_BLUE_BOOK.editionLabel);
    assert.equal(artifact.source.exportFile, "RepairTaskSKUs.2026-08-26-17-29-10.xlsx");
    assert.equal(artifact.source.sha256, "123ad012366d19729adbce62a5bb952008d3daa7af1bca58c388a07993b3e6bd");
    assert.equal(artifact.importedCount, 4553);
    assert.equal(artifact.rejectedCount, 526);
    assert.equal(artifact.rows.length, 4553);
    assert.deepEqual(artifact.rejectionCounts, {
      "missing-sku": 0,
      "missing-task-description": 498,
      "missing-source-amount": 26,
      "inactive-source-row": 0,
      "duplicate-sku": 0,
      "invalid-source-amount": 2,
    });
    assert.deepEqual(artifact.absentColumns, ["Express", "JLRC"]);
    const skus = artifact.rows.map((row) => row.sku);
    assert.deepEqual(skus, [...skus].sort());
    assert.equal(new Set(skus).size, skus.length);
  });

  it("preserves founder-verified SKU 1000 and 1008 source amounts", () => {
    const sku1000 = lookupCatalogSku("1000");
    const sku1008 = lookupCatalogSku("1008");
    assert.ok(sku1000);
    assert.ok(sku1008);
    assert.equal(sku1000.amounts.priceLaborCents, 6_000);
    assert.equal(sku1000.amounts.costLaborCents, 1_600);
    assert.equal(sku1000.amounts.costPartsCents, 0);
    assert.equal(sku1000.metalSemantics, "labor_only");
    assert.equal(sku1008.amounts.priceLaborCents, 7_900);
    assert.equal(sku1008.amounts.pricePartsCents, 3_300);
    assert.equal(sku1008.amounts.costLaborCents, 2_100);
    assert.equal(sku1008.amounts.costPartsCents, 1_100);
    assert.equal(sku1008.metalSemantics, "embedded_parts");
    assert.equal(lookupCatalogSku("missing-sku"), null);
  });

  it("re-parses the founder xlsx to the same counts when the file is present", () => {
    const path = XLSX_CANDIDATES.find((candidate) => existsSync(candidate));
    if (!path) return;
    const bytes = readFileSync(path);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    assert.equal(sha256, artifact.source.sha256);
    const sheet = parseXlsxWorkbook(new Uint8Array(bytes)).sheets[0];
    assert.ok(sheet);
    const parsed = parseGellerRepairSkuSheet(sheet, {
      exportFile: artifact.source.exportFile,
      sha256,
    });
    assert.equal(parsed.source.sourceRowCount, 5079);
    assert.equal(parsed.rows.length, 4553);
    assert.equal(parsed.rejected.length, 526);
    assert.deepEqual(rejectionCounts(parsed.rejected), artifact.rejectionCounts);
    assert.equal(parsed.rejected.filter((row) => row.reason === "duplicate-sku").length, 0);
    const invalid = parsed.rejected.filter((row) => row.reason === "invalid-source-amount");
    assert.deepEqual(
      invalid.map((row) => row.sku).sort(),
      ["1492", "1508"],
    );
  });
});
