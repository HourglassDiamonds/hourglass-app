/**
 * Safe change math and noise guards for measurement evidence.
 * Avoids false precision from tiny denominators and ordinary daily variance.
 */

export type ChangeAssessment = {
  absoluteChange: number | null;
  percentChange: number | null;
  /** True when percentage claims are unsafe (zero/tiny prior, or null). */
  percentClaimSafe: boolean;
  /** True when sample is too small for founder-priority ranking. */
  smallSample: boolean;
  /** True when absolute move is within ordinary noise band. */
  ordinaryNoise: boolean;
  summary: string;
};

export type ChangeMathOptions = {
  /** Minimum prior value required before percent change is claimed. */
  minPriorForPercent?: number;
  /** Absolute change below this is treated as ordinary noise when sample is small. */
  ordinaryNoiseAbsolute?: number;
  /** Percent magnitude below this (when claim-safe) is ordinary noise. */
  ordinaryNoisePercent?: number;
  /** Prior+current combined volume below this → small sample. */
  smallSampleCombined?: number;
  metricKind?: "count" | "rate" | "position";
};

const DEFAULTS: Required<Omit<ChangeMathOptions, "metricKind">> & {
  metricKind: "count" | "rate" | "position";
} = {
  minPriorForPercent: 20,
  ordinaryNoiseAbsolute: 5,
  ordinaryNoisePercent: 8,
  smallSampleCombined: 40,
  metricKind: "count",
};

export function assessChange(
  current: number,
  previous: number | null | undefined,
  options: ChangeMathOptions = {},
): ChangeAssessment {
  const opts = { ...DEFAULTS, ...options };
  if (previous == null || !Number.isFinite(previous) || !Number.isFinite(current)) {
    return {
      absoluteChange: null,
      percentChange: null,
      percentClaimSafe: false,
      smallSample: true,
      ordinaryNoise: true,
      summary: "comparison unavailable",
    };
  }

  const absoluteChange = current - previous;
  const combined = Math.abs(current) + Math.abs(previous);
  const smallSample = combined < opts.smallSampleCombined;

  let percentChange: number | null = null;
  let percentClaimSafe = false;

  if (opts.metricKind === "position") {
    // Average position: prefer absolute movement; percent is often misleading.
    percentClaimSafe = false;
    percentChange = null;
  } else if (opts.metricKind === "rate") {
    // Rates (0–1 or 0–100): absolute pp change is preferred; % of rate only if prior meaningful.
    if (Math.abs(previous) >= 0.05) {
      percentChange = ((current - previous) / Math.abs(previous)) * 100;
      percentClaimSafe = true;
    }
  } else if (Math.abs(previous) >= opts.minPriorForPercent) {
    percentChange = ((current - previous) / Math.abs(previous)) * 100;
    percentClaimSafe = true;
  } else if (previous === 0 && current === 0) {
    percentChange = 0;
    percentClaimSafe = true;
  } else {
    percentChange = null;
    percentClaimSafe = false;
  }

  const ordinaryNoise =
    smallSample ||
    Math.abs(absoluteChange) <= opts.ordinaryNoiseAbsolute ||
    (percentClaimSafe &&
      percentChange != null &&
      Math.abs(percentChange) < opts.ordinaryNoisePercent);

  const summary = formatChangeSummary({
    absoluteChange,
    percentChange,
    percentClaimSafe,
    smallSample,
    ordinaryNoise,
    metricKind: opts.metricKind,
  });

  return {
    absoluteChange,
    percentChange,
    percentClaimSafe,
    smallSample,
    ordinaryNoise,
    summary,
  };
}

function formatChangeSummary(input: {
  absoluteChange: number;
  percentChange: number | null;
  percentClaimSafe: boolean;
  smallSample: boolean;
  ordinaryNoise: boolean;
  metricKind: "count" | "rate" | "position";
}): string {
  if (input.ordinaryNoise) {
    return input.smallSample
      ? "small-sample / ordinary variance"
      : "within ordinary variance";
  }
  const abs = `${input.absoluteChange > 0 ? "+" : ""}${roundNice(input.absoluteChange)}`;
  if (input.metricKind === "position") {
    return `${abs} positions`;
  }
  if (input.percentClaimSafe && input.percentChange != null) {
    const pct = `${input.percentChange > 0 ? "+" : ""}${roundNice(input.percentChange)}%`;
    return `${abs}, ${pct}`;
  }
  return `${abs} (percent suppressed — tiny prior)`;
}

function roundNice(n: number): number {
  if (Math.abs(n) >= 10) return Math.round(n);
  return Math.round(n * 10) / 10;
}

/**
 * Safe percent helper compatible with existing deltaPercentage call sites.
 * Returns null when prior is zero/tiny rather than Infinity.
 */
export function safePercentChange(
  current: number,
  previous: number,
  minPrior = 20,
): number | null {
  return assessChange(current, previous, { minPriorForPercent: minPrior })
    .percentChange;
}

/** Whether a GSC row should be suppressed from founder-priority surfacing. */
export function shouldSuppressGscRowForFounderPriority(input: {
  impressions: number;
  clicks: number;
  positionDelta?: number | null;
}): boolean {
  if (input.impressions < 80 || input.clicks < 10) return true;
  if (
    input.positionDelta != null &&
    Math.abs(input.positionDelta) < 1.5 &&
    input.impressions < 300
  ) {
    return true;
  }
  return false;
}

/** Deduplicate evidence strings / gap ids preserving first occurrence. */
export function dedupeStable<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Founder-facing judgment for a measured change.
 * Used at the synthesis / rendering boundary — not only in adapters.
 */
export type ChangeJudgment =
  | "suppress"
  | "qualify"
  | "state-normally"
  | "elevate-as-material";

export function judgeChange(assessment: ChangeAssessment): ChangeJudgment {
  if (assessment.absoluteChange == null && assessment.percentChange == null) {
    return "suppress";
  }
  if (assessment.smallSample && !assessment.percentClaimSafe) {
    return "suppress";
  }
  if (assessment.ordinaryNoise || assessment.smallSample) {
    return "qualify";
  }
  if (
    assessment.percentClaimSafe &&
    assessment.percentChange != null &&
    Math.abs(assessment.percentChange) >= 20 &&
    assessment.absoluteChange != null &&
    Math.abs(assessment.absoluteChange) >= 30
  ) {
    return "elevate-as-material";
  }
  if (assessment.percentClaimSafe) {
    return "state-normally";
  }
  return "qualify";
}

/**
 * Founder-facing metric line: absolute current value + guarded change language.
 * Prefer this over raw percentage deltas when writing What-changed copy.
 */
export function formatFounderMetricChange(
  label: string,
  current: number,
  previous: number | null | undefined,
  options: ChangeMathOptions & {
    formatCurrent?: (n: number) => string;
  } = {},
): string {
  const { formatCurrent, ...mathOpts } = options;
  const cur = formatCurrent ? formatCurrent(current) : String(Math.round(current));
  const assessment = assessChange(current, previous, mathOpts);
  const judgment = judgeChange(assessment);

  if (judgment === "suppress") {
    if (previous == null || !Number.isFinite(previous)) {
      return `${label} ${cur} (comparison unavailable)`;
    }
    return `${label} ${cur} (volume too limited for percent claims)`;
  }
  if (judgment === "qualify") {
    return `${label} ${cur} (${assessment.summary}; treat as directional only)`;
  }
  return `${label} ${cur} (${assessment.summary})`;
}
