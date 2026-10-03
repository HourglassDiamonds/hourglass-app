export const STERLING_PROPOSALS_TABLE = "continuum_sterling_proposals" as const;

export type SterlingLedgerActivation = "activated" | "not-activated" | "unavailable";

export function sterlingLedgerStateFromError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): SterlingLedgerActivation | null {
  if (!error) return null;
  const code = error.code?.trim() ?? "";
  const message = error.message?.toLowerCase() ?? "";
  if (code === "42P01" || code === "PGRST205") return "not-activated";
  if (message.includes(STERLING_PROPOSALS_TABLE) && (
    message.includes("does not exist") || message.includes("schema cache") || message.includes("could not find")
  )) return "not-activated";
  return null;
}

export type SterlingLedgerProbeClient = {
  from: (table: string) => {
    select: (columns: string) => {
      limit: (count: number) => PromiseLike<{ error: { code?: string; message?: string } | null }>;
    };
  };
};

export async function probeSterlingLedger(
  client: SterlingLedgerProbeClient | null,
): Promise<SterlingLedgerActivation> {
  if (!client) return "unavailable";
  try {
    const { error } = await client.from(STERLING_PROPOSALS_TABLE).select("proposal_id").limit(1);
    const missing = sterlingLedgerStateFromError(error);
    if (missing) return missing;
    return error ? "unavailable" : "activated";
  } catch {
    return "unavailable";
  }
}
