/**
 * GA4 + Search Console OAuth setup with manual callback fallback.
 * Usage: node scripts/google-oauth-setup.mjs
 *
 * Requires in .env.local: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 * Optional: GOOGLE_OAUTH_REDIRECT_URI (must match Google Cloud OAuth client)
 */
import { readFileSync, writeFileSync } from "fs";
import { createInterface } from "readline/promises";
import { resolve } from "path";
import { stdin as input, stdout as output } from "process";

const INTELLIGENCE_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
];

const TOKEN_URL = "https://oauth2.googleapis.com/token";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

function buildIntelligenceAuthUrl(clientId, redirectUri) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: INTELLIGENCE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    params,
  };
}

/**
 * @param {string} raw — full callback URL, query string, or authorization code
 */
function parseAuthorizationCode(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (
    /accounts\.google\.com\/signin\/oauth/i.test(trimmed) ||
    /accounts\.google\.com\/o\/oauth2\/v2\/auth/i.test(trimmed) ||
    (/consentsummary/i.test(trimmed) && !trimmed.includes("code="))
  ) {
    throw new Error(
      "That is a Google sign-in or consent page URL, not the callback. Click Continue on the consent screen, then copy the URL after redirect (should start with your redirect_uri and contain code=).",
    );
  }

  const oauthErrorMatch = trimmed.match(/[?&]error=([^&]+)/);
  if (oauthErrorMatch) {
    throw new Error(`Google OAuth error: ${decodeURIComponent(oauthErrorMatch[1])}`);
  }

  if (trimmed.includes("code=")) {
    const query = trimmed.includes("?")
      ? trimmed.slice(trimmed.indexOf("?") + 1)
      : trimmed.startsWith("code=")
        ? trimmed
        : null;
    if (query) {
      const code = new URLSearchParams(query).get("code");
      if (code) return code;
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    const err = url.searchParams.get("error");
    if (err) {
      throw new Error(`Google OAuth error: ${err}`);
    }
    const code = url.searchParams.get("code");
    if (code) return code;
  }

  if (/^[\w\-./]+$/.test(trimmed) && trimmed.length >= 20) {
    return trimmed;
  }

  throw new Error(
    "Could not parse authorization code. Paste the full browser URL after consent, or the code value only.",
  );
}

async function exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri }) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    const msg =
      typeof body.error_description === "string"
        ? body.error_description
        : typeof body.error === "string"
          ? body.error
          : `HTTP ${res.status}`;
    throw new Error(`Token exchange failed: ${msg}`);
  }

  return body;
}

function formatScopes(scopeField) {
  if (!scopeField || typeof scopeField !== "string") return "(none returned)";
  return scopeField.split(" ").filter(Boolean).join("\n  ");
}

function scopeFlags(scopeField) {
  const scopes = (scopeField ?? "").split(" ").filter(Boolean);
  return {
    hasAnalytics: scopes.some((s) => s.includes("analytics")),
    hasWebmasters: scopes.some((s) => s.includes("webmasters")),
  };
}

async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(
      typeof body.error_description === "string"
        ? body.error_description
        : body.error ?? `HTTP ${res.status}`,
    );
  }
  return body;
}

function writeRefreshTokenToEnvLocal(refreshToken) {
  const envPath = resolve(process.cwd(), ".env.local");
  let content = readFileSync(envPath, "utf8");
  const line = `GOOGLE_REFRESH_TOKEN=${refreshToken}`;
  if (/^GOOGLE_REFRESH_TOKEN=/m.test(content)) {
    content = content.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, line);
  } else {
    content = `${content.trimEnd()}\n${line}\n`;
  }
  writeFileSync(envPath, content, "utf8");
  process.env.GOOGLE_REFRESH_TOKEN = refreshToken;
}

function requireDualScopes(scopeField, phase) {
  const { hasAnalytics, hasWebmasters } = scopeFlags(scopeField);
  console.log(`analytics.readonly (${phase}):`, hasAnalytics ? "yes" : "no");
  console.log(`webmasters.readonly (${phase}):`, hasWebmasters ? "yes" : "no");
  if (!hasAnalytics || !hasWebmasters) {
    console.error(
      "\nDual scope required. Revoke Hourglass access at https://myaccount.google.com/permissions",
    );
    console.error("Re-run this script and approve BOTH Analytics and Search Console.");
    process.exit(1);
  }
}

async function promptForCallbackInput() {
  const rl = createInterface({ input, output });
  try {
    console.log("\n--- Manual callback (recommended if browser hangs) ---\n");
    console.log("After you click Continue on the consent screen, Google redirects away");
    console.log("from accounts.google.com to your redirect_uri (localhost).");
    console.log("Copy THAT address bar URL — it must contain code=");
    console.log("Do not paste the consentsummary or accounts.google.com consent URL.\n");
    console.log("Paste either:");
    console.log("  • Full redirect URL");
    console.log("  • Query string (?code=...&scope=...)");
    console.log("  • Raw authorization code\n");
    const line = await rl.question("Paste callback URL or code: ");
    return line.trim();
  } finally {
    rl.close();
  }
}

async function main() {
  loadEnvLocal();

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ??
    "http://localhost:3000/api/intelligence/google-oauth-callback";

  if (!clientId || !clientSecret) {
    console.error(
      "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local first.",
    );
    process.exit(1);
  }

  const { url: authUrl, params } = buildIntelligenceAuthUrl(clientId, redirectUri);

  console.log("\nHourglass Intelligence OAuth setup (GA4 + Search Console)\n");
  console.log("Query parameters:", [...params.keys()].join(", "));
  console.log("response_type:", params.get("response_type"));
  console.log("access_type:", params.get("access_type"));
  console.log("prompt:", params.get("prompt"));
  console.log(
    "Scopes:",
    INTELLIGENCE_SCOPES.map((s) => s.replace(/.*\//, "")).join(", "),
  );
  console.log("\n1. Open this URL in your browser:\n");
  console.log(authUrl);
  console.log("\n2. Approve BOTH Analytics and Search Console on the consent screen.");
  console.log(
    "3. Copy the localhost callback URL (contains code=) — paste below or pass as argv.",
  );
  console.log(
    "   Usage: node scripts/google-oauth-setup.mjs \"http://localhost:3000/...?code=...\"",
  );

  const pasted =
    process.argv[2]?.trim() || (await promptForCallbackInput());
  if (!pasted) {
    console.log("\nNo input — skipped token exchange. Re-run and paste the callback URL.");
    process.exit(0);
  }

  let code;
  try {
    code = parseAuthorizationCode(pasted);
  } catch (err) {
    console.error("\nParse error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  if (!code) {
    console.error("\nNo authorization code found in input.");
    process.exit(1);
  }

  console.log("\nExchanging authorization code for tokens...\n");

  let tokens;
  try {
    tokens = await exchangeCodeForTokens({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    console.error(
      "\nTip: redirect_uri must match exactly what is registered in Google Cloud",
    );
    console.error(`Expected: ${redirectUri}`);
    process.exit(1);
  }

  const refreshToken = tokens.refresh_token ?? null;
  const scope = tokens.scope ?? "";

  console.log("Scopes granted (exchange):");
  console.log("  " + formatScopes(scope));
  console.log("");
  console.log("refresh_token present:", refreshToken ? "yes" : "no");

  if (!refreshToken) {
    console.error(
      "\nNo refresh token returned. Revoke app access at https://myaccount.google.com/permissions",
    );
    console.error("then re-run this script (prompt=consent is already set).");
    process.exit(1);
  }

  requireDualScopes(scope, "exchange");

  const refreshed = await refreshAccessToken({
    clientId,
    clientSecret,
    refreshToken,
  });
  console.log("\nScopes on refresh:");
  console.log("  " + formatScopes(refreshed.scope ?? ""));
  requireDualScopes(refreshed.scope ?? scope, "refresh");

  writeRefreshTokenToEnvLocal(refreshToken);
  console.log("\nSaved GOOGLE_REFRESH_TOKEN to .env.local");
  console.log("\nNext: node scripts/finish-intelligence-oauth.mjs");
  console.log("(updates Vercel Production token + runs manual-test + report check)\n");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
