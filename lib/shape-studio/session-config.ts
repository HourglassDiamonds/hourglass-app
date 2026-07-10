export const SHAPE_STUDIO_CAPTURES_BUCKET = "shape-studio-captures";

/** Pending / unclaimed session lifetime from creation. */
export const SHAPE_STUDIO_SESSION_TTL_MS = 30 * 60 * 1000;

/** Signed retrieval URL lifetime (desktop poll only). */
export const SHAPE_STUDIO_SIGNED_URL_TTL_SEC = 60 * 60;

/**
 * Hard ceiling for unclaimed capture objects (app cleanup cron).
 * Consumed/cancelled objects are deleted immediately by app logic.
 * Supabase Storage lifecycle is NOT verified as enforced — this cron is the
 * repository-guaranteed fallback (≤ 24h).
 */
export const SHAPE_STUDIO_MAX_RETENTION_MS = 24 * 60 * 60 * 1000;

/** Tombstone retention after consume/cancel so the phone can observe status. */
export const SHAPE_STUDIO_TOMBSTONE_TTL_MS = 60 * 60 * 1000;
