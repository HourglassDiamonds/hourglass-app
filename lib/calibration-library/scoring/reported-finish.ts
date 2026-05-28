/**
 * Lab-neutral scoring for finish lines exactly as reported (v1).
 * Same interpretation for GIA, GCAL, AGS, IGI, and Other — no reputation weighting.
 */

export type FinishScore = {
  score: number;
  note: string;
};

function normalizeFinishText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Maps reported polish/symmetry wording to a neutral calibration score. */
export function scoreReportedGradeLine(value: string): FinishScore {
  const v = normalizeFinishText(value);
  if (!v) return { score: 0, note: "Missing — enter as on report" };

  if (/\bexcellent\b/.test(v) || v === "ex" || v === "ideal") {
    return { score: 100, note: "Reported excellent (neutral scale)" };
  }
  if (/\bvery\s*good\b/.test(v) || v === "vg") {
    return { score: 88, note: "Reported very good (neutral scale)" };
  }
  if (/\bgood\b/.test(v)) {
    return { score: 75, note: "Reported good (neutral scale)" };
  }
  if (/\bfair\b/.test(v)) {
    return { score: 58, note: "Reported fair (neutral scale)" };
  }
  if (/\bpoor\b/.test(v)) {
    return { score: 40, note: "Reported poor (neutral scale)" };
  }
  return { score: 70, note: "Non-standard wording — verify on report" };
}

export function scoreReportedFluorescence(value: string): FinishScore {
  const v = normalizeFinishText(value);
  if (!v) return { score: 0, note: "Missing — enter as on report" };

  if (v === "none" || v === "nil" || v.includes("no fluorescence")) {
    return { score: 100, note: "Reported none" };
  }
  if (v.includes("negligible") || v.includes("faint") || v.includes("very slight")) {
    return { score: 92, note: "Reported faint / negligible" };
  }
  if (v.includes("medium") || v.includes("moderate")) {
    return { score: 72, note: "Reported medium" };
  }
  if (v.includes("strong") || v.includes("very strong")) {
    return { score: 50, note: "Reported strong fluorescence" };
  }
  return { score: 80, note: "Non-standard wording — verify on report" };
}

export function scoreReportedCulet(value: string): FinishScore {
  const v = normalizeFinishText(value);
  if (!v) return { score: 0, note: "Missing — enter as on report" };

  if (v.includes("none") || v.includes("pointed") || v === "—" || v === "-") {
    return { score: 100, note: "Reported none / pointed" };
  }
  if (v.includes("very small") || v.includes("v.small") || v === "vs") {
    return { score: 95, note: "Reported very small" };
  }
  if (v.includes("small") && !v.includes("very")) {
    return { score: 90, note: "Reported small" };
  }
  if (v.includes("medium") || v === "med") {
    return { score: 72, note: "Reported medium" };
  }
  if (v.includes("large") || v.includes("very large")) {
    return { score: 48, note: "Reported large culet" };
  }
  return { score: 78, note: "Non-standard wording — verify on report" };
}

export function scoreReportedGirdle(value: string): FinishScore {
  const v = normalizeFinishText(value);
  if (!v) return { score: 0, note: "Missing — enter as on report" };

  if (v.includes("extremely thin") || v.includes("extremely thick")) {
    return { score: 55, note: "Reported extreme girdle — review proportions" };
  }
  if (v.includes("very thin") || v.includes("very thick")) {
    return { score: 70, note: "Reported very thin / very thick" };
  }
  if (
    v.includes("medium") ||
    v.includes("slightly thin") ||
    v.includes("slightly thick") ||
    v.includes("thin to medium") ||
    v.includes("medium to slightly")
  ) {
    return { score: 90, note: "Reported moderate girdle range" };
  }
  if (v.includes("thin") || v.includes("thick")) {
    return { score: 82, note: "Reported thin / thick girdle" };
  }
  if (v.includes("faceted")) {
    return { score: 88, note: "Reported faceted girdle" };
  }
  return { score: 78, note: "Non-standard wording — verify on report" };
}
