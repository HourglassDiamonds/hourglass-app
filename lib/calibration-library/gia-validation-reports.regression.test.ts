import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import expectedValues from "../../data/light-performance-calibration/validation-reports/expected-values.json";
import { runCalibrationUploadExtraction } from "./extract-upload-pipeline";

const VALIDATION_DIR = join(
  process.cwd(),
  "data/light-performance-calibration/validation-reports",
);

type ProportionKey =
  | "tablePercent"
  | "depthPercent"
  | "crownAngle"
  | "pavilionAngle"
  | "lowerHalfPercent"
  | "starLengthPercent"
  | "girdle"
  | "culet";

const GIA_REPORTS = ["2496027047", "6233708773"] as const;

const NUMERIC_KEYS: ProportionKey[] = [
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "lowerHalfPercent",
  "starLengthPercent",
];

function compareNumeric(
  actual: string,
  expected: number,
): "PASS" | "NEAR" | "MISMATCH" {
  const n = parseFloat(actual);
  if (!Number.isFinite(n)) return "MISMATCH";
  const tol = expected % 1 === 0 && !String(expected).includes(".") ? 0.2 : 0.2;
  const angleTol = 0.15;
  const isAngle = expected >= 20 && expected <= 45;
  const delta = Math.abs(n - expected);
  if (delta === 0) return "PASS";
  if (delta <= (isAngle ? angleTol : tol)) return "NEAR";
  return "MISMATCH";
}

function compareText(actual: string, expected: string): "PASS" | "NEAR" | "MISMATCH" {
  const a = actual.toLowerCase().replace(/\s+/g, " ").trim();
  const e = expected.toLowerCase().replace(/\s+/g, " ").trim();
  if (a === e) return "PASS";
  if (a.includes(e) || e.includes(a)) return "NEAR";
  return "MISMATCH";
}

function fieldStatus(
  key: ProportionKey,
  actual: string,
  expected: Record<string, unknown>,
): "PASS" | "NEAR" | "MISMATCH" | "MISSING" {
  const exp = expected[key];
  if (exp === undefined || exp === null) return actual.trim() ? "PASS" : "MISSING";
  if (!actual.trim()) return "MISSING";
  if (typeof exp === "number") {
    const r = compareNumeric(actual, exp);
    return r;
  }
  if (typeof exp === "string") {
    return compareText(actual, exp);
  }
  return "MISMATCH";
}

async function extractReport(reportNumber: string, mode: "calibration" | "client") {
  const bytes = readFileSync(join(VALIDATION_DIR, `GIA-${reportNumber}.pdf`));
  return runCalibrationUploadExtraction({
    bytes,
    mime: "application/pdf",
    reportSource: "pdf-upload",
    reportNumber,
    lab: "GIA",
    mode: mode === "client" ? "client" : undefined,
    collectDiagnostics: true,
  });
}

describe("GIA validation anchor reports", () => {
  for (const reportNumber of GIA_REPORTS) {
    it(`calibration extraction recovers core proportions for ${reportNumber}`, async () => {
      const expected = expectedValues[reportNumber as keyof typeof expectedValues] as Record<
        string,
        unknown
      >;
      const result = await extractReport(reportNumber, "calibration");
      const coreKeys: ProportionKey[] = [
        "tablePercent",
        "depthPercent",
        "crownAngle",
        "pavilionAngle",
        "lowerHalfPercent",
        "girdle",
        "culet",
      ];
      if (expected.starLengthPercent !== undefined) {
        coreKeys.splice(5, 0, "starLengthPercent");
      }

      const statuses = coreKeys.map((k) => ({
        key: k,
        status: fieldStatus(k, result.fields[k], expected),
        actual: result.fields[k],
        expected: expected[k],
      }));

      const missing = statuses.filter((s) => s.status === "MISSING");
      const mismatches = statuses.filter((s) => s.status === "MISMATCH");

      assert.ok(
        missing.length <= 2,
        `${reportNumber} calibration missing too many fields: ${JSON.stringify(statuses)}`,
      );
      assert.ok(
        mismatches.length === 0,
        `${reportNumber} calibration mismatches: ${JSON.stringify(mismatches)}`,
      );
    });

    it(`client extraction propagates core proportions for ${reportNumber}`, async () => {
      const expected = expectedValues[reportNumber as keyof typeof expectedValues] as Record<
        string,
        unknown
      >;
      const result = await extractReport(reportNumber, "client");
      const coreKeys: ProportionKey[] = [
        "tablePercent",
        "depthPercent",
        "crownAngle",
        "pavilionAngle",
        "lowerHalfPercent",
        "girdle",
        "culet",
      ];
      if (expected.starLengthPercent !== undefined) {
        coreKeys.splice(5, 0, "starLengthPercent");
      }

      const statuses = coreKeys.map((k) => ({
        key: k,
        status: fieldStatus(k, result.fields[k], expected),
        actual: result.fields[k],
      }));

      const missing = statuses.filter((s) => s.status === "MISSING");
      assert.ok(
        missing.length <= 3,
        `${reportNumber} client missing too many fields: ${JSON.stringify(statuses)}`,
      );
    });
  }
});
