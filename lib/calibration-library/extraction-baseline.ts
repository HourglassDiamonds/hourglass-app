import { extractFieldsFromReportText } from "./extract-from-text";
import { scoreRoundBrilliant } from "./scoring/round-brilliant";
import type {
  CalibrationReportFields,
  ExtractionResult,
  ReportSource,
  TextExtractionMethod,
} from "./types";
import { REPORT_FIELD_KEYS } from "./types";

export type BaselineScenario = {
  id: string;
  lab: string;
  reportNumber: string;
  reportSource: ReportSource;
  textMethod: TextExtractionMethod;
  text: string;
};

export type BaselineScenarioResult = {
  id: string;
  lab: string;
  reportNumber: string;
  parserPathUsed: string;
  parserConfidence?: string;
  recovered: string[];
  missing: string[];
  warnings: string[];
  scoreEligible: boolean;
  scoreIneligibleReason?: string;
};

function listPopulated(fields: CalibrationReportFields): string[] {
  return REPORT_FIELD_KEYS.filter((k) => fields[k].trim()).map(
    (k) => `${k}=${fields[k].trim()}`,
  );
}

function listMissing(fields: CalibrationReportFields): string[] {
  return REPORT_FIELD_KEYS.filter((k) => !fields[k].trim());
}

export function runBaselineScenario(
  scenario: BaselineScenario,
): BaselineScenarioResult {
  const result: ExtractionResult = extractFieldsFromReportText(scenario.text, {
    lab: scenario.lab,
    reportNumber: scenario.reportNumber,
    reportSource: scenario.reportSource,
    textMethod: scenario.textMethod,
    pdfTextLayerLength: scenario.textMethod === "pdf-text" ? 500 : 0,
  });

  const score = scoreRoundBrilliant(result.fields);

  return {
    id: scenario.id,
    lab: result.metadata.lab,
    reportNumber: result.metadata.reportNumber || scenario.reportNumber,
    parserPathUsed: result.parserType ?? "generic",
    parserConfidence: result.parserConfidence,
    recovered: listPopulated(result.fields),
    missing: listMissing(result.fields),
    warnings: result.warnings,
    scoreEligible: score.eligible,
    scoreIneligibleReason: score.ineligibleReason,
  };
}

export function formatBaselineSummary(results: BaselineScenarioResult[]): string {
  const lines: string[] = [
    "=== Calibration extraction baseline ===",
    "",
  ];
  for (const r of results) {
    lines.push(`[${r.id}] lab=${r.lab} report=${r.reportNumber}`);
    lines.push(`  parser: ${r.parserPathUsed} (confidence: ${r.parserConfidence ?? "n/a"})`);
    lines.push(`  score: ${r.scoreEligible ? "eligible" : `ineligible — ${r.scoreIneligibleReason}`}`);
    lines.push(`  recovered (${r.recovered.length}): ${r.recovered.join(", ") || "(none)"}`);
    lines.push(`  missing (${r.missing.length}): ${r.missing.join(", ") || "(none)"}`);
    if (r.warnings.length) {
      lines.push(`  warnings: ${r.warnings.slice(0, 2).join(" | ")}${r.warnings.length > 2 ? " …" : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
