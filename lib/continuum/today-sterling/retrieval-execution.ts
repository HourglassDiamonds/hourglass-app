export const STERLING_GMAIL_REQUEST_BUDGET = 48;

function uniqueThreadIds(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

/** Freezes planner output at the Gmail boundary. */
export function finalizeSterlingGmailExecution(input: {
  selectedLiveThreadIds: readonly string[];
  budgetDeferredThreadIds: readonly string[];
  targetThreadIds?: readonly string[];
  requestBudget?: number;
}): { scheduledThreadIds: readonly string[]; budgetDeferredThreadIds: readonly string[] } {
  const budget = Math.max(0, Math.floor(input.requestBudget ?? STERLING_GMAIL_REQUEST_BUDGET));
  const scheduledThreadIds = uniqueThreadIds(input.selectedLiveThreadIds);
  if (scheduledThreadIds.length > budget) throw new Error("sterling-gmail-selected-set-exceeds-budget");

  const scheduled = new Set(scheduledThreadIds);
  const targetThreadIds = uniqueThreadIds(input.targetThreadIds ?? []);
  if (targetThreadIds.length > budget) throw new Error("sterling-target-required-evidence-exceeds-budget");
  if (targetThreadIds.some((threadId) => !scheduled.has(threadId))) {
    throw new Error("sterling-target-required-thread-not-scheduled");
  }

  return {
    scheduledThreadIds,
    budgetDeferredThreadIds: uniqueThreadIds(input.budgetDeferredThreadIds)
      .filter((threadId) => !scheduled.has(threadId)),
  };
}
