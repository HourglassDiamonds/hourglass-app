import { createHash } from "node:crypto";

export const TODAY_SNAPSHOT_PUBLISHED_EVENT =
  "continuum.today.snapshot_published" as const;

type TimedSource = { ref: string; at: number };

function digest(value: string): string {
  return createHash("sha256")
    .update("continuum:today-publication:v1\0")
    .update(value)
    .digest("hex")
    .slice(0, 20);
}

function timestampIn(row: Record<string, unknown>): number | null {
  for (const key of ["timestamp", "at"]) {
    if (typeof row[key] !== "string") continue;
    const value = Date.parse(row[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

/** Extract only opaque source identities and timestamps; never content or people. */
export function latestTodaySourceDigests(payload: unknown): string[] {
  const found: TimedSource[] = [];
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    const row = value as Record<string, unknown>;
    const at = timestampIn(row);
    if (at !== null) {
      for (const key of ["sourceRef", "sourceHref", "candidateId"]) {
        const ref = row[key];
        if (typeof ref === "string" && ref.trim()) found.push({ ref, at });
      }
    }
    for (const child of Object.values(row)) visit(child);
  };
  visit(payload);
  const newestByRef = new Map<string, number>();
  for (const { ref, at } of found) {
    newestByRef.set(ref, Math.max(at, newestByRef.get(ref) ?? 0));
  }
  return [...newestByRef]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 24)
    .map(([ref]) => digest(ref));
}

export function emitTodaySnapshotPublished(input: {
  sourceWatermark: string;
  composedAt: string;
  payload: unknown;
  publishedAt?: string;
}): void {
  console.info(
    JSON.stringify({
      event: TODAY_SNAPSHOT_PUBLISHED_EVENT,
      publishedAt: input.publishedAt ?? new Date().toISOString(),
      composedAt: input.composedAt,
      sourceWatermarkDigest: digest(input.sourceWatermark),
      latestSourceDigests: latestTodaySourceDigests(input.payload),
    }),
  );
}
