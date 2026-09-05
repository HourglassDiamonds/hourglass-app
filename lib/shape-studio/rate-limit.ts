import { consumeRateLimitWindows } from "@/lib/security/abuse-rate-limit";
import {
  getRequestClientIp,
  missingProductionClientIpResult,
  resolveAbuseLimiterIdentity,
} from "@/lib/security/client-ip";
import type { AbuseRateLimitResult } from "@/lib/security/abuse-rate-limit";
import type { AbuseRateLimitStore } from "@/lib/security/abuse-rate-limit-store";
import { NextResponse } from "next/server";

export const SHAPE_STUDIO_RATE_LIMIT_ERROR =
  "Too many capture requests. Please wait a moment and try again.";

export type ShapeStudioRateLimitOperation =
  | "create"
  | "upload"
  | "read"
  | "cancel"
  | "acknowledge";

const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Per-operation windows keyed by hashed client IP, independent of session id.
 * `read` is generous so desktop 1.5s polling through a 30-minute session succeeds.
 */
const OPERATION_WINDOWS: Record<
  ShapeStudioRateLimitOperation,
  { name: string; limit: number; windowMs: number }[]
> = {
  create: [
    { name: "burst", limit: 5, windowMs: ONE_MINUTE_MS },
    { name: "hourly", limit: 20, windowMs: ONE_HOUR_MS },
  ],
  upload: [
    { name: "burst", limit: 8, windowMs: ONE_MINUTE_MS },
    { name: "hourly", limit: 40, windowMs: ONE_HOUR_MS },
  ],
  read: [
    { name: "burst", limit: 120, windowMs: ONE_MINUTE_MS },
    { name: "hourly", limit: 2500, windowMs: ONE_HOUR_MS },
  ],
  cancel: [
    { name: "burst", limit: 10, windowMs: ONE_MINUTE_MS },
    { name: "hourly", limit: 40, windowMs: ONE_HOUR_MS },
  ],
  acknowledge: [
    { name: "burst", limit: 20, windowMs: ONE_MINUTE_MS },
    { name: "hourly", limit: 80, windowMs: ONE_HOUR_MS },
  ],
};

export async function checkShapeStudioRateLimit(
  operation: ShapeStudioRateLimitOperation,
  ip: string,
  now = Date.now(),
  store?: AbuseRateLimitStore,
): Promise<AbuseRateLimitResult> {
  const identity = resolveAbuseLimiterIdentity(ip);
  if (identity === null) {
    return missingProductionClientIpResult();
  }
  return consumeRateLimitWindows({
    namespace: `shape-studio:${operation}`,
    identity,
    windows: OPERATION_WINDOWS[operation],
    now,
    store,
  });
}

export async function checkShapeStudioRateLimitFromRequest(
  operation: ShapeStudioRateLimitOperation,
  request: Request,
  now = Date.now(),
): Promise<AbuseRateLimitResult> {
  return checkShapeStudioRateLimit(
    operation,
    getRequestClientIp(request),
    now,
  );
}

export async function rejectIfShapeStudioRateLimited(
  operation: ShapeStudioRateLimitOperation,
  request: Request,
  extraHeaders?: HeadersInit,
): Promise<NextResponse | null> {
  const result = await checkShapeStudioRateLimitFromRequest(operation, request);
  if (result.allowed) return null;
  return NextResponse.json(
    {
      error: "rate_limited",
      message: SHAPE_STUDIO_RATE_LIMIT_ERROR,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        ...extraHeaders,
      },
    },
  );
}
