import {
  detectLabFromText,
  looksLikeIgiReportText,
  normalizeCalibrationLab,
} from "../lab-parsers";
import { looksLikeGiaReportText } from "../gia-proportions";
import type { CalibrationLab } from "../types";
import {
  looksLikeGcal8xReportText,
  looksLikeGcalSarine4csReportText,
} from "./gcal/gcal-layout-detector";
import { hasSarineColumnListSignature } from "./gcal/gcal-sarine-4cs";
import type { ParserConfidence, ParserType, ReportFamilyMatch } from "./types";

export type DetectReportFamilyHints = {
  lab?: string;
  gcalImageOnlyPdf?: boolean;
};

function resolveLab(text: string, hintLab?: string): CalibrationLab {
  const detected = detectLabFromText(text);
  if (!hintLab?.trim()) return detected ?? "OTHER";
  const fromHint = normalizeCalibrationLab(hintLab);
  if (detected && fromHint === "OTHER") return detected;
  return fromHint;
}

/**
 * Deterministic report-family router — no parser self-routes internally.
 */
export function detectReportFamily(
  text: string,
  hints?: DetectReportFamilyHints,
): ReportFamilyMatch {
  const labResolved = resolveLab(text, hints?.lab);
  const looksGcalSarine = looksLikeGcalSarine4csReportText(text);
  const looksGcal8x = looksLikeGcal8xReportText(text);
  const sarineColumnList = hasSarineColumnListSignature(text);
  const looksGia = looksLikeGiaReportText(text);
  const looksIgi = looksLikeIgiReportText(text);

  const lab: CalibrationLab =
    labResolved === "OTHER" && looksGcal8x
      ? "GCAL"
      : labResolved === "OTHER" && looksGcalSarine
        ? "GCAL"
        : labResolved === "OTHER" && looksGia
          ? "GIA"
          : labResolved === "OTHER" && looksIgi
            ? "IGI"
            : labResolved;

  if (
    hints?.gcalImageOnlyPdf &&
    !looksGcalSarine &&
    !looksGia &&
    (looksGcal8x || lab === "GCAL")
  ) {
    return {
      lab: "GCAL",
      parserType: "gcal-8x",
      confidence: looksGcal8x ? "high" : "medium",
      reason: looksGcal8x
        ? "GCAL image-only PDF — 8X diagram OCR path"
        : "GCAL lab with image-only PDF — 8X diagram OCR path",
    };
  }

  if (looksGcalSarine && sarineColumnList && lab === "GCAL") {
    return {
      lab,
      parserType: "gcal-sarine-4cs",
      confidence: "high",
      reason:
        "GCAL BY SARINE + 4Cs markers + column-list label block signature",
    };
  }

  if (looksGcal8x || (lab === "GCAL" && /\b8\s*X\b/i.test(text))) {
    return {
      lab,
      parserType: "gcal-8x",
      confidence: looksGcal8x ? "high" : "medium",
      reason: looksGcal8x
        ? "GCAL 8X Ultimate Diamond Cut Grade layout"
        : "GCAL lab hint with 8X marker",
    };
  }

  if (looksGcalSarine && lab === "GCAL") {
    return {
      lab,
      parserType: "gcal-sarine-4cs",
      confidence: "medium",
      reason:
        "GCAL BY SARINE markers without column-list signature — inline grading fallback",
    };
  }

  if (
    (lab === "IGI" || looksIgi) &&
    lab !== "GIA" &&
    !looksGia
  ) {
    return {
      lab: lab === "OTHER" ? "IGI" : lab,
      parserType: "igi-standard",
      confidence: looksIgi ? "high" : "medium",
      reason: "IGI report markers",
    };
  }

  if (lab === "GIA" || looksGia) {
    return {
      lab: lab === "OTHER" ? "GIA" : lab,
      parserType: "gia-modern",
      confidence: looksGia ? "high" : "medium",
      reason: "GIA report markers",
    };
  }

  return {
    lab,
    parserType: "generic",
    confidence: "low",
    reason: "No specialized report family matched",
  };
}

export function isGcalParserType(parserType: ParserType): boolean {
  return parserType === "gcal-8x" || parserType === "gcal-sarine-4cs";
}

export function mapParserTypeToLegacyExtraction(
  parserType: ParserType,
): "gcal-8x" | "gcal-sarine-4cs" | undefined {
  if (parserType === "gcal-8x") return "gcal-8x";
  if (parserType === "gcal-sarine-4cs") return "gcal-sarine-4cs";
  return undefined;
}
