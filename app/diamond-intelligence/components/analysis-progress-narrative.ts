/** Presentation-only copy and timing for the analysis progress narrative. */

export type AnalysisProgressMessage = {
  headline: string;
  body: string;
};

export const ANALYSIS_PROGRESS_STATES: readonly AnalysisProgressMessage[] = [
  {
    headline: "Reviewing report structure",
    body: "Identifying laboratory format and report type.",
  },
  {
    headline: "Extracting report details",
    body: "Reading measurements, grades, and proportion data.",
  },
  {
    headline: "Evaluating light performance",
    body: "Assessing reported proportions and optical indicators.",
  },
  {
    headline: "Building interpretation",
    body: "Preparing an independent performance read.",
  },
] as const;

export const ANALYSIS_PROGRESS_LONG_DURATION: AnalysisProgressMessage = {
  headline: "Some reports require additional verification",
  body: "Please keep this page open while analysis completes.",
};

export const ANALYSIS_PROGRESS_EDUCATION = {
  title: "Why it takes a moment",
  body: "Unlike a simple grade lookup, Diamond Intelligence reviews reported proportions, finish characteristics, and laboratory data to prepare an independent interpretation.",
} as const;

/** Rotate every 3–5 seconds — fixed midpoint for a calm, predictable cadence. */
export const ANALYSIS_PROGRESS_ROTATION_MS = 4_000;

export const ANALYSIS_PROGRESS_LONG_DURATION_MS = 30_000;

export const ANALYSIS_PROGRESS_FADE_MS = 400;

export function nextAnalysisProgressIndex(
  currentIndex: number,
  stateCount = ANALYSIS_PROGRESS_STATES.length,
): number {
  return (currentIndex + 1) % stateCount;
}

export function shouldShowLongDurationAnalysisMessage(
  elapsedMs: number,
): boolean {
  return elapsedMs >= ANALYSIS_PROGRESS_LONG_DURATION_MS;
}
