import { NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  Ga4OAuthError,
  getOAuthRedirectUri,
} from "@/lib/intelligence/google-oauth";

export const dynamic = "force-dynamic";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * OAuth redirect handler — exchanges code for refresh token (setup only).
 * Disabled in production; set GOOGLE_REFRESH_TOKEN in Vercel env instead.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "OAuth callback disabled in production. Set GOOGLE_REFRESH_TOKEN in environment variables.",
      },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return new NextResponse(
      `<p>Google OAuth error: ${escapeHtml(oauthError)}</p>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  if (!code) {
    return NextResponse.json(
      { ok: false, error: "Missing authorization code" },
      { status: 400 },
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.refreshToken) {
      return new NextResponse(
        `<h1>Hourglass Intelligence — OAuth</h1><p>No refresh token returned. Revoke app access at <a href="https://myaccount.google.com/permissions">Google Account permissions</a>, then visit <code>/api/intelligence/google-auth-url</code> again with <code>prompt=consent</code>.</p><p>Redirect URI must be: <code>${escapeHtml(getOAuthRedirectUri())}</code></p>`,
        { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    }

    const html = `<!DOCTYPE html>
<html>
  <body style="font-family:Georgia,serif;max-width:640px;margin:40px auto;padding:0 20px;color:#1a1816;">
    <h1>Hourglass Intelligence — OAuth setup</h1>
    <p>Add this to <code>.env.local</code> (server-only, never commit):</p>
    <pre style="background:#f7f3ee;padding:16px;border:1px solid #e4dbcf;overflow:auto;word-break:break-all;">GOOGLE_REFRESH_TOKEN=${escapeHtml(tokens.refreshToken)}</pre>
    <p>Then restart <code>npm run dev</code> and run the weekly report endpoint.</p>
    <p style="font-size:12px;color:#6a635c;">Redirect URI: ${escapeHtml(getOAuthRedirectUri())}</p>
  </body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    const message =
      err instanceof Ga4OAuthError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Token exchange failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
