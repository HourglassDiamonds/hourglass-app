/**
 * Calibration refinement audit — scores, narratives, confidence, jeweler review.
 * Does not modify scoring, UI, parsers, or extraction.
 *
 * Usage:
 *   npx tsx scripts/calibration-audit.ts
 *   npx tsx scripts/calibration-audit.ts --in-process
 *   npx tsx scripts/calibration-audit.ts --expected-only
 *
 * Outputs under data/light-performance-calibration/calibration-audit/
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { basename, join } from "path";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import {
  VALIDATION_EXPECTED_PATH,
  VALIDATION_MANIFEST_PATH,
  VALIDATION_REPORTS_DIR,
  type ManifestEntry,
} from "@/lib/calibration-library/diamond-intelligence-validation-gate";
import { withTimeout } from "@/lib/calibration-library/runtime-guard";
import {
  CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
  CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
} from "@/lib/calibration-library/runtime-limits";
import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import { scoreRoundBrilliant } from "@/lib/calibration-library/scoring/round-brilliant";
import { assessReportCapability } from "@/lib/diamond-intelligence/report-capability";
import { assessExtractionCompleteness } from "@/lib/diamond-intelligence/extraction-completeness";
import { buildClientInterpretationConfidence } from "@/lib/diamond-intelligence/client-interpretation-confidence";
import { buildClientReadState } from "@/lib/diamond-intelligence/client-read-state";
import {
  buildDiamondInterpretationContext,
  type DiamondCopyTone,
} from "@/lib/diamond-intelligence/client-interpretation-context";
import {
  presentClientInterpretationScore,
  opticalBalanceDisplayValue,
} from "@/lib/diamond-intelligence/client-score-present";
import {
  presentConfidenceAdjustedRead,
  presentOverallReadLabel,
} from "@/lib/diamond-intelligence/client-percentile-present";
import {
  buildPerformanceReadCopy,
  buildOpticalInterpretationSummary,
  buildOpticalCharacterCopy,
} from "@/lib/diamond-intelligence/client-performance-copy";
import { buildClientDiamondDecisionProfile } from "@/lib/diamond-intelligence/client-decision-profile";
import { parseReportGradeHints } from "@/lib/diamond-intelligence/report-grade-hints";

const OUT_DIR = join(
  process.cwd(),
  "data/light-performance-calibration/calibration-audit",
);

type ExpectedSpec = Record<string, unknown>;

type AuditRow = {
  reportNumber: string;
  lab: string;
  style?: string;
  table: string;
  depth: string;
  crownAngle: string;
  pavilionAngle: string;
  carat: string;
  measurements: string;
  rawScore: number | null;
  displayScore: number | null;
  overallLabel: string;
  scoreBand: string;
  confidenceLevel: "high" | "medium" | "low";
  confidenceReason: string;
  readState: "full" | "partial" | "orientation";
  extractionState: string;
  scoreEligible: boolean;
  narrativeCategory: string;
  scoreHeadline: string;
  opticalSummary: string;
  whatThisMeans: string;
  primaryExplanation: string;
  copyTone: DiamondCopyTone;
  proportionArchetype: string;
  spreadIndex: number | null;
  fireIndex: number | null;
  parserType: string;
  imageOcrMs: number;
  routeMs: number;
  opticalPerformanceBand: string;
  visualPresenceBand: string;
  riskProfileBand: string;
  overallRecommendationBand: string;
  clarityHint: string;
};

type JewelerReview = {
  reportNumber: string;
  standsOut: string[];
  concerns: string[];
  unusual: string[];
  wouldVerify: string[];
  tellClient: string;
};

function loadManifest(): ManifestEntry[] {
  const manifest = JSON.parse(readFileSync(VALIDATION_MANIFEST_PATH, "utf8")) as {
    reports: ManifestEntry[];
  };
  return manifest.reports;
}

function loadExpected(): Record<string, ExpectedSpec> {
  return JSON.parse(readFileSync(VALIDATION_EXPECTED_PATH, "utf8")) as Record<
    string,
    ExpectedSpec
  >;
}

function fieldsFromExpected(spec: ExpectedSpec, id: string): CalibrationReportFields {
  const empty = (k: keyof CalibrationReportFields) => "";
  const f: CalibrationReportFields = {
    shape: String(spec.shape ?? "Round Brilliant"),
    carat: String(spec.carat ?? ""),
    measurements: String(spec.measurements ?? ""),
    tablePercent: spec.tablePercent != null ? String(spec.tablePercent) : "",
    depthPercent: spec.depthPercent != null ? String(spec.depthPercent) : "",
    crownAngle: spec.crownAngle != null ? String(spec.crownAngle) : "",
    pavilionAngle:
      spec.pavilionAngle != null ? String(spec.pavilionAngle) : "",
    lowerHalfPercent:
      spec.lowerHalfPercent != null ? String(spec.lowerHalfPercent) : "",
    starLengthPercent:
      spec.starLengthPercent != null ? String(spec.starLengthPercent) : "",
    girdle: String(spec.girdle ?? ""),
    culet: String(spec.culet ?? ""),
    polish: String(spec.polish ?? ""),
    symmetry: String(spec.symmetry ?? ""),
    fluorescence: String(spec.fluorescence ?? ""),
    cutGrade: String(spec.cutGrade ?? ""),
  };
  if (!f.shape.trim()) f.shape = "Round Brilliant";
  if (!f.carat.trim()) f.carat = "1.00";
  return f;
}

async function extractFields(entry: ManifestEntry): Promise<{
  fields: CalibrationReportFields;
  parserType: string;
  imageOcrMs: number;
  routeMs: number;
  rawTextSnippet: string;
}> {
  const pdfPath = join(VALIDATION_REPORTS_DIR, entry.filename);
  const bytes = readFileSync(pdfPath);
  const started = Date.now();
  const result = await withTimeout(
    runCalibrationUploadExtraction({
      bytes,
      mime: "application/pdf",
      reportNumber: entry.id,
      lab: entry.lab as "GIA" | "GCAL" | "IGI",
      reportSource: "pdf-upload",
      mode: "client",
      pipelineTimeoutMs: CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
    }),
    CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
    "calibration-audit",
  );
  return {
    fields: result.fields,
    parserType: result.parserType ?? "unknown",
    imageOcrMs: result.timings.imageOcrMs ?? 0,
    routeMs: Date.now() - started,
    rawTextSnippet: result.rawTextSnippet ?? "",
  };
}

function num(s: string): number | null {
  const n = parseFloat(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function avgDiameterMm(measurements: string): number | null {
  const m = measurements.match(
    /(\d+\.\d{2})\s*[-–—]\s*(\d+\.\d{2})\s*x\s*(\d+\.\d{2})/i,
  );
  if (!m) return null;
  const a = parseFloat(m[1]!);
  const b = parseFloat(m[2]!);
  return (a + b) / 2;
}

function classifyArchetype(fields: CalibrationReportFields): {
  archetype: string;
  spreadIndex: number | null;
  fireIndex: number | null;
} {
  const table = num(fields.tablePercent);
  const depth = num(fields.depthPercent);
  const crown = num(fields.crownAngle);
  const pavilion = num(fields.pavilionAngle);
  const carat = num(fields.carat);
  const dia = avgDiameterMm(fields.measurements);

  const spreadIndex =
    table !== null && depth !== null ? table - depth + 100 : null;
  const fireIndex =
    crown !== null && pavilion !== null ? crown + pavilion : null;

  if (table === null || depth === null || crown === null || pavilion === null) {
    return { archetype: "incomplete-proportions", spreadIndex, fireIndex };
  }

  const spreadOriented = table >= 60 && depth <= 60;
  const steepFire = crown >= 35 && pavilion >= 41 && depth >= 61;
  const shallowSpread = table >= 58 && depth <= 59.5;
  const compactDeep = depth >= 62.5 && table <= 57;
  const tolkowskyLike =
    table >= 55 &&
    table <= 59 &&
    depth >= 60 &&
    depth <= 62 &&
    crown >= 33 &&
    crown <= 35.5 &&
    pavilion >= 40.2 &&
    pavilion <= 41.2;

  if (spreadOriented && !steepFire) {
    return { archetype: "spread-oriented", spreadIndex, fireIndex };
  }
  if (steepFire && depth >= 61) {
    return { archetype: "steep-deep-fire", spreadIndex, fireIndex };
  }
  if (shallowSpread) {
    return { archetype: "shallow-spread", spreadIndex, fireIndex };
  }
  if (compactDeep) {
    return { archetype: "compact-deep", spreadIndex, fireIndex };
  }
  if (tolkowskyLike) {
    return { archetype: "tolkowsky-balanced", spreadIndex, fireIndex };
  }

  const faceUpSpread =
    dia !== null && carat !== null && carat > 0
      ? dia / (6.4 + Math.cbrt(carat) * 2.2)
      : null;
  if (faceUpSpread !== null && faceUpSpread >= 1.03) {
    return { archetype: "spread-face-up", spreadIndex, fireIndex };
  }

  return { archetype: "non-canonical-mix", spreadIndex, fireIndex };
}

function narrativeCategory(
  overallLabel: string,
  copyTone: DiamondCopyTone,
  scoreEligible: boolean,
): string {
  if (!scoreEligible || copyTone === "orientation") return "preliminary";
  if (copyTone === "careful") return "careful-balanced";
  if (
    overallLabel === "Top 0.5%" ||
    overallLabel === "Top 1%" ||
    overallLabel === "Top 5%"
  ) {
    return "exceptional-tier";
  }
  if (overallLabel === "Strong") return "strong-tier";
  if (overallLabel === "Balanced") return "balanced-tier";
  if (overallLabel === "Mixed") return "mixed-tier";
  return "review-tier";
}

function buildJewelerReviewExperimental(
  fields: CalibrationReportFields,
  row: AuditRow,
): JewelerReview {
  const table = num(fields.tablePercent);
  const depth = num(fields.depthPercent);
  const crown = num(fields.crownAngle);
  const pavilion = num(fields.pavilionAngle);
  const standsOut: string[] = [];
  const concerns: string[] = [];
  const unusual: string[] = [];
  const wouldVerify: string[] = [];

  if (row.rawScore !== null && row.rawScore >= 92) {
    standsOut.push("Proportions cluster in a high-performing band on paper.");
  }
  if (table !== null && table >= 62) {
    unusual.push(`Wide table (${table}%) — spread-leaning look; verify face-up size vs depth.`);
  }
  if (table !== null && table <= 55) {
    unusual.push(`Smaller table (${table}%) — steeper crown/pavilion feel; may trade size for contrast.`);
  }
  if (depth !== null && depth >= 63) {
    concerns.push(`Total depth ${depth}% is on the deep side — check if brilliance stays lively in person.`);
  }
  if (depth !== null && depth <= 58.5) {
    concerns.push(`Total depth ${depth}% is shallow — confirm light return is not washed out.`);
  }
  if (crown !== null && crown >= 36) {
    unusual.push(`Crown angle ${crown}° is steeper than classic Tolkowsky — fire may dominate brightness.`);
  }
  if (pavilion !== null && pavilion >= 41.5) {
    concerns.push(`Pavilion angle ${pavilion}° is steep — leakage risk if paired with shallow crown.`);
  }
  if (fields.polish.toLowerCase().includes("good")) {
    concerns.push("Finish lines (Good polish/symmetry) may cap perceived precision vs Excellent peers.");
  }
  if (fields.fluorescence.toLowerCase().includes("strong")) {
    wouldVerify.push("Fluorescence strength — how it reads in daylight vs warm light.");
  }
  if (!fields.lowerHalfPercent.trim() || !fields.starLengthPercent.trim()) {
    wouldVerify.push("Lower-half and star length on diagram — not in client score but affects scintillation story.");
  }
  if (row.extractionState !== "FULL_EXTRACTION") {
    wouldVerify.push("Extraction incomplete — confirm table/depth/crown/pavilion from diagram before quoting.");
  }
  if (standsOut.length === 0 && row.rawScore !== null && row.rawScore >= 85) {
    standsOut.push("Reads as a solid, mainstream Excellent-style proportion set — few red flags on paper.");
  }
  if (concerns.length === 0 && row.rawScore !== null && row.rawScore < 82) {
    concerns.push("Several proportion choices sit outside the tightest calibration band — expect tradeoffs.");
  }

  const tellClient =
    standsOut.length > 0
      ? `Lead with: ${standsOut[0]} Then discuss: ${concerns[0] ?? unusual[0] ?? "how it looks in your lighting."}`
      : concerns.length > 0
        ? `Be direct about tradeoffs: ${concerns[0]} Offer to compare side-by-side with a reference stone.`
        : "Treat as a standard round — verify sparkle in person; report numbers are only a guide.";

  return {
    reportNumber: row.reportNumber,
    standsOut,
    concerns,
    unusual,
    wouldVerify,
    tellClient,
  };
}

function buildAuditRow(
  entry: ManifestEntry,
  fields: CalibrationReportFields,
  meta: {
    parserType: string;
    imageOcrMs: number;
    routeMs: number;
    rawTextSnippet?: string;
  },
): AuditRow {
  const capability = assessReportCapability({ fields });
  const completeness = assessExtractionCompleteness({ fields });
  const confidence = buildClientInterpretationConfidence(fields);
  const readState = buildClientReadState(fields, confidence);
  const clientScore = presentClientInterpretationScore(
    fields,
    capability.interpretationLevel,
  );
  const raw = clientScore.eligible ? clientScore.overall : null;
  const adjusted = presentConfidenceAdjustedRead(raw, confidence);
  const ctx = buildDiamondInterpretationContext({
    fields,
    rawScore: raw,
    confidence,
  });
  const perf = buildPerformanceReadCopy({
    overallScore: adjusted.displayScore,
    overallLabel: adjusted.presentation.label,
    clientScore,
    interpretationLevel: capability.interpretationLevel,
    needsExpertDiagramReview: capability.needsExpertDiagramReview,
    copyTone: ctx.copyTone,
  });
  const opticalSummary = buildOpticalInterpretationSummary({
    capability,
    clientScore,
    overallLabel: adjusted.presentation.label,
    needsExpertDiagramReview: capability.needsExpertDiagramReview,
    copyTone: ctx.copyTone,
  });
  const { archetype, spreadIndex, fireIndex } = classifyArchetype(fields);
  const gradeHints = meta.rawTextSnippet
    ? parseReportGradeHints(meta.rawTextSnippet)
    : {};
  const decision = buildClientDiamondDecisionProfile({
    fields,
    metadata: {
      lab: entry.lab,
      reportNumber: entry.id,
      stoneType: "",
    },
    capability: (() => {
      const { internalCalibrationEligible: _i, ...c } = assessReportCapability({
        fields,
      });
      return c;
    })(),
    rawScore: raw,
    gradeHints,
  });

  return {
    reportNumber: entry.id,
    lab: entry.lab,
    style: entry.style,
    table: fields.tablePercent.trim() || "—",
    depth: fields.depthPercent.trim() || "—",
    crownAngle: fields.crownAngle.trim() || "—",
    pavilionAngle: fields.pavilionAngle.trim() || "—",
    carat: fields.carat.trim() || "—",
    measurements: fields.measurements.trim() || "—",
    rawScore: raw,
    displayScore: ctx.displayScore,
    overallLabel: adjusted.presentation.label,
    scoreBand: clientScore.eligible
      ? scoreRoundBrilliant(fields).band
      : "ineligible",
    confidenceLevel: confidence.level,
    confidenceReason: confidence.reason,
    readState: readState.state,
    extractionState: completeness.extractionState,
    scoreEligible: completeness.scoreEligible,
    narrativeCategory: narrativeCategory(
      adjusted.presentation.label,
      ctx.copyTone,
      completeness.scoreEligible,
    ),
    scoreHeadline: perf.scoreHeadline,
    opticalSummary,
    whatThisMeans: perf.whatThisMeans,
    primaryExplanation: ctx.primaryExplanation,
    copyTone: ctx.copyTone,
    proportionArchetype: archetype,
    spreadIndex,
    fireIndex,
    parserType: meta.parserType,
    imageOcrMs: meta.imageOcrMs,
    routeMs: meta.routeMs,
    opticalPerformanceBand: decision.opticalPerformance.band,
    visualPresenceBand: decision.visualPresence.band,
    riskProfileBand: decision.riskProfile.band,
    overallRecommendationBand: decision.overallRecommendation.band,
    clarityHint: gradeHints.clarity ?? "",
  };
}

function scoreHistogram(rows: AuditRow[]): Record<string, number> {
  const buckets = {
    "90-100": 0,
    "85-89": 0,
    "80-84": 0,
    "70-79": 0,
    "below-70": 0,
    "no-score": 0,
  };
  for (const r of rows) {
    const s = r.displayScore ?? r.rawScore;
    if (s === null) {
      buckets["no-score"]++;
      continue;
    }
    if (s >= 90) buckets["90-100"]++;
    else if (s >= 85) buckets["85-89"]++;
    else if (s >= 80) buckets["80-84"]++;
    else if (s >= 70) buckets["70-79"]++;
    else buckets["below-70"]++;
  }
  return buckets;
}

function phraseFrequency(rows: AuditRow[]): Array<{ phrase: string; count: number }> {
  const phrases = [
    "balanced overall presentation",
    "strong fire",
    "strong contrast",
    "balanced brightness",
    "lively fire",
    "healthy contrast",
    "steady, balanced presentation",
    "balanced, lively performer",
    "useful starting point",
    "preliminary read",
    "outstanding overall light-performance",
    "strong overall light-performance",
    "mixed optical picture",
  ];
  const counts: Record<string, number> = {};
  for (const p of phrases) counts[p] = 0;
  for (const r of rows) {
    const blob = [
      r.opticalSummary,
      r.whatThisMeans,
      r.scoreHeadline,
      r.primaryExplanation,
    ]
      .join(" ")
      .toLowerCase();
    for (const p of phrases) {
      if (blob.includes(p.toLowerCase())) counts[p]!++;
    }
  }
  return Object.entries(counts)
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count);
}

function uniqueOpticalSummaries(rows: AuditRow[]): string[] {
  return [...new Set(rows.map((r) => r.opticalSummary))];
}

function topEndAnalysis(rows: AuditRow[]) {
  const scored = rows.filter((r) => r.displayScore !== null || r.rawScore !== null);
  const scores = scored.map((r) => r.displayScore ?? r.rawScore!);
  const above = (n: number) => scores.filter((s) => s >= n).length;
  return {
    sampleSize: scored.length,
    countAbove95: above(95),
    countAbove90: above(90),
    countAbove85: above(85),
    countAbove88: above(88),
    min: scores.length ? Math.min(...scores) : null,
    max: scores.length ? Math.max(...scores) : null,
    mean:
      scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null,
    histogram: scoreHistogram(rows),
    recommendations: [
      scores.filter((s) => s >= 95).length >= scored.length * 0.4
        ? "Top band (95+) may be too crowded for a small validation set — review whether exceptional language matches jeweler rarity expectations."
        : "Top band (95+) is not dominating the sample — monitor as corpus grows.",
      scores.filter((s) => s >= 90).length === scored.length
        ? "All scored anchors sit 90+ — strong inflation risk vs mixed real-world inventory."
        : null,
      scores.filter((s) => s >= 88 && s < 92).length >= 2
        ? "Several stones cluster 88–91 (Strong/Balanced boundary) — Excellent lab grades may read too similarly."
        : null,
    ].filter(Boolean),
  };
}

function confidenceAudit(rows: AuditRow[]) {
  return rows.map((r) => ({
    reportNumber: r.reportNumber,
    confidenceLevel: r.confidenceLevel,
    readState: r.readState,
    extractionState: r.extractionState,
    scoreEligible: r.scoreEligible,
    rawScore: r.rawScore,
    displayScore: r.displayScore,
    confidenceReason: r.confidenceReason,
    drivenByInformation:
      r.confidenceLevel === "high"
        ? r.extractionState === "FULL_EXTRACTION"
        : r.extractionState !== "FULL_EXTRACTION" ||
          r.readState !== "full",
    possibleScoreCoupling:
      r.rawScore !== null &&
      r.rawScore >= 90 &&
      r.confidenceLevel !== "high"
        ? "High score but not high confidence — OK"
        : r.rawScore !== null &&
            r.rawScore < 80 &&
            r.confidenceLevel === "high"
          ? "REVIEW: lower score with high confidence — check coupling"
          : null,
  }));
}

function rankings(rows: AuditRow[]) {
  const scored = rows.filter((r) => r.rawScore !== null);
  const by = (key: keyof AuditRow, desc = true) =>
    [...scored].sort((a, b) => {
      const av = a[key] as number | null;
      const bv = b[key] as number | null;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return desc ? bv - av : av - bv;
    });
  return {
    top10Strongest: by("rawScore").slice(0, 10).map((r) => ({
      reportNumber: r.reportNumber,
      lab: r.lab,
      rawScore: r.rawScore,
      archetype: r.proportionArchetype,
    })),
    top10Weakest: by("rawScore", false).slice(0, 10).map((r) => ({
      reportNumber: r.reportNumber,
      lab: r.lab,
      rawScore: r.rawScore,
      archetype: r.proportionArchetype,
    })),
    mostUnusual: rows
      .filter((r) => r.proportionArchetype !== "tolkowsky-balanced")
      .map((r) => ({
        reportNumber: r.reportNumber,
        archetype: r.proportionArchetype,
        table: r.table,
        depth: r.depth,
        crown: r.crownAngle,
        pavilion: r.pavilionAngle,
      })),
    highestSpread: [...rows]
      .filter((r) => r.spreadIndex !== null)
      .sort((a, b) => (b.spreadIndex ?? 0) - (a.spreadIndex ?? 0))
      .slice(0, 5),
    lowestSpread: [...rows]
      .filter((r) => r.spreadIndex !== null)
      .sort((a, b) => (a.spreadIndex ?? 0) - (b.spreadIndex ?? 0))
      .slice(0, 5),
    highestFire: [...rows]
      .filter((r) => r.fireIndex !== null)
      .sort((a, b) => (b.fireIndex ?? 0) - (a.fireIndex ?? 0))
      .slice(0, 5),
    deepest: [...rows]
      .filter((r) => num(String(r.depth)) !== null)
      .sort((a, b) => (num(String(b.depth)) ?? 0) - (num(String(a.depth)) ?? 0))
      .slice(0, 5),
    shallowest: [...rows]
      .filter((r) => num(String(r.depth)) !== null)
      .sort((a, b) => (num(String(a.depth)) ?? 0) - (num(String(b.depth)) ?? 0))
      .slice(0, 5),
  };
}

function narrativeDiversity(rows: AuditRow[]) {
  const byArchetype = new Map<string, AuditRow[]>();
  for (const r of rows) {
    const list = byArchetype.get(r.proportionArchetype) ?? [];
    list.push(r);
    byArchetype.set(r.proportionArchetype, list);
  }
  const groups = [...byArchetype.entries()].map(([archetype, list]) => ({
    archetype,
    count: list.length,
    reports: list.map((r) => r.reportNumber),
    opticalSummaries: list.map((r) => r.opticalSummary),
    allSameSummary:
      list.length > 1 &&
      list.every((r) => r.opticalSummary === list[0]!.opticalSummary),
  }));
  return {
    uniqueSummaryCount: uniqueOpticalSummaries(rows).length,
    totalScored: rows.filter((r) => r.scoreEligible).length,
    archetypeGroups: groups,
    phraseFrequency: phraseFrequency(rows),
  };
}

function toCsv(rows: AuditRow[]): string {
  const headers = [
    "reportNumber",
    "lab",
    "table",
    "depth",
    "crownAngle",
    "pavilionAngle",
    "rawScore",
    "displayScore",
    "overallLabel",
    "confidenceLevel",
    "readState",
    "extractionState",
    "scoreEligible",
    "narrativeCategory",
    "proportionArchetype",
    "parserType",
  ];
  const esc = (v: string | number | boolean | null) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.reportNumber,
        r.lab,
        r.table,
        r.depth,
        r.crownAngle,
        r.pavilionAngle,
        r.rawScore ?? "",
        r.displayScore ?? "",
        r.overallLabel,
        r.confidenceLevel,
        r.readState,
        r.extractionState,
        r.scoreEligible,
        r.narrativeCategory,
        r.proportionArchetype,
        r.parserType,
      ]
        .map(esc)
        .join(","),
    ),
  ];
  return lines.join("\n");
}

async function main(): Promise<void> {
  const expectedOnly = process.argv.includes("--expected-only");
  mkdirSync(OUT_DIR, { recursive: true });

  const manifest = loadManifest();
  const expected = loadExpected();
  const rows: AuditRow[] = [];
  const jewelerReviews: JewelerReview[] = [];

  console.log(`Calibration audit — ${manifest.length} validation reports\n`);

  for (const entry of manifest) {
    console.log(`  ${entry.id} (${entry.lab})…`);
    let fields: CalibrationReportFields;
    let meta = { parserType: "expected", imageOcrMs: 0, routeMs: 0 };

    if (expectedOnly) {
      fields = fieldsFromExpected(expected[entry.id] ?? {}, entry.id);
    } else {
      const extracted = await extractFields(entry);
      fields = extracted.fields;
      meta = {
        parserType: extracted.parserType,
        imageOcrMs: extracted.imageOcrMs,
        routeMs: extracted.routeMs,
        rawTextSnippet: extracted.rawTextSnippet,
      };
    }

    const row = buildAuditRow(entry, fields, meta);
    rows.push(row);
    jewelerReviews.push(buildJewelerReviewExperimental(fields, row));
  }

  const optionalCandidates = [
    "c:/Users/justi/OneDrive/Desktop/360796280.pdf",
    join(process.cwd(), "..", "Desktop", "360796280.pdf"),
  ];
  const optionalPdf = optionalCandidates.find((p) => existsSync(p));
  if (!expectedOnly && optionalPdf) {
    console.log("  LG360796280 (optional local Sarine)…");
    const bytes = readFileSync(optionalPdf);
    const started = Date.now();
    const result = await withTimeout(
      runCalibrationUploadExtraction({
        bytes,
        mime: "application/pdf",
        reportSource: "pdf-upload",
        mode: "client",
        pipelineTimeoutMs: CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
      }),
      CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
      "calibration-audit-360796280",
    );
    const entry: ManifestEntry = {
      id: "LG360796280",
      filename: "360796280.pdf",
      lab: "GCAL",
      notes: "optional local Sarine follow-up",
    };
    const row = buildAuditRow(entry, result.fields, {
      parserType: result.parserType ?? "unknown",
      imageOcrMs: result.timings.imageOcrMs ?? 0,
      routeMs: Date.now() - started,
      rawTextSnippet: result.rawTextSnippet ?? "",
    });
    rows.push(row);
    jewelerReviews.push(buildJewelerReviewExperimental(result.fields, row));
  }

  const analysis = {
    generatedAt: new Date().toISOString(),
    mode: expectedOnly ? "expected-only" : "client-extraction",
    rowCount: rows.length,
    scoreClustering: scoreHistogram(rows),
    topEndCompression: topEndAnalysis(rows),
    narrativeDiversity: narrativeDiversity(rows),
    confidenceAudit: confidenceAudit(rows),
    rankings: rankings(rows),
    recommendations: {
      scoring: topEndAnalysis(rows).recommendations,
      narrative: [
        narrativeDiversity(rows).uniqueSummaryCount <
        rows.filter((r) => r.scoreEligible).length
          ? "Multiple score-eligible reports share identical optical summary templates — diversify trait-driven phrasing before next calibration pass."
          : "Optical summaries differ across reports in this batch.",
        phraseFrequency(rows).find((p) => p.count >= 3)
          ? `High-repeat phrases detected — e.g. "${phraseFrequency(rows)[0]!.phrase}" (${phraseFrequency(rows)[0]!.count}x).`
          : "No phrase repeated 3+ times in this small batch.",
      ],
      confidence: [
        "Confidence is field-driven (measurements + 4 core proportions + finish), not raw score — verify on partial reports.",
        rows.some(
          (r) =>
            r.rawScore !== null &&
            r.rawScore < 80 &&
            r.confidenceLevel === "high",
        )
          ? "Flag: at least one lower-scoring report still has high display confidence — confirm that is data-complete, not score-driven."
          : "No obvious low-score / high-confidence mismatch in this batch.",
      ],
    },
  };

  const comparison = rows.map((r, i) => ({
    reportNumber: r.reportNumber,
    production: {
      scoreHeadline: r.scoreHeadline,
      opticalSummary: r.opticalSummary,
      whatThisMeans: r.whatThisMeans,
      displayScore: r.displayScore,
      confidence: r.confidenceLevel,
    },
    jewelerReviewExperimental: jewelerReviews[i],
  }));

  writeFileSync(join(OUT_DIR, "calibration-audit-rows.json"), JSON.stringify(rows, null, 2));
  writeFileSync(join(OUT_DIR, "calibration-audit-rows.csv"), toCsv(rows));
  writeFileSync(
    join(OUT_DIR, "calibration-audit-analysis.json"),
    JSON.stringify(analysis, null, 2),
  );
  writeFileSync(
    join(OUT_DIR, "calibration-audit-jeweler-comparison.json"),
    JSON.stringify(comparison, null, 2),
  );

  console.log("\n--- Score clustering (display/raw) ---");
  console.log(analysis.scoreClustering);
  console.log("\n--- Top-end compression ---");
  console.log(JSON.stringify(analysis.topEndCompression, null, 2));
  console.log("\n--- Phrase frequency ---");
  for (const p of analysis.narrativeDiversity.phraseFrequency.filter((p) => p.count > 0)) {
    console.log(`  ${p.count}x  ${p.phrase}`);
  }
  console.log(`\nWrote ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
