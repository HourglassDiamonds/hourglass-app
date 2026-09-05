import { NextResponse } from "next/server";
import { buildGoogleAuthUrl, Ga4OAuthError } from "@/lib/intelligence/google-oauth";

export const dynamic = "force-dynamic";

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

/**
 * Returns Google OAuth consent URL to obtain a refresh token (local setup).
 * Disabled when NODE_ENV or VERCEL_ENV is production — use stored
 * GOOGLE_REFRESH_TOKEN instead. Production responses are generic 404s.
 */
export async function GET() {
  if (isProductionRuntime()) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  try {
    const url = buildGoogleAuthUrl();
    return NextResponse.json({
      ok: true,
      authUrl: url,
      hint: "Open authUrl in a browser, sign in with your Google account (GA4 + Search Console access), then copy GOOGLE_REFRESH_TOKEN from the callback page into .env.local and Vercel Production.",
    });
  } catch (err) {
    const message =
      err instanceof Ga4OAuthError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Failed to build auth URL";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
