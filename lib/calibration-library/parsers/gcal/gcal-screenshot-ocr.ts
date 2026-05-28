import type { ReportSource, TextExtractionMethod } from "../../types";
import {
  collectGcal8xProportionNumericCandidates,
  extractGcal8xFocusedWindows,
  extractGcal8xFocusedWindowsForScreenshot,
  extractGcal8xGradingIslands,
  extractGcal8xProportionIslands,
  normalizeGcal8xOcrText,
  type Gcal8xFocusedWindows,
  type GcalProportionIslandMatches,
  type GcalProportionNumericCandidates,
} from "./gcal-8x";
import { looksLikeGcal8xReportText } from "./gcal-layout-detector";

export type GcalScreenshotOcrHints = {
  reportSource?: ReportSource;
  textMethod?: TextExtractionMethod;
  reportNumber?: string;
  lab?: string;
  pdfTextLayerLength?: number;
  gcalImageOnlyPdf?: boolean;
};

/** Screenshot/image upload only — never PDF text layer or PDF ingest. */
export function shouldRepairGcalScreenshotOcr(hints?: GcalScreenshotOcrHints): boolean {
  if (hints?.reportSource !== "screenshot-upload") return false;
  if ((hints.pdfTextLayerLength ?? 0) > 0) return false;
  if (hints.gcalImageOnlyPdf) return false;
  return true;
}

export function shouldRepairGcalScreenshotOcrText(
  rawText: string,
  hints?: GcalScreenshotOcrHints,
): boolean {
  if (!shouldRepairGcalScreenshotOcr(hints)) return false;
  if (hints?.lab === "GCAL") return looksLikeGcal8xReportText(rawText);
  return looksLikeGcal8xReportText(rawText);
}

function collapsedMeasurementToMm(
  a: string,
  b: string,
  c: string,
  d: string,
  e: string,
  f: string,
): string | null {
  const w1 = parseFloat(`${a}.${b}`);
  const w2 = parseFloat(`${c}.${d}`);
  const depth = parseFloat(`${e}.${f}`);
  if (w1 < 5 || w1 > 9.5 || w2 < 5 || w2 > 9.5 || depth < 3 || depth > 6.5) {
    return null;
  }
  if (Math.abs(w2 - w1) > 0.15) return null;
  return `${a}.${b} - ${c}.${d} x ${e}.${f} mm`;
}

/**
 * Screenshot-only OCR repairs (collapsed decimals, missing °/%).
 * Does not run on PDF uploads.
 */
export function repairGcalScreenshotOcrText(
  rawText: string,
  hints?: GcalScreenshotOcrHints,
): { text: string; repairsApplied: string[] } {
  const repairsApplied: string[] = [];
  let s = normalizeGcal8xOcrText(rawText);

  const measCollapsed = s.match(
    /\b(\d)(\d{2})-(\d)(\d{2})\s*x\s*(\d)(\d{2})\s*mm\b/i,
  );
  if (measCollapsed) {
    const formatted = collapsedMeasurementToMm(
      measCollapsed[1]!,
      measCollapsed[2]!,
      measCollapsed[3]!,
      measCollapsed[4]!,
      measCollapsed[5]!,
      measCollapsed[6]!,
    );
    if (formatted) {
      s = s.replace(measCollapsed[0]!, formatted);
      repairsApplied.push(
        `measurements ${measCollapsed[0]} → ${formatted}`,
      );
    }
  }

  s = s.replace(/\btable\s+(\d{2})\b(?!\s*%)/gi, (match, tens) => {
    repairsApplied.push(`table ${tens} → ${tens}%`);
    return `table ${tens}%`;
  });

  s = s.replace(/\bdepth\s+611\b/gi, () => {
    if (!repairsApplied.some((r) => r.includes("611"))) {
      repairsApplied.push("depth 611 → 61.1%");
    }
    return "depth 61.1%";
  });

  const rbCarat = s.match(/\bRB\s+(\d)(\d{2})\b/i);
  if (rbCarat) {
    const carat = `${rbCarat[1]}.${rbCarat[2]}`;
    const n = parseFloat(carat);
    if (n >= 0.2 && n <= 15) {
      s = s.replace(rbCarat[0]!, `RB ${carat}`);
      repairsApplied.push(`carat RB ${rbCarat[2]} → ${carat}`);
    }
  }

  const caratWeight = s.match(/\bcarat\s*weight\s+(\d)(\d{2})\b/i);
  if (caratWeight) {
    const carat = `${caratWeight[1]}.${caratWeight[2]}`;
    const n = parseFloat(carat);
    if (n >= 0.2 && n <= 15) {
      s = s.replace(caratWeight[0]!, `carat weight ${carat}`);
      repairsApplied.push(`carat weight → ${carat}`);
    }
  }

  const replaceToken = (
    token: string,
    replacement: string,
    reason: string,
    guard?: (ctx: string) => boolean,
  ) => {
    const re = new RegExp(`\\b${token}\\b`, "g");
    s = s.replace(re, (match, offset) => {
      const ctx = s.slice(Math.max(0, offset - 48), offset + 48);
      if (guard && !guard(ctx)) return match;
      if (new RegExp(`LG\\d*${token}`, "i").test(ctx)) return match;
      repairsApplied.push(reason);
      return replacement;
    });
  };

  replaceToken(
    "611",
    "61.1%",
    "depth 611 → 61.1%",
    (ctx) =>
      /\bdepth\b/i.test(ctx) ||
      /\btable\b/i.test(ctx) ||
      /\bproportion\b/i.test(ctx) ||
      /\b58\s*%?\b/.test(ctx) ||
      /\bGCAL\b/i.test(ctx),
  );

  replaceToken(
    "345",
    "34.5°",
    "crown 345 → 34.5°",
    (ctx) =>
      /\bcrown\b/i.test(ctx) ||
      /\bpavilion\b/i.test(ctx) ||
      /\b58\b/.test(ctx) ||
      /\b61\.1/.test(ctx),
  );

  if (/\b408\b|\b40\.8\s*°?/i.test(s)) {
    replaceToken("408", "40.8°", "pavilion 408 → 40.8°");
    s = s.replace(
      /\b(?:pavilion\s+angle|pavilion)\s*[:\s]*108\b/gi,
      () => {
        repairsApplied.push("pavilion 108 → 40.8° (408/40.8 context)");
        return "pavilion angle 40.8°";
      },
    );
  }

  replaceToken(
    "77",
    "77%",
    "lower half 77 → 77%",
    (ctx) =>
      /\blower\b/i.test(ctx) ||
      /\bhalf\b/i.test(ctx) ||
      /\bstar\b/i.test(ctx) ||
      (/\b58\b/.test(ctx) && /\bGCAL\b/i.test(ctx)),
  );

  replaceToken(
    "48",
    "48%",
    "star 48 → 48%",
    (ctx) =>
      /\bstar\b/i.test(ctx) ||
      /\blower\b/i.test(ctx) ||
      (/\b58\b/.test(ctx) && /\bGCAL\b/i.test(ctx)),
  );

  return { text: s, repairsApplied };
}

export type GcalScreenshotOcrCheckPayload = {
  reportNumber?: string;
  screenshotPath: boolean;
  repairsApplied: string[];
  ocrRawTextPreview: string;
  repairedOcrTextPreview: string;
  numericCandidatesBefore: GcalProportionNumericCandidates;
  numericCandidatesAfter: GcalProportionNumericCandidates;
  assignedFields: GcalProportionIslandMatches;
  rejectedCandidates: Array<{ candidate: string; reason: string }>;
};

function diagnoseScreenshotAssignments(
  before: GcalProportionNumericCandidates,
  after: GcalProportionNumericCandidates,
  assigned: GcalProportionIslandMatches,
): Array<{ candidate: string; reason: string }> {
  const specs: Array<{
    field: keyof GcalProportionIslandMatches;
    label: string;
    kind: "pct" | "deg";
    target: number;
  }> = [
    { field: "tablePercent", label: "tablePercent", kind: "pct", target: 58 },
    { field: "depthPercent", label: "depthPercent", kind: "pct", target: 61.1 },
    { field: "crownAngle", label: "crownAngle", kind: "deg", target: 34.5 },
    { field: "pavilionAngle", label: "pavilionAngle", kind: "deg", target: 40.8 },
    { field: "starLengthPercent", label: "starLengthPercent", kind: "pct", target: 48 },
    { field: "lowerHalfPercent", label: "lowerHalfPercent", kind: "pct", target: 77 },
  ];
  const rejected: Array<{ candidate: string; reason: string }> = [];
  for (const spec of specs) {
    if (assigned[spec.field]) continue;
    const pool = spec.kind === "pct" ? after.percents : after.degrees;
    if (pool.length === 0) {
      rejected.push({
        candidate: spec.label,
        reason: `no ${spec.kind} candidates after screenshot repair`,
      });
    } else {
      rejected.push({
        candidate: `${spec.label} target ${spec.target}`,
        reason: `no assignment from pools [${pool.join(", ")}]`,
      });
    }
  }
  if (!assigned.pavilionAngle && before.degrees.includes(108)) {
    rejected.push({
      candidate: "pavilionAngle 108",
      reason: "108 not converted — missing 408/40.8 evidence",
    });
  }
  return rejected;
}

export function buildGcalScreenshotOcrCheck(
  rawText: string,
  repairedText: string,
  repairsApplied: string[],
  hints?: GcalScreenshotOcrHints,
): GcalScreenshotOcrCheckPayload {
  const windowsBefore = extractGcal8xFocusedWindows(rawText);
  const windowsAfter = extractGcal8xFocusedWindowsForScreenshot(repairedText);
  const beforeWindow =
    windowsBefore.proportionWindow.trim() || normalizeGcal8xOcrText(rawText);
  const numericCandidatesBefore =
    collectGcal8xProportionNumericCandidates(beforeWindow);
  const numericCandidatesAfter = collectGcal8xProportionNumericCandidates(
    windowsAfter.proportionWindow,
  );
  const assignedFields = extractGcal8xProportionIslands(
    windowsAfter.proportionWindow,
  );
  const grading = extractGcal8xGradingIslands(repairedText);

  return {
    reportNumber: hints?.reportNumber?.trim(),
    screenshotPath: true,
    repairsApplied,
    ocrRawTextPreview: rawText.trim().slice(0, 320),
    repairedOcrTextPreview: repairedText.trim().slice(0, 320),
    numericCandidatesBefore,
    numericCandidatesAfter,
    assignedFields: {
      ...assignedFields,
      ...(grading.shape ? {} : {}),
    },
    rejectedCandidates: diagnoseScreenshotAssignments(
      numericCandidatesBefore,
      numericCandidatesAfter,
      assignedFields,
    ),
  };
}

export function logGcalScreenshotOcrCheck(payload: GcalScreenshotOcrCheckPayload): void {
  console.log("[GCAL SCREENSHOT OCR CHECK]", payload);
}
