/**
 * Candidate durable-storage activation.
 * continuum_candidates SQL is UNAPPLIED. Production-intended #19 must fail
 * closed rather than fall back to ephemeral in-memory review state.
 */

export const CONTINUUM_CANDIDATES_TABLE = "continuum_candidates" as const;

export const CANDIDATE_STORAGE_NOT_ACTIVATED_MESSAGE =
  "Candidate storage not activated" as const;

export type CandidateStorageActivation =
  | "activated"
  | "not-activated"
  | "unavailable";

export function candidateStorageStateFromError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): CandidateStorageActivation | null {
  if (!error) return null;
  const code = (error.code ?? "").trim();
  const message = (error.message ?? "").toLowerCase();
  if (code === "42P01" || code === "PGRST205") return "not-activated";
  if (
    message.includes("continuum_candidates") &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("could not find"))
  ) {
    return "not-activated";
  }
  return null;
}

export type CandidateStorageProbeClient = {
  from: (table: string) => {
    select: (columns: string) => {
      limit: (count: number) => PromiseLike<{
        error: { code?: string; message?: string } | null;
      }>;
    };
  };
};

export async function probeCandidateStorage(
  client: CandidateStorageProbeClient | null,
): Promise<CandidateStorageActivation> {
  if (!client) return "unavailable";
  try {
    const { error } = await client
      .from(CONTINUUM_CANDIDATES_TABLE)
      .select("candidate_id")
      .limit(1);
    const missing = candidateStorageStateFromError(error);
    if (missing) return missing;
    if (error) return "unavailable";
    return "activated";
  } catch {
    return "unavailable";
  }
}
