import { scoreRoundBrilliant } from "./scoring/round-brilliant";
import type {
  CalibrationWorkbookEntry,
  ReportFieldKey,
} from "./types";
import { REPORT_FIELD_KEYS } from "./types";

export const LP_REQUIRED_PROPORTION_KEYS: ReportFieldKey[] = [
  "shape",
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "lowerHalfPercent",
  "starLengthPercent",
];

export const LP_OPTIONAL_FINISH_KEYS: ReportFieldKey[] = [
  "girdle",
  "culet",
  "polish",
  "symmetry",
  "fluorescence",
  "cutGrade",
];

export const LP_OPTIONAL_CONTEXT_KEYS: ReportFieldKey[] = [
  "carat",
  "measurements",
];

export type LightPerformanceReadinessItem = {
  id: string;
  reportNumber: string;
  lab: string;
  parserType?: string;
  reportSource: string;
  parserConfidence?: string;
  requiredPresent: string[];
  requiredMissing: string[];
  optionalPresent: string[];
  scoreEligible: boolean;
  scoreOverall: number | null;
  scoreReproducible: boolean;
  extractedRawPreserved: boolean;
  warnings: string[];
};

export type LightPerformanceReadinessReport = {
  entryCount: number;
  items: LightPerformanceReadinessItem[];
  checklist: {
    requiredFieldsAvailable: boolean;
    optionalFieldsTracked: boolean;
    missingFieldFallbackSafe: boolean;
    parserMetadataVisible: boolean;
    scoreReproducible: boolean;
    provenanceTracked: boolean;
  };
  readyForLightPerformanceBuild: boolean;
};

function fieldPopulated(fields: Record<ReportFieldKey, string>, key: ReportFieldKey): boolean {
  return Boolean(fields[key]?.trim());
}

export function assessLightPerformanceReadiness(
  entries: CalibrationWorkbookEntry[],
): LightPerformanceReadinessReport {
  const items: LightPerformanceReadinessItem[] = entries.map((entry) => {
    const fields = entry.fieldsNormalized ?? entry.fields;
    const rescored = scoreRoundBrilliant(fields);
    const stored = entry.roundBrilliantScore;
    const scoreReproducible =
      !stored ||
      (rescored.eligible === stored.eligible &&
        (stored.eligible ? rescored.overall === stored.overall : true));

    const requiredPresent = LP_REQUIRED_PROPORTION_KEYS.filter((k) =>
      fieldPopulated(fields, k),
    ).map((k) => k);
    const requiredMissing = LP_REQUIRED_PROPORTION_KEYS.filter(
      (k) => !fieldPopulated(fields, k),
    );

    const optionalPresent = [
      ...LP_OPTIONAL_FINISH_KEYS,
      ...LP_OPTIONAL_CONTEXT_KEYS,
    ].filter((k) => fieldPopulated(fields, k));

    const extractedRawPreserved = REPORT_FIELD_KEYS.some(
      (k) => entry.extractedFieldsRaw[k]?.trim(),
    );

    return {
      id: entry.id,
      reportNumber: entry.metadata.reportNumber,
      lab: entry.metadata.lab,
      parserType: entry.parserType,
      reportSource: entry.metadata.reportSource,
      parserConfidence: entry.parserConfidence,
      requiredPresent,
      requiredMissing,
      optionalPresent,
      scoreEligible: rescored.eligible,
      scoreOverall: rescored.eligible ? rescored.overall : null,
      scoreReproducible,
      extractedRawPreserved,
      warnings: entry.warnings,
    };
  });

  const scoreReproducible =
    items.length === 0 || items.every((i) => i.scoreReproducible);
  const parserMetadataVisible =
    items.length === 0 || items.every((i) => Boolean(i.parserType));
  const provenanceTracked =
    items.length === 0 ||
    items.every((i) => i.reportSource === "pdf-upload" || i.reportSource === "screenshot-upload" || i.reportSource === "manual");

  return {
    entryCount: entries.length,
    items,
    checklist: {
      requiredFieldsAvailable: items.some((i) => i.requiredPresent.length >= 4),
      optionalFieldsTracked: true,
      missingFieldFallbackSafe: items.every(
        (i) =>
          !i.scoreEligible ||
          i.requiredMissing.every((k) => k !== "shape"),
      ),
      parserMetadataVisible,
      scoreReproducible,
      provenanceTracked,
    },
    readyForLightPerformanceBuild:
      items.length >= 10 &&
      scoreReproducible &&
      parserMetadataVisible &&
      provenanceTracked,
  };
}

export function formatReadinessSummary(
  report: LightPerformanceReadinessReport,
): string {
  const lines: string[] = [
    "=== Light Performance calibration readiness ===",
    `Entries: ${report.entryCount}`,
    `Ready for LP build/testing: ${report.readyForLightPerformanceBuild ? "YES" : "NO (need more seeded entries or fix gates)"}`,
    "",
    "Checklist:",
    `  required fields available (sample): ${report.checklist.requiredFieldsAvailable}`,
    `  optional fields tracked: ${report.checklist.optionalFieldsTracked}`,
    `  missing-field fallback safe: ${report.checklist.missingFieldFallbackSafe}`,
    `  parser metadata visible: ${report.checklist.parserMetadataVisible}`,
    `  score reproducible after reload: ${report.checklist.scoreReproducible}`,
    `  report provenance tracked: ${report.checklist.provenanceTracked}`,
    "",
  ];

  for (const item of report.items.slice(0, 30)) {
    lines.push(
      `[${item.lab} ${item.reportNumber}] parser=${item.parserType ?? "?"} source=${item.reportSource} score=${item.scoreEligible ? item.scoreOverall : "ineligible"} reproducible=${item.scoreReproducible}`,
    );
    if (item.requiredMissing.length) {
      lines.push(`  missing required: ${item.requiredMissing.join(", ")}`);
    }
  }

  return lines.join("\n");
}
