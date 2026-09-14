/**
 * Server-only Concierge Sol env. Never expose via NEXT_PUBLIC_*.
 */

function trimmed(value: string | undefined): string | undefined {
  const next = value?.trim();
  return next || undefined;
}

export function getConciergeOpenAiApiKey(): string | undefined {
  return trimmed(process.env.OPENAI_API_KEY);
}

export function getConciergeForegroundModelOverride(): string | undefined {
  return trimmed(process.env.CONTINUUM_CONCIERGE_MODEL);
}

export function assertConciergeSecretsNotPublic(): void {
  if (typeof window !== "undefined") return;
  if (trimmed(process.env.NEXT_PUBLIC_OPENAI_API_KEY)) {
    throw new Error(
      "[hourglass:security] OPENAI_API_KEY must not use NEXT_PUBLIC_ — server-only.",
    );
  }
}
