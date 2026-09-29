export type TodayRecomputeEvaluation = {
  evaluationTime: Date;
  watermark: string | null;
};

/** Captures one logical clock and uses it for both source state and eligibility. */
export async function beginTodayRecomputeAttempt(
  readWatermark: (evaluationTime: Date) => Promise<string | null>,
  clock: () => Date = () => new Date(),
): Promise<TodayRecomputeEvaluation> {
  const evaluationTime = clock();
  return {
    evaluationTime,
    watermark: await readWatermark(evaluationTime),
  };
}
