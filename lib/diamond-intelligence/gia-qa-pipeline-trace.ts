import type { CalibrationReportFields, ReportFieldKey } from "@/lib/calibration-library/types";
import { extractFieldsFromReportText } from "@/lib/calibration-library/extract-from-text";
import { assessExtractionCompleteness } from "./extraction-completeness";
import {
  resolveClientGuidedCompletionFields,
  shouldPresentScoredCoreRead,
} from "./client-presentation-gates";
import { assessReportCapability } from "./report-capability";
import { classifyFinalized } from "./client-interpretation-pipeline";
import { clientExtractionSufficient } from "./client-extraction-sufficient";
import { toClientSafeInterpretationPayload } from "./client-api";
import { parseReportGradeHints, buildReportGradeHintSource } from "./report-grade-hints";
import type { FinalizedCalibrationExtraction } from "@/lib/calibration-library/finalize-calibration-extraction";

/** Temporary QA trace — gated by report number or DI_GIA_QA_TRACE=1 */
export const GIA_QA_TRACE_REPORTS = new Set(["7438591452", "2524422799"]);

const TRACE_FIELDS_7438591452: ReportFieldKey[] = [
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "girdle",
];

const TRACE_FIELDS_2524422799: ReportFieldKey[] = [
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "girdle",
  "culet",
];

export function isGiaQaTraceEnabled(_reportNumber?: string | null): boolean {
  return process.env.DI_GIA_QA_TRACE === "1";
}

export function giaQaTraceFieldsForReport(
  reportNumber?: string | null,
): ReportFieldKey[] {
  const rn = reportNumber?.trim() ?? "";
  if (rn === "2524422799") return TRACE_FIELDS_2524422799;
  return TRACE_FIELDS_7438591452;
}

export type GiaQaTraceStage =
  | "rawOcrPreview"
  | "textParse"
  | "afterRegionOcr"
  | "finalizedFields"
  | "apiExtractedFields"
  | "apiInterpretationFields"
  | "capability"
  | "scoreEligible"
  | "scoredCorePresentation"
  | "guidedCompletion"
  | "classifyTier";

export type GiaQaFieldSnapshot = Partial<Record<ReportFieldKey, string>>;

export type GiaQaTraceEntry = {
  stage: GiaQaTraceStage;
  reportNumber: string;
  fields: GiaQaFieldSnapshot;
  meta?: Record<string, unknown>;
};

function pickFields(
  fields: Partial<CalibrationReportFields> | null | undefined,
  keys: ReportFieldKey[],
): GiaQaFieldSnapshot {
  const out: GiaQaFieldSnapshot = {};
  for (const key of keys) {
    const v = fields?.[key]?.trim() ?? "";
    out[key] = v || "(empty)";
  }
  return out;
}

export function logGiaQaTrace(entry: GiaQaTraceEntry): void {
  if (!isGiaQaTraceEnabled(entry.reportNumber)) return;
  console.log("[GIA QA TRACE]", {
    stage: entry.stage,
    populatedFieldKeys: Object.entries(entry.fields)
      .filter(([, v]) => Boolean(v) && v !== "(empty)")
      .map(([k]) => k),
    metaKeys: entry.meta ? Object.keys(entry.meta) : [],
  });
}

export function traceFieldsFromRecord(
  stage: GiaQaTraceStage,
  reportNumber: string,
  fields: Partial<CalibrationReportFields> | null | undefined,
  meta?: Record<string, unknown>,
): void {
  if (!isGiaQaTraceEnabled(reportNumber)) return;
  logGiaQaTrace({
    stage,
    reportNumber,
    fields: pickFields(fields, giaQaTraceFieldsForReport(reportNumber)),
    meta,
  });
}

export function traceRawOcrPreview(
  reportNumber: string,
  rawText: string,
  meta?: Record<string, unknown>,
): void {
  if (!isGiaQaTraceEnabled(reportNumber)) return;
  const keys = giaQaTraceFieldsForReport(reportNumber);
  const hitKeys: string[] = [];
  for (const key of keys) {
    const patterns: Record<string, RegExp[]> = {
      tablePercent: [/\btable\b[^\d]{0,20}(\d{2}(?:\.\d+)?)/i, /\b(\d{2})\s*%[^\n]{0,30}table/i],
      depthPercent: [/\bdepth\b[^\d]{0,20}(\d{2}(?:\.\d+)?)/i],
      crownAngle: [/\bcrown\b[^\d]{0,20}(\d{2}(?:\.\d+)?)/i],
      pavilionAngle: [/\bpavilion\b[^\d]{0,20}(\d{2}(?:\.\d+)?)/i],
      girdle: [/\bgirdle\b/i],
      culet: [/\bculet\b/i],
    };
    for (const re of patterns[key] ?? []) {
      if (re.test(rawText)) {
        hitKeys.push(key);
        break;
      }
    }
  }
  logGiaQaTrace({
    stage: "rawOcrPreview",
    reportNumber,
    fields: Object.fromEntries(hitKeys.map((k) => [k, "detected"])),
    meta: {
      rawTextLength: rawText.length,
      ...meta,
    },
  });
}

export function traceTextParseStage(
  reportNumber: string,
  combinedText: string,
  meta?: Record<string, unknown>,
): ReturnType<typeof extractFieldsFromReportText> {
  const parsed = extractFieldsFromReportText(combinedText, {
    lab: "GIA",
    reportNumber,
    textMethod: "ocr",
  });
  traceFieldsFromRecord("textParse", reportNumber, parsed.fields, {
    parserType: parsed.parserType,
    clientExtractionSufficient: clientExtractionSufficient({
      fields: parsed.fields,
      confidence: parsed.confidence,
    }),
    supportsLevel: assessReportCapability({ fields: parsed.fields }).supportsLevel,
    ...meta,
  });
  return parsed;
}

export function traceClientPayloadStages(
  finalized: FinalizedCalibrationExtraction & {
    timedOut?: boolean;
    pipelineError?: string;
  },
  opts?: { partial?: boolean },
): void {
  const reportNumber = finalized.metadata.reportNumber?.trim() ?? "";
  if (!isGiaQaTraceEnabled(reportNumber)) return;

  traceFieldsFromRecord("finalizedFields", reportNumber, finalized.fields, {
    parserType: finalized.parserType,
    timedOut: finalized.timedOut,
    pipelineError: finalized.pipelineError,
  });

  const gradeHintSource = buildReportGradeHintSource({
    reportGradeHintText: finalized.reportGradeHintText,
    rawTextSnippet: finalized.rawTextSnippet?.trim(),
    warnings: finalized.warnings,
  });
  const gradeHints = parseReportGradeHints(gradeHintSource ?? "");

  const decision = classifyFinalized(finalized);
  const completeness = assessExtractionCompleteness({ fields: finalized.fields });
  const scoredCore = shouldPresentScoredCoreRead({
    fields: finalized.fields,
    gradeHints,
  });

  const capability = assessReportCapability({ fields: finalized.fields });
  const guided = resolveClientGuidedCompletionFields({
    fields: finalized.fields,
    gradeHints,
    guidedCompletionFields: capability.guidedCompletionFields,
  });

  logGiaQaTrace({
    stage: "classifyTier",
    reportNumber,
    fields: pickFields(finalized.fields, giaQaTraceFieldsForReport(reportNumber)),
    meta: {
      tier: decision.tier,
      useful: decision.useful,
      sufficient: decision.sufficient,
      clientExtractionSufficient: clientExtractionSufficient({
        fields: finalized.fields,
        confidence: finalized.confidence,
      }),
    },
  });

  logGiaQaTrace({
    stage: "scoreEligible",
    reportNumber,
    fields: pickFields(finalized.fields, giaQaTraceFieldsForReport(reportNumber)),
    meta: {
      scoreEligible: completeness.scoreEligible,
      extractionState: completeness.extractionState,
      missingCoreFields: completeness.missingCoreFields,
      gradeHints,
    },
  });

  logGiaQaTrace({
    stage: "scoredCorePresentation",
    reportNumber,
    fields: pickFields(finalized.fields, giaQaTraceFieldsForReport(reportNumber)),
    meta: { scoredCorePresentation: scoredCore },
  });

  logGiaQaTrace({
    stage: "capability",
    reportNumber,
    fields: pickFields(finalized.fields, giaQaTraceFieldsForReport(reportNumber)),
    meta: {
      supportsLevel: capability.supportsLevel,
      needsGuidedCompletion: capability.needsGuidedCompletion,
      guidedCompletionFields: capability.guidedCompletionFields,
    },
  });

  logGiaQaTrace({
    stage: "guidedCompletion",
    reportNumber,
    fields: pickFields(finalized.fields, giaQaTraceFieldsForReport(reportNumber)),
    meta: { resolvedGuidedCompletionFields: guided },
  });

  const payload = toClientSafeInterpretationPayload(finalized, undefined, {
    partial: opts?.partial,
  });

  traceFieldsFromRecord(
    "apiExtractedFields",
    reportNumber,
    payload.extractedFields,
    {
      partial: payload.partial,
      confidenceBand: payload.decisionProfile?.confidence.band,
    },
  );
  traceFieldsFromRecord(
    "apiInterpretationFields",
    reportNumber,
    payload.interpretationFields,
  );
}

/** Compare stages and return first stage where a field becomes empty. */
export function findFirstFieldLoss(
  reportNumber: string,
  stages: Array<{ stage: GiaQaTraceStage; fields: GiaQaFieldSnapshot }>,
): { field: ReportFieldKey; lastGood: GiaQaTraceStage; firstEmpty: GiaQaTraceStage } | null {
  const keys = giaQaTraceFieldsForReport(reportNumber);
  for (const key of keys) {
    let lastGood: GiaQaTraceStage | null = null;
    for (const { stage, fields } of stages) {
      const v = fields[key];
      const empty = !v || v === "(empty)";
      if (!empty) {
        lastGood = stage;
        continue;
      }
      if (lastGood) {
        return { field: key, lastGood, firstEmpty: stage };
      }
    }
  }
  return null;
}
