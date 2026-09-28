/** Foreground requests use an explicit allowlist. Default remains GPT-5.6 Sol. */
export const CONCIERGE_FOREGROUND_BRAIN = "sol" as const;
export const CONCIERGE_FOREGROUND_MODEL = "gpt-5.6-sol" as const;
export const CONCIERGE_FOREGROUND_MODEL_ALIAS = "gpt-5.6" as const;
export const CONCIERGE_FOREGROUND_MODELS = ["gpt-5.6-sol", "gpt-6-sol"] as const;
export type ConciergeForegroundModelId = (typeof CONCIERGE_FOREGROUND_MODELS)[number];
export const CONCIERGE_BACKGROUND_MODEL_SEAM = "continuum-background" as const;
export const CONCIERGE_SOL_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses" as const;

export function isConciergeForegroundModel(value: unknown): value is ConciergeForegroundModelId {
  return value === "gpt-5.6-sol" || value === "gpt-6-sol";
}

export function conciergeForegroundModel(envModel?: string | null): ConciergeForegroundModelId {
  const trimmed = envModel?.trim() ?? "";
  if (/astra/i.test(trimmed)) return CONCIERGE_FOREGROUND_MODEL;
  if (trimmed === CONCIERGE_FOREGROUND_MODEL_ALIAS) return CONCIERGE_FOREGROUND_MODEL;
  return isConciergeForegroundModel(trimmed) ? trimmed : CONCIERGE_FOREGROUND_MODEL;
}

export function isApprovedSolModel(model: string | null | undefined): boolean {
  const trimmed = model?.trim() ?? "";
  return isConciergeForegroundModel(trimmed) || trimmed === CONCIERGE_FOREGROUND_MODEL_ALIAS;
}

export function isForegroundReasoningWork(kind: "lookup" | "format" | "calculate" | "reason"): boolean {
  return kind === "reason";
}
