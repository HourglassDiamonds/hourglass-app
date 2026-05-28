import { extractFieldsFromReportText } from "./extract-from-text";
import {
  buildFieldProvenanceFromExtraction,
  type FieldExtractionProvenance,
  type FieldProvenanceMap,
} from "./extraction-provenance";
import { GCAL353466126_MARKETING_TRAP } from "./fixtures/gcal353466126";
import { GCAL353466126_SCREENSHOT_OCR } from "./fixtures/gcal353466126";
import {
  GCAL360796191_DIAGRAM_OCR,
  GCAL360796191_FINISH_OCR,
  GCAL360796191_TEXT_LAYER,
} from "./fixtures/gcal360796191";
import { GIA2527039693_FACSIMILE_PLUS_OCR } from "./fixtures/gia2527039693";
import { LG773657228_WITH_HEADER } from "./fixtures/lg773657228";
import type {
  CalibrationLab,
  ExtractionResult,
  ReportFieldKey,
  TextExtractionMethod,
} from "./types";
import { REPORT_FIELD_KEYS } from "./types";

export const ANCHOR_REPORT_NUMBERS = [
  "LG353466126",
  "LG360796191",
  "LG773657228",
  "2527039693",
] as const;

export type AnchorReportNumber = (typeof ANCHOR_REPORT_NUMBERS)[number];

export type FieldAuditChannel =
  | "text-layer"
  | "ocr"
  | "diagram"
  | "unavailable"
  | "manual-unavailable";

export type FieldExtractionAuditRow = {
  field: ReportFieldKey;
  label: string;
  value: string;
  populated: boolean;
  channel: FieldAuditChannel;
  extractionClass: string;
  valueSource: string;
  extractionMethod: string;
  legacyConfidence: string;
  presentInRawText: boolean;
  whyMissing?: string;
};

export type AnchorExtractionAudit = {
  reportNumber: string;
  lab: CalibrationLab;
  scenarioId: string;
  textMethod: TextExtractionMethod;
  parserType?: string;
  parserConfidence?: string;
  rawTextLength: number;
  completenessPercent: number;
  populatedCount: number;
  requiredFieldCount: number;
  fields: FieldExtractionAuditRow[];
  warnings: string[];
  usedImageOcr?: boolean;
};

/** Fields allowed to be absent on locked anchors (not reported on cert). */
export const ANCHOR_OPTIONAL_ABSENT: Partial<
  Record<string, ReportFieldKey[]>
> = {
  LG773657228: ["lowerHalfPercent", "cutGrade"],
};

const FIELD_LABELS: Record<ReportFieldKey, string> = {
  shape: "shape",
  carat: "carat",
  measurements: "measurements",
  tablePercent: "table",
  depthPercent: "depth",
  crownAngle: "crown angle",
  pavilionAngle: "pavilion angle",
  lowerHalfPercent: "lower half",
  starLengthPercent: "star length",
  girdle: "girdle",
  culet: "culet",
  polish: "polish",
  symmetry: "symmetry",
  fluorescence: "fluorescence",
  cutGrade: "cut grade",
};

function channelFromProvenance(p: FieldExtractionProvenance): FieldAuditChannel {
  if (p.extractionClass === "UNAVAILABLE") return "unavailable";
  if (p.extractionMethod === "diagram-ocr" || p.valueSource === "diagram") {
    return "diagram";
  }
  if (
    p.extractionMethod === "ocr" ||
    p.valueSource === "ocr" ||
    p.extractionClass === "OCR_VERIFIED" ||
    p.extractionClass === "OCR_LOW_CONFIDENCE"
  ) {
    return "ocr";
  }
  if (p.extractionMethod === "pdf-text" || p.extractionClass === "EXACT_TEXT") {
    return "text-layer";
  }
  if (p.extractionClass === "DIRECT_DIAGRAM") return "diagram";
  return "text-layer";
}

export function buildAuditRows(
  result: ExtractionResult,
  provenance: FieldProvenanceMap,
): FieldExtractionAuditRow[] {
  return REPORT_FIELD_KEYS.map((field) => {
    const value = result.fields[field]?.trim() ?? "";
    const p = provenance[field];
    return {
      field,
      label: FIELD_LABELS[field],
      value,
      populated: Boolean(value),
      channel: p ? channelFromProvenance(p) : "unavailable",
      extractionClass: p?.extractionClass ?? "UNAVAILABLE",
      valueSource: p?.valueSource ?? "extracted",
      extractionMethod: p?.extractionMethod ?? "unavailable",
      legacyConfidence: p?.legacyConfidence ?? "missing",
      presentInRawText: p?.presentInRawText ?? false,
      whyMissing: p?.missingReason,
    };
  });
}

export function buildAnchorExtractionAudit(input: {
  scenarioId: string;
  lab: CalibrationLab;
  reportNumber: string;
  text: string;
  textMethod: TextExtractionMethod;
  usedImageOcr?: boolean;
  reportSource?: "pdf-upload" | "screenshot-upload" | "manual";
}): AnchorExtractionAudit {
  const result = extractFieldsFromReportText(input.text, {
    lab: input.lab,
    reportNumber: input.reportNumber,
    textMethod: input.textMethod,
    reportSource: input.reportSource ?? "pdf-upload",
    pdfTextLayerLength: input.textMethod === "pdf-text" ? input.text.length : 0,
    usedImageOCR: input.usedImageOcr,
  });

  const provenance = buildFieldProvenanceFromExtraction(result, input.text, {
    usedImageOCR: input.usedImageOcr,
  });

  const rows = buildAuditRows(result, provenance);
  const optionalAbsent = new Set(
    ANCHOR_OPTIONAL_ABSENT[input.reportNumber] ?? [],
  );
  const requiredKeys = REPORT_FIELD_KEYS.filter((k) => !optionalAbsent.has(k));
  const populatedCount = rows.filter(
    (r) => r.populated || optionalAbsent.has(r.field),
  ).length;

  return {
    reportNumber: input.reportNumber,
    lab: input.lab,
    scenarioId: input.scenarioId,
    textMethod: input.textMethod,
    parserType: result.parserType,
    parserConfidence: result.parserConfidence,
    rawTextLength: input.text.length,
    completenessPercent: Math.round(
      (rows.filter((r) => requiredKeys.includes(r.field) && r.populated)
        .length /
        requiredKeys.length) *
        100,
    ),
    populatedCount,
    requiredFieldCount: requiredKeys.length,
    fields: rows,
    warnings: result.warnings,
    usedImageOcr: input.usedImageOcr,
  };
}

/** Locked anchor scenarios — fixture-driven (deterministic, no live PDF hang). */
export function buildLockedAnchorExtractionAudits(): AnchorExtractionAudit[] {
  return [
    buildAnchorExtractionAudit({
      scenarioId: "anchor-gcal-8x-LG353466126",
      lab: "GCAL",
      reportNumber: "LG353466126",
      text: `${GCAL353466126_MARKETING_TRAP}\n${GCAL353466126_SCREENSHOT_OCR}`,
      textMethod: "pdf-text",
      usedImageOcr: true,
      reportSource: "pdf-upload",
    }),
    buildAnchorExtractionAudit({
      scenarioId: "anchor-gcal-sarine-LG360796191",
      lab: "GCAL",
      reportNumber: "LG360796191",
      text: `${GCAL360796191_TEXT_LAYER}\n${GCAL360796191_DIAGRAM_OCR}\n${GCAL360796191_FINISH_OCR}`,
      textMethod: "pdf-text",
      usedImageOcr: true,
      reportSource: "pdf-upload",
    }),
    buildAnchorExtractionAudit({
      scenarioId: "anchor-igi-LG773657228",
      lab: "IGI",
      reportNumber: "LG773657228",
      text: LG773657228_WITH_HEADER,
      textMethod: "pdf-text",
      reportSource: "pdf-upload",
    }),
    buildAnchorExtractionAudit({
      scenarioId: "anchor-gia-2527039693",
      lab: "GIA",
      reportNumber: "2527039693",
      text: GIA2527039693_FACSIMILE_PLUS_OCR,
      textMethod: "ocr",
      reportSource: "pdf-upload",
    }),
  ];
}

export function formatAnchorAuditReport(audits: AnchorExtractionAudit[]): string {
  const lines: string[] = ["=== Anchor extraction field audit ===", ""];
  for (const a of audits) {
    lines.push(
      `[${a.scenarioId}] ${a.lab} ${a.reportNumber} · parser=${a.parserType ?? "n/a"} · ${a.completenessPercent}% complete (${a.populatedCount}/${REPORT_FIELD_KEYS.length})`,
    );
    for (const row of a.fields) {
      const optional = ANCHOR_OPTIONAL_ABSENT[a.reportNumber]?.includes(
        row.field,
      );
      const status = row.populated
        ? `${row.channel} · ${row.extractionClass} · ${row.extractionMethod}`
        : optional
          ? "N/A (not on cert)"
          : `MISSING · ${row.whyMissing ?? "unknown"}`;
      lines.push(
        `  ${row.label.padEnd(14)} ${row.populated ? row.value.padEnd(28) : "(empty)".padEnd(28)} ${status}`,
      );
    }
    if (a.warnings.length) {
      lines.push(`  warnings: ${a.warnings.slice(0, 2).join(" | ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
