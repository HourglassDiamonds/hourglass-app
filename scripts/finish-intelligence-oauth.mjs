/**
 * After dual-scope OAuth setup: push token to Vercel, verify APIs, run production manual-test.
 * Usage: node scripts/finish-intelligence-oauth.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";

function loadEnvLocal() {
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
}

function runNode(script) {
  const r = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
  });
  return r.status === 0;
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opts,
  });
  return r.status === 0;
}

loadEnvLocal();

const refreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();
const cronSecret = process.env.CRON_SECRET?.trim();

if (!refreshToken) {
  console.error("GOOGLE_REFRESH_TOKEN missing in .env.local — run google-oauth-setup.mjs first.");
  process.exit(1);
}

console.log("\n1. Verifying dual-scope token locally...\n");
if (!runNode("scripts/verify-gsc-access.mjs")) {
  console.error("\nVerify failed — fix token before updating production.");
  process.exit(1);
}

console.log("\n2. Updating Vercel Production GOOGLE_REFRESH_TOKEN...\n");
if (!run("npx", ["vercel", "env", "rm", "GOOGLE_REFRESH_TOKEN", "production", "--yes"])) {
  process.exit(1);
}

const add = spawnSync(
  "npx",
  ["vercel", "env", "add", "GOOGLE_REFRESH_TOKEN", "production", "--yes"],
  {
    cwd: process.cwd(),
    input: refreshToken,
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
    shell: process.platform === "win32",
  },
);
if (add.status !== 0) {
  console.error("Failed to update Vercel GOOGLE_REFRESH_TOKEN");
  process.exit(1);
}

console.log("\n3. Production manual-test (weekly intelligence job)...\n");
if (!cronSecret) {
  console.error("CRON_SECRET missing in .env.local");
  process.exit(1);
}

const testUrl = `https://www.hourglassdiamonds.com/api/intelligence/manual-test?secret=${encodeURIComponent(cronSecret)}`;
const curl = spawnSync("curl", ["-sS", "-m", "180", testUrl], {
  encoding: "utf8",
});
if (curl.status !== 0) {
  console.error("manual-test request failed:", curl.stderr || curl.error);
  process.exit(1);
}
console.log(curl.stdout);

let parsed;
try {
  parsed = JSON.parse(curl.stdout);
} catch {
  console.error("manual-test did not return JSON");
  process.exit(1);
}
if (!parsed.ok) {
  console.error("manual-test failed:", parsed.error ?? parsed);
  process.exit(1);
}

console.log("\n4. Latest report GSC snapshot...\n");
runNode("scripts/check-latest-report-gsc.mjs");
