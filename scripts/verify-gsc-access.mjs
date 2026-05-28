/**
 * Verifies Search Console access with current OAuth env (no secrets printed).
 * Usage: node scripts/verify-gsc-access.mjs
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
      // .env.local wins over pre-existing shell env (e.g. stale vercel pull)
      process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnvLocal();

const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();
const siteUrl = process.env.GSC_SITE_URL?.trim();
const ga4PropertyId = process.env.GA4_PROPERTY_ID?.trim();

if (!clientId || !clientSecret || !refreshToken) {
  console.error("Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN");
  process.exit(1);
}

const redirectUri =
  process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ??
  "http://localhost:3000/api/intelligence/google-oauth-callback";

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  }),
});

if (!tokenRes.ok) {
  console.error("Token refresh failed:", tokenRes.status, (await tokenRes.text()).slice(0, 120));
  process.exit(1);
}

const { access_token: accessToken, scope: grantedScope } = await tokenRes.json();
const scopes = (grantedScope ?? "").split(" ").filter(Boolean);

console.log("Granted scopes:", scopes.length ? scopes.join(", ") : "(not returned by Google)");

const hasAnalytics = scopes.some((s) => s.includes("analytics"));
const hasWebmasters = scopes.some((s) => s.includes("webmasters"));

console.log("analytics.readonly:", hasAnalytics ? "yes" : "no");
console.log("webmasters.readonly:", hasWebmasters ? "yes" : "no");

let ga4Ok = true;
if (ga4PropertyId) {
  const ga4Res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${ga4PropertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }],
        metrics: [{ name: "sessions" }],
      }),
    },
  );
  ga4Ok = ga4Res.ok;
  console.log(
    "GA4 Data API:",
    ga4Ok ? "OK" : `failed (${ga4Res.status})`,
  );
  if (!ga4Ok && !hasAnalytics) {
    console.error("GA4 needs analytics.readonly on this refresh token.");
  }
} else {
  console.warn("GA4_PROPERTY_ID not set — skipping GA4 API smoke test");
}

if (!siteUrl) {
  console.warn("GSC_SITE_URL not set in .env.local — add exact Search Console property URL");
}

const sitesRes = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
  headers: { Authorization: `Bearer ${accessToken}` },
});

if (!sitesRes.ok) {
  const err = await sitesRes.text();
  console.error("Search Console sites.list failed:", sitesRes.status);
  if (sitesRes.status === 403) {
    console.error("Re-consent required: run node scripts/google-oauth-setup.mjs and update GOOGLE_REFRESH_TOKEN");
  }
  console.error(err.slice(0, 200));
  process.exit(1);
}

const sites = await sitesRes.json();
const entries = sites.siteEntry ?? [];
console.log("Search Console API: OK");
console.log("Sites visible:", entries.length);
if (entries.length > 0) {
  console.log("Registered properties:");
  for (const entry of entries) {
    console.log(`  ${entry.siteUrl}`);
  }
}

if (siteUrl) {
  const encoded = encodeURIComponent(siteUrl);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const fmt = (d) => d.toISOString().slice(0, 10);

  const queryRes = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: fmt(start),
        endDate: fmt(end),
        rowLimit: 1,
      }),
    },
  );

  if (!queryRes.ok) {
    console.error("searchAnalytics.query failed:", queryRes.status, (await queryRes.text()).slice(0, 200));
    console.error(
      `No permission for "${siteUrl}" — set GSC_SITE_URL to an exact property from the list above.`,
    );
    process.exit(1);
  }

  const data = await queryRes.json();
  const row = data.rows?.[0];
  console.log(`GSC query for ${siteUrl}: OK`);
  console.log(
    "Sample week totals:",
    row
      ? `impressions=${row.impressions ?? 0} clicks=${row.clicks ?? 0}`
      : "no rows (property may have zero data for range)",
  );
}

if (!hasAnalytics || !hasWebmasters) {
  console.error(
    "\nDual scope required (analytics.readonly + webmasters.readonly).",
  );
  console.error(
    "Revoke Hourglass at https://myaccount.google.com/permissions, then run:",
  );
  console.error("  node scripts/google-oauth-setup.mjs");
  process.exit(1);
}

if (ga4PropertyId && !ga4Ok) {
  process.exit(1);
}

console.log("\nIntelligence OAuth verification passed (GA4 + GSC).");
