/**
 * Dedicated read-only GA4 + GSC measurement smoke / preflight.
 *
 * Defaults:
 * - no email
 * - no persistence
 * - no fixture fallback
 * - sanitized output only
 *
 * Usage:
 *   npx tsx scripts/agent-os-measurement-smoke.ts
 *   npx tsx scripts/agent-os-measurement-smoke.ts --preflight-only
 *   npm run agent-os:measurement-smoke
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  preflightShouldExitNonzero,
  runMeasurementPreflight,
} from "../lib/agent-os/measurement/preflight";
import { containsLikelyPiiOrSecret } from "../lib/agent-os/redaction";

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

function assertNoSecrets(payload: unknown, path = "root"): void {
  if (typeof payload === "string") {
    if (containsLikelyPiiOrSecret(payload)) {
      throw new Error(`Secret-like content detected at ${path}`);
    }
    const lower = payload.toLowerCase();
    if (
      lower.includes("begin private key") ||
      lower.includes("client_secret=") ||
      /ya29\.[a-z0-9_-]+/i.test(payload) ||
      /1\/[a-z0-9_-]{20,}/i.test(payload)
    ) {
      throw new Error(`Credential-like content detected at ${path}`);
    }
    return;
  }
  if (Array.isArray(payload)) {
    payload.forEach((v, i) => assertNoSecrets(v, `${path}[${i}]`));
    return;
  }
  if (payload && typeof payload === "object") {
    for (const [k, v] of Object.entries(payload)) {
      if (typeof v === "boolean" || v === null || typeof v === "number") {
        continue;
      }
      const keyLower = k.toLowerCase();
      // Only reject string values on credential-shaped keys (not "tokenExchange", etc.).
      if (
        typeof v === "string" &&
        (keyLower === "access_token" ||
          keyLower === "accesstoken" ||
          keyLower === "refresh_token" ||
          keyLower === "refreshtoken" ||
          keyLower === "client_secret" ||
          keyLower === "clientsecret" ||
          keyLower === "authorization" ||
          keyLower === "password" ||
          keyLower.endsWith("_secret") ||
          keyLower.endsWith("_token"))
      ) {
        throw new Error(`Forbidden credential field in smoke output: ${path}.${k}`);
      }
      assertNoSecrets(v, `${path}.${k}`);
    }
  }
}

async function main() {
  loadEnvLocal();

  const args = new Set(process.argv.slice(2));
  if (args.has("--help") || args.has("-h")) {
    console.log(`Agent OS measurement smoke (read-only, no email)

Options:
  --preflight-only   Env + OAuth classification only (still probes token when configured)
  --json             Print JSON summary
  --help             Show this help

Exit codes:
  0  At least one source healthy/empty/lag, or probes succeeded without auth/access failure
  1  Config/auth/access failure, or neither source configured
`);
    process.exit(0);
  }

  // Explicit guard: this CLI never sends email.
  if (args.has("--send") || args.has("--deliver") || args.has("--email")) {
    console.error(
      "Refusing: measurement smoke never sends email. Use agent-os:cadence with explicit flags for delivery.",
    );
    process.exit(2);
  }

  const result = await runMeasurementPreflight({
    probeLive: true,
  });

  assertNoSecrets(result);

  const sanitized = {
    asOfUtc: result.asOfUtc,
    env: result.env,
    oauth: {
      configured: result.oauth.configured,
      tokenExchange: result.oauth.tokenExchange,
      healthCode: result.oauth.healthCode,
      message: result.oauth.message,
    },
    ga4: {
      configured: result.ga4.configured,
      propertyId: result.ga4.propertyIdDisplay,
      accessible: result.ga4.accessible,
      healthCode: result.ga4.healthCode,
      founderLabel: result.ga4.founderLabel,
      sessions: result.ga4.sessions ?? null,
      rowCount: result.ga4.rowCount ?? null,
      window: result.ga4.window ?? null,
      message: result.ga4.message ?? null,
    },
    gsc: {
      configured: result.gsc.configured,
      siteUrl: result.gsc.siteUrlDisplay,
      accessible: result.gsc.accessible,
      healthCode: result.gsc.healthCode,
      founderLabel: result.gsc.founderLabel,
      newestFinalizedDate: result.gsc.newestFinalizedDate ?? null,
      firstIncompleteDate: result.gsc.firstIncompleteDate ?? null,
      newestObservedActivityDate:
        result.gsc.newestObservedActivityDate ?? null,
      ageDays: result.gsc.ageDays ?? null,
      clicks: result.gsc.clicks ?? null,
      impressions: result.gsc.impressions ?? null,
      queryRows: result.gsc.queryRows ?? null,
      window: result.gsc.window ?? null,
      message: result.gsc.message ?? null,
      sourceTimezone: "America/Los_Angeles",
    },
    delivery: "disabled",
    persistence: "disabled",
  };

  assertNoSecrets(sanitized);

  if (args.has("--json")) {
    console.log(JSON.stringify(sanitized, null, 2));
  } else {
    console.log("Agent OS measurement smoke (read-only)");
    console.log("─────────────────────────────────────");
    console.log(`asOf: ${sanitized.asOfUtc}`);
    console.log(
      `env: CLIENT_ID=${sanitized.env.GOOGLE_CLIENT_ID ? "set" : "missing"} CLIENT_SECRET=${sanitized.env.GOOGLE_CLIENT_SECRET ? "set" : "missing"} REFRESH_TOKEN=${sanitized.env.GOOGLE_REFRESH_TOKEN ? "set" : "missing"} GA4_PROPERTY_ID=${sanitized.env.GA4_PROPERTY_ID ? "set" : "missing"} GSC_SITE_URL=${sanitized.env.GSC_SITE_URL ? "set" : "missing"}`,
    );
    console.log(
      `oauth: ${sanitized.oauth.tokenExchange}${sanitized.oauth.healthCode ? ` (${sanitized.oauth.healthCode})` : ""}`,
    );
    console.log(
      `GA4: ${sanitized.ga4.founderLabel} | property=${sanitized.ga4.propertyId ?? "n/a"} | accessible=${sanitized.ga4.accessible} | sessions=${sanitized.ga4.sessions ?? "n/a"} | rows≈${sanitized.ga4.rowCount ?? "n/a"} | window=${sanitized.ga4.window ? `${sanitized.ga4.window.start}→${sanitized.ga4.window.end}` : "n/a"}`,
    );
    console.log(
      `GSC: ${sanitized.gsc.founderLabel} | site=${sanitized.gsc.siteUrl ?? "n/a"} | accessible=${sanitized.gsc.accessible} | finalized=${sanitized.gsc.newestFinalizedDate ?? "n/a"} | firstIncomplete=${sanitized.gsc.firstIncompleteDate ?? "n/a"} | observed=${sanitized.gsc.newestObservedActivityDate ?? "n/a"} | ageDays=${sanitized.gsc.ageDays ?? "n/a"} | tz=${sanitized.gsc.sourceTimezone} | clicks=${sanitized.gsc.clicks ?? "n/a"} | queries=${sanitized.gsc.queryRows ?? "n/a"} | window=${sanitized.gsc.window ? `${sanitized.gsc.window.start}→${sanitized.gsc.window.end}` : "n/a"}`,
    );
    console.log("delivery: disabled | persistence: disabled");
  }

  const exitCode = preflightShouldExitNonzero(result) ? 1 : 0;
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(
    "Measurement smoke failed:",
    err instanceof Error ? err.message.slice(0, 240) : "unknown error",
  );
  process.exit(1);
});
