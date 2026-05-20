import { NextResponse } from "next/server";
import { buildGoogleAuthUrl, Ga4OAuthError } from "@/lib/intelligence/google-oauth";

export const dynamic = "force-dynamic";

/** Returns Google OAuth consent URL to obtain a refresh token (one-time setup). */
export async function GET() {
  try {
    const url = buildGoogleAuthUrl();
    return NextResponse.json({
      ok: true,
      authUrl: url,
      hint: "Open authUrl in a browser, sign in with your GA4 user, then copy GOOGLE_REFRESH_TOKEN from the callback page into .env.local",
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
