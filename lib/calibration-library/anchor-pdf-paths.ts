import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { CalibrationLab } from "./types";

export type AnchorPdfSpec = {
  reportNumber: string;
  lab: CalibrationLab;
  scenarioId: string;
  filenameHints: string[];
};

export const ANCHOR_PDF_SPECS: AnchorPdfSpec[] = [
  {
    reportNumber: "LG353466126",
    lab: "GCAL",
    scenarioId: "live-gcal-8x-LG353466126",
    filenameHints: ["LG353466126", "353466126"],
  },
  {
    reportNumber: "LG360796191",
    lab: "GCAL",
    scenarioId: "live-gcal-sarine-LG360796191",
    filenameHints: ["LG360796191", "G1360796191", "360796191"],
  },
  {
    reportNumber: "LG773657228",
    lab: "IGI",
    scenarioId: "live-igi-LG773657228",
    filenameHints: ["LG773657228"],
  },
  {
    reportNumber: "2527039693",
    lab: "GIA",
    scenarioId: "live-gia-2527039693",
    filenameHints: ["2527039693", "GIA2527039693"],
  },
];

const DEFAULT_ANCHOR_DIRS = [
  join(process.cwd(), "data", "light-performance-calibration", "anchor-pdfs"),
  join(process.cwd(), "data", "light-performance-calibration", "uploads"),
];

function listPdfFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .map((f) => join(dir, f));
}

function scorePdfMatch(filename: string, hints: string[]): number {
  const lower = filename.toLowerCase();
  let score = 0;
  for (const hint of hints) {
    if (lower.includes(hint.toLowerCase())) score += 10;
  }
  return score;
}

/** Resolve newest matching anchor PDF under configured directories. */
export function resolveAnchorPdfPath(
  spec: AnchorPdfSpec,
  searchDirs?: string[],
): string | null {
  const dirs = searchDirs ?? [
    process.env.CALIBRATION_ANCHOR_PDF_DIR,
    ...DEFAULT_ANCHOR_DIRS,
  ].filter((d): d is string => Boolean(d));

  let best: { path: string; mtime: number; score: number } | null = null;

  for (const dir of dirs) {
    for (const filePath of listPdfFiles(dir)) {
      const base = filePath.split(/[/\\]/).pop() ?? "";
      const score = scorePdfMatch(base, spec.filenameHints);
      if (score <= 0) continue;
      const mtime = statSync(filePath).mtimeMs;
      if (!best || score > best.score || (score === best.score && mtime > best.mtime)) {
        best = { path: filePath, mtime, score };
      }
    }
  }

  return best?.path ?? null;
}

export function resolveAllAnchorPdfPaths(
  searchDirs?: string[],
): { spec: AnchorPdfSpec; path: string | null }[] {
  return ANCHOR_PDF_SPECS.map((spec) => ({
    spec,
    path: resolveAnchorPdfPath(spec, searchDirs),
  }));
}
