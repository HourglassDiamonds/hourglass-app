import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGiaDiagramFieldsFromBands } from "@/lib/calibration-library/parsers/gia/gia-diagram-extraction";
import {
  LGDR2536297567_DEGRADED_FIRST_PASS_BANDS,
  LGDR2536297567_RETRY_REGION_TEXT,
  LGDR2536297567_RETRY_STACK_TEXT,
} from "@/lib/calibration-library/fixtures/lgdr2536297567-degraded-diagram-bands";
import {
  applyLgdrDiagramRetryFromBandText,
  isLgdrDiagramPartialFailurePattern,
} from "@/lib/calibration-library/parsers/gia/gia-lgdr-diagram-retry";
import { clientExtractionSufficient } from "@/lib/diamond-intelligence/client-extraction-sufficient";

function fieldMap(rows: ReturnType<typeof parseGiaDiagramFieldsFromBands>) {
  return Object.fromEntries(rows.map((r) => [r.field, r.parsedValue]));
}

describe("LGDR diagram OCR retry", () => {
  it("detects partial failure when table/crown/pavilion present but depth/girdle/culet missing", () => {
    const firstPass = parseGiaDiagramFieldsFromBands(
      LGDR2536297567_DEGRADED_FIRST_PASS_BANDS,
      "GIA_LGDR_DOSSIER",
    );
    assert.equal(isLgdrDiagramPartialFailurePattern(firstPass), true);
    const f = fieldMap(firstPass);
    assert.equal(f.tablePercent, "59%");
    assert.equal(f.crownAngle, "35.5°");
    assert.equal(f.pavilionAngle, "41°");
    assert.equal(f.depthPercent, null);
    assert.equal(f.girdle, null);
    assert.equal(f.culet, null);
  });

  it("recovers depth, girdle, and culet from retry band OCR without overwriting table/crown/pavilion", () => {
    const firstPass = parseGiaDiagramFieldsFromBands(
      LGDR2536297567_DEGRADED_FIRST_PASS_BANDS,
      "GIA_LGDR_DOSSIER",
    );
    const retry = applyLgdrDiagramRetryFromBandText({
      bands: LGDR2536297567_DEGRADED_FIRST_PASS_BANDS,
      fields: firstPass,
      retryTexts: {
        stack: LGDR2536297567_RETRY_STACK_TEXT,
        "lgdr-diagram-region": LGDR2536297567_RETRY_REGION_TEXT,
      },
    });

    assert.equal(retry.diagnostic.lgdrDiagramRetryAttempted, true);
    assert.deepEqual(retry.diagnostic.lgdrDiagramRetryRecoveredFields.sort(), [
      "culet",
      "depthPercent",
      "girdle",
    ]);
    assert.ok(retry.diagnostic.lgdrDiagramRetryBandSnippets.stack?.retry);
    assert.ok(
      retry.diagnostic.lgdrDiagramRetryBandSnippets.lgdrDiagramRegion?.retry,
    );

    const f = fieldMap(retry.fields);
    assert.equal(f.tablePercent, "59%");
    assert.equal(f.crownAngle, "35.5°");
    assert.equal(f.pavilionAngle, "41°");
    assert.equal(f.depthPercent, "61.5%");
    assert.match(f.girdle ?? "", /\bmedium\b/i);
    assert.equal(f.culet, "None");

    const fieldsRecord = {
      tablePercent: "59",
      depthPercent: "61.5",
      crownAngle: "35.5",
      pavilionAngle: "41",
      girdle: "medium",
      culet: "None",
      starLengthPercent: "50",
      lowerHalfPercent: "80",
      shape: "Round",
      carat: "1.01",
      measurements: "6.45-6.48 x 3.97",
      polish: "Excellent",
      symmetry: "Excellent",
      fluorescence: "None",
      cutGrade: "",
      color: "",
      clarity: "",
      reportNumber: "2536297567",
      lab: "GIA",
    };
    assert.equal(
      clientExtractionSufficient({ fields: fieldsRecord }),
      true,
    );
  });
});
