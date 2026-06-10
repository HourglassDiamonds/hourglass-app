import { createHash } from "crypto";
import type { ClientSafeInterpretationPayload } from "./client-api";

type CacheEntry = {
  payload: ClientSafeInterpretationPayload;
  cachedAt: number;
};

const MAX_ENTRIES = 24;
const cache = new Map<string, CacheEntry>();

export function hashUploadBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function cacheKey(bytes: Buffer, reportNumber?: string, lab?: string): string {
  const rn = reportNumber?.trim();
  const lb = lab?.trim();
  if (rn && lb) return `v3:report:${lb}:${rn}`;
  return `v3:sha256:${hashUploadBytes(bytes)}`;
}

export function getCachedClientInterpretation(
  bytes: Buffer,
  reportNumber?: string,
  lab?: string,
): ClientSafeInterpretationPayload | null {
  const key = cacheKey(bytes, reportNumber, lab);
  const hit = cache.get(key);
  if (!hit) return null;
  return hit.payload;
}

/** Cache only successful, client-safe payloads — never errors or partial failures. */
export function setCachedClientInterpretation(
  bytes: Buffer,
  payload: ClientSafeInterpretationPayload,
): void {
  if (!payload.capability.canRunClientInterpretation) return;

  const key = cacheKey(
    bytes,
    payload.metadata.reportNumber,
    payload.metadata.lab,
  );
  cache.set(key, { payload, cachedAt: Date.now() });

  if (cache.size <= MAX_ENTRIES) return;
  let oldestKey: string | null = null;
  let oldestAt = Infinity;
  for (const [k, v] of cache) {
    if (v.cachedAt < oldestAt) {
      oldestAt = v.cachedAt;
      oldestKey = k;
    }
  }
  if (oldestKey) cache.delete(oldestKey);
}

export function clearClientInterpretCache(): void {
  cache.clear();
}
