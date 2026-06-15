import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFieldsFromReportText } from "@/lib/calibration-library/extract-from-text";
import {
  GCAL360796191_DIAGRAM_OCR_LIVE_GARBLED,
  GCAL360796191_FINISH_OCR,
  GCAL360796191_REPORT_NUMBER,
  GCAL360796191_TEXT_LAYER,
} from "@/lib/calibration-library/fixtures/gcal360796191";
import { shouldPresentScoredCoreRead } from "@/lib/diamond-intelligence/client-presentation-gates";
import { parseReportGradeHints } from "@/lib/diamond-intelligence/report-grade-hints";
import {
  isGcal8xReport,
  shouldUseV3IncompleteChapterLayout,
} from "@/app/diamond-intelligence/components/v3-presentation";
import { buildDecisionConfidence } from "@/lib/diamond-intelligence/decision-profile-confidence";
import { buildDiamondInterpretationContext } from "@/lib/diamond-intelligence/client-interpretation-context";
import { assessReportCapability } from "@/lib/diamond-intelligence/report-capability";
import { classifyClientInterpretation } from "@/lib/diamond-intelligence/client-interpretation-pipeline";

describe("GCAL Sarine LG360796191 scored-core presentation", () => {
  it("live garbled diagram OCR + finish reaches full tier and scored-core gates", () => {
    const text = `${GCAL360796191_TEXT_LAYER}\n${GCAL360796191_DIAGRAM_OCR_LIVE_GARBLED}\n${GCAL360796191_FINISH_OCR}`;
    const extracted = extractFieldsFromReportText(text, {
      lab: "GCAL",
      textMethod: "pdf-text",
      reportNumber: GCAL360796191_REPORT_NUMBER,
    });
    const hints = parseReportGradeHints(text);

    assert.equal(hints.color, "D");
    assert.equal(hints.clarity, "VVS1");
    assert.equal(extracted.fields.tablePercent, "57");
    assert.equal(extracted.fields.depthPercent, "61.2");
    assert.equal(extracted.fields.crownAngle, "34");
    assert.equal(extracted.fields.pavilionAngle, "40.8");
    assert.equal(extracted.fields.lowerHalfPercent, "77");

    const scoredCore = shouldPresentScoredCoreRead({
      fields: extracted.fields,
      gradeHints: hints,
    });
    assert.equal(scoredCore, true);

    const decision = classifyClientInterpretation({
      fields: extracted.fields,
      metadata: extracted.metadata,
      confidence: extracted.confidence,
    });
    assert.equal(decision.tier, "full");

    const ctx = buildDiamondInterpretationContext({
      fields: extracted.fields,
      rawScore: 95,
      clarity: hints.clarity,
    });
    const capability = assessReportCapability({
      fields: extracted.fields,
      confidence: extracted.confidence,
    });
    const confidence = buildDecisionConfidence({ context: ctx, capability });
    assert.equal(confidence.band, "High");

    const incomplete = shouldUseV3IncompleteChapterLayout({
      lowInterpretationConfidence: !scoredCore && confidence.band === "Low",
      hasDecisionProfile: true,
      clarityExcluded: false,
    });
    assert.equal(incomplete, false);

    assert.equal(
      isGcal8xReport(
        {
          lab: "GCAL",
          parserFamily: extracted.parserType,
          reportTextHint: text,
        },
        extracted.fields,
      ),
      true,
    );
  });
});
