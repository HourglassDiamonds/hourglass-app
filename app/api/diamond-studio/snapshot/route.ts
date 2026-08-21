import { NextResponse } from "next/server";
import {
  parseStudioSnapshotRequest,
} from "@/lib/diamond-studio/configuration";
import { composeStudioSnapshot } from "@/lib/diamond-studio/snapshot";

export const runtime = "nodejs";
export const maxDuration = 20;

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const hits = new Map<string, number[]>();

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  return ip || request.headers.get("x-real-ip") || "local";
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

export async function GET(request: Request) {
  if (rateLimited(clientKey(request))) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const url = new URL(request.url);
  const parsed = parseStudioSnapshotRequest(url.searchParams);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, invalidParams: parsed.invalidParams },
      { status: 400 },
    );
  }

  try {
    const result = await composeStudioSnapshot(parsed.state, parsed.variant);
    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Studio-Snapshot-Variant": result.variant,
        "X-Studio-Snapshot-Width": String(result.width),
        "X-Studio-Snapshot-Height": String(result.height),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "snapshot_failed";
    console.error("[diamond-studio-snapshot]", message);
    return NextResponse.json({ error: "snapshot_failed" }, { status: 500 });
  }
}
