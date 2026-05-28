import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { normalizeCalibrationFields, normalizeReportNumber } from "./field-normalization";
import { emptyReportFields } from "./fields";
import {
  findCalibrationEntry,
  saveCalibrationEntry,
} from "./storage";
import { isCalibrationDatabaseAvailable } from "../supabase/calibration";
import type {
  CalibrationReportMetadata,
  FieldConfidence,
  ReportFieldKey,
} from "./types";
import { REPORT_FIELD_KEYS } from "./types";

test("normalizeReportNumber collapses spacing and case", () => {
  assert.equal(normalizeReportNumber(" lg 353466126 "), "LG353466126");
});

test("normalizeCalibrationFields strips units without inventing values", () => {
  const fields = emptyReportFields({
    tablePercent: "58%",
    crownAngle: "34.5°",
    pavilionAngle: "40.8 H",
  });
  const norm = normalizeCalibrationFields(fields);
  assert.equal(norm.tablePercent, "58");
  assert.equal(norm.crownAngle, "34.5");
  assert.equal(norm.pavilionAngle, "40.8");
  assert.equal(norm.lowerHalfPercent, "");
});

test("saveCalibrationEntry duplicate detection on filesystem", async (t) => {
  if (isCalibrationDatabaseAvailable()) {
    t.skip("filesystem duplicate test requires Supabase unset");
  }
  const dir = await mkdtemp(join(tmpdir(), "hourglass-cal-"));
  const prev = process.cwd();
  process.chdir(dir);

  try {
    const metadata: CalibrationReportMetadata = {
      lab: "GCAL",
      reportNumber: `RUNTIME-DUP-TEST-${Date.now()}`,
      reportSource: "pdf-upload",
      stoneType: "lab-grown",
    };
    const fields = emptyReportFields({ shape: "Round Brilliant", tablePercent: "58" });
    const confidence = Object.fromEntries(
      REPORT_FIELD_KEYS.map((k) => [
        k,
        fields[k].trim() ? ("high" as FieldConfidence) : ("missing" as FieldConfidence),
      ]),
    ) as Record<ReportFieldKey, FieldConfidence>;
    const snapshot = { fields, confidence, warnings: [] };

    const first = await saveCalibrationEntry({
      metadata,
      fields,
      confidence,
      extractionSnapshot: snapshot,
    });
    assert.equal(first.ok, true);

    const dup = await saveCalibrationEntry({
      metadata,
      fields,
      confidence: first.ok ? first.entry.confidence : ({} as never),
      extractionSnapshot: snapshot,
    });
    assert.equal(dup.ok, false);
    if (!dup.ok) assert.equal(dup.code, "duplicate");

    const found = await findCalibrationEntry(metadata);
    assert.ok(found);
    assert.equal(found.extractedFieldsRaw.shape, "Round Brilliant");
  } finally {
    process.chdir(prev);
    await rm(dir, { recursive: true, force: true });
  }
});
