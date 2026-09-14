/**
 * Model routing seams. Sol is the default foreground Concierge brain.
 * Cheaper models remain available for later background work.
 */

export const CONCIERGE_FOREGROUND_BRAIN = "sol" as const;
export const CONCIERGE_FOREGROUND_MODEL = "gpt-5.6-sol" as const;
export const CONCIERGE_FOREGROUND_MODEL_ALIAS = "gpt-5.6" as const;
export const CONCIERGE_BACKGROUND_MODEL_SEAM = "continuum-background" as const;
export const CONCIERGE_SOL_RESPONSES_ENDPOINT =
  "https://api.openai.com/v1/responses" as const;

export function conciergeForegroundModel(
  envModel?: string | null,
): string {
  const trimmed = envModel?.trim() ?? "";
  if (!trimmed) return CONCIERGE_FOREGROUND_MODEL;
  if (/astra/i.test(trimmed)) return CONCIERGE_FOREGROUND_MODEL;
  if (trimmed === CONCIERGE_FOREGROUND_MODEL_ALIAS) return CONCIERGE_FOREGROUND_MODEL;
  return trimmed;
}

export function isApprovedSolModel(model: string | null | undefined): boolean {
  const trimmed = model?.trim() ?? "";
  return (
    trimmed === CONCIERGE_FOREGROUND_MODEL ||
    trimmed === CONCIERGE_FOREGROUND_MODEL_ALIAS ||
    trimmed.startsWith(`${CONCIERGE_FOREGROUND_MODEL}-`) ||
    trimmed.startsWith(`${CONCIERGE_FOREGROUND_MODEL_ALIAS}-`)
  );
}

export function isForegroundReasoningWork(kind: "lookup" | "format" | "calculate" | "reason"): boolean {
  return kind === "reason";
}
