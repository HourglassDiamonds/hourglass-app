/**
 * Prints the local Google OAuth consent URL for GA4 setup.
 * Usage: node scripts/google-oauth-setup.mjs
 * Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local
 */
import { readFileSync } from "fs";
import { resolve } from "path";

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
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnvLocal();

const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
const redirectUri =
  process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ??
  "http://localhost:3000/api/intelligence/google-oauth-callback";
const scope = encodeURIComponent(
  "https://www.googleapis.com/auth/analytics.readonly",
);

if (!clientId) {
  console.error("Set GOOGLE_CLIENT_ID (and GOOGLE_CLIENT_SECRET) in .env.local first.");
  process.exit(1);
}

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

console.log("\nHourglass GA4 OAuth setup\n");
console.log("1. Open this URL in your browser:\n");
console.log(authUrl);
console.log("\n2. Sign in with the Google account that has GA4 property access.");
console.log("3. Copy GOOGLE_REFRESH_TOKEN from the callback page into .env.local");
console.log("4. Restart npm run dev and POST /api/intelligence/weekly-report\n");
